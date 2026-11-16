'use strict';

// 针对性验证：文字识别链路 + OCR 结果驱动方案。
// 重要：这里的 OCR 全部由本地 mock fetch 模拟，不是真实腾讯云调用，不能写成「真实 OCR 成功」。
// 线上真实状态请用 scripts/verify-cloud-ocr.js 验证。
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let pass = 0;
let total = 0;

function check(name, ok, detail) {
  total += 1;
  if (ok) { pass += 1; console.log(`  [PASS] ${name}`); }
  else console.log(`  [FAIL] ${name}${detail ? ' · ' + String(detail).slice(0, 160) : ''}`);
}

function mockFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return function restore() { globalThis.fetch = original; };
}

function tcbResponse(body, status) {
  return {
    ok: status == null || status === 200,
    status: status || 200,
    json: async () => ({ Response: body })
  };
}

function detections(texts) {
  return tcbResponse({
    RequestId: 'mock-req-1',
    TextDetections: texts.map((t, i) => ({ DetectedText: t, Confidence: 98 - i }))
  });
}

function imageDataUrl() {
  const buf = fs.readFileSync(path.join(ROOT, 'public', 'favicon-32.png'));
  return 'data:image/png;base64,' + buf.toString('base64');
}

async function expectApiError(name, fn, codePart, messagePart) {
  try {
    await fn();
    check(name, false, '没有抛错');
  } catch (err) {
    check(name, String(err.code || '').includes(codePart) &&
      String(err.message || '').includes(messagePart), `${err.code}: ${err.message}`);
  }
}

