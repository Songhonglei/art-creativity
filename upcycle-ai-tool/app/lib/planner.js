'use strict';

const {
  TOOL_IDS, TOOL_LABELS, LANES, SAMPLES, fallbackPlans, genericPlans
} = require('./data/catalog');

const LANE_IDS = LANES.map((l) => l.id);
const CONSUMABLE_TOOLS = new Set(['glue', 'tape', 'string', 'paint', 'hotglue']);
const SUPPLY_HINTS = [
  [/胶带|双面胶|胶贴/, 'tape'],
  [/白胶|胶水|胶棒/, 'glue'],
  [/热熔胶|胶枪/, 'hotglue'],
  [/麻绳|鞋带|丝带|细绳|布条|抽绳/, 'string'],
  [/颜料|彩笔|画笔|丙烯/, 'paint']
];

const TOOL_KEYWORDS = [
  ['glue', /胶水|白胶|胶棒|乳胶|粘胶/],
  ['hotglue', /热熔胶|胶枪/],
  ['tape', /胶带|双面胶|胶贴/],
  ['cutter', /美工刀|裁纸刀|壁纸刀/],
  ['scissors', /剪刀|剪子/],
  ['needle', /针线|缝纫|缝衣针/],
  ['punch', /打孔器|打孔/],
  ['ruler', /尺子|直尺|卷尺/],
  ['pencil', /铅笔|记号笔/],
  ['paint', /颜料|画笔|丙烯|彩笔/],
  ['string', /麻绳|细绳|绳子|丝带/],
  ['drill', /电钻|钻孔/],
  ['saw', /锯子|电锯/]
];
// 否定与允许都按「分句」判断：一句话里「不能用胶水，剪刀可以用」不能把剪刀一起禁掉。
const NEGATION = /不能|不可以|不可|不要|别用|不用|没有|无|禁|避免|不许|缺少|不提供|不使|没法|无法|不带|没带/;
const ALLOW = /可以|能用|可用|允许|保留|就用|只用|带着|准备了|手头有|有备/;
const CLAUSE_SPLIT = /[，,、；;。！!？?\n]+/;
const BUDGET_RE = /(?:预算|不超过|控制在|上限|最多|only)\s*[0-9]+(?:\.[0-9]+)?/i;

const RISK_RULES = [
  { re: /电池|锂电|充电宝|拆开机芯/, text: '不建议拆电池、改电路或给电器加改装件；这类做法有短路与发热风险，超出本应用的低风险手作范围。' },
  { re: /电器|通电|插座|接线|改电路|改灯|市电/, text: '涉及通电/电器的改造不在本应用范围内，请改用不通电的纯结构方案。' },
  { re: /承重|坐人|凳子|椅子|书架|挂重物|悬挂重物|踩/, text: '闲置材料未做承重验证，不要做凳子、书架或任何需要承重的家具。' },
  { re: /烧|明火|燃烧|加热|熔化|烤|灶台|高温塑形/, text: '不要加热、燃烧或熔化塑料与布料；明火与高温塑形不在低风险手作范围内。' },
  { re: /压力罐|喷雾罐|气罐|加压|密封加压|高压/, text: '不要对加压容器、喷雾罐做改造，也不要把容器密封加压。' },
  { re: /食品|餐具|水杯|饭盒|饮水|装水喝|接触食物|盛饭/, text: '来源与材质未核实，不要当作食品接触器皿或饮水容器。' },
  { re: /不明材质|未知材质|不知道是什么|不清楚材质/, text: '未知材质不能保证安全、承重与防水；先确认材质再决定用途。' }
];

function plain(value, max) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max || 200);
}

function safetyHints() {
  const texts = Array.from(arguments).filter((x) => typeof x === 'string').join(' ');
  const hits = [];
  for (const rule of RISK_RULES) {
    if (rule.re.test(texts) && hits.length < 4) hits.push(rule.text);
  }
  return hits;
}

function suppliesOf(material) {
  const set = new Set(Array.isArray(material.requires) ? material.requires.filter((r) => TOOL_IDS.includes(r)) : []);
  for (const [re, id] of SUPPLY_HINTS) if (re.test(material.name || '')) set.add(id);
  return set;
}

