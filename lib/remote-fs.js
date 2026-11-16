'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { spawn } = require('node:child_process');

const IDLE_MS = 10 * 60 * 1000;
const PREVIEW_BYTES = 256 * 1024;
const MAX_ENTRIES = 5000;
const LIST_BYTES = 8 * 1024 * 1024;

/** POSIX single-quote escaping for commands evaluated by the remote shell. */
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Shell word for a remote path; keeps a leading ~ expandable. */
function pathWord(p) {
  const v = String(p || '').trim();
  if (!v || v === '~') return '"$HOME"';
  if (v.startsWith('~/')) return `"$HOME"/${shq(v.slice(2))}`;
  return shq(v);
}

/** Wraps df so a hung network mount cannot stall the shared channel. */
const DF = '{ if command -v timeout >/dev/null 2>&1; then timeout 8 df -P -k "$@"; else df -P -k "$@"; fi; }';

/** Parses `df -P -k` lines: exact 1 KiB block counts plus df's own Use% (used / (used + available), rounded up). */
function parseDf(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(.+)$/.exec(line.trim());
    if (!m) continue;
    out.push({ fs: m[1], size: Number(m[2]) * 1024, used: Number(m[3]) * 1024, avail: Number(m[4]) * 1024, pct: Number(m[5]), mount: m[6] });
  }
  return out;
}

/** Real block devices only: drops tmpfs, overlay, snap loop mounts and duplicate bind mounts of one device. */
function realDisks(rows) {
  const seen = new Set();
  return rows
    .filter((d) => /^\/dev\//.test(d.fs) && !/^\/dev\/loop/.test(d.fs) && d.size > 0)
    .sort((a, b) => a.mount.length - b.mount.length)
    .filter((d) => (seen.has(d.fs) ? false : (seen.add(d.fs), true)));
}

function fsError(message, code, status = 400) {
  const e = new Error(message);
  e.code = code;
  e.status = status;
  return e;
}

/**
 * One long-lived `ssh host sh` per server. Windows OpenSSH has no ControlMaster, and a fresh
 * handshake costs seconds, so browsing reuses this shell and frames each command with nonce markers.
 */
class Channel {
  constructor({ bin, args, onExit, log, label }) {
    this.bin = bin;
    this.args = args;
    this.onExit = onExit;
    this.log = log;
    this.label = label;
    this.nonce = crypto.randomBytes(6).toString('hex');
    this.seq = 0;
    this.queue = [];
    this.current = null;
    this.buf = Buffer.alloc(0);
    this.stderr = '';
    this.dead = false;
    this.ready = false;
    this.openedAt = Date.now();
    this.idleTimer = null;
    this.child = spawn(bin, args, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.child.stdout.on('data', (d) => this.onData(d));
    this.child.stderr.setEncoding('utf8');
    this.child.stderr.on('data', (d) => { this.stderr = (this.stderr + d).slice(-8000); });
    this.child.stdin.on('error', () => {});
    this.child.on('error', (error) => this.die({ error, code: -1 }));
    this.child.on('close', (code) => this.die({ code }));
    this.touch();
  }

  touch() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.close(), IDLE_MS);
  }

  run(command, timeout = 30000) {
    if (this.dead) return Promise.reject(fsError('SSH 通道已关闭', 'SSH_CLOSED'));
    return new Promise((resolve, reject) => {
      this.queue.push({ command, timeout, resolve, reject });
      this.pump();
    });
  }

  pump() {
    if (this.current || !this.queue.length || this.dead) return;
    const job = this.queue.shift();
    const id = ++this.seq;
    job.begin = Buffer.from(`\x1eMPB${this.nonce}${id}\x1e`);
    job.endPrefix = Buffer.from(`\x1eMPE${this.nonce}${id}:`);
    job.started = Date.now();
    job.timer = setTimeout(() => {
      this.die({ timedOut: true, code: -2 });
    }, job.timeout);
    this.current = job;
    this.buf = Buffer.alloc(0);
    const B = `\\036MPB${this.nonce}${id}\\036`;
    const E = `\\036MPE${this.nonce}${id}:%d\\036`;
    this.child.stdin.write(`printf '${B}'; ( ${job.command} ) </dev/null 2>&1; printf '${E}' "$?"\n`);
    this.touch();
  }

  onData(d) {
    const job = this.current;
    if (!job) return;
    this.buf = Buffer.concat([this.buf, d]);
    const b = this.buf.indexOf(job.begin);
    if (b < 0) return;
    const start = b + job.begin.length;
    const e = this.buf.indexOf(job.endPrefix, start);
    if (e < 0) return;
    const tail = this.buf.indexOf(0x1e, e + job.endPrefix.length);
    if (tail < 0) return;
    const code = Number(this.buf.slice(e + job.endPrefix.length, tail).toString());
    const out = this.buf.slice(start, e);
    this.buf = Buffer.alloc(0);
    clearTimeout(job.timer);
    this.current = null;
    this.ready = true;
    job.resolve({ out, code, ms: Date.now() - job.started });
    this.pump();
  }

  die(r) {
    if (this.dead) return;
    this.dead = true;
    clearTimeout(this.idleTimer);
    try { this.child.kill(); } catch { /* already gone */ }
    const result = { ...r, out: this.stderr, stdout: '', stderr: this.stderr, ready: this.ready };
    const jobs = [this.current, ...this.queue].filter(Boolean);
    this.current = null;
    this.queue = [];
    jobs.forEach((j) => clearTimeout(j.timer));
    this.onExit(this, result, jobs);
  }

  close() {
    if (this.dead) return;
    this.die({ code: 0, closed: true });
  }
}

