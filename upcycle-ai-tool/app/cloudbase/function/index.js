'use strict';

// CloudBase HTTP 云函数入口：把 API 网关事件转给本地同一套规则引擎。
// 与 server.js 共用 lib/，不复制业务逻辑；密钥仍只从服务端环境变量读取。
const { loadConfig, publicConfig } = require('./lib/config');
const { handleIdeas, handleRefine, handleOcr, ApiError } = require('./lib/orchestrator');
const { TOOLS, LANES, SAMPLE_META, DEFAULT_TOOLS } = require('./lib/data/catalog');
const { credentialStatus, requestOcr } = require('./lib/ocr');

const config = loadConfig();
const DEFAULT_ORIGIN = process.env.UPCYCLE_SITE_ORIGIN
  || 'https://evansongdev-d3gwank9e76835e8b-1343046532.tcloudbaseapp.com';
// 自定义域名访问时页面仍可能跨域请求网关接口，这里一并放行（本地预览也保留）。
// 只影响浏览器 CORS 响应头，不是鉴权；接口本身仍是公开的。
const SITE_ORIGINS = [
  DEFAULT_ORIGIN,
  'https://wanwu.evansong.cn',
  'https://stock-review.evansong.cn',
  'https://case.evansong.cn'
];

// 公开网址挂着真实模型密钥与 OCR 免费额度：自检结果缓存 60 秒，避免每次 GET /diag
// 都真发一次 OCR + STS；POST 接口按来源做一层轻量限流。
// 注意：计数只在单个云函数容器内有效，容器回收后重置，这是护栏不是强防护。
const DIAG_TTL_MS = 60000;
const RATE_WINDOW_MS = 60000;
const rateBuckets = new Map();
let diagCache = null;

function clientKey(event) {
  const h = (event && event.headers) || {};
  const raw = h['x-forwarded-for'] || h['X-Forwarded-For']
    || h['x-real-ip'] || h['X-Real-IP'] || '';
  const ip = String(raw).split(',')[0].trim();
  return ip || 'shared';
}

function allowRequest(name, event) {
  const raw = Number.parseInt(process.env.UPCYCLE_RATE_LIMIT || '', 10);
  const base = Number.isFinite(raw) && raw >= 0 ? raw : 12;
  if (base === 0) return true;
  const ip = clientKey(event);
  // 网关没给来源 IP 时所有访客共用一个桶，放大额度避免误伤正常用户。
  const limit = (name === 'ocr' ? base * 2 : base) * (ip === 'shared' ? 5 : 1);
  const key = ip + ':' + name;
  const now = Date.now();
  if (rateBuckets.size > 500) {
    for (const [k, v] of rateBuckets) if (now - v.start > RATE_WINDOW_MS) rateBuckets.delete(k);
  }
  let entry = rateBuckets.get(key);
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    entry = { start: now, count: 0 };
    rateBuckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= limit;
}

function headers(origin) {
  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  const allow = !origin || isLocal || SITE_ORIGINS.indexOf(origin) >= 0
    ? (origin || DEFAULT_ORIGIN) : DEFAULT_ORIGIN;
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin'
  };
}

function json(status, payload, origin) {
  return { statusCode: status, headers: headers(origin), body: JSON.stringify(payload) };
}

