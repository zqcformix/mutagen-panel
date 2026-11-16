'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const { run, displayCmd, cleanOutput } = require('./lib/exec');
const { Store } = require('./lib/store');
const specs = require('./lib/spec');
const { createSsh, parseSshConfig, cdExpr, shq, SSH_CONFIG_FILE } = require('./lib/ssh');
const { createRemoteFs } = require('./lib/remote-fs');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const DATA_DIR = path.join(ROOT, 'data');
const TMP_DIR = path.join(DATA_DIR, 'tmp');
const BACKUP_DIR = path.join(DATA_DIR, 'conflict-backups');
const PUBLIC_DIR = path.join(ROOT, 'public');
const APP = { name: 'mutagen-panel', version: require('./package.json').version };
const IS_WIN = process.platform === 'win32';
const PANEL_LABELS = { 'managed-by': 'mutagen-panel' };
const TEMP_LABEL = 'mp-temp';

const DEFAULT_CONFIG = {
  mutagen: 'mutagen',
  host: '127.0.0.1',
  port: 7790,
  openBrowser: true,
  pollIntervalMs: 1000,
  ssh: 'ssh',
  sshKeygen: 'ssh-keygen',
  editors: { vscode: 'code', idea: 'idea64' },
  localRoot: '',
  // '' = reuse the host of the last created session, '__local' = sync between two local folders.
  defaultHost: '',
};

function loadConfig() {
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(`config.json 解析失败：${error.message}`);
  }
  return { ...DEFAULT_CONFIG, ...raw, editors: { ...DEFAULT_CONFIG.editors, ...(raw.editors || {}) } };
}

let config = loadConfig();
const store = new Store(path.join(DATA_DIR, 'panel.json'));

class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const badRequest = (message, code) => new HttpError(400, message, code);

function mutagenBin() {
  const p = String(config.mutagen || '').trim() || 'mutagen';
  if (path.isAbsolute(p) || p.includes('/') || p.includes('\\')) return path.resolve(ROOT, p);
  return p;
}

// ---------------------------------------------------------------- logs & SSE

const logs = [];
let logSeq = 0;
const clients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(payload);
}

function addLog(entry) {
  const item = { id: ++logSeq, ts: Date.now(), ...entry };
  logs.push(item);
  if (logs.length > 300) logs.shift();
  broadcast('log', item);
  return item;
}

const ssh = createSsh({ getSsh: () => config.ssh || 'ssh', getKeygen: () => config.sshKeygen || 'ssh-keygen', log: addLog });
const remoteFs = createRemoteFs({ getSsh: () => config.ssh || 'ssh', sshArgs: ssh.sshArgs, explainFailure: ssh.explainFailure, log: addLog });

// ---------------------------------------------------------------- mutagen

function friendlyMutagenError(r) {
  if (r.error && r.error.code === 'ENOENT') {
    return `找不到 mutagen 可执行文件：${mutagenBin()}。请在「设置」或 config.json 的 mutagen 字段里填写 mutagen.exe 的完整路径`;
  }
  const lines = (r.out || '').split('\n').map((l) => l.replace(/^Error:\s*/i, '').trim()).filter(Boolean);
  const errLine = [...lines].reverse().find((l) => /error|unable|invalid|failed|not|denied|refused/i.test(l));
  return errLine || lines[lines.length - 1] || `mutagen 退出码 ${r.code}`;
}

async function mg(args, { timeout = 60000, quiet = false } = {}) {
  const r = await run(mutagenBin(), args, { timeout });
  const out = cleanOutput([r.stdout, r.stderr].filter(Boolean).join('\n'));
  if (!quiet) addLog({ kind: 'mutagen', cmd: displayCmd('mutagen', args), code: r.code, ms: r.ms, out: out.slice(0, 8000) });
  return { ...r, out };
}

async function mgMust(args, opts) {
  const r = await mg(args, opts);
  if (r.code !== 0) throw new HttpError(500, friendlyMutagenError(r), 'MUTAGEN');
  return r;
}

function parseCreatedId(out) {
  const m = /Created session (sync_[A-Za-z0-9]+)/.exec(out || '');
  if (!m) throw new HttpError(500, `无法解析新会话 ID：${out}`);
  return m[1];
}

// ---------------------------------------------------------------- state & polling

const state = {
  sessions: [],
  version: null,
  versionError: null,
  daemon: false,
  listError: null,
  ops: {},
  runtime: {},
  lastVersionCheck: 0,
  lastDaemonStart: 0,
  autostart: null,
  autostartCheckedAt: 0,
};

const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const LAUNCH_AGENT = path.join(os.homedir(), 'Library', 'LaunchAgents', 'io.mutagen.mutagen.plist');

/** `mutagen daemon register` writes HKCU\...\Run\Mutagen on Windows and a launchd agent on macOS; mutagen has no command to query it. */
async function refreshAutostart() {
  state.autostartCheckedAt = Date.now();
  let next = null;
  if (IS_WIN) {
    const r = await run('reg', ['query', RUN_KEY, '/v', 'Mutagen'], { timeout: 8000 });
    if (r.code === 0) {
      const m = /REG_\w+\s+(.*)$/m.exec(r.stdout);
      const command = m ? m[1].trim() : '';
      const exe = (/^"([^"]+)"/.exec(command) || /^(\S+)/.exec(command) || [])[1] || '';
      const bin = mutagenBin();
      // reg prints in the OEM code page, so a non-ASCII path can arrive garbled and must not be compared.
      const comparable = path.isAbsolute(bin) && path.isAbsolute(exe) && !exe.includes('\uFFFD');
      next = { enabled: true, command, exe, samePath: !comparable || path.resolve(exe).toLowerCase() === path.resolve(bin).toLowerCase() };
    } else if (r.code === 1) next = { enabled: false };
  } else if (process.platform === 'darwin') {
    next = { enabled: fs.existsSync(LAUNCH_AGENT), samePath: true };
  }
  if (JSON.stringify(next) !== JSON.stringify(state.autostart)) {
    state.autostart = next;
    publish();
  }
}