function createRemoteFs({ getSsh, sshArgs, explainFailure, log }) {
  const channels = new Map();

  function channelFor(host, port) {
    const key = `${host}|${port || ''}`;
    let ch = channels.get(key);
    if (ch && !ch.dead) return ch;
    const args = [...sshArgs(host, port, ['-T', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=3']), 'exec sh'];
    ch = new Channel({
      bin: getSsh(),
      args,
      label: host,
      log,
      onExit: async (dead, r, jobs) => {
        if (channels.get(key) === dead) channels.delete(key);
        if (!jobs.length) {
          if (!r.closed && dead.ready) log({ kind: 'ssh', cmd: `SSH 通道断开 · ${host}`, code: r.code, ms: Date.now() - dead.openedAt, out: r.stderr.slice(-2000) });
          return;
        }
        let c;
        if (r.timedOut) c = { message: '服务器响应超时，已断开 SSH 通道，请重试', code: 'SSH_TIMEOUT' };
        else if (r.error && r.error.code === 'ENOENT') c = { message: '找不到 ssh 命令，请安装 Windows 的 OpenSSH 客户端', code: 'SSH_MISSING' };
        else c = await explainFailure(host, port, r);
        log({ kind: 'ssh', cmd: `SSH 通道失败 · ${host}`, code: r.code, ms: Date.now() - dead.openedAt, out: (r.stderr || c.message).slice(-2000) });
        jobs.forEach((j) => j.reject(fsError(c.message, c.code)));
      },
    });
    channels.set(key, ch);
    return ch;
  }

  async function exec(host, port, command, timeout) {
    const h = String(host || '').trim();
    if (!h || h.startsWith('-') || /\s/.test(h)) throw fsError('SSH 主机格式不正确', 'BAD_HOST');
    const p = String(port || '').trim();
    if (p && !/^\d{1,5}$/.test(p)) throw fsError('端口必须是数字', 'BAD_PORT');
    const ch = channelFor(h, p);
    const fresh = !ch.ready;
    const r = await ch.run(command, timeout);
    return { ...r, fresh };
  }

  /** Splits `TAG\tvalue\0` records; a trailing record without its NUL was cut by the byte cap. */
  function records(buf) {
    const parts = buf.toString('utf8').split('\0');
    const complete = parts.pop() === '';
    return { parts, complete };
  }

  async function info(host, port) {
    const r = await exec(host, port, `df_() ${DF}; printf "U\\t%s\\0H\\t%s\\0N\\t%s\\0S\\t%s\\0F\\t%s\\0" "$(whoami)" "$HOME" "$(hostname)" "$(uname -sr)" "$(df_ 2>/dev/null)"`, 20000);
    const o = {};
    for (const rec of records(r.out).parts) {
      const i = rec.indexOf('\t');
      if (i > 0) o[rec.slice(0, i).replace(/^[^A-Z]*/, '')] = rec.slice(i + 1);
    }
    const all = parseDf(o.F);
    const disks = realDisks(all);
    const root = all.find((d) => d.mount === '/') || null;
    if (root && !disks.includes(root)) disks.unshift(root);
    return { ok: true, ms: r.ms, fresh: r.fresh, user: o.U || '', home: o.H || '', hostname: o.N || '', system: o.S || '', root, disks };
  }

  const ENTRY_FMT = 'E\\t%y\\t%Y\\t%s\\t%T@\\t%m\\t%u\\t%g\\t%P\\001%l\\0';

  async function list(host, port, dir, { ancestors = false } = {}) {
    const anc = ancestors
      ? '; d="$C"; while [ "$d" != / ] && [ -n "$d" ]; do d=$(dirname -- "$d"); printf "A\\t%s\\0" "$d"; find "$d" -mindepth 1 -maxdepth 1 \\( -type d -o -xtype d \\) -printf "D\\t%f\\0" 2>/dev/null | head -c 2000000; done'
      : '';
    const target = String(dir || '').trim() || '~';
    const command = [
      `t=${pathWord(target)}`,
      'if [ -e "$t" ] && [ ! -d "$t" ]; then printf "G\\t%s\\0" "${t##*/}"; t=$(dirname -- "$t"); fi',
      'cd -- "$t" 2>/dev/null || { if [ -e "$t" ]; then printf "X\\tNOPERM\\0"; else printf "X\\tNODIR\\0"; fi; exit 3; }',
      'C=$(pwd)',
      `df_() ${DF}`,
      'printf "C\\t%s\\0H\\t%s\\0F\\t%s\\0" "$C" "$HOME" "$(df_ . 2>/dev/null | tail -n 1)"',
      `if find . -maxdepth 0 -printf "" >/dev/null 2>&1; then find . -mindepth 1 -maxdepth 1 -printf '${ENTRY_FMT}' 2>/dev/null | head -c ${LIST_BYTES}${anc}; else ls -1Ap 2>/dev/null | while IFS= read -r n; do printf "S\\t%s\\0" "$n"; done; fi`,
    ].join('; ');
    const r = await exec(host, port, command, 45000);
    const { parts, complete } = records(r.out);
    let cwd = '';
    let home = '';
    let err = '';
    let simple = false;
    let disk = null;
    let file = null;
    const entries = [];
    const anc2 = [];
    for (const rec of parts) {
      const tab = rec.indexOf('\t');
      if (tab < 0) continue;
      const tag = rec.slice(0, tab).replace(/^[\s\S]*[^A-Z]/, '');
      const val = rec.slice(tab + 1);
      if (tag === 'C') cwd = val;
      else if (tag === 'H') home = val;
      else if (tag === 'X') err = val;
      else if (tag === 'F') disk = parseDf(val)[0] || null;
      else if (tag === 'G') file = val;
      else if (tag === 'A') anc2.push({ path: val, dirs: [] });
      else if (tag === 'D' && anc2.length) anc2[anc2.length - 1].dirs.push(val);
      else if (tag === 'E') {
        const f = val.split('\t');
        if (f.length < 8) continue;
        const [y, Y, size, mtime, mode, user, group] = f;
        const rest = f.slice(7).join('\t');
        const sep = rest.indexOf('\x01');
        const name = sep >= 0 ? rest.slice(0, sep) : rest;
        const link = sep >= 0 ? rest.slice(sep + 1) : '';
        if (!name) continue;
        entries.push({
          name,
          type: y === 'd' ? 'dir' : y === 'l' ? 'link' : y === 'f' ? 'file' : 'other',
          targetType: y === 'l' ? (Y === 'd' ? 'dir' : Y === 'f' ? 'file' : Y === 'L' || Y === 'N' ? 'broken' : 'other') : null,
          size: Number(size) || 0,
          mtime: Math.round(Number(mtime) * 1000) || 0,
          mode: mode || '',
          user: user || '',
          group: group || '',
          link,
        });
      } else if (tag === 'S') {
        simple = true;
        if (val === './' || val === '../') continue;
        const isDir = val.endsWith('/');
        entries.push({ name: isDir ? val.slice(0, -1) : val, type: isDir ? 'dir' : 'file', targetType: null, size: null, mtime: null, mode: '', user: '', group: '', link: '' });
      }
    }
    if (err === 'NODIR') throw fsError(`服务器上不存在该目录：${target}`, 'NO_DIR', 404);
    if (err === 'NOPERM') throw fsError(`没有权限进入该目录：${target}`, 'NO_PERM', 403);
    if (!cwd) throw fsError(r.out.toString('utf8').trim().slice(-300) || '读取目录失败', 'LIST_FAILED', 500);
    let truncated = !complete && !anc2.length;
    if (entries.length > MAX_ENTRIES) { entries.length = MAX_ENTRIES; truncated = true; }
    for (const e of entries) e.path = path.posix.join(cwd, e.name);
    const byName = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });
    anc2.forEach((a) => a.dirs.sort(byName));
    return {
      path: cwd,
      home,
      parent: cwd === '/' ? null : path.posix.dirname(cwd),
      entries,
      ancestors: anc2,
      truncated,
      simple,
      disk,
      file,
      ms: r.ms,
    };
  }

  function decodeText(buf) {
    if (buf.includes(0)) return null;
    for (let cut = 0; cut <= 3 && cut < buf.length + 1; cut += 1) {
      try {
        return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, buf.length - cut)), encoding: 'UTF-8' };
      } catch { /* a multibyte char may be split at the byte cap */ }
    }
    try {
      return { text: new TextDecoder('gbk', { fatal: true }).decode(buf), encoding: 'GBK' };
    } catch {
      return null;
    }
  }

  async function read(host, port, file) {
    const w = pathWord(file);
    const command = `f=${w}; if [ ! -e "$f" ]; then printf "X\\tNOENT\\0"; elif [ -d "$f" ]; then printf "X\\tISDIR\\0"; elif [ ! -r "$f" ]; then printf "X\\tNOPERM\\0"; else printf "Z\\t%s\\0" "$(wc -c < "$f" | tr -d ' ')"; head -c ${PREVIEW_BYTES} -- "$f"; fi`;
    const r = await exec(host, port, command, 45000);
    const out = r.out;
    const z = out.indexOf(0);
    const head = (z >= 0 ? out.subarray(0, z) : out).toString('utf8');
    const tag = head.replace(/^[\s\S]*?([XZ])\t/, '$1\t');
    if (tag.startsWith('X\t')) {
      const k = tag.slice(2);
      if (k === 'NOENT') throw fsError('文件不存在', 'NOENT', 404);
      if (k === 'ISDIR') throw fsError('这是一个目录', 'ISDIR');
      throw fsError('没有权限读取该文件', 'NO_PERM', 403);
    }
    if (!tag.startsWith('Z\t')) throw fsError('读取文件失败', 'READ_FAILED', 500);
    const size = Number(tag.slice(2)) || 0;
    const body = out.subarray(z + 1);
    const decoded = decodeText(body);
    return {
      path: file,
      size,
      truncated: size > body.length,
      limit: PREVIEW_BYTES,
      binary: !decoded,
      encoding: decoded ? decoded.encoding : '',
      text: decoded ? decoded.text : '',
      ms: r.ms,
    };
  }

  /** Checks the file through the shared channel first so errors arrive before any download headers. */
  async function openDownload(host, port, file, { checkOnly = false } = {}) {
    const w = pathWord(file);
    const r = await exec(host, port, `f=${w}; if [ -f "$f" ] && [ -r "$f" ]; then printf "Z\\t%s\\0" "$(wc -c < "$f" | tr -d ' ')"; elif [ -d "$f" ]; then printf "X\\tISDIR\\0"; elif [ -e "$f" ]; then printf "X\\tNOPERM\\0"; else printf "X\\tNOENT\\0"; fi`, 20000);
    const s = r.out.toString('utf8');
    if (s.includes('X\tISDIR')) throw fsError('目录不能直接下载', 'ISDIR');
    if (s.includes('X\tNOPERM')) throw fsError('没有权限读取该文件', 'NO_PERM', 403);
    if (s.includes('X\tNOENT')) throw fsError('文件不存在', 'NOENT', 404);
    const m = /Z\t(\d+)/.exec(s);
    const size = m ? Number(m[1]) : null;
    const name = path.posix.basename(String(file)) || 'download';
    if (checkOnly) return { child: null, size, name };
    const child = spawn(getSsh(), [...sshArgs(String(host).trim(), String(port || '').trim()), `cat -- ${w}`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.on('error', () => {});
    return { child, size, name };
  }

  /**
   * Permanently deletes paths. Refuses `/`, first-level system directories, the home directory and
   * anything that is or contains a sync session root (mutagen halts a session whose root vanishes).
   */
  async function remove(host, port, paths, { syncRoots = [] } = {}) {
    const list = [...new Set((Array.isArray(paths) ? paths : []).map((p) => String(p || '')))];
    if (!list.length) throw fsError('没有要删除的项目', 'BAD_PATH');
    if (list.length > 1000) throw fsError('一次最多删除 1000 项', 'BAD_PATH');
    const h = await exec(host, port, 'printf "%s" "$HOME"', 15000);
    const home = h.out.toString('utf8').trim();
    const resolveHome = (p) => String(p || '').replace(/^~(?=\/|$)/, home);
    const roots = syncRoots.map((r) => ({ ...r, path: path.posix.normalize(resolveHome(r.path)).replace(/(.)\/+$/, '$1') }));
    const covers = (p, child) => child === p || child.startsWith(`${p}/`);
    for (const p of list) {
      if (!p.startsWith('/') || path.posix.normalize(p) !== p || (p.length > 1 && p.endsWith('/'))) throw fsError(`路径不合法：${p}`, 'BAD_PATH');
      if (p.split('/').filter(Boolean).length <= 1) throw fsError(`为防止误操作，不能删除根目录或 / 下的一级目录：${p}`, 'PROTECTED', 403);
      if (home && covers(p, home)) throw fsError(`不能删除主目录或它的上级目录：${p}`, 'PROTECTED', 403);
      const root = roots.find((r) => covers(p, r.path));
      if (root) throw fsError(`${p} 是同步会话「${root.title}」的服务器目录${root.path === p ? '' : '的上级'}，删除会让同步停止。请先删除这个同步会话`, 'PROTECTED', 403);
    }
    const script = list.map((p) => `p=${shq(p)}; if [ -e "$p" ] || [ -L "$p" ]; then e=$(rm -rf -- "$p" 2>&1 | head -c 1000); if [ -e "$p" ] || [ -L "$p" ]; then printf "F\\t%s\\001%s\\0" "$p" "$e"; else printf "O\\t%s\\0" "$p"; fi; else printf "N\\t%s\\0" "$p"; fi`).join('; ');
    const started = Date.now();
    const r = await exec(host, port, script, 30 * 60 * 1000);
    const result = { deleted: [], missing: [], failed: [] };
    for (const rec of records(r.out).parts) {
      const tag = rec.slice(0, 2);
      const val = rec.slice(2);
      if (tag === 'O\t') result.deleted.push(val);
      else if (tag === 'N\t') result.missing.push(val);
      else if (tag === 'F\t') {
        const i = val.indexOf('\x01');
        result.failed.push({ path: i >= 0 ? val.slice(0, i) : val, error: (i >= 0 ? val.slice(i + 1) : '').replace(/^rm: /gm, '').trim() || '删除失败' });
      }
    }
    log({
      kind: 'ssh',
      cmd: `删除 ${host}：${list.length} 项`,
      code: result.failed.length ? 1 : 0,
      ms: Date.now() - started,
      out: [
        ...result.deleted.map((p) => `已删除 ${p}`),
        ...result.missing.map((p) => `不存在 ${p}`),
        ...result.failed.map((f) => `失败 ${f.path}：${f.error}`),
      ].join('\n').slice(0, 8000),
    });
    return result;
  }
  function closeAll() {
    for (const ch of channels.values()) ch.close();
  }

  return { info, list, read, openDownload, remove, closeAll };
}

module.exports = { createRemoteFs };
