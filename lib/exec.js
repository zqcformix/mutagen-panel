'use strict';

const { spawn } = require('node:child_process');

/** Runs a program without a shell so paths with spaces or quotes never need escaping. */
function run(file, args = [], opts = {}) {
  const { timeout = 60000, input, cwd, env } = opts;
  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = '';
    let stderr = '';
    let finished = false;
    let timedOut = false;
    let child;
    try {
      child = spawn(file, args, { cwd, env: env || process.env, windowsHide: true });
    } catch (error) {
      resolve({ code: -1, stdout: '', stderr: String(error.message || error), ms: 0, error });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve({ stdout, ms: Date.now() - started, ...result });
    };
    child.on('error', (error) => finish({ code: -1, stderr: `${stderr}${error.message}`, error }));
    child.on('close', (code) => finish({
      code: timedOut ? -2 : code,
      stderr: timedOut ? `${stderr}\n[超时，已终止]` : stderr,
      timedOut,
    }));
    child.stdin.on('error', () => {});
    if (input != null) child.stdin.end(input);
    else child.stdin.end();
  });
}

function quoteForDisplay(arg) {
  const a = String(arg);
  if (a === '') return '""';
  return /[\s"'`$&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a;
}

function displayCmd(bin, args) {
  return [bin, ...args].map(quoteForDisplay).join(' ');
}

/** Mutagen redraws progress with carriage returns; keep only the final state of each line. */
function cleanOutput(text) {
  return String(text || '')
    .replace(/\x1b\[[0-9;]*m/g, '')
    .split(/\n/)
    .map((line) => {
      const parts = line.split('\r').map((p) => p.trim()).filter(Boolean);
      return parts.length ? parts[parts.length - 1] : '';
    })
    .filter(Boolean)
    .join('\n');
}

module.exports = { run, displayCmd, cleanOutput, quoteForDisplay };