async function initMutagen() {
  state.lastVersionCheck = Date.now();
  refreshAutostart().catch(() => {});
  const v = await mg(['version'], { quiet: true, timeout: 15000 });
  if (v.code !== 0) {
    state.version = null;
    state.versionError = friendlyMutagenError(v);
    return false;
  }
  state.version = v.stdout.trim();
  state.versionError = null;
  await mg(['daemon', 'start'], { timeout: 30000 });
  await cleanupTempSessions();
  return true;
}

async function cleanupTempSessions() {
  const r = await mg(['sync', 'list', '--template', '{{json .}}'], { quiet: true, timeout: 20000 });
  if (r.code !== 0) return;
  try {
    for (const s of JSON.parse(r.stdout.trim() || '[]')) {
      if (s.labels && s.labels[TEMP_LABEL]) await mg(['sync', 'terminate', s.identifier]);
    }
  } catch { /* ignore */ }
}

function applyList(list) {
  const now = Date.now();
  const ids = new Set();
  for (const s of list) {
    ids.add(s.identifier);
    const cycles = s.successfulCycles || 0;
    const rt = state.runtime[s.identifier];
    if (!rt) state.runtime[s.identifier] = { cycles, lastCycleAt: null };
    else if (cycles > rt.cycles) {
      rt.cycles = cycles;
      rt.lastCycleAt = now;
    } else if (cycles < rt.cycles) rt.cycles = cycles;
  }
  for (const id of Object.keys(state.runtime)) if (!ids.has(id)) delete state.runtime[id];
  state.sessions = list;

  if (!Object.keys(state.ops).length) {
    let changed = false;
    for (const id of Object.keys(store.data.sessions)) {
      if (!ids.has(id)) {
        delete store.data.sessions[id];
        changed = true;
      }
    }
    if (changed) store.save();
  }
}

let pollRunning = null;
let pollQueued = null;
let pollTimer = null;
let lastListErrorLogged = null;

/** Coalesces concurrent refresh requests: callers awaiting poll() always see a list fetched after their call. */
function poll() {
  if (pollQueued) return pollQueued;
  if (pollRunning) {
    pollQueued = pollRunning.then(() => {
      pollQueued = null;
      return runPoll();
    });
    return pollQueued;
  }
  return runPoll();
}

function runPoll() {
  clearTimeout(pollTimer);
  pollRunning = doPoll().finally(() => {
    pollRunning = null;
    clearTimeout(pollTimer);
    pollTimer = setTimeout(poll, Math.max(400, Number(config.pollIntervalMs) || 1000));
  });
  return pollRunning;
}

async function doPoll() {
  try {
    if (!state.version && Date.now() - state.lastVersionCheck > 4000) await initMutagen();
    if (state.version && Date.now() - state.autostartCheckedAt > 30000) refreshAutostart().catch(() => {});
    if (state.version) {
      const r = await mg(['sync', 'list', '--template', '{{json .}}'], { quiet: true, timeout: 20000 });
      if (r.code === 0) {
        applyList(JSON.parse(r.stdout.trim() || '[]'));
        state.listError = null;
        state.daemon = true;
        lastListErrorLogged = null;
      } else {
        state.listError = friendlyMutagenError(r);
        state.daemon = false;
        if (lastListErrorLogged !== state.listError) {
          lastListErrorLogged = state.listError;
          addLog({ kind: 'mutagen', cmd: 'mutagen sync list', code: r.code, ms: r.ms, out: r.out.slice(0, 4000) });
        }
        if (r.error && r.error.code === 'ENOENT') state.version = null;
        else if (Date.now() - state.lastDaemonStart > 10000) {
          state.lastDaemonStart = Date.now();
          await mg(['daemon', 'start'], { timeout: 30000 });
        }
      }
    }
  } catch (error) {
    state.listError = error.message;
  } finally {
    publish();
  }
}

function kick() {
  return poll();
}

function setOp(id, text) {
  if (text) state.ops[id] = text;
  else delete state.ops[id];
  publish();
}

function findSession(id) {
  const s = state.sessions.find((x) => x.identifier === id);
  if (!s) throw new HttpError(404, '会话不存在或已被删除');
  return s;
}

function specOf(session) {
  const meta = store.data.sessions[session.identifier];
  return (meta && meta.spec) || specs.deriveSpec(session);
}

function ensureMeta(id) {
  if (!store.data.sessions[id]) {
    const s = state.sessions.find((x) => x.identifier === id);
    store.data.sessions[id] = { title: (s && s.name) || '', groupId: null, order: null };
  }
  return store.data.sessions[id];
}

function commandFor(spec, title) {
  return displayCmd('mutagen', specs.buildCreateArgs(spec, { name: specs.mutagenName(title) }));
}

