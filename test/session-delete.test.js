'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const specs = require('../lib/spec');
const { prepareSessionDeletion, createMutationQueue } = require('../lib/deletion-guard');

const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
const current = () => ({
  identifier: 'current', alpha: { protocol: 'ssh', host: '192.0.2.1', user: 'tester', path: '/srv/project' },
  beta: { protocol: 'local', path: 'D:\\local\\project' },
});

// Execute the actual server orchestration with fake daemon/SSH/storage boundaries; no server is started.
function harness({ before, after = [], listFailureAt = 0, terminateFails = false, removeFails = false, cached = current() } = {}) {
  const events = [];
  let queries = 0;
  const state = { sessions: [cached] };
  const store = { data: { sessions: { current: {} } }, save: () => events.push('save') };
  class HttpError extends Error {
    constructor(status, message, code) { super(message); this.status = status; this.code = code; }
  }
  const context = vm.createContext({
    state, store, specs, prepareSessionDeletion, HttpError,
    badRequest: (message) => new HttpError(400, message),
    findSession: (id) => {
      const found = state.sessions.find((s) => s.identifier === id);
      if (!found) throw new HttpError(404, 'Session missing');
      return found;
    },
    setOp: (id, status) => events.push(status ? 'busy' : 'idle'),
    kick: async () => events.push('refresh'),
    applyList: (list) => { state.sessions = list; },
    ssh: { resolve: async () => ({ hostname: '192.0.2.1' }) },
    remoteFs: {
      inspectPaths: async (host, port, paths) => ({ home: '/home/tester', paths: paths.map((p) => ({ path: p, realPath: p })) }),
      remove: async (host, port, paths, options) => {
        events.push(options.checkOnly ? 'preflight' : 'remove');
        assert.equal(host, 'tester@192.0.2.1');
        assert.deepEqual(Array.from(paths), ['/srv/project']);
        assert.equal(options.protectContents, true);
        assert.equal(options.expectedPath, '/srv/project');
        if (!options.checkOnly && removeFails) throw new Error('Remote removal failed');
        return { paths, deleted: paths, missing: [], failed: [] };
      },
    },
    mgMust: async (args) => {
      if (args[1] === 'list') {
        events.push('list');
        queries++;
        if (queries === listFailureAt) throw new Error('Daemon list failed');
        return { stdout: JSON.stringify(queries === 1 ? (before || [current()]) : after) };
      }
      assert.deepEqual(Array.from(args), ['sync', 'terminate', 'current']);
      events.push('terminate');
      if (terminateFails) throw new Error('Terminate failed');
      return {};
    },
  });
  vm.runInContext(source.slice(source.indexOf('async function deletionSessions()'), source.indexOf('function patchMeta(')), context);
  return { events, store, remove: (options = { deleteRemote: true }) => context.deleteSession('current', options) };
}

test('stop target session successfully before removing only its remote path', async () => {
  const h = harness();
  const result = await h.remove();
  assert.equal(result.remote.deleted, true);
  assert.deepEqual(h.events, ['busy', 'list', 'preflight', 'terminate', 'save', 'list', 'remove', 'idle', 'refresh']);
});

test('ordinary session removal never calls SSH deletion', async () => {
  const h = harness();
  const result = await h.remove({ deleteRemote: false });
  assert.equal(result.remote, null);
  assert.deepEqual(h.events, ['busy', 'terminate', 'save', 'idle', 'refresh']);
});

test('failed stop preserves metadata and never deletes remote data', async () => {
  const h = harness({ terminateFails: true });
  await assert.rejects(h.remove(), /Terminate failed/);
  assert.ok(h.store.data.sessions.current);
  assert.ok(!h.events.includes('remove'));
});

test('failed fresh listing cannot use cached sessions to permit deletion', async () => {
  const h = harness({ listFailureAt: 1 });
  await assert.rejects(h.remove(), /Daemon list failed/);
  assert.ok(!h.events.includes('terminate'));
  assert.ok(!h.events.includes('remove'));
  assert.ok(h.store.data.sessions.current);
});

test('new overlapping session omitted from cache prevents target termination', async () => {
  const other = { ...current(), identifier: 'other' };
  const h = harness({ before: [current(), other] });
  await assert.rejects(h.remove(), /重叠/);
  assert.ok(!h.events.includes('terminate'));
  assert.ok(!h.events.includes('remove'));
});

test('session created externally during termination prevents remote deletion', async () => {
  const other = { ...current(), identifier: 'other', labels: { 'mp-temp': 'overwrite' } };
  const h = harness({ after: [other] });
  const result = await h.remove();
  assert.match(result.remote.error, /重叠/);
  assert.ok(h.events.includes('terminate'));
  assert.ok(!h.events.includes('remove'));
});

test('failed listing after termination preserves remote directory and reports partial outcome', async () => {
  const h = harness({ listFailureAt: 2 });
  const result = await h.remove();
  assert.match(result.remote.error, /Daemon list failed/);
  assert.ok(!h.events.includes('remove'));
});

test('remote failure is reported without invoking any local file operation', async () => {
  const h = harness({ removeFails: true });
  const result = await h.remove();
  assert.match(result.remote.error, /Remote removal failed/);
  assert.equal(result.remote.deleted, false);
});

test('server route registration serializes all session-changing operations', async () => {
  const context = vm.createContext({ createMutationQueue });
  vm.runInContext(source.slice(source.indexOf('const routes = [];'), source.indexOf("route('GET', '/api/ping'")) + '\nthis.register = route; this.registered = routes;', context);
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const events = [];
  context.register('DELETE', '/api/sessions/:id', async () => { events.push('delete'); await barrier; });
  for (const [method, pattern] of [
    ['POST', '/api/sessions'], ['PUT', '/api/sessions/:id'], ['POST', '/api/sessions/:id/overwrite'],
    ['POST', '/api/sessions/:id/resolve'], ['POST', '/api/bulk/:action'], ['POST', '/api/daemon/:action'],
    ['PUT', '/api/config'], ['POST', '/api/remote/delete'],
  ]) context.register(method, pattern, async () => events.push(pattern));
  const jobs = context.registered.map((r) => r.handler({}));
  await Promise.resolve();
  assert.deepEqual(events, ['delete']);
  release();
  await Promise.all(jobs);
  assert.equal(events.length, 9);
});