function lastSegment(rawPath) {
  // 网关可能把 query 拼在 path 里（?fresh=1），先剥掉再取末段。
  const parts = String(rawPath || '').split('?')[0].split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : String(event.body);
  if (Buffer.byteLength(raw, 'utf8') > config.limits.maxBodyBytes) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

exports.main = async (event) => {
  event = event || {};
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const method = String(event.httpMethod || 'GET').toUpperCase();
  if (method === 'OPTIONS') return { statusCode: 204, headers: headers(origin), body: '' };

  // 路由前缀是否透传由网关决定，这里只认末段，/config、/upcycle/api/config 都能命中。
  const name = lastSegment(event.path);

  if (method === 'GET' && (name === 'config' || name === 'health')) {
    const ocr = credentialStatus();
    return json(200, {
      ok: true,
      config: publicConfig(config),
      // 只暴露能力状态，不暴露任何凭据内容。
      ocr: { configured: ocr.available, action: 'GeneralBasicOCR' },
      tools: TOOLS.filter((t) => t.id !== 'hands'),
      defaultTools: DEFAULT_TOOLS,
      lanes: LANES,
      samples: SAMPLE_META
    }, origin);
  }

  // 只读能力自检：用带可识别文字的 PNG 真发一次 OCR 请求，凭错误码判断鉴权/开通状态。
  // 不含任何凭据内容，也不改变业务数据。60 秒内复用同一容器的探测结果，避免刷额度；
  // 需要强制重测时加 ?fresh=1（或 queryStringParameters.fresh=1）。
  if (method === 'GET' && name === 'diag') {
    const forceFresh = /[?&]fresh=1(?:&|$)/.test(String(event.path || ''))
      || Boolean(event.queryStringParameters && String(event.queryStringParameters.fresh) === '1');
    if (!forceFresh && diagCache && Date.now() - diagCache.at < DIAG_TTL_MS) {
      return json(200, Object.assign({}, diagCache.data, {
        cached: true, cacheAgeMs: Date.now() - diagCache.at
      }), origin);
    }
    const status = credentialStatus();
    const probe = status.available
      ? await requestOcr('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', 8000)
      : { ok: false, code: 'ocr_not_configured', error: '运行时没有可用的识别凭据' };
    // 只读身份探测：确认运行时临时凭证实际扮演的 CAM 角色，便于精确授权（不返回任何凭据内容）。
    let identity = { ok: false, skipped: !status.available };
    if (status.available) {
      try {
        const { call } = require('./lib/tcapi');
        const r = await call({
          service: 'sts', host: 'sts.tencentcloudapi.com',
          action: 'GetCallerIdentity', version: '2018-08-13', payload: {}
        }, 8000);
        identity = {
          ok: r.ok,
          code: r.code || '',
          arn: (r.response && String(r.response.Arn || '')) || '',
          principalId: (r.response && String(r.response.PrincipalId || '')) || ''
        };
      } catch (err) {
        identity = { ok: false, code: 'sts_failed', error: String(err && err.message || err).slice(0, 160) };
      }
    }
    const payload = {
      ok: true,
      ocr: { configured: status.available },
      probe: {
        ok: probe.ok, code: probe.code, error: probe.error || '',
        httpStatus: probe.httpStatus || null, requestId: probe.requestId || ''
      },
      identity,
      llm: {
        mode: config.mode, vision: config.vision,
        upstreamHost: config.baseUrl ? new URL(config.baseUrl).host : null
      }
    };
    diagCache = { at: Date.now(), data: payload };
    return json(200, Object.assign({}, payload, { cached: false, cacheAgeMs: 0 }), origin);
  }

  if (method === 'POST' && (name === 'ideas' || name === 'refine' || name === 'ocr')) {
    if (!allowRequest(name, event)) {
      return json(429, {
        ok: false, code: 'rate_limited',
        error: '请求太频繁，请等一分钟再试（公开网址的轻量保护）', retryable: true
      }, origin);
    }
    const body = parseBody(event);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(400, { ok: false, code: 'bad_json', error: '请求体不是合法 JSON 或体积过大' }, origin);
    }
    try {
      const data = name === 'ideas'
        ? await handleIdeas(config, body)
        : (name === 'refine' ? await handleRefine(config, body) : await handleOcr(config, body));
      return json(200, data, origin);
    } catch (err) {
      if (err instanceof ApiError) {
        return json(err.status, { ok: false, code: err.code, error: err.message, retryable: true }, origin);
      }
      console.error('[upcycle-api] unexpected error:', err && err.message);
      return json(500, { ok: false, code: 'internal_error', error: '服务端处理失败，可以重试', retryable: true }, origin);
    }
  }

  return json(404, { ok: false, code: 'not_found', error: '没有这个接口' }, origin);
};