function clientSession(s) {
  const meta = store.data.sessions[s.identifier] || {};
  const spec = meta.spec || specs.deriveSpec(s);
  const rt = state.runtime[s.identifier] || {};
  const title = meta.title || s.name || s.identifier.slice(5, 17);
  let command = '';
  try { command = commandFor(spec, title); } catch { /* derived specs may be partial */ }
  return {
    ...s,
    _panel: {
      title,
      groupId: meta.groupId || null,
      order: meta.order ?? null,
      spec,
      managed: !!meta.spec,
      remoteKey: specs.remoteKeyOf(s, meta.spec),
      lastCycleAt: rt.lastCycleAt || null,
      op: state.ops[s.identifier] || null,
      command,
    },
  };
}

function snapshot() {
  return {
    app: APP,
    platform: process.platform,
    mutagen: {
      path: mutagenBin(),
      version: state.version,
      error: state.versionError,
      daemon: state.daemon,
      autostart: state.autostart,
      listError: state.listError,
    },
    defaultHost: config.defaultHost || '',
    groups: store.data.groups,
    sessions: state.sessions.filter((s) => !(s.labels && s.labels[TEMP_LABEL])).map(clientSession),
  };
}

let lastSnapshot = '';
function publish(force = false) {
  const snap = JSON.stringify(snapshot());
  if (!force && snap === lastSnapshot) return;
  lastSnapshot = snap;
  for (const res of clients) res.write(`event: state\ndata: ${snap}\n\n`);
}

// ---------------------------------------------------------------- session operations