function normalizeConstraints(raw, limits) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const budget = Number.isFinite(Number(src.budget)) ? Math.min(9999, Math.max(0, Number(src.budget))) : 20;
  const tools = Array.isArray(src.tools)
    ? Array.from(new Set(src.tools.filter((t) => TOOL_IDS.includes(t) && t !== 'hands'))).slice(0, limits.maxTools)
    : [];
  const forbidden = Array.isArray(src.forbidden)
    ? Array.from(new Set(src.forbidden.filter((t) => TOOL_IDS.includes(t) && t !== 'hands'))).slice(0, limits.maxTools)
    : [];
  const extra = plain(src.extra, limits.maxExtra);
  const c = { budget, tools, forbidden, extra, extraNotes: [], parsedFromExtra: false };
  applyExtra(c, limits);
  return c;
}

// 把「不能用胶水，剪刀可以用，预算20元」这类自由文本转成真实约束。
// 关键：否定只作用于所在分句；明确允许的工具要保留，不能被别的分句带上的否定误伤。
function applyExtra(c, limits) {
  if (!c.extra) return;
  const text = c.extra;
  const budgetMatch = text.match(/(?:预算|不超过|控制在|上限|最多|only)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:元|块|rmb|￥|¥)?/i)
    || text.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:元|块)\s*(?:以内|以下|之内|预算)/);
  if (budgetMatch) {
    const n = Number(budgetMatch[1]);
    if (Number.isFinite(n) && n >= 0) {
      c.budget = Math.min(9999, n);
      c.parsedFromExtra = true;
      c.extraNotes.push(`已按文字把预算设为 ¥${c.budget}`);
    }
  }

  const deny = new Set();
  const allow = new Set();
  const rest = [];
  for (const clause of text.split(CLAUSE_SPLIT).map((s) => s.trim()).filter(Boolean)) {
    const hits = TOOL_KEYWORDS.filter(([, re]) => re.test(clause)).map(([id]) => id);
    if (!hits.length) {
      // 预算分句已由上面的正则处理，其余无法转成约束的分句才回显为「未生效」。
      if (!BUDGET_RE.test(clause) && !/[0-9]+\s*(?:元|块)/.test(clause)) rest.push(clause);
      continue;
    }
    if (NEGATION.test(clause)) hits.forEach((id) => deny.add(id));
    else hits.forEach((id) => allow.add(id));
  }

  for (const id of deny) {
    if (allow.has(id)) continue;
    c.parsedFromExtra = true;
    if (!c.forbidden.includes(id)) {
      c.forbidden.push(id);
      c.extraNotes.push(`已按文字禁用「${TOOL_LABELS[id]}」`);
    }
  }
  for (const id of allow) {
    if (deny.has(id)) continue;
    c.parsedFromExtra = true;
    if (!c.tools.includes(id) && c.tools.length < limits.maxTools) c.tools.push(id);
    if (c.forbidden.includes(id)) {
      c.extraNotes.push(`「${TOOL_LABELS[id]}」文字里说可以用，但工具勾选里被禁用，以勾选为准`);
    } else {
      c.extraNotes.push(`已按文字保留可用工具「${TOOL_LABELS[id]}」`);
    }
  }
  c.unparsedExtra = rest.length ? rest.join('，').slice(0, limits.maxExtra) : '';
}

// 变体能否执行：既看工具/材料，也看前一步留下的状态（例如「是否产生了新切口」）。
function variantAllowed(v, ctx, flags) {
  if (v.when && flags.effect !== v.when) return false;
  const needs = Array.isArray(v.needs) ? v.needs : [];
  return needs.every((n) => {
    if (!ctx.allowed.has(n)) return false;
    if (CONSUMABLE_TOOLS.has(n) && (ctx.blockedSupplies.has(n) || !ctx.supplySet.has(n))) return false;
    return true;
  });
}

function nextFlags(flags, v) {
  return v.effect ? { effect: v.effect } : flags;
}

// 向后看：选定某个做法后，后面的必需步骤是否还有走得通的分支。
// 这样「环切了瓶身却没有条件收边」不会被硬凑成一句自相矛盾的收边文案。
function pathExists(steps, i, flags, ctx, memo) {
  if (i >= steps.length) return true;
  const key = i + '|' + (flags.effect || '');
  if (memo.has(key)) return memo.get(key);
  const step = steps[i];
  const candidates = (step.variants || []).filter((v) => variantAllowed(v, ctx, flags));
  let ok = false;
  if (!candidates.length) {
    ok = Boolean(step.optional) && pathExists(steps, i + 1, flags, ctx, memo);
  } else {
    for (const v of candidates) {
      if (pathExists(steps, i + 1, nextFlags(flags, v), ctx, memo)) { ok = true; break; }
    }
  }
  memo.set(key, ok);
  return ok;
}

