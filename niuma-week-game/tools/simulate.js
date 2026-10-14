// 全流程随机模拟：加载引擎，随机打 N 局，统计结局分布并捕捉异常
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const sandbox = {
  window: {}, console,
  localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
  confirm: () => true
};
vm.createContext(sandbox);
const FILES = [
  'data/characters.js', 'data/endings.js', 'data/achievements.js',
  'data/events_general.js', 'data/events_line_a.js', 'data/events_line_b.js',
  'data/events_line_c.js', 'data/events_boss.js', 'data/filler.js',
  'js/state.js', 'js/engine.js'
];
for (const f of FILES) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
}

const args = process.argv.slice(2);
const countArg = args.find(arg => !arg.startsWith('--'));
const seedArg = args.find(arg => arg.startsWith('--seed='));
const N = Number(countArg === undefined ? 1200 : countArg);
const SEED = Number(seedArg === undefined ? 20261014 : seedArg.slice(7));
if (args.some(arg => arg !== countArg && arg !== seedArg) ||
    !Number.isSafeInteger(N) || N <= 0 ||
    !Number.isInteger(SEED) || SEED < 0 || SEED > 0xffffffff) {
  console.error('用法: node tools/simulate.js [正整数局数] [--seed=0到4294967295]');
  process.exit(1);
}
// 只改变测试环境中的随机数，产品运行仍使用浏览器原生 Math.random。
vm.runInContext(`(() => {
  let seed = ${SEED};
  Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
})()`, sandbox);
console.log('随机种子:', SEED);
const code = `
(function(){
  const E = window.Engine; E.init();
  const jobs = Object.keys(window.CHARACTERS.jobs);
  const byJob = {};
  Object.values(window.CHARACTERS.personas).forEach(p => { (byJob[p.job] = byJob[p.job] || []).push(p.id); });
  const results = {}, errors = [], bossSeen = {}, seen = new Set(), grades = {}, bossWords = {};
  let luckHits = 0;
  let played = 0, followupRounds = 0, skillUse = 0, journalMin = 1e9, journalMax = 0, journalEmpty = 0;
  const achHits = {};
  const variantHits = {};
  const fillerSeen = {};
  let fillerTotal = 0, fillerMaxPerWeek = 0, oneOffRepeats = 0;
  const oneOffSamples = [];
  const allVariants = (function () {
    const keys = [];
    [].concat(window.EV_GENERAL, window.EV_LINE_A, window.EV_LINE_B, window.EV_LINE_C, window.EV_BOSSES)
      .forEach(e => { if (e.variants) Object.keys(e.variants).forEach(jb => keys.push(jb + '|' + e.id)); });
    return keys;
  })();

  for (let i = 0; i < ${N}; i++) {
    const job = jobs[i % jobs.length];
    const plist = byJob[job];
    // 人设必须独立轮换：原写法 i%3 同时决定职级，导致每职级永远只测第一个人设
    window.GameState.fresh({ job, persona: plist[Math.floor(i / jobs.length) % plist.length], dept: 'tech', name: '测试' + i, no: 'JJ' + i });
    let weekFillers = 0; const weekSeen = {};
    const st = window.GameState.data;
    let guard = 0;
    let step = 0;
    while (!st.done && guard < 400) {
      step++;
      guard++;
      if (st.slotIdx >= E.slotsThisDay(st.day)) {
        if (st.day >= 7) { st.done = true; st.endingId = E.computeEnding(st); break; }
        E.endDay(st); continue;
      }
      let ev = null;
      try { ev = E.pickEvent(st); } catch (e) { errors.push('pick:' + e.message); break; }
      if (!ev) { st.slotIdx++; continue; }
      if (E.isDailyBoss(ev)) bossSeen[ev.id] = (bossSeen[ev.id] || 0) + 1;
      seen.add(ev.id);
      if (String(ev.id).indexOf("ev_fill_") === 0) { fillerTotal++; weekFillers++; fillerSeen[ev.id] = (fillerSeen[ev.id] || 0) + 1; }
      if (weekSeen[ev.id]) { const capE = E.byId(ev.id); const cap = capE ? capE.repeat : 0; if (!cap) { oneOffRepeats++; if (oneOffSamples.length < 3) oneOffSamples.push(job + '/' + st.char.persona + ' ' + ev.id + '(' + ev.title + ')'); } }
      weekSeen[ev.id] = true;
      // 变体覆盖率：每个 variants.<职级> 都必须真的被走到过
      if (ev.variants) {
        for (const jb of Object.keys(ev.variants)) {
          if (jb === st.char.job) variantHits[jb + '|' + ev.id] = (variantHits[jb + '|' + ev.id] || 0) + 1;
        }
      }
      // 偶尔发动一次主动技能（覆盖率检查）
      const sk = E.manualSkills(st, ev);
      // 轮换必须用「步号」而不是「局号」：用局号会导致一局内只会用同一种技能，
      // 老板的「画饼大师」永远用不到第 2 次（boss_pie 假性不可达）。
      if (sk.length && step % 3 === 0) {
        const s0 = sk[(step / 3) % sk.length | 0];    // 轮流发动不同技能（含职级技能）
        const src = s0.slot === 'job' ? E.jobOf(st).skill : E.personaOf(st).skill;
        try {
          if (src.trigger === 'manual_any') { E.useManualAny(st, s0.slot); skillUse++; }
          else { E.armSkill(st, src.arm || 'silent', s0.slot); skillUse++; }
        } catch (e) { errors.push('skill:' + e.message); }
        if (st.done) break;
      }
      // 一题答完再出下一题：追问轮次同样随机作答
      let fb = null, rounds = 0;
      while (!st.done) {
        const pool = fb ? E.filterChoices(st, fb.choices) : E.visibleChoices(st, ev);
        if (!pool.length) { errors.push('nochoices:' + ev.id); break; }
        // 人设专属（hidden）分支必须真的被走到：否则签名结局这类内容永远测不出来
        const gated = pool.filter(c => c.hidden);
        const ch = (gated.length && step % 3 === 1) ? gated[Math.floor(Math.random() * gated.length)]
                                                   : pool[Math.floor(Math.random() * pool.length)];
        let res = null;
        try { res = E.resolveChoice(st, ev, ch); } catch (e) { errors.push('resolve:' + ev.id + ':' + e.message); break; }
        if (res.followup && rounds < 2) { fb = res.followup; rounds++; followupRounds++; continue; }
        break;
      }
      if (st.done) break;
      st.slotIdx++;
    }
    if (guard >= 400 && !st.done) errors.push('回合数超过保护上限:' + job + '/' + st.char.persona);
    played++;
    if (weekFillers > fillerMaxPerWeek) fillerMaxPerWeek = weekFillers;
    const end = E.computeEnding(st);
    // 成就可达性：统计每个成就是否被解锁过（防止条件写死到永远达不到）
    try {
      st.endingId = st.endingId || E.computeEnding(st);   // 与 finishWeek 一致：先定结局再算成就
      st.done = true;
      E.finalAchievements(st);
      (st.achievements || []).forEach(id => { achHits[id] = (achHits[id] || 0) + 1; });
    } catch (e) { errors.push('ach:' + e.message); }
    // 周报流水：每周必须有记录、且不超过上限（存档体积可控）
    const jl = Array.isArray(st.journal) ? st.journal.length : -1;
    if (jl <= 0) journalEmpty++;
    else { journalMin = Math.min(journalMin, jl); journalMax = Math.max(journalMax, jl); }
    if (jl > 80) errors.push('周报流水超过上限: ' + jl);
    results[end] = (results[end] || 0) + 1;
    const eg = window.ENDINGS.find(x => x.id === end) || window.ENDINGS[0];
    if (job === 'mid' && st.luck === undefined) st.luck = E.rollMidLuck();
    if (job === 'mid' && st.luck) luckHits++;
    const gr = E.finalGrade(st, eg);
    grades[gr.grade] = (grades[gr.grade] || 0) + 1;
    if (job === 'boss') {
      bossWords[gr.word] = (bossWords[gr.word] || 0) + 1;
      if (gr.grade === 'D') errors.push('老板线出现差评 D');
      if (/[0-9]/.test(String(gr.label))) errors.push('老板线出现数字档位');
    }
  }
  return { played, errors, results, bossSeen, seenCount: seen.size, followupRounds, skillUse, grades, bossWords, luckHits, journalMin, journalMax, journalEmpty, achHits, achTotal: window.ACHIEVEMENTS.length, variantHits, variantTotal: allVariants, fillerTotal, fillerKinds: Object.keys(fillerSeen).length, fillerMaxPerWeek, oneOffRepeats, oneOffSamples };
})()
`;
const window0 = sandbox.window;
const errors0 = [];
const res = vm.runInContext(code, sandbox);
console.log("对局数:", res.played, " 异常数:", res.errors.length, " 事件覆盖:", res.seenCount,
  " 追问轮:", res.followupRounds, " 技能发动:", res.skillUse);
