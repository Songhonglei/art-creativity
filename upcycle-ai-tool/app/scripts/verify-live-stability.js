'use strict';

// 线上真实模型稳定性：3 种不同输入连续生成，确认每次都是 source=llm 且三款式都有交代。
// 不做任何模拟；失败会如实报出错误码，不把示例方案写成模型成功。
const API = process.env.UPCYCLE_API
  || 'https://evansongdev-d3gwank9e76835e8b-1343046532.ap-shanghai.app.tcloudbase.com/upcycle/api/';

const CASES = [
  { name: '透明饮料瓶 / 仅美工刀 / ¥20', body: { item: '透明饮料瓶', material: 'PET 塑料', tools: ['cutter'], budget: 20, forbidden: [], extra: '', description: '' } },
  { name: '快递纸箱 / 剪刀胶带 / ¥30', body: { item: '瓦楞纸箱', material: '瓦楞纸板', tools: ['scissors', 'tape'], budget: 30, forbidden: [], extra: '', description: '' } },
  { name: '旧 T 恤 / 针线 / ¥15', body: { item: '旧棉 T 恤', material: '棉针织布', tools: ['needle'], budget: 15, forbidden: [], extra: '', description: '' } }
];

let pass = 0, total = 0;
function check(name, ok, detail) {
  total += 1;
  if (ok) { pass += 1; console.log('  [PASS] ' + name); }
  else console.log('  [FAIL] ' + name + (detail ? ' · ' + String(detail).slice(0, 200) : ''));
}

async function main() {
  const cfg = await (await fetch(API + 'config')).json();
  check('远端处于模型模式', cfg && cfg.config && cfg.config.mode === 'live',
    cfg && cfg.config && cfg.config.mode);
  if (!cfg || cfg.config.mode !== 'live') {
    console.log('未处于模型模式，跳过真实生成（不把示例方案写成模型成功）');
    console.log('结果：' + pass + '/' + total + ' 通过');
    process.exitCode = 1;
    return;
  }

  for (const c of CASES) {
    const started = Date.now();
    let data = null, status = 0;
    try {
      const res = await fetch(API + 'ideas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c.body), signal: AbortSignal.timeout(90000)
      });
      status = res.status;
      data = await res.json();
    } catch (err) {
      check(c.name + ' 真实请求完成', false, String(err && err.message || err));
      continue;
    }
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const plans = (data && data.plans || []).length;
    const bad = (data && data.infeasible || []).length;
    check(c.name + ' 由真实模型返回（' + secs + ' 秒）',
      status === 200 && data && data.ok === true && data.source === 'llm',
      status + ' / ' + (data && (data.code || data.source)));
    check(c.name + ' 三款式都有交代',
      plans + bad === 3 && (data.laneStatus || []).length === 3,
      'plans=' + plans + ' infeasible=' + bad);
    check(c.name + ' 预算与工具经服务端回显校验',
      Boolean(data && data.constraints && data.constraints.budget === c.body.budget &&
        data.constraints.tools.length === c.body.tools.length));
  }

  console.log('\n结果：' + pass + '/' + total + ' 通过');
  if (pass !== total) process.exitCode = 1;
}

main().catch((err) => {
  console.error('线上稳定性验证异常：', err);
  process.exitCode = 1;
});
