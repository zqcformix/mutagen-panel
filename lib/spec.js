'use strict';

const path = require('node:path');

const DIRECTIONS = ['two-way', 'to-local', 'to-remote'];
const CONFLICTS = ['safe', 'remote', 'local'];
const SYMLINK_MODES = ['', 'portable', 'ignore', 'posix-raw'];
const WATCH_MODES = ['', 'portable', 'force-poll', 'no-watch'];
const SCAN_MODES = ['', 'full', 'accelerated'];
const COMPRESSIONS = ['', 'none', 'deflate', 'zstandard'];

class SpecError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const str = (v) => (v == null ? '' : String(v).trim());

/** Explorer's "Copy as path" wraps paths in double quotes; drop one or more matching wrapping quote pairs. */
function unquotePath(v) {
  let s = str(v);
  for (;;) {
    const m = /^(["'\u201c\u2018])([\s\S]*)(["'\u201d\u2019])$/.exec(s);
    if (!m || !({ '"': '"', "'": "'", '\u201c': '\u201d', '\u2018': '\u2019' }[m[1]] === m[3])) return s;
    s = m[2].trim();
  }
}
const oneOf = (v, list) => (list.includes(str(v)) ? str(v) : '');

function normalizeSpec(input) {
  const s = input || {};
  const remote = { host: str(s.remote && s.remote.host), port: str(s.remote && s.remote.port), path: unquotePath(s.remote && s.remote.path) };
  const local = { path: unquotePath(s.local && s.local.path) };
  const rawIgnores = Array.isArray(s.ignores) ? s.ignores : String(s.ignores || '').split(/[\n,]/);
  const ignores = [...new Set(rawIgnores.map((x) => String(x).trim()).filter(Boolean))];

  if (!remote.path) throw new SpecError('请填写服务器端路径');
  if (!local.path) throw new SpecError('请填写本地路径');
  if (remote.host && /\s/.test(remote.host)) throw new SpecError('SSH 主机不能包含空格');
  if (remote.port && !/^\d{1,5}$/.test(remote.port)) throw new SpecError('端口必须是数字');
  if (!remote.host && !path.isAbsolute(remote.path)) throw new SpecError('未填写 SSH 主机时，服务器端路径必须是本机绝对路径');
  if (!path.isAbsolute(local.path)) throw new SpecError('本地路径必须是绝对路径，例如 D:\\sync\\project');
  if (ignores.some((x) => x.includes(','))) throw new SpecError('忽略规则中不能包含逗号，请拆成多条');

  return {
    remote,
    local,
    direction: DIRECTIONS.includes(s.direction) ? s.direction : 'two-way',
    conflict: CONFLICTS.includes(s.conflict) ? s.conflict : 'safe',
    mirror: !!s.mirror,
    ignores,
    ignoreVcs: !!s.ignoreVcs,
    symlinkMode: oneOf(s.symlinkMode, SYMLINK_MODES),
    watchMode: oneOf(s.watchMode, WATCH_MODES),
    scanMode: oneOf(s.scanMode, SCAN_MODES),
    compression: oneOf(s.compression, COMPRESSIONS),
    extraArgs: str(s.extraArgs),
  };
}

function remoteUrl(remote) {
  if (!remote.host) return remote.path;
  return remote.port ? `${remote.host}:${remote.port}:${remote.path}` : `${remote.host}:${remote.path}`;
}

function rawEndpointUrl(ep) {
  if (!ep || ep.protocol === 'local' || !ep.protocol) return ep ? ep.path : '';
  if (ep.protocol === 'ssh') {
    const user = ep.user ? `${ep.user}@` : '';
    const port = ep.port ? `:${ep.port}` : '';
    return `${user}${ep.host}${port}:${ep.path}`;
  }
  if (ep.protocol === 'docker') {
    const user = ep.user ? `${ep.user}@` : '';
    return `docker://${user}${ep.host}${ep.path.startsWith('/') ? '' : '/'}${ep.path}`;
  }
  return ep.path;
}

/** Alpha is the remote side unless local must win: one-way local→server, or two-way with local priority. */
function orientation(spec) {
  const remoteIsAlpha = !(spec.direction === 'to-remote' || (spec.direction === 'two-way' && spec.conflict === 'local'));
  let mode;
  if (spec.direction === 'two-way') mode = spec.conflict === 'safe' ? 'two-way-safe' : 'two-way-resolved';
  else mode = spec.mirror ? 'one-way-replica' : 'one-way-safe';
  return { remoteIsAlpha, mode };
}

function splitArgs(text) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(text || ''))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function commonArgs(spec) {
  const args = [];
  for (const ig of spec.ignores) args.push('--ignore', ig);
  args.push(spec.ignoreVcs ? '--ignore-vcs' : '--no-ignore-vcs');
  if (spec.symlinkMode) args.push('--symlink-mode', spec.symlinkMode);
  if (spec.watchMode) args.push('--watch-mode', spec.watchMode);
  if (spec.scanMode) args.push('--scan-mode', spec.scanMode);
  if (spec.compression) args.push('--compression', spec.compression);
  args.push(...splitArgs(spec.extraArgs));
  return args;
}

function buildCreateArgs(spec, { name, labels = {}, paused = false, override } = {}) {
  const { remoteIsAlpha, mode } = orientation(spec);
  const r = remoteUrl(spec.remote);
  const l = spec.local.path;
  const alpha = override ? override.alpha : (remoteIsAlpha ? r : l);
  const beta = override ? override.beta : (remoteIsAlpha ? l : r);
  const args = ['sync', 'create'];
  if (name) args.push('--name', name);
  args.push('--mode', override ? override.mode : mode);
  for (const [k, v] of Object.entries(labels)) args.push('--label', `${k}=${v}`);
  if (paused) args.push('--paused');
  args.push(...commonArgs(spec));
  args.push(alpha, beta);
  return args;
}

function deriveSpec(session) {
  const a = session.alpha || {};
  const b = session.beta || {};
  const remoteIsAlpha = a.protocol !== 'local' || b.protocol === 'local';
  const rem = remoteIsAlpha ? a : b;
  const loc = remoteIsAlpha ? b : a;
  const mode = session.mode || 'two-way-safe';
  let direction = 'two-way';
  let conflict = 'safe';
  let mirror = false;
  if (mode.startsWith('two-way')) {
    if (mode === 'two-way-resolved') conflict = remoteIsAlpha ? 'remote' : 'local';
  } else {
    direction = remoteIsAlpha ? 'to-local' : 'to-remote';
    mirror = mode === 'one-way-replica';
  }
  const remote = rem.protocol === 'ssh'
    ? { host: `${rem.user ? `${rem.user}@` : ''}${rem.host || ''}`, port: rem.port ? String(rem.port) : '', path: rem.path || '' }
    : { host: '', port: '', path: rawEndpointUrl(rem) };
  const ignore = session.ignore || {};
  return {
    remote,
    local: { path: rawEndpointUrl(loc) },
    direction,
    conflict,
    mirror,
    ignores: Array.isArray(ignore.paths) ? ignore.paths : [],
    ignoreVcs: ignore.vcs === true,
    symlinkMode: (session.symlink && session.symlink.mode) || '',
    watchMode: (session.watch && session.watch.mode) || '',
    scanMode: session.scanMode || '',
    compression: (session.compression && session.compression.algorithm) || '',
    extraArgs: '',
  };
}

function remoteKeyOf(session, spec) {
  if (spec) return orientation(spec).remoteIsAlpha ? 'alpha' : 'beta';
  const a = session.alpha || {};
  const b = session.beta || {};
  return a.protocol !== 'local' || b.protocol === 'local' ? 'alpha' : 'beta';
}

/** Mutagen names must start with a Unicode letter and contain only letters, digits and '-' ('_' and '.' are rejected). */
function mutagenName(title) {
  let name = String(title || '').trim()
    .replace(/[\s_.]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
  if (!name) return `session-${Date.now().toString(36)}`;
  if (!/^\p{L}/u.test(name)) name = `s-${name}`;
  return name.slice(0, 60);
}

module.exports = {
  normalizeSpec,
  buildCreateArgs,
  deriveSpec,
  remoteKeyOf,
  rawEndpointUrl,
  remoteUrl,
  orientation,
  mutagenName,
  unquotePath,
  SpecError,
};
