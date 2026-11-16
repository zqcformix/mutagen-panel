'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { run, displayCmd, cleanOutput } = require('./exec');

const SSH_DIR = path.join(os.homedir(), '.ssh');
const CONFIG_FILE = path.join(SSH_DIR, 'config');
const KEY_CANDIDATES = ['id_ed25519', 'id_ecdsa', 'id_rsa'];

/** POSIX single-quote escaping for commands evaluated by the remote login shell. */
function shq(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

function cdExpr(p) {
  const v = String(p || '').trim();
  if (!v || v === '~') return 'cd';
  if (v.startsWith('~/')) return `cd ~/${shq(v.slice(2))}`;
  return `cd -- ${shq(v)}`;
}

function parseSshConfig() {
  let text;
  try {
    text = fs.readFileSync(CONFIG_FILE, 'utf8');
  } catch {
    return [];
  }
  const hosts = [];
  let current = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+?)\s*(?:=|\s)\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim().replace(/^"(.*)"$/, '$1');
    if (key === 'host') {
      current = val.split(/\s+/).filter((h) => h && !/[*?!]/.test(h)).map((alias) => ({
        alias, hostname: '', user: '', port: '', identityFile: '',
      }));
      hosts.push(...current);
    } else if (key === 'match') {
      current = [];
    } else {
      for (const h of current) {
        if (key === 'hostname' && !h.hostname) h.hostname = val;
        if (key === 'user' && !h.user) h.user = val;
        if (key === 'port' && !h.port) h.port = val;
        if (key === 'identityfile' && !h.identityFile) h.identityFile = val;
      }
    }
  }
  return hosts;
}

