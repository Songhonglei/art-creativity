'use strict';

// 线上真实验证：用无头 Chrome 打开 CloudBase 页面，确认跨域接口在浏览器里真的可用。
// curl 只能证明服务端；CORS 客户端行为必须靠浏览器。截图落 output/final/。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'output', 'final');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CDP_PORT = Number(process.env.CDP_PORT || 9336);
const PAGE = process.env.UPCYCLE_URL
  || 'https://evansongdev-d3gwank9e76835e8b-1343046532.tcloudbaseapp.com/upcycle/';

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ← ' + String(detail).slice(0, 180) : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    this.ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
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

async function waitCdp(port, ms) {
  const end = Date.now() + (ms || 15000);
  while (Date.now() < end) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not ready */ }
    await sleep(150);
  }
  return null;
}
async function evaluate(cdp, expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('页面脚本异常：' + (r.exceptionDetails.text || ''));
  return r.result.value;
}
async function until(cdp, expr, ms) {
  const end = Date.now() + (ms || 15000);
  while (Date.now() < end) {
    try { if (await evaluate(cdp, expr)) return true; } catch { /* navigating */ }
    await sleep(150);
  }
  return false;
}
async function shot(cdp, filename) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, filename), Buffer.from(r.data, 'base64'));
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = `/tmp/upcycle-cloud-chrome-${process.pid}`;
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1280,900', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d; });
  process.on('exit', () => { try { chrome.kill(); } catch { /* noop */ } });

  const wsUrl = await waitCdp(CDP_PORT);
  check('无头 Chrome 就绪', Boolean(wsUrl), chromeLog.slice(0, 200));
  if (!wsUrl) throw new Error('Chrome CDP 未就绪');

  const cdp = await CDP.connect(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');

  const url = PAGE + (PAGE.includes('?') ? '&' : '?') + 'v=' + Date.now();
  await cdp.send('Page.navigate', { url });
  console.log('\n【线上页面加载】' + url);

  // CloudBase 默认测试域名首次访问有「风险提醒」中间页：等 3 秒倒计时后按真实用户行为点「确定访问」。
  let riskDismissed = false;
  for (let i = 0; i < 2; i++) {
    const onRisk = await until(cdp, "document.getElementById('submitBtn')!==null", 6000);
    if (!onRisk) break;
    if (i === 0) await shot(cdp, 'cloud-00-risk-notice.png');
    const enabled = await until(cdp, "(function(){var b=document.getElementById('submitBtn');return b && !b.disabled;})()", 8000);
    if (!enabled) break;
    await evaluate(cdp, "document.getElementById('submitBtn').click()");
    await sleep(2500);
    riskDismissed = true;
    if (!(await evaluate(cdp, "document.getElementById('submitBtn')!==null"))) break;
  }
  console.log('  测试域名中间页：' + (riskDismissed ? '已按「确定访问」通过（首次访问需点一次）' : '未出现'));
  cdp.events.length = 0;

  const cfgOk = await until(cdp, "document.getElementById('modeBadge') && /示例模式|已连接模型/.test(document.getElementById('modeBadge').textContent)", 20000);
  check('配置接口跨域读取成功（模式徽标已更新）', cfgOk);
  if (!cfgOk) {
    const diag = await evaluate(cdp, "(function(){var b=document.getElementById('modeBadge');var e=document.getElementById('homeError');return {href:location.href,ready:document.readyState,title:document.title,badge:b?b.textContent:'(无徽标)',err:e?e.textContent:'',text:(document.body?document.body.innerText:'').slice(0,240)};})()");
    const netErrors = cdp.events.filter((e) => e.method === 'Network.loadingFailed' || (e.method === 'Log.entryAdded' && (e.params.entry || {}).level === 'error'));
    console.log('  诊断：' + JSON.stringify(diag));
    console.log('  网络/控制台错误：' + JSON.stringify(netErrors.slice(0, 6)).slice(0, 900));
    cdp.close(); chrome.kill();
    process.exit(1);
  }

  const head = await evaluate(cdp, "(function(){var m=document.querySelector('meta[name=\"upcycle-api-base\"]');var l=document.querySelector('.brand-mark');var b=document.getElementById('modeBadge');return {title:document.title,api:m?m.getAttribute('content'):'',logoTag:l?l.tagName:'',logoOk:l&&l.tagName==='IMG'?l.naturalWidth>0:false,badge:b?b.textContent:''};})()");
  check('页面标题正确', /万物改造局/.test(head.title), head.title);
  check('API 网关地址已注入线上页面', /ap-shanghai\.app\.tcloudbase\.com\/upcycle\/api/.test(head.api), head.api);
  check('A 版 logo 在线上正常显示', head.logoOk, head.logoTag + ' / ' + head.badge);

  console.log('\n【生成 → 详情 → 分享卡】');
  await evaluate(cdp, "document.querySelectorAll('.sample-chip')[0].click()");
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  const cards = await until(cdp, "document.querySelectorAll('#cards .card').length===3", 60000);
  const cardInfo = cards ? await evaluate(cdp, "(function(){var cs=[].slice.call(document.querySelectorAll('#cards .card'));return {titles:cs.map(c=>c.querySelector('h3').textContent),notice:document.getElementById('noticeBox').textContent};})()") : { titles: [], notice: '' };
  check('线上生成三种改造方案（跨域 POST 成功）', cards, cardInfo.titles.join(' | '));
  check('三张卡标题互不相同', new Set(cardInfo.titles).size === 3, cardInfo.titles.join(' | '));
  const isLive = /已连接模型/.test(head.badge);
  const demoMentions = cards ? await evaluate(cdp, "(function(){var v=document.getElementById('viewResults');return [].slice.call(v.querySelectorAll('*')).filter(function(e){return e.children.length===0 && /没有调用模型|未做图像识别|未配置模型/.test(e.textContent||'');}).length;})()") : 0;
  if (isLive) {
    check('模型模式结果页不伪装成示例、不谎称识图',
      demoMentions === 0 && !/没有调用模型|未配置模型/.test(cardInfo.notice),
      '说明元素数=' + demoMentions + ' · ' + cardInfo.notice.slice(0, 100));
  } else {
    check('结果页示例说明只有一处且不谎称识图',
      demoMentions <= 1 && /没有调用模型/.test(cardInfo.notice),
      '说明元素数=' + demoMentions + ' · ' + cardInfo.notice.slice(0, 100));
  }
  await shot(cdp, 'cloud-01-results.png');

  if (cards) {
    await evaluate(cdp, "document.querySelector('#cards .card .card-actions .primary-btn').click()");
    const detail = await until(cdp, "document.querySelectorAll('#stepList .step-item').length>=3", 15000);
    const d = detail ? await evaluate(cdp, "(function(){return {steps:document.querySelectorAll('#stepList .step-item').length,diag:document.querySelectorAll('#detailDiagram svg').length,mats:document.querySelectorAll('#materialList .mat-line').length};})()") : {};
    check('详情页步骤 / 图示 / 材料齐全', detail && d.steps >= 3 && d.diag >= 1 && d.mats >= 1, JSON.stringify(d));
    await shot(cdp, 'cloud-02-detail.png');

    await evaluate(cdp, "document.getElementById('shareBtn').click()");
    const canvas = await until(cdp, "document.querySelectorAll('#canvasWrap canvas').length===1", 15000);
    const ci = canvas ? await evaluate(cdp, "(function(){var c=document.querySelector('#canvasWrap canvas');var u=c.toDataURL('image/png');return {len:u.length,prefix:u.slice(0,22),layout:!!c.__layout};})()") : {};
    check('分享卡 Canvas 在线上真实绘制', canvas && ci.len > 100000 && ci.prefix.startsWith('data:image/png'), JSON.stringify(ci));
    await shot(cdp, 'cloud-03-share.png');
    await evaluate(cdp, "document.getElementById('closeShare').click()");
  }

  console.log('\n【控制台错误 / 手机视口】');
  const bad = cdp.events.filter((e) => {
    if (e.method === 'Log.entryAdded') {
      const x = e.params.entry || {};
      return x.level === 'error' && /CORS|Access-Control|Failed to fetch|net::ERR|has been blocked/i.test(x.text || '');
    }
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      return (e.params.args || []).some((a) => /CORS|Access-Control|Failed to fetch|net::ERR/i.test(String(a.value || a.description || '')));
    }
    return false;
  });
  check('浏览器无 CORS / 网络错误', bad.length === 0, JSON.stringify(bad.slice(0, 2)).slice(0, 220));

  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  const mobile = await evaluate(cdp, "(function(){return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth};})()");
  check('375px 视口无横向溢出', mobile.sw <= mobile.cw + 1, JSON.stringify(mobile));
  await shot(cdp, 'cloud-04-375.png');

  console.log('\n' + '='.repeat(52));
  console.log(`线上验证：${pass} 通过 / ${fail} 失败`);
  if (failures.length) failures.forEach((f) => console.log('  ✗ ' + f));
  console.log('截图目录：' + OUT);
  cdp.close();
  chrome.kill();
  if (fail) process.exit(1);
}

main().catch((e) => { console.error('验证异常：' + (e && e.stack || e)); process.exit(1); });