console.log("周报流水: 每周", res.journalMin, "~", res.journalMax, "条 · 空流水周:", res.journalEmpty);
if (res.journalEmpty) {
  console.log("  ✗ 有对局未记录任何决策流水");
  errors0.push("emptyJournal:" + res.journalEmpty);
}
{
  const never = sandbox.window.ACHIEVEMENTS.filter(a => !res.achHits[a.id]);
  console.log("成就可达性:", (res.achTotal - never.length) + "/" + res.achTotal, "个成就至少被解锁过一次");
  if (never.length) {
    const detail = never.map(a => a.id + "(" + a.test + ")").join(", ");
    if (N >= 1000) {
      console.log("  ✗ 以下成就未在本轮覆盖，需定向验证（随机采样不能证明不可达）:", detail);
      errors0.push("uncoveredAchievement:" + never.map(a => a.id).join("+"));
    } else {
      console.log("  ~ 以下成就在本轮样本里没出现（N<1000 属采样不足，用默认 N 复核）:", detail);
    }
  } else {
    console.log("  ✓ " + res.achTotal + " 个成就全部至少解锁过一次");
  }
}
{
  const never = (res.variantTotal || []).filter(k => !res.variantHits[k]);
  console.log("变体覆盖率:", ((res.variantTotal || []).length - never.length) + "/" + (res.variantTotal || []).length, "个职级变体被走到过");
  if (never.length) console.log("  提示: 以下职级变体未在本轮采样中被走到（多为采样不足，可加大 N 复核）:", never.join(", "));
}
{
  console.log("填充事件: 平均每局 " + (res.fillerTotal / res.played).toFixed(2) + " 次（单局最多 " + res.fillerMaxPerWeek + "），用到的种类 " + res.fillerKinds + "/" + (window0.EV_FILLER || []).length);
  if (res.oneOffRepeats) { console.log("  ✗ 一次性事件被重复播放 " + res.oneOffRepeats + " 次（应恒为 0）:", res.oneOffSamples.join(", ")); errors0.push("oneOffRepeat"); }
  else console.log("  ✓ 一次性事件本周零重复");
}
if (res.errors.length) console.log("错误样例:", res.errors.slice(0, 10));
console.log("Boss 战覆盖:", JSON.stringify(res.bossSeen));
console.log("评级分布(S/A/B/C/D):", JSON.stringify(res.grades));
console.log("老板线形容词分布:", JSON.stringify(res.bossWords), " 中层运气槽触发:", res.luckHits);
const dist = Object.entries(res.results).sort((a, b) => b[1] - a[1]);
console.log("结局分布:");
dist.forEach(([k, v]) => console.log(`  ${k}: ${v} (${(v / res.played * 100).toFixed(1)}%)`));
const failures = res.errors.concat(errors0);
if (failures.length) {
  console.error('模拟未通过:', failures.length, '项；复现命令: node tools/simulate.js ' + N + ' --seed=' + SEED);
  process.exitCode = 1;
} else {
  console.log('✓ 模拟通过');
}
