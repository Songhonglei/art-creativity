'use strict';

// 本地验证云函数新增护栏：不联网、不调用真实 OCR / 模型。
// 只发非法图片（服务端在验图阶段就拒绝），用来检查限流与路由行为。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
let pass = 0, total = 0;
function check(name, ok, detail) {
  total += 1;
  if (ok) { pass += 1; console.log('  [PASS] ' + name); }
  else console.log('  [FAIL] ' + name + (detail ? ' · ' + String(detail).slice(0, 200) : ''));
}

function main() {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build-cloudbase.js')], { stdio: 'pipe' });
  // OCR 接口的额度是基础值的 2 倍，设 1 时同一来源第 3 次即触发 429。
  process.env.UPCYCLE_RATE_LIMIT = '1';
  const target = path.join(ROOT, 'deploy-cloudbase', 'functions', 'upcycle-api', 'index.js');
  const fn = require(target);

  function post(name, headers) {
    return {
      httpMethod: 'POST', path: '/upcycle/api/' + name,
      headers: headers || {},
      body: JSON.stringify({ image: 'data:image/png;base64,AAAA' })
    };
  }

  return (async () => {
    const first = await fn.main(post('ocr', { 'x-forwarded-for': '203.0.113.7' }));
    check('首次请求由服务端验图拒绝（未触网）', first.statusCode === 400 && first.body.includes('ok":false'), first.statusCode + ' ' + first.body.slice(0, 120));
    check('错误响应带 CORS 头', /access-control-allow-origin/i.test(JSON.stringify(first.headers).toLowerCase()));

    await fn.main(post('ocr', { 'x-forwarded-for': '203.0.113.7' }));
    const third = await fn.main(post('ocr', { 'x-forwarded-for': '203.0.113.7' }));
    check('同一来源超出限额返回 429 且给出明确错误码',
      third.statusCode === 429 && /rate_limited/.test(third.body), third.statusCode + ' ' + third.body.slice(0, 160));

    const other = await fn.main(post('ocr', { 'x-forwarded-for': '203.0.113.8' }));
    check('不同来源独立计数，不被别人拖累', other.statusCode === 400, String(other.statusCode));

    const cfg = await fn.main({ httpMethod: 'GET', path: '/upcycle/api/config?foo=1', headers: {} });
    check('带 query 的路径仍能命中 config', cfg.statusCode === 200 && /"ok":true/.test(cfg.body), String(cfg.statusCode));

    const src = fs.readFileSync(target, 'utf8');
    check('部署源含自检缓存与强制重测入口', /DIAG_TTL_MS/.test(src) && /fresh=1/.test(src));
    check('部署源不含任何明文密钥', !/LLM_API_KEY":\s*"[^"]+/.test(
      fs.readFileSync(path.join(ROOT, 'deploy-cloudbase', 'cloudbaserc.json'), 'utf8')));

    // 密钥只在部署瞬间短暂落到生成物；源码、文档、验证日志都不该出现完整 Key。
    const modelsPath = path.join(process.env.HOME || '', '.workbuddy', 'models.json');
    if (fs.existsSync(modelsPath)) {
      const keys = JSON.parse(fs.readFileSync(modelsPath, 'utf8'))
        .map((x) => x && x.apiKey)
        .filter((k) => typeof k === 'string' && k.length > 16);
      const hits = [];
      (function walk(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (['node_modules', '.git', 'output', 'deploy-cloudbase', '.env'].indexOf(e.name) >= 0) continue;
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.isFile() && keys.some((k) => fs.readFileSync(p, 'utf8').includes(k))) {
            hits.push(path.relative(ROOT, p));
          }
        }
      })(ROOT);
      check('项目源码 / 文档 / 配置不含本机模型 API Key', hits.length === 0, hits.join(', '));
      const mode = fs.statSync(path.join(ROOT, 'deploy-cloudbase', 'cloudbaserc.json')).mode & 0o777;
      check('部署源配置还原后不可被其他用户写入', (mode & 0o022) === 0, 'mode=' + mode.toString(8));
    }

    console.log('\n结果：' + pass + '/' + total + ' 通过');
    if (pass !== total) process.exitCode = 1;
  })();
}

main().catch((err) => {
  console.error('护栏验证异常：', err);
  process.exitCode = 1;
});
