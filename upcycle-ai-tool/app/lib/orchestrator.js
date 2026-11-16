'use strict';

const { SAMPLES, TOOL_IDS, TOOL_LABELS, LANES } = require('./data/catalog');
const { validateImage } = require('./image');
const { requestOcr, summarize, guess } = require('./ocr');
const {
  plain, safetyHints, normalizeConstraints, buildAll, coerceSpecs,
  specsForSample, genericPlans
} = require('./planner');
const { callIdeas, callRefine } = require('./llm');

class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status || 400;
  }
}

function checkLength(value, label, max) {
  if (typeof value === 'string' && value.length > max) {
    throw new ApiError('text_too_long', `${label}不能超过 ${max} 字`, 400);
  }
}

function validateBase(body, limits) {
  if (!body || typeof body !== 'object') throw new ApiError('bad_request', '请求格式不正确');
  checkLength(body.item, '物品名称', limits.maxShortText);
  checkLength(body.material, '材质', limits.maxShortText);
  checkLength(body.description, '补充描述', limits.maxText);
  checkLength(body.extra, '补充要求', limits.maxExtra);
  checkLength(body.ocrText, '识别文字', limits.maxText);
  const sampleId = typeof body.sampleId === 'string' && SAMPLES[body.sampleId] ? body.sampleId : null;
  if (body.sampleId && !sampleId) throw new ApiError('bad_sample', '没有这个内置示例');
  const tools = Array.isArray(body.tools)
    ? Array.from(new Set(body.tools.filter((t) => TOOL_IDS.includes(t) && t !== 'hands'))).slice(0, limits.maxTools)
    : [];
  const item = plain(body.item, limits.maxShortText);
  const material = plain(body.material, limits.maxShortText);
  const description = plain(body.description, limits.maxText);
  let image = null;
  if (body.image != null && body.image !== '') {
    if (typeof body.image !== 'string') throw new ApiError('bad_image', '图片格式不正确');
    const info = validateImage(body.image, limits);
    if (info.error) throw new ApiError(info.code, info.error, 400);
    image = { dataUrl: body.image, mime: info.mime, bytes: info.bytes, width: info.width, height: info.height };
  }
  const ocrText = typeof body.ocrText === 'string' ? plain(body.ocrText, limits.maxText) : '';
  return {
    sampleId, item, material, description, tools, image, ocrText,
    budget: body.budget
  };
}

function contextOf(base) {
  return {
    item: base.item,
    material: base.material,
    description: base.description,
    image: base.image ? base.image.dataUrl : null,
    // 真实 OCR 结果的原文，由前端回传；只作为文字线索，不冒充看图识别。
    ocrText: base.ocrText || ''
  };
}