function classifyError(out, r) {
  if (r.error && r.error.code === 'ENOENT') return { message: '找不到 ssh 命令，请安装 Windows 的 OpenSSH 客户端', code: 'SSH_MISSING' };
  if (r.timedOut) return { message: '连接超时，检查网络、IP 和端口', code: 'SSH_TIMEOUT' };
  // ssh prints this before the final "Permission denied", so it must be matched first.
  if (/UNPROTECTED PRIVATE KEY FILE|bad permissions/i.test(out)) {
    const keyFiles = [...new Set([...out.matchAll(/Load key "([^"]+)": bad permissions/gi)].map((m) => path.normalize(m[1].replace(/\\\\/g, '\\'))))];
    const names = keyFiles.length ? `（${keyFiles.map((f) => path.basename(f)).join('、')}）` : '';
    return { message: `本机私钥文件权限过宽${names}，ssh 拒绝使用它：私钥只能允许当前用户读取。点「修复私钥权限」即可`, code: 'SSH_KEY_PERMS', keyFiles };
  }
  if (/Permission denied/i.test(out)) return { message: '服务器拒绝了密钥登录（Permission denied），需要先配置公钥免密登录', code: 'SSH_AUTH' };
  if (/Could not resolve hostname/i.test(out)) return { message: '无法解析主机名，检查 SSH 主机是否写对', code: 'SSH_DNS' };
  if (/Connection refused/i.test(out)) return { message: '连接被拒绝，检查端口以及服务器 sshd 是否运行', code: 'SSH_REFUSED' };
  if (/timed out/i.test(out)) return { message: '连接超时，检查网络、IP 和端口', code: 'SSH_TIMEOUT' };
  if (/IDENTIFICATION HAS CHANGED|Host key verification failed/i.test(out)) {
    return { message: '服务器指纹校验失败（可能重装过系统），请清理 ~/.ssh/known_hosts 中对应条目', code: 'SSH_HOSTKEY' };
  }
  const tail = out.trim().split('\n').slice(-3).join(' ');
  return { message: tail || `ssh 退出码 ${r.code}`, code: 'SSH_ERROR' };
}

function createSsh({ getSsh, getKeygen, log }) {
  const base = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new'];
  const target = (host, port) => (port ? ['-p', String(port), host] : [host]);

  async function exec(host, port, command, { timeout = 30000, quiet = false } = {}) {
    const args = [...base, ...target(host, port), command];
    const r = await run(getSsh(), args, { timeout });
    const out = cleanOutput(`${r.stdout}\n${r.stderr}`);
    if (!quiet || r.code !== 0) {
      log({ kind: 'ssh', cmd: displayCmd('ssh', [...target(host, port), command]), code: r.code, ms: r.ms, out: out.slice(0, 4000) });
    }
    return { ...r, out };
  }

  /** Effective connection settings after ~/.ssh/config is applied, as reported by `ssh -G`. */
  async function resolve(host, port) {
    const h = String(host || '').trim();
    if (!h || h.startsWith('-') || /\s/.test(h)) throw new Error('SSH 主机格式不正确');
    if (port && !/^\d{1,5}$/.test(String(port).trim())) throw new Error('端口必须是数字');
    const r = await run(getSsh(), ['-G', ...target(h, String(port || '').trim())], { timeout: 8000 });
    if (r.code !== 0) throw new Error(classifyError(cleanOutput(`${r.stdout}\n${r.stderr}`), r).message);
    const conf = {};
    const identityFiles = [];
    for (const line of r.stdout.split(/\r?\n/)) {
      const m = line.match(/^(\S+)\s+(.*)$/);
      if (!m) continue;
      if (m[1] === 'identityfile') identityFiles.push(path.normalize(m[2].trim().replace(/^~(?=[\\/]|$)/, os.homedir())));
      else if (!(m[1] in conf)) conf[m[1]] = m[2].trim();
    }
    const localUser = os.userInfo().username;
    const user = conf.user || localUser;
    const explicit = h.includes('@') || parseSshConfig().some((x) => x.alias === h && x.user);
    return {
      user,
      hostname: conf.hostname || h,
      port: conf.port || '22',
      localUser,
      // ssh falls back to the local login name, which on Windows is rarely the server account.
      defaultUser: !explicit && user.toLowerCase() === localUser.toLowerCase(),
      identityFiles,
    };
  }

  async function explainFailure(host, port, r) {
    const c = classifyError(r.out, r);
    if (c.code !== 'SSH_AUTH') return c;
    try {
      const t = await resolve(host, port);
      if (t.defaultUser) {
        return {
          code: 'SSH_AUTH_USER',
          message: `服务器拒绝了登录（Permission denied）。没有指定用户名，ssh 用了本机用户 ${t.user}；Linux 服务器一般要写成 root@${t.hostname}，或在 ~/.ssh/config 里给这台主机设置 User`,
          suggestHost: `root@${t.hostname}`,
        };
      }
    } catch { /* keep the generic message */ }
    return c;
  }

  async function test(host, port) {
    const r = await exec(host, port, 'echo __MP_OK__; uname -sr 2>/dev/null; whoami; echo "$HOME"', { timeout: 20000 });
    if (r.code === 0 && r.stdout.includes('__MP_OK__')) {
      const lines = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const i = lines.indexOf('__MP_OK__');
      return { ok: true, ms: r.ms, system: lines[i + 1] || '', user: lines[i + 2] || '', home: lines[i + 3] || '' };
    }
    return { ok: false, ms: r.ms, ...(await explainFailure(host, port, r)) };
  }
  async function list(host, port, dir) {
    const command = `${cdExpr(dir)} 2>/dev/null || { echo __MP_NODIR__; exit 3; }; pwd; ls -1Ap 2>/dev/null | head -n 3000`;
    const r = await exec(host, port, command, { timeout: 25000, quiet: true });
    if (r.stdout.includes('__MP_NODIR__')) {
      const e = new Error(`服务器上不存在该目录：${dir}`);
      e.code = 'NO_DIR';
      throw e;
    }
    if (r.code !== 0) {
      const c = await explainFailure(host, port, r);
      const e = new Error(c.message);
      e.code = c.code;
      throw e;
    }
    const lines = r.stdout.split(/\r?\n/).map((s) => s.replace(/\r$/, '')).filter(Boolean);
    const cwd = lines.shift() || '/';
    const dirs = [];
    const fileNames = [];
    for (const name of lines) {
      if (name === './' || name === '../') continue;
      if (name.endsWith('/')) {
        const n = name.slice(0, -1);
        dirs.push({ name: n, path: path.posix.join(cwd, n) });
      } else fileNames.push(name);
    }
    const byName = (x, y) => x.localeCompare(y, 'zh-CN', { numeric: true });
    dirs.sort((x, y) => byName(x.name, y.name));
    fileNames.sort(byName);
    const parent = cwd === '/' ? '' : path.posix.dirname(cwd);
    return { path: cwd, parent, dirs, files: fileNames.length, fileNames };
  }

  /** Moves a conflicting copy into a trash folder on the server instead of deleting it. */
  async function moveToTrash(host, port, base, rel, stamp) {
    const command = [
      `B=$(${cdExpr(base)} && pwd) || exit 4`,
      `T="$HOME/.mutagen-panel-trash/${stamp}"`,
      `R=${shq(rel)}`,
      'mkdir -p "$T/$(dirname "$R")" && mv -- "$B/$R" "$T/$R" && echo __MP_OK__',
    ].join('; ');
    const r = await exec(host, port, command, { timeout: 30000 });
    if (!r.stdout.includes('__MP_OK__')) throw new Error(classifyError(r.out, r).message);
    return `~/.mutagen-panel-trash/${stamp}/${rel}`;
  }

  async function keyInfo() {
    for (const name of KEY_CANDIDATES) {
      const pub = path.join(SSH_DIR, `${name}.pub`);
      try {
        const publicKey = (await fsp.readFile(pub, 'utf8')).trim();
        return { exists: true, type: name.replace('id_', ''), path: pub, privatePath: path.join(SSH_DIR, name), publicKey };
      } catch { /* try next */ }
    }
    return { exists: false, path: path.join(SSH_DIR, 'id_ed25519.pub') };
  }

  async function generateKey() {
    const existing = await keyInfo();
    if (existing.exists) return existing;
    await fsp.mkdir(SSH_DIR, { recursive: true });
    const keyPath = path.join(SSH_DIR, 'id_ed25519');
    const args = ['-t', 'ed25519', '-N', '', '-C', `mutagen-panel@${os.hostname()}`, '-f', keyPath];
    const r = await run(getKeygen(), args, { timeout: 30000 });
    log({ kind: 'ssh', cmd: displayCmd('ssh-keygen', args), code: r.code, ms: r.ms, out: cleanOutput(`${r.stdout}\n${r.stderr}`).slice(0, 2000) });
    if (r.code !== 0) throw new Error(`生成密钥失败：${cleanOutput(r.stderr || r.stdout) || r.code}`);
    return keyInfo();
  }

  let userSid = '';
  async function currentUserSid() {
    if (userSid) return userSid;
    const r = await run('whoami', ['/user', '/fo', 'csv', '/nh'], { timeout: 10000 });
    const m = String(r.stdout).match(/"(S-1-[\d-]+)"/);
    if (!m) throw new Error('无法获取当前 Windows 用户的 SID');
    userSid = m[1];
    return userSid;
  }

  /** Windows OpenSSH ignores a private key that any other account can read; reduce it to the owner and SYSTEM. */
  async function restrictKeyFile(file) {
    if (process.platform !== 'win32') {
      await fsp.chmod(file, 0o600);
      log({ kind: 'ssh', cmd: `chmod 600 ${file}`, code: 0, ms: 0, out: '' });
      return;
    }
    const sid = await currentUserSid();
    // /reset drops explicit entries for other accounts; /inheritance:r then drops the inherited ones.
    for (const args of [[file, '/reset'], [file, '/inheritance:r', '/grant:r', `*${sid}:F`, '*S-1-5-18:F']]) {
      const r = await run('icacls', args, { timeout: 15000 });
      const out = cleanOutput(`${r.stdout}\n${r.stderr}`);
      log({ kind: 'ssh', cmd: displayCmd('icacls', args), code: r.code, ms: r.ms, out: out.slice(0, 2000) });
      if (r.code !== 0) throw new Error(`修改 ${file} 的权限失败：${out || r.code}`);
    }
  }

  async function fixKeyPermissions(host, port) {
    const candidates = host ? (await resolve(host, port)).identityFiles : [];
    const k = await keyInfo();
    if (k.exists) candidates.push(k.privatePath);
    const files = [...new Set(candidates.map((f) => path.resolve(f)))].filter((f) => {
      if (f.toLowerCase().endsWith('.pub')) return false;
      try { return fs.statSync(f).isFile(); } catch { return false; }
    });
    if (!files.length) throw new Error('没有找到需要修复的私钥文件');
    for (const f of files) await restrictKeyFile(f);
    return { ok: true, files };
  }

  function installCommand(host, port, publicKey) {
    const key = publicKey.replace(/'/g, '');
    const remote = `umask 077; mkdir -p ~/.ssh; touch ~/.ssh/authorized_keys; grep -qxF '${key}' ~/.ssh/authorized_keys || echo '${key}' >> ~/.ssh/authorized_keys; echo __MP_KEY_INSTALLED__`;
    const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new', ...target(host, port)];
    return { sshArgs, remote };
  }

  async function addConfigHost({ alias, hostname, user, port, identityFile }) {
    const a = String(alias || '').trim();
    if (!/^[\w.-]+$/.test(a)) throw new Error('别名只能包含字母、数字、点、下划线和短横线');
    if (!String(hostname || '').trim()) throw new Error('请填写服务器 IP 或域名');
    if (port && !/^\d{1,5}$/.test(String(port))) throw new Error('端口必须是数字');
    if (parseSshConfig().some((h) => h.alias === a)) throw new Error(`~/.ssh/config 中已存在别名 ${a}`);
    const lines = [`Host ${a}`, `    HostName ${String(hostname).trim()}`];
    if (user) lines.push(`    User ${String(user).trim()}`);
    if (port) lines.push(`    Port ${port}`);
    if (identityFile) lines.push(`    IdentityFile ${identityFile}`);
    lines.push('    ServerAliveInterval 30');
    await fsp.mkdir(SSH_DIR, { recursive: true });
    let prefix = '';
    try {
      const cur = await fsp.readFile(CONFIG_FILE, 'utf8');
      prefix = cur.length && !cur.endsWith('\n') ? '\n\n' : (cur.length ? '\n' : '');
    } catch { /* new file */ }
    await fsp.appendFile(CONFIG_FILE, `${prefix}${lines.join('\n')}\n`);
    log({ kind: 'ssh', cmd: `写入 ${CONFIG_FILE}`, code: 0, ms: 0, out: lines.join('\n') });
    return { alias: a };
  }

  const sshArgs = (host, port, extra = []) => [...base, ...extra, ...target(host, port)];

  return { test, resolve, list, moveToTrash, keyInfo, generateKey, fixKeyPermissions, installCommand, addConfigHost, explainFailure, sshArgs, cdExpr, shq };
}

module.exports = { createSsh, parseSshConfig, cdExpr, shq, SSH_CONFIG_FILE: CONFIG_FILE };
