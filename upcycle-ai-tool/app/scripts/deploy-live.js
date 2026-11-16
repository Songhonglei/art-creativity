'use strict';

// 把 WorkBuddy 本地自定义模型里的 Qwen 配置注入云函数 upcycle-api 并部署。
// 密钥只在进程内传递：短暂写入生成物 cloudbaserc.json，部署结束后立即还原。
// 不打印密钥、不写入静态站、不写入仓库源码（deploy-cloudbase/ 为生成物且已忽略）。
// 加固点：写盘前显式收紧权限；Ctrl+C / 终止信号 / 异常都走同一条幂等还原；
// 部署后查远端 /api/config，防止「空 envVariables 覆盖线上配置」静默退回示例模式。
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const APP = path.join(__dirname, '..');
const OUT = path.join(APP, 'deploy-cloudbase');
const TEMPLATE = path.join(APP, 'cloudbase', 'cloudbaserc.json');
const MODELS = path.join(process.env.HOME || '', '.workbuddy', 'models.json');
const MODEL_ID = process.env.UPCYCLE_MODEL_ID || 'qwen3.8-flash';
const API = process.env.UPCYCLE_API
  || 'https://evansongdev-d3gwank9e76835e8b-1343046532.ap-shanghai.app.tcloudbase.com/upcycle/api/';

let restoreConfig = null;

function run(cmd, args, cwd) {
  // 异步 spawn：部署期间 Ctrl+C 能立刻进入信号钩子，不会被同步调用堵住。
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: cwd || APP, stdio: 'inherit', shell: true });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(cmd + ' 退出码 ' + code + (signal ? ' / 信号 ' + signal : '')));
    });
  });
}

function installGuards() {
  const bail = (why) => {
    if (restoreConfig) {
      try { restoreConfig(); } catch (err) { console.error('还原部署源失败：' + String(err && err.message || err)); }
    }
    console.error('\n' + why + '；密钥已从部署源还原。部署可能未完成，请重跑 npm run deploy:live，再用 npm run verify:cloudbase 复核。');
    process.exit(1);
  };
  process.on('SIGINT', () => bail('收到中断信号'));
  process.on('SIGTERM', () => bail('收到终止信号'));
  process.on('uncaughtException', (err) => bail('未捕获异常：' + String(err && err.message || err)));
  process.on('unhandledRejection', (err) => bail('未处理的异步失败：' + String(err && err.message || err)));
}

// 只信远端真实响应：部署命令退出码 0 不代表环境变量真的生效。
async function checkRemoteLive(expectVision) {
  const url = API.replace(/\/?$/, '/') + 'config';
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(12000)
      });
      const data = await res.json();
      const mode = data && data.config && data.config.mode;
      const vision = data && data.config && data.config.vision;
      // 视觉开关也要远端复核：空配置覆盖或漏传开关都不能算部署成功。
      if (mode === 'live' && (!expectVision || vision === true)) {
        console.log('远端复核：/api/config mode=live，模型 ' + (data.config.model || '') +
          '，视觉 ' + (vision ? '已启用' : '未启用'));
        return true;
      }
      console.log('远端复核第 ' + (i + 1) + ' 次：mode=' + mode + ' vision=' + vision +
        '（可能仍在生效，稍后重试）');
    } catch (err) {
      console.log('远端复核第 ' + (i + 1) + ' 次失败：' + String(err && err.message || err));
    }
    if (i < 3) await new Promise((r) => setTimeout(r, 2500));
  }
  return false;
}

async function main() {
  if (!fs.existsSync(MODELS)) throw new Error('找不到本地自定义模型配置：' + MODELS);
  const models = JSON.parse(fs.readFileSync(MODELS, 'utf8'));
  const picked = models.find((x) => x && x.id === MODEL_ID)
    || models.find((x) => x && /qwen/i.test(String(x.id || '')));
  if (!picked || !picked.url || !picked.apiKey) throw new Error('本地模型配置里没有可用的 Qwen 端点与密钥');
  if (String(picked.url).includes('127.0.0.1') || String(picked.url).includes('localhost')) {
    throw new Error('本地地址无法被云函数访问，请使用公网可达的 OpenAI 兼容端点');
  }

  const template = JSON.parse(fs.readFileSync(TEMPLATE, 'utf8'));
  const fn = (template.functions || []).find((f) => f.name === 'upcycle-api');
  if (!fn) throw new Error('部署模板里缺少 upcycle-api 配置');
  fn.envVariables = {
    LLM_BASE_URL: String(picked.url).trim(),
    LLM_API_KEY: String(picked.apiKey).trim(),
    LLM_MODEL: MODEL_ID,
    // 视觉已实测可用，默认保持开启；只有显式 UPCYCLE_VISION=false 才关闭，
    // 避免以后普通 npm run deploy:live 意外把视觉关掉。
    LLM_VISION: process.env.UPCYCLE_VISION === 'false' ? 'false' : 'true',
    LLM_DISABLE_THINKING: 'true',
    LLM_JSON_MODE: 'true',
    LLM_TIMEOUT_MS: '45000'
  };

  await run(process.execPath, [path.join(APP, 'scripts', 'build-cloudbase.js')]);
  const target = path.join(OUT, 'cloudbaserc.json');
  const clean = fs.readFileSync(target, 'utf8');
  const cleanFn = (JSON.parse(clean).functions || []).find((f) => f.name === 'upcycle-api');
  if (cleanFn && cleanFn.envVariables && Object.keys(cleanFn.envVariables).length) {
    throw new Error('部署模板里残留环境变量，已中止（避免凭据写进仓库模板）');
  }
  const originalMode = fs.statSync(target).mode & 0o777;
  let restored = false;
  restoreConfig = () => {
    if (restored) return;
    fs.writeFileSync(target, clean);
    fs.chmodSync(target, originalMode);
    restored = true;
  };

  // writeFileSync 的 mode 只对新建文件有效；这里必须显式 chmod 后才写入密钥。
  fs.chmodSync(target, 0o600);
  fs.writeFileSync(target, JSON.stringify(template, null, 2) + '\n');
  try {
    console.log('注入环境变量：' + Object.keys(fn.envVariables).join(' / ') + '（值不回显）');
    await run('tcb', ['fn', 'deploy', 'upcycle-api', '-e', template.envId, '--path', '/upcycle/api', '--force'], OUT);
    console.log('云函数 upcycle-api 已部署');
  } finally {
    restoreConfig();
    console.log('部署源配置已还原为空环境变量，密钥未留在项目文件里');
  }

  if (!(await checkRemoteLive(fn.envVariables.LLM_VISION === 'true'))) {
    console.error('远端复核未确认模型模式 / 视觉开关：请检查云函数环境变量是否被空配置覆盖，并重跑 npm run deploy:live；不要对外声称部署成功。');
    process.exitCode = 1;
  }
}

installGuards();
main().catch((err) => {
  if (restoreConfig) {
    try { restoreConfig(); } catch (e) { console.error('还原部署源失败：' + String(e && e.message || e)); }
  }
  console.error('部署失败：' + String(err && err.message || err));
  process.exitCode = 1;
});
