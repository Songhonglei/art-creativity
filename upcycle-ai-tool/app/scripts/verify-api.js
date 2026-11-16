'use strict';

// 真实 HTTP 层验证：启动本地服务与「本地模拟上游」，逐条断言。
// 模拟上游不是真实大模型，本脚本只证明链路/校验/失败处理，不证明真实 LLM 调用成功。
const { spawn } = require('node:child_process');
const path = require('node:path');
const zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');

const DEMO_PORT = 4181;
const LIVE_PORT = 4182;
const VISION_PORT = 4183;
const MOCK_PORT = 8788;
const KEY = 'local-mock-key-not-a-real-credential';

let pass = 0, fail = 0;
const results = [];
const procs = [];
process.on('exit', () => procs.forEach((p) => { try { p.kill(); } catch { /* already gone */ } }));
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail || '' });
  if (ok) pass++; else fail++;
  console.log((ok ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  ← ' + detail : ''));
}
function group(title) { console.log('\n' + title); }

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function waitFor(url, timeoutMs) {
  const end = Date.now() + (timeoutMs || 8000);
  while (Date.now() < end) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not ready */ }
    await sleep(120);
  }
  return false;
}

function start(script, env, port) {
  const child = spawn(process.execPath, [path.join(ROOT, script)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(port) }, env),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d.toString(); });
  child.stderr.on('data', (d) => { log += d.toString(); });
  return { child, log: () => log };
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
function dataUrl(buf, mime) { return 'data:' + (mime || 'image/png') + ';base64,' + buf.toString('base64'); }

async function post(port, pathname, payload, timeoutMs) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined
  });
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data, raw: JSON.stringify(data) };
}
async function get(port, pathname) {
  const res = await fetch(`http://127.0.0.1:${port}${pathname}`);
  let text = '';
  try { text = await res.text(); } catch { /* empty */ }
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text, data };
}
async function setMockMode(mode) {
  await fetch(`http://127.0.0.1:${MOCK_PORT}/__mode`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode })
  });
}

const BASE_IDEAS = {
  sampleId: 'carton', item: '', material: '', description: '',
  tools: ['scissors', 'ruler', 'pencil', 'glue', 'tape'], budget: 20
};
function refineBody(base, plan, constraints, specs) {
  return {
    base: Object.assign({}, BASE_IDEAS, base),
    planId: plan.id, currentPlan: plan,
    specs: specs || [], constraints
  };
}

