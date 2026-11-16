'use strict';

// 线上真实状态验证：全部请求打到已部署的 CloudBase 域名，不模拟、不改写结果。
// OCR 权限已通过 TCB_QcsRole 打通时应验证真实识别结果；若权限失效则必须明确报错，绝不谎称成功。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..');

const SITE = process.env.UPCYCLE_SITE ||
  'https://evansongdev-d3gwank9e76835e8b-1343046532.tcloudbaseapp.com/upcycle/';
const API = process.env.UPCYCLE_API ||
  'https://evansongdev-d3gwank9e76835e8b-1343046532.ap-shanghai.app.tcloudbase.com/upcycle/api/';
// 线上已接入真实模型，默认必须是 live；只有刻意回滚到示例模式时才用环境变量放宽。
const EXPECT_MODE = process.env.UPCYCLE_EXPECT_MODE || 'live';

let pass = 0, total = 0;
const notes = [];
function check(name, ok, detail) {
  total += 1;
  if (ok) { pass += 1; console.log(`  [PASS] ${name}`); }
  else console.log(`  [FAIL] ${name}${detail ? ' · ' + String(detail).slice(0, 180) : ''}`);
}

async function get(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

async function getBuffer(url) {
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()) };
}
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }

async function post(name, payload) {
  const res = await fetch(API + name, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000)
  });
  const raw = await res.text();
  let data = null;
  try { data = JSON.parse(raw); } catch { /* keep null */ }
  return { status: res.status, data, raw, headers: res.headers };
}

