'use strict';

// 腾讯云通用文字识别（GeneralBasicOCR）：只做「照片上的文字 → 可核对的文本」，
// 不把文字识别包装成「看懂物品」，识别结果始终允许用户纠正。
const { credentialStatus, call } = require('./tcapi');

const SPEC = {
  service: 'ocr',
  host: 'ocr.tencentcloudapi.com',
  action: 'GeneralBasicOCR',
  version: '2018-11-19'
};

async function requestOcr(imageBase64, timeoutMs) {
  const result = await call(Object.assign({}, SPEC, {
    payload: { ImageBase64: imageBase64, LanguageType: 'zh' }
  }), timeoutMs);
  if (!result.ok) {
    return {
      ok: false,
      code: `ocr_${result.code}`,
      error: result.error,
      httpStatus: result.httpStatus,
      requestId: result.requestId
    };
  }
  const response = result.response || {};
  const detections = Array.isArray(response.TextDetections) ? response.TextDetections : [];
  return {
    ok: true,
    requestId: result.requestId,
    texts: detections.map((d) => ({
      text: String(d.DetectedText || '').trim(),
      confidence: Number(d.Confidence) || 0
    })).filter((d) => d.text),
    language: response.Language || ''
  };
}

// 归并重复行，给出展示用的短文本；不推断物品名称。
function summarize(texts, maxText) {
  const seen = new Set();
  const lines = [];
  for (const entry of texts) {
    const text = entry.text.replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    lines.push({ text, confidence: entry.confidence });
  }
  return {
    lines: lines.slice(0, 30),
    joined: lines.map((l) => l.text).join(' / ').slice(0, Math.max(60, maxText || 200)),
    count: lines.length
  };
}

// 从 OCR 原文里找「材质/品类线索」：只做关键词命中，命中才给候选，并标明是文字线索。
const KEYWORDS = [
  { re: /pet|聚酯|涤纶|饮料瓶|矿泉水|塑料瓶/i, item: '塑料饮料瓶', material: 'PET 塑料' },
  { re: /瓦楞|纸箱|快递箱|corrugated|carton/i, item: '瓦楞纸箱', material: '瓦楞纸板' },
  { re: /棉|cotton|纯棉|t恤|t-?shirt/i, item: '旧棉 T 恤', material: '棉针织布' },
  { re: /玻璃|glass|罐头|酱瓶/i, item: '玻璃瓶', material: '玻璃' },
  { re: /马口铁|铁盒|tin|金属|铝|aluminum/i, item: '金属盒罐', material: '金属（未确认）' },
  { re: /纸盒|纸袋|卡纸|cardboard|纸浆/i, item: '纸盒 / 卡纸', material: '纸板' },
  { re: /pp|pe|hdpe|塑料|plastic/i, item: '塑料容器', material: '塑料（未确认）' },
  { re: /木|wood|竹|bamboo/i, item: '木 / 竹制品', material: '木竹（未确认）' },
  { re: /牛仔|denim|布料|织物|fabric/i, item: '旧布料', material: '织物（未确认）' }
];

function guess(input) {
  const joined = Array.isArray(input)
    ? input.map((t) => (typeof t === 'string' ? t : (t && t.text) || '')).join(' ')
    : String(input || '');
  for (const rule of KEYWORDS) {
    if (rule.re.test(joined)) {
      return { item: rule.item, material: rule.material, hit: (joined.match(rule.re) || [''])[0] };
    }
  }
  return null;
}

module.exports = { credentialStatus, requestOcr, summarize, guess, ACTION: SPEC.action, HOST: SPEC.host };
