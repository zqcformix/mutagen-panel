'use strict';

const dns = require('node:dns').promises;
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

function refuse(message) {
  const error = new Error(message);
  error.status = 409;
  error.code = 'UNSAFE_DELETE';
  return error;
}

function sshTarget(endpoint) {
  if (!endpoint || endpoint.protocol !== 'ssh') return null;
  return {
    host: `${endpoint.user ? `${endpoint.user}@` : ''}${endpoint.host || ''}`,
    port: endpoint.port ? String(endpoint.port) : '',
    path: String(endpoint.path || '~'),
  };
}

/** Resolve every endpoint with its own SSH settings and HOME; never infer directory identity from an alias. */
async function prepareSessionDeletion(session, sessions, remoteKey, {
  ssh, remoteFs, lookup = dns.lookup,
  localAddresses = Object.values(os.networkInterfaces()).flat().filter(Boolean).map((i) => i.address),
}) {
  const target = sshTarget(session[remoteKey]);
  if (!target) throw refuse('只有 SSH 服务器目录可以随会话删除，本地目录不能使用此操作');
  const cache = new Map();
  const address = (value) => {
    let ip = String(value).toLowerCase().replace(/%.+$/, '');
    if (net.isIP(ip) === 6) ip = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(ip);
    if (mapped) {
      const n = parseInt(mapped[1], 16) * 65536 + parseInt(mapped[2], 16);
      ip = [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }
    return ip;
  };
  async function identity(endpoint) {
    const key = JSON.stringify([endpoint.host, endpoint.port]);
    if (!cache.has(key)) cache.set(key, (async () => {
      const resolved = await ssh.resolve(endpoint.host, endpoint.port);
      const hostname = String(resolved.hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
      if (!hostname) throw refuse('无法确认 SSH 服务器身份，已取消目录删除');
      const addresses = net.isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((item) => item.address);
      if (!addresses.length) throw refuse('无法解析 SSH 服务器地址，已取消目录删除');
      return { hostname, addresses: addresses.map(address) };
    })());
    return cache.get(key);
  }
  const targetIdentity = await identity(target);
  const locals = new Set(localAddresses.map(address));
  if (targetIdentity.addresses.some((ip) => ip === '::1' || ip.startsWith('127.') || locals.has(ip))) {
    throw refuse('SSH 目标指向本机，不能使用删除服务器目录操作');
  }
  const inspection = await remoteFs.inspectPaths(target.host, target.port, [target.path]);
  const selected = inspection.paths[0];
  // Reject even a symlink in a parent component; rm must operate on the exact checked directory.
  if (selected.realPath !== path.posix.normalize(selected.path)) {
    throw refuse('服务器目录路径包含符号链接，请使用真实目录路径后重试');
  }
  target.path = selected.realPath;
  const covers = (parent, child) => parent === child || child.startsWith(parent === '/' ? '/' : `${parent}/`);
  if (target.path.split('/').filter(Boolean).length <= 1 || covers(target.path, inspection.home)) {
    throw refuse('不能删除服务器根目录、一级目录、主目录或主目录的上级目录');
  }
  const syncRoots = [];
  for (const other of sessions) {
    for (const key of ['alpha', 'beta']) {
      if (other.identifier === session.identifier && key === remoteKey) continue;
      const endpoint = sshTarget(other[key]);
      if (!endpoint) continue;
      const otherIdentity = await identity(endpoint);
      // Conservatively include different users and ports on the same machine.
      if (otherIdentity.hostname !== targetIdentity.hostname && !otherIdentity.addresses.some((ip) => targetIdentity.addresses.includes(ip))) continue;
      const info = await remoteFs.inspectPaths(endpoint.host, endpoint.port, [endpoint.path]);
      const root = info.paths[0].realPath;
      if (covers(target.path, root) || covers(root, target.path)) {
        throw refuse(`服务器目录与同步会话「${other.name || other.identifier}」的目录 ${root} 重叠，已取消删除`);
      }
      syncRoots.push({ path: root, title: other.name || other.identifier });
    }
  }
  return { target, syncRoots, expectedPath: target.path };
}

/** Panel-side mutations cannot create/rebuild/resume sessions while a directory is being removed. */
function createMutationQueue() {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  };
}

module.exports = { prepareSessionDeletion, createMutationQueue };
