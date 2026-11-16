'use strict';

// 流水线部署后远端验真：退出码 0 不代表线上真的生效，必须查真实响应。
// 分别验证「云函数 live 配置」「静态产物已刷新」「存量页面未被覆盖」「OCR 业务真的通」。
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const APP = path.join(__dirname, '..');
const SITE = (process.env.UPCYCLE_SITE || 'https://case.evansong.cn').replace(/\/$/, '');
const API = (process.env.UPCYCLE_API || SITE + '/upcycle/api/').replace(/\/?$/, '/');
const CACHE = { 'Cache-Control': 'no-cache' };
let pass = 0;
let fail = 0;

function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ok  ' + label); }
  else { fail++; console.log('  FAIL ' + label + (detail ? ' → ' + detail : '')); }
}

async function get(url, opts) {
  const res = await fetch(url, Object.assign({ headers: CACHE, signal: AbortSignal.timeout(20000) }, opts || {}));
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, body: buf, text: buf.toString('utf8') };
}

function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }

async function main() {
  console.log('远端验真：' + SITE + ' / ' + API);

  let cfg;
  try {
    const r = await get(API + 'config');
    cfg = r.status === 200 ? JSON.parse(r.text).config : null;
    ok('GET /api/config 返回 200', r.status === 200, 'HTTP ' + r.status);
    ok('mode=live', !!(cfg && cfg.mode === 'live'), cfg && cfg.mode);
    ok('vision=true', !!(cfg && cfg.vision === true), String(cfg && cfg.vision));
    ok('OCR 已配置', !!(cfg && cfg.ocr && cfg.ocr.configured === true));
    ok('模型名非空', !!(cfg && cfg.model), cfg && cfg.model);
  } catch (err) {
    ok('GET /api/config 可达', false, String(err && err.message));
  }

  // 静态产物：本地构建出来的 index.html 必须与云端逐字节一致，才算真的刷新。
  const localIndex = path.join(APP, 'deploy-cloudbase', 'site', 'index.html');
  try {
    const local = fs.readFileSync(localIndex);
    const r = await get(SITE + '/upcycle/index.html');
    ok('/upcycle/index.html 返回 200', r.status === 200, 'HTTP ' + r.status);
    ok('/upcycle/index.html 与本地产物 md5 一致', md5(local) === md5(r.body),
      md5(local).slice(0, 10) + ' vs ' + md5(r.body).slice(0, 10));
  } catch (err) {
    ok('静态产物比对', false, String(err && err.message));
  }

  // 存量：门户根页、股票复盘子页、公共静态资源不能被这次部署覆盖或删掉。
  const keep = [
    ['/', 'PRODUCT SHOWCASE'],
    ['/stock-review/', '<html'],
    ['/og.png', null],
    ['/cloudbase-sdk.js', null]
  ];
  for (const [p, marker] of keep) {
    try {
      const r = await get(SITE + p);
      const good = r.status === 200 && (!marker || r.text.includes(marker));
      ok('存量 ' + p + ' 完好', good, 'HTTP ' + r.status);
    } catch (err) {
      ok('存量 ' + p + ' 完好', false, String(err && err.message));
    }
  }

  // 业务级：真发一次 OCR，确认不是「路由通但功能坏」。
  const fixture = path.join(APP, 'scripts', 'fixtures', 'ocr-check.png');
  try {
    const b64 = fs.readFileSync(fixture).toString('base64');
    const res = await fetch(API + 'ocr', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: 'data:image/png;base64,' + b64 }),
      signal: AbortSignal.timeout(40000)
    });
    const j = await res.json();
    ok('真实 OCR POST 业务成功', res.status === 200 && j.ok === true && j.source === 'ocr',
      'HTTP ' + res.status + ' / ok=' + j.ok + ' / source=' + j.source);
  } catch (err) {
    ok('真实 OCR POST 业务成功', false, String(err && err.message));
  }

  // 关键护栏：/api/config 显示 live 只说明「配置被写了进去」，不能证明 Qwen Key
  // 真的被 {{env.*}} 解析成功。密钥错、占位符没替换时 config 仍可能显示 live，
  // 但所有方案生成都会失败。必须真发一次最省 payload 的纯文字请求，端到端断言模型。
  try {
    const body = {
      item: '玻璃瓶',
      material: '玻璃',
      description: '',
      tools: ['scissors', 'ruler', 'pencil', 'glue', 'tape'],
      budget: 30,
      forbidden: [],
      extra: '',
      ocrText: ''
    };
    const res = await fetch(API + 'ideas', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90000)
    });
    const j = await res.json();
    const lanes = Array.isArray(j.plans) ? j.plans.map((p) => p.lane) : [];
    const modelOk = res.status === 200 && j.ok === true && j.mode === 'live' && j.source === 'llm' && lanes.length >= 1;
    ok('真实模型 /api/ideas 端到端可用', modelOk,
      'HTTP ' + res.status + ' / mode=' + j.mode + ' / source=' + j.source + ' / plans=' + lanes.length);
    // 不硬断言恰好 3 个：实测无图纯文字请求偶发只回 1 个可行方案 + 2 个 infeasible，
    // 是模型对预算/工具约束的判断抖动（source=llm 两次都成立），不是部署故障。
    // 硬断言 3 个会让 CI 因模型抖动误报，这里只如实提示、不计入失败。
    if (modelOk && lanes.length < 3) {
      console.log('  warn 本次只返回 ' + lanes.length + ' 个可行方案（模型约束判断抖动，链路已确认正常）');
    }
  } catch (err) {
    ok('真实模型 /api/ideas 端到端可用', false, String(err && err.message));
  }

  console.log('\n远端验真：' + pass + ' 通过 / ' + fail + ' 失败');
  if (fail) process.exitCode = 1;
}

main().catch((err) => { console.error('验真脚本异常：' + String(err && err.message)); process.exitCode = 1; });
