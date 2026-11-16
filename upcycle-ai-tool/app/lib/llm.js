'use strict';

const { plain } = require('./planner');
const { TOOL_LABELS, LANES } = require('./data/catalog');

const SYSTEM_PROMPT = [
  '你是「万物改造局」的改造方案设计助手，只处理普通低风险手作。',
  '只输出一个 JSON 对象，不要 Markdown 代码块、不要解释文字、不要 HTML 标签。',
  '严禁建议：拆电池或锂电池、改电器/电路/通电装置、承重家具（凳椅书架）、燃烧或加热塑料与布料、加压或密封容器、把来源不明的材料当食品接触器皿。',
  '费用只能是估计值，不要编造精确的环保减排数据；未知材质不保证安全、承重与防水。',
  '结构示意只是示意图，不是实物成品。',
  '工具 id 只能用：hands（徒手，无需工具）、scissors、cutter、ruler、pencil、glue、tape、needle、punch、paint、string、hotglue、drill、saw。',
  'diagram.type 只能用：box-divider、flat-mosaic、ramp、cylinder、hang、terrarium、fabric、weave、pinwheel。',
  '每个步骤要有 2–4 个 variants（不同工具条件下的做法），按偏好排序；最后一个 variant 必须是只靠 hands 的简化做法，并在 note 里说明效果会打折扣。',
  '材料里的 cost 是人民币估计值；可选材料标 optional:true，并把依赖的工具写进 requires。',
  '所有文字用简体中文，短句，别写口号。'
].join(' ');

const SPEC_RULE = [
  '方案对象字段：id, lane(practical/aesthetic/wild 三选一且互不重复), title, result, summary,',
  'diagram{type,w,h,d,unit,fold,labels[最多4条短标注]},',
  'materials[{name,qty,cost,optional,requires[],note}],',
  'steps[{label,optional,variants[{needs[],text,minutes,note}]}],',
  'notes[最多8条]。',
  'materials 至少 1 项，steps 1–12 项，每项 variants 至少 1 个。',
  '规模限制：每个方案 steps 3–5 项、每项 variants 恰好 2 个（最后一个只用 hands）、materials 最多 5 项、notes 最多 3 条、diagram.labels 最多 3 条，文字保持简短。',
  '只输出一个完整、可直接 JSON.parse 的 JSON 对象：不要 Markdown 围栏、解释文字、注释、尾随逗号或截断。'
].join(' ');

function endpoint(config) {
  const base = config.baseUrl.endsWith('/') ? config.baseUrl : config.baseUrl + '/';
  return new URL('chat/completions', base).toString();
}

async function chat(config, messages, maxTokens) {
  const controller = new AbortController();
  // 计时器必须活到「响应体完整读完」为止：上游可以先给 200 响应头，再把 body 挂住不发完。
  // 提前 clearTimeout 会让这种半截响应永远等下去。
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(endpoint(config), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.3,
        max_tokens: maxTokens || 3000,
        stream: false,
        // 以下两项是 Qwen/DashScope 的厂商参数，仅当服务端显式配置时添加，其他端点不会收到。
        ...(config.disableThinking ? { enable_thinking: false } : {}),
        ...(config.jsonMode ? { response_format: { type: 'json_object' } } : {})
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      const text = await safeText(res);
      throw wrap('llm_http', `模型接口返回 HTTP ${res.status}：${text.slice(0, 160)}`);
    }
    let payload;
    try {
      payload = await res.json();
    } catch (err) {
      if (controller.signal.aborted) throw timeoutError(config);
      throw wrap('llm_bad_output', '模型接口返回的不是合法 JSON');
    }
    const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw wrap('llm_bad_output', '模型没有返回内容');
    }
    return content;
  } catch (err) {
    if (controller.signal.aborted || (err && err.name === 'AbortError')) throw timeoutError(config);
    if (err && err.code) throw err;
    throw wrap('llm_unreachable', `无法连接模型接口：${String(err && err.message || err).slice(0, 120)}`);
  } finally {
    clearTimeout(timer);
  }
}

function timeoutError(config) {
  return wrap('llm_timeout', `模型接口超时（${config.timeoutMs} ms，含响应体读取），可以重试`);
}

async function safeText(res) {
  try { return await res.text(); } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    return '';
  }
}

function wrap(code, message) {
  return Object.assign(new Error(message), { code, status: 502 });
}

function parseJsonLoose(text) {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const firstObj = cleaned.indexOf('{');
  const firstArr = cleaned.indexOf('[');
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (!starts.length) throw wrap('llm_bad_output', '模型输出里找不到 JSON');
  const start = Math.min.apply(null, starts);
  const open = cleaned[start];
  const close = open === '{' ? '}' : ']';
  const end = cleaned.lastIndexOf(close);
  if (end <= start) throw wrap('llm_bad_output', '模型输出的 JSON 不完整');
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw wrap('llm_bad_output', '模型输出的 JSON 无法解析');
  }
}