function materialize(spec, c) {
  const notes = [];
  const allowed = new Set(c.tools.filter((t) => !c.forbidden.includes(t)).concat('hands'));

  let materials = [];
  for (const m of spec.materials || []) {
    const req = Array.isArray(m.requires) ? m.requires : [];
    const blocked = req.filter((r) => !allowed.has(r));
    if (blocked.length) {
      if (m.optional) {
        notes.push(`去掉「${plain(m.name, 40)}」：需要${blocked.map((b) => TOOL_LABELS[b]).join('、')}`);
        continue;
      }
      return { ok: false, reason: `「${plain(m.name, 40)}」必须用${blocked.map((b) => TOOL_LABELS[b]).join('、')}，与限制冲突` };
    }
    materials.push(Object.assign({}, m));
  }

  let cost = materials.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
  const blockedSupplies = new Set();
  if (cost > c.budget) {
    const optional = materials
      .map((m, i) => ({ m, i }))
      .filter((x) => x.m.optional)
      .sort((a, b) => (b.m.cost - a.m.cost));
    for (const x of optional) {
      if (cost <= c.budget) break;
      cost -= Number(x.m.cost) || 0;
      notes.push(`预算内去掉可选材料「${plain(x.m.name, 40)}」`);
      for (const s of suppliesOf(x.m)) blockedSupplies.add(s);
      materials = materials.filter((m) => m !== x.m);
    }
  }
  // 非可选材料也可能因预算被移除，但那属于「无法满足」，不做静默删减。
  if (cost > c.budget) {
    return { ok: false, reason: `材料估计 ¥${cost.toFixed(0)} 超出预算 ¥${c.budget}，且没有可去掉的可选材料` };
  }

  const supplySet = new Set();
  for (const m of materials) for (const s of suppliesOf(m)) supplySet.add(s);

  const ctx = { allowed, blockedSupplies, supplySet };
  const allSteps = spec.steps || [];
  const steps = [];
  let minutes = 0;
  const toolsUsed = new Set();
  let flags = {};
  for (let idx = 0; idx < allSteps.length; idx++) {
    const step = allSteps[idx];
    const candidates = (step.variants || []).filter((v) => variantAllowed(v, ctx, flags));
    const variant = candidates.find((v) => pathExists(allSteps, idx + 1, nextFlags(flags, v), ctx, new Map()));
    if (!variant) {
      if (step.optional) {
        notes.push(`跳过「${plain(step.label, 40)}」：现有工具或上一步的做法下做不了`);
        continue;
      }
      const needed = (step.variants || []).flatMap((v) => v.needs || []);
      const missing = Array.from(new Set(needed.filter((n) => !allowed.has(n) || (CONSUMABLE_TOOLS.has(n) && !supplySet.has(n)))))
        .map((n) => TOOL_LABELS[n] || n);
      const conflict = (step.variants || []).some((v) => v.when && v.when !== flags.effect)
        ? `；上一步已${flags.effect === 'cut' ? '裁切' : '未裁切'}，现有条件无法安全处理这个结果`
        : '';
      return { ok: false, reason: `「${plain(step.label, 40)}」没有满足限制的做法${missing.length ? `（缺 ${missing.slice(0, 4).join('、')}）` : ''}${conflict}` };
    }
    const needs = (variant.needs || []).filter((n) => n !== 'hands');
    for (const n of needs) toolsUsed.add(n);
    minutes += Number(variant.minutes) || 0;
    steps.push({
      label: plain(step.label, 80),
      text: plain(variant.text, 300),
      tools: needs,
      minutes: Number(variant.minutes) || 0,
      note: variant.note ? plain(variant.note, 160) : '',
      optional: Boolean(step.optional)
    });
    if (variant.note) notes.push(plain(variant.note, 160));
    flags = nextFlags(flags, variant);
  }

  const plan = {
    id: plain(spec.id, 80),
    lane: spec.lane,
    title: plain(spec.title, 80),
    result: plain(spec.result, 80),
    summary: plain(spec.summary, 240),
    diagram: Object.assign({}, spec.diagram),
    materials: materials.map((m) => ({
      name: plain(m.name, 60), qty: plain(m.qty, 40), cost: Number(m.cost) || 0,
      optional: Boolean(m.optional), note: plain(m.note || '', 160)
    })),
    toolsUsed: Array.from(toolsUsed),
    estimatedCost: Math.round(cost * 100) / 100,
    timeMinutes: minutes,
    difficulty: ['入门', '进阶', '挑战'].includes(spec.difficulty)
      ? spec.difficulty : deriveDifficulty(minutes, toolsUsed.size, steps.length),
    steps,
    notes: (spec.notes || []).map((n) => plain(n, 200)).filter(Boolean),
    isFallback: Boolean(spec.isFallback),
    isGeneric: Boolean(spec.isGeneric)
  };
  applyEffectPresentation(spec, flags.effect, plan);
  return { ok: true, plan, notes };
}

