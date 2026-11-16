'use strict';

// 从 public/logo.svg 渲染 PNG 兜底图标（Safari 等不支持 SVG favicon 的环境）。
// 用本机 Chrome 的 Canvas 绘制，保证 PNG 与 SVG 是同一份图形，不另画一套。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const PUB = path.join(ROOT, 'public');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = 9334;
const SIZES = [16, 32, 180];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      }
    });
  }
  static async connect(url) {
    const c = new CDP(url);
    await new Promise((resolve, reject) => {
      c.ws.addEventListener('open', resolve, { once: true });
      c.ws.addEventListener('error', reject, { once: true });
    });
    return c;
  }
  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  close() { try { this.ws.close(); } catch { /* noop */ } }
}

async function waitCdp(ms) {
  const end = Date.now() + (ms || 12000);
  while (Date.now() < end) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not ready */ }
    await sleep(150);
  }
  return null;
}

async function main() {
  const svg = fs.readFileSync(path.join(PUB, 'logo.svg'), 'utf8');
  const profile = `/tmp/upcycle-favicon-${process.pid}`;
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  const cleanup = () => { try { chrome.kill(); } catch { /* noop */ } };
  process.on('exit', cleanup);

  const wsUrl = await waitCdp();
  if (!wsUrl) throw new Error('无头 Chrome 未就绪');
  const cdp = await CDP.connect(wsUrl);
  await cdp.send('Runtime.enable');

  const expr = `(async function () {
    var svgText = ${JSON.stringify(svg)};
    var img = new Image();
    await new Promise(function (resolve, reject) {
      img.onload = resolve;
      img.onerror = function () { reject(new Error('SVG 未能加载')); };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
    });
    var out = {};
    ${JSON.stringify(SIZES)}.forEach(function (size) {
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      out[size] = canvas.toDataURL('image/png');
    });
    return out;
  })()`;
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('渲染失败：' + JSON.stringify(r.exceptionDetails.exception || {}));
  const data = r.result.value;
  for (const size of SIZES) {
    const b64 = String(data[size] || '').split(',')[1];
    if (!b64) throw new Error(`${size}px PNG 生成失败`);
    const file = path.join(PUB, size === 180 ? 'favicon-180.png' : `favicon-${size}.png`);
    fs.writeFileSync(file, Buffer.from(b64, 'base64'));
    console.log(`生成 ${path.basename(file)} · ${size}×${size} · ${fs.statSync(file).size} bytes`);
  }
  cdp.close();
  cleanup();
}

main().catch((err) => { console.error(err.message); process.exit(1); });