function constraintText(c) {
  const tools = c.tools.map((t) => TOOL_LABELS[t]).join('、') || '仅徒手';
  const forbidden = c.forbidden.map((t) => TOOL_LABELS[t]).join('、') || '无';
  return `预算上限 ¥${c.budget}；已有工具：${tools}；明确禁用：${forbidden}；补充要求：${c.extra || '无'}。`;
}

function ideasMessages(config, ctx, c) {
  const system = { role: 'system', content: SYSTEM_PROMPT + ' ' + SPEC_RULE };
  const lines = [
    `物品：${ctx.item || '未填写'}`,
    `材质：${ctx.material || '未填写（按未知材质处理）'}`,
    `补充描述：${ctx.description || '无'}`,
    ctx.ocrText ? `照片文字识别结果（真实 OCR，只是包装或标签上的文字，不代表已经看图判断物品）：${ctx.ocrText.slice(0, 200)}` : '照片文字识别结果：无',
    constraintText(c),
    '要求：给出恰好 3 个方案，lane 分别为 practical / aesthetic / wild，风格要有明显差异。',
    '每个方案的每一步都必须在「已有工具 + 禁用规则」下真的能做；做不了就换简化做法，不要假装有工具。',
    '输出格式：{"recognized":{"item":"","material":""} 或 null,"plans":[方案, 方案, 方案]}。',
    '如果你没有真正看到图片，recognized 必须为 null，不要凭文字猜物品。'
  ];

  const user = { role: 'user' };
  if (config.vision && ctx.image) {
    user.content = [
      { type: 'text', text: lines.join('\n') + '\n图片已附上，请基于图片判断物品与材质；把判断结果写进 recognized。' },
      { type: 'image_url', image_url: { url: ctx.image, detail: 'low' } }
    ];
  } else {
    user.content = lines.join('\n') + '\n本次没有图片输入，物品与材质完全来自上面的文字，recognized 必须为 null。';
  }
  return [system, user];
}

function refineMessages(config, ctx, c, currentPlan) {
  const system = { role: 'system', content: SYSTEM_PROMPT + ' ' + SPEC_RULE };
  const compact = {
    id: currentPlan.id, lane: currentPlan.lane, title: currentPlan.title, result: currentPlan.result,
    summary: currentPlan.summary, diagram: currentPlan.diagram,
    materials: currentPlan.materials.map((m) => ({ name: m.name, qty: m.qty, cost: m.cost, optional: m.optional, requires: m.requires || [] })),
    steps: currentPlan.steps.map((s) => ({ label: s.label, text: s.text, tools: s.tools })),
    notes: currentPlan.notes
  };
  const text = [
    `原方案：${JSON.stringify(compact)}`,
    `物品：${ctx.item || '未填写'}；材质：${ctx.material || '未填写'}`,
    ctx.ocrText ? `照片上读到的文字（只是文字线索）：${ctx.ocrText.slice(0, 200)}` : '照片文字线索：无',
    constraintText(c),
    '请重新设计这 1 个方案，保留原来的款式定位，但让材料与步骤真正满足限制：预算不能超，禁用工具不能出现在 needs/requires 里，也不要在步骤文字里继续要求这些工具。',
    '如果确实做不到，就给出一个更简化的可行版本，并在 notes 里说明哪里打了折扣；不要假装满足。',
    '输出格式：{"plan": 方案对象}。'
  ].join('\n');
  return [system, { role: 'user', content: text }];
}

async function callIdeas(config, ctx, c) {
  const content = await chat(config, ideasMessages(config, ctx, c), 3600);
  const parsed = parseJsonLoose(content);
  if (!parsed || !Array.isArray(parsed.plans)) {
    throw wrap('llm_bad_output', '模型输出缺少 plans 数组');
  }
  let recognized = null;
  if (parsed.recognized && typeof parsed.recognized === 'object') {
    const item = plain(parsed.recognized.item, 60);
    const material = plain(parsed.recognized.material, 60);
    if (item || material) recognized = { item, material, source: 'vision' };
  }
  return { plans: parsed.plans, recognized };
}

async function callRefine(config, ctx, c, currentPlan) {
  const content = await chat(config, refineMessages(config, ctx, c, currentPlan), 2600);
  const parsed = parseJsonLoose(content);
  if (!parsed || !parsed.plan || typeof parsed.plan !== 'object') {
    throw wrap('llm_bad_output', '模型输出缺少 plan 对象');
  }
  return parsed.plan;
}

module.exports = { callIdeas, callRefine, SYSTEM_PROMPT, LANES };