function responseShape(mode, source, extra) {
  return Object.assign({
    ok: true, mode, source,
    requestId: `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  }, extra);
}

function laneStatus(plans, infeasible) {
  return LANES.map((lane) => {
    const plan = plans.find((p) => p.lane === lane.id);
    const bad = infeasible.find((p) => p.lane === lane.id);
    return {
      lane: lane.id,
      label: lane.label,
      feasible: Boolean(plan),
      planId: plan ? plan.id : null,
      title: plan ? plan.title : (bad ? bad.title : ''),
      estimatedCost: plan ? plan.estimatedCost : null,
      reason: bad ? bad.reason : ''
    };
  });
}

function finish(mode, source, ctx, c, specs, result, extraNotes, visionUsed, notice, recognized) {
  const notes = result.notes.slice();
  for (const n of extraNotes) if (!notes.includes(n)) notes.unshift(n);
  const safety = safetyHints(ctx.item, ctx.material, ctx.description, c.extra);
  return responseShape(mode, source, {
    notice, recognized, visionUsed,
    constraints: {
      budget: c.budget, tools: c.tools, forbidden: c.forbidden, extra: c.extra
    },
    specs,
    plans: result.plans,
    infeasible: result.infeasible,
    alternatives: result.alternatives,
    laneStatus: laneStatus(result.plans, result.infeasible),
    notes,
    safety,
    costNote: '费用为估计；未核实材质不保证安全、承重与防水。'
  });
}

function ocrErrorMessage(result) {
  const code = result.code || '';
  if (code === 'ocr_no_credentials') {
    return '服务端还没有配置文字识别凭据，暂时无法读取照片上的文字。请先完成配置再重试。';
  }
  if (/UnauthorizedOperation|AuthFailure|AccessDenied/i.test(code)) {
    // 实测结论：服务已开通、用运行时临时密钥，鉴权失败指向运行角色缺权限或临时凭据失效，
    // 不要再提示用户去「开通服务 / 配置长期密钥」。
    return '文字识别鉴权未通过：云函数运行角色缺少 OCR 调用权限，或运行时临时凭据已失效。请先到控制台确认「文字识别」已开通，并给运行角色关联文字识别只读策略后重试（线上默认用临时密钥，无需填写长期密钥）。';
  }
  if (code === 'ocr_timeout') return '文字识别超时了，可以重试（输入已保留）。';
  return '文字识别调用失败：' + (result.error || '上游返回错误') + '。可以重试，输入已保留。';
}

// 独立 OCR 接口：只返回照片上真实读到的文字与文字线索，不推断物品、不生成方案。
async function handleOcr(config, body) {
  const limits = config.limits;
  if (!body || typeof body !== 'object' || typeof body.image !== 'string' || !body.image) {
    throw new ApiError('bad_image', '请先放一张照片再识别文字', 400);
  }
  const info = validateImage(body.image, limits);
  if (info.error) throw new ApiError(info.code, info.error, 400);

  const base64 = body.image.slice(body.image.indexOf(',') + 1);
  const result = await requestOcr(base64, config.ocrTimeoutMs);
  if (!result.ok) {
    throw new ApiError(result.code || 'ocr_failed', ocrErrorMessage(result),
      result.code === 'ocr_timeout' ? 504 : 502);
  }
  const summary = summarize(result.texts, limits.maxText);
  const clue = guess(result.texts);
  return responseShape(config.mode, 'ocr', {
    ocr: {
      lines: summary.lines,
      joined: summary.joined,
      count: summary.count,
      guess: clue,
      requestId: result.requestId,
      notice: summary.count === 0
        ? '文字识别已真实调用，但这张照片里没有读到可辨认的文字。可以换一张带包装或标签的照片，也可以直接手动填写物品。'
        : '下面是照片上真实读到的文字。它可能只是包装或标签内容，不代表对物品的判断，请核对后再用。'
    }
  });
}

async function handleIdeas(config, body) {
  const limits = config.limits;
  const base = validateBase(body, limits);
  const c = normalizeConstraints({ budget: base.budget, tools: base.tools, forbidden: body.forbidden || [], extra: body.extra || '' }, limits);
  const ctx = contextOf(base);
  const extraNotes = [];

  if (c.extraNotes.length) extraNotes.push(...c.extraNotes);
  if (c.unparsedExtra) {
    extraNotes.push(modeNote(config, c.unparsedExtra));
  }

  if (config.mode === 'demo') {
    let specs;
    let recognized;
    // OCR 文字只作为线索：服务端自己从原文推关键词，不信任前端传来的候选值。
    const clue = ctx.ocrText ? guess(ctx.ocrText) : null;
    const filledItem = ctx.item || (clue ? clue.item : '');
    const filledMaterial = ctx.material || (clue ? clue.material : '');
    if (base.sampleId) {
      specs = specsForSample(base.sampleId);
      const s = SAMPLES[base.sampleId];
      recognized = { item: s.name, material: s.material, source: 'sample' };
    } else {
      if (!filledItem) {
        throw new ApiError('need_description', '示例模式没有识图能力：请识别照片上的文字、或手动填写「这是什么」，再体验规则示例方案', 400);
      }
      specs = genericPlans(filledItem, filledMaterial);
      recognized = {
        item: filledItem,
        material: filledMaterial || '未填写',
        source: !ctx.item && clue ? 'ocr' : 'user'
      };
    }
    extraNotes.push('已对预算与工具限制做本地校验，费用按材料累加、用时按步骤累加。');
    if (ctx.ocrText) extraNotes.push('已参考照片上真实读到的文字线索；那只是包装或标签文字，不是看图判断。');
    const result = buildAll(specs, c, filledItem || ctx.item);
    const notice = base.sampleId
      ? '示例模式：未配置模型接口。以下是对内置示例的本地规则方案，没有调用模型，也没有进行图像识别。'
      : (ctx.ocrText
        ? '示例模式：未配置模型接口。方案按照片上真实读到的文字和你填写的信息用本地规则生成，不是看图识别结果。'
        : '示例模式：未配置模型接口，也没有进行图像识别。以下方案按你手动填写的物品与材质用本地规则生成，不是看图结果。');
    return finish('demo', 'demo-rule', ctx, c, specs, result, extraNotes, false, notice, recognized);
  }

  // 真实模式：图片只发给服务端配置的地址；视觉未启用时不上传图片。
  const visionCapable = config.vision && Boolean(ctx.image);
  if (!visionCapable) ctx.image = null;
  let raw;
  try {
    raw = await callIdeas(config, ctx, c);
  } catch (err) {
    throw new ApiError(err.code || 'llm_failed', err.message || '模型调用失败', err.status || 502);
  }
  let specs;
  try {
    specs = coerceSpecs(raw.plans, limits);
  } catch (err) {
    throw new ApiError('bad_model_output', `模型输出未通过结构校验：${err.message}`, 502);
  }
  let recognized;
  let visionUsed = false;
  let notice;
  if (visionCapable && raw.recognized) {
    recognized = {
      item: plain(raw.recognized.item, limits.maxShortText),
      material: plain(raw.recognized.material, limits.maxShortText) || '未填写',
      source: 'vision'
    };
    visionUsed = true;
    notice = '已把图片发给配置的模型，模型返回了物品与材质判断；下面可以纠正后再迭代。';
  } else {
    recognized = { item: ctx.item, material: ctx.material || '未填写', source: 'user' };
    notice = visionCapable
      ? '图片已发给模型，但模型没有返回可用的识别结果；物品信息仍来自你的描述，可以在下面纠正。'
      : '当前配置未把图片发给模型（未启用视觉输入或没有图片）；物品信息来自你的描述，可以在下面纠正。';
  }
  extraNotes.push('模型输出已重新做预算与工具校验，不满足限制的款式会被标为不可行。');
  if (ctx.ocrText) extraNotes.push('照片上真实读到的文字已一并发给模型作为线索；那不是看图判断。');
  const result = buildAll(specs, c, recognized.item || ctx.item);
  return finish('live', 'llm', ctx, c, specs, result, extraNotes, visionUsed, notice, recognized);
}

async function handleRefine(config, body) {
  const limits = config.limits;
  const base = validateBase(body.base || {}, limits);
  const rawConstraints = body.constraints || {};
  checkLength(rawConstraints.extra, '补充要求', limits.maxExtra);
  const c = normalizeConstraints({
    budget: rawConstraints.budget,
    tools: rawConstraints.tools || base.tools,
    forbidden: rawConstraints.forbidden || [],
    extra: rawConstraints.extra || ''
  }, limits);
  const ctx = contextOf(base);
  const currentPlan = body.currentPlan && typeof body.currentPlan === 'object' ? body.currentPlan : null;
  const planId = plain(body.planId, 80);
  if (!currentPlan || !planId) throw new ApiError('bad_request', '缺少要迭代的方案');
  const targetLane = currentPlan.lane;
  const extraNotes = [];
  if (c.extraNotes.length) extraNotes.push(...c.extraNotes);
  if (c.unparsedExtra) extraNotes.push(modeNote(config, c.unparsedExtra));

  let specs;
  let source;
  let visionUsed = false;
  let notice;
  let recognized = { item: ctx.item, material: ctx.material || '未填写', source: 'user' };

  if (config.mode === 'demo') {
    const clue = ctx.ocrText ? guess(ctx.ocrText) : null;
    const filledItem = ctx.item || (clue ? clue.item : '');
    const filledMaterial = ctx.material || (clue ? clue.material : '');
    specs = base.sampleId ? specsForSample(base.sampleId) : genericPlans(filledItem, filledMaterial);
    if (base.sampleId) {
      const s = SAMPLES[base.sampleId];
      recognized = { item: s.name, material: s.material, source: 'sample' };
    } else if (!ctx.item && clue) {
      recognized = { item: filledItem, material: filledMaterial || '未填写', source: 'ocr' };
    }
    source = 'demo-rule';
    notice = '示例模式：未调用模型，方案由本地规则按新限制重新计算。';
    extraNotes.push('已重新校验：预算不超出，禁用工具不再出现在材料与步骤里。');
  } else {
    if (!Array.isArray(body.specs) || body.specs.length === 0) {
      throw new ApiError('bad_request', '缺少原始方案结构，无法迭代');
    }
    try {
      specs = coerceSpecs(body.specs, limits);
    } catch (err) {
      throw new ApiError('bad_plan_shape', `原始方案结构不合法：${err.message}`, 400);
    }
    try {
      const revisedRaw = await callRefine(config, ctx, c, currentPlan);
      const revised = coerceSpecs([revisedRaw], limits)[0];
      revised.lane = targetLane;
      revised.id = planId;
      const index = specs.findIndex((s) => s.lane === targetLane);
      if (index >= 0) specs[index] = revised; else specs.push(revised);
      extraNotes.push('模型给出了重新设计，服务端已再校验预算与工具限制。');
    } catch (err) {
      throw new ApiError(err.code || 'llm_failed', err.message || '模型迭代失败', err.status || 502);
    }
    source = 'llm';
    notice = '已调用配置模型重新设计；最终方案仍以服务端约束校验结果为准。';
  }

  const result = buildAll(specs, c, recognized.item || ctx.item);
  const chosen = result.plans.find((p) => p.lane === targetLane) || null;
  const bad = result.infeasible.find((p) => p.lane === targetLane);
  // 目标款式不可行时，把「同限制下其它可行款式」和「零成本替代」都列出来，
  // 明确标注它们不是原方案，不假装原限制被满足。
  const substitutes = !chosen && bad
    ? result.plans.filter((p) => p.lane !== targetLane).concat(result.alternatives)
    : [];
  const explanation = !chosen && bad
    ? `此款式在新限制下做不了：${bad.reason}。下面这些是同样限制下真正可行的替代做法，不是原方案，也没有假装满足原限制。`
    : '';

  const payload = finish(config.mode, source, ctx, c, specs, result, extraNotes, visionUsed, notice, recognized);
  payload.plan = chosen;
  payload.explanation = explanation;
  payload.substitutes = substitutes;
  payload.changed = diffSummary(currentPlan, chosen, c);
  return payload;
}

function diffSummary(before, after, c) {
  if (!after) return [];
  const out = [];
  const beforeCost = Number(before.estimatedCost);
  if (Number.isFinite(beforeCost) && beforeCost !== after.estimatedCost) {
    out.push(`费用 ¥${beforeCost} → ¥${after.estimatedCost}`);
  }
  const label = (id) => TOOL_LABELS[id] || id;
  const beforeTools = Array.isArray(before.toolsUsed) ? before.toolsUsed : [];
  const removed = beforeTools.filter((t) => !after.toolsUsed.includes(t));
  if (removed.length) out.push(`不再需要：${removed.map(label).join('、')}`);
  if (c.forbidden.length) out.push(`禁用：${c.forbidden.map(label).join('、')}`);
  out.push(`预算上限 ¥${c.budget}`);
  return out.slice(0, 5);
}

function modeNote(config, text) {
  return config.mode === 'demo'
    ? `示例模式只认预算、工具与禁用要求，「${text.slice(0, 60)}」这类描述没有转成约束；连接模型后可交给模型处理。`
    : `补充要求「${text.slice(0, 60)}」已随请求发给模型，最终仍以预算与工具的校验为准。`;
}

module.exports = { handleIdeas, handleRefine, handleOcr, ApiError, validateBase };