function imageDataUrl() {
  // 与云函数 /api/diag 用的自检图相同：带可识别文字、尺寸可被 OCR 解码。
  const buf = fs.readFileSync(path.join(ROOT, 'scripts', 'fixtures', 'ocr-check.png'));
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function main() {
  console.log('线上真实状态验证（远端请求，不模拟）');
  console.log('站点：' + SITE);
  console.log('接口：' + API);
  console.log('');

  const page = await get(SITE);
  check('静态页可访问', page.status === 200, String(page.status));
  check('页面含文字识别入口', /id="ocrBtn"/.test(page.text) && /id="ocrPanel"/.test(page.text));
  check('页面含能力状态行', /id="capNote"/.test(page.text));
  check('页面仍注入网关接口地址', /upcycle-api-base" content="https:/.test(page.text));
  check('品牌与标题未变', /万物改造局/.test(page.text) && /<title>万物改造局/.test(page.text));

  const localJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
  const remoteJs = await get(SITE + 'app.js');
  check('线上 app.js 与本地一致（含 OCR 交互）',
    remoteJs.status === 200 && remoteJs.text === localJs && /runOcr/.test(remoteJs.text),
    `status=${remoteJs.status} len=${remoteJs.text.length}`);
  check('线上 app.js 含客户端等待超时保护', /client_timeout/.test(remoteJs.text));
  const localCss = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
  const remoteCss = await get(SITE + 'styles.css');
  check('线上 styles.css 与本地一致', remoteCss.status === 200 && remoteCss.text === localCss);

  // 9 个静态文件逐一按字节比对；index.html 以部署源为准（本地版 meta 为空、线上版注入了网关地址）。
  const publicDir = path.join(ROOT, 'public');
  const names = fs.readdirSync(publicDir).filter((n) => fs.statSync(path.join(publicDir, n)).isFile());
  let sameCount = 0;
  const stale = [];
  for (const n of names) {
    const src = n === 'index.html'
      ? path.join(ROOT, 'deploy-cloudbase', 'site', 'index.html')
      : path.join(publicDir, n);
    const local = fs.readFileSync(src);
    const r = await getBuffer(SITE + n + '?v=' + Date.now());
    if (r.status === 200 && md5(local) === md5(r.buf)) sameCount += 1;
    else stale.push(n + '(' + r.status + ')');
  }
  check('静态资源远端与本地逐一 md5 一致（' + names.length + ' 个）',
    sameCount === names.length, sameCount + '/' + names.length + ' 不一致：' + stale.join(','));

  const cfgRes = await get(API + 'config');
  let cfg = null;
  try { cfg = JSON.parse(cfgRes.text); } catch { /* keep null */ }
  check('配置接口正常', cfgRes.status === 200 && cfg && cfg.ok === true);
  check('配置暴露文字识别能力状态', Boolean(cfg && cfg.config && cfg.config.ocr &&
    typeof cfg.config.ocr.configured === 'boolean'));
  const ocrConfigured = Boolean(cfg && cfg.config && cfg.config.ocr && cfg.config.ocr.configured);
  notes.push(`文字识别凭据：${ocrConfigured ? '云函数已配置（实际权限看 diag）' : '云函数未配置'}`);
  check('配置响应不含任何密钥或上游地址',
    !/SECRET|SecretKey|api[_-]?key|Bearer /i.test(cfgRes.text));
  check('运行模式如实回显', Boolean(cfg && (cfg.config.mode === 'demo' || cfg.config.mode === 'live')));
  check('线上保持约定的运行模式（防误部署静默退回示例）',
    Boolean(cfg && cfg.config.mode === EXPECT_MODE),
    `期望 ${EXPECT_MODE}，实际 ${cfg && cfg.config.mode}`);
  notes.push(`方案生成模式：${cfg && cfg.config.mode === 'live' ? '已连接模型' : '示例模式（本地规则）'}`);

  const diagRes = await get(API + 'diag');
  let diag = null;
  try { diag = JSON.parse(diagRes.text); } catch { /* keep null */ }
  check('能力自检端点可用', diagRes.status === 200 && diag && diag.ok === true);
  check('自检返回真实调用结果',
    Boolean(diag && diag.probe && (diag.probe.ok === true || typeof diag.probe.code === 'string')));
  notes.push(`文字识别真实探测：${diag && diag.probe ? (diag.probe.ok ? '调用成功' : diag.probe.code) : '无结果'}`);
  check('自检不泄露凭据内容', !/mock-key|SecretKey|secretId/i.test(diagRes.text));
  check('自检标明探测结果是否为缓存', Boolean(diag && typeof diag.cached === 'boolean'));
  check('自检回显运行模式但不带密钥', Boolean(diag && diag.llm && typeof diag.llm.mode === 'string') &&
    !/Bearer |api[_-]?key/i.test(diagRes.text));

  const bad = await post('ocr', { image: 'data:image/png;base64,AAAA' });
  check('非法图片被服务端拒绝', bad.status === 400 && bad.data && bad.data.ok === false,
    `${bad.status} ${JSON.stringify(bad.data)}`);

  const real = await post('ocr', { image: imageDataUrl() });
  const realData = real.data || {};
  if (real.status === 200 && realData.ok && realData.ocr) {
    check('线上真实文字识别调用成功', true);
    check('识别结果含可核对的文字行与说明',
      Array.isArray(realData.ocr.lines) && typeof realData.ocr.notice === 'string');
    check('成功响应仍不含凭据', !/SecretKey|secretId|Bearer /i.test(real.raw || ''));
  } else {
    // 权限失效 / 上游异常等真实失败状态，必须明确报错，绝不写成成功。
    check('文字识别未成功时明确返回错误码',
      realData.ok === false && typeof realData.code === 'string' && realData.code.length > 0,
      `${real.status} ${JSON.stringify(realData).slice(0, 160)}`);
    check('失败提示说明可以重试或需要先配置',
      /重试|配置|开通|权限|超时|凭据/.test(String(realData.error || '')));
    check('失败响应不含凭据', !/SecretKey|secretId|Bearer /i.test(real.raw || ''));
    notes.push(`线上 OCR 当前不可用：${realData.code} / ${String(realData.error || '').slice(0, 80)}`);
  }

  const isLive = Boolean(cfg && cfg.config && cfg.config.mode === 'live');
  const ideasBody = Object.assign({ tools: ['cutter'], budget: 20, forbidden: [], extra: '', description: '',
    item: isLive ? '透明饮料瓶' : '', material: isLive ? 'PET 塑料' : '' },
    isLive ? {} : { sampleId: 'bottle' });
  const ideas = await post('ideas', ideasBody);
  const planCount = ideas.data && ideas.data.plans ? ideas.data.plans.length : 0;
  const badCount = ideas.data && ideas.data.infeasible ? ideas.data.infeasible.length : 0;
  check('三款式在当前线上模式下都有交代（可行或明确不可行）',
    ideas.status === 200 && ideas.data && ideas.data.ok === true && planCount + badCount === 3,
    `plans=${planCount} infeasible=${badCount} ${ideas.data && ideas.data.code ? ideas.data.code : ''}`);
  if (isLive) {
    check('模型模式来源如实标注为 llm',
      Boolean(ideas.data && ideas.data.mode === 'live' && ideas.data.source === 'llm'));
    check('模型方案不满足限制时如实标为不可行',
      Boolean(ideas.data && (ideas.data.infeasible || []).every((x) => x.lane && x.reason)));
    check('模型输出仍经服务端预算与工具校验',
      Boolean(ideas.data && ideas.data.constraints && ideas.data.constraints.budget === 20 &&
        ideas.data.constraints.tools.indexOf('cutter') >= 0));
    notes.push('方案生成：真实模型输出（source=llm），不是内置示例');
  } else {
    check('瓶子仅美工刀仍为整瓶不裁切',
      Boolean(ideas.data && ideas.data.plans && ideas.data.plans.every((p) =>
        !/环切|截高 140|包边/.test(JSON.stringify(p.steps || [])))));
  }

  // 视觉开启后必须真发一张带物品的照片，确认模型看图返回 recognized，
  // 不把 OCR 文字线索冒充「识图结果」。关闭时如实记录，不跳过也不谎称成功。
  const visionOn = Boolean(cfg && cfg.config && cfg.config.vision);
  if (visionOn) {
    const jpg = fs.readFileSync(path.join(ROOT, 'scripts', 'fixtures', 'vision-bottle.jpg'));
    const v = await post('ideas', {
      image: 'data:image/jpeg;base64,' + jpg.toString('base64'),
      item: '', material: '', description: '',
      tools: ['scissors', 'tape'], budget: 20, forbidden: [], extra: ''
    });
    const vd = v.data || {};
    check('线上真实视觉：带图请求由模型返回且标记 visionUsed',
      v.status === 200 && vd.ok === true && vd.source === 'llm' && vd.visionUsed === true,
      `${v.status} ${vd.code || ''} visionUsed=${vd.visionUsed}`);
    check('线上真实视觉：模型返回物品与材质判断',
      Boolean(vd.recognized && vd.recognized.source === 'vision' && vd.recognized.item),
      JSON.stringify(vd.recognized));
    check('线上真实视觉：三款式都有交代',
      (vd.plans || []).length + (vd.infeasible || []).length === 3,
      `plans=${(vd.plans || []).length} infeasible=${(vd.infeasible || []).length}`);
    notes.push('视觉识图：真实模型看图（' + (vd.recognized && vd.recognized.item || '无') + '），不是 OCR 文字线索');
  } else {
    notes.push('视觉识图：当前 vision=false，未看图；不把 OCR 文字线索写成识图结果');
  }

  console.log('');
  console.log('线上真实状态：');
  notes.forEach((n) => console.log('  - ' + n));
  console.log('');
  console.log(`结果：${pass}/${total} 通过`);
  if (pass !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error('线上验证异常：', err);
  process.exitCode = 1;
});