async function main() {
  console.log('文字识别链路验证（本地模拟 OCR，非真实调用）');
  console.log('');

  // 模拟运行时临时凭据，让 credentialStatus() 认为已配置；值不是真实密钥。
  process.env.TENCENTCLOUD_SECRETID = 'mock-id';
  process.env.TENCENTCLOUD_SECRETKEY = 'mock-key';
  process.env.TENCENTCLOUD_SESSIONTOKEN = 'mock-token';
  delete process.env.LLM_BASE_URL;
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;

  const { loadConfig } = require('../lib/config');
  const { handleOcr, handleIdeas } = require('../lib/orchestrator');
  const config = loadConfig();
  const image = imageDataUrl();

  check('演示凭据被识别为已配置', config.ocrAvailable === true, String(config.ocrAvailable));
  process.env.TENCENT_CLOUD_SECRET_ID = 'dedicated-id';
  process.env.TENCENT_CLOUD_SECRET_KEY = 'dedicated-key';
  check('显式专用密钥优先于运行时临时密钥',
    require('../lib/tcapi').credentialStatus().source === 'env');
  delete process.env.TENCENT_CLOUD_SECRET_ID;
  delete process.env.TENCENT_CLOUD_SECRET_KEY;
  check('公共配置只暴露 configured，不含凭据', config.ocrAvailable === true &&
    JSON.stringify(require('../lib/config').publicConfig(config)).indexOf('mock-key') < 0);

  await expectApiError('没有照片时明确拒绝',
    () => handleOcr(config, {}), 'bad_image', '请先放一张照片');
  await expectApiError('非法图片不会发给上游',
    () => handleOcr(config, { image: 'data:image/png;base64,AAAA' }), 'bad_image', '');

  // 1. 正常识别
  let restore = mockFetch(async () => detections(['PET 饮料瓶 500ml', '净含量', '请回收']));
  const okData = await handleOcr(config, { image });
  restore();
  check('模拟 OCR 返回真实结构', okData.ok === true && okData.source === 'ocr');
  check('识别原文去重并保留置信度', okData.ocr.count === 3 && okData.ocr.lines[0].confidence === 98,
    JSON.stringify(okData.ocr.lines));
  check('文字线索只从原文推，命中 PET', okData.ocr.guess && okData.ocr.guess.item === '塑料饮料瓶',
    JSON.stringify(okData.ocr.guess));
  check('明确说明只是包装文字，不是看图判断',
    okData.ocr.notice.includes('不代表对物品的判断'));
  check('响应里没有凭据或 base64 图片',
    JSON.stringify(okData).indexOf('mock-key') < 0 && JSON.stringify(okData).indexOf('iVBOR') < 0);

  // 2. 识别成功但没读到文字
  restore = mockFetch(async () => tcbResponse({ RequestId: 'mock-req-2', TextDetections: [] }));
  const emptyData = await handleOcr(config, { image });
  restore();
  check('空文字也是成功但不谎称识别到物品',
    emptyData.ok === true && emptyData.ocr.count === 0 && emptyData.ocr.guess === null);
  check('空文字给出换照片或手填的提示', emptyData.ocr.notice.includes('没有读到可辨认的文字'));

  // 3. 服务未开通 / 无权限
  restore = mockFetch(async () => tcbResponse({
    RequestId: 'mock-req-3',
    Error: { Code: 'AuthFailure.UnauthorizedOperation', Message: 'You are not authorized' }
  }));
  await expectApiError('无权限时不假装识别成功并提示开通',
    () => handleOcr(config, { image }), 'UnauthorizedOperation', '开通');
  restore();

  // 4. 读响应体挂住的超时
  restore = mockFetch(async (url, opts) => ({
    ok: true, status: 200,
    json: () => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      });
    })
  }));
  process.env.OCR_TIMEOUT_MS = '300';
  const shortConfig = loadConfig();
  await expectApiError('响应体挂住也能超时退出',
    () => handleOcr(shortConfig, { image }), 'ocr_timeout', '超时');
  restore();
  delete process.env.OCR_TIMEOUT_MS;

  // 5. 未配置凭据
  delete process.env.TENCENTCLOUD_SECRETID;
  delete process.env.TENCENTCLOUD_SECRETKEY;
  delete process.env.TENCENTCLOUD_SESSIONTOKEN;
  const bareConfig = loadConfig();
  check('没有凭据时公共配置显示未配置',
    require('../lib/config').publicConfig(bareConfig).ocr.configured === false);
  await expectApiError('没有凭据时明确报错，不默默切示例',
    () => handleOcr(bareConfig, { image }), 'ocr_no_credentials', '没有配置');

  // 恢复模拟凭据，测 OCR 文本驱动方案。
  process.env.TENCENTCLOUD_SECRETID = 'mock-id';
  process.env.TENCENTCLOUD_SECRETKEY = 'mock-key';
  const demoConfig = loadConfig();

  const ideasFromOcr = await handleIdeas(demoConfig, {
    image,
    ocrText: 'PET 饮料瓶 500ml 净含量',
    tools: ['scissors', 'ruler'], budget: 20,
    // 前端伪造的候选值，服务端必须忽略。
    ocrGuess: { item: '伪造物品', material: '伪造材质' }
  });
  check('示例模式按 OCR 文字生成三款方案', ideasFromOcr.plans.length === 3,
    String(ideasFromOcr.plans.length));
  check('物品来源标为照片文字线索，不是识图结果',
    ideasFromOcr.recognized.source === 'ocr' && ideasFromOcr.recognized.item === '塑料饮料瓶',
    JSON.stringify(ideasFromOcr.recognized));
  check('忽略前端伪造的候选值', ideasFromOcr.recognized.material === 'PET 塑料');
  check('结果说明不冒充看图识别', ideasFromOcr.notice.includes('不是看图识别结果'));

  const withoutOcr = await handleIdeas(demoConfig, {
    image, item: '旧铁盒', material: '马口铁', tools: ['scissors'], budget: 20
  });
  check('手动填写仍标为填写的信息', withoutOcr.recognized.source === 'user');
  check('原有示例模式说明未被改动', withoutOcr.notice.includes('不是看图结果'));

  console.log('');
  console.log(`结果：${pass}/${total} 通过`);
  console.log('说明：以上 OCR 均为本地模拟（mock fetch），不代表真实腾讯云文字识别调用成功。');
  if (pass !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error('验证脚本异常：', err);
  process.exitCode = 1;
});