// 走了「不裁切」这类分支时，标题、结果、结构图、步骤标题与注意点必须一起换成
// 该分支的版本；只改步骤正文会让人读图后反而去裁切。
function applyEffectPresentation(spec, effect, plan) {
  const by = spec && spec.byEffect && spec.byEffect[effect];
  if (!by || typeof by !== 'object') return;
  if (by.title) plan.title = plain(by.title, 80);
  if (by.result) plan.result = plain(by.result, 80);
  if (by.summary) plan.summary = plain(by.summary, 240);
  if (by.diagram && typeof by.diagram === 'object') {
    plan.diagram = Object.assign({}, by.diagram, {
      labels: Array.isArray(by.diagram.labels)
        ? by.diagram.labels.slice(0, 3).map((x) => plain(x, 40)).filter(Boolean) : []
    });
  }
  if (Array.isArray(by.notes)) {
    plan.notes = by.notes.map((n) => plain(n, 200)).filter(Boolean);
  }
  if (by.stepLabels && typeof by.stepLabels === 'object') {
    for (const step of plan.steps) {
      if (by.stepLabels[step.label]) step.label = plain(by.stepLabels[step.label], 80);
    }
  }
  if (by.materialNotes && typeof by.materialNotes === 'object') {
    for (const material of plan.materials) {
      if (by.materialNotes[material.name]) material.note = plain(by.materialNotes[material.name], 160);
    }
  }
}

function deriveDifficulty(minutes, toolCount, stepCount) {
  const score = minutes / 12 + toolCount * 0.7 + stepCount * 0.35;
  if (score < 3.4) return '入门';
  if (score < 6) return '进阶';
  return '挑战';
}

function buildAll(specs, c, item) {
  const plans = [];
  const infeasible = [];
  const notes = [];
  for (const spec of specs) {
    const r = materialize(spec, c);
    if (r.ok) {
      plans.push(r.plan);
      for (const n of r.notes) if (!notes.includes(n)) notes.push(n);
    } else {
      infeasible.push({ lane: spec.lane, title: plain(spec.title, 80), reason: r.reason });
    }
  }
  let alternatives = [];
  if (plans.length === 0) {
    alternativeSpecLoop: for (const spec of fallbackPlans(item)) {
      const r = materialize(spec, c);
      if (r.ok) alternatives.push(r.plan);
      if (alternatives.length >= 3) break alternativeSpecLoop;
    }
  }
  return { plans, infeasible, notes, alternatives };
}

const DIAGRAM_TYPES = new Set([
  'box-divider', 'flat-mosaic', 'ramp', 'cylinder', 'hang', 'terrarium', 'fabric', 'weave', 'pinwheel'
]);