async function resolveGroupId(body) {
  const name = String(body.newGroupName || '').trim();
  if (name) {
    const existing = store.data.groups.find((g) => g.name === name);
    if (existing) return existing.id;
    const g = { id: `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name };
    store.data.groups.push(g);
    return g.id;
  }
  const id = body.groupId || null;
  return id && store.data.groups.some((g) => g.id === id) ? id : null;
}

/** mutagen creates a missing root but not its missing parents, so create local roots up front. */
async function ensureLocalRoots(spec) {
  const dirs = [spec.local.path];
  if (!spec.remote.host) dirs.push(spec.remote.path);
  for (const dir of dirs) {
    try {
      await fsp.mkdir(dir, { recursive: true });
    } catch (error) {
      throw badRequest(`无法创建本地目录 ${dir}：${error.message}`);
    }
  }
}

async function requireSsh(spec) {
  if (!spec.remote.host) return;
  const t = await ssh.test(spec.remote.host, spec.remote.port);
  if (!t.ok) throw badRequest(`SSH 连接失败：${t.message}`, t.code);
}

function nextOrder() {
  const orders = Object.values(store.data.sessions).map((m) => (typeof m.order === 'number' ? m.order : 0));
  return (orders.length ? Math.max(...orders) : 0) + 1;
}

async function createSession(body) {
  const spec = specs.normalizeSpec(body.spec);
  const title = String(body.title || '').trim() || path.basename(spec.local.path) || '未命名会话';
  await requireSsh(spec);
  await ensureLocalRoots(spec);
  const groupId = await resolveGroupId(body);
  const args = specs.buildCreateArgs(spec, { name: specs.mutagenName(title), labels: PANEL_LABELS, paused: !!body.paused });
  const r = await mgMust(args, { timeout: 10 * 60 * 1000 });
  const id = parseCreatedId(r.out);
  store.data.sessions[id] = { title, groupId, order: nextOrder(), spec };
  store.save();
  await kick();
  return { id };
}

async function editSession(id, body) {
  const session = findSession(id);
  const old = { ...ensureMeta(id) };
  const oldSpec = specOf(session);
  const spec = specs.normalizeSpec(body.spec);
  const title = String(body.title || '').trim() || old.title || '未命名会话';
  const groupId = await resolveGroupId(body);

  if (JSON.stringify(spec) === JSON.stringify(oldSpec)) {
    Object.assign(store.data.sessions[id], { title, groupId, spec });
    store.save();
    publish();
    return { id, recreated: false };
  }

  await requireSsh(spec);
  await ensureLocalRoots(spec);
  setOp(id, '正在按新配置重建会话…');
  try {
    await mgMust(['sync', 'terminate', id]);
    const createOpts = { name: specs.mutagenName(title), labels: PANEL_LABELS, paused: !!session.paused };
    let newId;
    try {
      newId = parseCreatedId((await mgMust(specs.buildCreateArgs(spec, createOpts), { timeout: 10 * 60 * 1000 })).out);
    } catch (error) {
      const rb = await mg(specs.buildCreateArgs(oldSpec, { ...createOpts, name: specs.mutagenName(old.title || title) }), { timeout: 10 * 60 * 1000 });
      if (rb.code === 0) {
        const rbId = parseCreatedId(rb.out);
        store.data.sessions[rbId] = { ...old, spec: oldSpec };
        delete store.data.sessions[id];
        store.save();
        throw new HttpError(500, `新配置创建失败，已恢复原会话：${error.message}`);
      }
      throw error;
    }
    delete store.data.sessions[id];
    store.data.sessions[newId] = { title, groupId, order: old.order ?? nextOrder(), spec };
    store.save();
    return { id: newId, recreated: true };
  } finally {
    setOp(id, null);
    await kick();
  }
}

async function waitForCycle(id, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await mg(['sync', 'list', id, '--template', '{{json .}}'], { quiet: true, timeout: 20000 });
    if (r.code !== 0) throw new HttpError(500, friendlyMutagenError(r));
    const s = JSON.parse(r.stdout.trim() || '[]')[0];
    if (!s) throw new HttpError(500, '临时会话意外消失');
    if (String(s.status).startsWith('halted')) throw new HttpError(500, `同步被 mutagen 中止：${s.status}（源目录为空或被删除时 mutagen 会拒绝覆盖）`);
    if (s.status === 'watching' && (s.successfulCycles || 0) >= 1) return s;
    if (Date.now() > deadline) throw new HttpError(504, `等待同步完成超时${s.lastError ? `：${s.lastError}` : ''}`);
    await new Promise((r2) => setTimeout(r2, 800));
  }
}

/**
 * Pauses the session, mirrors one side onto the other with a temporary one-way-replica session,
 * then resets history so the resumed session does not replay the mirror's deletions back to the source.
 */
async function overwriteSession(id, target) {
  if (!['local', 'remote'].includes(target)) throw badRequest('target 只能是 local 或 remote');
  const session = findSession(id);
  const spec = specOf(session);
  const rk = specs.remoteKeyOf(session, (store.data.sessions[id] || {}).spec);
  const lk = rk === 'alpha' ? 'beta' : 'alpha';
  const remoteUrl = specs.rawEndpointUrl(session[rk]);
  const localUrl = specs.rawEndpointUrl(session[lk]);
  const source = target === 'local' ? remoteUrl : localUrl;
  const dest = target === 'local' ? localUrl : remoteUrl;
  const wasPaused = !!session.paused;
  setOp(id, target === 'local' ? '正在用服务器内容覆盖本地…' : '正在用本地内容覆盖服务器…');
  let tmpId = null;
  try {
    if (!wasPaused) await mgMust(['sync', 'pause', id]);
    const args = specs.buildCreateArgs(spec, {
      name: `overwrite-${Date.now().toString(36)}`,
      labels: { ...PANEL_LABELS, [TEMP_LABEL]: 'overwrite' },
      override: { alpha: source, beta: dest, mode: 'one-way-replica' },
    });
    tmpId = parseCreatedId((await mgMust(args, { timeout: 10 * 60 * 1000 })).out);
    await waitForCycle(tmpId, 60 * 60 * 1000);
    await mgMust(['sync', 'terminate', tmpId]);
    tmpId = null;
    await mgMust(['sync', 'reset', id]);
  } finally {
    if (tmpId) await mg(['sync', 'terminate', tmpId]);
    if (!wasPaused) await mg(['sync', 'resume', id]);
    setOp(id, null);
    await kick();
  }
  return { ok: true };
}

function safeRelative(root) {
  const rel = String(root || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!rel || rel.split('/').some((seg) => seg === '..' || seg === '')) throw badRequest('非法的冲突路径');
  return rel;
}

async function moveLocal(src, dest) {
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fsp.rename(src, dest);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fsp.cp(src, dest, { recursive: true });
    await fsp.rm(src, { recursive: true, force: true });
  }
}

async function resolveConflict(id, body) {
  const session = findSession(id);
  const rel = safeRelative(body.root);
  if (!['remote', 'local'].includes(body.keep)) throw badRequest('keep 只能是 remote 或 local');
  const rk = specs.remoteKeyOf(session, (store.data.sessions[id] || {}).spec);
  const loserKey = body.keep === 'remote' ? (rk === 'alpha' ? 'beta' : 'alpha') : rk;
  const loser = session[loserKey];
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let movedTo;
  if (loser.protocol === 'local') {
    const src = path.join(loser.path, ...rel.split('/'));
    movedTo = path.join(BACKUP_DIR, stamp, ...rel.split('/'));
    await moveLocal(src, movedTo);
    addLog({ kind: 'panel', cmd: `移动冲突副本 ${src}`, code: 0, ms: 0, out: `→ ${movedTo}` });
  } else if (loser.protocol === 'ssh') {
    const host = `${loser.user ? `${loser.user}@` : ''}${loser.host}`;
    movedTo = await ssh.moveToTrash(host, loser.port || '', loser.path, rel, stamp);
  } else {
    throw badRequest(`暂不支持 ${loser.protocol} 端点的冲突处理`);
  }
  await mg(['sync', 'flush', '--skip-wait', id]);
  await kick();
  return { movedTo };
}

async function sessionAction(id, action) {
  findSession(id);
  const map = {
    flush: ['sync', 'flush', '--skip-wait', id],
    pause: ['sync', 'pause', id],
    resume: ['sync', 'resume', id],
    reset: ['sync', 'reset', id],
  };
  if (!map[action]) throw new HttpError(404, '未知操作');
  await mgMust(map[action]);
  await kick();
  return { ok: true };
}

async function bulkAction(action, ids) {
  await poll();
  const visible = state.sessions.filter((s) => !(s.labels && s.labels[TEMP_LABEL]) && !state.ops[s.identifier]);
  let pick = Array.isArray(ids) && ids.length ? visible.filter((s) => ids.includes(s.identifier)) : visible;
  if (action === 'flush' || action === 'pause') pick = pick.filter((s) => !s.paused);
  else if (action === 'resume') pick = pick.filter((s) => s.paused);
  else throw new HttpError(404, '未知批量操作');
  if (!pick.length) return { count: 0 };
  const args = action === 'flush' ? ['sync', 'flush', '--skip-wait'] : ['sync', action];
  await mgMust([...args, ...pick.map((s) => s.identifier)]);
  await kick();
  return { count: pick.length };
}

async function deleteSession(id) {
  findSession(id);
  await mgMust(['sync', 'terminate', id]);
  delete store.data.sessions[id];
  store.save();
  await kick();
  return { ok: true };
}

function patchMeta(id, body) {
  findSession(id);
  const meta = ensureMeta(id);
  if (typeof body.title === 'string' && body.title.trim()) meta.title = body.title.trim();
  if ('groupId' in body) meta.groupId = store.data.groups.some((g) => g.id === body.groupId) ? body.groupId : null;
  store.save();
  publish();
  return { ok: true };
}

function applyLayout(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  items.forEach((item, index) => {
    if (!state.sessions.some((s) => s.identifier === item.id)) return;
    const meta = ensureMeta(item.id);
    meta.order = index + 1;
    meta.groupId = store.data.groups.some((g) => g.id === item.groupId) ? item.groupId : null;
  });
  store.save();
  publish();
  return { ok: true };
}

// ---------------------------------------------------------------- groups

function groupCreate(body) {
  const name = String(body.name || '').trim();
  if (!name) throw badRequest('请填写分组名称');
  if (store.data.groups.some((g) => g.name === name)) throw badRequest('已存在同名分组');
  const g = { id: `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name };
  store.data.groups.push(g);
  store.save();
  publish();
  return g;
}

function groupUpdate(id, body) {
  const g = store.data.groups.find((x) => x.id === id);
  if (!g) throw new HttpError(404, '分组不存在');
  const name = String(body.name || '').trim();
  if (!name) throw badRequest('请填写分组名称');
  if (store.data.groups.some((x) => x.name === name && x.id !== id)) throw badRequest('已存在同名分组');
  g.name = name;
  store.save();
  publish();
  return g;
}

function groupDelete(id) {
  store.data.groups = store.data.groups.filter((g) => g.id !== id);
  for (const meta of Object.values(store.data.sessions)) if (meta.groupId === id) meta.groupId = null;
  store.save();
  publish();
  return { ok: true };
}

function groupOrder(body) {
  const ids = Array.isArray(body.ids) ? body.ids : [];
  store.data.groups.sort((a, b) => {
    const ia = ids.indexOf(a.id);
    const ib = ids.indexOf(b.id);
    return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
  });
  store.save();
  publish();
  return { ok: true };
}

// ---------------------------------------------------------------- local filesystem & launching

const HIDDEN_ROOT_DIRS = new Set(['$recycle.bin', 'system volume information', '$windows.~bt', '$windows.~ws', 'recovery', 'config.msi']);

async function listLocal(input) {
  let p = specs.unquotePath(input);
  let file = null;
  if (p) {
    try {
      if ((await fsp.stat(p)).isFile()) {
        file = path.basename(p);
        p = path.dirname(path.resolve(p));
      }
    } catch { /* readdir below reports the error */ }
  }
  if (!p) {
    if (IS_WIN) {
      const dirs = [];
      for (let c = 67; c <= 90; c += 1) {
        const drive = `${String.fromCharCode(c)}:\\`;
        if (fs.existsSync(drive)) dirs.push({ name: drive, path: drive });
      }
      return { path: '', parent: null, dirs, files: 0 };
    }
    p = os.homedir();
  }
  const abs = path.resolve(p);
  let entries;
  try {
    entries = await fsp.readdir(abs, { withFileTypes: true });
  } catch (error) {
    throw new HttpError(error.code === 'ENOENT' ? 404 : 400, error.code === 'ENOENT' ? `目录不存在：${abs}` : `无法读取目录：${error.message}`);
  }
  const atRoot = path.dirname(abs) === abs;
  const dirs = [];
  const fileNames = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      if (atRoot && HIDDEN_ROOT_DIRS.has(e.name.toLowerCase())) continue;
      dirs.push({ name: e.name, path: path.join(abs, e.name) });
    } else fileNames.push(e.name);
  }
  const byName = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });
  dirs.sort((a, b) => byName(a.name, b.name));
  fileNames.sort(byName);
  const parent = atRoot ? (IS_WIN ? '' : null) : path.dirname(abs);
  return { path: abs, parent, dirs, files: fileNames.length, fileNames, file };
}

