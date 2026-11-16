'use strict';

// 浏览器层验证：用本机 Chrome 的 CDP 真实点击页面、检查 localStorage / Canvas / 下载 / 375px 视口。
// 不依赖 npm 包；截图落在 app/output/。
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'output');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// 可用环境变量换端口：本机 4173 是常驻预览位，回归时避免占用/重启它。
const APP_PORT = Number(process.env.UPCYCLE_TEST_PORT) || 4173;
const CDP_PORT = Number(process.env.UPCYCLE_TEST_CDP_PORT) || 9333;
const APP = `http://127.0.0.1:${APP_PORT}`;

let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail) {
  if (ok) pass++; else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); }
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ← ' + String(detail).slice(0, 160) : ''));
}
function group(t) { console.log('\n' + t); }
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
      } else if (msg.method) {
        this.events.push(msg);
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

async function waitCdp(port, ms) {
  const end = Date.now() + (ms || 12000);
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
  if (r.exceptionDetails) {
    throw new Error('页面脚本异常：' + (r.exceptionDetails.text || '') + ' ' + JSON.stringify(r.exceptionDetails.exception || {}));
  }
  return r.result.value;
}
async function until(cdp, expr, ms) {
  const end = Date.now() + (ms || 10000);
  while (Date.now() < end) {
    try { if (await evaluate(cdp, expr)) return true; } catch { /* page may be navigating */ }
    await sleep(120);
  }
  return false;
}
async function shot(cdp, filename) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(OUT, filename), Buffer.from(r.data, 'base64'));
}
function fileWith(suffix, prefix) {
  const names = fs.readdirSync(OUT).filter((n) => n.endsWith(suffix) && (!prefix || n.startsWith(prefix)));
  return names.length ? names[0] : null;
}
async function waitFile(suffix, prefix, ms) {
  const end = Date.now() + (ms || 8000);
  while (Date.now() < end) {
    const f = fileWith(suffix, prefix);
    if (f) return f;
    await sleep(150);
  }
  return null;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  // 清掉上次验证产生的下载文件，避免误判
  fs.readdirSync(OUT).forEach((n) => {
    if (/\.(md|png)$/.test(n)) { try { fs.unlinkSync(path.join(OUT, n)); } catch { /* noop */ } }
  });

  const children = [];
  process.on('exit', () => children.forEach((c) => { try { c.kill(); } catch { /* noop */ } }));

  const app = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      PORT: String(APP_PORT), LLM_BASE_URL: '', LLM_API_KEY: '', LLM_MODEL: '', LLM_VISION: ''
    }),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  children.push(app);
  let appLog = '';
  app.stdout.on('data', (d) => { appLog += d; });
  app.stderr.on('data', (d) => { appLog += d; });

  const profile = `/tmp/upcycle-chrome-${process.pid}`;
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1280,900', 'about:blank'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(chrome);
  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d; });

  const httpOk = await waitHttp(`${APP}/api/config`);
  const wsUrl = await waitCdp(CDP_PORT);
  check('本地服务与无头 Chrome 就绪', httpOk && Boolean(wsUrl), wsUrl ? '' : (appLog + ' ' + chromeLog).slice(0, 300));
  if (!httpOk || !wsUrl) throw new Error('环境未就绪');

  const cdp = await CDP.connect(wsUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT, eventsEnabled: true });
  await cdp.send('Page.navigate', { url: APP });
  check('首页加载完成', await until(cdp, "document.getElementById('modeBadge') && document.getElementById('modeBadge').textContent.includes('示例模式')"));

  group('【桌面】首页与空输入 / 非法图片');
  let homeWidth = await evaluate(cdp, 'document.documentElement.scrollWidth');
  check('桌面首页无横向溢出', homeWidth <= 1280, 'scrollWidth=' + homeWidth);
  await shot(cdp, '01-home-desktop.png');
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  await sleep(250);
  const emptyErr = await evaluate(cdp, "document.getElementById('homeError').textContent");
  check('空输入给出明确提示', /先放一张照片/.test(emptyErr), emptyErr);
  const fakeFile = "(function(){var dt=new DataTransfer();dt.items.add(new File([new Uint8Array([1,2,3,4,5,6,7,8])],'fake.png',{type:'image/png'}));var i=document.getElementById('fileInput');i.files=dt.files;i.dispatchEvent(new Event('change'));return true;})()";
  await evaluate(cdp, fakeFile);
  await sleep(400);
  const imgErr = await evaluate(cdp, "document.getElementById('homeError').textContent");
  check('非法图片在前端被拦下', /文件内容不是有效图片|图片|文件头/.test(imgErr), imgErr);
  await evaluate(cdp, "document.getElementById('clearPhoto').click()");

  group('【反馈 5】常用工具直达 / 更多工具（N）');
  const toolGroups = await evaluate(cdp, "(function(){return {main:document.querySelectorAll('#toolChips .chip').length,moreHidden:document.getElementById('toolMore').classList.contains('hidden'),btnHidden:document.getElementById('moreToolsBtn').classList.contains('hidden'),btn:document.getElementById('moreToolsBtn').textContent,moreCount:document.querySelectorAll('#toolMore .chip').length};})()");
  check('常用工具直达，其余收进「更多工具（数量）」',
    toolGroups.main === 6 && toolGroups.moreHidden && !toolGroups.btnHidden &&
    /^更多工具（\d+）$/.test(toolGroups.btn) && toolGroups.moreCount === 7,
    JSON.stringify(toolGroups));
  await evaluate(cdp, "document.getElementById('moreToolsBtn').click()");
  const expanded = await evaluate(cdp, "(function(){return {open:!document.getElementById('toolMore').classList.contains('hidden'),btn:document.getElementById('moreToolsBtn').textContent};})()");
  check('点击后展开其余工具', expanded.open && /^收起更多工具（7）$/.test(expanded.btn), JSON.stringify(expanded));
  await evaluate(cdp, "document.querySelectorAll('#toolMore .chip')[0].click()");
  const kept = await evaluate(cdp, "(function(){return {main:document.querySelectorAll('#toolChips .chip').length,on:document.querySelectorAll('#toolChips .chip.on').length,more:document.querySelectorAll('#toolMore .chip').length};})()");
  check('非常用工具选中后仍直达，选择不因折叠丢失',
    kept.main === 7 && kept.on === 6 && kept.more === 6, JSON.stringify(kept));
  // 恢复默认工具集，避免影响后面的方案生成
  await evaluate(cdp, "(function(){var c=document.querySelectorAll('#toolChips .chip');c[c.length-1].click();document.getElementById('moreToolsBtn').click();return true;})()");

  group('【桌面】内置示例 → 三方案 → 制作视图');
  await evaluate(cdp, "document.querySelectorAll('.sample-chip')[0].click()");
  const samplePicked = await evaluate(cdp, "document.getElementById('itemInput').value");
  check('点内置示例直接带出物品与材质', /纸箱/.test(samplePicked), samplePicked);
  await evaluate(cdp, "document.getElementById('generateBtn').click()");
  const cardsReady = await until(cdp, "!document.getElementById('viewResults').classList.contains('hidden') && document.querySelectorAll('#cards .card').length===3");
  check('生成三张方案卡', cardsReady);
  const cardInfo = await evaluate(cdp, "(function(){var cs=[].slice.call(document.querySelectorAll('#cards .card'));return {titles:cs.map(c=>c.querySelector('h3').textContent),svgs:document.querySelectorAll('#cards .diagram-holder svg').length,notice:document.getElementById('noticeBox').textContent,meta:document.getElementById('resultsMeta').textContent};})()");
  check('三卡都有结构示意 SVG', cardInfo.svgs === 3, 'svgs=' + cardInfo.svgs);
  check('模式说明只在 notice 一处，标题下 meta 不再重复示例说明',
    /没有调用模型/.test(cardInfo.notice) && !/示例模式|未调用模型|没有调用模型|未配置模型/.test(cardInfo.meta),
    cardInfo.meta + ' / ' + cardInfo.notice);
  const demoMentions = await evaluate(cdp, "(function(){var v=document.getElementById('viewResults');return [].slice.call(v.querySelectorAll('*')).filter(function(e){return e.children.length===0 && /没有调用模型|未做图像识别|未配置模型/.test(e.textContent||'');}).length;})()");
  check('结果页示例说明只出现一次', demoMentions === 1, 'count=' + demoMentions);
  check('三张卡标题互不相同', new Set(cardInfo.titles).size === 3, cardInfo.titles.join(' | '));
  await shot(cdp, '02-results-desktop.png');

  group('【反馈 5】物品 / 材质纠正表单按需展开');
  const corr0 = await evaluate(cdp, "(function(){return {toggleHidden:document.getElementById('toggleCorrection').classList.contains('hidden'),boxHidden:document.getElementById('recognizedBox').classList.contains('hidden'),text:document.getElementById('toggleCorrection').textContent};})()");
  check('纠正表单默认收起、入口可见', !corr0.toggleHidden && corr0.boxHidden && /核对|纠正/.test(corr0.text), JSON.stringify(corr0));
  await evaluate(cdp, "document.getElementById('toggleCorrection').click()");
  const corr1 = await evaluate(cdp, "(function(){return {open:!document.getElementById('recognizedBox').classList.contains('hidden'),text:document.getElementById('toggleCorrection').textContent};})()");
  check('点击后展开、按钮变收起', corr1.open && /收起/.test(corr1.text), JSON.stringify(corr1));
  await evaluate(cdp, "document.getElementById('toggleCorrection').click()");

  await evaluate(cdp, "document.querySelector('#cards .card .card-actions .primary-btn').click()");
  const detailReady = await until(cdp, "!document.getElementById('viewDetail').classList.contains('hidden') && document.querySelectorAll('#stepList .step-item').length>0");
  check('点方案进入制作视图', detailReady);
  const detailInfo = await evaluate(cdp, "(function(){return {diag:document.querySelectorAll('#detailDiagram svg').length,steps:document.querySelectorAll('#stepList .step-item').length,mats:document.querySelectorAll('#materialList .mat-line').length,caption:[].slice.call(document.querySelectorAll('#compareWrap figcaption')).map(x=>x.textContent).join('|'),cost:document.getElementById('costTotal').textContent,title:document.getElementById('detailTitle').textContent};})()");
  check('保留原物照片位并并排改造示意', detailInfo.diag === 1 && /示意图，并非实物成品/.test(detailInfo.caption), detailInfo.caption);
  check('材料 / 费用 / 步骤齐全', detailInfo.mats >= 2 && detailInfo.steps >= 4 && /合计/.test(detailInfo.cost));
  const dimTexts = await evaluate(cdp, "[].slice.call(document.querySelectorAll('#detailDiagram svg text')).map(function(x){return x.textContent;})");
  check('详情结构图标宽 240 / 深 160 / 高 90，竖向不再标 160 mm',
    dimTexts.includes('宽 240 mm') && dimTexts.some((t) => /斜向.*深 160 mm/.test(t)) &&
    dimTexts.includes('高 90 mm') && !dimTexts.includes('160 mm'),
    dimTexts.filter((t) => /mm/.test(t)).join(' | '));
  await shot(cdp, '03-detail-desktop.png');

  await evaluate(cdp, "document.querySelector('#stepList input[type=checkbox]').click()");
  const progress = await evaluate(cdp, "document.getElementById('stepProgress').textContent");
  check('步骤可勾选并显示进度', /^1 \//.test(progress), progress);

  group('【桌面】用同一句复测追加限制 / 导出 / 收藏');
  const costBefore = await evaluate(cdp, "document.getElementById('costTotal').textContent");
  // 不点任何禁用按钮：限制只来自用户反馈的那句自由文本。
  await evaluate(cdp, "(function(){document.getElementById('refineBudget').value='20';document.getElementById('refineExtra').value='不能用胶水，剪刀可以用，预算20元';document.getElementById('refineBtn').click();return true;})()");
  const refined = await until(cdp, "!document.getElementById('refineResult').classList.contains('hidden') && document.querySelectorAll('#refineResult .changed-pill').length>0");
  check('追加限制后重新设计成功', refined);
  const after = await evaluate(cdp, "(function(){return {cost:document.getElementById('costTotal').textContent,mats:document.getElementById('materialList').innerText,tools:document.getElementById('toolList').innerText,notes:document.getElementById('refineResult').innerText,stepsText:document.getElementById('stepList').innerText};})()");
  check('禁用胶水后材料里不再出现白胶', !/白胶/.test(after.mats), after.mats.replace(/\n/g, ' / '));
  check('禁用胶水后工具里不再出现胶水', !/胶水/.test(after.tools), after.tools.replace(/\n/g, ' / '));
  check('费用随限制真实变化', costBefore !== after.cost, costBefore + ' → ' + after.cost);
  check('界面写明约束生效', /预算上限|不再需要|禁用/.test(after.notes), after.notes.replace(/\n/g, ' / '));
  check('同一句：界面只禁用胶水，剪刀没有被误禁',
    /禁用：胶水/.test(after.notes) && !/禁用：[^，。\s]*剪刀/.test(after.notes),
    after.notes.replace(/\n/g, ' / '));
  check('同一句：界面写明「保留可用工具剪刀」', /保留可用工具「剪刀」/.test(after.notes), after.notes.replace(/\n/g, ' / '));
  check('同一句：步骤仍用剪刀，没有退化成徒手撕纸板',
    /剪刀沿划线剪开/.test(after.stepsText) && !/徒手撕开/.test(after.stepsText),
    after.stepsText.replace(/\n/g, ' / ').slice(0, 160));
  check('界面不出现 glue / scissors / demo 等内部 id',
    !/\b(glue|scissors|demo|demo-rule)\b/i.test(after.notes), after.notes.replace(/\n/g, ' / '));

  await evaluate(cdp, "document.getElementById('downloadMd').click()");
  const mdFile = await waitFile('.md', '万物改造局-制作清单-');
  let mdOk = false, mdSample = '';
  if (mdFile) {
    const text = fs.readFileSync(path.join(OUT, mdFile), 'utf8');
    mdSample = text.split('\n').slice(0, 3).join(' / ');
    mdOk = text.includes('# 制作清单') && text.includes('- [ ]') && text.includes('示例方案 / 示意') &&
      text.includes('## 结构尺寸') && text.includes('宽 240 mm') && text.includes('深 160 mm') && text.includes('高 90 mm') &&
      text.includes('240（宽）× 160（深）') && text.includes('三等分（每格约 80 mm）');
  }
  check('制作清单 Markdown 真实下载且与详情共用同一组尺寸', mdOk, mdFile ? mdSample : '未生成文件');

  await evaluate(cdp, "document.getElementById('shareBtn').click()");
  const canvasReady = await until(cdp, "document.querySelectorAll('#canvasWrap canvas').length===1");
  const canvasInfo = canvasReady ? await evaluate(cdp, "(function(){var c=document.querySelector('#canvasWrap canvas');var u=c.toDataURL('image/png');return {w:c.width,h:c.height,len:u.length,prefix:u.slice(0,22)};})()") : {};
  check('分享卡 Canvas 真正绘制出 PNG', canvasReady && canvasInfo.len > 100000 && canvasInfo.prefix.startsWith('data:image/png'),
    JSON.stringify(canvasInfo));
  const layout = canvasReady ? await evaluate(cdp, "(function(){var c=document.querySelector('#canvasWrap canvas');return c.__layout||null;})()") : null;
  const shareNote = await evaluate(cdp, "document.getElementById('shareNote').textContent");
  check('步骤区在页脚线之上，不再重叠',
    Boolean(layout) && layout.stepsLastBaseline + 24 < layout.footerLineY,
    layout ? `stepsBottom=${layout.stepsLastBaseline} footerLine=${layout.footerLineY}` : 'no layout');
  check('缩短的步骤明确标为「步骤摘要」',
    Boolean(layout) && layout.stepTitle === '步骤摘要' && /步骤摘要/.test(shareNote), shareNote);
  check('示例模式分享卡标「示例方案」',
    Boolean(layout) && layout.isDemo === true && layout.schemeLabel === '示例方案', JSON.stringify(layout && layout.schemeLabel));
  check('分享卡复用详情页同一张结构图',
    Boolean(layout) && layout.diagramSource === 'detail-svg', layout && layout.diagramSource);
  check('分享卡与详情 / 清单共用宽深高标注',
    Boolean(layout) && layout.diagramDims && layout.diagramDims.width === '宽 240 mm' &&
    layout.diagramDims.depth === '深 160 mm' && layout.diagramDims.height === '高 90 mm',
    JSON.stringify(layout && layout.diagramDims));
  await shot(cdp, '04-share-modal.png');
  await evaluate(cdp, "document.getElementById('downloadPng').click()");
  const pngFile = await waitFile('.png', '万物改造局-分享卡-');
  let pngOk = false;
  if (pngFile) {
    const buf = fs.readFileSync(path.join(OUT, pngFile));
    pngOk = buf.length > 100000 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  }
  check('分享卡 PNG 真实下载且为有效 PNG', pngOk, pngFile ? pngFile + ' ' + fs.statSync(path.join(OUT, pngFile)).size + 'B' : '未生成文件');

  await evaluate(cdp, "document.getElementById('closeShare').click()");
  await evaluate(cdp, "document.getElementById('favCurrent').click()");
  const favStored = await evaluate(cdp, "(function(){var d=JSON.parse(localStorage.getItem('upcycle.favorites.v1')||'[]');return {n:d.length,count:document.getElementById('favCount').textContent};})()");
  check('收藏写入 localStorage', favStored.n === 1 && favStored.count === '1', JSON.stringify(favStored));

  await cdp.send('Page.reload', { ignoreCache: true });
  check('刷新后页面重新加载', await until(cdp, "document.getElementById('modeBadge') && document.getElementById('modeBadge').textContent.includes('示例模式')"));
  const afterReload = await evaluate(cdp, "(function(){return {count:document.getElementById('favCount').textContent,n:JSON.parse(localStorage.getItem('upcycle.favorites.v1')||'[]').length};})()");
  check('刷新后本地收藏仍在', afterReload.n === 1 && afterReload.count === '1', JSON.stringify(afterReload));

  group('【大图上传自动压缩】');
  // 在页面里造一张接近 1MB 的噪声 JPEG 并走真实 change 事件，验证压缩确实跑过、体积达标。
  await evaluate(cdp, `(function(){
    var c=document.createElement('canvas'); c.width=1100; c.height=1100;
    var x=c.getContext('2d'), id=x.createImageData(1100,1100), d=id.data;
    for(var i=0;i<d.length;i+=4){ d[i]=(i*7)%255; d[i+1]=(i*13)%255; d[i+2]=(i*29)%255; d[i+3]=255; }
    x.putImageData(id,0,0);
    c.toBlob(function(b){
      var f=new File([b],'big-photo.jpg',{type:'image/jpeg'});
      var dt=new DataTransfer(); dt.items.add(f);
      var inp=document.getElementById('fileInput');
      inp.files=dt.files; inp.dispatchEvent(new Event('change',{bubbles:true}));
    },'image/jpeg',0.92);
    return true;
  })()`);
  const packedReady = await until(cdp, "(function(){var n=document.getElementById('photoNote');return n && /压缩/.test(n.textContent) && document.getElementById('previewImg').src.indexOf('data:image/jpeg')===0;})()", 25000);
  const packed = packedReady ? await evaluate(cdp, "(function(){return {note:document.getElementById('photoNote').textContent,len:document.getElementById('previewImg').src.length};})()") : null;
  check('大图上传后自动压缩并给出说明', Boolean(packed), JSON.stringify(packed));
  check('压缩后 data URL 落在网关安全体积内（≤85000 字符）', Boolean(packed && packed.len <= 85000), packed && packed.len);

  await evaluate(cdp, "document.getElementById('favBtn').click()");
  const drawer = await evaluate(cdp, "(function(){return {open:!document.getElementById('favDrawer').classList.contains('hidden'),text:document.getElementById('favList').innerText};})()");
  check('收藏抽屉列出已存方案', drawer.open && drawer.text.length > 5, drawer.text.slice(0, 60));
  check('收藏列表不出现 demo / glue / scissors 等内部 id',
    !/\b(demo|demo-rule|glue|scissors)\b/i.test(drawer.text), drawer.text.slice(0, 80));
  await evaluate(cdp, "[].slice.call(document.querySelectorAll('#favList .fav-actions button')).find(b=>b.textContent==='删除').click()");
  const deleted = await evaluate(cdp, "JSON.parse(localStorage.getItem('upcycle.favorites.v1')||'[]').length");
  check('收藏可删除', deleted === 0, 'remaining=' + deleted);

  group('【375px 手机视口】');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await cdp.send('Page.navigate', { url: APP });
  check('手机首页加载完成', await until(cdp, "document.getElementById('modeBadge') && document.getElementById('modeBadge').textContent.includes('示例模式')"));
  const wHome = await evaluate(cdp, 'document.documentElement.scrollWidth');
  check('375px 首页不横向溢出', wHome <= 375, 'scrollWidth=' + wHome);
  await shot(cdp, '05-home-375.png');
  await evaluate(cdp, "document.querySelectorAll('.sample-chip')[1].click();document.getElementById('generateBtn').click()");
  check('手机端也能生成三方案', await until(cdp, "!document.getElementById('viewResults').classList.contains('hidden') && document.querySelectorAll('#cards .card').length===3"));
  const wResults = await evaluate(cdp, 'document.documentElement.scrollWidth');
  check('375px 结果页不横向溢出', wResults <= 375, 'scrollWidth=' + wResults);
  await shot(cdp, '06-results-375.png');
  await evaluate(cdp, "document.querySelector('#cards .card .card-actions .primary-btn').click()");
  check('手机端进入制作视图', await until(cdp, "!document.getElementById('viewDetail').classList.contains('hidden')"));
  const wDetail = await evaluate(cdp, 'document.documentElement.scrollWidth');
  check('375px 制作页不横向溢出', wDetail <= 375, 'scrollWidth=' + wDetail);
  await shot(cdp, '07-detail-375.png');

  const jsErrors = cdp.events.filter((e) => e.method === 'Runtime.exceptionThrown').length;
  check('页面无未捕获 JS 异常', jsErrors === 0, 'exceptions=' + jsErrors);

  group('汇总');
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  if (failures.length) { console.log('失败明细：'); failures.forEach((f) => console.log(' - ' + f)); }
  console.log('截图与下载产物目录：' + OUT);
  cdp.close();
  children.forEach((c) => { try { c.kill(); } catch { /* noop */ } });
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
