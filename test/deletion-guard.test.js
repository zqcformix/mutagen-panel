'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { prepareSessionDeletion, createMutationQueue } = require('../lib/deletion-guard');

const endpoint = (dir, host = 'prod', user = 'alice') => ({ protocol: 'ssh', host, user, path: dir });
const session = (id, dir, host, user) => ({
  identifier: id, alpha: endpoint(dir, host, user), beta: { protocol: 'local', path: 'D:\\local\\' + id },
});

function harness({ physical = {}, identities = {}, homes = {}, failedHost, localAddresses = [] } = {}) {
  const probes = [];
  const deps = {
    localAddresses,
    lookup: async (host) => [{ address: host === 'elsewhere' ? '192.0.2.2' : '192.0.2.1' }],
    ssh: { resolve: async (host) => {
      if (host === failedHost) throw new Error('Cannot resolve connection');
      return { hostname: identities[host] || host.split('@').pop() };
    } },
    remoteFs: { inspectPaths: async (host, port, paths) => {
      probes.push({ host, port, paths });
      const home = homes[host] || '/home/' + host.split('@')[0];
      return { home, paths: paths.map((p) => {
        const absolute = p.startsWith('~/') ? home + p.slice(1) : p === '~' ? home : p.startsWith('/') ? p : home + '/' + p;
        return { path: absolute, realPath: physical[host + ':' + absolute] || path.posix.normalize(absolute) };
      }) };
    } },
  };
  const prepare = (current, others = [], remoteKey = 'alpha') => prepareSessionDeletion(current, [current, ...others], remoteKey, deps);
  return { prepare, probes };
}

for (const [name, otherPath] of [['same root', '/srv/project'], ['parent root', '/srv'], ['child root', '/srv/project/sub']]) {
  test(`refuses ${name} used by another session`, async () => {
    await assert.rejects(harness().prepare(session('a', '/srv/project'), [session('b', otherPath)]), /重叠/);
  });
}

test('allows disjoint roots and retains exact target', async () => {
  const plan = await harness().prepare(session('a', '/srv/project'), [session('b', '/srv/project-copy')]);
  assert.equal(plan.target.path, '/srv/project');
  assert.equal(plan.expectedPath, '/srv/project');
});

test('alias and numeric IP cannot hide a shared directory', async () => {
  await assert.rejects(harness().prepare(session('a', '/srv/project', 'prod'), [session('b', '/srv/project', '192.0.2.1')]), /重叠/);
});

test('separate DNS names resolving to the same address remain protected', async () => {
  await assert.rejects(harness().prepare(session('a', '/srv/project', 'prod'), [session('b', '/srv/project', 'other-alias')]), /重叠/);
});

test('equivalent expanded and compressed IPv6 addresses protect the same roots', async () => {
  await assert.rejects(harness().prepare(session('a', '/srv/project', '2001:db8::1'), [
    session('b', '/srv/project', '2001:0db8:0000:0000:0000:0000:0000:0001'),
  ]), /重叠/);
});

test('expanded IPv6 loopback and IPv4-mapped loopback are recognized as local', async () => {
  for (const host of ['0:0:0:0:0:0:0:1', '::ffff:127.0.0.1', '::ffff:7f00:1']) {
    await assert.rejects(harness().prepare(session('a', '/srv/project', host)), /本机/);
  }
});

test('unrelated machines may use the same path', async () => {
  await harness().prepare(session('a', '/srv/project'), [session('b', '/srv/project', 'elsewhere')]);
});

test('relative roots use each endpoint user home', async () => {
  await assert.rejects(harness().prepare(session('a', '/home/bob/project'), [session('b', 'project', 'prod', 'bob')]), /重叠/);
});

test('tilde roots use each endpoint user home', async () => {
  await assert.rejects(harness().prepare(session('a', '/home/bob/project'), [session('b', '~/project', 'prod', 'bob')]), /重叠/);
});

test('temporary overwrite sessions also protect their roots', async () => {
  const other = session('temporary', '/srv/project');
  other.labels = { 'mp-temp': 'overwrite' };
  await assert.rejects(harness().prepare(session('a', '/srv/project'), [other]), /重叠/);
});

test('other endpoint of a remote-to-remote session is protected', async () => {
  const current = session('a', '/srv/project');
  current.beta = endpoint('/srv/project/sub');
  await assert.rejects(harness().prepare(current), /重叠/);
});

test('target containing a symlink ancestor is refused', async () => {
  await assert.rejects(harness({ physical: { 'alice@prod:/srv/link/project': '/data/project' } }).prepare(session('a', '/srv/link/project')), /符号链接/);
});

test('another root behind a symlink is resolved before overlap checks', async () => {
  await assert.rejects(harness({ physical: { 'alice@prod:/srv/link': '/data/project' } }).prepare(session('a', '/data/project'), [session('b', '/srv/link')]), /重叠/);
});

for (const dir of ['/', '/srv', '/home/alice', '/home']) {
  test(`refuses protected system/home directory ${dir}`, async () => {
    await assert.rejects(harness().prepare(session('a', dir)), /不能删除/);
  });
}

test('local endpoint cannot be selected for deletion', async () => {
  await assert.rejects(harness().prepare(session('a', '/srv/project'), [], 'beta'), /本地目录/);
});

test('remote side may be beta for reversed synchronization direction', async () => {
  const current = session('a', '/srv/project');
  [current.alpha, current.beta] = [current.beta, current.alpha];
  const plan = await harness().prepare(current, [], 'beta');
  assert.equal(plan.target.path, '/srv/project');
});

test('SSH loopback and local network addresses cannot delete local data', async () => {
  await assert.rejects(harness().prepare(session('a', '/srv/project', '127.0.0.1')), /本机/);
  await assert.rejects(harness({ localAddresses: ['192.0.2.1'] }).prepare(session('a', '/srv/project')), /本机/);
});

test('failure to identify another endpoint cancels destructive preflight', async () => {
  await assert.rejects(harness({ failedHost: 'alice@unknown' }).prepare(session('a', '/srv/project'), [session('b', '/srv/other', 'unknown')]), /Cannot resolve/);
});

test('directory names with trailing whitespace are not silently changed', async () => {
  const plan = await harness().prepare(session('a', '/srv/project '));
  assert.equal(plan.target.path, '/srv/project ');
});

test('session mutations wait for deletion and a rejected job releases the queue', async () => {
  const queue = createMutationQueue();
  const events = [];
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  const deleting = queue(async () => { events.push('deleting'); await barrier; events.push('deleted'); });
  const creating = queue(async () => { events.push('create'); throw new Error('failure'); });
  const recovered = queue(async () => { events.push('next'); });
  const failure = assert.rejects(creating, /failure/);
  await Promise.resolve();
  assert.deepEqual(events, ['deleting']);
  release();
  await Promise.all([deleting, failure, recovered]);
  assert.deepEqual(events, ['deleting', 'deleted', 'create', 'next']);
});
