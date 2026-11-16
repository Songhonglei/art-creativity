'use strict';

// 最终验收针对性复核：A 版 logo / favicon、来源文案、瓶子不裁切分支的界面与导出。
// 独立端口，不动 4173 常驻预览；live 分支只用本地 mock 上游，不代表真实模型。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'final');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEMO_PORT = 4174;
const LIVE_PORT = 4175;
const MOCK_PORT = 8789;
const CDP_PORT = 9335;
const DEMO = `http://127.0.0.1:${DEMO_PORT}`;
const LIVE = `http://127.0.0.1:${LIVE_PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ← ' + String(detail).slice(0, 200) : ''));
}
function group(t) { console.log('\n' + t); }

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
async function waitHttp(url, ms) {
  const end = Date.now() + (ms || 10000);
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return true; } catch { /* not ready */ }
    await sleep(120);
  }
  return false;
}
async function evaluate(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面脚本异常：' + JSON.stringify(r.exceptionDetails.exception || {}));
  return r.result.value;
}
async function until(cdp, expr, ms) {
  const end = Date.now() + (ms || 10000);
  while (Date.now() < end) {
    try { if (await evaluate(cdp, expr)) return true; } catch { /* navigating */ }
    await sleep(120);
  }
  return false;
}
async function shot(cdp, filename) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, filename), Buffer.from(r.data, 'base64'));
}
function waitFile(suffix, prefix, ms) {
  return new Promise((resolve) => {
    const end = Date.now() + (ms || 8000);
    const tick = () => {
      const f = fs.readdirSync(OUT).find((n) => n.endsWith(suffix) && (!prefix || n.startsWith(prefix)));
      if (f) return resolve(f);
      if (Date.now() > end) return resolve(null);
      setTimeout(tick, 150);
    };
    tick();
  });
}
function crcTable() {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function makePng(w, h) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0);
  return Buffer.concat([
    sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))
  ]);
}
async function post(port, pathname, payload) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  return { status: res.status, data: await res.json() };
}
const BANNED = ['截高', '切口', '环切', '花瓣片 5 枚', '挂绳长约', '切口需包边'];
const OLD_STEP_LABELS = ['做出敞口', '处理切口边缘', '取下瓶底弧片', '分成花瓣并修形', '做连接点', '排布与悬挂', '准备透明罩', '合罩'];
function bannedHits(text) {
  return BANNED.filter((w) => String(text).includes(w));
}
function planText(p) {
  return JSON.stringify({
    title: p.title, result: p.result, summary: p.summary, diagram: p.diagram,
    materials: p.materials, steps: p.steps, notes: p.notes
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.readdirSync(OUT).forEach((n) => {
    if (/\.(md|png)$/.test(n)) { try { fs.unlinkSync(path.join(OUT, n)); } catch { /* noop */ } }
  });
  const children = [];
  const start = (script, env, port) => {
    const child = spawn(process.execPath, [path.join(ROOT, script)], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(port) }, env),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let log = '';
    child.stdout.on('data', (d) => { log += d.toString(); });
    child.stderr.on('data', (d) => { log += d.toString(); });
    children.push(child);
    return () => log;
  };
  process.on('exit', () => children.forEach((c) => { try { c.kill(); } catch { /* noop */ } }));

  const demoLog = start('server.js', { LLM_BASE_URL: '', LLM_API_KEY: '', LLM_MODEL: '', LLM_VISION: '' }, DEMO_PORT);
  const mockLog = start('scripts/mock-llm.js', { MOCK_PORT: String(MOCK_PORT), MOCK_MODE: 'vision' }, MOCK_PORT);
  const liveLog = start('server.js', {
    LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`, LLM_API_KEY: 'test-key',
    LLM_MODEL: 'mock-upstream-hy4', LLM_VISION: 'true', LLM_TIMEOUT_MS: '4000'
  }, LIVE_PORT);
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=/tmp/upcycle-final-${process.pid}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1280,900', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(chrome);
  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d.toString(); });

  const ready = await waitHttp(`${DEMO}/api/config`) && await waitHttp(`${LIVE}/api/config`) &&
    await waitHttp(`http://127.0.0.1:${MOCK_PORT}/__mode`) && Boolean(await waitCdp());
  check('四个本地服务全部就绪', ready, ready ? '' : (demoLog() + liveLog() + mockLog() + chromeLog).slice(0, 300));
  if (!ready) throw new Error('环境未就绪');
  const cdp = await CDP.connect(await waitCdp());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });

  group('【A 版 logo / favicon】');
  const svgRes = await fetch(`${DEMO}/logo.svg`);
  const svgText = await svgRes.text();
  check('logo.svg 可访问、MIME 正确且为 A 版配色',
    svgRes.status === 200 && /image\/svg\+xml/.test(svgRes.headers.get('content-type') || '') &&
    svgText.includes('#2f6b4f') && svgText.includes('#c9762a') && svgText.includes('17.5'));
  for (const size of [16, 32, 180]) {
    const f = size === 180 ? 'favicon-180.png' : `favicon-${size}.png`;
    const res = await fetch(`${DEMO}/${f}`);
    const buf = Buffer.from(await res.arrayBuffer());
    check(`${f} 可访问且是有效 PNG`,
      res.status === 200 && /image\/png/.test(res.headers.get('content-type') || '') &&
      buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      `HTTP ${res.status} · ${buf.length} bytes`);
  }
  await cdp.send('Page.navigate', { url: DEMO });
  await until(cdp, "document.querySelector('.brand-mark') && document.querySelector('.brand-mark').complete");
  const brand = await evaluate(cdp, "(function(){var m=document.querySelector('.brand-mark');return {tag:m.tagName,src:m.getAttribute('src'),nw:m.naturalWidth,w:m.clientWidth,h:m.clientHeight,text:m.textContent};})()");
  check('左上角是图片 logo，30×30 且加载成功',
    brand.tag === 'IMG' && /logo\.svg$/.test(brand.src) && brand.nw === 64 && brand.w === 30 && brand.h === 30,
    JSON.stringify(brand));
  check('旧的文字「改」方块已移除', brand.text.trim() === '', JSON.stringify(brand.text));
  const icons = await evaluate(cdp, "Array.from(document.querySelectorAll('link[rel=icon], link[rel=apple-touch-icon]')).map(function(l){return l.getAttribute('href');})");
  check('页面声明 SVG + 16/32 PNG + 苹果触屏图标', icons.length === 4 && icons.includes('logo.svg') && icons.includes('favicon-32.png') && icons.includes('favicon-180.png'), icons.join(','));
  await shot(cdp, '01-logo-topbar.png');

  group('【来源文案】示例 / 手填');
  await evaluate(cdp, "document.querySelectorAll('#sampleChips .chip')[0].click()");
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  await until(cdp, "document.getElementById('toggleCorrection').textContent.includes('示例信息')");
  const sampleLabel = await evaluate(cdp, "document.getElementById('toggleCorrection').textContent");
  check('内置示例标「示例信息」，不称识别结果', /示例信息/.test(sampleLabel) && !/识别结果/.test(sampleLabel), sampleLabel);
  check('纠正表单默认收起', await evaluate(cdp, "document.getElementById('recognizedBox').classList.contains('hidden')"));
  const sampleSrc = await post(DEMO_PORT, '/api/ideas', { sampleId: 'carton', item: '', material: '', description: '', tools: ['scissors'], budget: 20 });
  check('示例接口来源是 sample', sampleSrc.data.recognized && sampleSrc.data.recognized.source === 'sample', JSON.stringify(sampleSrc.data.recognized));

  await evaluate(cdp, "(function(){var b=Array.from(document.querySelectorAll('#sampleChips .chip')).find(function(c){return c.classList.contains('on');});if(b)b.click();document.getElementById('itemInput').value='旧铁盒';document.getElementById('materialInput').value='马口铁';return true;})()");
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  const userOk = await until(cdp, "document.getElementById('toggleCorrection').textContent.includes('填写的信息')");
  const userLabel = await evaluate(cdp, "document.getElementById('toggleCorrection').textContent");
  check('手填物品标「填写的信息」，不称识别结果', userOk && !/识别结果/.test(userLabel), userLabel);
  const userSrc = await post(DEMO_PORT, '/api/ideas', { sampleId: null, item: '旧铁盒', material: '马口铁', description: '', tools: ['scissors'], budget: 20 });
  check('手填接口来源是 user', userSrc.data.recognized && userSrc.data.recognized.source === 'user', JSON.stringify(userSrc.data.recognized));

  group('【瓶子 · 仅美工刀 / 预算 20 元】接口');
  const bottleBody = (tools) => ({ sampleId: 'bottle', item: '', material: '', description: '', tools, budget: 20, forbidden: [], extra: '' });
  const noCut = await post(DEMO_PORT, '/api/ideas', bottleBody(['cutter']));
  const np = noCut.data.plans || [];
  check('三个瓶身款式全部可行', noCut.status === 200 && np.length === 3 && (noCut.data.infeasible || []).length === 0, JSON.stringify(noCut.data.infeasible));
  for (const p of np) {
    const hits = bannedHits(planText(p));
    check(`${p.lane} 全字段无裁切版残留`, hits.length === 0, hits.join('/'));
    check(`${p.lane} 结构图切成整瓶版`, p.diagram.whole === true && p.diagram.h === 230 && p.diagram.labels.some((l) => /整瓶|竖排/.test(l)), JSON.stringify(p.diagram));
    check(`${p.lane} 步骤标题已是整瓶做法`, !p.steps.some((s) => OLD_STEP_LABELS.includes(s.label)), p.steps.map((s) => s.label).join('→'));
    check(`${p.lane} 材料不含包边胶带`, !p.materials.some((m) => /包住切口|布基胶带/.test(m.name + m.note)), JSON.stringify(p.materials));
    check(`${p.lane} 注意点不再提新切口`, !p.notes.some((n) => /切口可能锋利|必须包边或修齐/.test(n)), p.notes.join('/'));
  }
  const withEdge = await post(DEMO_PORT, '/api/ideas', bottleBody(['cutter', 'tape', 'scissors']));
  const practicalCut = (withEdge.data.plans || []).find((p) => p.lane === 'practical');
  check('有收边条件时实用款仍走裁切版（没有一刀切改成整瓶）',
    Boolean(practicalCut) && /桌面小件收纳筒/.test(practicalCut.title) &&
    practicalCut.steps.some((s) => s.label === '处理切口边缘') && practicalCut.diagram.whole !== true,
    practicalCut ? practicalCut.steps.map((s) => s.label).join('→') : 'missing');

  group('【瓶子 · 仅美工刀】界面与导出');
  await cdp.send('Page.navigate', { url: DEMO });
  await until(cdp, "document.querySelectorAll('#sampleChips .chip').length===3");
  const toolState = await evaluate(cdp, "(function(){var b=Array.from(document.querySelectorAll('#sampleChips .chip')).find(function(c){return c.textContent.indexOf('透明饮料瓶')>=0;});b.click();for(var i=0;i<20;i++){var on=Array.from(document.querySelectorAll('#toolChips .chip.on, #toolMore .chip.on')).find(function(c){return c.textContent.trim()!=='美工刀';});if(!on)break;on.click();}var k=Array.from(document.querySelectorAll('#toolChips .chip, #toolMore .chip')).find(function(c){return c.textContent.trim()==='美工刀';});if(k&&!k.classList.contains('on'))k.click();document.getElementById('budgetInput').value='20';return Array.from(document.querySelectorAll('#toolChips .chip.on, #toolMore .chip.on')).map(function(c){return c.textContent.trim();});})()");
  check('界面工具确实只剩美工刀', toolState.length === 1 && toolState[0] === '美工刀', toolState.join(','));
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  await until(cdp, "document.querySelectorAll('#cards .card h3').length===3");
  const cardTitles = await evaluate(cdp, "Array.from(document.querySelectorAll('#cards .card h3')).map(function(x){return x.textContent;})");
  check('三张卡标题都是整瓶版（不是裁切版）', cardTitles.every((t) => /整瓶/.test(t)) && cardTitles.length === 3, cardTitles.join(' | '));
  await shot(cdp, '02-bottle-cards.png');
  await evaluate(cdp, "document.querySelector('#cards .card-actions .primary-btn').click()");
  await until(cdp, "!document.getElementById('viewDetail').classList.contains('hidden')");
  const detail = await evaluate(cdp, "(function(){var d=document.getElementById('viewDetail');var s=d.querySelector('#detailDiagram svg');return {text:d.innerText,svg:s?s.textContent:'',labels:s?Array.from(s.querySelectorAll('text')).map(function(t){return t.textContent;}):[]};})()");
  const pageHits = bannedHits(detail.text).concat(bannedHits(detail.svg));
  check('详情页与结构图都不再出现切口 / 截高 / 环切', pageHits.length === 0, pageHits.join('/') + ' :: ' + detail.labels.join('|'));
  check('结构图标注是整瓶版', detail.labels.some((t) => /整瓶|竖排/.test(t)) && detail.labels.some((t) => /未裁切/.test(t)), detail.labels.join(' | '));
  check('详情页写明不需要包边、原厂瓶口', /不需要包边/.test(detail.text) && /原厂边缘/.test(detail.text));
  await shot(cdp, '03-bottle-detail.png');

  await evaluate(cdp, "document.getElementById('downloadMd').click()");
  const mdFile = await waitFile('.md', '万物改造局-制作清单-');
  let mdText = '';
  if (mdFile) mdText = fs.readFileSync(path.join(OUT, mdFile), 'utf8');
  check('制作清单 Markdown 真实下载且无裁切版残留',
    Boolean(mdFile) && mdText.includes('# 制作清单') && bannedHits(mdText).length === 0 && /整瓶/.test(mdText),
    mdFile ? mdText.split('\n').slice(0, 4).join(' / ') : '未生成');
  await evaluate(cdp, "document.getElementById('shareBtn').click()");
  const canvasReady = await until(cdp, "document.querySelectorAll('#canvasWrap canvas').length===1");
  const canvasInfo = canvasReady ? await evaluate(cdp, "(function(){var c=document.querySelector('#canvasWrap canvas');return {w:c.width,h:c.height,len:c.toDataURL('image/png').length};})()") : {};
  check('分享卡 Canvas 真正绘制出 PNG', canvasReady && canvasInfo.len > 100000, JSON.stringify(canvasInfo));
  await evaluate(cdp, "document.getElementById('downloadPng').click()");
  const pngFile = await waitFile('.png', '万物改造局-分享卡-');
  check('分享卡 PNG 真实下载', Boolean(pngFile), pngFile || '未生成');

  group('【真实视觉返回才称识别结果】本地模拟上游');
  await cdp.send('Page.navigate', { url: LIVE });
  await until(cdp, "document.getElementById('modeBadge').textContent.includes('已连接模型')");
  const pngBytes = Array.from(makePng(32, 32));
  await evaluate(cdp, "(function(){var dt=new DataTransfer();dt.items.add(new File([new Uint8Array(" + JSON.stringify(pngBytes) + ")],'bottle.png',{type:'image/png'}));var i=document.getElementById('fileInput');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await until(cdp, "!document.getElementById('previewWrap').classList.contains('hidden')");
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  const visionOk = await until(cdp, "document.getElementById('toggleCorrection').textContent.includes('识别结果')", 12000);
  const visionLabel = await evaluate(cdp, "document.getElementById('toggleCorrection').textContent");
  check('模型视觉返回时才标「识别结果」', visionOk && !/示例信息|填写的信息/.test(visionLabel), visionLabel);
  const visionSrc = await post(LIVE_PORT, '/api/ideas', Object.assign(bottleBody(['scissors']), { sampleId: null, item: '', image: 'data:image/png;base64,' + Buffer.from(pngBytes).toString('base64') }));
  check('视觉接口来源是 vision 且 visionUsed 为真',
    visionSrc.data.recognized && visionSrc.data.recognized.source === 'vision' && visionSrc.data.visionUsed === true,
    JSON.stringify(visionSrc.data.recognized));
  check('live 响应标注为模型链路（上游是本地 mock，不宣称真实模型）',
    visionSrc.data.mode === 'live' && visionSrc.data.source === 'llm');

  console.log('\n截图与下载产物：' + OUT);
  console.log(`结果：${pass} 通过 / ${fail} 失败`);
  if (fail) { console.log('失败项：\n - ' + failures.join('\n - ')); }
  cdp.close();
  children.forEach((c) => { try { c.kill(); } catch { /* noop */ } });
  if (fail) process.exit(1);
}
main().catch((err) => { console.error('验证脚本异常：' + err.stack); process.exit(1); });
