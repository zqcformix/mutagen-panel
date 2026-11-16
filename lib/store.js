'use strict';

const fs = require('node:fs');
const path = require('node:path');

class Store {
  constructor(file) {
    this.file = file;
    this.data = { version: 1, groups: [], sessions: {} };
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = {
        version: 1,
        groups: Array.isArray(parsed.groups) ? parsed.groups : [],
        sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        const backup = `${this.file}.broken-${Date.now()}`;
        try { fs.copyFileSync(this.file, backup); } catch { /* ignore */ }
        console.error(`面板数据文件损坏，已备份到 ${backup}`);
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store };