async function mkdirLocal(body) {
  const p = specs.unquotePath(body.path);
  if (!path.isAbsolute(p)) throw badRequest('需要绝对路径');
  await fsp.mkdir(p, { recursive: true });
  return { path: path.resolve(p) };
}

function spawnDetached(command, args, opts = {}) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true, ...opts });
  child.on('error', () => {});
  child.unref();
}

async function which(cmd) {
  if (!cmd) return null;
  if (path.isAbsolute(cmd) || cmd.includes('\\') || cmd.includes('/')) return fs.existsSync(cmd) ? cmd : null;
  const r = await run(IS_WIN ? 'where.exe' : 'which', [cmd], { timeout: 8000 });
  if (r.code !== 0) return null;
  const lines = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (IS_WIN) return lines.find((l) => /\.(exe|cmd|bat)$/i.test(l)) || null;
  return lines[0] || null;
}

let shellExeCache;
async function windowsShell() {
  if (shellExeCache === undefined) shellExeCache = (await which('pwsh')) || 'powershell.exe';
  return shellExeCache;
}

/** Opens a visible console that runs a generated script, so the user can type passwords or work interactively. */
async function openConsole(lines, title) {
  if (!IS_WIN) throw badRequest('打开终端目前仅支持 Windows，请手动执行命令');
  await fsp.mkdir(TMP_DIR, { recursive: true });
  const file = path.join(TMP_DIR, `console-${Date.now()}.ps1`);
  const body = [`$Host.UI.RawUI.WindowTitle = ${psq(title || 'Mutagen 面板')}`, ...lines].join('\r\n');
  await fsp.writeFile(file, `\uFEFF${body}\r\n`, 'utf8');
  const shell = await windowsShell();
  spawnDetached(`start "" "${shell}" -NoExit -NoProfile -ExecutionPolicy Bypass -File "${file}"`, [], { shell: true });
  addLog({ kind: 'panel', cmd: `打开终端：${title}`, code: 0, ms: 0, out: body });
}

