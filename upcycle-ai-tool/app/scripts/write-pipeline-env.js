'use strict';

// 流水线构建环境专用：把平台注入的环境变量写成 .env.local，供 cloudbaserc.json 的
// {{env.XXX}} 解析。文件只在临时构建容器里存在，已被 .gitignore 排除，永不进仓库。
// 值不打印、不回显、不写日志；缺失必需项直接失败，避免空配置把线上覆盖回 demo 模式。
const fs = require('node:fs');
const path = require('node:path');

const APP = path.join(__dirname, '..');
const TARGET = path.join(APP, '.env.local');
const DEFAULTS = {
  LLM_MODEL: 'qwen3.8-flash',
  LLM_VISION: 'true',
  LLM_DISABLE_THINKING: 'true',
  LLM_JSON_MODE: 'true',
  LLM_TIMEOUT_MS: '45000'
};
const REQUIRED = ['LLM_BASE_URL', 'LLM_API_KEY'];
const KEYS = [
  'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_VISION',
  'LLM_DISABLE_THINKING', 'LLM_JSON_MODE', 'LLM_TIMEOUT_MS'
];

function pick(key) {
  // 平台 Secrets 以 $SECRET_<NAME> 注入；也兼容普通同名环境变量。
  return process.env['SECRET_' + key] || process.env[key] || DEFAULTS[key] || '';
}

function main() {
  const values = {};
  KEYS.forEach((key) => { values[key] = pick(key); });
  const missing = REQUIRED.filter((key) => !values[key]);
  if (missing.length) {
    throw new Error('流水线缺少必需环境变量：' + missing.join(' / ') +
      '（请在流水线高级设置里配置 Secrets，不要写进仓库）');
  }
  if (String(values.LLM_BASE_URL).includes('127.0.0.1') ||
      String(values.LLM_BASE_URL).includes('localhost')) {
    throw new Error('LLM_BASE_URL 是本机地址，云函数无法访问');
  }

  const lines = KEYS.map((key) => key + '=' + JSON.stringify(String(values[key])));
  fs.writeFileSync(TARGET, lines.join('\n') + '\n', { mode: 0o600 });
  fs.chmodSync(TARGET, 0o600);
  console.log('已生成 .env.local（' + KEYS.length + ' 项，值不回显），权限 600');
  console.log('模型：' + values.LLM_MODEL + ' / 视觉：' + values.LLM_VISION);
}

main();
