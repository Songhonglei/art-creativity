'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { credentialStatus } = require('./tcapi');

const ROOT = path.join(__dirname, '..');

// 极简 .env 读取：不引入依赖；真实环境变量优先。
function loadDotEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function normalizeBaseUrl(raw) {
  if (!raw) return null;
  const value = raw.trim();
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  // 只允许服务端配置的协议与主机；不接受前端传入的地址。
  return parsed.toString().replace(/\/+$/, '');
}

function loadConfig() {
  loadDotEnv();
  const baseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL || '');
  const apiKey = (process.env.LLM_API_KEY || '').trim();
  const model = (process.env.LLM_MODEL || '').trim();
  const configured = Boolean(baseUrl && apiKey && model);
  const timeoutMs = clampInt(process.env.LLM_TIMEOUT_MS, 20000, 1000, 120000);
  const ocrTimeoutMs = clampInt(process.env.OCR_TIMEOUT_MS, 12000, 1000, 60000);
  const port = clampInt(process.env.PORT, 4173, 1, 65535);
  const vision = configured && /^(true|1|yes|on)$/i.test((process.env.LLM_VISION || '').trim());
  // Qwen/DashScope 的 thinking 模式会让长 JSON 方案生成慢到网关超时；仅显式开启时才传厂商参数。
  const disableThinking = /^(true|1|yes|on)$/i.test((process.env.LLM_DISABLE_THINKING || '').trim());
  // 强制 JSON 输出同样是厂商参数；只对显式开启的端点发送，避免污染通用 OpenAI 兼容服务。
  const jsonMode = /^(true|1|yes|on)$/i.test((process.env.LLM_JSON_MODE || '').trim());
  const ocr = credentialStatus();
  return {
    root: ROOT,
    publicDir: path.join(ROOT, 'public'),
    port,
    mode: configured ? 'live' : 'demo',
    baseUrl,
    apiKey,
    model,
    vision,
    disableThinking,
    jsonMode,
    timeoutMs,
    ocrTimeoutMs,
    ocrAvailable: ocr.available,
    ocrCredentialSource: ocr.source,
    limits: {
      maxBodyBytes: 8 * 1024 * 1024,
      maxImageBytes: 5 * 1024 * 1024,
      minImageBytes: 64,
      maxDimension: 4096,
      minDimension: 16,
      maxText: 200,
      maxShortText: 60,
      maxExtra: 300,
      maxPlans: 3,
      maxSteps: 12,
      maxTools: 20
    }
  };
}

function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(String(raw || ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 只返回前端需要的公共信息；密钥与 base URL 一律不出服务端。
function publicConfig(config) {
  return {
    mode: config.mode,
    vision: config.vision,
    model: config.mode === 'live' ? config.model : null,
    timeoutMs: config.timeoutMs,
    // 只暴露「是否已配置」，不暴露凭据来源或内容。已配置 ≠ 一定有权限，实际调用失败会明确报错。
    ocr: { configured: config.ocrAvailable },
    limits: {
      maxImageBytes: config.limits.maxImageBytes,
      maxDimension: config.limits.maxDimension,
      maxText: config.limits.maxText,
      maxExtra: config.limits.maxExtra
    }
  };
}

module.exports = { loadConfig, publicConfig };