// 把模型（或前端回传）的原始结构强制收敛到同一 schema，并去掉 HTML/控制字符。
function coerceSpecs(raw, limits) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > limits.maxPlans) {
    throw shapeError('方案数量必须是 1–3 个');
  }
  const seen = new Set();
  return raw.map((item, idx) => {
    if (!item || typeof item !== 'object') throw shapeError(`第 ${idx + 1} 个方案不是对象`);
    const lane = LANE_IDS.includes(item.lane) ? item.lane : LANE_IDS[idx];
    if (seen.has(lane)) throw shapeError('三种款式的 lane 不能重复');
    seen.add(lane);

    const diagram = item.diagram && typeof item.diagram === 'object' ? item.diagram : {};
    const dType = DIAGRAM_TYPES.has(diagram.type) ? diagram.type : 'flat-mosaic';
    const num = (v, fallback, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    const labels = Array.isArray(diagram.labels)
      ? diagram.labels.slice(0, 4).map((x) => plain(x, 40)).filter(Boolean)
      : ['结构示意', '尺寸为估计'];
    // 宽/深/高的文字标注随结构一起回传，保证详情图、分享卡、清单读同一份。
    const rawDims = diagram.dims && typeof diagram.dims === 'object' ? diagram.dims : null;
    const dims = rawDims ? {
      width: plain(rawDims.width, 24), depth: plain(rawDims.depth, 24),
      height: plain(rawDims.height, 24), note: plain(rawDims.note, 120)
    } : null;

    const materials = Array.isArray(item.materials) ? item.materials.slice(0, 12) : [];
    if (materials.length === 0) throw shapeError(`「${lane}」缺少材料列表`);
    const steps = Array.isArray(item.steps) ? item.steps.slice(0, limits.maxSteps) : [];
    if (steps.length === 0) throw shapeError(`「${lane}」缺少制作步骤`);

    return {
      id: plain(item.id, 80) || `plan-${lane}`,
      lane,
      title: plain(item.title, 80) || '未命名方案',
      result: plain(item.result, 80) || '改造示意',
      summary: plain(item.summary, 240) || '',
      diagram: {
        type: dType,
        w: num(diagram.w, 240, 20, 1200),
        h: num(diagram.h, 160, 20, 1200),
        d: num(diagram.d, 60, 0, 1200),
        unit: plain(diagram.unit, 8) || 'mm',
        fold: Boolean(diagram.fold),
        labels,
        dims: dims || undefined
      },
      materials: materials.map((m) => ({
        name: plain(m && m.name, 60) || '材料',
        qty: plain(m && m.qty, 40) || '适量',
        cost: num(m && m.cost, 0, 0, 9999),
        optional: Boolean(m && m.optional),
        requires: Array.isArray(m && m.requires)
          ? m.requires.filter((t) => TOOL_IDS.includes(t)).slice(0, 6) : [],
        note: plain(m && m.note, 160)
      })),
      steps: steps.map((s) => {
        const variants = Array.isArray(s && s.variants) ? s.variants.slice(0, 6) : [];
        const coerced = variants.map((v) => {
          const out = {
            needs: Array.isArray(v && v.needs)
              ? v.needs.filter((t) => TOOL_IDS.includes(t)).slice(0, 6) : ['hands'],
            text: plain(v && v.text, 300),
            minutes: num(v && v.minutes, 3, 0, 600),
            note: plain(v && v.note, 160)
          };
          // 内置数据里的步骤依赖标记，迭代回传时不能丢。
          if (v && ['cut', 'noCut'].includes(v.effect)) out.effect = v.effect;
          if (v && ['cut', 'noCut'].includes(v.when)) out.when = v.when;
          return out;
        }).filter((v) => v.text);
        if (!coerced.length) throw shapeError(`「${lane}」有步骤没有可执行做法`);
        return {
          label: plain(s && s.label, 80) || '制作步骤',
          variants: coerced,
          optional: Boolean(s && s.optional)
        };
      }),
      notes: Array.isArray(item.notes) ? item.notes.slice(0, 8).map((n) => plain(n, 200)).filter(Boolean) : [],
      difficulty: ['入门', '进阶', '挑战'].includes(item.difficulty) ? item.difficulty : undefined,
      isFallback: false,
      isGeneric: false
    };
  });
}

function shapeError(message) {
  return Object.assign(new Error(message), { code: 'bad_plan_shape' });
}

function findSpec(planId) {
  for (const sample of Object.values(SAMPLES)) {
    const found = sample.plans.find((p) => p.id === planId);
    if (found) return found;
  }
  return null;
}

function specsForSample(sampleId) {
  const sample = SAMPLES[sampleId];
  return sample ? sample.plans : null;
}

module.exports = {
  LANE_IDS, DIAGRAM_TYPES, plain, safetyHints, normalizeConstraints, materialize,
  buildAll, coerceSpecs, findSpec, specsForSample, fallbackPlans, genericPlans
};
