'use strict';

(() => {
  // ------------------------------------------------------------ utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NONE = '__none';
  const BROWSER_FILE_LIMIT = 500;

  const ICONS = {
    server: '<rect x="2" y="3" width="20" height="8" rx="2"/><rect x="2" y="13" width="20" height="8" rx="2"/><path d="M6 7h.01M6 17h.01"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    swap: '<path d="M4 8h15l-4-4"/><path d="M20 16H5l4 4"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    chevronUp: '<path d="M18 15l-6-6-6 6"/>',
    grip: '<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2"/>',
    terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l4 3-4 3M12 15h6"/>',
    log: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    layers: '<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    rows: '<rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/>',
    code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
    zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
    power: '<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.8 0"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    filter: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    expand: '<path d="M7 15l5 5 5-5M7 9l5-5 5 5"/>',
    collapse: '<path d="M7 20l5-5 5 5M7 4l5 5 5-5"/>',
    folderPlus: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5M9.5 13.5h5"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
    arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    swapV: '<path d="M8 4v15l-4-4"/><path d="M16 20V5l4 4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    cmd: '<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>',
    copyPlus: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/><path d="M15.5 12.5v6M12.5 15.5h6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    tree: '<path d="M4 4h6v5H4zM14 15h6v5h-6zM14 4h6v5h-6z"/><path d="M7 9v8.5h7M10 6.5h4"/>',
  };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  const fmtBytes = (n) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = Number(n);
    let i = 0;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
  };
  const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('zh-CN'));
  const timeAgo = (ts) => {
    if (!ts) return '';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 5) return '刚刚';
    if (s < 60) return `${s} 秒前`;
    if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
    if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
    return new Date(ts).toLocaleString('zh-CN');
  };
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '—');
  const hue = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
  const basename = (p) => String(p || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '';
  /** Explorer's "Copy as path" wraps paths in double quotes; strip matching wrapping quote pairs. */
  const QUOTE_PAIRS = { '"': '"', "'": "'", '\u201c': '\u201d', '\u2018': '\u2019' };
  const cleanPath = (v) => {
    let s = String(v ?? '').trim();
    while (s.length >= 2 && QUOTE_PAIRS[s[0]] === s[s.length - 1]) s = s.slice(1, -1).trim();
    return s;
  };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const setPath = (obj, key, val) => { const ks = key.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = val; };
  const getPath = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

  async function api(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `请求失败（${res.status}）`);
      err.code = data && data.code;
      throw err;
    }
    return data;
  }

  async function copyText(text, label = '已复制') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast(label, 'ok', { duration: 1800 });
  }

  // ------------------------------------------------------------ toast
  function toast(msg, kind = 'ok', opts = {}) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    const ic = kind === 'ok' ? 'checkCircle' : (kind === 'error' || kind === 'warn') ? 'alert' : 'info';
    el.innerHTML = `<span class="ti">${icon(ic)}</span><div class="tm">${esc(msg)}</div>${opts.action ? `<button class="btn btn-xs ta">${esc(opts.action.label)}</button>` : ''}`;
    const dismiss = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    if (opts.action) el.querySelector('.ta').addEventListener('click', () => { opts.action.run(); dismiss(); });
    el.addEventListener('click', (e) => { if (!e.target.closest('.ta')) dismiss(); });
    $('#toasts').appendChild(el);
    setTimeout(dismiss, opts.duration || (kind === 'error' ? 8000 : 3200));
  }

  // ------------------------------------------------------------ morph (keyed DOM patching keeps animations and focus intact)
  function morphNode(a, b) {
    if (a.nodeType === 3 || a.nodeType === 8) {
      if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
      return;
    }
    const aAttrs = a.attributes;
    for (let i = aAttrs.length - 1; i >= 0; i -= 1) {
      const name = aAttrs[i].name;
      if (!b.hasAttribute(name)) a.removeAttribute(name);
    }
    for (const attr of b.attributes) {
      if (a.getAttribute(attr.name) !== attr.value) a.setAttribute(attr.name, attr.value);
    }
    if (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return;
    morphChildren(a, b);
  }

  function morphChildren(parent, next) {
    const keyed = new Map();
    for (const c of parent.children) {
      const k = c.getAttribute('data-key');
      if (k) keyed.set(k, c);
    }
    let ref = parent.firstChild;
    for (const n of Array.from(next.childNodes)) {
      const k = n.nodeType === 1 ? n.getAttribute('data-key') : null;
      let m = null;
      if (k) {
        m = keyed.get(k) || null;
        if (m && m.nodeName !== n.nodeName) m = null;
        if (m) keyed.delete(k);
      } else if (ref && !(ref.nodeType === 1 && ref.getAttribute('data-key')) && ref.nodeType === n.nodeType && ref.nodeName === n.nodeName) {
        m = ref;
      }
      if (m) {
        if (m === ref) ref = ref.nextSibling;
        else parent.insertBefore(m, ref);
        morphNode(m, n);
      } else {
        parent.insertBefore(n, ref);
      }
    }
    while (ref) {
      const nx = ref.nextSibling;
      parent.removeChild(ref);
      ref = nx;
    }
  }

  function morphHtml(el, html) {
    const tpl = document.createElement(el.tagName === 'TBODY' ? 'tbody' : 'div');
    tpl.innerHTML = html;
    morphChildren(el, tpl);
  }

  // ------------------------------------------------------------ state
  let S = null;
  let VIEWS = new Map();
  let connected = false;
  let logs = [];
  const pending = new Set();
  let drag = null;
  let hostsCache = null;
  let popFor = null;

  const ui = Object.assign({ filterGroup: 'all', filterStatus: 'all', view: 'grid', collapsed: [] }, JSON.parse(localStorage.getItem('mp.ui') || '{}'));
  ui.search = '';
  const saveUi = () => localStorage.setItem('mp.ui', JSON.stringify({ filterGroup: ui.filterGroup, filterStatus: ui.filterStatus, view: ui.view, collapsed: ui.collapsed }));

  let renderQueued = false;
  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  function connect() {
    const es = new EventSource('/api/events');
    es.addEventListener('state', (e) => {
      S = JSON.parse(e.data);
      connected = true;
      scheduleRender();
    });
    es.addEventListener('log', (e) => {
      logs.push(JSON.parse(e.data));
      if (logs.length > 300) logs.shift();
      if (logView) renderLogs();
    });
    es.onopen = () => { connected = true; scheduleRender(); };
    es.onerror = () => { connected = false; scheduleRender(); };
  }

  // ------------------------------------------------------------ view model
  const STATUS_TEXT = {
    'halted-on-root-emptied': '已停止：有一端的根目录被清空，mutagen 为防止误删已暂停同步。确认无误后可「重置同步历史」或强制覆盖。',
    'halted-on-root-deletion': '已停止：有一端的根目录被删除。',
    'halted-on-root-type-change': '已停止：根目录的类型发生了变化（文件/目录互换）。',
    scanning: '正在扫描文件…',
    'waiting-for-rescan': '等待重新扫描…',
    reconciling: '正在对比两端差异…',
    transitioning: '正在应用更改…',
    saving: '正在保存同步状态…',
  };

  function epView(e) {
    const isLocal = !e.protocol || e.protocol === 'local';
    const hostFull = isLocal ? '本机' : `${e.user ? `${e.user}@` : ''}${e.host || ''}${e.port ? `:${e.port}` : ''}`;
    return {
      protocol: e.protocol || 'local',
      isLocal,
      hostLabel: isLocal ? '本机' : (e.host || ''),
      hostFull,
      path: e.path || '',
      connected: !!e.connected,
      scanned: !!e.scanned,
      files: e.files,
      dirs: e.directories,
      links: e.symbolicLinks,
      size: e.totalFileSize,
      problems: [...(e.scanProblems || []), ...(e.transitionProblems || [])],
    };
  }

  function vm(s) {
    const p = s._panel;
    const rk = p.remoteKey;
    const lk = rk === 'alpha' ? 'beta' : 'alpha';
    const remote = epView(s[rk] || {});
    const local = epView(s[lk] || {});
    const mode = s.mode || 'two-way-safe';
    let flow;
    let modeLabel;
    if (mode.startsWith('two-way')) {
      flow = 'both';
      modeLabel = mode === 'two-way-safe' ? '双向 · 安全' : (rk === 'alpha' ? '双向 · 服务器优先' : '双向 · 本地优先');
    } else {
      flow = rk === 'alpha' ? 'right' : 'left';
      modeLabel = `${flow === 'right' ? '单向 · 服务器→本地' : '单向 · 本地→服务器'}${mode === 'one-way-replica' ? ' · 镜像' : ''}`;
    }
    const sideName = (key) => (key === rk ? (remote.isLocal ? '源目录' : '服务器') : '本地');
    const conflicts = (s.conflicts || []).length + (s.excludedConflicts || 0);
    const problems = remote.problems.length + local.problems.length;
    const v = {
      id: s.identifier,
      raw: s,
      title: p.title,
      groupId: p.groupId,
      order: p.order,
      created: s.creationTime || '',
      spec: p.spec,
      command: p.command,
      remoteKey: rk,
      remote,
      local,
      flow,
      modeLabel,
      paused: !!s.paused,
      conflicts,
      problems,
      lastError: s.lastError || '',
      cycles: s.successfulCycles || 0,
      lastCycleAt: p.lastCycleAt,
      ignores: (s.ignore && s.ignore.paths) || [],
      op: p.op,
      hostHue: hue(remote.hostLabel),
    };
    v.status = statusOf(s, v, sideName);
    return v;
  }

  function statusOf(s, v, sideName) {
    if (v.op) return { kind: 'op', text: '处理中', detail: v.op, pct: null, ind: true };
    if (s.paused) return { kind: 'paused', text: '已暂停', detail: '同步已暂停，点击「恢复」继续', pct: 0 };
    const st = s.status || '';
    if (st.startsWith('halted')) return { kind: 'error', text: '已停止', detail: STATUS_TEXT[st] || st, pct: 0 };
    if (st === 'disconnected') {
      return { kind: 'error', text: '未连接', detail: v.lastError ? `连接失败：${v.lastError}` : '端点未连接，正在重试…', pct: null, ind: !v.lastError };
    }
    if (st.startsWith('connecting')) {
      const side = sideName(st.endsWith('alpha') ? 'alpha' : 'beta');
      return { kind: v.lastError ? 'error' : 'busy', text: '连接中', detail: `正在连接${side}…${v.lastError ? `（上次错误：${v.lastError}）` : ''}`, pct: null, ind: true };
    }
    if (st === 'watching') {
      if (v.lastError) return { kind: 'error', text: '出错', detail: v.lastError, pct: 100 };
      if (v.conflicts) return { kind: 'warn', text: '有冲突', detail: `已同步，但有 ${v.conflicts} 处冲突待处理`, pct: 100 };
      if (v.problems) return { kind: 'warn', text: '部分失败', detail: `已同步，${v.problems} 个文件无法同步`, pct: 100 };
      return { kind: 'ok', text: '已同步', detail: '已同步，正在监视变化', pct: 100 };
    }
    if (st.startsWith('staging')) {
      const g = s.stagingProgress || {};
      const side = sideName(st.endsWith('alpha') ? 'alpha' : 'beta');
      let pct = null;
      if (g.expectedSize) pct = Math.min(99, Math.floor((g.receivedSize || 0) / g.expectedSize * 100));
      else if (g.expectedFiles) pct = Math.min(99, Math.floor((g.receivedFiles || 0) / g.expectedFiles * 100));
      const detail = g.expectedFiles
        ? `正在从${side}拉取 ${fmtNum(g.receivedFiles || 0)}/${fmtNum(g.expectedFiles)} 个文件 · ${fmtBytes(g.receivedSize || 0)} / ${fmtBytes(g.expectedSize || 0)}`
        : `正在从${side}拉取文件…`;
      return { kind: 'busy', text: '传输中', detail, pct, ind: pct == null };
    }
    return { kind: 'busy', text: '同步中', detail: STATUS_TEXT[st] || st || '处理中…', pct: null, ind: true };
  }

  const CATS = { ok: ['ok'], busy: ['busy', 'op'], attention: ['warn', 'error'], paused: ['paused'] };
  const gidOf = (v) => (v.groupId && S.groups.some((g) => g.id === v.groupId) ? v.groupId : NONE);
  const sortViews = (a, b) => {
    const oa = a.order ?? 1e12;
    const ob = b.order ?? 1e12;
    if (oa !== ob) return oa - ob;
    return a.created.localeCompare(b.created);
  };
  const groupsList = () => [...S.groups, { id: NONE, name: '未分组', virtual: true }];

  function matches(v) {
    if (ui.filterStatus !== 'all' && !CATS[ui.filterStatus].includes(v.status.kind)) return false;
    if (!ui.search) return true;
    const q = ui.search.toLowerCase();
    return [v.title, v.remote.path, v.local.path, v.remote.hostFull, v.modeLabel, v.id].some((x) => String(x || '').toLowerCase().includes(q));
  }

  // ------------------------------------------------------------ render
  function render() {
    if (!S) return;
    VIEWS = new Map(S.sessions.map((s) => [s.identifier, vm(s)]));
    renderBanner();
    renderDaemon();
    renderServerBar();
    renderStats();
    renderChips();
    if (!drag) renderMain();
    if (detail) renderDetail();
    const attention = [...VIEWS.values()].filter((v) => CATS.attention.includes(v.status.kind)).length;
    document.title = attention ? `(${attention}) Mutagen 同步面板` : 'Mutagen 同步面板';
    updateFavicon(attention);
    checkAlerts();
  }

  let faviconState = -1;
  function updateFavicon(n) {
    const state = n ? 1 : 0;
    if (state === faviconState) return;
    faviconState = state;
    const link = document.getElementById('favicon');
    if (!link) return;
    if (!n) { link.href = '/favicon.svg'; return; }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#171717"/><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12.5h16l-4-4"/><path d="M25 19.5H9l4 4"/></g><circle cx="25.5" cy="6.5" r="6" fill="#e5484d" stroke="#fff" stroke-width="1.5"/></svg>';
    link.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  // ------------------------------------------------------------ alerts (toast + desktop notification)
  const alertState = new Map();
  let alertsPrimed = false;
  const notifyEnabled = () => localStorage.getItem('mp.notify') === 'on' && 'Notification' in window && Notification.permission === 'granted';
  function pushNotice(title, body, onClick, kind) {
    toast(`${title}：${body}`, kind, { duration: 9000, action: onClick ? { label: '查看', run: onClick } : undefined });
    if (notifyEnabled() && (document.hidden || !document.hasFocus())) {
      try {
        const n = new Notification(title, { body, icon: '/favicon.svg', tag: `mp-${title}` });
        n.onclick = () => { window.focus(); if (onClick) onClick(); n.close(); };
      } catch { /* blocked by the browser */ }
    }
  }

  /** A state must persist for a few seconds before alerting, so transient reconnects during polling don't spam. */
  function checkAlerts() {
    if (!S) return;
    const now = Date.now();
    for (const v of VIEWS.values()) {
      const attn = CATS.attention.includes(v.status.kind);
      const key = attn ? [v.status.text, v.conflicts, v.problems, v.lastError].join('|') : '';
      let a = alertState.get(v.id);
      if (!a) {
        a = { key, since: now, notified: alertsPrimed ? '' : key, transferSince: 0 };
        alertState.set(v.id, a);
      }
      if (a.key !== key) { a.key = key; a.since = now; }
      if (!attn) a.notified = '';
      else if (a.notified !== key && now - a.since >= 4000) {
        a.notified = key;
        const tab = v.status.kind === 'warn' && v.conflicts ? 'conflicts' : 'problems';
        const body = v.status.kind === 'warn' ? v.status.detail : `${v.status.text}：${v.status.detail}`;
        pushNotice(v.title, body, () => openDetail(v.id, tab), v.status.kind === 'error' ? 'error' : 'warn');
      }
      if (v.status.kind === 'busy' && v.status.text === '传输中') {
        a.transferSince = a.transferSince || now;
      } else if (a.transferSince) {
        if (v.status.kind === 'ok' && now - a.transferSince > 15000) pushNotice(v.title, '文件传输完成，两端已同步', () => openDetail(v.id, 'overview'), 'ok');
        a.transferSince = 0;
      }
    }
    for (const id of [...alertState.keys()]) if (!VIEWS.has(id)) alertState.delete(id);
    alertsPrimed = true;
  }

  function renderBanner() {
    let html = '';
    if (!connected) {
      html = bannerHtml('warn', 'alert', '<b>与面板服务的连接已断开</b>，正在自动重连。如果关闭了启动窗口，请重新双击「mutagen-panel启动.bat」。', '');
    } else if (S.mutagen.error) {
      html = bannerHtml('', 'alert', `<b>mutagen 不可用：</b>${esc(S.mutagen.error)}`, '<button class="btn btn-sm" data-act="settings">打开设置</button>');
    } else if (S.mutagen.listError) {
      html = bannerHtml('', 'alert', `<b>读取同步会话失败：</b>${esc(S.mutagen.listError)}`, '<button class="btn btn-sm" data-act="daemon" data-op="restart">重启守护进程</button>');
    }
    morphHtml($('#banner'), html);
  }
  const bannerHtml = (tone, ic, textHtml, actions) => `<div class="banner" data-key="banner"><div class="banner-inner ${tone}">${icon(ic)}<div class="text">${textHtml}</div>${actions}</div></div>`;

  function renderDaemon() {
    const el = $('#daemon-pill');
    const on = S.mutagen.daemon && !S.mutagen.error;
    el.className = `daemon-pill ${on ? 'on' : 'off'}`;
    const html = `<i class="dot"></i>${on ? `守护进程运行中 · mutagen v${esc(S.mutagen.version)}` : (S.mutagen.error ? '未找到 mutagen' : '守护进程未运行')}${icon('chevronDown', 'i-sm')}`;
    if (el.innerHTML !== html) el.innerHTML = html;
  }

  function renderStats() {
    const views = [...VIEWS.values()];
    $('#stats').classList.toggle('hidden', !views.length);
    const count = (cat) => views.filter((v) => CATS[cat].includes(v.status.kind)).length;
    const totalSize = views.reduce((a, v) => a + (v.local.size || 0), 0);
    const totalFiles = views.reduce((a, v) => a + (v.local.files || 0), 0);
    const att = count('attention');
    const items = [
      ['all', '全部会话', views.length, '', views.length ? `${fmtNum(totalFiles)} 个文件 · ${fmtBytes(totalSize)}` : '还没有会话'],
      ['ok', '已同步', count('ok'), STATUS_COLOR.ok, '正在监视变化'],
      ['busy', '同步中', count('busy'), STATUS_COLOR.busy, '扫描、传输或连接中'],
      ['attention', '需要关注', att, att ? STATUS_COLOR.error : '', att ? '冲突、报错或连接失败' : '一切正常'],
      ['paused', '已暂停', count('paused'), STATUS_COLOR.paused, '暂不同步'],
    ];
    morphHtml($('#stats'), items.map(([k, label, val, color, sub]) => `
      <button class="stat ${ui.filterStatus === k && k !== 'all' ? 'active' : ''}" data-key="st-${k}" data-act="filter-status" data-status="${k}" title="${k === 'all' ? '显示全部' : `只看「${label}」，再次点击取消`}">
        <span class="stat-label">${k === 'all' ? '' : `<i class="sd" style="${color ? `background:${color}` : ''}"></i>`}${esc(label)}</span>
        <span class="stat-value ${val ? '' : 'zero'}">${val}</span>
        <span class="stat-sub">${esc(sub)}</span>
      </button>`).join(''));
  }

  // ------------------------------------------------------------ current server
  const GIT_HOST_RE = /(^|\.)(github\.com|gitlab\.com|gitee\.com|bitbucket\.org|codeberg\.org|ssh\.dev\.azure\.com|vs-ssh\.visualstudio\.com|e\.coding\.net|codeup\.aliyun\.com)$/i;
  /** Git hosting entries in ~/.ssh/config only accept git traffic, so they never make a sensible default server. */
  const isGitHost = (h) => GIT_HOST_RE.test(h.hostname || '') || GIT_HOST_RE.test(h.alias || '') || String(h.user || '').toLowerCase() === 'git';
  const isGitAlias = (alias) => {
    const h = (hostsCache || []).find((x) => x.alias === alias);
    return h ? isGitHost(h) : GIT_HOST_RE.test(stripUser(alias));
  };
  const firstServerHost = (hosts) => { const h = (hosts || []).find((x) => !isGitHost(x)); return h ? h.alias : ''; };
  const stripUser = (h) => String(h || '').replace(/^.*@/, '');
  const viewHost = (v) => (v.spec && v.spec.remote && v.spec.remote.host) || v.remote.hostLabel;
  const sshViews = () => [...VIEWS.values()].filter((v) => v.remote.protocol === 'ssh');
  const viewsOnHost = (host) => sshViews().filter((v) => stripUser(viewHost(v)) === stripUser(host));

  const srv = { host: '', port: '', source: '', info: null, error: null, checking: false, at: 0, seq: 0 };
  let hostsLoading = false;

  function pickCurrentServer() {
    const pinned = S ? String(S.defaultHost || '') : '';
    if (pinned && pinned !== LOCAL_HOST) return { host: pinned, port: '', source: 'pinned' };
    const last = localStorage.getItem('mp.lastHost');
    if (last && !isGitAlias(last)) return { host: last, port: '', source: 'last' };
    const v = sshViews()[0];
    if (v) return { host: viewHost(v), port: (v.spec && v.spec.remote.port) || '', source: 'session' };
    const h = firstServerHost(hostsCache);
    return { host: h, port: '', source: h ? 'config' : '' };
  }

  async function checkServer(force) {
    const cur = pickCurrentServer();
    if (cur.host !== srv.host || cur.port !== srv.port) {
      Object.assign(srv, { host: cur.host, port: cur.port, info: null, error: null, checking: false, at: 0 });
      srv.seq += 1;
    }
    srv.source = cur.source;
    if (!srv.host || srv.checking) return;
    if (!force && Date.now() - srv.at < (srv.error ? 120000 : 30000)) return;
    const seq = ++srv.seq;
    srv.checking = true;
    scheduleRender();
    try {
      const info = await api('GET', `/api/remote/info?${new URLSearchParams({ host: srv.host, port: srv.port })}`);
      if (seq === srv.seq) { srv.info = info; srv.error = null; }
    } catch (err) {
      if (seq === srv.seq) { srv.error = { message: err.message, code: err.code }; srv.info = null; }
    } finally {
      if (seq === srv.seq) { srv.checking = false; srv.at = Date.now(); scheduleRender(); }
    }
  }

  const hostLogin = (alias, port, user) => {
    const conf = (hostsCache || []).find((h) => h.alias === alias);
    const u = (conf && conf.user) || user || '';
    const hn = (conf && conf.hostname) || stripUser(alias);
    const p = port || (conf && conf.port) || '22';
    return `${u ? `${u}@` : ''}${hn}:${p}`;
  };

  function renderServerBar() {
    const el = $('#server-bar');
    if (!hostsCache && !hostsLoading) {
      hostsLoading = true;
      getHosts().finally(() => { hostsLoading = false; scheduleRender(); });
    }
    checkServer(false);
    if (!srv.host) {
      morphHtml(el, `<div class="srv none" data-key="srv-none">
        <span class="srv-icon">${icon('server')}</span>
        <div class="srv-main"><div class="srv-label">当前服务器</div><div class="srv-empty">还没有选择服务器</div></div>
        <span class="spacer"></span>
        <button class="btn btn-sm" data-act="server-menu">${icon('chevronDown', 'i-sm')}选择服务器</button>
        <button class="btn btn-sm btn-primary" data-act="ssh-wizard">${icon('plus', 'i-sm')}添加服务器</button>
      </div>`);
      return;
    }
    const info = srv.info;
    const err = srv.error;
    const kind = info ? 'ok' : err ? 'err' : 'busy';
    const statusText = info ? '已连接' : err ? '连接失败' : '正在连接…';
    const onHost = viewsOnHost(srv.host);
    const linked = onHost.filter((v) => v.remote.connected).length;
    const sourceTag = srv.source === 'pinned'
      ? '<span class="tag" title="config.json 的 defaultHost；新建会话、免密向导、文件管理都默认用它">默认</span>'
      : '<span class="tag" title="没有设定默认服务器，按最近使用自动选择。点名称切换后会固定下来">自动选择</span>';
    const fact = (label, value, title = '') => `<span class="srv-fact" ${title ? `title="${esc(title)}"` : ''}><span>${label}</span><b>${value}</b></span>`;
    const facts = [fact('登录', `<span class="mono">${esc(hostLogin(srv.host, srv.port, info && info.user))}</span>`)];
    if (info) {
      if (info.hostname) facts.push(fact('主机名', esc(info.hostname)));
      if (info.system) facts.push(fact('系统', esc(info.system)));
      facts.push(fact(info.fresh ? '建立连接' : '延迟', info.ms >= 1000 ? `${(info.ms / 1000).toFixed(1)} s` : `${info.ms} ms`, info.fresh ? '首次连接需要 SSH 握手，之后复用同一条连接' : '面板与服务器之间一次命令往返的耗时'));
    }
    facts.push(fact('同步会话', onHost.length ? `${onHost.length} 个${linked ? ` · ${linked} 个已连接` : ''}` : '0 个'));
    const diskFact = info && info.root
      ? (() => {
        const others = (info.disks || []).filter((d) => d !== info.root && d.fs !== info.root.fs && !isBootMount(d.mount)).length;
        return `<button class="srv-disk" data-act="server-disks" title="查看全部分区">${diskHtml(info.root)}${others ? `<span class="disk-more">+${others} 个分区</span>` : ''}</button>`;
      })()
      : '';
    const errHtml = err ? `<div class="srv-err" data-key="srv-err">${icon('alert', 'i-sm')}<span>${esc(err.message)}</span>
        ${err.code === 'SSH_KEY_PERMS' ? '<button class="btn btn-xs" data-act="server-perms">修复私钥权限</button>' : ''}
        ${isAuthErr(err.code) ? `<button class="btn btn-xs" data-act="ssh-wizard" data-host="${esc(srv.host)}" data-port="${esc(srv.port)}">${icon('key', 'i-sm')}配置免密</button>` : ''}</div>` : '';
    morphHtml(el, `<div class="srv s-${kind}" data-key="srv">
      <div class="srv-id">
        <span class="srv-icon">${icon('server')}<i class="srv-dot"></i></span>
        <div class="srv-main">
          <div class="srv-label">当前服务器 ${sourceTag}</div>
          <button class="srv-name" data-act="server-menu" title="切换服务器">${esc(srv.host)}${icon('chevronDown', 'i-sm')}</button>
        </div>
      </div>
      <div class="srv-facts">
        <span class="srv-status">${srv.checking && !info && !err ? '<span class="spinner xs"></span>' : '<i></i>'}${statusText}</span>
        ${facts.join('')}
        ${diskFact}
      </div>
      <div class="srv-actions">
        <button class="btn btn-sm btn-primary" data-act="server-files" title="浏览这台服务器的文件，复制路径、预览、下载">${icon('tree', 'i-sm')}文件管理</button>
        <button class="btn btn-sm" data-act="server-term" title="打开 SSH 终端">${icon('terminal', 'i-sm')}终端</button>
        <button class="btn btn-sm btn-icon ${srv.checking ? 'loading' : ''}" data-act="server-check" title="重新检测连接">${icon('refresh', 'i-sm')}</button>
      </div>
      ${errHtml}
    </div>`);
  }

  /** Uses df's own Use% so the panel matches `df -h` on the server. */
  function diskHtml(d, compact = false) {
    const tone = d.pct >= 90 ? 'err' : d.pct >= 80 ? 'warn' : 'ok';
    const kb = (n) => fmtNum(Math.round(n / 1024));
    const title = `${d.fs}（磁盘 ${diskOf(d.fs)} 上的分区）挂载于 ${d.mount}\n总容量 ${fmtBytes(d.size)}（${kb(d.size)} KB）\n已用 ${fmtBytes(d.used)}（${kb(d.used)} KB）\n可用 ${fmtBytes(d.avail)}（${kb(d.avail)} KB）\n使用率 ${d.pct}%，按 df 的算法：已用 ÷（已用 + 可用），系统保留空间不算可用`;
    return `<span class="disk ${tone} ${compact ? 'compact' : ''}" title="${esc(title)}">${icon('layers', 'i-sm')}<span class="disk-l">分区 ${esc(d.mount)}</span><span class="disk-bar"><i style="width:${Math.min(100, Math.max(0, d.pct))}%"></i></span><b>${d.pct}%</b><span class="disk-n">已用 ${fmtBytes(d.used)} / ${fmtBytes(d.size)} · 可用 ${fmtBytes(d.avail)}</span></span>`;
  }

/** A fresher df reading from the file manager replaces the server bar's copy, so both never disagree. */
  function syncServerDisk(host, d) {
    if (!d || host !== srv.host || !srv.info) return;
    const fresh = (x) => (x && x.fs === d.fs ? { ...d, mount: x.mount } : x);
    srv.info = { ...srv.info, root: fresh(srv.info.root), disks: (srv.info.disks || []).map(fresh) };
    scheduleRender();
  }

  /** Boot partitions (EFI, /boot) hold only the bootloader and are not where user data lives. */
  const isBootMount = (m) => m === '/boot' || m.startsWith('/boot/');
  /** /dev/vda1 -> vda, /dev/nvme0n1p2 -> nvme0n1, /dev/mapper/x stays as is. */
  const diskOf = (fs) => {
    const n = String(fs).replace(/^\/dev\//, '');
    if (n.startsWith('mapper/')) return n;
    return /^(nvme\d+n\d+|mmcblk\d+)p\d+$/.test(n) ? n.replace(/p\d+$/, '') : n.replace(/\d+$/, '');
  };

  function disksMenuHtml(info) {
    const list = [...(info.disks || [])].sort((a, b) => Number(isBootMount(a.mount)) - Number(isBootMount(b.mount)));
    const disks = [...new Set(list.map((d) => diskOf(d.fs)))];
    const row = (d) => {
      const boot = isBootMount(d.mount);
      const role = d.mount === '/' ? '系统分区：系统、软件和你的文件都在这里' : boot ? '系统启动分区：只放开机引导程序，无需关注，不要改动' : '数据分区';
      return `<div class="disk-row ${boot ? 'boot' : ''}">${diskHtml(d)}<div class="disk-dev"><span class="mono">${esc(d.fs)}</span> · ${role}</div></div>`;
    };
    const head = disks.length === 1 ? `都在同一块磁盘 ${esc(disks[0])} 上` : `共 ${disks.length} 块磁盘`;
    return `<div class="menu-label">${esc(srv.host)} 的分区 · ${head}（df -P -k，${esc(timeAgo(srv.at) || '刚刚')}更新）</div>${list.map(row).join('') || '<div class="menu-label">没有读到分区信息</div>'}`;
  }
  function serverMenuHtml(hosts) {
    const servers = hosts.filter((h) => !isGitHost(h));
    const extra = [...new Set(sshViews().map(viewHost))].filter((h) => !hosts.some((x) => x.alias === h));
    const item = (alias, sub) => `<button class="menu-item ${alias === srv.host ? 'checked' : ''}" data-act="server-pick" data-host="${esc(alias)}">${icon('server')}<span class="mi-main"><span>${esc(alias)}</span><small>${esc(sub)}</small></span></button>`;
    const count = (alias) => { const n = viewsOnHost(alias).length; return n ? ` · ${n} 个会话` : ''; };
    const rows = [
      ...servers.map((h) => item(h.alias, `${hostLogin(h.alias)}${count(h.alias)}`)),
      ...extra.map((h) => item(h, `会话中使用${count(h)}`)),
    ];
    const git = hosts.filter(isGitHost);
    return `<div class="menu-label">切换当前服务器（也是新建会话的默认主机）</div>
      ${rows.join('') || '<div class="menu-label">~/.ssh/config 里还没有服务器</div>'}
      ${git.length ? `<div class="menu-label" title="这些是代码托管平台的 Git 连接，不能登录 shell，不作为服务器">已隐藏 Git 托管：${esc(git.map((h) => h.alias).join('、'))}</div>` : ''}
      <div class="menu-sep"></div>
      ${mi('ssh-wizard', 'plus', '添加服务器 / 配置免密')}`;
  }
  function renderChips() {
    const views = [...VIEWS.values()];
    const n = (id) => views.filter((v) => (id === 'all' ? true : gidOf(v) === id)).length;
    const chips = [{ id: 'all', name: '全部' }, ...groupsList()];
    let html = chips.map((g) => `<button class="chip ${ui.filterGroup === g.id ? 'active' : ''}" data-key="c-${g.id}" data-act="filter-group" data-group="${g.id}" ${g.id !== 'all' ? `data-drop-chip="${g.id}"` : ''}>${esc(g.name)}<span class="count">${n(g.id)}</span></button>`).join('');
    html += `<button class="chip chip-add" data-key="c-add" data-act="add-group" title="新建分组">${icon('plus', 'i-sm')}分组</button>`;
    morphHtml($('#chips'), html);

    const anyOpen = groupsList().some((g) => !ui.collapsed.includes(g.id));
    const right = `
      ${anyOpen
    ? `<button class="btn btn-ghost btn-sm" data-key="fold" data-act="collapse-all" title="折叠全部分组">${icon('collapse', 'i-sm')}全部折叠</button>`
    : `<button class="btn btn-ghost btn-sm" data-key="fold" data-act="expand-all" title="展开全部分组">${icon('expand', 'i-sm')}全部展开</button>`}
      <span class="vsep" data-key="sep"></span>
      <div class="seg" data-key="seg">
        <button class="${ui.view === 'grid' ? 'active' : ''}" data-act="view" data-view="grid" title="卡片视图">${icon('grid', 'i-sm')}卡片</button>
        <button class="${ui.view === 'list' ? 'active' : ''}" data-act="view" data-view="list" title="紧凑列表">${icon('rows', 'i-sm')}列表</button>
      </div>`;
    morphHtml($('#toolbar-right'), S.sessions.length ? right : '');
  }

  function renderMain() {
    const main = $('#main');
    document.body.classList.toggle('view-list', ui.view === 'list');
    if (!S.sessions.length) {
      morphHtml(main, emptyHtml());
      return;
    }
    const filtering = !!(ui.search || ui.filterStatus !== 'all');
    const all = [...VIEWS.values()].sort(sortViews);
    const shown = all.filter(matches);
    let html = '';
    for (const g of groupsList()) {
      if (ui.filterGroup !== 'all' && ui.filterGroup !== g.id) continue;
      const total = all.filter((v) => gidOf(v) === g.id);
      const items = shown.filter((v) => gidOf(v) === g.id);
      if (!items.length && (filtering || (g.virtual && ui.filterGroup === 'all'))) continue;
      html += groupHtml(g, items, total);
    }
    if (!html) {
      html = `<div class="no-match" data-key="nomatch">${icon('filter', 'i-lg')}<p>没有符合条件的会话</p><button class="btn btn-sm" data-act="clear-filters">清除筛选</button></div>`;
    }
    morphHtml(main, filterBarHtml(shown, all) + html);
  }

  const STATUS_FILTER_LABEL = { ok: '已同步', busy: '同步中', attention: '需要关注', paused: '已暂停' };
  function filterBarHtml(shown, all) {
    const tags = [];
    if (ui.filterStatus !== 'all') tags.push(['status', `状态：${STATUS_FILTER_LABEL[ui.filterStatus]}`]);
    if (ui.search) tags.push(['search', `搜索：${ui.search}`]);
    if (!tags.length) return '';
    const inGroup = ui.filterGroup === 'all' ? shown : shown.filter((v) => gidOf(v) === ui.filterGroup);
    const scope = ui.filterGroup === 'all' ? all : all.filter((v) => gidOf(v) === ui.filterGroup);
    return `<div class="filter-bar" data-key="fbar">${icon('filter', 'i-sm')}<span>显示 <b>${inGroup.length}</b> / ${scope.length} 个会话</span>
      ${tags.map(([k, label]) => `<span class="filter-tag" data-key="ft-${k}"><span title="${esc(label)}">${esc(label)}</span><button data-act="clear-filter" data-which="${k}" title="移除这个条件">${icon('x', 'i-sm')}</button></span>`).join('')}
      <button class="btn btn-ghost btn-xs" data-key="fclear" data-act="clear-filters">清除筛选</button>
    </div>`;
  }

  function groupHtml(g, items, total) {
    const collapsed = ui.collapsed.includes(g.id);
    const kinds = { ok: 0, busy: 0, attention: 0, paused: 0 };
    total.forEach((v) => { for (const [k, list] of Object.entries(CATS)) if (list.includes(v.status.kind)) kinds[k] += 1; });
    const dot = (k, color, label) => (kinds[k] ? `<span title="${label}"><i style="background:var(${color})"></i>${kinds[k]}</span>` : '');
    const dots = dot('ok', '--ok', '已同步') + dot('busy', '--busy', '同步中') + dot('attention', '--err', '需要关注') + dot('paused', '--paused', '已暂停');
    const body = items.map(ui.view === 'list' ? rowHtml : cardHtml).join('')
      || `<div class="group-empty" data-key="empty-${g.id}">拖动会话卡片到这里，或 <button class="btn-link" data-act="new" data-group="${g.id}">在此分组新建会话</button></div>`;
    return `<section class="group" data-key="g-${g.id}">
      <div class="group-head" data-act="toggle-group" data-group="${g.id}">
        <span class="chev ${collapsed ? '' : 'open'}">${icon('chevronDown')}</span>
        <h2>${esc(g.name)}</h2>
        <span class="muted">${total.length} 个会话</span>
        <span class="group-dots">${dots}</span>
        <span class="spacer"></span>
        <span class="group-tools">
          <button class="btn btn-ghost btn-xs" data-act="group-bulk" data-op="flush" data-group="${g.id}" title="立即同步本组">${icon('refresh', 'i-sm')}同步本组</button>
          <button class="btn btn-ghost btn-icon btn-xs" data-act="group-bulk" data-op="pause" data-group="${g.id}" title="暂停本组">${icon('pause', 'i-sm')}</button>
          <button class="btn btn-ghost btn-icon btn-xs" data-act="group-bulk" data-op="resume" data-group="${g.id}" title="恢复本组">${icon('play', 'i-sm')}</button>
          ${g.virtual ? '' : `<button class="btn btn-ghost btn-icon btn-xs" data-act="group-menu" data-group="${g.id}" title="分组操作">${icon('more', 'i-sm')}</button>`}
        </span>
      </div>
      ${collapsed ? '' : `<div class="group-body" data-drop-group="${g.id}">${body}</div>`}
    </section>`;
  }

  function pathHtml(p) {
    const s = String(p || '');
    const m = s.match(/^(.*[\\/])([^\\/]+[\\/]?)$/);
    const head = m ? m[1] : '';
    const tail = m ? m[2] : s;
    return `<span class="path" data-act="copy" data-text="${esc(s)}" title="${esc(s)}&#10;点击复制"><span class="ph">${esc(head)}</span><span class="pt">${esc(tail)}</span></span>`;
  }

  function connOf(e, v) {
    if (v.paused) return ['', '已暂停'];
    if (e.connected) return ['on', '已连接'];
    return [v.status.kind === 'error' ? 'bad' : '', '未连接'];
  }

  function epRowHtml(e, side, v) {
    const remote = side === 'remote';
    const ic = remote ? (e.isLocal ? 'folder' : 'server') : 'monitor';
    const label = remote ? (e.isLocal ? '源目录' : e.hostLabel) : '本地';
    const where = remote ? e.hostFull : '本机';
    const [cc, ct] = connOf(e, v);
    const stat = e.scanned ? `<span class="ep-files">${fmtNum(e.files)} 个文件 · </span>${fmtBytes(e.size)}` : (e.connected ? '扫描中…' : '');
    const statFull = e.scanned ? `${fmtNum(e.files)} 个文件 · ${fmtNum(e.dirs)} 个目录 · ${fmtBytes(e.size)}` : '';
    return `<div class="ep-row">
      <span class="ep-ic" title="${esc(where)}">${icon(ic)}</span>
      <span class="ep-host" title="${esc(where)}">${esc(label)}</span>
      <i class="conn-dot ${cc}" title="${ct}"></i>
      ${pathHtml(e.path)}
      ${stat ? `<span class="ep-stat" title="${esc(statFull)}">${stat}</span>` : ''}
    </div>`;
  }

  const flowV = (v) => icon(v.flow === 'both' ? 'swapV' : v.flow === 'right' ? 'arrowDown' : 'arrowUp');
  const flowH = (v) => icon(v.flow === 'both' ? 'swap' : v.flow === 'right' ? 'arrowRight' : 'arrowLeft', 'i-sm');

  function footText(v) {
    const st = v.status;
    const parts = [st.kind === 'ok' ? '<b>监视中</b>' : `<b>${esc(st.detail)}</b>`];
    if (v.lastCycleAt) parts.push(`最近同步 ${esc(timeAgo(v.lastCycleAt))}`);
    else if (st.kind === 'ok' || st.kind === 'warn') parts.push(`${fmtNum(v.cycles)} 个同步周期`);
    if (v.ignores.length && st.kind !== 'error') parts.push(`忽略 ${v.ignores.length} 条`);
    return parts.join(' · ');
  }

  function alertChips(v) {
    let html = '';
    if (v.paused && !v.op) html += `<button class="alert-chip neutral ${pending.has(`${v.id}:resume`) ? 'loading' : ''}" data-act="resume">${icon('play', 'i-sm')}恢复同步</button>`;
    if (v.status.kind === 'error' && !v.problems) html += `<button class="alert-chip err" data-act="details" data-tab="${v.lastError ? 'problems' : 'overview'}">${icon('alert', 'i-sm')}查看原因</button>`;
    if (v.conflicts) html += `<button class="alert-chip warn" data-act="details" data-tab="conflicts">${icon('alert', 'i-sm')}${v.conflicts} 处冲突</button>`;
    if (v.problems) html += `<button class="alert-chip err" data-act="details" data-tab="problems">${icon('alert', 'i-sm')}${v.problems} 个问题</button>`;
    return html;
  }

  const QUICK_OPEN = { vscode: ['code', 'VS Code'], idea: ['code', 'IntelliJ IDEA'], explorer: ['folder', '资源管理器'], terminal: ['terminal', '本地终端'] };
  const quickOpen = () => { const q = localStorage.getItem('mp.quickOpen'); return QUICK_OPEN[q] ? q : 'vscode'; };
  const STATUS_COLOR = { ok: 'var(--ok)', busy: 'var(--busy)', op: 'var(--busy)', warn: 'var(--warn)', error: 'var(--err)', paused: 'var(--paused)' };

  function quickButtons(v) {
    const busy = (a) => pending.has(`${v.id}:${a}`);
    const locked = !!v.op || busy('op');
    const qo = quickOpen();
    const [qi, ql] = QUICK_OPEN[qo];
    let html = `<button class="btn btn-icon btn-xs ${busy('flush') ? 'loading' : ''}" data-act="flush" ${v.paused || locked ? 'disabled' : ''} title="立即同步">${icon('refresh', 'i-sm')}</button>`;
    html += v.paused
      ? `<button class="btn btn-icon btn-xs ${busy('resume') ? 'loading' : ''}" data-act="resume" ${locked ? 'disabled' : ''} title="恢复同步">${icon('play', 'i-sm')}</button>`
      : `<button class="btn btn-icon btn-xs ${busy('pause') ? 'loading' : ''}" data-act="pause" ${locked ? 'disabled' : ''} title="暂停">${icon('pause', 'i-sm')}</button>`;
    html += '<span class="hb-sep"></span>';
    if (v.local.isLocal) {
      html += `<button class="btn btn-icon btn-xs" data-act="open" data-with="${qo}" data-path="${esc(v.local.path)}" title="用${ql}打开本地目录">${icon(qi, 'i-sm')}</button>`;
      if (qo !== 'explorer') html += `<button class="btn btn-icon btn-xs" data-act="open" data-with="explorer" data-path="${esc(v.local.path)}" title="在资源管理器中打开">${icon('folder', 'i-sm')}</button>`;
    }
    if (v.remote.protocol === 'ssh') html += `<button class="btn btn-icon btn-xs" data-act="remote-term" title="打开服务器终端并进入该目录">${icon('terminal', 'i-sm')}</button>`;
    html += '<span class="hb-sep"></span>';
    html += `<button class="btn btn-icon btn-xs" data-act="card-menu" title="更多操作（也可以右键卡片）">${icon('more', 'i-sm')}</button>`;
    return html;
  }

  function cardHtml(v) {
    const st = v.status;
    const dragDisabled = dndDisabled();
    const showBar = st.kind === 'busy' || st.kind === 'op';
    return `<article class="card s-${st.kind}" data-key="${v.id}" data-id="${v.id}">
      <header class="card-head">
        <span class="grip ${dragDisabled ? 'disabled' : ''}" data-drag title="${dragDisabled ? '清除搜索和筛选后可拖动排序' : '拖动排序，或拖到分组标签上'}">${icon('grip', 'i-sm')}</span>
        <h3 class="card-title" title="${esc(v.title)}（双击重命名）" data-dbl="rename">${esc(v.title)}</h3>
        <span class="pill pill-${st.kind}"><i class="dot"></i>${esc(st.text)}</span>
        <span class="spacer"></span>
        <span class="badge">${esc(v.modeLabel)}</span>
        <div class="hover-bar ${popFor === v.id ? 'pinned' : ''}">${quickButtons(v)}</div>
      </header>
      <div class="eps">
        ${epRowHtml(v.remote, 'remote', v)}
        <div class="ep-flow" title="${esc(v.modeLabel)}"><span>${flowV(v)}</span></div>
        ${epRowHtml(v.local, 'local', v)}
      </div>
      <footer class="card-foot">
        ${v.op ? `<span class="op-overlay"><span class="spinner" style="width:12px;height:12px"></span>${esc(v.op)}</span><span class="spacer"></span>` : `<span class="foot-text" title="${esc(st.detail)}">${footText(v)}</span>`}
        ${alertChips(v)}
      </footer>
      ${showBar ? `<div class="card-bar ${st.ind ? 'indeterminate' : ''}"><span style="width:${st.pct ?? 0}%"></span></div>` : ''}
    </article>`;
  }

  function rowHtml(v) {
    const st = v.status;
    const dragDisabled = dndDisabled();
    const showBar = st.kind === 'busy' || st.kind === 'op';
    const okText = v.lastCycleAt ? `监视中 · ${timeAgo(v.lastCycleAt)}同步` : '监视中';
    const statusText = v.op || (v.conflicts ? `${v.conflicts} 处冲突待处理` : v.problems ? `${v.problems} 个文件无法同步` : (st.kind === 'ok' ? okText : st.detail));
    return `<article class="card s-${st.kind}" data-key="${v.id}" data-id="${v.id}">
      <div class="row">
        <div class="row-title">
          <span class="grip ${dragDisabled ? 'disabled' : ''}" data-drag>${icon('grip', 'i-sm')}</span>
          <span class="pill pill-${st.kind}"><i class="dot"></i>${esc(st.text)}</span>
          <h3 class="card-title" title="${esc(v.title)}（双击重命名）" data-dbl="rename">${esc(v.title)}</h3>
        </div>
        <div class="row-paths">
          <span class="seg-path"><span class="ep-host" title="${esc(v.remote.hostFull)}">${esc(v.remote.isLocal ? '源目录' : v.remote.hostLabel)}</span>${pathHtml(v.remote.path)}</span>
          <span class="flow-ic" title="${esc(v.modeLabel)}">${flowH(v)}</span>
          <span class="seg-path"><span class="ep-host">本地</span>${pathHtml(v.local.path)}</span>
        </div>
        <div class="row-status">
          <span title="${esc(st.detail)}">${esc(statusText)}</span>
          ${showBar ? `<div class="bar bar-${st.kind} ${st.ind ? 'indeterminate' : ''}"><span style="width:${st.pct ?? 0}%"></span></div>` : ''}
        </div>
        <div class="row-actions ${popFor === v.id ? 'pinned' : ''}">${quickButtons(v)}</div>
      </div>
    </article>`;
  }
  function emptyHtml() {
    return `<div class="empty" data-key="empty">
      <div class="empty-art">${icon('swap')}</div>
      <h2>还没有同步会话</h2>
      <p>把服务器上的项目目录实时同步到本机：服务器上改动的文件几秒内出现在本地，本地 IDE 直接查看代码和 Git 变化。</p>
      <div class="steps">
        <div class="step"><span class="step-num">1</span><h3>配置 SSH 免密登录</h3><p>mutagen 通过 SSH 连接服务器，必须能用密钥免密登录。已配置可跳过。</p><button class="btn btn-sm" data-act="ssh-wizard">${icon('key', 'i-sm')}打开免密登录向导</button></div>
        <div class="step"><span class="step-num">2</span><h3>新建同步会话</h3><p>选择服务器目录和本地目录，以及同步方向。首次连接会自动往服务器上传 mutagen agent。</p><button class="btn btn-primary btn-sm" data-act="new">${icon('plus', 'i-sm')}新建会话</button></div>
        <div class="step"><span class="step-num">3</span><h3>用 IDE 打开本地目录</h3><p>在卡片上一键用资源管理器、VS Code 或 IDEA 打开本地目录，文件改动实时可见。</p><button class="btn btn-sm" data-act="settings">${icon('settings', 'i-sm')}配置编辑器路径</button></div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------ layers (modal / drawer)
  const layers = [];
  function openLayer({ type = 'modal', size = '', html = '', persistent = false, onClose, mount }) {
    closePopover();
    const wrap = document.createElement('div');
    wrap.className = `layer layer-${type}`;
    wrap.innerHTML = `<div class="backdrop"></div><div class="${type} ${size}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(wrap);
    const panel = wrap.lastElementChild;
    const layer = { el: wrap, panel, closed: false, persistent };
    layer.close = () => {
      if (layer.closed) return;
      layer.closed = true;
      wrap.classList.remove('show');
      setTimeout(() => wrap.remove(), 220);
      const i = layers.indexOf(layer);
      if (i >= 0) layers.splice(i, 1);
      if (onClose) onClose();
    };
    wrap.querySelector('.backdrop').addEventListener('click', () => { if (!persistent) layer.close(); });
    panel.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) layer.close(); });
    layers.push(layer);
    requestAnimationFrame(() => wrap.classList.add('show'));
    if (mount) mount(panel, layer);
    return layer;
  }

  const modalHead = (title, sub, ic, tone = 'tone-primary') => `
    <div class="modal-head">
      ${ic ? `<span class="head-icon ${tone}">${icon(ic)}</span>` : ''}
      <div style="flex:1;min-width:0"><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <button class="btn btn-ghost btn-icon btn-sm" data-close title="关闭 (Esc)">${icon('x')}</button>
    </div>`;

  function confirmDialog({ title, message, okText = '确定', danger = false, ic = 'alert' }) {
    return new Promise((resolve) => {
      let ok = false;
      openLayer({
        size: 'sm',
        html: `${modalHead(title, '', ic, danger ? 'tone-err' : 'tone-primary')}
          <div class="modal-body" style="color:var(--text-2);font-size:13.5px">${message}</div>
          <div class="modal-foot"><span class="spacer"></span><button class="btn" data-close>取消</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-m="ok">${esc(okText)}</button></div>`,
        onClose: () => resolve(ok),
        mount(panel, layer) {
          const btn = panel.querySelector('[data-m="ok"]');
          btn.addEventListener('click', () => { ok = true; layer.close(); });
          setTimeout(() => btn.focus(), 60);
        },
      });
    });
  }

  /** submit(value) may return an error message (or throw) to keep the dialog open and show it under the input. */
  function promptDialog({ title, label, value = '', placeholder = '', okText = '确定', ic = 'edit', help = '', submit: onSubmit }) {
    return new Promise((resolve) => {
      let result = null;
      openLayer({
        size: 'sm',
        html: `${modalHead(title, '', ic)}
          <div class="modal-body"><div class="field"><label>${esc(label)}</label><input class="input" data-m="input" value="${esc(value)}" placeholder="${esc(placeholder)}" spellcheck="false" autocomplete="off"><div class="help" data-m="help">${esc(help)}</div></div></div>
          <div class="modal-foot"><span class="spacer"></span><button class="btn" data-close>取消</button><button class="btn btn-primary" data-m="ok">${esc(okText)}</button></div>`,
        onClose: () => resolve(result),
        mount(panel, layer) {
          const input = panel.querySelector('[data-m="input"]');
          const ok = panel.querySelector('[data-m="ok"]');
          const helpEl = panel.querySelector('[data-m="help"]');
          const showErr = (msg) => { helpEl.textContent = msg; helpEl.classList.add('err'); input.focus(); };
          const submit = async () => {
            const v = input.value.trim();
            if (!v || ok.disabled) return;
            if (onSubmit) {
              ok.disabled = true;
              ok.classList.add('loading');
              let err;
              try { err = await onSubmit(v); } catch (e) { err = e.message; }
              ok.disabled = false;
              ok.classList.remove('loading');
              if (err) { showErr(err); return; }
            }
            result = v;
            layer.close();
          };
          ok.addEventListener('click', submit);
          input.addEventListener('input', () => { helpEl.textContent = help; helpEl.classList.remove('err'); });
          input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
          setTimeout(() => { input.focus(); input.select(); }, 60);
        },
      });
    });
  }

  /** Resolves to { deleteRemote } or null. Deleting the server directory needs its name typed in. */
  function deleteSessionDialog(v) {
    const canRemote = v.remote.protocol === 'ssh';
    const dirName = String(v.remote.path || '').split('/').filter(Boolean).pop() || v.remote.path || '~';
    return new Promise((resolve) => {
      let result = null;
      const choice = (mode, ic, t, d, active) => `<button type="button" class="choice ${active ? 'active' : ''}" data-mode="${mode}"><span class="t">${icon(ic, 'i-sm')}${t}</span><span class="d">${d}</span></button>`;
      openLayer({
        size: 'sm',
        html: `${modalHead('删除同步会话', esc(v.title), 'trash', 'tone-err')}
          <div class="modal-body" style="color:var(--text-2);font-size:13.5px">
            ${canRemote ? `<div class="choice-grid del-modes" data-m="modes">
                ${choice('keep', 'layers', '仅删除会话', '停止并删除同步会话，服务器和本地的文件都保留', true)}
                ${choice('remote', 'server', '删除会话和服务器目录', '会话停止后永久删除服务器上的目录，本地文件保留', false)}
              </div>
              <div data-m="remote" hidden>
                <div class="del-warn">${icon('alert', 'i-sm')}<span>将在 <b>${esc(v.remote.hostFull)}</b> 上永久删除 <span class="mono" style="word-break:break-all">${esc(v.remote.path)}</span> 及其中的所有文件，<b>无法恢复</b>，不会放进回收站。</span></div>
                <div class="field" style="margin-top:12px"><label>输入目录名 <b class="mono">${esc(dirName)}</b> 以确认</label><input class="input mono" data-m="confirm" spellcheck="false" autocomplete="off" placeholder="${esc(dirName)}"></div>
              </div>`
            : '只会停止并删除这个同步会话，<b>两端的文件都会保留</b>，不会被删除。'}
          </div>
          <div class="modal-foot"><span class="spacer"></span><button class="btn" data-close>取消</button><button class="btn btn-danger" data-m="ok">删除会话</button></div>`,
        onClose: () => resolve(result),
        mount(panel, layer) {
          const q = (m) => panel.querySelector(`[data-m="${m}"]`);
          const btn = q('ok');
          let mode = 'keep';
          const valid = () => mode === 'keep' || q('confirm').value.trim() === dirName;
          const sync = () => {
            panel.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
            if (canRemote) q('remote').hidden = mode !== 'remote';
            btn.textContent = mode === 'remote' ? '删除会话和服务器目录' : '删除会话';
            btn.disabled = !valid();
          };
          const submit = () => { if (!valid()) return; result = { deleteRemote: mode === 'remote' }; layer.close(); };
          if (canRemote) {
            q('modes').addEventListener('click', (e) => {
              const b = e.target.closest('[data-mode]');
              if (!b) return;
              mode = b.dataset.mode;
              sync();
              if (mode === 'remote') q('confirm').focus();
            });
            q('confirm').addEventListener('input', sync);
            q('confirm').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
          }
          btn.addEventListener('click', submit);
          sync();
          setTimeout(() => btn.focus(), 60);
        },
      });
    });
  }

  // ------------------------------------------------------------ popover
  const pop = $('#popover');
  let popAnchor = null;
  /** anchor is an element, or {x, y} for a context menu at the pointer. */
  function openPopover(anchor, html, id) {
    if (popAnchor === anchor && !pop.hidden) { closePopover(); return; }
    pop.innerHTML = html;
    if (id) pop.setAttribute('data-id', id); else pop.removeAttribute('data-id');
    pop.hidden = false;
    pop.style.visibility = 'hidden';
    pop.scrollTop = 0;
    const point = !(anchor instanceof Element);
    const r = point ? { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y } : anchor.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    let left = point ? r.left : r.right - pw;
    if (point && left + pw > window.innerWidth - 8) left = r.left - pw;
    if (left < 8) left = Math.min(r.left, window.innerWidth - pw - 8);
    let top = point ? r.top : r.bottom + 6;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, (point ? r.top : r.top - 6) - ph);
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${top}px`;
    pop.style.visibility = '';
    popAnchor = anchor;
    if (popFor !== (id || null)) { popFor = id || null; scheduleRender(); }
  }
  function closePopover() {
    pop.hidden = true;
    popAnchor = null;
    if (popFor) { popFor = null; scheduleRender(); }
  }
  const mi = (act, ic, label, extra = '') => `<button class="menu-item ${extra.includes('danger') ? 'danger' : ''}" data-act="${act}" ${extra.replace('danger', '')}>${icon(ic)}${label}</button>`;

  function cardMenu(v, inDrawer = false) {
    const remoteSsh = v.remote.protocol === 'ssh';
    const srcName = remoteSsh ? '服务器' : '源目录';
    const dis = v.op || pending.has(`${v.id}:op`) ? 'disabled' : '';
    const groups = groupsList();
    return `
      <div class="menu-label">${esc(v.title)}</div>
      ${v.paused ? mi('resume', 'play', '恢复同步', dis) : mi('flush', 'refresh', '立即同步', dis)}
      ${v.paused ? '' : mi('pause', 'pause', '暂停', dis)}
      ${inDrawer ? '' : mi('details', 'info', '查看详情')}
      ${mi('edit', 'edit', '编辑配置', dis)}
      <div class="menu-sep"></div>
      ${v.local.isLocal ? `
        ${mi('open', 'code', '用 VS Code 打开', `data-with="vscode" data-path="${esc(v.local.path)}"`)}
        ${mi('open', 'code', '用 IntelliJ IDEA 打开', `data-with="idea" data-path="${esc(v.local.path)}"`)}
        ${mi('open', 'folder', '在资源管理器中打开', `data-with="explorer" data-path="${esc(v.local.path)}"`)}
        ${mi('open', 'terminal', '在本地终端打开', `data-with="terminal" data-path="${esc(v.local.path)}"`)}` : ''}
      ${remoteSsh ? mi('remote-term', 'server', '打开服务器终端') : ''}
      ${remoteSsh ? mi('remote-files', 'tree', '浏览服务器文件') : ''}
      <div class="menu-sep"></div>
      ${mi('copy', 'copy', '复制本地路径', `data-text="${esc(v.local.path)}"`)}
      ${mi('copy', 'copy', `复制${srcName}路径`, `data-text="${esc(remoteSsh ? `${v.remote.hostLabel}:${v.remote.path}` : v.remote.path)}"`)}
      ${mi('copy-cmd', 'code', '复制等效 mutagen 命令')}
      <div class="menu-sep"></div>
      ${mi('rename', 'tag', '重命名')}
      ${mi('duplicate', 'copyPlus', '以此配置新建会话')}
      <div class="menu-label">移动到分组</div>
      ${groups.map((g) => `<button class="menu-item ${gidOf(v) === g.id ? 'checked' : ''}" data-act="move-group" data-group="${g.id}">${icon('layers')}${esc(g.name)}</button>`).join('')}
      <div class="menu-sep"></div>
      <div class="menu-label">强制覆盖（会丢弃另一端的差异）</div>
      ${mi('overwrite', 'download', `用${srcName}覆盖本地`, `data-target="local" ${dis} danger`)}
      ${mi('overwrite', 'upload', `用本地覆盖${srcName}`, `data-target="remote" ${dis} danger`)}
      ${mi('reset', 'rotate', '重置同步历史', dis)}
      <div class="menu-sep"></div>
      ${mi('delete', 'trash', '删除会话…', `${dis} danger`)}`;
  }


  // ------------------------------------------------------------ actions
  async function doAct(key, fn, okMsg) {
    if (pending.has(key)) return undefined;
    pending.add(key);
    scheduleRender();
    try {
      const r = await fn();
      if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok');
      return r;
    } catch (err) {
      toast(err.message, 'error', err.code === 'SSH_AUTH' ? { action: { label: '配置免密', run: () => openSshWizard() } } : {});
      return undefined;
    } finally {
      pending.delete(key);
      scheduleRender();
    }
  }

  const sessionOf = (id) => S.sessions.find((s) => s.identifier === id);
  const bulkMsg = (verb) => (r) => (r && r.count ? `已${verb} ${r.count} 个会话` : `没有需要${verb}的会话`);

  function remoteTerm(v) {
    const sp = v.spec;
    return api('POST', '/api/open/remote-terminal', { host: sp.remote.host || v.remote.hostFull, port: sp.remote.port, path: v.remote.path });
  }

  function autostartMenu() {
    const a = S.mutagen.autostart;
    const when = S.platform === 'win32' ? '登录 Windows 时' : '登录时';
    if (!a) return `${mi('daemon', 'zap', `${when}自动启动`, 'data-op="register"')}${mi('daemon', 'x', '取消自动启动', 'data-op="unregister"')}`;
    if (!a.enabled) {
      return `<div class="menu-label">自动启动：<b>未开启</b>，不打开面板时不会同步</div>${mi('daemon', 'zap', `${when}自动启动`, 'data-op="register"')}`;
    }
    const other = a.samePath === false
      ? `<div class="menu-label warn mono" style="word-break:break-all" title="${esc(a.command || '')}">注意：自启动指向另一个 mutagen：${esc(a.exe)}</div>${mi('daemon', 'zap', '改为当前 mutagen 自动启动', 'data-op="register"')}`
      : '';
    return `<div class="menu-label status-on">${icon('checkCircle', 'i-sm')}已开启：${when}自动启动守护进程</div>${other}${mi('daemon', 'x', '取消自动启动', 'data-op="unregister"')}`;
  }

  const actions = {
    new: (t) => openSessionForm(null, t.dataset.group),
    'flush-all': () => doAct('bulk:flush', () => api('POST', '/api/bulk/flush', {}), bulkMsg('触发同步')),
    'pause-all': () => doAct('bulk:pause', () => api('POST', '/api/bulk/pause', {}), bulkMsg('暂停')),
    'resume-all': () => doAct('bulk:resume', () => api('POST', '/api/bulk/resume', {}), bulkMsg('恢复')),
    'group-bulk': (t) => {
      const ids = [...VIEWS.values()].filter((v) => gidOf(v) === t.dataset.group).map((v) => v.id);
      const verb = { flush: '触发同步', pause: '暂停', resume: '恢复' }[t.dataset.op];
      return doAct(`group:${t.dataset.group}:${t.dataset.op}`, () => api('POST', `/api/bulk/${t.dataset.op}`, { ids }), bulkMsg(verb));
    },
    'filter-group': (t) => { ui.filterGroup = t.dataset.group; saveUi(); render(); },
    'filter-status': (t) => { ui.filterStatus = ui.filterStatus === t.dataset.status || t.dataset.status === 'all' ? 'all' : t.dataset.status; saveUi(); render(); },
    'clear-filter': (t) => {
      if (t.dataset.which === 'status') ui.filterStatus = 'all';
      else { ui.search = ''; $('#search').value = ''; }
      saveUi();
      render();
    },
    'clear-filters': () => { ui.filterGroup = 'all'; ui.filterStatus = 'all'; ui.search = ''; $('#search').value = ''; saveUi(); render(); },
    'toggle-group': (t) => {
      const id = t.dataset.group;
      ui.collapsed = ui.collapsed.includes(id) ? ui.collapsed.filter((x) => x !== id) : [...ui.collapsed, id];
      saveUi();
      render();
    },
    'expand-all': () => { ui.collapsed = []; saveUi(); render(); },
    'collapse-all': () => { ui.collapsed = groupsList().map((g) => g.id); saveUi(); render(); },
    view: (t) => { ui.view = t.dataset.view; saveUi(); render(); },
    theme: () => {
      const order = ['auto', 'light', 'dark'];
      const cur = document.documentElement.getAttribute('data-theme') || 'auto';
      const next = order[(order.indexOf(cur) + 1) % order.length];
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('mp.theme', next);
      renderTopActions();
      toast(`主题：${{ auto: '跟随系统', light: '浅色', dark: '深色' }[next]}`, 'info', { duration: 1400 });
    },
    flush: (t, id) => doAct(`${id}:flush`, () => api('POST', `/api/sessions/${id}/flush`), '已触发同步'),
    pause: (t, id) => doAct(`${id}:pause`, () => api('POST', `/api/sessions/${id}/pause`), '已暂停'),
    resume: (t, id) => doAct(`${id}:resume`, () => api('POST', `/api/sessions/${id}/resume`), '已恢复同步'),
    details: (t, id) => openDetail(id, t.dataset.tab || 'overview'),
    edit: (t, id) => { const s = sessionOf(id); if (s) openSessionForm(s); },
    delete: async (t, id) => {
      const v = VIEWS.get(id);
      if (!v) return;
      const choice = await deleteSessionDialog(v);
      if (!choice) return;
      if (!choice.deleteRemote) {
        doAct(`${id}:op`, () => api('DELETE', `/api/sessions/${id}`), '会话已删除，文件均已保留');
        return;
      }
      const r = await doAct(`${id}:op`, () => api('DELETE', `/api/sessions/${id}`, { deleteRemote: true }));
      const rm = r && r.remote;
      if (!rm) return;
      if (rm.error) toast(`会话已删除，但服务器目录 ${rm.path} 删除失败：${rm.error}`, 'error', { duration: 10000 });
      else toast(rm.missing ? `会话已删除，服务器目录 ${rm.path} 本就不存在` : `会话已删除，服务器目录 ${rm.path} 已删除`, 'ok');
    },
    'card-menu': (t, id) => openPopover(t, cardMenu(VIEWS.get(id), !!t.closest('.drawer')), id),
    duplicate: (t, id) => { const s = sessionOf(id); if (s) openSessionForm(null, s._panel.groupId || NONE, s); },
    palette: () => openPalette(),
    copy: (t) => copyText(t.dataset.text, '路径已复制'),
    'copy-cmd': (t, id) => copyText(VIEWS.get(id).command, '命令已复制'),
    open: (t) => doAct(`open:${t.dataset.path}:${t.dataset.with}`, () => api('POST', '/api/open', { path: t.dataset.path, with: t.dataset.with })),
    'remote-term': (t, id) => doAct(`${id}:term`, () => remoteTerm(VIEWS.get(id)), '已打开服务器终端'),
    overwrite: async (t, id) => {
      const v = VIEWS.get(id);
      const toLocal = t.dataset.target === 'local';
      const srcName = v.remote.isLocal ? '源目录' : '服务器';
      const from = toLocal ? srcName : '本地';
      const to = toLocal ? '本地' : srcName;
      const ok = await confirmDialog({
        title: `用${from}覆盖${to}`,
        message: `将让「<b>${esc(v.title)}</b>」的<b>${to}</b>变得和<b>${from}</b>完全一致：<br><br>
          · ${to}独有的文件会被<b>删除</b><br>· ${to}与${from}不同的文件会被<b>覆盖</b><br>· 忽略规则匹配的文件不受影响<br><br>
          ${to}路径：<code>${esc(toLocal ? v.local.path : v.remote.path)}</code><br><br>完成后会话按原配置继续同步。此操作不可撤销。`,
        okText: `确认覆盖${to}`,
        danger: true,
      });
      if (ok) doAct(`${id}:op`, () => api('POST', `/api/sessions/${id}/overwrite`, { target: t.dataset.target }), `已用${from}覆盖${to}`);
    },
    reset: async (t, id) => {
      const ok = await confirmDialog({
        title: '重置同步历史',
        message: '清除 mutagen 记录的「上次同步状态」，下一轮按两端现有内容重新合并。<br><br>适用于会话因根目录被清空而停止，或希望重新对比两端的场景。双向安全模式下两端都存在但内容不同的文件会成为冲突。',
        okText: '重置',
      });
      if (ok) doAct(`${id}:op`, () => api('POST', `/api/sessions/${id}/reset`), '同步历史已重置');
    },
    rename: async (t, id) => {
      const v = VIEWS.get(id);
      const name = await promptDialog({ title: '重命名会话', label: '会话名称', value: v.title });
      if (name && name !== v.title) doAct(`${id}:rename`, () => api('PATCH', `/api/sessions/${id}/meta`, { title: name }), '已重命名');
    },
    'move-group': (t, id) => doAct(`${id}:move`, () => api('PATCH', `/api/sessions/${id}/meta`, { groupId: t.dataset.group === NONE ? null : t.dataset.group }), '已移动'),
    'add-group': async () => {
      const name = await promptDialog({ title: '新建分组', label: '分组名称', placeholder: '例如：微服务开发平台' });
      if (name) doAct('group:add', () => api('POST', '/api/groups', { name }), `已创建分组「${name}」`);
    },
    'group-menu': (t) => {
      const id = t.dataset.group;
      openPopover(t, `${mi('new', 'plus', '在此分组新建会话', `data-group="${id}"`)}${mi('rename-group', 'edit', '重命名分组', `data-group="${id}"`)}${mi('groups', 'layers', '管理全部分组')}<div class="menu-sep"></div>${mi('delete-group', 'trash', '删除分组', `data-group="${id}" danger`)}`);
    },
    'rename-group': async (t) => {
      const g = S.groups.find((x) => x.id === t.dataset.group);
      const name = await promptDialog({ title: '重命名分组', label: '分组名称', value: g.name });
      if (name && name !== g.name) doAct('group:rename', () => api('PUT', `/api/groups/${g.id}`, { name }), '已重命名分组');
    },
    'delete-group': async (t) => {
      const g = S.groups.find((x) => x.id === t.dataset.group);
      const ok = await confirmDialog({ title: '删除分组', message: `删除分组「<b>${esc(g.name)}</b>」？其中的会话会移到「未分组」，不会被删除。`, okText: '删除分组', danger: true, ic: 'trash' });
      if (ok) {
        if (ui.filterGroup === g.id) ui.filterGroup = 'all';
        doAct('group:delete', () => api('DELETE', `/api/groups/${g.id}`), '分组已删除');
      }
    },
    groups: () => openGroupsManager(),
    'menu-more': (t) => openPopover(t, `
      ${mi('palette', 'cmd', '命令面板', '').replace('</button>', '<span class="hint">Ctrl K</span></button>')}
      ${mi('pause-all', 'pause', '暂停全部会话')}
      ${mi('resume-all', 'play', '恢复全部会话')}
      <div class="menu-sep"></div>
      ${mi('files', 'tree', '服务器文件管理')}
      ${mi('ssh-wizard', 'key', 'SSH 免密登录向导')}
      ${mi('groups', 'layers', '管理分组')}
      ${mi('logs', 'log', '命令日志')}
      ${mi('settings', 'settings', '设置')}
      <div class="menu-sep"></div>
      ${mi('about', 'info', '关于与使用说明')}`),
    'daemon-menu': (t) => openPopover(t, `
      <div class="menu-label">mutagen ${esc(S.mutagen.version || '')} · ${S.mutagen.daemon ? '守护进程运行中' : '守护进程未运行'}</div>
      <div class="menu-label mono" style="word-break:break-all">${esc(S.mutagen.path)}</div>
      <div class="menu-sep"></div>
      ${mi('daemon', 'rotate', '重启守护进程', 'data-op="restart"')}
      ${S.mutagen.daemon ? mi('daemon', 'power', '停止守护进程', 'data-op="stop" danger') : mi('daemon', 'play', '启动守护进程', 'data-op="start"')}
      <div class="menu-sep"></div>
      ${autostartMenu()}
      <div class="menu-sep"></div>
      ${mi('settings', 'settings', '修改 mutagen 路径')}`),
    daemon: async (t) => {
      const op = t.dataset.op;
      if (op === 'stop') {
        const ok = await confirmDialog({ title: '停止守护进程', message: '停止后<b>所有同步都会中断</b>，直到守护进程重新启动。面板会在下一次刷新时自动尝试重新启动它。', okText: '停止', danger: true });
        if (!ok) return;
      }
      const label = { restart: '守护进程已重启', stop: '守护进程已停止', start: '守护进程已启动', register: '已设置登录时自动启动', unregister: '已取消自动启动' }[op];
      doAct(`daemon:${op}`, () => api('POST', `/api/daemon/${op}`), label);
    },
    'ssh-wizard': (t) => openSshWizard(t && t.dataset && t.dataset.host ? { host: t.dataset.host, port: t.dataset.port || '' } : {}),
    'remote-files': (t, id) => {
      const v = VIEWS.get(id);
      if (v) openFileManager({ host: viewHost(v), port: (v.spec && v.spec.remote.port) || '', path: v.remote.path });
    },
    files: () => openFileManager({}),
    'server-files': () => openFileManager({ host: srv.host, port: srv.port }),
    'server-term': () => doAct('server:term', () => api('POST', '/api/open/remote-terminal', { host: srv.host, port: srv.port, path: '~' }), '已打开服务器终端'),
    'server-check': () => checkServer(true),
    'server-disks': (t) => { if (srv.info) openPopover(t, disksMenuHtml(srv.info)); },
    'server-perms': () => doAct('server:perms', async () => { await fixKeyPerms(srv.host, srv.port); await checkServer(true); }),
    'server-menu': async (t) => {
      const hosts = await getHosts(true);
      openPopover(t, serverMenuHtml(hosts));
    },
    'server-pick': (t) => doAct('server:pick', async () => {
      const host = t.dataset.host;
      await api('PUT', '/api/config/default-host', { defaultHost: host });
      S.defaultHost = host;
      localStorage.setItem('mp.lastHost', host);
      checkServer(true);
    }, () => `当前服务器：${t.dataset.host}`),
    logs: () => openLogs(),
    settings: () => openSettings(),
    about: () => openAbout(),
  };

  let titleClickTimer = null;
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    const hadPopover = !pop.hidden;
    if (!pop.hidden && !e.target.closest('#popover') && (!t || t !== popAnchor)) closePopover();
    if (!t) {
      const card = e.target.closest('#main .card[data-id]');
      if (!card || hadPopover || e.target.closest('button, a, input, [data-drag], .hover-bar, .row-actions') || String(window.getSelection() || '')) return;
      const id = card.dataset.id;
      clearTimeout(titleClickTimer);
      /** Delay on the title so a double-click (rename) can cancel the single-click (open details). */
      if (e.target.closest('[data-dbl]')) titleClickTimer = setTimeout(() => openDetail(id, 'overview'), 260);
      else openDetail(id, 'overview');
      return;
    }
    if (t.disabled) return;
    const fn = actions[t.dataset.act];
    if (!fn) return;
    e.preventDefault();
    e.stopPropagation();
    if (t.closest('#popover') && t.dataset.act !== 'menu-more') closePopover();
    const id = t.closest('[data-id]')?.getAttribute('data-id');
    fn(t, id);
  });

  document.addEventListener('dblclick', (e) => {
    const t = e.target.closest('[data-dbl="rename"]');
    if (!t) return;
    clearTimeout(titleClickTimer);
    const id = t.closest('[data-id]')?.getAttribute('data-id');
    if (id) actions.rename(t, id);
  });

  // ------------------------------------------------------------ top actions
  function renderTopActions() {
    const theme = document.documentElement.getAttribute('data-theme') || 'auto';
    $('#top-actions').innerHTML = `
      <button class="btn cmdk-btn" data-act="palette" title="命令面板：搜索会话并直接执行同步、暂停、打开 IDE 等操作">${icon('search', 'i-sm')}<span>命令</span><kbd>Ctrl K</kbd></button>
      <button class="btn" data-act="flush-all" title="对所有运行中的会话立即执行一次同步">${icon('refresh')}<span class="label-wide">全部同步</span></button>
      <button class="btn btn-primary" data-act="new" title="新建同步会话 (N)">${icon('plus')}新建会话</button>
      <button class="btn btn-ghost btn-icon" data-act="theme" title="切换主题（当前：${{ auto: '跟随系统', light: '浅色', dark: '深色' }[theme]}）">${icon(theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto')}</button>
      <button class="btn btn-ghost btn-icon" data-act="menu-more" title="更多">${icon('more')}</button>`;
  }

  // ------------------------------------------------------------ session form
  async function getHosts(force) {
    if (!hostsCache || force) {
      try { hostsCache = (await api('GET', '/api/ssh/hosts')).hosts; } catch { hostsCache = []; }
      hostTargetCache.clear();
    }
    return hostsCache;
  }

  const isAuthErr = (code) => String(code || '').startsWith('SSH_AUTH');
  const hostTargetCache = new Map();

  /** Where ssh will actually log in for this host field, after ~/.ssh/config is applied. */
  async function resolveHost(host, port) {
    const h = String(host || '').trim();
    if (!h) return null;
    const key = `${h}|${String(port || '').trim()}`;
    if (!hostTargetCache.has(key)) {
      hostTargetCache.set(key, api('POST', '/api/ssh/resolve', { host: h, port: String(port || '').trim() }).catch(() => null));
    }
    return hostTargetCache.get(key);
  }

  function hostTargetHtml(t) {
    if (!t) return '';
    if (!t.defaultUser) return `<div class="host-target">将以 <span class="mono">${esc(t.user)}@${esc(t.hostname)}:${esc(t.port)}</span> 登录</div>`;
    const suggest = `root@${t.hostname}`;
    return `<div class="host-target warn">${icon('alert', 'i-sm')}<span>没有指定用户名，将以本机用户 <b class="mono">${esc(t.user)}</b> 登录 <span class="mono">${esc(t.hostname)}:${esc(t.port)}</span>。Linux 服务器一般用 root，用户名不对时密码再正确也会被拒绝。<button type="button" class="btn-link" data-use-host="${esc(suggest)}">改为 ${esc(suggest)}</button></span></div>`;
  }

  async function fixKeyPerms(host, port) {
    const r = await api('POST', '/api/ssh/key/fix-permissions', { host, port });
    toast(`已修复私钥权限：${r.files.map(basename).join('、')}`, 'ok');
    return r;
  }

  const keyPermsBtn = (attr) => `<button type="button" class="btn btn-xs" ${attr}>${icon('key', 'i-sm')}修复私钥权限</button>`;

  const IGNORE_PRESETS = ['node_modules', 'oh_modules', '.idea', '.vscode', 'target', 'build', 'dist', 'out', '__pycache__', '.venv', '*.log', '.DS_Store', '.gradle', 'logs', 'tmp'];
  /** Rules without a "/" match that name at any depth, so a template also covers a folder holding several projects. */
  const IGNORE_TEMPLATES = [
    {
      id: 'android', name: 'Android',
      desc: 'Android Studio / Gradle：构建产物、Gradle 和 Kotlin 缓存、IDE 配置、原生编译缓存，以及记录本机 SDK 路径的 local.properties',
      rules: ['build', '.gradle', '.kotlin', '.idea', '*.iml', 'local.properties', '.externalNativeBuild', '.cxx', 'captures', '.DS_Store'],
    },
    {
      id: 'harmony', name: 'HarmonyOS',
      desc: 'DevEco Studio / hvigor：ohpm 依赖、构建产物、hvigor 和预览器缓存、测试与分析输出、clangd 配置、自动生成的 BuildProfile.ets，以及记录本机 SDK 路径的 local.properties',
      rules: ['oh_modules', 'node_modules', 'build', '.hvigor', '.idea', 'local.properties', '.cxx', '.preview', '.test', '.appanalyzer', '/.clangd', '/.clang-format', '/.clang-tidy', '/.cache', 'BuildProfile.ets'],
    },
    {
      id: 'ios', name: 'iOS',
      desc: 'Xcode / CocoaPods / SwiftPM：构建产物、DerivedData、个人 Xcode 状态和 Pods 依赖',
      rules: ['build', 'DerivedData', 'xcuserdata', '*.xcuserstate', 'Pods', '.build', '.DS_Store'],
    },
    {
      id: 'flutter', name: 'Flutter',
      desc: 'Flutter / Dart：构建产物、.dart_tool、插件清单，以及 Android、iOS 子工程的依赖和本机配置',
      rules: ['build', '.dart_tool', '.flutter-plugins', '.flutter-plugins-dependencies', '.pub-cache', '.gradle', '.idea', '*.iml', 'local.properties', 'Pods', '.DS_Store'],
    },
    {
      id: 'node', name: '前端 / Node.js',
      desc: 'npm / pnpm / Vite / Next.js 等：依赖、打包产物、框架缓存、测试覆盖率和日志',
      rules: ['node_modules', 'dist', '.next', '.nuxt', '.turbo', '.cache', '.parcel-cache', 'coverage', '*.log'],
    },
    {
      id: 'java', name: 'Java',
      desc: 'Maven / Gradle / IntelliJ IDEA：编译输出、Gradle 缓存、IDE 配置、class 文件和运行日志',
      rules: ['target', 'build', '.gradle', 'out', '.idea', '*.iml', '*.class', 'logs'],
    },
    {
      id: 'python', name: 'Python',
      desc: 'Python：字节码缓存、虚拟环境、测试和类型检查缓存、打包元数据',
      rules: ['__pycache__', '*.pyc', '.venv', 'venv', '.pytest_cache', '.mypy_cache', '.ruff_cache', '*.egg-info', '.ipynb_checkpoints'],
    },
  ];
  const templateOn = (t, ignores) => t.rules.every((r) => ignores.includes(r));

  const LOCAL_HOST = '__local';
  const hostLabel = (v) => (v === LOCAL_HOST ? '本机目录' : v);

  function defaultSpec(hosts, cfg = {}) {
    const pinned = String(cfg.defaultHost || '');
    const last = localStorage.getItem('mp.lastHost');
    const host = pinned === LOCAL_HOST ? '' : pinned || (last != null ? last : firstServerHost(hosts));
    return {
      remote: { host, port: '', path: '' },
      local: { path: '' },
      direction: 'two-way',
      conflict: 'safe',
      mirror: false,
      ignores: [],
      ignoreVcs: false,
      symlinkMode: '',
      watchMode: '',
      scanMode: '',
      compression: '',
      extraArgs: '',
    };
  }

  const recentRemotes = () => { try { return JSON.parse(localStorage.getItem('mp.recentRemote') || '[]'); } catch { return []; } };
  function rememberRemote(host, p) {
    const list = recentRemotes().filter((x) => !(x.host === host && x.path === p));
    list.unshift({ host, path: p });
    localStorage.setItem('mp.recentRemote', JSON.stringify(list.slice(0, 30)));
  }
  const joinLocal = (root, name) => `${String(root).replace(/[\\/]+$/, '')}\\${name}`;
  const remoteBase = (p) => { const b = basename(String(p || '').trim()); return b === '~' || b === '.' ? '' : b; };

  /** template: an existing session whose host, direction and ignore rules seed a new session. */
  /** prefill: { host, port, path } of a server directory picked elsewhere, e.g. in the file manager. */
  async function openSessionForm(session, presetGroup, template, prefill) {
    const editing = !!session;
    const [hosts, cfg] = await Promise.all([getHosts(true), api('GET', '/api/config').catch(() => ({}))]);
    let spec;
    if (editing) spec = JSON.parse(JSON.stringify(session._panel.spec));
    else if (template) {
      spec = { ...defaultSpec(hosts, cfg), ...JSON.parse(JSON.stringify(template._panel.spec)) };
      spec.remote = { ...spec.remote, path: '' };
      spec.local = { path: '' };
    } else spec = defaultSpec(hosts, cfg);
    if (prefill) spec.remote = { ...spec.remote, host: prefill.host, port: prefill.port || '', path: prefill.path };
    let defaultHost = String(cfg.defaultHost || '');
    let localRoot = String(cfg.localRoot || '').trim() || localStorage.getItem('mp.lastLocalRoot') || '';
    let localRootFromConfig = !!String(cfg.localRoot || '').trim();
    let localAuto = !editing;
    const f = {
      title: editing ? session._panel.title : '',
      groupId: editing ? (session._panel.groupId || '') : (presetGroup && presetGroup !== NONE ? presetGroup : (ui.filterGroup !== 'all' && ui.filterGroup !== NONE ? ui.filterGroup : '')),
      newGroupName: '',
      paused: false,
      spec,
    };
    let titleTouched = editing;

    const groupOptions = `<option value="">未分组</option>${S.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}<option value="__new">+ 新建分组…</option>`;
    const choice = (attr, v, ic, t, d) => `<button type="button" class="choice" data-${attr}="${v}"><span class="t">${icon(ic, 'i-sm')}${t}</span><span class="d">${d}</span></button>`;
    const sel = (key, opts) => `<select class="input" data-f="${key}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;

    const html = `
      ${modalHead(editing ? '编辑同步会话' : (template ? '以此配置新建会话' : '新建同步会话'), editing ? esc(session._panel.title) : (template ? `沿用「${esc(template._panel.title)}」的服务器、同步方式和忽略规则` : '选好服务器目录，本地目录和名称会自动填好'), editing ? 'edit' : (template ? 'copyPlus' : 'plus'))}
      <div class="modal-body">
        <div class="form-error hidden" data-m="error"></div>
        <div class="form-section">
          <h4>${icon('server', 'i-sm')}服务器端 <span class="tag">mutagen 通过 SSH 免密登录访问</span></h4>
          <div class="form-grid">
            <div class="field">
              <label>SSH 主机</label>
              <div class="input-group"><input class="input mono" data-f="spec.remote.host" list="mp-host-list" placeholder="别名或 root@1.2.3.4" autocomplete="off"><input class="input mono" style="max-width:86px" data-f="spec.remote.port" placeholder="端口"></div>
              <datalist id="mp-host-list">${hosts.map((h) => `<option value="${esc(h.alias)}">${esc(h.user ? `${h.user}@` : '')}${esc(h.hostname)}</option>`).join('')}</datalist>
              <div class="host-suggest" data-m="hosts"></div>
              <div data-m="host-target"></div>
            </div>
            <div class="field">
              <label>连接检查</label>
              <div class="input-group"><button type="button" class="btn" data-m="test">${icon('zap', 'i-sm')}测试连接</button><button type="button" class="btn btn-ghost" data-m="wizard">${icon('key', 'i-sm')}配置免密</button></div>
              <div class="test-result" data-m="test-result"><span class="muted">别名来自 ~/.ssh/config，端口留空表示使用配置里的端口</span></div>
            </div>
            <div class="field full">
              <label>服务器目录</label>
              <div class="input-group"><input class="input mono" data-f="spec.remote.path" list="mp-remote-recent" placeholder="/data/project/xxx 或 ~/project" autocomplete="off"><datalist id="mp-remote-recent" data-m="recent"></datalist><button type="button" class="btn" data-m="browse-remote">${icon('folder', 'i-sm')}浏览</button></div>
              <div class="help">点「浏览」在服务器上选择，或输入路径（会提示最近用过的目录）。SSH 主机留空时，这里填本机的另一个目录。</div>
            </div>
          </div>
        </div>
        <div class="form-section">
          <h4>${icon('monitor', 'i-sm')}本地端</h4>
          <div class="field">
            <div class="input-group"><input class="input mono" data-f="spec.local.path" placeholder="E:\\sync\\project"><button type="button" class="btn" data-m="browse-local">${icon('folder', 'i-sm')}浏览</button></div>
            <div class="help" data-m="local-help"></div>
          </div>
        </div>
        <div class="form-section">
          <h4>${icon('tag', 'i-sm')}名称与分组 <span class="tag">名称默认取目录名</span></h4>
          <div class="form-grid">
            <div class="field"><label>会话名称</label><input class="input" data-f="title" placeholder="默认使用目录名" maxlength="60"></div>
            <div class="field"><label>分组</label><select class="input" data-f="groupId">${groupOptions}</select><input class="input hidden" data-f="newGroupName" placeholder="新分组名称，例如：微服务开发平台"></div>
          </div>
        </div>
        <div class="form-section">
          <h4>${icon('swap', 'i-sm')}同步方式</h4>
          <div class="sub-label">同步方向</div>
          <div class="choice-grid" data-m="direction">
            ${choice('dir', 'two-way', 'swap', '双向同步', '两端任意一边改动都会同步到另一边，适合边在服务器上改、边在本地看或改。')}
            ${choice('dir', 'to-local', 'download', '服务器 → 本地', '只把服务器的改动拉到本地；本地的改动不会上传。')}
            ${choice('dir', 'to-remote', 'upload', '本地 → 服务器', '只把本地的改动推到服务器；服务器的改动不会下载。')}
          </div>
          <div data-m="conflict" style="margin-top:14px">
            <div class="sub-label">两边改了同一个文件时</div>
            <div class="choice-grid">
              ${choice('conf', 'safe', 'shield', '安全模式', '两边同时改了同一个文件时不覆盖，标记为冲突，在面板里手动选择保留哪边。')}
              ${choice('conf', 'remote', 'server', '服务器优先', '冲突时自动以服务器版本为准，本地的冲突改动会被覆盖。')}
              ${choice('conf', 'local', 'monitor', '本地优先', '冲突时自动以本地版本为准，服务器的冲突改动会被覆盖。')}
            </div>
          </div>
          <label class="check" data-m="mirror" style="margin-top:12px"><input type="checkbox" data-f="spec.mirror">镜像模式：目标端多出来的文件也会被删除，保持与源端完全一致</label>
        </div>
        <div class="form-section">
          <h4>${icon('filter', 'i-sm')}忽略规则 <span class="tag">匹配的文件或目录不参与同步，写法类似 .gitignore</span></h4>
          <div class="presets tpls" data-m="templates"></div>
          <div class="presets" data-m="presets"></div>
          <div class="tags-input" data-m="tags"><input data-m="tag-input" placeholder="输入后回车添加，例如 node_modules 或 *.log"></div>
          <label class="check" style="margin-top:12px"><input type="checkbox" data-f="spec.ignoreVcs">忽略版本库目录（.git、.svn 等）。<span class="muted">想在本地 IDE 看 Git 变化就不要勾选</span></label>
        </div>
        <details class="adv form-section">
          <summary><span class="chev">${icon('chevronDown', 'i-sm')}</span>高级选项</summary>
          <div class="form-grid">
            <div class="field"><label>符号链接</label>${sel('spec.symlinkMode', [['', '默认（portable）'], ['portable', 'portable：跨平台安全'], ['ignore', 'ignore：忽略符号链接'], ['posix-raw', 'posix-raw：原样同步（仅类 Unix）']])}</div>
            <div class="field"><label>文件监视</label>${sel('spec.watchMode', [['', '默认（portable）'], ['portable', 'portable：系统原生监视'], ['force-poll', 'force-poll：强制轮询'], ['no-watch', 'no-watch：不监视，仅手动同步']])}</div>
            <div class="field"><label>扫描方式</label>${sel('spec.scanMode', [['', '默认（accelerated）'], ['accelerated', 'accelerated：加速扫描'], ['full', 'full：每次完整扫描']])}</div>
            <div class="field"><label>传输压缩</label>${sel('spec.compression', [['', '默认'], ['zstandard', 'zstandard：高压缩比'], ['deflate', 'deflate'], ['none', 'none：不压缩']])}</div>
            <div class="field full"><label>额外参数 <span class="muted">原样追加到 mutagen sync create</span></label><input class="input mono" data-f="spec.extraArgs" placeholder="例如 --max-staging-file-size 500MB --permissions-mode manual"></div>
          </div>
        </details>
        <div class="form-section preview">
          <h4>${icon('terminal', 'i-sm')}等效命令</h4>
          <div class="code-wrap"><pre class="code-block" data-m="preview">填写服务器目录和本地目录后显示</pre><button type="button" class="btn btn-xs copy-btn" data-m="copy-preview">${icon('copy', 'i-sm')}复制</button></div>
        </div>
      </div>
      <div class="modal-foot">
        ${editing ? '<span class="note">修改同步配置会重建会话，两端文件都不会被删除</span>' : '<label class="check note"><input type="checkbox" data-f="paused">创建后先暂停</label>'}
        <span class="kbd-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
        <button class="btn" data-close>取消</button>
        <button class="btn btn-primary" data-m="submit" title="Ctrl+Enter">${icon('check', 'i-sm')}${editing ? '保存' : '创建并开始同步'}</button>
      </div>`;

    openLayer({
      size: 'lg',
      persistent: true,
      html,
      mount(panel, layer) {
        const q = (m) => panel.querySelector(`[data-m="${m}"]`);
        const body = panel.querySelector('.modal-body');
        const keep = document.createElement('div');
        q('preview').closest('.form-section').appendChild(keep);
        /** Content that shrinks while scrolled to the bottom would clamp scrollTop and shift everything under the pointer. */
        function holdScroll(top) {
          const deficit = Math.max(0, top - (body.scrollHeight - keep.offsetHeight - body.clientHeight));
          if (deficit !== keep.offsetHeight) keep.style.height = `${deficit}px`;
          if (body.scrollTop !== top) body.scrollTop = top;
        }
        const fields = $$('[data-f]', panel);
        fields.forEach((el) => {
          const val = getPath(f, el.dataset.f);
          if (el.type === 'checkbox') el.checked = !!val;
          else el.value = val ?? '';
        });

        const setPreview = (s) => {
          const top = body.scrollTop;
          q('preview').textContent = s;
          holdScroll(top);
        };
        const preview = debounce(async () => {
          if (!f.spec.remote.path || !f.spec.local.path) {
            setPreview('填写服务器目录和本地目录后显示');
            return;
          }
          try {
            const r = await api('POST', '/api/sessions/preview', { spec: f.spec, title: effectiveTitle() });
            setPreview(r.command);
          } catch (err) {
            setPreview(`# ${err.message}`);
          }
        }, 250);

        const effectiveTitle = () => f.title.trim() || basename(f.spec.remote.path) || basename(f.spec.local.path) || '';

        function refresh() {
          const top = body.scrollTop;
          const d = f.spec.direction;
          $$('[data-dir]', panel).forEach((b) => b.classList.toggle('active', b.dataset.dir === d));
          $$('[data-conf]', panel).forEach((b) => b.classList.toggle('active', b.dataset.conf === f.spec.conflict));
          q('conflict').classList.toggle('hidden', d !== 'two-way');
          q('mirror').classList.toggle('hidden', d === 'two-way');
          panel.querySelector('[data-f="newGroupName"]').classList.toggle('hidden', f.groupId !== '__new');
          const star = (v) => `<span class="star ${defaultHost === v ? 'on' : ''}" data-default-host="${esc(v)}" title="${defaultHost === v ? '当前默认，点击取消' : '设为新建会话的默认主机'}">${icon('star', 'i-sm')}</span>`;
          q('hosts').innerHTML = hosts.length
            ? hosts.map((h) => `<button type="button" class="${h.alias === f.spec.remote.host ? 'active' : ''}" data-host="${esc(h.alias)}" title="${esc(`${h.user ? `${h.user}@` : ''}${h.hostname}${h.port ? `:${h.port}` : ''}`)}">${icon('server', 'i-sm')}${esc(h.alias)}${star(h.alias)}</button>`).join('')
              + `<button type="button" class="${!f.spec.remote.host ? 'active' : ''}" data-host="" title="在两个本机目录之间同步">本机目录${star(LOCAL_HOST)}</button>`
            : '<span class="help">~/.ssh/config 中没有主机，可以直接填 root@IP，或点「配置免密」添加</span>';
          const tagsBox = q('tags');
          $$('.tag-item', tagsBox).forEach((x) => x.remove());
          const input = q('tag-input');
          f.spec.ignores.forEach((ig, i) => {
            const t = document.createElement('span');
            t.className = 'tag-item';
            t.innerHTML = `${esc(ig)}<button type="button" data-rm="${i}" title="移除">${icon('x', 'i-sm')}</button>`;
            tagsBox.insertBefore(t, input);
          });
          q('templates').innerHTML = `<span class="help">项目类型：</span>${IGNORE_TEMPLATES.map((t) => {
            const on = templateOn(t, f.spec.ignores);
            const missing = t.rules.filter((r) => !f.spec.ignores.includes(r)).length;
            const tip = `${t.desc}\n\n${on ? '已全部添加，再点一次移除' : `点击添加 ${missing} 条规则`}：\n${t.rules.join('  ')}`;
            return `<button type="button" class="preset tpl ${on ? 'on' : ''}" data-tpl="${t.id}" title="${esc(tip)}">${esc(t.name)}<span class="n">${t.rules.length}</span></button>`;
          }).join('')}`;
          q('presets').innerHTML = `<span class="help">常用：</span>${IGNORE_PRESETS.map((p) => `<button type="button" class="preset ${f.spec.ignores.includes(p) ? 'on' : ''}" data-preset="${esc(p)}">${esc(p)}</button>`).join('')}`;
          panel.querySelector('[data-f="title"]').placeholder = effectiveTitle() ? `默认：${effectiveTitle()}` : '默认使用目录名';
          updateTarget();
          q('recent').innerHTML = recentRemotes().filter((x) => x.host === f.spec.remote.host).map((x) => `<option value="${esc(x.path)}"></option>`).join('');
          const localInput = panel.querySelector('[data-f="spec.local.path"]');
          localInput.classList.toggle('auto', localAuto && !!f.spec.local.path);
          const rootLink = '<button type="button" class="btn-link" data-m="settings">设置</button>';
          q('local-help').innerHTML = !localRoot
            ? `目录不存在时会自动创建。在${rootLink}里设定「默认本地根目录」后，选好服务器目录这里会自动填写。`
            : localAuto
              ? `按服务器目录自动生成：<span class="mono">${esc(localRoot)}</span>\\目录名${localRootFromConfig ? '' : '（沿用上次的位置）'}。可直接修改，或在${rootLink}里换根目录。`
              : `目录不存在时会自动创建（包括上级目录）。<button type="button" class="btn-link" data-m="auto-local">按服务器目录自动填写</button>`;
          preview();
          holdScroll(top);
        }

        const updateTarget = debounce(async () => {
          const h = f.spec.remote.host;
          const p = f.spec.remote.port;
          const t = await resolveHost(h, p);
          if (h === f.spec.remote.host && p === f.spec.remote.port) q('host-target').innerHTML = hostTargetHtml(t);
        }, 300);

        function autoLocal() {
          if (!localAuto) return;
          const b = remoteBase(f.spec.remote.path);
          setField('spec.local.path', b && localRoot ? joinLocal(localRoot, b) : '');
        }

        panel.addEventListener('keydown', (e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
        });

        panel.addEventListener('input', (e) => {
          const el = e.target.closest('[data-f]');
          if (!el) return;
          setPath(f, el.dataset.f, el.type === 'checkbox' ? el.checked : el.value);
          if (el.dataset.f === 'title') titleTouched = !!el.value;
          if (el.dataset.f === 'spec.remote.host') q('test-result').innerHTML = '';
          if (el.dataset.f === 'spec.remote.path') autoLocal();
          if (el.dataset.f === 'spec.local.path') localAuto = !el.value.trim();
          refresh();
        });
        panel.addEventListener('change', (e) => {
          const el = e.target.closest('[data-f]');
          if (!el) return;
          setPath(f, el.dataset.f, el.type === 'checkbox' ? el.checked : el.value);
          refresh();
          if (el.dataset.f === 'groupId' && el.value === '__new') panel.querySelector('[data-f="newGroupName"]').focus();
        });

        const addTag = (val) => {
          val.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!f.spec.ignores.includes(x)) f.spec.ignores.push(x); });
          refresh();
        };
        q('tag-input').addEventListener('keydown', (e) => {
          if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
            e.preventDefault();
            addTag(e.target.value);
            e.target.value = '';
          } else if (e.key === 'Backspace' && !e.target.value && f.spec.ignores.length) {
            f.spec.ignores.pop();
            refresh();
          }
        });
        q('tag-input').addEventListener('blur', (e) => { if (e.target.value.trim()) { addTag(e.target.value); e.target.value = ''; } });

        const setField = (key, val) => {
          setPath(f, key, val);
          const el = panel.querySelector(`[data-f="${key}"]`);
          if (el) el.value = val;
        };

        panel.addEventListener('click', async (e) => {
          const dir = e.target.closest('[data-dir]');
          if (dir) { f.spec.direction = dir.dataset.dir; refresh(); return; }
          const conf = e.target.closest('[data-conf]');
          if (conf) { f.spec.conflict = conf.dataset.conf; refresh(); return; }
          const sh = e.target.closest('[data-default-host]');
          if (sh) {
            const v = sh.dataset.defaultHost;
            const next = defaultHost === v ? '' : v;
            try {
              await api('PUT', '/api/config/default-host', { defaultHost: next });
              defaultHost = next;
              toast(next ? `新建会话将默认选中「${hostLabel(next)}」` : '已取消默认主机，新建会话沿用上次使用的主机', 'ok');
              refresh();
            } catch (err) { toast(err.message, 'error'); }
            return;
          }
          const use = e.target.closest('[data-use-host]');
          if (use) {
            setField('spec.remote.host', use.dataset.useHost);
            q('test-result').innerHTML = '';
            refresh();
            return;
          }
          const h = e.target.closest('[data-host]');
          if (h) {
            setField('spec.remote.host', h.dataset.host);
            setField('spec.remote.port', '');
            q('test-result').innerHTML = '';
            refresh();
            return;
          }
          const rm = e.target.closest('[data-rm]');
          if (rm) { f.spec.ignores.splice(Number(rm.dataset.rm), 1); refresh(); return; }
          const tpl = e.target.closest('[data-tpl]');
          if (tpl) {
            const t = IGNORE_TEMPLATES.find((x) => x.id === tpl.dataset.tpl);
            if (templateOn(t, f.spec.ignores)) {
              const shared = new Set(IGNORE_TEMPLATES.filter((x) => x !== t && templateOn(x, f.spec.ignores)).flatMap((x) => x.rules));
              f.spec.ignores = f.spec.ignores.filter((r) => shared.has(r) || !t.rules.includes(r));
            } else {
              f.spec.ignores = [...f.spec.ignores, ...t.rules.filter((r) => !f.spec.ignores.includes(r))];
            }
            refresh();
            return;
          }
          const pr = e.target.closest('[data-preset]');
          if (pr) {
            const p = pr.dataset.preset;
            f.spec.ignores = f.spec.ignores.includes(p) ? f.spec.ignores.filter((x) => x !== p) : [...f.spec.ignores, p];
            refresh();
            return;
          }
          const m = e.target.closest('[data-m]');
          if (!m) return;
          switch (m.dataset.m) {
            case 'tags': q('tag-input').focus(); break;
            case 'copy-preview': copyText(q('preview').textContent, '命令已复制'); break;
            case 'wizard': openSshWizard({ host: f.spec.remote.host, port: f.spec.remote.port }); break;
            case 'test': testConn(); break;
            case 'fix-perms':
              m.disabled = true;
              try {
                await fixKeyPerms(f.spec.remote.host, f.spec.remote.port);
                q('error').classList.add('hidden');
                testConn();
              } catch (err) { toast(err.message, 'error'); m.disabled = false; }
              break;
            case 'browse-remote': {
              const picked = await openDirBrowser(f.spec.remote.host
                ? { kind: 'remote', host: f.spec.remote.host, port: f.spec.remote.port, start: f.spec.remote.path || '~' }
                : { kind: 'local', start: f.spec.remote.path });
              if (picked) {
                setField('spec.remote.path', picked);
                autoLocal();
                refresh();
              }
              break;
            }
            case 'browse-local': {
              const picked = await openDirBrowser({ kind: 'local', start: f.spec.local.path || localRoot || '' });
              if (picked) { localAuto = false; setField('spec.local.path', picked); refresh(); }
              break;
            }
            case 'auto-local': localAuto = true; autoLocal(); refresh(); break;
            case 'settings': {
              const saved = await openSettings();
              if (saved && String(saved.localRoot || '').trim()) {
                localRoot = saved.localRoot.trim();
                localRootFromConfig = true;
                autoLocal();
              }
              refresh();
              break;
            }
            case 'submit': submit(); break;
            default:
          }
        });

        async function testConn() {
          const box = q('test-result');
          if (!f.spec.remote.host) { box.className = 'test-result'; box.innerHTML = '<span class="muted">未填写 SSH 主机，将在本机目录之间同步</span>'; return; }
          box.className = 'test-result busy';
          box.innerHTML = '<span class="spinner" style="width:12px;height:12px;border-width:2px"></span>正在连接…';
          try {
            const r = await api('POST', '/api/ssh/test', { host: f.spec.remote.host, port: f.spec.remote.port });
            if (r.ok) {
              box.className = 'test-result ok';
              box.innerHTML = `${icon('checkCircle', 'i-sm')}免密登录正常 · ${esc(r.user)} · ${esc(r.system)} · ${r.ms} ms`;
            } else {
              box.className = 'test-result err';
              box.innerHTML = `${icon('alert', 'i-sm')}${esc(r.message)}${r.code === 'SSH_KEY_PERMS' ? ` ${keyPermsBtn('data-m="fix-perms"')}` : ''}${isAuthErr(r.code) ? ' <button type="button" class="btn-link" data-m="wizard">去配置</button>' : ''}`;
            }
          } catch (err) {
            box.className = 'test-result err';
            box.innerHTML = `${icon('alert', 'i-sm')}${esc(err.message)}`;
          }
        }

        async function submit() {
          const errBox = q('error');
          const showError = (err) => {
            errBox.classList.remove('hidden');
            errBox.innerHTML = `${icon('alert')}<div class="msg">${esc(err.message)}</div>${err.code === 'SSH_KEY_PERMS' ? keyPermsBtn('data-m="fix-perms"') : ''}${isAuthErr(err.code) ? '<button type="button" class="btn btn-xs" data-m="wizard">配置免密登录</button>' : ''}`;
            panel.querySelector('.modal-body').scrollTop = 0;
          };
          errBox.classList.add('hidden');
          if (!f.spec.remote.path.trim()) return showError(new Error('请填写服务器目录'));
          if (!f.spec.local.path.trim()) return showError(new Error('请填写本地目录'));
          if (f.groupId === '__new' && !f.newGroupName.trim()) return showError(new Error('请填写新分组名称'));
          const btn = q('submit');
          btn.disabled = true;
          btn.classList.add('loading');
          const slow = setTimeout(() => {
            errBox.classList.remove('hidden');
            errBox.className = 'notice';
            errBox.innerHTML = `${icon('info')}<div>正在连接服务器并启动同步…首次连接某台服务器时，mutagen 需要上传 agent（约 10 MB），可能需要几十秒到一两分钟。</div>`;
          }, 2500);
          try {
            const body = {
              title: effectiveTitle(),
              groupId: f.groupId === '__new' ? '' : f.groupId,
              newGroupName: f.groupId === '__new' ? f.newGroupName : '',
              paused: f.paused,
              spec: f.spec,
            };
            if (editing) await api('PUT', `/api/sessions/${session.identifier}`, body);
            else await api('POST', '/api/sessions', body);
            localStorage.setItem('mp.lastHost', f.spec.remote.host);
            rememberRemote(f.spec.remote.host, f.spec.remote.path.trim());
            const root = f.spec.local.path.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]+$/, '');
            if (root && /[\\/]/.test(f.spec.local.path)) localStorage.setItem('mp.lastLocalRoot', root);
            toast(editing ? '会话已保存' : `已创建「${body.title}」，开始同步`, 'ok');
            layer.close();
          } catch (err) {
            errBox.className = 'form-error';
            showError(err);
          } finally {
            clearTimeout(slow);
            btn.disabled = false;
            btn.classList.remove('loading');
          }
          return undefined;
        }

        if (prefill) autoLocal();
        refresh();
        // preventScroll: a plain focus() here would yank the body back to the top if the user already scrolled down.
        setTimeout(() => panel.querySelector(editing || prefill ? '[data-f="title"]' : '[data-f="spec.remote.path"]').focus({ preventScroll: true }), 80);
        if (template) toast('已复制主机、同步方式和忽略规则，选择新的服务器目录即可', 'info', { duration: 2600 });
        void titleTouched;
      },
    });
  }

  // ------------------------------------------------------------ directory browser
  function openDirBrowser({ kind, host, port, start }) {
    return new Promise((resolve) => {
      let chosen = null;
      let current = null;
      const remote = kind === 'remote';
      openLayer({
        size: 'md',
        html: `${modalHead(remote ? `选择服务器目录 · ${host}` : '选择本地目录', remote ? '通过 SSH 读取目录列表' : '', remote ? 'server' : 'folder')}
          <div class="modal-body">
            <div class="browser-bar">
              <button class="btn btn-icon" data-m="up" title="上一级">${icon('up')}</button>
              <input class="input mono" data-m="path" placeholder="${remote ? '/ 或 ~' : 'D:\\'}" spellcheck="false">
              <button class="btn btn-icon" data-m="reload" title="刷新">${icon('refresh')}</button>
              <button class="btn btn-icon" data-m="mkdir" title="新建文件夹">${icon('folderPlus')}</button>
            </div>
            <div class="browser-list" data-m="list"></div>
          </div>
          <div class="modal-foot"><span class="note" data-m="info"></span><button class="btn" data-close>取消</button><button class="btn btn-primary" data-m="choose">${icon('check', 'i-sm')}选择当前目录</button></div>`,
        onClose: () => resolve(chosen),
        mount(panel, layer) {
          const q = (m) => panel.querySelector(`[data-m="${m}"]`);
          const list = q('list');
          const fetchDir = (p) => (remote
            ? api('GET', `/api/ssh/ls?${new URLSearchParams({ host, port: port || '', path: p })}`)
            : api('GET', `/api/fs/ls?${new URLSearchParams({ path: p || '' })}`));
          const pad = (depth) => `style="padding-left:${12 + depth * 20}px"`;
          /** Folders can be expanded in place and picked; files are listed for context only. */
          function entriesHtml(r, depth, fileLimit) {
            const fileNames = r.fileNames || [];
            const shownFiles = fileNames.slice(0, fileLimit);
            const rows = [
              ...r.dirs.map((d) => `<div class="tree-node"><button class="dir-item" data-path="${esc(d.path)}" title="${esc(d.path)}" ${pad(depth)}><span class="twisty" data-toggle title="展开 / 收起">${icon('chevronRight', 'i-sm')}</span>${icon('folder')}<span class="name">${esc(d.name)}</span><span class="btn btn-xs pick" data-pick="${esc(d.path)}">选择</span><span class="go" title="进入">${icon('chevronRight', 'i-sm')}</span></button><div class="tree-children"></div></div>`),
              ...shownFiles.map((n) => `<div class="file-item" title="${esc(n)}（文件不能选择）" ${pad(depth)}><span class="twisty-gap"></span>${icon('file')}<span class="name">${esc(n)}</span></div>`),
            ];
            if (fileNames.length > shownFiles.length) rows.push(`<div class="file-item more" ${pad(depth)}>还有 ${fileNames.length - shownFiles.length} 个文件未列出</div>`);
            return rows.join('');
          }
          async function toggle(node) {
            const box = node.querySelector(':scope > .tree-children');
            if (node.classList.toggle('open') === false) return;
            if (box.dataset.loaded) return;
            const depth = Number(node.parentElement.closest('.tree-node')?.dataset.depth ?? -1) + 1;
            node.dataset.depth = String(depth);
            box.innerHTML = `<div class="file-item" ${pad(depth + 1)}><span class="spinner" style="width:12px;height:12px;border-width:2px"></span>正在读取…</div>`;
            try {
              const r = await fetchDir(node.querySelector(':scope > .dir-item').dataset.path);
              box.innerHTML = entriesHtml(r, depth + 1, 200) || `<div class="file-item" ${pad(depth + 1)}><span class="twisty-gap"></span>空文件夹</div>`;
              box.dataset.loaded = '1';
            } catch (err) {
              box.innerHTML = `<div class="file-item err" ${pad(depth + 1)}><span class="twisty-gap"></span>${icon('alert', 'i-sm')}<span class="name">${esc(err.message)}</span></div>`;
            }
          }
          async function load(p) {
            list.innerHTML = '<div class="browser-state"><span class="spinner"></span>正在读取…</div>';
            try {
              const r = await fetchDir(p);
              current = r;
              q('path').value = r.path;
              q('up').disabled = r.parent == null || (r.parent === '' && remote);
              q('choose').disabled = !r.path;
              q('info').textContent = r.file ? `已定位到文件「${r.file}」所在的文件夹，选择当前目录即可` : r.path ? `${r.dirs.length} 个文件夹 · ${r.files} 个文件 · 点箭头展开，只能选择文件夹` : '选择一个磁盘';
              list.innerHTML = entriesHtml(r, 0, BROWSER_FILE_LIMIT) || '<div class="browser-state">这个目录是空的</div>';
              if (r.file) {
                const hit = $$('.file-item', list).find((el) => el.querySelector('.name')?.textContent === r.file);
                if (hit) { hit.classList.add('hit'); list.scrollTop = Math.max(0, hit.offsetTop - list.clientHeight / 3); }
              }
            } catch (err) {
              list.innerHTML = `<div class="browser-state err">${icon('alert', 'i-lg')}<div>${esc(err.message)}</div>${err.code === 'SSH_KEY_PERMS' ? '<button class="btn btn-sm" data-m="fix-perms">修复私钥权限</button>' : ''}${isAuthErr(err.code) ? '<button class="btn btn-sm" data-m="wizard">配置免密登录</button>' : ''}${current ? '<button class="btn btn-sm" data-m="back">返回上一个目录</button>' : ''}</div>`;
            }
          }
          panel.addEventListener('click', async (e) => {
            const pick = e.target.closest('[data-pick]');
            if (pick) { chosen = pick.dataset.pick; layer.close(); return; }
            const tw = e.target.closest('[data-toggle]');
            if (tw) { toggle(tw.closest('.tree-node')); return; }
            const item = e.target.closest('.dir-item');
            if (item) { load(item.dataset.path); return; }
            const m = e.target.closest('[data-m]');
            if (!m) return;
            if (m.dataset.m === 'up' && current) load(current.parent ?? '');
            if (m.dataset.m === 'reload') load(cleanPath(q('path').value));
            if (m.dataset.m === 'back' && current) load(current.path);
            if (m.dataset.m === 'wizard') openSshWizard({ host, port });
            if (m.dataset.m === 'fix-perms') {
              m.disabled = true;
              try { await fixKeyPerms(host, port); load(q('path').value.trim() || start); } catch (err) { toast(err.message, 'error'); m.disabled = false; }
            }
            if (m.dataset.m === 'choose' && current && current.path) { chosen = current.path; layer.close(); }
            if (m.dataset.m === 'mkdir' && current && current.path) {
              let made = null;
              await promptDialog({
                title: '新建文件夹', ic: 'folderPlus', okText: '新建', label: `在 ${current.path} 下新建`, placeholder: '文件夹名称',
                help: remote ? `将在服务器 ${host} 上创建` : '',
                submit: async (name) => {
                  made = remote
                    ? await api('POST', '/api/remote/mkdir', { host, port: port || '', path: current.path, name })
                    : await api('POST', '/api/fs/mkdir', { path: `${current.path.replace(/[\\/]+$/, '')}\\${name}` });
                },
              });
              if (made) load(made.path);
            }
          });
          list.addEventListener('dblclick', (e) => {
            if (e.target.closest('[data-toggle]')) return;
            const item = e.target.closest('.dir-item');
            if (item) { chosen = item.dataset.path; layer.close(); }
          });
          q('path').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.target.value = cleanPath(e.target.value); load(e.target.value); } });
          load(start || (remote ? '~' : ''));
        },
      });
    });
  }

  // ------------------------------------------------------------ remote file manager
  const FM_BINARY_EXT = /\.(png|jpe?g|gif|webp|bmp|ico|icns|tiff?|psd|mp[34]|m4a|wav|flac|ogg|avi|mkv|mov|webm|zip|gz|tgz|bz2|xz|zst|7z|rar|tar|jar|war|ear|class|so|o|a|dll|exe|bin|iso|img|pdf|docx?|xlsx?|pptx?|woff2?|ttf|otf|eot|pyc|db|sqlite3?|deb|rpm)$/i;
  const FM_PREVIEW_CACHE = 40;
  const isDirLike = (e) => e.type === 'dir' || (e.type === 'link' && e.targetType === 'dir');
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmDate = (ms, sec = false) => {
    if (!ms) return '—';
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}${sec ? `:${pad2(d.getSeconds())}` : ''}`;
  };
  const permStr = (mode, e) => {
    const n = parseInt(mode, 8);
    if (Number.isNaN(n)) return '';
    let s = e.type === 'dir' ? 'd' : e.type === 'link' ? 'l' : '-';
    for (const sh of [6, 3, 0]) { const b = (n >> sh) & 7; s += `${b & 4 ? 'r' : '-'}${b & 2 ? 'w' : '-'}${b & 1 ? 'x' : '-'}`; }
    return s;
  };
  const posixQuote = (p) => (/^[\w@%+=:,./~-]+$/.test(p) ? p : `'${String(p).replace(/'/g, `'\\''`)}'`);
  const parentOf = (p) => (p === '/' ? null : (p.replace(/\/[^/]*$/, '') || '/'));
  /** '/a/b' -> ['/', '/a', '/a/b'] */
  const chainOf = (p) => { const out = []; for (let c = p; c; c = parentOf(c)) out.unshift(c); return out; };
  const joinPosix = (dir, name) => (dir === '/' ? `/${name}` : `${dir}/${name}`);
  const nameOf = (p) => (p === '/' ? '/' : p.slice(p.lastIndexOf('/') + 1));
  const typeName = (e) => (e.type === 'dir' ? '文件夹' : e.type === 'file' ? '文件' : e.type === 'link'
    ? `符号链接（指向${e.targetType === 'dir' ? '文件夹' : e.targetType === 'file' ? '文件' : e.targetType === 'broken' ? '不存在的目标' : '特殊文件'}）` : '特殊文件');
  const fmPrefs = () => Object.assign({ hidden: true, sort: 'name', desc: false, wide: false }, JSON.parse(localStorage.getItem('mp.fm') || '{}'));
  const fmLast = () => { try { return JSON.parse(localStorage.getItem('mp.fm.last') || '{}'); } catch { return {}; } };

  let fmMenu = null;
  pop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-fm]');
    if (!b || !fmMenu) return;
    e.stopPropagation();
    const fn = fmMenu;
    closePopover();
    fn(b.dataset.fm);
  });

  async function openFileManager(opts = {}) {
    const hosts = await getHosts();
    const host = opts.host || srv.host || firstServerHost(hosts);
    if (!host) {
      toast('还没有可用的服务器，先在 SSH 免密登录向导里添加一台', 'warn', { action: { label: '打开向导', run: () => openSshWizard() } });
      return;
    }
    const prefs = fmPrefs();
    const savePrefs = () => localStorage.setItem('mp.fm', JSON.stringify(prefs));
    const st = {
      host, port: opts.port || '', path: '', home: '', entries: [], view: [], meta: null, loaded: false,
      loading: false, error: null, sel: new Set(), anchor: -1, cursor: -1, filter: '',
      back: [], fwd: [], tree: new Map(), open: new Set(['/']), treeLoading: new Set(),
      preview: null, previews: new Map(), editing: false, req: 0,
    };
    const hostOptions = () => {
      const list = hosts.filter((h) => !isGitHost(h)).map((h) => h.alias);
      if (!list.includes(st.host)) list.unshift(st.host);
      return list.map((a) => `<option value="${esc(a)}" ${a === st.host ? 'selected' : ''}>${esc(a)}</option>`).join('');
    };

    openLayer({
      size: 'fm',
      onClose: () => { fmMenu = null; },
      html: `
        <div class="modal-head fm-top">
          <span class="head-icon tone-primary">${icon('tree')}</span>
          <div class="fm-title"><h3>服务器文件</h3><div class="sub" data-q="conn"></div></div>
          <label class="fm-host" title="切换服务器">${icon('server', 'i-sm')}<select data-q="host">${hostOptions()}</select></label>
          <button class="btn btn-ghost btn-icon btn-sm" data-close title="关闭 (Esc)">${icon('x')}</button>
        </div>
        <div class="fm-bar">
          <div class="fm-nav">
            <button class="btn btn-icon btn-sm" data-c="back" title="后退 (Alt+←)">${icon('arrowLeft', 'i-sm')}</button>
            <button class="btn btn-icon btn-sm" data-c="fwd" title="前进 (Alt+→)">${icon('arrowRight', 'i-sm')}</button>
            <button class="btn btn-icon btn-sm" data-c="up" title="上一级 (Backspace)">${icon('up', 'i-sm')}</button>
            <button class="btn btn-icon btn-sm" data-c="reload" title="刷新 (F5)">${icon('refresh', 'i-sm')}</button>
          </div>
          <div class="fm-crumbs" data-q="crumbs" title="点击空白处直接输入路径 (Ctrl+L)"></div>
          <input class="input mono fm-path hidden" data-q="path" spellcheck="false" autocomplete="off" placeholder="/ 或 ~/project，回车跳转">
          <button class="btn btn-sm" data-c="mkdir" title="在当前目录新建文件夹">${icon('folderPlus', 'i-sm')}新建文件夹</button>
          <button class="btn btn-sm" data-c="copy-cwd" title="复制当前目录的完整路径">${icon('copy', 'i-sm')}复制路径</button>
          <label class="fm-filter">${icon('search', 'i-sm')}<input data-q="filter" placeholder="筛选当前目录" spellcheck="false" autocomplete="off"><kbd>/</kbd></label>
          <button class="btn btn-sm fm-toggle" data-c="hidden" data-q="hidden" title="是否显示以 . 开头的文件和目录">${icon('eye', 'i-sm')}显示隐藏文件</button>
        </div>
        <div class="fm-body ${prefs.wide ? 'wide' : ''}" data-q="body">
          <aside class="fm-side" data-q="side"></aside>
          <section class="fm-main">
            <div class="fm-cols" data-q="cols"></div>
            <div class="fm-list" tabindex="0" data-q="list"></div>
          </section>
          <aside class="fm-detail" data-q="detail"></aside>
        </div>
        <div class="fm-foot" data-q="foot"></div>`,
      mount(panel) {
        const q = (k) => panel.querySelector(`[data-q="${k}"]`);
        const list = q('list');
        const side = q('side');
        const params = (extra) => new URLSearchParams({ host: st.host, port: st.port, ...extra });
        const fetchLs = (p, anc) => api('GET', `/api/remote/ls?${params({ path: p, ancestors: anc ? '1' : '' })}`);
        const dirNames = (entries) => entries.filter(isDirLike).map((e) => e.name).sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
        const visible = (name) => prefs.hidden || !name.startsWith('.');
        const resolveHome = (p) => String(p || '').replace(/^~(?=\/|$)/, st.home || '~');
        const syncRoots = () => viewsOnHost(st.host).map((v) => ({ v, title: v.title, root: resolveHome(v.remote.path).replace(/(.)\/+$/, '$1'), local: v.local.isLocal ? v.local.path : '' }));
        function localFor(p) {
          for (const m of syncRoots()) {
            if (!m.local || !(p === m.root || p.startsWith(m.root === '/' ? '/' : `${m.root}/`))) continue;
            const rel = p.slice(m.root.length).replace(/^\/+/, '');
            return { title: m.title, path: rel ? `${m.local.replace(/[\\/]+$/, '')}\\${rel.replace(/\//g, '\\')}` : m.local };
          }
          return null;
        }
        const cwdEntry = () => ({ name: nameOf(st.path), path: st.path, type: 'dir', targetType: null, size: null, mtime: null, mode: '', user: '', group: '', link: '', cwd: true });
        const selected = () => st.view.filter((e) => st.sel.has(e.path));
        const targets = () => { const s = selected(); return s.length ? s : (st.path ? [cwdEntry()] : []); };

        // ---------------------------------------------------- loading
        async function go(p, { push = true, select = null } = {}) {
          const target = String(p || '').trim() || '~';
          const needAnc = !target.startsWith('/') || chainOf(target).slice(0, -1).some((a) => !st.tree.has(a));
          const req = ++st.req;
          st.loading = true;
          drawChrome();
          try {
            const r = await fetchLs(target, needAnc);
            if (req !== st.req) return;
            if (push && st.path && st.path !== r.path) { st.back.push(st.path); st.fwd = []; }
            st.path = r.path;
            st.home = r.home || st.home;
            st.entries = r.entries;
            st.meta = { ms: r.ms, truncated: r.truncated, simple: r.simple };
            st.disk = r.disk || null;
            syncServerDisk(st.host, st.disk);
            st.loaded = true;
            st.error = null;
            st.tree.set(r.path, dirNames(r.entries));
            (r.ancestors || []).forEach((a) => st.tree.set(a.path, a.dirs));
            chainOf(r.path).forEach((a) => st.open.add(a));
            st.filter = '';
            q('filter').value = '';
            if (!select && r.file) select = joinPosix(r.path, r.file);
            st.sel = new Set(select ? [select] : []);
            st.cursor = -1;
            st.anchor = -1;
            st.preview = null;
            const last = fmLast();
            last[st.host] = r.path;
            localStorage.setItem('mp.fm.last', JSON.stringify(last));
          } catch (err) {
            if (req !== st.req) return;
            if (st.loaded && ['NO_DIR', 'NO_PERM'].includes(err.code)) toast(err.message, 'error');
            else st.error = { message: err.message, code: err.code, path: target };
          } finally {
            if (req === st.req) {
              st.loading = false;
              drawAll();
              if (select) {
                st.cursor = st.view.findIndex((e) => e.path === select);
                st.anchor = st.cursor;
                updateSel();
              }
              revealTree();
            }
          }
        }

        async function toggleTree(p) {
          if (st.open.has(p) && st.tree.has(p)) { st.open.delete(p); drawSide(); return; }
          st.open.add(p);
          if (!st.tree.has(p)) {
            st.treeLoading.add(p);
            drawSide();
            try {
              const r = await fetchLs(p, false);
              st.tree.set(p, dirNames(r.entries));
            } catch (err) {
              toast(err.message, 'error');
              st.open.delete(p);
            } finally {
              st.treeLoading.delete(p);
            }
          }
          drawSide();
        }

        // ---------------------------------------------------- drawing
        function drawChrome() {
          const conf = hosts.find((h) => h.alias === st.host);
          const login = hostLogin(st.host, st.port);
          const status = st.loading && !st.loaded ? '<span class="fm-st busy"><span class="spinner xs"></span>正在连接…</span>'
            : st.error && !st.loaded ? '<span class="fm-st err"><i></i>连接失败</span>'
              : `<span class="fm-st ok"><i></i>已连接${st.meta ? ` · 读取 ${st.meta.ms} ms` : ''}</span>`;
          q('conn').innerHTML = `<span class="mono">${esc(login)}</span>${conf ? '' : ' <span class="muted">（不在 ~/.ssh/config 中）</span>'} · ${status}`;
          panel.querySelector('[data-c="back"]').disabled = !st.back.length;
          panel.querySelector('[data-c="fwd"]').disabled = !st.fwd.length;
          panel.querySelector('[data-c="up"]').disabled = !st.path || st.path === '/';
          q('hidden').classList.toggle('active', prefs.hidden);
          q('body').classList.toggle('loading', st.loading);
          drawCrumbs();
        }

        function drawCrumbs() {
          const el = q('crumbs');
          if (!st.path) { el.innerHTML = '<span class="muted">…</span>'; return; }
          const chain = chainOf(st.path);
          const atHome = st.home && (st.path === st.home || st.path.startsWith(`${st.home}/`));
          el.innerHTML = chain.map((p, i) => {
            const label = p === '/' ? icon('server', 'i-sm') : esc(nameOf(p));
            const isHome = atHome && p === st.home;
            return `${i > 0 ? '<span class="sep">/</span>' : ''}<button class="crumb ${i === chain.length - 1 ? 'cur' : ''} ${isHome ? 'home' : ''}" data-crumb="${esc(p)}" title="${esc(p)}${isHome ? '（主目录）' : ''}">${label}</button>`;
          }).join('');
          el.scrollLeft = el.scrollWidth;
        }

        function drawSide() {
          const keepTop = side.scrollTop;
          const roots = syncRoots();
          const quick = [
            ['home', st.home || '~', `主目录${st.home ? ` · ${st.home}` : ''}`],
            ['server', '/', '根目录 /'],
          ];
          const qItem = (ic, p, label, cur) => `<button class="fm-q ${cur ? 'cur' : ''}" data-go="${esc(p)}" title="${esc(p)}">${icon(ic, 'i-sm')}<span class="name">${esc(label)}</span></button>`;
          const rows = [];
          const walk = (p, depth) => {
            const kids = st.tree.has(p) ? st.tree.get(p).filter(visible) : null;
            const open = st.open.has(p) && kids;
            const leaf = kids && !kids.length;
            rows.push(`<div class="fm-tn ${p === st.path ? 'cur' : ''}" data-tp="${esc(p)}" style="padding-left:${4 + depth * 14}px" title="${esc(p)}">
              <span class="fm-tw ${leaf ? 'leaf' : ''} ${open ? 'open' : ''}" data-tt>${st.treeLoading.has(p) ? '<span class="spinner xs"></span>' : icon('chevronRight', 'i-sm')}</span>${icon('folder', 'i-sm')}<span class="name">${esc(p === '/' ? '/' : nameOf(p))}</span></div>`);
            if (open) kids.forEach((n) => walk(joinPosix(p, n), depth + 1));
          };
          walk('/', 0);
          side.innerHTML = `
            <div class="fm-sec">快速访问</div>
            ${quick.map(([ic, p, label]) => qItem(ic, p, label, p === st.path)).join('')}
            ${roots.length ? `<div class="fm-sec">同步会话目录</div>${roots.map((m) => qItem('swap', m.root, m.title, m.root === st.path)).join('')}` : ''}
            <div class="fm-sec">目录树</div>
            <div class="fm-tree">${rows.join('')}</div>`;
          side.scrollTop = keepTop;
        }

        function revealTree() {
          const el = side.querySelector('.fm-tn.cur');
          if (!el) return;
          const top = el.offsetTop - side.offsetTop;
          if (top < side.scrollTop || top > side.scrollTop + side.clientHeight - 30) side.scrollTop = Math.max(0, top - side.clientHeight / 3);
        }

        function computeView() {
          const f = st.filter.toLowerCase();
          const dir = prefs.desc ? -1 : 1;
          const byName = (a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
          st.view = st.entries.filter((e) => visible(e.name) && (!f || e.name.toLowerCase().includes(f))).sort((a, b) => {
            const da = isDirLike(a) ? 0 : 1;
            const db = isDirLike(b) ? 0 : 1;
            if (da !== db) return da - db;
            let c = 0;
            if (prefs.sort === 'size') c = (a.size || 0) - (b.size || 0);
            else if (prefs.sort === 'mtime') c = (a.mtime || 0) - (b.mtime || 0);
            else if (prefs.sort === 'mode') c = String(a.mode).localeCompare(String(b.mode));
            else if (prefs.sort === 'user') c = `${a.user}:${a.group}`.localeCompare(`${b.user}:${b.group}`);
            return (c || byName(a, b)) * dir;
          });
        }

        function rowHtml(e, i) {
          const ic = e.type === 'link' ? 'link' : isDirLike(e) ? 'folder' : 'file';
          return `<div class="fm-row ${st.sel.has(e.path) ? 'sel' : ''} ${i === st.cursor ? 'cur' : ''} ${isDirLike(e) ? 'is-dir' : ''} ${e.name.startsWith('.') ? 'dot' : ''}" data-i="${i}" title="${esc(e.path)}">
            <span class="c-name">${icon(ic, 'i-sm')}<span class="name">${esc(e.name)}</span>${e.type === 'link' ? `<span class="lnk">→ ${esc(e.link)}</span>` : ''}</span>
            <span class="c-size">${isDirLike(e) || e.size == null ? '' : fmtBytes(e.size)}</span>
            <span class="c-time">${fmDate(e.mtime)}</span>
            <span class="c-perm mono">${esc(permStr(e.mode, e))}</span>
            <span class="c-own">${esc(e.user)}${e.group && e.group !== e.user ? `:${esc(e.group)}` : ''}</span>
          </div>`;
        }

        function drawList() {
          const cols = [['name', '名称'], ['size', '大小'], ['mtime', '修改时间'], ['mode', '权限'], ['user', '所有者']];
          q('cols').innerHTML = cols.map(([k, label]) => `<button class="c-${k === 'mtime' ? 'time' : k === 'mode' ? 'perm' : k === 'user' ? 'own' : k} ${prefs.sort === k ? 'on' : ''}" data-sort="${k}">${label}${prefs.sort === k ? icon(prefs.desc ? 'arrowDown' : 'arrowUp', 'i-sm') : ''}</button>`).join('');
          if (st.error) {
            const e = st.error;
            list.innerHTML = `<div class="browser-state err">${icon('alert', 'i-lg')}<div>${esc(e.message)}</div><div class="fm-err-actions">
              <button class="btn btn-sm" data-c="retry">${icon('refresh', 'i-sm')}重试</button>
              ${e.code === 'SSH_KEY_PERMS' ? `<button class="btn btn-sm" data-c="fix-perms">${icon('key', 'i-sm')}修复私钥权限</button>` : ''}
              ${isAuthErr(e.code) ? `<button class="btn btn-sm" data-c="wizard">${icon('key', 'i-sm')}配置免密登录</button>` : ''}
              ${st.loaded ? `<button class="btn btn-sm" data-c="back-ok">返回 ${esc(st.path)}</button>` : ''}</div></div>`;
            return;
          }
          if (!st.loaded) {
            list.innerHTML = '<div class="browser-state"><span class="spinner"></span>正在连接服务器…首次连接需要 SSH 握手，之后会快很多</div>';
            return;
          }
          computeView();
          list.innerHTML = st.view.length
            ? st.view.map(rowHtml).join('')
            : `<div class="browser-state">${st.filter ? `没有名称包含「${esc(st.filter)}」的项目` : (st.entries.length ? '只有隐藏文件，点上方「隐藏文件」显示' : '这个目录是空的')}</div>`;
        }

        function updateSel() {
          $$('.fm-row', list).forEach((el) => {
            const i = Number(el.dataset.i);
            el.classList.toggle('sel', st.sel.has(st.view[i] && st.view[i].path));
            el.classList.toggle('cur', i === st.cursor);
          });
          const cur = list.querySelector('.fm-row.cur');
          if (cur) {
            const top = cur.offsetTop;
            if (top < list.scrollTop) list.scrollTop = top;
            else if (top + cur.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + cur.offsetHeight - list.clientHeight;
          }
          drawDetail();
          drawFoot();
          schedulePreview();
        }

        const copyBtns = (multi) => `<div class="fm-copy">
          <button class="btn btn-xs" data-c="cp-path" title="${multi ? '每行一个完整路径' : '完整路径，例如 /root/app/main.go'}">${icon('copy', 'i-sm')}${multi ? '复制全部路径' : '复制路径'}</button>
          <button class="btn btn-xs" data-c="cp-host" title="主机:路径，scp / rsync / VS Code Remote 都能用">${icon('server', 'i-sm')}主机:路径</button>
          <button class="btn btn-xs" data-c="cp-name">${icon('tag', 'i-sm')}${multi ? '复制名称' : '名称'}</button>
          <button class="btn btn-xs" data-c="cp-scp" title="在本机终端执行即可把它下载到当前目录">${icon('download', 'i-sm')}scp 命令</button>
        </div>`;

        function localHtml(e) {
          const m = localFor(e.path);
          if (!m) return '';
          return `<div class="fm-local">
            <div class="fm-local-h">${icon('swap', 'i-sm')}已同步到本地 · 会话「${esc(m.title)}」</div>
            <div class="mono fm-local-p">${esc(m.path)}</div>
            <div class="fm-copy"><button class="btn btn-xs" data-c="cp-local">${icon('copy', 'i-sm')}复制本地路径</button><button class="btn btn-xs" data-c="open-local">${icon('folder', 'i-sm')}在资源管理器中打开</button></div>
          </div>`;
        }

        function previewHtml(e) {
          if (isDirLike(e) || e.type === 'other' || (e.type === 'link' && e.targetType !== 'file')) return '';
          if (FM_BINARY_EXT.test(e.name)) return `<div class="fm-prev-note">${icon('file', 'i-sm')}看起来是二进制文件，不做预览，可以直接下载</div>`;
          const p = st.preview && st.preview.path === e.path ? st.preview : null;
          if (!p || p.loading) return '<div class="fm-prev-note"><span class="spinner xs"></span>正在读取预览…</div>';
          if (p.error) return `<div class="fm-prev-note err">${icon('alert', 'i-sm')}${esc(p.error)}</div>`;
          const r = p.data;
          if (r.binary) return `<div class="fm-prev-note">${icon('file', 'i-sm')}二进制文件，不做预览，可以直接下载</div>`;
          const lines = r.text ? r.text.split('\n').length - (r.text.endsWith('\n') ? 1 : 0) : 0;
          return `<div class="fm-prev-h"><span>预览 · ${esc(r.encoding)} · ${fmtNum(lines)} 行${r.truncated ? ` · 仅前 ${fmtBytes(r.limit)}` : ''}</span><span class="spacer"></span>
              <button class="btn btn-ghost btn-xs" data-c="cp-content" title="复制预览中的文本">${icon('copy', 'i-sm')}复制内容</button>
              <button class="btn btn-ghost btn-xs btn-icon" data-c="wide" title="${prefs.wide ? '收窄预览栏' : '加宽预览栏'}">${icon(prefs.wide ? 'collapse' : 'expand', 'i-sm')}</button></div>
            <pre class="code-block fm-pre">${r.text ? esc(r.text) : '<span class="muted">（空文件）</span>'}</pre>`;
        }

        function drawDetail() {
          const el = q('detail');
          if (!st.loaded) { el.innerHTML = ''; return; }
          const sel = selected();
          if (sel.length > 1) {
            const files = sel.filter((e) => !isDirLike(e));
            el.innerHTML = `<div class="fm-d-head">${icon('layers')}<div><div class="fm-d-name">已选择 ${sel.length} 项</div><div class="muted">${sel.length - files.length} 个文件夹 · ${files.length} 个文件 · ${fmtBytes(files.reduce((a, e) => a + (e.size || 0), 0))}</div></div></div>
              ${copyBtns(true)}
              <div class="fm-d-actions"><button class="btn btn-sm btn-danger-ghost" data-c="delete">${icon('trash', 'i-sm')}删除 ${sel.length} 项</button></div>
              <div class="fm-d-list mono">${sel.slice(0, 200).map((e) => `<div>${esc(e.path)}</div>`).join('')}${sel.length > 200 ? `<div class="muted">… 另有 ${sel.length - 200} 项</div>` : ''}</div>`;
            return;
          }
          const e = sel[0] || cwdEntry();
          const isCwd = !sel.length;
          const dirs = st.entries.filter(isDirLike).length;
          const files = st.entries.filter((x) => !isDirLike(x));
          const kv = [];
          if (isCwd) {
            kv.push(['内容', `${dirs} 个文件夹 · ${files.length} 个文件`], ['文件合计', fmtBytes(files.reduce((a, x) => a + (x.size || 0), 0))]);
          } else {
            kv.push(['类型', typeName(e)]);
            if (!isDirLike(e) && e.size != null) kv.push(['大小', `${fmtBytes(e.size)}${e.size >= 1024 ? ` <span class="muted">(${fmtNum(e.size)} 字节)</span>` : ''}`]);
            if (e.mtime) kv.push(['修改时间', fmDate(e.mtime, true)]);
            if (e.mode) kv.push(['权限', `<span class="mono">${esc(permStr(e.mode, e))}</span> <span class="muted mono">(${esc(e.mode)})</span>`]);
            if (e.user) kv.push(['所有者', `${esc(e.user)}${e.group ? ` : ${esc(e.group)}` : ''}`]);
            if (e.type === 'link') kv.push(['链接到', `<span class="mono">${esc(e.link)}</span>`]);
          }
          const dirTarget = isDirLike(e);
          el.innerHTML = `
            <div class="fm-d-head">${icon(e.type === 'link' ? 'link' : dirTarget ? 'folder' : 'file')}<div style="min-width:0"><div class="fm-d-name" title="${esc(e.name)}">${esc(e.name)}</div><div class="muted">${isCwd ? '当前目录（未选中任何项目）' : esc(typeName(e))}</div></div></div>
            <div class="fm-d-path mono" title="点击复制" data-c="cp-path">${esc(e.path)}</div>
            ${copyBtns(false)}
            <dl class="kv fm-kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
            ${localHtml(e)}
            <div class="fm-d-actions">
              ${dirTarget
                ? `${isCwd ? `<button class="btn btn-sm" data-c="mkdir">${icon('folderPlus', 'i-sm')}新建文件夹</button>` : `<button class="btn btn-sm" data-c="open">${icon('folder', 'i-sm')}打开</button>`}<button class="btn btn-sm" data-c="term">${icon('terminal', 'i-sm')}终端</button><button class="btn btn-sm" data-c="new-session" title="把这个目录同步到本机">${icon('plus', 'i-sm')}新建同步会话</button>`
                : `<button class="btn btn-sm" data-c="download">${icon('download', 'i-sm')}下载</button><button class="btn btn-sm" data-c="term" title="在文件所在目录打开终端">${icon('terminal', 'i-sm')}终端</button>`}
              ${isCwd ? '' : `<button class="btn btn-sm btn-danger-ghost" data-c="delete" title="永久删除（Delete 键）">${icon('trash', 'i-sm')}删除</button>`}
            </div>
            ${isCwd ? '' : previewHtml(e)}`;
        }

        function drawFoot() {
          if (!st.loaded) { q('foot').innerHTML = '<span class="muted">双击打开 · 右键更多操作 · Ctrl+C 复制选中路径</span>'; return; }
          const dirs = st.entries.filter(isDirLike).length;
          const files = st.entries.length - dirs;
          const parts = [`${dirs} 个文件夹`, `${files} 个文件`];
          const hiddenCount = prefs.hidden ? 0 : st.entries.filter((e) => e.name.startsWith('.')).length;
          if (hiddenCount) parts.push(`${hiddenCount} 个隐藏项未显示`);
          if (st.filter) parts.push(`筛选出 ${st.view.length} 项`);
          if (st.sel.size) parts.push(`<b>已选 ${st.sel.size} 项</b>`);
          const notes = [];
          if (st.meta && st.meta.truncated) notes.push(`<span class="warn">目录太大，只列出前 ${fmtNum(st.entries.length)} 项</span>`);
          if (st.meta && st.meta.simple) notes.push('<span class="warn">服务器的 find 不支持 -printf，只显示名称</span>');
          q('foot').innerHTML = `<span>${parts.join(' · ')}</span>${notes.join('')}<span class="spacer"></span>${st.disk ? diskHtml(st.disk, true) : '<span class="muted">双击打开 · 右键更多 · Ctrl+C 复制路径 · Delete 删除</span>'}`;
        }

        function drawAll() {
          drawChrome();
          drawSide();
          drawList();
          drawDetail();
          drawFoot();
        }

        // ---------------------------------------------------- preview
        const schedulePreview = debounce(loadPreview, 160);
        async function loadPreview() {
          const sel = selected();
          if (sel.length !== 1) return;
          const e = sel[0];
          if (isDirLike(e) || e.type === 'other' || (e.type === 'link' && e.targetType !== 'file') || FM_BINARY_EXT.test(e.name)) return;
          const key = `${e.path}|${e.mtime}|${e.size}`;
          if (st.preview && st.preview.key === key && !st.preview.error) return;
          const cached = st.previews.get(key);
          if (cached) { st.preview = { key, path: e.path, data: cached }; drawDetail(); return; }
          st.preview = { key, path: e.path, loading: true };
          drawDetail();
          try {
            const r = await api('GET', `/api/remote/read?${params({ path: e.path })}`);
            st.previews.set(key, r);
            if (st.previews.size > FM_PREVIEW_CACHE) st.previews.delete(st.previews.keys().next().value);
            if (st.preview && st.preview.key === key) { st.preview = { key, path: e.path, data: r }; drawDetail(); }
          } catch (err) {
            if (st.preview && st.preview.key === key) { st.preview = { key, path: e.path, error: err.message }; drawDetail(); }
          }
        }

        // ---------------------------------------------------- commands
        const scpCmd = (list2) => {
          const portFlag = st.port ? ` -P ${st.port}` : '';
          const recursive = list2.some(isDirLike) ? ' -r' : '';
          return `scp${portFlag}${recursive} ${list2.map((e) => `${st.host}:${posixQuote(e.path)}`).join(' ')} .`;
        };
        async function download(e) {
          const ps = params({ path: e.path });
          try {
            await api('GET', `/api/remote/download?${ps}&check=1`);
          } catch (err) {
            toast(err.message, 'error');
            return;
          }
          const a = document.createElement('a');
          a.href = `/api/remote/download?${ps}`;
          a.download = e.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          toast(`开始下载 ${e.name}${e.size != null ? `（${fmtBytes(e.size)}）` : ''}，进度见浏览器下载栏`, 'info');
        }
        function openEntry(e) {
          if (!e) return;
          if (isDirLike(e)) go(e.path);
          else if (e.type === 'link' && e.targetType === 'broken') toast(`链接目标不存在：${e.link}`, 'warn');
          else { st.sel = new Set([e.path]); updateSel(); }
        }
        function switchHost(h) {
          Object.assign(st, { host: h, port: h === opts.host ? (opts.port || '') : '', path: '', home: '', entries: [], view: [], meta: null, disk: null, loaded: false, error: null, sel: new Set(), back: [], fwd: [], tree: new Map(), open: new Set(['/']), preview: null });
          drawAll();
          go(fmLast()[h] || '~', { push: false });
        }

        async function removeEntries(list2) {
          const items = list2.filter((e) => !e.cwd);
          if (!items.length) return;
          const dirs = items.filter((e) => e.type === 'dir');
          const synced = items.map((e) => ({ e, m: localFor(e.path) })).filter((x) => x.m);
          const shown = items.slice(0, 8).map((e) => `<li><span class="mono">${esc(e.path)}</span>${e.type === 'dir' ? ' <span class="tag">文件夹</span>' : e.type === 'link' ? ' <span class="tag">链接</span>' : e.size != null ? ` <span class="muted">${fmtBytes(e.size)}</span>` : ''}</li>`).join('');
          const ok = await confirmDialog({
            title: items.length > 1 ? `删除 ${items.length} 项` : `删除「${items[0].name}」`,
            ic: 'trash',
            danger: true,
            okText: items.length > 1 ? `永久删除 ${items.length} 项` : '永久删除',
            message: `将在服务器 <b>${esc(st.host)}</b> 上永久删除：
              <ul class="del-list">${shown}${items.length > 8 ? `<li class="muted">… 另有 ${items.length - 8} 项</li>` : ''}</ul>
              <div class="del-warn">${icon('alert', 'i-sm')}<span><b>删除后无法恢复</b>，不会放进回收站。${dirs.length ? `${dirs.length} 个文件夹会连同其中的所有文件一起删除。` : ''}${items.some((e) => e.type === 'link') ? '符号链接只删除链接本身，不影响它指向的内容。' : ''}</span></div>
              ${synced.length ? `<div class="del-warn">${icon('swap', 'i-sm')}<span>其中 ${synced.length} 项在同步会话「${esc(synced[0].m.title)}」${synced.length > 1 && synced.some((x) => x.m.title !== synced[0].m.title) ? '等' : ''}里。双向同步或服务器 → 本地时，<b>本地对应的文件也会被删除</b>，例如 <span class="mono">${esc(synced[0].m.path)}</span></span></div>` : ''}`,
          });
          if (!ok) return;
          let r;
          try {
            toast(`正在删除 ${items.length} 项…`, 'info', { duration: 1500 });
            r = await api('POST', '/api/remote/delete', { host: st.host, port: st.port, paths: items.map((e) => e.path) });
          } catch (err) {
            toast(err.message, 'error');
            return;
          }
          for (const p of [...r.deleted, ...r.missing]) for (const k of [...st.tree.keys()]) if (k === p || k.startsWith(`${p}/`)) st.tree.delete(k);
          if (r.failed.length) toast(`${r.failed.length} 项删除失败：${r.failed[0].path}：${r.failed[0].error}`, 'error');
          else toast(r.deleted.length === 1 ? `已删除 ${r.deleted[0]}` : `已删除 ${r.deleted.length} 项`, 'ok');
          go(st.path, { push: false });
          if (st.host === srv.host) checkServer(true);
        }
        async function newFolder() {
          if (!st.loaded || !st.path) return;
          const dir = st.path;
          const taken = new Set(st.entries.map((e) => e.name));
          const synced = localFor(dir);
          let made = null;
          await promptDialog({
            title: '新建文件夹', ic: 'folderPlus', okText: '新建', label: `在 ${dir} 下新建`, placeholder: '文件夹名称，例如 my-project',
            help: synced ? `这里属于同步会话「${synced.title}」，新文件夹会同步到本地` : `将在服务器 ${st.host} 上创建`,
            submit: async (name) => {
              if (taken.has(name)) return `已存在同名的文件或文件夹：${name}`;
              made = await api('POST', '/api/remote/mkdir', { host: st.host, port: st.port, path: dir, name });
              return '';
            },
          });
          if (!made) return;
          toast(`已新建文件夹 ${made.name}${!prefs.hidden && made.name.startsWith('.') ? '（隐藏文件未显示，点「显示隐藏文件」查看）' : ''}`, 'ok');
          if (st.path === dir) await go(dir, { push: false, select: made.path });
          list.focus({ preventScroll: true });
        }
        async function run(cmd) {
          const t = targets();
          const one = t[0];
          switch (cmd) {
            case 'back': if (st.back.length) { st.fwd.push(st.path); go(st.back.pop(), { push: false }); } break;
            case 'fwd': if (st.fwd.length) { st.back.push(st.path); go(st.fwd.pop(), { push: false }); } break;
            case 'up': if (st.path && st.path !== '/') go(parentOf(st.path), { select: st.path }); break;
            case 'reload': case 'retry': st.previews.clear(); go(st.error && !st.loaded ? st.error.path : (st.path || '~'), { push: false }); break;
            case 'back-ok': st.error = null; drawAll(); break;
            case 'wizard': openSshWizard({ host: st.host, port: st.port }); break;
            case 'fix-perms': try { await fixKeyPerms(st.host, st.port); go(st.path || '~', { push: false }); } catch (err) { toast(err.message, 'error'); } break;
            case 'copy-cwd': if (st.path) copyText(st.path, `已复制：${st.path}`); break;
            case 'hidden': prefs.hidden = !prefs.hidden; savePrefs(); drawAll(); break;
            case 'wide': prefs.wide = !prefs.wide; savePrefs(); q('body').classList.toggle('wide', prefs.wide); drawDetail(); break;
            case 'open': openEntry(one); break;
            case 'cp-path': copyText(t.map((e) => e.path).join('\n'), t.length > 1 ? `已复制 ${t.length} 个路径` : `已复制：${one.path}`); break;
            case 'cp-host': copyText(t.map((e) => `${st.host}:${e.path}`).join('\n'), t.length > 1 ? `已复制 ${t.length} 项` : `已复制：${st.host}:${one.path}`); break;
            case 'cp-name': copyText(t.map((e) => e.name).join('\n'), '名称已复制'); break;
            case 'cp-scp': copyText(scpCmd(t), 'scp 命令已复制，在本机终端执行即可下载'); break;
            case 'cp-local': { const m = localFor(one.path); if (m) copyText(m.path, `已复制：${m.path}`); break; }
            case 'open-local': {
              const m = localFor(one.path);
              if (m) doAct(`open:${m.path}`, () => api('POST', '/api/open', { path: isDirLike(one) ? m.path : m.path.replace(/\\[^\\]*$/, ''), with: 'explorer' }));
              break;
            }
            case 'cp-content': if (st.preview && st.preview.data) copyText(st.preview.data.text, '文件内容已复制'); break;
            case 'download': t.filter((e) => !isDirLike(e) && !e.cwd).slice(0, 10).forEach((e, i) => setTimeout(() => download(e), i * 400)); break;
            case 'term': {
              const dir = isDirLike(one) ? one.path : parentOf(one.path);
              doAct(`fm:term:${dir}`, () => api('POST', '/api/open/remote-terminal', { host: st.host, port: st.port, path: dir }), `已打开终端：${dir}`);
              break;
            }
            case 'new-session': {
              const dir = isDirLike(one) ? one.path : parentOf(one.path);
              openSessionForm(null, undefined, undefined, { host: st.host, port: st.port, path: dir });
              break;
            }
            case 'select-all': st.sel = new Set(st.view.map((e) => e.path)); updateSel(); break;
            case 'mkdir': newFolder(); break;
            case 'delete': removeEntries(selected()); break;
            default: break;
          }
        }
        fmMenu = run;

        const fmi = (cmd, ic, label, hint = '', danger = false) => `<button class="menu-item ${danger ? 'danger' : ''}" data-fm="${cmd}">${icon(ic)}${label}${hint ? `<span class="hint">${hint}</span>` : ''}</button>`;
        function menuHtml() {
          const t = selected();
          if (!t.length) {
            return `<div class="menu-label mono">${esc(st.path)}</div>
              ${fmi('copy-cwd', 'copy', '复制当前目录路径')}
              ${fmi('cp-host', 'server', '复制 主机:路径')}
              ${fmi('term', 'terminal', '在服务器终端打开')}
              ${fmi('new-session', 'plus', '把当前目录同步到本机')}
              <div class="menu-sep"></div>
              ${fmi('mkdir', 'folderPlus', '新建文件夹…')}
              ${fmi('reload', 'refresh', '刷新', 'F5')}
              ${fmi('hidden', 'eye', prefs.hidden ? '不显示隐藏文件' : '显示隐藏文件')}
              ${fmi('select-all', 'check', '全选', 'Ctrl A')}`;
          }
          if (t.length > 1) {
            return `<div class="menu-label">已选择 ${t.length} 项</div>
              ${fmi('cp-path', 'copy', '复制全部路径（每行一个）', 'Ctrl C')}
              ${fmi('cp-host', 'server', '复制 主机:路径')}
              ${fmi('cp-name', 'tag', '复制名称')}
              ${fmi('cp-scp', 'download', '复制 scp 下载命令')}
              ${t.some((e) => !isDirLike(e)) ? fmi('download', 'download', '下载选中的文件') : ''}
              <div class="menu-sep"></div>
              ${fmi('delete', 'trash', `删除 ${t.length} 项…`, 'Delete', true)}`;
          }
          const e = t[0];
          const dir = isDirLike(e);
          const local = localFor(e.path);
          return `<div class="menu-label" title="${esc(e.path)}">${esc(e.name)}</div>
            ${fmi('open', dir ? 'folder' : 'eye', dir ? '打开' : '预览', 'Enter')}
            ${dir ? '' : fmi('download', 'download', '下载到本机')}
            <div class="menu-sep"></div>
            ${fmi('cp-path', 'copy', '复制完整路径', 'Ctrl C')}
            ${fmi('cp-host', 'server', '复制 主机:路径')}
            ${fmi('cp-name', 'tag', '复制名称')}
            ${fmi('cp-scp', 'download', '复制 scp 下载命令')}
            ${local ? fmi('cp-local', 'monitor', '复制本地对应路径') : ''}
            <div class="menu-sep"></div>
            ${fmi('term', 'terminal', dir ? '在服务器终端打开' : '在所在目录打开终端')}
            ${dir ? fmi('new-session', 'plus', '把这个目录同步到本机') : ''}
            ${local ? fmi('open-local', 'folder', '在本地资源管理器中打开') : ''}
            <div class="menu-sep"></div>
            ${fmi('delete', 'trash', '删除…', 'Delete', true)}`;
        }

        // ---------------------------------------------------- events
        function clickRow(i, ev) {
          const e = st.view[i];
          if (!e) return;
          if (ev.shiftKey && st.anchor >= 0) {
            const [a, b] = [Math.min(st.anchor, i), Math.max(st.anchor, i)];
            st.sel = new Set(st.view.slice(a, b + 1).map((x) => x.path));
          } else if (ev.ctrlKey || ev.metaKey) {
            if (st.sel.has(e.path)) st.sel.delete(e.path); else st.sel.add(e.path);
            st.anchor = i;
          } else {
            st.sel = new Set([e.path]);
            st.anchor = i;
          }
          st.cursor = i;
          updateSel();
        }

        list.addEventListener('click', (ev) => {
          const c = ev.target.closest('[data-c]');
          if (c) { run(c.dataset.c); return; }
          const row = ev.target.closest('.fm-row');
          list.focus({ preventScroll: true });
          if (row) clickRow(Number(row.dataset.i), ev);
          else if (st.sel.size) { st.sel.clear(); st.cursor = -1; updateSel(); }
        });
        list.addEventListener('dblclick', (ev) => {
          const row = ev.target.closest('.fm-row');
          if (row) openEntry(st.view[Number(row.dataset.i)]);
        });
        list.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (!st.loaded || st.error) return;
          const row = ev.target.closest('.fm-row');
          if (row) {
            const i = Number(row.dataset.i);
            if (!st.sel.has(st.view[i].path)) { st.sel = new Set([st.view[i].path]); st.anchor = i; }
            st.cursor = i;
          } else st.sel.clear();
          updateSel();
          openPopover({ x: ev.clientX, y: ev.clientY }, menuHtml());
        });
        q('cols').addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-sort]');
          if (!b) return;
          if (prefs.sort === b.dataset.sort) prefs.desc = !prefs.desc;
          else { prefs.sort = b.dataset.sort; prefs.desc = b.dataset.sort === 'mtime' || b.dataset.sort === 'size'; }
          savePrefs();
          drawList();
          st.cursor = st.view.findIndex((e) => st.sel.has(e.path));
          updateSel();
        });
        side.addEventListener('click', (ev) => {
          const g = ev.target.closest('[data-go]');
          if (g) { go(g.dataset.go); return; }
          const tn = ev.target.closest('[data-tp]');
          if (!tn) return;
          if (ev.target.closest('[data-tt]')) toggleTree(tn.dataset.tp);
          else go(tn.dataset.tp);
        });
        side.addEventListener('dblclick', (ev) => {
          const tn = ev.target.closest('[data-tp]');
          if (tn && !ev.target.closest('[data-tt]')) toggleTree(tn.dataset.tp);
        });
        q('detail').addEventListener('click', (ev) => {
          const c = ev.target.closest('[data-c]');
          if (c) run(c.dataset.c);
        });
        panel.querySelector('.fm-bar').addEventListener('click', (ev) => {
          const cr = ev.target.closest('[data-crumb]');
          if (cr) { go(cr.dataset.crumb); return; }
          const c = ev.target.closest('[data-c]');
          if (c) { run(c.dataset.c); return; }
          if (ev.target === q('crumbs')) editPath();
        });
        function editPath() {
          const input = q('path');
          input.value = st.path || '';
          input.classList.remove('hidden');
          q('crumbs').classList.add('hidden');
          input.focus();
          input.select();
        }
        function endEdit() {
          q('path').classList.add('hidden');
          q('crumbs').classList.remove('hidden');
        }
        q('path').addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); const v = cleanPath(ev.target.value); endEdit(); if (v && v !== st.path) go(v); list.focus({ preventScroll: true }); }
          else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); endEdit(); list.focus({ preventScroll: true }); }
        });
        q('path').addEventListener('blur', endEdit);
        q('filter').addEventListener('input', (ev) => {
          st.filter = ev.target.value.trim();
          st.sel.clear();
          st.cursor = -1;
          drawList();
          drawDetail();
          drawFoot();
        });
        q('filter').addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && ev.target.value) { ev.preventDefault(); ev.stopPropagation(); ev.target.value = ''; ev.target.dispatchEvent(new Event('input')); }
          else if (ev.key === 'ArrowDown' || ev.key === 'Enter') {
            ev.preventDefault();
            list.focus({ preventScroll: true });
            if (st.view.length) { st.cursor = 0; st.anchor = 0; st.sel = new Set([st.view[0].path]); updateSel(); }
          }
        });
        q('host').addEventListener('change', (ev) => switchHost(ev.target.value));

        panel.addEventListener('keydown', (ev) => {
          const typing = ev.target.closest('input, select, textarea');
          const handled = () => { ev.preventDefault(); ev.stopPropagation(); };
          const mod = ev.ctrlKey || ev.metaKey;
          if (ev.key === 'F5' || (mod && ev.key.toLowerCase() === 'r')) { handled(); run('reload'); return; }
          if (mod && ev.key.toLowerCase() === 'l') { handled(); editPath(); return; }
          if (mod && ev.key.toLowerCase() === 'f') { handled(); q('filter').focus(); return; }
          if (ev.altKey && ev.key === 'ArrowLeft') { handled(); run('back'); return; }
          if (ev.altKey && ev.key === 'ArrowRight') { handled(); run('fwd'); return; }
          if (typing) return;
          if (ev.key === '/') { handled(); q('filter').focus(); return; }
          if (ev.target !== list) return;
          const n = st.view.length;
          const move = (i) => {
            if (!n) return;
            const j = Math.max(0, Math.min(n - 1, i));
            if (ev.shiftKey && st.anchor >= 0) {
              const [a, b] = [Math.min(st.anchor, j), Math.max(st.anchor, j)];
              st.sel = new Set(st.view.slice(a, b + 1).map((x) => x.path));
            } else { st.sel = new Set([st.view[j].path]); st.anchor = j; }
            st.cursor = j;
            updateSel();
          };
          if (ev.key === 'ArrowDown') { handled(); move(st.cursor < 0 ? 0 : st.cursor + 1); }
          else if (ev.key === 'ArrowUp') { handled(); move(st.cursor < 0 ? 0 : st.cursor - 1); }
          else if (ev.key === 'Home') { handled(); move(0); }
          else if (ev.key === 'End') { handled(); move(n - 1); }
          else if (ev.key === 'PageDown') { handled(); move(st.cursor + 15); }
          else if (ev.key === 'PageUp') { handled(); move(st.cursor - 15); }
          else if (ev.key === 'Enter') { handled(); if (st.cursor >= 0) openEntry(st.view[st.cursor]); }
          else if (ev.key === 'Backspace') { handled(); run('up'); }
          else if (ev.key === 'Delete') { handled(); if (st.sel.size) run('delete'); }
          else if (mod && ev.key.toLowerCase() === 'a') { handled(); run('select-all'); }
          else if (mod && ev.key.toLowerCase() === 'c' && !String(window.getSelection() || '')) { handled(); run('cp-path'); }
        });

        drawAll();
        go(opts.path || fmLast()[st.host] || '~', { push: false });
        setTimeout(() => list.focus({ preventScroll: true }), 60);
      },
    });
  }
  // ------------------------------------------------------------ detail drawer
  let detail = null;
  function openDetail(id, tab) {
    if (detail) {
      detail.id = id;
      detail.tab = tab;
      renderDetail();
      return;
    }
    const layer = openLayer({ type: 'drawer', html: '<div class="drawer-inner"></div>', onClose: () => { detail = null; } });
    detail = { id, tab, layer };
    layer.panel.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-tab-switch]');
      if (tb) { detail.tab = tb.dataset.tabSwitch; renderDetail(); }
      const rs = e.target.closest('[data-resolve]');
      if (rs) resolveConflict(detail.id, rs.dataset.root, rs.dataset.resolve);
    });
    renderDetail();
  }

  const kindName = (e) => (!e ? '不存在' : ({ file: '文件', directory: '目录', symlink: '符号链接', untracked: '未跟踪', problematic: '异常' }[e.kind] || e.kind || '文件'));
  const changeText = (c) => `${c.path || '(根目录)'}：${kindName(c.old)} → ${c.new ? (c.old && c.old.kind === c.new.kind ? `${kindName(c.new)}（已修改）` : kindName(c.new)) : '已删除'}`;

  function renderDetail() {
    const el = detail.layer.panel.querySelector('.drawer-inner');
    const s = sessionOf(detail.id);
    const v = VIEWS.get(detail.id);
    if (!s || !v) {
      morphHtml(el, `<div class="drawer-head"><div class="drawer-title"><h3>会话已不存在</h3><button class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x')}</button></div></div><div class="drawer-body"><div class="empty-tab">这个会话已被删除或重建，请关闭后重新打开。</div></div>`);
      return;
    }
    el.setAttribute('data-id', v.id);
    const problemsList = [
      ...v.remote.problems.map((p) => ({ ...p, side: v.remote.isLocal ? '源目录' : '服务器' })),
      ...v.local.problems.map((p) => ({ ...p, side: '本地' })),
    ];
    const conflicts = s.conflicts || [];
    const tabs = [
      ['overview', '概览', ''],
      ['conflicts', '冲突', v.conflicts ? `<span class="count warn">${v.conflicts}</span>` : ''],
      ['problems', '问题', (problemsList.length + (v.lastError ? 1 : 0)) ? `<span class="count warn">${problemsList.length + (v.lastError ? 1 : 0)}</span>` : ''],
      ['command', '命令', ''],
      ['json', '原始数据', ''],
    ];
    let body = '';
    const tab = detail.tab;
    if (tab === 'overview') {
      const epBlock = (e, label) => `<div class="ep"><div class="ep-head"><span class="label">${icon(label === '本地' ? 'monitor' : (e.isLocal ? 'folder' : 'server'), 'i-sm')}${label}</span><span class="conn ${e.connected ? 'on' : 'off'}"><i></i>${e.connected ? '已连接' : '未连接'}</span></div>
        <div class="mini-kv"><span>主机</span><span class="mono">${esc(e.hostFull)}</span><span>路径</span><span class="mono">${esc(e.path)}</span>
        <span>文件</span><span>${fmtNum(e.files)}</span><span>目录</span><span>${fmtNum(e.dirs)}</span><span>符号链接</span><span>${fmtNum(e.links)}</span><span>总大小</span><span>${fmtBytes(e.size)}</span><span>问题</span><span>${e.problems.length}</span></div></div>`;
      body = `
        <div class="section-title">状态</div>
        <dl class="kv">
          <dt>当前状态</dt><dd><span class="pill pill-${v.status.kind}"><i class="dot"></i>${esc(v.status.text)}</span> <span style="color:var(--text-2);margin-left:6px">${esc(v.status.detail)}</span></dd>
          <dt>同步方式</dt><dd>${esc(v.modeLabel)} <span class="muted mono">(${esc(s.mode || 'two-way-safe')})</span></dd>
          <dt>最近同步</dt><dd>${v.lastCycleAt ? esc(timeAgo(v.lastCycleAt)) : '<span class="muted">面板启动后尚未完成新的周期</span>'}</dd>
          <dt>已完成周期</dt><dd>${fmtNum(v.cycles)}</dd>
          <dt>忽略规则</dt><dd>${v.ignores.length ? v.ignores.map((x) => `<code class="badge mono" style="margin:0 4px 4px 0">${esc(x)}</code>`).join('') : '<span class="muted">无</span>'}</dd>
          <dt>版本库目录</dt><dd>${s.ignore && s.ignore.vcs ? '忽略（.git 等不同步）' : '同步'}</dd>
        </dl>
        <div class="section-title">两端</div>
        <div class="ep-compare">${epBlock(v.remote, v.remote.isLocal ? '源目录' : '服务器')}${epBlock(v.local, '本地')}</div>
        <div class="open-row">
          ${v.local.isLocal ? ['vscode', 'idea', 'explorer', 'terminal'].map((w) => `<button class="btn btn-sm" data-act="open" data-with="${w}" data-path="${esc(v.local.path)}">${icon(QUICK_OPEN[w][0], 'i-sm')}${QUICK_OPEN[w][1]}</button>`).join('') : ''}
          ${v.remote.protocol === 'ssh' ? `<button class="btn btn-sm" data-act="remote-term">${icon('server', 'i-sm')}服务器终端</button><button class="btn btn-sm" data-act="remote-files">${icon('tree', 'i-sm')}服务器文件</button>` : ''}
        </div>
        <div class="section-title">会话</div>
        <dl class="kv">
          <dt>会话 ID</dt><dd class="mono">${esc(s.identifier)}</dd>
          <dt>mutagen 名称</dt><dd class="mono">${esc(s.name || '—')}</dd>
          <dt>创建时间</dt><dd>${esc(fmtTime(s.creationTime))}</dd>
          <dt>创建版本</dt><dd>mutagen ${esc(s.creatingVersion || '—')}</dd>
          <dt>来源</dt><dd>${s._panel.managed ? '由本面板创建' : '外部创建（命令行等），编辑时按当前配置重建'}</dd>
        </dl>`;
    } else if (tab === 'conflicts') {
      const remoteName = v.remote.isLocal ? '源目录' : '服务器';
      const sideOfAlpha = v.remoteKey === 'alpha' ? remoteName : '本地';
      const sideOfBeta = v.remoteKey === 'alpha' ? '本地' : remoteName;
      body = conflicts.length ? `
        <div class="notice" style="margin-bottom:14px">${icon('info')}<div>两端同时改了同一个文件，安全模式不会自动覆盖。选择要<b>保留</b>的一边，另一边的版本会被移到备份目录（本地：面板 data/conflict-backups；服务器：~/.mutagen-panel-trash），然后自动重新同步。</div></div>
        ${conflicts.map((c) => `<div class="conflict">
          <div class="conflict-path">${icon('alert', 'i-sm')}${esc(c.root || '(根目录)')}</div>
          <div class="conflict-sides">
            <div><b>${sideOfAlpha}的改动</b>${(c.alphaChanges || []).map((x) => `<div>${esc(changeText(x))}</div>`).join('') || '<div class="muted">无</div>'}</div>
            <div><b>${sideOfBeta}的改动</b>${(c.betaChanges || []).map((x) => `<div>${esc(changeText(x))}</div>`).join('') || '<div class="muted">无</div>'}</div>
          </div>
          <div class="conflict-actions">
            <button class="btn btn-sm" data-resolve="remote" data-root="${esc(c.root)}">${icon(v.remote.isLocal ? 'folder' : 'server', 'i-sm')}保留${remoteName}版本</button>
            <button class="btn btn-sm" data-resolve="local" data-root="${esc(c.root)}">${icon('monitor', 'i-sm')}保留本地版本</button>
          </div></div>`).join('')}
        ${s.excludedConflicts ? `<div class="muted">另有 ${s.excludedConflicts} 处冲突未列出，处理完以上冲突后会显示。</div>` : ''}`
        : `<div class="empty-tab">${icon('checkCircle')}<div>没有冲突</div></div>`;
    } else if (tab === 'problems') {
      body = (v.lastError || problemsList.length) ? `
        ${v.lastError ? `<div class="section-title">最近错误</div><div class="problem"><div class="e" style="margin:0">${esc(v.lastError)}</div></div>` : ''}
        ${problemsList.length ? `<div class="section-title">无法同步的文件</div>${problemsList.map((p) => `<div class="problem"><div class="p">[${esc(p.side)}] ${esc(p.path || '(根目录)')}</div><div class="e">${esc(p.error)}</div></div>`).join('')}` : ''}`
        : `<div class="empty-tab">${icon('checkCircle')}<div>一切正常</div></div>`;
    } else if (tab === 'command') {
      body = `
        <div class="section-title">等效创建命令</div>
        <div class="code-wrap"><pre class="code-block">${esc(v.command)}</pre><button class="btn btn-xs copy-btn" data-act="copy-cmd">${icon('copy', 'i-sm')}复制</button></div>
        <div class="section-title">常用命令</div>
        <pre class="code-block">${esc([
          `mutagen sync list ${s.identifier} --long`,
          `mutagen sync monitor ${s.identifier}`,
          `mutagen sync flush ${s.identifier}`,
          `mutagen sync pause ${s.identifier}`,
          `mutagen sync resume ${s.identifier}`,
          `mutagen sync reset ${s.identifier}`,
          `mutagen sync terminate ${s.identifier}`,
        ].join('\n'))}</pre>`;
    } else {
      const raw = { ...s };
      delete raw._panel;
      body = `<div class="code-wrap"><pre class="code-block">${esc(JSON.stringify(raw, null, 2))}</pre></div>`;
    }
    morphHtml(el, `
      <div class="drawer-head">
        <div class="drawer-title">
          <span class="pill pill-${v.status.kind}"><i class="dot"></i>${esc(v.status.text)}</span>
          <h3 title="${esc(v.title)}">${esc(v.title)}</h3>
          ${v.op ? '' : `<button class="btn btn-sm btn-primary" data-act="flush" ${v.paused ? 'disabled' : ''}>${icon('refresh', 'i-sm')}同步</button>
          <button class="btn btn-sm" data-act="${v.paused ? 'resume' : 'pause'}">${icon(v.paused ? 'play' : 'pause', 'i-sm')}${v.paused ? '恢复' : '暂停'}</button>
          <button class="btn btn-sm btn-icon" data-act="edit" title="编辑配置">${icon('edit', 'i-sm')}</button>`}
          <button class="btn btn-sm btn-icon" data-act="card-menu" title="更多操作">${icon('more', 'i-sm')}</button>
          <button class="btn btn-ghost btn-icon btn-sm" data-close title="关闭">${icon('x')}</button>
        </div>
        <div class="tabs">${tabs.map(([k, label, extra]) => `<button class="tab ${tab === k ? 'active' : ''}" data-tab-switch="${k}">${label}${extra}</button>`).join('')}</div>
      </div>
      <div class="drawer-body" data-key="body-${tab}">${body}</div>`);
  }

  async function resolveConflict(id, root, keep) {
    const v = VIEWS.get(id);
    const remoteName = v.remote.isLocal ? '源目录' : '服务器';
    const keepName = keep === 'remote' ? remoteName : '本地';
    const loseName = keep === 'remote' ? '本地' : remoteName;
    const ok = await confirmDialog({
      title: `保留${keepName}版本`,
      message: `<code>${esc(root)}</code><br><br>${loseName}的版本会被移到备份目录（不会直接删除），随后${keepName}版本会同步过去。`,
      okText: `保留${keepName}版本`,
    });
    if (ok) doAct(`${id}:resolve`, () => api('POST', `/api/sessions/${id}/resolve`, { root, keep }), (r) => `冲突已处理，${loseName}版本已备份到 ${r.movedTo}`);
  }

  // ------------------------------------------------------------ logs
  let logView = null;
  const expandedLogs = new Set();
  async function openLogs() {
    try { logs = await api('GET', '/api/logs'); } catch { /* keep */ }
    const layer = openLayer({
      type: 'drawer',
      html: `<div class="drawer-inner">
        <div class="drawer-head" style="padding-bottom:14px;border-bottom:1px solid var(--border)">
          <div class="drawer-title"><span class="head-icon tone-primary" style="width:32px;height:32px;border-radius:9px;display:grid;place-items:center">${icon('log')}</span><h3>命令日志</h3>
            <button class="btn btn-sm" data-m="clear">${icon('trash', 'i-sm')}清空</button>
            <button class="btn btn-ghost btn-icon btn-sm" data-close>${icon('x')}</button></div>
          <div class="muted" style="font-size:12.5px">面板执行过的 mutagen / ssh 命令（最近 300 条，后台轮询的列表命令不记录）。点击展开输出。</div>
        </div>
        <div class="drawer-body" data-m="logs"></div></div>`,
      onClose: () => { logView = null; },
    });
    logView = layer.panel.querySelector('[data-m="logs"]');
    layer.panel.addEventListener('click', async (e) => {
      if (e.target.closest('[data-m="clear"]')) {
        await api('DELETE', '/api/logs');
        logs = [];
        renderLogs();
        return;
      }
      const head = e.target.closest('[data-log]');
      if (head) {
        const id = Number(head.dataset.log);
        if (expandedLogs.has(id)) expandedLogs.delete(id); else expandedLogs.add(id);
        renderLogs();
      }
    });
    renderLogs();
  }
  function renderLogs() {
    if (!logView) return;
    const html = logs.slice().reverse().map((l) => `
      <div class="log-item" data-key="log-${l.id}">
        <div class="log-head" data-log="${l.id}">
          <span class="code-badge ${l.code === 0 ? 'ok' : 'err'}">${l.code === 0 ? 'OK' : `退出 ${l.code}`}</span>
          <span class="cmd" title="${esc(l.cmd)}">${esc(l.cmd)}</span>
          <time>${new Date(l.ts).toLocaleTimeString('zh-CN', { hour12: false })} · ${l.ms} ms</time>
        </div>
        ${expandedLogs.has(l.id) ? `<pre class="log-out">${esc(l.cmd)}\n\n${esc(l.out || '(无输出)')}</pre>` : ''}
      </div>`).join('') || `<div class="empty-tab">${icon('log')}<div>暂无日志</div></div>`;
    morphHtml(logView, html);
  }

  // ------------------------------------------------------------ ssh wizard
  async function openSshWizard(prefill = {}) {
    const st = { key: null, hosts: await getHosts(true), host: prefill.host || '', port: prefill.port || '', target: null, installed: false, manual: '', test: null };
    if (!st.host) st.host = pickCurrentServer().host || firstServerHost(st.hosts);
    openLayer({
      size: 'md',
      persistent: true,
      html: `${modalHead('SSH 免密登录向导', 'mutagen 需要用密钥免密登录服务器，按下面四步完成配置', 'key')}
        <div class="modal-body" data-m="body"></div>
        <div class="modal-foot"><span class="note">只需在第 3 步输入一次服务器密码，之后都免密</span><button class="btn" data-close>完成</button></div>`,
      mount(panel) {
        const body = panel.querySelector('[data-m="body"]');
        const load = async () => { st.key = await api('GET', '/api/ssh/key'); draw(); };
        const refreshTarget = async () => {
          const { host, port } = st;
          const t = await resolveHost(host, port);
          if (host === st.host && port === st.port) { st.target = t; draw(); }
        };
        function draw() {
          const k = st.key;
          const hostOpts = st.hosts.map((h) => `<option value="${esc(h.alias)}">${esc(h.user ? `${h.user}@` : '')}${esc(h.hostname)}${h.port ? `:${esc(h.port)}` : ''}</option>`).join('');
          body.innerHTML = `
            <div class="wiz-step ${k && k.exists ? 'done' : ''}">
              <span class="wiz-num">${k && k.exists ? icon('check', 'i-sm') : '1'}</span>
              <div><h4>本机 SSH 密钥</h4>
                ${!k ? '<div class="desc">正在检查…</div>' : k.exists
                  ? `<div class="desc">已找到 ${esc(k.type)} 公钥：<span class="mono">${esc(k.path)}</span></div>
                     <div class="code-wrap"><pre class="code-block" style="max-height:90px">${esc(k.publicKey)}</pre><button class="btn btn-xs copy-btn" data-w="copy-key">${icon('copy', 'i-sm')}复制</button></div>`
                  : `<div class="desc">本机还没有 SSH 密钥。点击生成一对 ed25519 密钥（保存在 ~/.ssh，无密码短语）。</div><button class="btn btn-primary btn-sm" data-w="gen">${icon('key', 'i-sm')}生成密钥</button>`}
              </div>
            </div>
            <div class="wiz-step ${st.host ? 'done' : ''}">
              <span class="wiz-num">${st.host ? icon('check', 'i-sm') : '2'}</span>
              <div><h4>选择服务器</h4>
                <div class="desc">填 ~/.ssh/config 里的别名，或直接填 <span class="mono">root@1.2.3.4</span>。建议添加别名，之后在面板和命令行里都更方便。</div>
                <div class="input-group"><input class="input mono" data-w-f="host" list="wiz-hosts" value="${esc(st.host)}" placeholder="my-vps 或 root@1.2.3.4"><input class="input mono" style="max-width:90px" data-w-f="port" value="${esc(st.port)}" placeholder="端口"></div>
                <datalist id="wiz-hosts">${hostOpts}</datalist>
                ${st.host ? hostTargetHtml(st.target) : ''}
                <details class="adv" style="margin-top:10px">
                  <summary><span class="chev">${icon('chevronDown', 'i-sm')}</span>添加新服务器到 ~/.ssh/config</summary>
                  <div class="form-grid">
                    <div class="field"><label>别名</label><input class="input mono" data-n="alias" placeholder="my-vps"></div>
                    <div class="field"><label>IP / 域名</label><input class="input mono" data-n="hostname" placeholder="1.2.3.4"></div>
                    <div class="field"><label>用户</label><input class="input mono" data-n="user" value="root"></div>
                    <div class="field"><label>端口</label><input class="input mono" data-n="port" value="22"></div>
                    <div class="field full"><button class="btn btn-sm" data-w="add-host">${icon('plus', 'i-sm')}写入 ~/.ssh/config</button></div>
                  </div>
                </details>
              </div>
            </div>
            <div class="wiz-step ${st.installed ? 'done' : ''}">
              <span class="wiz-num">${st.installed ? icon('check', 'i-sm') : '3'}</span>
              <div><h4>把公钥上传到服务器</h4>
                <div class="desc">会打开一个终端窗口，按提示输入一次服务器密码，公钥会追加到服务器的 ~/.ssh/authorized_keys。</div>
                <button class="btn btn-sm" data-w="install" ${k && k.exists && st.host ? '' : 'disabled'}>${icon('terminal', 'i-sm')}打开终端上传公钥</button>
                ${st.manual ? `<div class="desc" style="margin-top:10px">也可以在任意终端手动执行：</div><div class="code-wrap"><pre class="code-block">${esc(st.manual)}</pre><button class="btn btn-xs copy-btn" data-w="copy-manual">${icon('copy', 'i-sm')}复制</button></div>` : ''}
              </div>
            </div>
            <div class="wiz-step ${st.test && st.test.ok ? 'done' : ''}">
              <span class="wiz-num">${st.test && st.test.ok ? icon('check', 'i-sm') : '4'}</span>
              <div><h4>测试免密登录</h4>
                <div class="desc">用 BatchMode 连接服务器，不弹密码提示。成功就可以新建同步会话了。</div>
                <div class="input-group" style="align-items:center"><button class="btn btn-sm btn-primary" data-w="test" ${st.host ? '' : 'disabled'}>${icon('zap', 'i-sm')}测试免密登录</button>
                ${st.test ? (st.test.ok
                  ? `<span class="test-result ok">${icon('checkCircle', 'i-sm')}成功 · ${esc(st.test.user)}@${esc(st.host.replace(/^.*@/, ''))} · ${esc(st.test.system)} · ${st.test.ms} ms</span>`
                  : `<span class="test-result err">${icon('alert', 'i-sm')}${esc(st.test.message)}</span>${st.test.code === 'SSH_KEY_PERMS' ? keyPermsBtn('data-w="fix-perms"') : ''}`) : ''}</div>
                ${st.test && st.test.ok ? `<div style="margin-top:12px"><button class="btn btn-sm" data-w="new-session">${icon('plus', 'i-sm')}用这台服务器新建同步会话</button></div>` : ''}
              </div>
            </div>`;
        }
        body.addEventListener('input', (e) => {
          const el = e.target.closest('[data-w-f]');
          if (el) { st[el.dataset.wF] = el.value.trim(); st.test = null; st.target = null; }
        });
        body.addEventListener('change', (e) => { if (e.target.closest('[data-w-f]')) { draw(); refreshTarget(); } });
        body.addEventListener('click', async (e) => {
          const use = e.target.closest('[data-use-host]');
          if (use) { st.host = use.dataset.useHost; st.test = null; st.target = null; draw(); refreshTarget(); return; }
          const b = e.target.closest('[data-w]');
          if (!b) return;
          const w = b.dataset.w;
          const busy = async (fn) => { b.disabled = true; b.classList.add('loading'); try { await fn(); } catch (err) { toast(err.message, 'error'); } finally { b.disabled = false; b.classList.remove('loading'); } };
          if (w === 'copy-key') copyText(st.key.publicKey, '公钥已复制');
          if (w === 'copy-manual') copyText(st.manual, '命令已复制');
          if (w === 'gen') await busy(async () => { st.key = await api('POST', '/api/ssh/key/generate'); toast('密钥已生成', 'ok'); draw(); });
          if (w === 'add-host') {
            await busy(async () => {
              const val = (n) => body.querySelector(`[data-n="${n}"]`).value.trim();
              const r = await api('POST', '/api/ssh/config', { alias: val('alias'), hostname: val('hostname'), user: val('user'), port: val('port') === '22' ? '' : val('port') });
              st.hosts = await getHosts(true);
              st.host = r.alias;
              st.port = '';
              st.target = null;
              toast(`已添加主机 ${r.alias}`, 'ok');
              draw();
              refreshTarget();
            });
          }
          if (w === 'install') await busy(async () => { const r = await api('POST', '/api/ssh/key/install', { host: st.host, port: st.port }); st.installed = true; st.manual = r.manual; toast('已打开终端，请在终端里输入服务器密码', 'info'); draw(); });
          if (w === 'test') await busy(async () => { st.test = await api('POST', '/api/ssh/test', { host: st.host, port: st.port }); if (st.test.ok) st.installed = true; draw(); });
          if (w === 'fix-perms') await busy(async () => { await fixKeyPerms(st.host, st.port); st.test = await api('POST', '/api/ssh/test', { host: st.host, port: st.port }); if (st.test.ok) st.installed = true; draw(); });
          if (w === 'new-session') { localStorage.setItem('mp.lastHost', st.host); openSessionForm(null); }
        });
        draw();
        load().catch((err) => toast(err.message, 'error'));
        refreshTarget();
      },
    });
  }

  // ------------------------------------------------------------ settings / groups / about
  async function openSettings() {
    const [cfg, hostList] = await Promise.all([api('GET', '/api/config'), getHosts()]);
    const dh = String(cfg.defaultHost || '');
    const hostOpts = [['', '沿用上次使用的主机'], ...hostList.map((h) => [h.alias, `${h.alias}（${h.user ? `${h.user}@` : ''}${h.hostname}${h.port ? `:${h.port}` : ''}）`]), [LOCAL_HOST, '本机目录（不连服务器）']];
    if (dh && !hostOpts.some(([v]) => v === dh)) hostOpts.splice(1, 0, [dh, dh]);
    let saved = null;
    const notifySupported = 'Notification' in window;
    const notifyState = () => (!notifySupported ? '当前浏览器不支持桌面通知'
      : Notification.permission === 'denied' ? '浏览器已拒绝通知权限，需要在地址栏左侧的站点设置里重新允许'
        : Notification.permission === 'granted' ? '已获得通知权限' : '保存时浏览器会请求通知权限');
    return new Promise((resolve) => openLayer({
      onClose: () => resolve(saved),
      size: 'md',
      persistent: true,
      html: `${modalHead('设置', `保存到 <span class="mono">${esc(cfg.configPath)}</span>`, 'settings')}
        <div class="modal-body">
          <div class="form-section">
            <h4>mutagen</h4>
            <div class="field"><label>mutagen 可执行文件路径 <span class="muted">（config.json 的 mutagen 字段）</span></label>
              <input class="input mono" data-s="mutagen" value="${esc(cfg.mutagen)}" placeholder="D:\\mutagen\\mutagen_v0.18.1\\mutagen.exe">
              <div class="help">解压 mutagen 后，mutagen.exe 和 mutagen-agents.tar.gz 必须放在同一目录。当前解析为：<span class="mono">${esc(cfg.resolvedMutagen)}</span></div></div>
          </div>
          <div class="form-section">
            <h4>新建会话</h4>
            <div class="field"><label>默认本地根目录 <span class="muted">（config.json 的 localRoot 字段）</span></label>
              <div class="input-group"><input class="input mono" data-s="localRoot" value="${esc(cfg.localRoot || '')}" placeholder="例如 D:\\sync"><button type="button" class="btn" data-m="browse-root">${icon('folder', 'i-sm')}浏览</button></div>
              <div class="help">选好服务器目录后，本地目录自动填成「根目录\\服务器目录名」。留空则沿用上次创建时用的位置。</div></div>
            <div class="field" style="margin-top:12px"><label>默认主机 <span class="muted">（config.json 的 defaultHost 字段）</span></label>
              <select class="input" data-s="defaultHost">${hostOpts.map(([v, l]) => `<option value="${esc(v)}" ${v === dh ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
              <div class="help">新建会话时预先选中的主机。也可以在新建会话里点主机标签上的星标设置。</div></div>
          </div>
          <div class="form-section">
            <h4>编辑器</h4>
            <div class="form-grid">
              <div class="field"><label>VS Code 命令</label><input class="input mono" data-s="editors.vscode" value="${esc(cfg.editors.vscode)}" placeholder="code"></div>
              <div class="field"><label>IntelliJ IDEA 命令</label><input class="input mono" data-s="editors.idea" value="${esc(cfg.editors.idea)}" placeholder="C:\\Program Files\\JetBrains\\IntelliJ IDEA\\bin\\idea64.exe"></div>
            </div>
            <div class="help" style="margin-top:6px">填命令名（需在 PATH 中）或完整路径。</div>
          </div>
          <div class="form-section">
            <h4>面板</h4>
            <div class="form-grid">
              <div class="field"><label>状态刷新间隔（毫秒）</label><input class="input mono" type="number" min="400" max="10000" step="100" data-s="pollIntervalMs" value="${esc(cfg.pollIntervalMs)}"></div>
              <div class="field"><label>端口 <span class="muted">（重启面板后生效）</span></label><input class="input mono" type="number" data-s="port" value="${esc(cfg.port)}"></div>
              <div class="field full"><label class="check"><input type="checkbox" data-s="openBrowser" ${cfg.openBrowser !== false ? 'checked' : ''}>启动面板时自动打开浏览器</label></div>
            </div>
          </div>
          <div class="form-section">
            <h4>偏好 <span class="tag">保存在当前浏览器</span></h4>
            <div class="form-grid">
              <div class="field"><label>卡片上的快捷打开方式</label>
                <select class="input" data-p="quickOpen">${Object.entries(QUICK_OPEN).map(([k, [, l]]) => `<option value="${k}" ${quickOpen() === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
              <div class="field"><label>状态提醒</label>
                <label class="check" style="height:34px"><input type="checkbox" data-p="notify" ${localStorage.getItem('mp.notify') === 'on' ? 'checked' : ''} ${notifySupported ? '' : 'disabled'}>出现冲突、报错时发桌面通知</label></div>
              <div class="field full"><div class="help">${icon('bell', 'i-sm')} 面板内提示始终开启；桌面通知只在面板不在前台时弹出。${esc(notifyState())}。</div></div>
            </div>
          </div>
        </div>
        <div class="modal-foot"><span class="spacer"></span><button class="btn" data-close>取消</button><button class="btn btn-primary" data-m="save">${icon('check', 'i-sm')}保存</button></div>`,
      mount(panel, layer) {
        panel.querySelector('[data-m="browse-root"]').addEventListener('click', async () => {
          const input = panel.querySelector('[data-s="localRoot"]');
          const picked = await openDirBrowser({ kind: 'local', start: input.value.trim() });
          if (picked) input.value = picked;
        });
        panel.querySelector('[data-m="save"]').addEventListener('click', async (e) => {
          const btn = e.currentTarget;
          const wantNotify = panel.querySelector('[data-p="notify"]').checked;
          /** requestPermission must run synchronously inside the click to count as a user gesture. */
          const perm = wantNotify && notifySupported && Notification.permission === 'default' ? Notification.requestPermission() : null;
          localStorage.setItem('mp.quickOpen', panel.querySelector('[data-p="quickOpen"]').value);
          if (wantNotify) {
            const p = perm ? await perm : (notifySupported ? Notification.permission : 'denied');
            localStorage.setItem('mp.notify', p === 'granted' ? 'on' : 'off');
            if (p !== 'granted') toast('浏览器没有授予通知权限，桌面通知未开启（面板内提示仍然有效）', 'warn');
          } else localStorage.setItem('mp.notify', 'off');
          const body = { editors: {} };
          $$('[data-s]', panel).forEach((el) => {
            const key = el.dataset.s;
            const val = el.type === 'checkbox' ? el.checked : el.value;
            if (key.startsWith('editors.')) body.editors[key.slice(8)] = val;
            else body[key] = val;
          });
          btn.disabled = true;
          btn.classList.add('loading');
          try {
            saved = await api('PUT', '/api/config', body);
            toast('设置已保存', 'ok');
            scheduleRender();
            layer.close();
          } catch (err) {
            toast(err.message, 'error');
          } finally {
            btn.disabled = false;
            btn.classList.remove('loading');
          }
        });
      },
    }));
  }

  function openGroupsManager() {
    openLayer({
      size: 'sm',
      html: `${modalHead('管理分组', '拖动会话卡片到分组标签上，也可以快速移动', 'layers')}<div class="modal-body" data-m="list"></div>
        <div class="modal-foot"><input class="input" data-m="new" placeholder="新分组名称" style="flex:1"><button class="btn btn-primary" data-m="add">${icon('plus', 'i-sm')}添加</button></div>`,
      mount(panel) {
        const list = panel.querySelector('[data-m="list"]');
        const draw = () => {
          const views = [...VIEWS.values()];
          list.innerHTML = S.groups.length ? S.groups.map((g, i) => `
            <div class="group-row" data-g="${g.id}">
              <input class="input" value="${esc(g.name)}" data-rename="${g.id}">
              <span class="count">${views.filter((v) => gidOf(v) === g.id).length} 个会话</span>
              <button class="btn btn-ghost btn-icon btn-sm" data-move="-1" ${i === 0 ? 'disabled' : ''} title="上移">${icon('chevronUp', 'i-sm')}</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-move="1" ${i === S.groups.length - 1 ? 'disabled' : ''} title="下移">${icon('chevronDown', 'i-sm')}</button>
              <button class="btn btn-ghost btn-icon btn-sm" data-del title="删除">${icon('trash', 'i-sm')}</button>
            </div>`).join('') : '<div class="empty-tab">还没有分组</div>';
        };
        const refreshAfter = async (p, msg) => { try { await p; if (msg) toast(msg, 'ok'); } catch (err) { toast(err.message, 'error'); } setTimeout(draw, 150); };
        list.addEventListener('change', (e) => {
          const el = e.target.closest('[data-rename]');
          if (el && el.value.trim()) refreshAfter(api('PUT', `/api/groups/${el.dataset.rename}`, { name: el.value.trim() }), '已重命名');
        });
        list.addEventListener('click', async (e) => {
          const row = e.target.closest('[data-g]');
          if (!row) return;
          const id = row.dataset.g;
          const mv = e.target.closest('[data-move]');
          if (mv) {
            const ids = S.groups.map((g) => g.id);
            const i = ids.indexOf(id);
            const j = i + Number(mv.dataset.move);
            [ids[i], ids[j]] = [ids[j], ids[i]];
            refreshAfter(api('POST', '/api/groups/order', { ids }));
          }
          if (e.target.closest('[data-del]')) {
            const g = S.groups.find((x) => x.id === id);
            const ok = await confirmDialog({ title: '删除分组', message: `删除「<b>${esc(g.name)}</b>」？其中的会话会移到「未分组」。`, okText: '删除', danger: true, ic: 'trash' });
            if (ok) refreshAfter(api('DELETE', `/api/groups/${id}`), '分组已删除');
          }
        });
        const add = () => {
          const input = panel.querySelector('[data-m="new"]');
          if (!input.value.trim()) return;
          refreshAfter(api('POST', '/api/groups', { name: input.value.trim() }), '已添加分组');
          input.value = '';
        };
        panel.querySelector('[data-m="add"]').addEventListener('click', add);
        panel.querySelector('[data-m="new"]').addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
        draw();
      },
    });
  }

  function openAbout() {
    openLayer({
      size: 'md',
      html: `${modalHead('关于 Mutagen 同步面板', `v${esc(S.app.version)} · mutagen ${esc(S.mutagen.version || '未检测到')}`, 'info')}
        <div class="modal-body" style="font-size:13.5px;color:var(--text-2)">
          <p style="margin-top:0">面板只是 mutagen 命令行的图形外壳：所有同步由 <b>mutagen 守护进程</b>在后台执行。<b>关闭面板窗口不会停止同步</b>，重启电脑后打开面板会自动拉起守护进程（也可以在守护进程菜单中设置登录时自动启动）。</p>
          <div class="section-title">快捷键</div>
          <dl class="kv"><dt><kbd>Ctrl</kbd> <kbd>K</kbd></dt><dd>命令面板：搜索会话，直接同步、暂停、用 IDE 打开</dd><dt><kbd>/</kbd></dt><dd>筛选会话</dd><dt><kbd>N</kbd></dt><dd>新建会话</dd><dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt><dd>在新建/编辑窗口中提交</dd><dt><kbd>Esc</kbd></dt><dd>关闭弹窗</dd><dt>单击卡片</dt><dd>打开详情</dd><dt>右键卡片</dt><dd>全部操作菜单</dd><dt>双击标题</dt><dd>重命名会话</dd><dt>拖动 ⠿</dt><dd>排序，或拖到分组标签上移动分组</dd></dl>
          <div class="section-title">同步方式说明</div>
          <dl class="kv">
            <dt>双向 · 安全</dt><dd>two-way-safe：两边的改动互相同步，冲突时不覆盖，等你处理。</dd>
            <dt>双向 · 某端优先</dt><dd>two-way-resolved：冲突时自动以优先端为准。</dd>
            <dt>单向</dt><dd>one-way-safe：只从源端同步到目标端，目标端的修改不会被覆盖。</dd>
            <dt>单向 · 镜像</dt><dd>one-way-replica：目标端完全等于源端，多余文件会被删除。</dd>
          </dl>
          <div class="section-title">数据位置</div>
          <dl class="kv"><dt>面板配置</dt><dd class="mono">config.json</dd><dt>分组与名称</dt><dd class="mono">data/panel.json</dd><dt>冲突备份</dt><dd class="mono">data/conflict-backups/</dd></dl>
        </div>
        <div class="modal-foot"><a class="btn btn-ghost" href="https://mutagen.io/documentation/synchronization" target="_blank" rel="noreferrer">${icon('link', 'i-sm')}mutagen 官方文档</a><span class="spacer"></span><button class="btn btn-primary" data-close>知道了</button></div>`,
    });
  }

  // ------------------------------------------------------------ command palette
  let paletteLayer = null;

  function paletteCommands() {
    return [
      { ic: 'plus', label: '新建同步会话', kw: 'new create xinjian', hint: 'N', run: () => openSessionForm(null) },
      { ic: 'refresh', label: '立即同步全部会话', kw: 'flush sync all tongbu', run: () => actions['flush-all']() },
      { ic: 'pause', label: '暂停全部会话', kw: 'pause all zanting', run: () => actions['pause-all']() },
      { ic: 'play', label: '恢复全部会话', kw: 'resume all huifu', run: () => actions['resume-all']() },
      { ic: 'alert', label: '只看需要关注的会话', kw: 'filter attention error conflict 冲突 报错', run: () => { ui.filterStatus = 'attention'; saveUi(); render(); } },
      { ic: 'filter', label: '清除筛选', kw: 'clear filter', run: () => actions['clear-filters']() },
      { ic: ui.view === 'grid' ? 'rows' : 'grid', label: ui.view === 'grid' ? '切换到列表视图' : '切换到卡片视图', kw: 'view list grid 视图', run: () => { ui.view = ui.view === 'grid' ? 'list' : 'grid'; saveUi(); render(); } },
      { ic: 'sun', label: '切换主题（跟随系统 / 浅色 / 深色）', kw: 'theme dark light 深色 浅色', run: () => actions.theme() },
      { ic: 'tree', label: '服务器文件管理', kw: 'files remote browse tree 文件 目录 浏览', run: () => openFileManager({}) },
      { ic: 'key', label: 'SSH 免密登录向导', kw: 'ssh key wizard 密钥', run: () => openSshWizard() },
      { ic: 'layers', label: '管理分组', kw: 'group fenzu', run: () => openGroupsManager() },
      { ic: 'log', label: '命令日志', kw: 'log rizhi', run: () => openLogs() },
      { ic: 'settings', label: '设置', kw: 'settings config shezhi idea 根目录 通知', run: () => openSettings() },
      { ic: 'rotate', label: '重启 mutagen 守护进程', kw: 'daemon restart', run: () => actions.daemon({ dataset: { op: 'restart' } }) },
      { ic: 'info', label: '关于与快捷键', kw: 'about help shortcut', run: () => openAbout() },
    ];
  }

  function sessionCommands(v) {
    const id = v.id;
    const run = (name, dataset = {}) => () => actions[name]({ dataset }, id);
    const list = [];
    const add = (ic, label, kw, fn, danger = false) => list.push({ ic, label, kw, run: fn, danger, session: v });
    if (v.paused) add('play', '恢复同步', 'resume huifu', run('resume'));
    else {
      add('refresh', '立即同步', 'flush sync tongbu', run('flush'));
      add('pause', '暂停', 'pause zanting', run('pause'));
    }
    add('info', '查看详情', 'detail xiangqing', run('details'));
    if (v.conflicts) add('alert', `处理冲突（${v.conflicts} 处）`, 'conflict chongtu', () => openDetail(id, 'conflicts'));
    if (v.local.isLocal) {
      add('code', '用 VS Code 打开', 'vscode code', run('open', { with: 'vscode', path: v.local.path }));
      add('code', '用 IntelliJ IDEA 打开', 'idea intellij', run('open', { with: 'idea', path: v.local.path }));
      add('folder', '在资源管理器中打开', 'explorer folder 文件夹', run('open', { with: 'explorer', path: v.local.path }));
      add('terminal', '在本地终端打开', 'terminal powershell 终端', run('open', { with: 'terminal', path: v.local.path }));
    }
    if (v.remote.protocol === 'ssh') add('server', '打开服务器终端', 'ssh remote terminal 终端', run('remote-term'));
    if (v.remote.protocol === 'ssh') add('tree', '浏览服务器文件', 'files browse remote 文件 目录', run('remote-files'));
    add('copy', '复制本地路径', 'copy path 复制', run('copy', { text: v.local.path }));
    add('edit', '编辑配置', 'edit bianji', run('edit'));
    add('copyPlus', '以此配置新建会话', 'duplicate clone 复制', run('duplicate'));
    add('tag', '重命名', 'rename', run('rename'));
    add('trash', '删除会话…', 'delete remove shanchu 删除服务器目录', run('delete'), true);
    return list;
  }

  function openPalette() {
    if (paletteLayer) { paletteLayer.close(); return; }
    const st = { q: '', session: null, idx: 0, selectable: [] };
    paletteLayer = openLayer({
      type: 'palette',
      html: `<div class="cmdk-input">${icon('search')}<span class="cmdk-crumb hidden" data-m="crumb"></span><input data-m="q" placeholder="搜索会话或命令…" spellcheck="false" autocomplete="off"><kbd>Esc</kbd></div>
        <div class="cmdk-list" data-m="list"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd>选择</span><span><kbd>Enter</kbd>执行</span><span data-m="back"><kbd>Backspace</kbd>返回</span><span class="spacer"></span><span>输入会话名 + 操作，如「网关 vs」</span></div>`,
      onClose: () => { paletteLayer = null; },
      mount(panel, layer) {
        const q = (m) => panel.querySelector(`[data-m="${m}"]`);
        const input = q('q');
        const list = q('list');
        const has = (hay, tokens) => tokens.every((t) => hay.includes(t));
        const sessionHay = (v) => `${v.title} ${v.remote.hostLabel} ${v.remote.path} ${v.local.path}`.toLowerCase();

        function build() {
          const tokens = st.q.toLowerCase().split(/\s+/).filter(Boolean);
          const out = [];
          if (st.session) {
            const v = VIEWS.get(st.session) || null;
            if (!v) { st.session = null; return build(); }
            sessionCommands(v).filter((a) => has(`${a.label} ${a.kw}`.toLowerCase(), tokens)).forEach((a) => out.push({ ...a, session: null }));
            return out;
          }
          const sessions = [...VIEWS.values()].sort(sortViews);
          const cmds = paletteCommands();
          const sm = tokens.length ? sessions.filter((v) => has(sessionHay(v), tokens)) : sessions;
          const cm = tokens.length ? cmds.filter((c) => has(`${c.label} ${c.kw}`.toLowerCase(), tokens)) : cmds;
          const am = [];
          if (tokens.length) {
            sessions.forEach((v) => {
              const sh = sessionHay(v);
              if (has(sh, tokens)) return;
              sessionCommands(v).forEach((a) => { if (has(`${sh} ${a.label} ${a.kw}`.toLowerCase(), tokens)) am.push(a); });
            });
          }
          if (sm.length) { out.push({ sec: '会话' }); sm.forEach((v) => out.push({ drill: v })); }
          if (am.length) { out.push({ sec: '会话操作' }); am.slice(0, 30).forEach((a) => out.push(a)); }
          if (cm.length) { out.push({ sec: '命令' }); cm.forEach((c) => out.push(c)); }
          return out;
        }

        function itemHtml(it, i) {
          if (it.sec) return `<div class="cmdk-sec">${esc(it.sec)}</div>`;
          if (it.drill) {
            const v = it.drill;
            return `<button class="cmdk-item" data-i="${i}"><i class="sdot" style="background:${STATUS_COLOR[v.status.kind]}"></i><span class="lbl"><span>${esc(v.title)}</span><small>${esc(v.remote.isLocal ? v.remote.path : `${v.remote.hostLabel}:${v.remote.path}`)} ${v.flow === 'both' ? '⇄' : v.flow === 'right' ? '→' : '←'} ${esc(v.local.path)}</small></span><span class="muted" style="font-size:12px">${esc(v.status.text)}</span><span class="go">${icon('chevronRight', 'i-sm')}</span></button>`;
          }
          const ctx = it.session ? `<span class="ctx">${esc(it.session.title)} › </span>` : '';
          return `<button class="cmdk-item ${it.danger ? 'danger' : ''}" data-i="${i}">${icon(it.ic)}<span class="lbl"><span>${ctx}${esc(it.label)}</span></span>${it.hint ? `<kbd>${esc(it.hint)}</kbd>` : ''}</button>`;
        }

        function draw() {
          const items = build();
          st.selectable = items.filter((x) => !x.sec);
          if (st.idx >= st.selectable.length) st.idx = Math.max(0, st.selectable.length - 1);
          let i = -1;
          list.innerHTML = items.length
            ? items.map((it) => (it.sec ? itemHtml(it) : itemHtml(it, (i += 1)))).join('')
            : `<div class="cmdk-empty">没有匹配「${esc(st.q)}」的会话或命令</div>`;
          const v = st.session && VIEWS.get(st.session);
          q('crumb').classList.toggle('hidden', !v);
          q('crumb').innerHTML = v ? `<span>${esc(v.title)}</span>` : '';
          q('back').classList.toggle('hidden', !v);
          input.placeholder = v ? '搜索操作…' : '搜索会话或命令…';
          highlight();
        }

        function highlight() {
          $$('.cmdk-item', list).forEach((el) => el.classList.toggle('active', Number(el.dataset.i) === st.idx));
          const el = list.querySelector(`.cmdk-item[data-i="${st.idx}"]`);
          if (!el) return;
          /** Scroll only the list; scrollIntoView would also scroll the page behind the fixed layer. */
          const top = el.offsetTop - list.offsetTop;
          if (top < list.scrollTop + 28) list.scrollTop = Math.max(0, top - 28);
          else if (top + el.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + el.offsetHeight - list.clientHeight + 6;
        }

        function exec(i) {
          const it = st.selectable[i];
          if (!it) return;
          if (it.drill) {
            st.session = it.drill.id;
            st.q = '';
            st.idx = 0;
            input.value = '';
            draw();
            input.focus();
            return;
          }
          layer.close();
          setTimeout(() => it.run(), 0);
        }

        input.addEventListener('input', () => { st.q = input.value; st.idx = 0; draw(); });
        input.addEventListener('keydown', (e) => {
          const n = st.selectable.length;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (n) { st.idx = (st.idx + 1) % n; highlight(); }
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (n) { st.idx = (st.idx - 1 + n) % n; highlight(); }
          } else if (e.key === 'Enter') {
            e.preventDefault();
            exec(st.idx);
          } else if (e.key === 'Backspace' && !input.value && st.session) {
            e.preventDefault();
            st.session = null;
            st.idx = 0;
            draw();
          }
        });
        list.addEventListener('mousemove', (e) => {
          const el = e.target.closest('.cmdk-item');
          if (el && Number(el.dataset.i) !== st.idx) { st.idx = Number(el.dataset.i); highlight(); }
        });
        list.addEventListener('click', (e) => {
          const el = e.target.closest('.cmdk-item');
          if (el) exec(Number(el.dataset.i));
        });
        draw();
        setTimeout(() => input.focus(), 30);
      },
    });
  }

  // ------------------------------------------------------------ drag & drop
  const dndDisabled = () => !!(ui.search || ui.filterStatus !== 'all');
  document.addEventListener('mousedown', (e) => {
    const g = e.target.closest('[data-drag]');
    if (!g) return;
    if (dndDisabled()) { toast('清除搜索和状态筛选后才能拖动排序', 'info', { duration: 2000 }); return; }
    g.closest('.card').setAttribute('draggable', 'true');
  });
  document.addEventListener('mouseup', () => { if (!drag) $$('.card[draggable]').forEach((c) => c.removeAttribute('draggable')); });
  const clearMarks = () => $$('.drop-before, .drop-after, .drop-into, .drop-target').forEach((el) => el.classList.remove('drop-before', 'drop-after', 'drop-into', 'drop-target'));
  document.addEventListener('dragstart', (e) => {
    const card = e.target.closest && e.target.closest('.card[draggable]');
    if (!card) return;
    drag = { id: card.dataset.id, target: null };
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.dataset.id);
  });
  document.addEventListener('dragover', (e) => {
    if (!drag) return;
    const chip = e.target.closest('[data-drop-chip]');
    const card = e.target.closest('.card');
    const body = e.target.closest('[data-drop-group]');
    clearMarks();
    drag.target = null;
    if (chip) {
      e.preventDefault();
      chip.classList.add('drop-target');
      drag.target = { type: 'group', groupId: chip.dataset.dropChip };
    } else if (card && card.dataset.id !== drag.id) {
      e.preventDefault();
      const r = card.getBoundingClientRect();
      const before = ui.view === 'list' ? e.clientY < r.top + r.height / 2 : e.clientX < r.left + r.width / 2;
      card.classList.add(before ? 'drop-before' : 'drop-after');
      drag.target = { type: 'card', id: card.dataset.id, before };
    } else if (body && !card) {
      e.preventDefault();
      body.classList.add('drop-into');
      drag.target = { type: 'group', groupId: body.dataset.dropGroup };
    } else if (card) {
      e.preventDefault();
    }
  });
  document.addEventListener('drop', (e) => {
    if (!drag) return;
    e.preventDefault();
    const t = drag.target;
    if (!t) return;
    const ordered = [...VIEWS.values()].sort(sortViews);
    const moving = VIEWS.get(drag.id);
    const list = ordered.filter((v) => v.id !== drag.id);
    let groupId;
    let index;
    if (t.type === 'card') {
      const target = VIEWS.get(t.id);
      groupId = gidOf(target);
      index = list.findIndex((v) => v.id === t.id) + (t.before ? 0 : 1);
    } else {
      groupId = t.groupId;
      let last = -1;
      list.forEach((v, i) => { if (gidOf(v) === groupId) last = i; });
      index = last >= 0 ? last + 1 : list.length;
    }
    list.splice(index, 0, moving);
    const items = list.map((v) => {
      const g = v.id === moving.id ? groupId : gidOf(v);
      return { id: v.id, groupId: g === NONE ? null : g };
    });
    items.forEach((it, i) => {
      const s = sessionOf(it.id);
      if (s) { s._panel.order = i + 1; s._panel.groupId = it.groupId; }
    });
    const moved = gidOf(moving) !== groupId;
    api('POST', '/api/layout', { items }).then(() => {
      if (moved) toast(`已移动到「${groupId === NONE ? '未分组' : (S.groups.find((g) => g.id === groupId) || {}).name}」`, 'ok', { duration: 1600 });
    }).catch((err) => toast(err.message, 'error'));
  });
  document.addEventListener('dragend', () => {
    clearMarks();
    $$('.card.dragging').forEach((c) => c.classList.remove('dragging'));
    $$('.card[draggable]').forEach((c) => c.removeAttribute('draggable'));
    drag = null;
    scheduleRender();
  });

  // ------------------------------------------------------------ path inputs
  const PATH_INPUTS = '[data-m="path"], [data-q="path"], [data-f="spec.local.path"], [data-f="spec.remote.path"], [data-s="localRoot"], [data-s="mutagen"], [data-s^="editors."]';
  /** Pasting from Explorer's "Copy as path" gives "C:\x\y"; insert the bare path so it never needs hand editing. */
  document.addEventListener('paste', (e) => {
    const el = e.target instanceof HTMLInputElement ? e.target : null;
    if (!el || !el.matches(PATH_INPUTS)) return;
    const raw = (e.clipboardData && e.clipboardData.getData('text')) || '';
    const line = raw.split(/\r?\n/).map((x) => x.trim()).find(Boolean) || '';
    const clean = cleanPath(line);
    if (clean === raw) return;
    e.preventDefault();
    const whole = el.selectionStart === 0 && el.selectionEnd === el.value.length;
    el.setRangeText(clean, whole ? 0 : el.selectionStart, whole ? el.value.length : el.selectionEnd, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ------------------------------------------------------------ keyboard & search
  const searchInput = $('#search');
  searchInput.addEventListener('input', debounce(() => { ui.search = searchInput.value.trim(); render(); }, 80));
  document.addEventListener('keydown', (e) => {
    const typing = e.target instanceof Element ? e.target.closest('input, textarea, select, [contenteditable]') : null;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (paletteLayer) paletteLayer.close();
      else if (!layers.length) openPalette();
      return;
    }
    if (e.key === 'Escape') {
      if (!pop.hidden) { closePopover(); return; }
      if (layers.length) { layers[layers.length - 1].close(); return; }
      if (typing === searchInput && searchInput.value) { searchInput.value = ''; ui.search = ''; render(); }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    if ((e.key === 'n' || e.key === 'N') && !layers.length) { e.preventDefault(); openSessionForm(null); }
  });
  document.addEventListener('contextmenu', (e) => {
    const card = e.target instanceof Element ? e.target.closest('#main .card[data-id]') : null;
    if (!card || String(window.getSelection() || '')) { closePopover(); return; }
    e.preventDefault();
    const v = VIEWS.get(card.dataset.id);
    if (v) openPopover({ x: e.clientX, y: e.clientY }, cardMenu(v), v.id);
  });
  window.addEventListener('resize', closePopover);
  window.addEventListener('scroll', closePopover, true);

  setInterval(() => { if (S) scheduleRender(); }, 5000);
  setInterval(checkAlerts, 1000);
  setInterval(() => { if (S && !document.hidden) checkServer(false); }, 10000);
  document.addEventListener('visibilitychange', () => { if (S && !document.hidden) checkServer(false); });

  renderTopActions();
  connect();
})();
