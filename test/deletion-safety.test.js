'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Run the real filesystem guard, replacing only its SSH transport. No commands are executed.
function remoteHarness(respond) {
  const filename = path.join(__dirname, '../lib/remote-fs.js');
  const commands = [];
  const context = vm.createContext({
    require: createRequire(filename), module: { exports: {} }, Buffer, TextDecoder,
    mockRun: async (command) => {
      commands.push(command);
      if (respond) return respond(command);
      if (command === 'printf "%s" "$HOME"') return { code: 0, out: Buffer.from('/home/tester'), ms: 0 };
      throw new Error('Unexpected remote command: ' + command);
    },
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8') + `
    Channel = class {
      constructor() { this.ready = true; }
      run(command) { return mockRun(command); }
      close() {}
    };
  `, context, { filename });
  const remote = context.module.exports.createRemoteFs({
    getSsh: () => 'never-run-ssh', sshArgs: () => [], log: () => {},
    explainFailure: () => { throw new Error('Unexpected SSH connection'); },
  });
  return { remote, commands };
}

for (const candidate of ['/srv/project', '/srv/project/child', '/srv']) {
  test(`refuses deletion overlapping another session root: ${candidate}`, async () => {
    const { remote, commands } = remoteHarness();
    await assert.rejects(remote.remove('server', '', [candidate], {
      syncRoots: [{ path: '/srv/project', title: 'Other session' }], checkOnly: true, protectContents: true,
    }), (error) => error.code === 'PROTECTED');
    assert.ok(commands.every((command) => !command.includes('rm -rf')));
  });
}

test('allows preflight for a disjoint directory without deleting files', async () => {
  const { remote, commands } = remoteHarness();
  const result = await remote.remove('server', '', ['/srv/project-copy'], {
    syncRoots: [{ path: '/srv/project', title: 'Other session' }], checkOnly: true, protectContents: true,
  });
  assert.equal(result.paths[0], '/srv/project-copy');
  assert.ok(commands.every((command) => !command.includes('rm -rf')));
});

test('ordinary file manager deletion keeps its separate child-file semantics', async () => {
  const { remote } = remoteHarness();
  await remote.remove('server', '', ['/srv/project/child'], {
    syncRoots: [{ path: '/srv/project', title: 'Other session' }], checkOnly: true,
  });
});

test('realpath inspection parses home and physical paths without trimming names', async () => {
  const { remote, commands } = remoteHarness(() => ({
    code: 0, out: Buffer.from('H\t/home/tester\0P\t/home/tester/project \0R\t/home/tester/project \0'),
  }));
  const info = await remote.inspectPaths('server', '', ['~/project ']);
  assert.equal(info.home, '/home/tester');
  assert.equal(info.paths[0].realPath, '/home/tester/project ');
  assert.ok(commands[0].includes('"$HOME"/\'project \''));
  assert.ok(!commands[0].includes('rm -rf'));
});

for (const response of [
  { code: 1, out: Buffer.from('permission denied') },
  { code: 0, out: Buffer.from('H\t/home/tester\0P\t/srv/project\0') },
  { code: 0, out: Buffer.from('H\t/home/tester\0P\t/srv/project\0R\t/srv/project') },
]) {
  test('incomplete or failed path inspection is rejected', async () => {
    const { remote } = remoteHarness(() => response);
    await assert.rejects(remote.inspectPaths('server', '', ['/srv/project']), (error) => error.code === 'PATH_CHECK_FAILED');
  });
}

test('path changed to a symlink after preflight never reaches deletion command', async () => {
  const { remote, commands } = remoteHarness((command) => command === 'printf "%s" "$HOME"'
    ? { code: 0, out: Buffer.from('/home/tester') }
    : { code: 0, out: Buffer.from('H\t/home/tester\0P\t/srv/project\0R\t/other/project\0') });
  await assert.rejects(remote.remove('server', '', ['/srv/project'], { expectedPath: '/srv/project', protectContents: true }), (error) => error.code === 'PATH_CHANGED');
  assert.ok(commands.every((command) => !command.includes('rm -rf')));
});

test('unconfirmed remote removal cannot be reported as success', async () => {
  const { remote } = remoteHarness((command) => command === 'printf "%s" "$HOME"'
    ? { code: 0, out: Buffer.from('/home/tester') }
    : { code: 0, out: Buffer.alloc(0) });
  await assert.rejects(remote.remove('server', '', ['/srv/project']), (error) => error.code === 'DELETE_UNCONFIRMED');
});