function psq(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

async function openPath(body) {
  const p = specs.unquotePath(body.path);
  const abs = path.resolve(p);
  if (!p || !fs.existsSync(abs)) throw new HttpError(404, `目录不存在：${abs}`);
  const app = body.with || 'explorer';
  if (app === 'explorer') {
    if (IS_WIN) spawnDetached('explorer.exe', [abs]);
    else spawnDetached(process.platform === 'darwin' ? 'open' : 'xdg-open', [abs]);
    return { ok: true };
  }
  if (app === 'terminal') {
    await openConsole([`Set-Location -LiteralPath ${psq(abs)}`], `终端 · ${path.basename(abs)}`);
    return { ok: true };
  }
  if (app === 'vscode' || app === 'idea') {
    const cmd = config.editors[app];
    const label = app === 'vscode' ? 'VS Code' : 'IntelliJ IDEA';
    const resolved = await which(cmd);
    if (!resolved) throw badRequest(`未找到 ${label}（${cmd}）。请在「设置」里填写它的可执行文件完整路径`, 'EDITOR_MISSING');
    spawnDetached(`"${resolved}" "${abs}"`, [], { shell: true });
    return { ok: true };
  }
  throw badRequest('未知的打开方式');
}

async function openRemoteTerminal(body) {
  const host = String(body.host || '').trim();
  if (!host) throw badRequest('缺少 SSH 主机');
  const portArgs = body.port ? ` -p ${Number(body.port)}` : '';
  const remote = `${cdExpr(body.path)} 2>/dev/null || cd; exec $SHELL -l`;
  await openConsole([`ssh -t${portArgs} ${psq(host)} ${psq(remote)}`], `SSH · ${host}`);
  return { ok: true };
}

async function installKey(body) {
  const host = String(body.host || '').trim();
  if (!host) throw badRequest('请先选择或填写服务器');
  const key = await ssh.keyInfo();
  if (!key.exists) throw badRequest('本机还没有 SSH 密钥，请先生成');
  const { sshArgs, remote } = ssh.installCommand(host, body.port, key.publicKey);
  const command = `ssh ${sshArgs.map(psq).join(' ')} ${psq(remote)}`;
  const t = await ssh.resolve(host, body.port).catch(() => null);
  const userWarning = t && t.defaultUser
    ? [`Write-Host ${psq(`注意：没有指定用户名，将以本机用户 ${t.user} 登录 ${t.hostname}。Linux 服务器一般要用 root@${t.hostname}，用户名不对时密码再正确也会被拒绝。`)} -ForegroundColor Yellow`]
    : [];
  await openConsole([
    "Write-Host '将把本机公钥追加到服务器的 ~/.ssh/authorized_keys。' -ForegroundColor Cyan",
    `Write-Host ${psq(`登录目标：${t ? `${t.user}@${t.hostname}:${t.port}` : host}`)} -ForegroundColor Cyan`,
    ...userWarning,
    "Write-Host '下面如果提示 password:，输入一次服务器密码（输入时不显示字符），回车即可。' -ForegroundColor Cyan",
    'Write-Host ""',
    `$out = ${command}`,
    '$out | Where-Object { $_ -ne "__MP_KEY_INSTALLED__" } | Write-Host',
    "if ($out -contains '__MP_KEY_INSTALLED__') { Write-Host ''; Write-Host '公钥已写入服务器。回到面板点击「测试免密登录」。' -ForegroundColor Green }",
    "else { Write-Host ''; Write-Host '上传失败，请检查密码、端口或网络。' -ForegroundColor Red }",
  ], `上传公钥 · ${host}`);
  const manual = `type "${key.path}" | ssh${body.port ? ` -p ${body.port}` : ''} ${host} "umask 077; mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"`;
  return { ok: true, manual };
}

// ---------------------------------------------------------------- config

function publicConfig() {
  return { ...config, configPath: CONFIG_PATH, resolvedMutagen: mutagenBin() };
}

async function updateConfig(body) {
  const next = loadConfig();
  if (typeof body.mutagen === 'string') next.mutagen = specs.unquotePath(body.mutagen);
  if (body.pollIntervalMs != null) next.pollIntervalMs = Math.min(10000, Math.max(400, Number(body.pollIntervalMs) || 1000));
  if (body.port != null) next.port = Number(body.port) || next.port;
  if (typeof body.openBrowser === 'boolean') next.openBrowser = body.openBrowser;
  if (typeof body.localRoot === 'string') {
    const root = specs.unquotePath(body.localRoot);
    if (root && !path.isAbsolute(root)) throw badRequest('默认本地根目录必须是完整路径，例如 D:\\sync');
    next.localRoot = root ? path.resolve(root) : '';
  }
  if (typeof body.defaultHost === 'string') next.defaultHost = normalizeDefaultHost(body.defaultHost);
  if (body.editors && typeof body.editors === 'object') {
    next.editors = { ...next.editors };
    for (const k of ['vscode', 'idea']) if (typeof body.editors[k] === 'string') next.editors[k] = specs.unquotePath(body.editors[k]);
  }
  const fileConfig = { ...next };
  await fsp.writeFile(CONFIG_PATH, `${JSON.stringify(fileConfig, null, 2)}\n`, 'utf8');
  config = next;
  state.version = null;
  state.lastVersionCheck = 0;
  await initMutagen();
  await kick();
  return publicConfig();
}

function normalizeDefaultHost(v) {
  const h = String(v).trim();
  if (/\s/.test(h) || h.startsWith('-')) throw badRequest('默认主机格式不正确');
  return h;
}

/** Saves only defaultHost, so picking a default does not re-run mutagen startup like a full settings save. */
async function setDefaultHost(body) {
  const next = loadConfig();
  next.defaultHost = normalizeDefaultHost(body.defaultHost == null ? '' : body.defaultHost);
  await fsp.writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  config = { ...config, defaultHost: next.defaultHost };
  publish();
  return publicConfig();
}

async function daemonAction(action) {
  if (!['start', 'stop', 'restart', 'register', 'unregister'].includes(action)) throw new HttpError(404, '未知操作');
  if (action === 'restart') {
    await mg(['daemon', 'stop'], { timeout: 30000 });
    await mgMust(['daemon', 'start'], { timeout: 30000 });
  } else {
    await mgMust(['daemon', action], { timeout: 30000 });
  }
  if (action === 'register' || action === 'unregister') await refreshAutostart();
  await kick();
  return { ok: true };
}

// ---------------------------------------------------------------- HTTP

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function send(res, status, data) {
  const body = JSON.stringify(data ?? {});
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > 1024 * 1024) {
        reject(badRequest('请求体过大'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(badRequest('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const data = await fsp.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}

const routes = [];
const route = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; })}$`);
  routes.push({ method, re, keys, handler });
};

route('GET', '/api/ping', () => ({ app: APP.name, version: APP.version }));
route('GET', '/api/state', () => snapshot());
route('GET', '/api/logs', () => logs);
route('DELETE', '/api/logs', () => { logs.length = 0; return { ok: true }; });

route('POST', '/api/sessions', ({ body }) => createSession(body));
route('POST', '/api/sessions/preview', ({ body }) => {
  const spec = specs.normalizeSpec(body.spec);
  return { command: commandFor(spec, body.title || path.basename(spec.local.path) || 'session') };
});
route('PUT', '/api/sessions/:id', ({ params, body }) => editSession(params.id, body));
route('PATCH', '/api/sessions/:id/meta', ({ params, body }) => patchMeta(params.id, body));
route('DELETE', '/api/sessions/:id', ({ params }) => deleteSession(params.id));
route('POST', '/api/sessions/:id/overwrite', ({ params, body }) => overwriteSession(params.id, body.target));
route('POST', '/api/sessions/:id/resolve', ({ params, body }) => resolveConflict(params.id, body));
route('POST', '/api/sessions/:id/:action', ({ params }) => sessionAction(params.id, params.action));
route('POST', '/api/bulk/:action', ({ params, body }) => bulkAction(params.action, body.ids));
route('POST', '/api/layout', ({ body }) => applyLayout(body));

route('POST', '/api/groups', ({ body }) => groupCreate(body));
route('POST', '/api/groups/order', ({ body }) => groupOrder(body));
route('PUT', '/api/groups/:id', ({ params, body }) => groupUpdate(params.id, body));
route('DELETE', '/api/groups/:id', ({ params }) => groupDelete(params.id));

route('GET', '/api/ssh/hosts', () => ({ hosts: parseSshConfig(), configPath: SSH_CONFIG_FILE }));
route('POST', '/api/ssh/test', ({ body }) => {
  if (!String(body.host || '').trim()) throw badRequest('请填写 SSH 主机');
  return ssh.test(String(body.host).trim(), body.port);
});
route('GET', '/api/ssh/ls', async ({ query }) => {
  const host = query.get('host');
  if (!host) throw badRequest('缺少 SSH 主机');
  try {
    return await ssh.list(host, query.get('port') || '', specs.unquotePath(query.get('path')) || '~');
  } catch (error) {
    throw badRequest(error.message, error.code);
  }
});
route('POST', '/api/ssh/resolve', async ({ body }) => {
  try {
    return await ssh.resolve(body.host, body.port);
  } catch (error) {
    throw badRequest(error.message);
  }
});
route('GET', '/api/ssh/key', () => ssh.keyInfo());
route('POST', '/api/ssh/key/fix-permissions', async ({ body }) => {
  try {
    return await ssh.fixKeyPermissions(String(body.host || '').trim(), body.port);
  } catch (error) {
    throw badRequest(error.message);
  }
});
route('POST', '/api/ssh/key/generate', () => ssh.generateKey());
route('POST', '/api/ssh/key/install', ({ body }) => installKey(body));
route('POST', '/api/ssh/config', async ({ body }) => {
  try {
    return await ssh.addConfigHost(body);
  } catch (error) {
    throw badRequest(error.message);
  }
});

const remoteQuery = (query) => [query.get('host') || '', query.get('port') || ''];
const remoteCall = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    throw new HttpError(error.status || 400, error.message, error.code);
  }
};
route('GET', '/api/remote/info', ({ query }) => remoteCall(() => remoteFs.info(...remoteQuery(query))));
route('GET', '/api/remote/ls', ({ query }) => remoteCall(() => remoteFs.list(...remoteQuery(query), specs.unquotePath(query.get('path')) || '~', { ancestors: query.get('ancestors') === '1' })));
/** Server-side roots of sync sessions on this host, so the file manager cannot delete them out from under mutagen. */
function syncRootsOn(host) {
  const bare = (h) => String(h || '').replace(/^.*@/, '').toLowerCase();
  const target = bare(host);
  const roots = [];
  for (const s of state.sessions) {
    if (s.labels && s.labels[TEMP_LABEL]) continue;
    for (const k of ['alpha', 'beta']) {
      const e = s[k];
      if (e && e.protocol === 'ssh' && bare(e.host) === target) roots.push({ path: e.path || '~', title: (store.data.sessions[s.identifier] || {}).title || s.name || s.identifier });
    }
  }
  return roots;
}
route('POST', '/api/remote/delete', ({ body }) => remoteCall(async () => {
  await poll();
  return remoteFs.remove(String(body.host || ''), String(body.port || ''), body.paths, { syncRoots: syncRootsOn(body.host) });
}));
route('GET', '/api/remote/read', ({ query }) => remoteCall(() => remoteFs.read(...remoteQuery(query), query.get('path') || '')));

route('GET', '/api/fs/ls', ({ query }) => listLocal(query.get('path') || ''));
route('POST', '/api/fs/mkdir', ({ body }) => mkdirLocal(body));
route('POST', '/api/open', ({ body }) => openPath(body));
route('POST', '/api/open/remote-terminal', ({ body }) => openRemoteTerminal(body));

route('GET', '/api/config', () => publicConfig());
route('PUT', '/api/config', ({ body }) => updateConfig(body));
route('PUT', '/api/config/default-host', ({ body }) => setDefaultHost(body));
route('POST', '/api/daemon/:action', ({ params }) => daemonAction(params.action));

async function handleDownload(req, res, url) {
  const q = url.searchParams;
  let dl;
  try {
    dl = await remoteFs.openDownload(q.get('host') || '', q.get('port') || '', q.get('path') || '', { checkOnly: q.get('check') === '1' });
  } catch (error) {
    return send(res, error.status || 400, { error: error.message, code: error.code });
  }
  if (!dl.child) return send(res, 200, { ok: true, size: dl.size, name: dl.name });
  const { child, size, name } = dl;
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    'Cache-Control': 'no-store',
  };
  if (size != null) headers['Content-Length'] = String(size);
  res.writeHead(200, headers);
  child.stdout.pipe(res);
  req.on('close', () => { if (child.exitCode == null) child.kill(); });
  child.on('close', (code) => {
    addLog({ kind: 'ssh', cmd: `下载 ${q.get('host')}:${q.get('path')}`, code, ms: 0, out: size != null ? `${size} 字节` : '' });
  });
  return undefined;
}

function handleEvents(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');
  res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/events') return handleEvents(req, res);
  if (url.pathname === '/api/remote/download' && req.method === 'GET') return handleDownload(req, res, url);
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.re.exec(url.pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    try {
      const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? await readBody(req) : {};
      const result = await r.handler({ params, body, query: url.searchParams, req });
      return send(res, 200, result);
    } catch (error) {
      const status = error.status || 500;
      if (status >= 500) console.error(error);
      return send(res, status, { error: error.message || String(error), code: error.code });
    }
  }
  return send(res, 404, { error: '接口不存在' });
});

function openBrowser(url) {
  if (IS_WIN) spawnDetached(`start "" "${url}"`, [], { shell: true });
  else spawnDetached(process.platform === 'darwin' ? 'open' : 'xdg-open', [url]);
}

function probeExisting(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: config.host, port, path: '/api/ping', timeout: 1500 }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data).app === APP.name); } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function start() {
  const basePort = Number(process.env.PORT || config.port) || DEFAULT_CONFIG.port;
  for (let port = basePort; port < basePort + 10; port += 1) {
    const ok = await new Promise((resolve) => {
      server.once('error', (error) => resolve(error.code === 'EADDRINUSE' ? false : Promise.reject(error)));
      server.listen(port, config.host, () => resolve(true));
    });
    if (ok) {
      const url = `http://${config.host === '0.0.0.0' ? '127.0.0.1' : config.host}:${port}`;
      console.log('');
      console.log(`  Mutagen 同步面板 v${APP.version} 已启动：${url}`);
      console.log(`  mutagen：${mutagenBin()}`);
      console.log('  关闭此窗口只会关闭面板，已创建的同步会话由 mutagen 守护进程继续运行。');
      console.log('');
      if (config.openBrowser !== false && !process.env.MP_NO_BROWSER) openBrowser(url);
      poll();
      return;
    }
    if (await probeExisting(port)) {
      const url = `http://127.0.0.1:${port}`;
      console.log(`面板已在运行：${url}，直接打开浏览器。`);
      if (config.openBrowser !== false && !process.env.MP_NO_BROWSER) openBrowser(url);
      setTimeout(() => process.exit(0), 300);
      return;
    }
  }
  console.error(`端口 ${basePort}-${basePort + 9} 都被占用，请修改 config.json 的 port`);
  process.exit(1);
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
