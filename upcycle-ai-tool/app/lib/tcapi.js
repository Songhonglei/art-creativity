'use strict';

// 腾讯云 API 3.0 通用客户端：零依赖，TC3-HMAC-SHA256 签名 + 完整响应体超时。
// 凭据只从运行时环境读取，不写入代码、日志或任何返回给前端的内容。
const crypto = require('node:crypto');

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function hmac(key, text) {
  return crypto.createHmac('sha256', key).update(text, 'utf8').digest();
}

function pick() {
  for (const name of arguments) {
    const value = (process.env[name] || '').trim();
    if (value) return value;
  }
  return '';
}

// 只返回能力状态，绝不返回凭据内容。
function credentialStatus() {
  // 显式配置的专用密钥优先：云函数运行角色实测没有 OCR 权限，
  // 若先取运行时临时密钥，用户配了有权限的子账号密钥也不会生效。
  const envId = pick('TENCENT_CLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_ID');
  const envKey = pick('TENCENT_CLOUD_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY');
  if (envId && envKey) {
    return { available: true, source: 'env', token: Boolean(pick('TENCENT_CLOUD_TOKEN')) };
  }
  const id = pick('TENCENTCLOUD_SECRETID');
  const key = pick('TENCENTCLOUD_SECRETKEY');
  if (id && key) {
    return { available: true, source: 'runtime', token: Boolean(pick('TENCENTCLOUD_SESSIONTOKEN')) };
  }
  return { available: false, source: 'none', token: false };
}

function credential() {
  const status = credentialStatus();
  if (!status.available) return null;
  const common = {
    region: pick('TENCENTCLOUD_REGION', 'OCR_REGION') || 'ap-shanghai'
  };
  if (status.source === 'runtime') {
    return Object.assign(common, {
      secretId: pick('TENCENTCLOUD_SECRETID'),
      secretKey: pick('TENCENTCLOUD_SECRETKEY'),
      token: pick('TENCENTCLOUD_SESSIONTOKEN')
    });
  }
  return Object.assign(common, {
    secretId: pick('TENCENT_CLOUD_SECRET_ID', 'TENCENTCLOUD_SECRET_ID'),
    secretKey: pick('TENCENT_CLOUD_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY'),
    token: pick('TENCENT_CLOUD_TOKEN')
  });
}

function signedHeaders(cred, payload, timestamp, service, host, action, version) {
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const contentType = 'application/json; charset=utf-8';
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\n`;
  const headerKeys = 'content-type;host';
  const canonicalRequest = [
    'POST', '/', '', canonicalHeaders, headerKeys, sha256(payload)
  ].join('\n');
  const scope = `${date}/${service}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', String(timestamp), scope, sha256(canonicalRequest)].join('\n');
  const secretDate = hmac(`TC3${cred.secretKey}`, date);
  const secretService = hmac(secretDate, service);
  const secretSigning = hmac(secretService, 'tc3_request');
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign, 'utf8').digest('hex');
  const headers = {
    'Authorization': `TC3-HMAC-SHA256 Credential=${cred.secretId}/${scope}, SignedHeaders=${headerKeys}, Signature=${signature}`,
    'Content-Type': contentType,
    'Host': host,
    'X-TC-Action': action,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': version,
    'X-TC-Region': cred.region
  };
  if (cred.token) headers['X-TC-Token'] = cred.token;
  return headers;
}

function sanitize(message) {
  return String(message || '').replace(/[A-Za-z0-9+/=]{80,}/g, '[已省略]').slice(0, 200);
}

/**
 * @param {{service:string,host:string,action:string,version:string,payload:object}} spec
 * @param {number} timeoutMs
 * @returns {Promise<{ok:boolean, code?:string, error?:string, response?:object, httpStatus?:number, requestId?:string}>}
 */
async function call(spec, timeoutMs) {
  const cred = credential();
  if (!cred) return { ok: false, code: 'no_credentials', error: '运行时没有可用的腾讯云凭据' };

  const payload = JSON.stringify(spec.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = signedHeaders(cred, payload, timestamp, spec.service, spec.host, spec.action, spec.version);
  const controller = new AbortController();
  // 计时器覆盖到响应体完整读完，避免上游只给响应头挂住 body。
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://${spec.host}/`, {
      method: 'POST', headers, body: payload, signal: controller.signal
    });
    let parsed;
    try {
      parsed = await res.json();
    } catch (err) {
      if (controller.signal.aborted) throw new Error('timeout');
      throw new Error('bad_response');
    }
    const response = (parsed && parsed.Response) || {};
    const shared = { httpStatus: res.status, requestId: response.RequestId || '' };
    if (response.Error) {
      return Object.assign(shared, {
        ok: false,
        code: String(response.Error.Code || 'api_failed'),
        error: sanitize(response.Error.Message)
      });
    }
    if (!res.ok) return Object.assign(shared, { ok: false, code: 'api_http', error: `HTTP ${res.status}` });
    return Object.assign(shared, { ok: true, response });
  } catch (err) {
    if (controller.signal.aborted || (err && err.name === 'AbortError')) {
      return { ok: false, code: 'timeout', error: `接口超时（${timeoutMs} ms），可以重试` };
    }
    return { ok: false, code: 'unreachable', error: sanitize(err && err.message) };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { credentialStatus, call, sanitize };
