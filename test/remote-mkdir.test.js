'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

// Loads the real remote-fs module with its SSH channel replaced, so only the generated shell commands are observed.
function remoteHarness(respond) {
  const filename = path.join(__dirname, '../lib/remote-fs.js');
  const commands = [];
  const logs = [];
  const context = vm.createContext({
    require: createRequire(filename), module: { exports: {} }, Buffer, TextDecoder,
    mockRun: async (command) => { commands.push(command); return respond(command); },
  });
  vm.runInContext(fs.readFileSync(filename, 'utf8') + `
    Channel = class {
      constructor() { this.ready = true; }
      run(command) { return mockRun(command); }
      close() {}
    };
  `, context, { filename });
  const remote = context.module.exports.createRemoteFs({
    getSsh: () => 'never-run-ssh', sshArgs: () => [], log: (e) => logs.push(e),
    explainFailure: () => { throw new Error('Unexpected SSH connection'); },
  });
  return { remote, commands, logs };
}

const reply = (out, code = 0) => () => ({ code, out: Buffer.from(out), ms: 3 });

test('mkdir creates the folder inside the listed directory and reports its full path', async () => {
  const { remote, commands, logs } = remoteHarness(reply('C\t/srv/app\0'));
  const r = await remote.mkdir('server', '', '/srv/app', '  new dir ');
  assert.equal(r.path, '/srv/app/new dir');
  assert.equal(r.parent, '/srv/app');
  assert.ok(commands[0].includes("n='new dir'"));
  assert.ok(commands[0].includes('mkdir -- "$n"'));
  assert.ok(!commands[0].includes('mkdir -p'));
  assert.equal(logs.length, 1);
});

test('mkdir quotes names so shell metacharacters stay literal', async () => {
  const { remote, commands } = remoteHarness(reply('C\t/srv\0'));
  await remote.mkdir('server', '', '/srv', "it's $(rm -rf ~)");
  assert.ok(commands[0].includes("n='it'\\''s $(rm -rf ~)'"));
});

test('mkdir keeps ~ expandable for the parent directory', async () => {
  const { remote, commands } = remoteHarness(reply('C\t/home/tester/work\0'));
  const r = await remote.mkdir('server', '', '~/work', 'x');
  assert.ok(commands[0].startsWith('d="$HOME"/\'work\''));
  assert.equal(r.path, '/home/tester/work/x');
});

for (const name of ['', '   ', '.', '..', 'a/b', '/abs', 'line\nbreak', 'x'.repeat(256)]) {
  test(`mkdir rejects invalid name ${JSON.stringify(name.slice(0, 20))} without contacting the server`, async () => {
    const { remote, commands } = remoteHarness(reply(''));
    await assert.rejects(remote.mkdir('server', '', '/srv', name), (e) => e.code === 'BAD_NAME');
    assert.equal(commands.length, 0);
  });
}

for (const [out, code, status] of [
  ['X\tNODIR\0', 'NO_DIR', 404],
  ['X\tNOPERM\0', 'NO_PERM', 403],
  ['X\tEXISTS\0', 'EXISTS', 409],
  ["X\tFAIL\u0001mkdir: cannot create directory 'x': Permission denied\0", 'NO_PERM', 403],
  ["X\tFAIL\u0001mkdir: cannot create directory 'x': No space left on device\0", 'MKDIR_FAILED', 500],
  ['', 'MKDIR_FAILED', 500],
]) {
  test(`mkdir maps server result to ${code}`, async () => {
    const { remote } = remoteHarness(reply(out, out ? 4 : 0));
    await assert.rejects(remote.mkdir('server', '', '/srv', 'x'), (e) => e.code === code && e.status === status);
  });
}
