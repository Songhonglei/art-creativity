'use strict';

// 本地「模拟上游」：只用于验证真实模式的请求链路、结构校验与失败处理。
// 它不是任何真实大模型，也不会联网。验证记录里不得把它写成真实 LLM 调用成功。
const http = require('node:http');
const PORT = Number(process.env.MOCK_PORT || 8787);
let mode = process.env.MOCK_MODE || 'ok';

const V = (needs, text, minutes) => ({ needs, text, minutes });
const SPEC = (lane, title) => ({
  id: 'mock-' + lane,
  lane,
  title,
  result: '模拟上游的结构化改造方案',
  summary: '本地模拟上游返回的结构化方案，用来验证服务端校验链路，不是真实模型创作。',
  difficulty: '入门',
  diagram: {
    type: lane === 'practical' ? 'box-divider' : (lane === 'aesthetic' ? 'flat-mosaic' : 'pinwheel'),
    w: 240, h: 160, d: 80, unit: 'mm', fold: true,
    labels: ['模拟标注 1', '尺寸 240×160', '虚线为折叠线']
  },
  materials: [
    { name: '闲置物本体', qty: '1 件', cost: 0, optional: false, requires: [], note: '不计费用' },
    { name: '纸胶带（可选）', qty: '约 20 cm', cost: 2, optional: true, requires: ['tape'], note: '' }
  ],
  steps: [
    { label: '清理表面', optional: false, variants: [V(['hands'], '把表面擦干净并完全晾干', 3)] },
    {
      label: '分出形状', optional: false, variants: [
        V(['scissors'], '用剪刀沿现有折痕剪出所需形状', 5),
        V(['hands'], '不裁剪，直接沿原有折痕折叠成型', 6)
      ]
    },
    {
      label: '固定连接', optional: false, variants: [
        V(['tape'], '用纸胶带固定连接处', 4),
        V(['hands'], '用折插方式互相卡住，不用任何粘接材料', 5)
      ]
    },
    { label: '试放与调整', optional: false, variants: [V(['hands'], '放入轻物试一下，不稳就再折一道', 3)] }
  ],
  notes: ['本地模拟上游：仅用于接口链路验证，不是真实模型输出。', '费用为估计。']
});

function plans() {
  return [
    SPEC('practical', '模拟·实用款收纳格'),
    SPEC('aesthetic', '模拟·好看款拼色板'),
    SPEC('wild', '模拟·脑洞款小风车')
  ];
}

function content(isRefine) {
  if (mode === 'invalid_json') return '抱歉，我无法输出 JSON。';
  if (mode === 'bad_shape') return JSON.stringify(isRefine ? { plan: {} } : { plans: [{ lane: 'practical' }] });
  if (mode === 'violate') {
    const ps = plans();
    ps.forEach((p) => {
      p.steps[1].variants = [{ needs: ['cutter'], text: '必须用美工刀裁开，没有其他做法', minutes: 8 }];
    });
    return JSON.stringify({ recognized: null, plans: ps });
  }
  if (mode === 'html') {
    const ps = plans();
    ps[0].title = '<script>alert(1)</script>' + '<b>模拟标题</b>';
    return JSON.stringify({ recognized: null, plans: ps });
  }
  const recognized = mode === 'vision' ? { item: '模拟识别的闲置物', material: '未确认' } : null;
  if (isRefine) return JSON.stringify({ plan: SPEC('practical', '模拟·迭代后的收纳格') });
  return JSON.stringify({ recognized, plans: plans() });
}

function body(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/__mode' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      try { mode = JSON.parse(raw).mode || 'ok'; } catch { /* keep */ }
      body(res, 200, { ok: true, mode });
    });
    return;
  }
  if (req.url === '/__mode' && req.method === 'GET') return body(res, 200, { mode });
  if (!req.url.startsWith('/v1/chat/completions')) return body(res, 404, { error: 'not found' });

  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    let isRefine = false;
    try {
      const parsed = JSON.parse(raw);
      const text = JSON.stringify(parsed.messages || []);
      isRefine = text.includes('请重新设计这 1 个方案');
    } catch { /* ignore */ }
    const reply = content(isRefine);
    if (mode === 'http500') return body(res, 500, { error: 'mock upstream error' });
    if (mode === 'timeout') {
      setTimeout(() => body(res, 200, { choices: [{ message: { content: reply } }] }), 6000);
      return;
    }
    if (mode === 'stalled_body') {
      // 200 响应头立刻到，body 故意不写完：专门复现「收到响应头就清掉计时器」的旧问题。
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"choices":[{"message":{"content":"');
      return;
    }
    body(res, 200, {
      id: 'mock-' + Date.now(),
      object: 'chat.completion',
      model: 'mock-upstream',
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }]
    });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-llm] http://127.0.0.1:${PORT}/v1/chat/completions · mode=${mode}（本地模拟，非真实模型）`);
});