async function main() {
  const mock = start('scripts/mock-llm.js', { MOCK_PORT: String(MOCK_PORT) }, MOCK_PORT);
  procs.push(mock.child);
  const demo = start('server.js', { LLM_BASE_URL: '', LLM_API_KEY: '', LLM_MODEL: '', LLM_VISION: '' }, DEMO_PORT);
  procs.push(demo.child);
  const live = start('server.js', {
    LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`, LLM_API_KEY: KEY,
    LLM_MODEL: 'mock-upstream-hy4', LLM_VISION: 'false', LLM_TIMEOUT_MS: '2500'
  }, LIVE_PORT);
  procs.push(live.child);
  const vision = start('server.js', {
    LLM_BASE_URL: `http://127.0.0.1:${MOCK_PORT}/v1`, LLM_API_KEY: KEY,
    LLM_MODEL: 'mock-upstream-hy4', LLM_VISION: 'true', LLM_TIMEOUT_MS: '2500'
  }, VISION_PORT);
  procs.push(vision.child);

  const ready = (await Promise.all([
    waitFor(`http://127.0.0.1:${MOCK_PORT}/__mode`),
    waitFor(`http://127.0.0.1:${DEMO_PORT}/api/config`),
    waitFor(`http://127.0.0.1:${LIVE_PORT}/api/config`),
    waitFor(`http://127.0.0.1:${VISION_PORT}/api/config`)
  ])).every(Boolean);
  const alive = procs.every((p) => p.exitCode === null);
  check('四个本地服务全部启动', ready && alive, alive ? '' : '有端口被占用或进程退出');
  if (!ready || !alive) {
    console.log(demo.log(), live.log(), mock.log());
    procs.forEach((p) => p.kill());
    process.exit(1);
  }

  // ---------- 示例模式 ----------
  group('【示例模式】配置与内置示例 → 三方案');
  const cfgDemo = await get(DEMO_PORT, '/api/config');
  check('配置显示示例模式', cfgDemo.data.config.mode === 'demo');
  check('配置不泄露密钥 / 上游地址', !cfgDemo.text.includes(KEY) && !cfgDemo.text.includes(String(MOCK_PORT)));

  const ideas = await post(DEMO_PORT, '/api/ideas', BASE_IDEAS);
  check('内置纸箱返回三方案', ideas.data.ok === true && ideas.data.plans.length === 3, 'plans=' + (ideas.data.plans || []).length);
  check('来源标为本地规则、未声称识图', ideas.data.source === 'demo-rule' && ideas.data.visionUsed === false && /没有调用模型/.test(ideas.data.notice || ''));
  check('识别结果来自示例而非模型', ideas.data.recognized && ideas.data.recognized.source === 'sample');
  check('三种款式互不重复', new Set(ideas.data.plans.map((p) => p.lane)).size === 3);
  check('费用/用时由数据推导且不超预算', ideas.data.plans.every((p) => p.estimatedCost <= 20 && p.timeMinutes > 0 && p.steps.length > 0 && p.diagram.type));
  check('每款都有结构示意字段', ideas.data.plans.every((p) => p.diagram && p.diagram.w > 0 && Array.isArray(p.diagram.labels)));
  check('工具只使用已声明的工具', ideas.data.plans.every((p) => p.toolsUsed.every((t) => BASE_IDEAS.tools.includes(t))));

  group('【示例模式】追加限制真实生效');
  const practical = ideas.data.plans.find((p) => p.lane === 'practical');
  const rGlue = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, {
    budget: 20, tools: BASE_IDEAS.tools, forbidden: ['glue'], extra: ''
  }));
  const gPlan = rGlue.data.plan;
  check('禁用胶水后方案仍可制作', rGlue.data.ok === true && Boolean(gPlan));
  check('禁用胶水后费用下降', gPlan && gPlan.estimatedCost < practical.estimatedCost,
    gPlan ? `${practical.estimatedCost} → ${gPlan.estimatedCost}` : 'no plan');
  check('材料与步骤工具列表不再含胶水', gPlan && gPlan.toolsUsed.indexOf('glue') < 0 && gPlan.materials.every((m) => !/白胶|胶水/.test(m.name)));
  check('迭代结果给出约束差异', Array.isArray(rGlue.data.changed) && rGlue.data.changed.length > 0);

  const rText = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, {
    budget: 50, tools: BASE_IDEAS.tools, forbidden: [], extra: '不能用胶水，预算2元'
  }));
  check('自由文本解析出预算与禁用工具',
    rText.data.constraints.budget === 2 && rText.data.constraints.forbidden.includes('glue'),
    JSON.stringify(rText.data.constraints));
  check('文字解析产生的限制确实作用于结果',
    rText.data.notes.some((n) => /预算内去掉|已按文字/.test(n)) || (rText.data.plan && rText.data.plan.estimatedCost <= 2));

  const rZero = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, {
    budget: 0, tools: BASE_IDEAS.tools, forbidden: [], extra: ''
  }));
  check('预算 0 时实用款被判不可行并说明原因',
    rZero.data.plan === null && rZero.data.infeasible.length > 0 && /超出预算/.test(rZero.data.infeasible[0].reason));
  check('不可行时解释原因并列出同限制下的可行替代',
    (rZero.data.substitutes || []).length > 0 && (rZero.data.explanation || '').length > 0);
  check('可行替代同样满足预算 0', (rZero.data.substitutes || []).length > 0 && rZero.data.substitutes.every((p) => p.estimatedCost === 0));
  check('全款式都不可行时才启用零成本替代池',
    rZero.data.alternatives.length === 0 || rZero.data.alternatives.every((p) => p.estimatedCost === 0));

  const noHands = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, {
    budget: 20, tools: [], forbidden: [], extra: ''
  }));
  check('工具全不勾选时改用徒手做法或如实判不可行',
    noHands.data.ok === true && (noHands.data.plan ? noHands.data.plan.toolsUsed.length === 0 : noHands.data.explanation.length > 0));

  // ---------- 验收反馈 1：同一句里否定只作用于所在分句 ----------
  group('【反馈 1】自由文本「不能用胶水，剪刀可以用，预算20元」');
  const SAME_SENTENCE = '不能用胶水，剪刀可以用，预算20元';
  const rSentence = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, {
    budget: 20, tools: BASE_IDEAS.tools, forbidden: [], extra: SAME_SENTENCE
  }));
  const sPlan = rSentence.data.plan;
  check('同一句：只禁用胶水，不误禁剪刀',
    rSentence.data.constraints.forbidden.join(',') === 'glue',
    JSON.stringify(rSentence.data.constraints.forbidden));
  check('同一句：剪刀保留在可用工具里',
    rSentence.data.constraints.tools.includes('scissors'),
    JSON.stringify(rSentence.data.constraints.tools));
  check('同一句：步骤真的用剪刀，没有退化成徒手撕纸板',
    Boolean(sPlan) && sPlan.steps.some((s) => /剪刀沿划线剪开/.test(s.text)) &&
    !sPlan.steps.some((s) => /徒手撕开/.test(s.text)),
    sPlan ? sPlan.steps.map((s) => s.text.slice(0, 18)).join(' | ') : 'no plan');
  check('同一句：预算 20 元生效', rSentence.data.constraints.budget === 20);
  check('同一句：明确回显「保留可用工具」并说明禁用的是胶水',
    (rSentence.data.notes || []).some((n) => /保留可用工具「剪刀」/.test(n)) &&
    (rSentence.data.notes || []).some((n) => /禁用「胶水」/.test(n)));
  check('同一句：差异文案用中文，不出现 glue / scissors / demo',
    (rSentence.data.changed || []).every((x) => !/glue|scissors|demo/i.test(x)),
    (rSentence.data.changed || []).join(' | '));
  check('同一句：不再提示「自由文本未生效」',
    (rSentence.data.notes || []).every((n) => !/未生效/.test(n)));

  // ---------- 验收反馈 2：瓶子仅美工刀时，收边按前一步实际做法决定 ----------
  group('【反馈 2】透明饮料瓶仅有美工刀');
  const bottleOnly = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: 'bottle', tools: ['cutter'] }));
  const bp = (bottleOnly.data.plans || []).find((p) => p.id === 'bottle-practical');
  // 最终实现的「仅美工刀」分支改用整瓶，步骤标签与早期环切版不同；断言按实际标签取，语义不放松。
  const steps = (bp && bp.steps) || [];
  const cutStep = steps.find((s) => /不裁切|整瓶|敞口/.test(s.label));
  const edgeStep = steps.find((s) => /瓶口|切口|收边/.test(s.label));
  const cutText = cutStep ? cutStep.text : '';
  const edgeText = edgeStep ? edgeStep.text : '';
  check('仅有美工刀时不再环切，也不再说「上一步未裁切，跳过收边」',
    Boolean(bp) && !/环切|剪开/.test(cutText) && !/跳过收边/.test(edgeText),
    cutText + ' / ' + edgeText);
  check('缺少收边条件时改用不裁切方案，前后步骤自洽',
    Boolean(bp) && /不裁切/.test(cutText) && /没有裁切|保持原样|原有瓶口/.test(edgeText),
    cutText + ' / ' + edgeText);
  check('明确说明为什么改用不裁切做法',
    (bottleOnly.data.notes || []).some((n) => /没有胶带或剪刀给切口收边|改用不裁切/.test(n)),
    (bottleOnly.data.notes || []).slice(0, 3).join(' | '));
  check('三个瓶身方案都不再出现自相矛盾的「上一步没裁切」',
    (bottleOnly.data.plans || []).every((p) => p.steps.every((s) => !/上一步(未|没)裁切.*跳过/.test(s.text))));
  const bottleTape = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: 'bottle', tools: ['cutter', 'tape'] }));
  const bt = (bottleTape.data.plans || []).find((p) => p.id === 'bottle-practical');
  check('有胶带时仍走环切 + 真实收边，没有被无差别改成不裁切',
    Boolean(bt) && /环切/.test(bt.steps[1].text) && /贴一圈纸胶带/.test(bt.steps[2].text),
    bt ? bt.steps[1].text + ' / ' + bt.steps[2].text : 'no plan');

  // ---------- 补充反馈：纸箱宽 / 深 / 高标注统一 ----------
  group('【补充反馈】纸箱宽 240 / 深 160 / 高 90 同源');
  const dims = practical.diagram && practical.diagram.dims;
  check('结构数据给出宽、深、高三条标注',
    Boolean(dims) && dims.width === '宽 240 mm' && dims.depth === '深 160 mm' && dims.height === '高 90 mm',
    JSON.stringify(dims));
  check('板件尺寸与折叠 / 连接说明按同一组数值对应',
    practical.steps.some((s) => /240（宽）× 160（深）/.test(s.text) && /240（宽）× 90（高）/.test(s.text)) &&
    practical.steps.some((s) => /高 90 mm 的立板/.test(s.text)) &&
    practical.steps.some((s) => /240 mm 宽方向三等分（每格约 80 mm）/.test(s.text)));
  check('迭代回传的 specs 保留 dims，不会二次生成不一致标注',
    (ideas.data.specs || []).some((s) => s.id === 'carton-practical' && s.diagram && s.diagram.dims && s.diagram.dims.height === '高 90 mm'));

  group('【示例模式】输入校验与失败保留');
  const png = makePng(24, 24);
  const img = dataUrl(png);
  const noDesc = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: img, item: '' }));
  check('上传新物品但未描述 → 明确要求手动描述，不冒充识图',
    noDesc.status === 400 && noDesc.data.code === 'need_description');
  const withDesc = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, {
    sampleId: null, image: img, item: '旧铁盒', material: '马口铁'
  }));
  check('手动描述后给出规则示例且声明未识图',
    withDesc.data.ok === true && withDesc.data.plans.length === 3 && /没有进行图像识别/.test(withDesc.data.notice || ''));
  check('通用方案标注为规则示例', withDesc.data.plans.every((p) => p.isGeneric === true));

  const fake = Buffer.concat([Buffer.from('this is definitely not a png'), Buffer.alloc(2048, 0x41)]);
  const badImg = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: dataUrl(fake, 'image/png'), item: '旧铁盒' }));
  check('伪造 PNG 文件头被拒绝', badImg.status === 400 && badImg.data.code === 'bad_image' && /文件头/.test(badImg.data.error || ''), badImg.data.error);
  const bigImg = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: dataUrl(makePng(4097, 24)), item: '旧铁盒' }));
  check('超过像素上限被拒绝', bigImg.status === 400 && bigImg.data.code === 'image_too_large', bigImg.data.error);
  const huge = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024 + 10)]);
  const hugeImg = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: dataUrl(huge), item: '旧铁盒' }));
  check('超过 5MB 被拒绝', hugeImg.status === 400 && hugeImg.data.code === 'image_too_large', hugeImg.data.error);
  const longText = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { description: '字'.repeat(201) }));
  check('描述超长被拒绝', longText.status === 400 && longText.data.code === 'text_too_long');
  const longExtra = await post(DEMO_PORT, '/api/refine', refineBody({}, practical, { budget: 20, tools: BASE_IDEAS.tools, forbidden: [], extra: '啊'.repeat(301) }));
  check('补充要求超长被拒绝', longExtra.status === 400 && longExtra.data.code === 'text_too_long');
  const badSample = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: 'not-exist' }));
  check('未知示例 id 被拒绝', badSample.status === 400 && badSample.data.code === 'bad_sample');
  const unknownTool = await post(DEMO_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { tools: ['scissors', 'made_up_tool'] }));
  check('未知工具 id 被过滤', unknownTool.data.ok === true && unknownTool.data.constraints.tools.length === 1);
  const wrongMethod = await get(DEMO_PORT, '/api/ideas');
  check('GET 调用写接口返回 404', wrongMethod.status === 404);
  const traversal = await get(DEMO_PORT, '/../server.js');
  check('目录穿越读不到源码', traversal.status === 403 || traversal.status === 404);

  // ---------- 真实模式（本地模拟上游）----------
  group('【真实模式 · 本地模拟上游】链路、校验与失败');
  check('说明：以下上游是本机 scripts/mock-llm.js，不是真实大模型调用', true);
  const cfgLive = await get(LIVE_PORT, '/api/config');
  check('配置显示已连接模型', cfgLive.data.config.mode === 'live');
  check('配置不泄露密钥 / 上游地址', !cfgLive.text.includes(KEY) && !cfgLive.text.includes(String(MOCK_PORT)));

  await setMockMode('ok');
  const liveIdeas = await post(LIVE_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: img, item: '旧铁盒', material: '马口铁' }));
  check('模拟上游返回三方案且标记为模型来源', liveIdeas.data.ok === true && liveIdeas.data.source === 'llm' && liveIdeas.data.plans.length === 3);
  check('未启用视觉时不声称识图', liveIdeas.data.visionUsed === false && /来自你的描述/.test(liveIdeas.data.notice || ''));
  check('响应里不含密钥与上游地址', !liveIdeas.raw.includes(KEY) && !liveIdeas.raw.includes(String(MOCK_PORT)));
  const livePlan = liveIdeas.data.plans[0];
  const liveRefine = await post(LIVE_PORT, '/api/refine', refineBody(
    { sampleId: null, image: img, item: '旧铁盒', material: '马口铁' },
    livePlan,
    { budget: 20, tools: BASE_IDEAS.tools, forbidden: ['glue'], extra: '' },
    liveIdeas.data.specs
  ));
  check('迭代接口调用模拟上游并重校验', liveRefine.data.ok === true && liveRefine.data.source === 'llm' && Boolean(liveRefine.data.plan));

  await setMockMode('http500');
  const e500 = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游 HTTP 500 → 明确错误且可重试', e500.status === 502 && e500.data.code === 'llm_http' && e500.data.retryable === true);
  await setMockMode('invalid_json');
  const eJson = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游非 JSON → 结构错误，不静默切示例', eJson.status === 502 && eJson.data.code === 'llm_bad_output' && eJson.data.mode === undefined);
  await setMockMode('bad_shape');
  const eShape = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游结构缺字段 → 结构校验拒绝', eShape.status === 502 && eShape.data.code === 'bad_model_output', eShape.data.code);
  await setMockMode('violate');
  const eViolate = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游方案违反工具限制 → 判不可行并给替代',
    eViolate.data.ok === true && eViolate.data.infeasible.length === 3 && eViolate.data.alternatives.length > 0);
  await setMockMode('html');
  const eHtml = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游文案含 HTML 标签被净化', eHtml.data.ok === true && eHtml.data.plans.every((p) => !/[<>]/.test(p.title)));
  await setMockMode('timeout');
  const eTimeout = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('上游超时 → 超时错误且可重试', eTimeout.status === 502 && eTimeout.data.code === 'llm_timeout' && eTimeout.data.retryable === true);
  // 反馈 3：响应头已到但 body 永远不结束，旧实现清掉计时器后会一直挂着。
  await setMockMode('stalled_body');
  const tStall = Date.now();
  let eStall = { status: 0, data: {} };
  try {
    eStall = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS, 9000);
  } catch (err) {
    eStall = { status: 0, data: { code: 'client_aborted', error: String(err && err.message || err) } };
  }
  const stallCost = Date.now() - tStall;
  check('响应头发 200 但 body 不结束 → 仍按配置超时',
    eStall.status === 502 && eStall.data.code === 'llm_timeout' && stallCost < 6000,
    `status=${eStall.status} code=${eStall.data.code} cost=${stallCost}ms`);
  await setMockMode('ok');
  const recovered = await post(LIVE_PORT, '/api/ideas', BASE_IDEAS);
  check('失败后重试恢复成功', recovered.data.ok === true && recovered.data.plans.length === 3);

  group('【真实模式 · 视觉开关】');
  await setMockMode('vision');
  const visOn = await post(VISION_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: img, item: '', material: '' }));
  check('视觉启用且图片已发出 → 识别结果可纠正',
    visOn.data.ok === true && visOn.data.visionUsed === true && visOn.data.recognized.source === 'vision');
  const visOff = await post(VISION_PORT, '/api/ideas', Object.assign({}, BASE_IDEAS, { sampleId: null, image: null, item: '旧铁盒' }));
  check('视觉启用但没图片 → 不声称识图', visOff.data.visionUsed === false && visOff.data.recognized.source === 'user');
  await setMockMode('ok');

  group('汇总');
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  procs.forEach((p) => p.kill());
  if (fail) {
    console.log('\n失败明细：');
    results.filter((r) => !r.ok).forEach((r) => console.log(' - ' + r.name + (r.detail ? ' :: ' + r.detail : '')));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
