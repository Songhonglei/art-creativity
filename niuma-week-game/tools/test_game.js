// 核心规则定向回归；每个用例独立加载数据，随机数由用例控制。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.join(__dirname, '..');
let passed = 0;

function game(job = 'mid', persona = 'shetou') {
  const storage = new Map();
  const ctx = vm.createContext({
    window: {},
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, String(v)) }
  });
  for (const file of [
    'data/characters.js', 'data/endings.js', 'data/achievements.js',
    'data/events_general.js', 'data/events_line_a.js', 'data/events_line_b.js',
    'data/events_line_c.js', 'data/events_boss.js', 'data/filler.js', 'js/state.js', 'js/engine.js'
  ]) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  const { Engine: E, GameState: S } = ctx.window;
  E.init(); S.fresh({ job, persona });
  return {
    E, S, st: S.data, ctx,
    roll(value) { vm.runInContext(`Math.random = () => ${value};`, ctx); }
  };
}

function test(name, fn) { fn(); passed++; console.log('✓', name); }

for (const slot of ['persona', 'job']) {
  test('拦截顶层及 effects 黑锅，消费 ' + slot + ' 来源', () => {
    const { E, st } = game();
    const before = { ...st.skillUses };
    assert.equal(E.armSkill(st, 'intercept', slot), true);
    const bond = st.stats.bond;
    const r = E.resolveChoice(st, { id: 'probe', series: 'blame' }, {
      text: '接锅', pot: 1, effects: { pot: 1 }
    });
    assert.equal(st.pot, 0);
    assert.equal(st.stats.bond, bond - 10);
    assert.equal(st.skillUses[slot], before[slot] - 1);
    const other = slot === 'job' ? 'persona' : 'job';
    assert.equal(st.skillUses[other], before[other]);
    assert.match(r.meta.join(' '), /锅在空中/);
    assert.equal(st.armed, null);
  });
}

test('拦截判定失败带来的黑锅', () => {
  const { E, st, roll } = game(); roll(0.99);
  E.armSkill(st, 'intercept', 'job');
  E.resolveChoice(st, { id: 'probe', series: 'blame' }, {
    text: '试着转移', judge: { base: 0.5, failEffects: { pot: 1 } }
  });
  assert.equal(st.pot, 0);
  assert.equal(st.skillUses.job, 0);
});

test('旧存档的字符串待命技能仍可结算', () => {
  const { E, st } = game(); st.armed = 'intercept';
  E.resolveChoice(st, { id: 'probe', series: 'blame' }, { text: '接锅', pot: 1 });
  assert.equal(st.pot, 0);
  assert.equal(st.skillUses.persona, 1);
});

test('新存档恢复后仍保留职级技能来源', () => {
  const { E, S, st } = game(); E.armSkill(st, 'intercept', 'job'); S.save();
  assert.equal(S.load(), true);
  E.resolveChoice(S.data, { id: 'probe', series: 'blame' }, { text: '接锅', pot: 1 });
  assert.equal(S.data.skillUses.job, 0);
  assert.equal(S.data.skillUses.persona, 2);
});

test('技能耗尽后不能待命', () => {
  const { E, st } = game(); st.skillUses.job = 0;
  assert.equal(E.armSkill(st, 'intercept', 'job'), false);
  assert.equal(st.armed, null);
});

test('拍桌子仍能将失败判定翻为成功', () => {
  const { E, st, roll } = game('mid', 'baoyu'); roll(0.99);
  E.armSkill(st, 'forceJudge', 'persona');
  const r = E.resolveChoice(st, { id:'probe', series:'blame' }, {text:'对质',judge:{base:0.5}});
  assert.equal(r.judged, true);
  assert.equal(st.skillUses.persona, 1);
  assert.equal(st.armed, null);
});

test('闷声干活仍将 KPI 损失转为心态损失', () => {
  const { E, st } = game('staff', 'huang');
  const before = {...st.stats}; E.armSkill(st, 'silent', 'persona');
  E.resolveChoice(st, {id:'probe',series:'blame'}, {text:'接锅',pot:1,effects:{kpi:-10,mood:-1}});
  assert.equal(st.stats.kpi, before.kpi);
  assert.equal(st.stats.mood, before.mood-11);
  assert.equal(st.skillUses.persona, 1);
});

test('录音笔不影响非证据判定', () => {
  const { E, st, roll } = game(); st.items.push('recorder'); roll(0.99);
  const r = E.resolveChoice(st, { id: 'probe', series: 'politics' }, { text: '谈判', judge: { base: 0.5 } });
  assert.equal(r.judged, false);
});

test('证据标记本身不会保证成功，必须持有录音笔', () => {
  const { E, st, roll } = game(); roll(0.99);
  const r = E.resolveChoice(st, { id: 'probe', series: 'blame' }, { text: '举证', judge: { base: 0.5, evidence: true } });
  assert.equal(r.judged, false);
});

test('录音笔证据判定必成，防窥膜不会降低概率', () => {
  const { E, st, roll } = game(); st.items.push('recorder', 'film'); roll(0.99);
  const r = E.resolveChoice(st, { id: 'probe', series: 'fish' }, { text: '举证', judge: { base: 0.5, evidence: true } });
  assert.equal(r.judged, true);
  assert.match(r.meta.join(' '), /录音笔/);
});

test('真实证据选项有明确标记', () => {
  const { E } = game();
  assert.equal(E.byId('ev_boss_thu').variants.staff.choices[1].judge.evidence, true);
  assert.equal(E.byId('ev_mid_blame_pingpong').choices[0].judge.evidence, true);
  assert.equal(E.byId('ev_mid_chain_promise').choices[0].judge.evidence, true);
});

test('加成归因只使用一次随机数，未救场不提示', () => {
  const { E, st, ctx } = game('staff', 'zhan');
  vm.runInContext('var draws = 0; Math.random = () => { draws++; return 0.2; };', ctx);
  const r = E.resolveChoice(st, { id: 'probe', series: 'story' }, { text: '试一下', judge: { base: 0.5 } });
  assert.equal(r.judged, true);
  assert.equal(r.meta.length, 0);
  assert.equal(ctx.draws, 1);
});

test('Boss 优先，连锁保留并在后续时段播放', () => {
  const { E, st } = game('boss', 'normal');
  st.day = 3; st.slotIdx = 3;
  st.forced = [{ id: 'ev_chain_pie_backlash', expireDay: 3 }];
  assert.equal(E.pickEvent(st).id, 'ev_boss_wed');
  assert.equal(st.forced.length, 1);
  st.slotIdx = 4;
  assert.equal(E.pickEvent(st).id, 'ev_chain_pie_backlash');
  assert.equal(st.forced.length, 0);
});

test('周日 Boss 也记入已播放，避免重复抽取', () => {
  const { E, st } = game(); st.day = 7; st.slotIdx = 1;
  assert.equal(E.pickEvent(st).id, 'ev_boss_sun');
  assert.equal(st.usedEvents.includes('ev_boss_sun'), true);
  assert.notEqual(E.pickEvent(st).id, 'ev_boss_sun');
});

test('六种微事件都能按存档 ID 恢复', () => {
  const { E, S, ctx } = game();
  for (const ev of ctx.window.EV_FILLER) {
    S.data.turn = { eventId: ev.id, round: 0, pendingFollowup: null }; S.save();
    assert.equal(S.load(), true);
    assert.equal(E.byId(S.data.turn.eventId).id, ev.id);
  }
});

test('老板画饼反噬不参与普通随机抽取', () => {
  const { E, st, ctx } = game('boss', 'normal'); st.day = 2; st.slotIdx = 1;
  st.usedEvents = [].concat(ctx.window.EV_GENERAL, ctx.window.EV_LINE_C, ctx.window.EV_BOSSES)
    .filter(e => e.id !== 'ev_chain_pie_backlash').map(e => e.id);
  for (let n = 0; n < 6; n++) assert.notEqual(E.pickEvent(st)?.id, 'ev_chain_pie_backlash');
});

for (const [job, persona] of [['staff', 'huang'], ['mid', 'shetou']]) {
  test(job + ' 未发动技能也能随机触发画饼反噬，本周不重复', () => {
    const { E, st, ctx } = game(job, persona); st.day = 2; st.slotIdx = 3;
    st.usedEvents = [].concat(ctx.window.EV_GENERAL, ctx.window.EV_LINE_A,
      ctx.window.EV_LINE_B, ctx.window.EV_BOSSES)
      .filter(e => e.id !== 'ev_chain_pie_backlash').map(e => e.id);
    assert.equal(st.counters.piesDrawn, 0);
    assert.equal(st.scheduled.length, 0);
    assert.equal(E.pickEvent(st).id, 'ev_chain_pie_backlash');
    assert.notEqual(E.pickEvent(st)?.id, 'ev_chain_pie_backlash');
  });
}

test('画饼两次收益均执行，只安排一次反噬', () => {
  const { E, st } = game('boss', 'normal'); st.stats.bond = 50;
  E.useManualAny(st, 'job'); E.useManualAny(st, 'job');
  assert.equal(st.stats.bond, 70);
  assert.equal(st.counters.piesDrawn, 2);
  assert.equal(st.scheduled.length, 1);
  assert.equal(st.scheduled[0].fireDay, 3);
});

for (const [job, persona, text, cost] of [
  ['staff', 'huang', '自愿晚发一个月工资', 1],
  ['mid', 'shetou', '先垫半个月工资给团队发红包鼓舞士气', 0.5]
]) {
  test(job + ' 反噬按身份显示已确认选项，工资金额与结算一致', () => {
    const { E, st } = game(job, persona);
    const ev = E.byId('ev_chain_pie_backlash');
    const choices = E.visibleChoices(st, ev);
    assert.equal(choices.length, 2);
    assert.equal(choices[0].text, text);
    assert.equal(choices[1].text, '装没看见');
    const before = { ...st.stats };
    const r = E.resolveChoice(st, ev, choices[0]);
    assert.equal(st.stats.money, before.money - cost);
    assert.equal(r.delta.money, -cost);
    assert.equal(st.stats.bond, before.bond + 10);
    assert.equal(st.stats.trust, before.trust - 3);
    assert.equal(st.stats.mood, before.mood + 4);
  });
}

test('老板反噬变体完整保留原文案、数值和隐藏项', () => {
  const { E, st } = game('boss', 'biantai');
  const ev = E.byId('ev_chain_pie_backlash');
  assert.deepEqual(E.eventLines(st, ev), ev.lines);
  assert.deepEqual(E.visibleChoices(st, ev), ev.choices);
});

test('反噬进入待播队列或播放后，第二次画饼不再排程', () => {
  const { E, st } = game('boss', 'normal');
  E.useManualAny(st, 'job'); E.endDay(st); E.endDay(st);
  E.useManualAny(st, 'job');
  assert.equal(st.scheduled.length, 0);
  assert.equal(st.forced.length, 1);
  st.slotIdx = 1;
  const ev = E.pickEvent(st);
  assert.equal(ev.id, 'ev_chain_pie_backlash');
  const before = st.stats.bond;
  E.resolveChoice(st, ev, ev.choices[1]);
  assert.equal(st.stats.bond, before - 8, '保留现有“装没看见”的代价');
  const another = game('boss', 'normal');
  another.E.useManualAny(another.st, 'job');
  another.st.usedEvents.push('ev_chain_pie_backlash'); another.st.scheduled = [];
  another.E.useManualAny(another.st, 'job');
  assert.equal(another.st.scheduled.length, 0);
});

test('整周成就过程不发，心态跌破阈值后结算也不发', () => {
  const { E, st } = game('staff', 'huang');
  E.checkAchievements(st);
  assert.equal(st.achievements.includes('full'), false);
  E.resolveChoice(st, {id:'probe',series:'story'}, {text:'崩溃',effects:{mood:-100}});
  E.finalAchievements(st);
  assert.equal(st.achievements.includes('full'), false);
});

test('提前离职也能在结算获得实际游玩期间达标的整周成就', () => {
  const { E, st } = game('staff', 'huang');
  E.useItem(st, 'resign');
  assert.equal(st.day, 1);
  assert.equal(st.achievements.includes('full'), false);
  E.finalAchievements(st);
  assert.equal(st.achievements.includes('full'), true);
});

test('瞬时加班与 KPI 成就在达标回合解锁，回落不丢失', () => {
  const { E, st } = game('staff', 'cai');
  st.counters.overtimeStreak = 2; st.stats.kpi = 89;
  E.resolveChoice(st, {id:'probe',series:'overtime'}, {text:'加班',overtime:true,effects:{kpi:2}});
  E.resolveChoice(st, {id:'probe',series:'story'}, {text:'下班',overtime:false,effects:{kpi:-5}});
  assert.equal(st.counters.overtimeStreak, 0);
  assert.equal(st.achievements.includes('juan'), true);
  assert.equal(st.achievements.includes('p_cai'), true);
  assert.equal(st.dayAchievements.filter(id => id === 'juan').length, 1);
});

test('周五排程在周三不可随机出现，到期后正常播放', () => {
  const { E, st, ctx } = game('mid', 'shetou'); st.day = 3; st.slotIdx = 0;
  const source = E.byId('ev_mid_press_down'); E.resolveChoice(st, source, source.choices[0]);
  const target = st.scheduled[0].eventId;
  st.usedEvents = [].concat(ctx.window.EV_GENERAL,ctx.window.EV_LINE_A,ctx.window.EV_LINE_B,
    ctx.window.EV_LINE_C,ctx.window.EV_BOSSES).filter(e => e.id !== target).map(e => e.id);
  st.slotIdx = 1;
  assert.notEqual(E.pickEvent(st)?.id, target);
  E.endDay(st); E.endDay(st); st.slotIdx = 1;
  assert.equal(E.pickEvent(st).id, target);
});

test('闷声干活不额外加锅，真实选项最终 +2 且提示一致', () => {
  const { E, st } = game('staff', 'huang'); const ev = E.byId('ev_chain_change_delete');
  E.armSkill(st, 'silent', 'persona');
  const r = E.resolveChoice(st, ev, ev.choices[2]);
  assert.equal(st.pot, 2);
  assert.match(r.meta.join(' '), /黑锅 \+2/);
  assert.equal(st.journal[st.journal.length-1].cdelta.pot, 2);
});

test('主动技能和道具实际变化进入日报与名场面候选流水', () => {
  const { E, S, st } = game('boss', 'normal'); st.stats.mood=60; st.stats.bond=60;
  E.useManualAny(st, 'persona'); st.items.push('coffee'); E.useItem(st, 'coffee');
  assert.equal(st.stats.mood, 85);
  assert.equal(st.dayDelta.mood, 25);
  assert.equal(st.dayDelta.bond, 8);
  assert.equal(st.journal.length, 2);
  assert.equal(st.journal[0].kind, 'skill');
  assert.equal(st.journal[1].kind, 'item');
  S.save(); assert.equal(S.load(), true);
  assert.equal(S.data.journal[1].delta.mood, 15);
});

test('修复坏队列和未知道具后存档仍能继续，核心进度保留', () => {
  const { E, S, st } = game(); st.day=3; st.slotIdx=2;
  st.items.push('removed_item'); st.scheduled=[null,{eventId:'missing',fireDay:4}];
  st.forced=[null,'missing']; S.save();
  assert.equal(S.hasSave(), true); assert.equal(S.load(), true);
  assert.equal(S.data.day, 3); assert.equal(S.data.slotIdx, 2);
  assert.equal(S.data.items.includes('removed_item'), false);
  assert.equal(S.data.scheduled.length, 0); assert.equal(S.data.forced.length, 0);
  assert.doesNotThrow(() => E.endDay(S.data));
});

test('拒绝非整数时间、越界时段和 HTML 计数器', () => {
  for (const [key,value] of [['day',1.5],['slotIdx',7],['pot','<img src=x onerror=alert(1)>']]) {
    const { S, st } = game(); st[key]=value; S.save();
    assert.equal(S.hasSave(), false); assert.equal(S.load(), false);
  }
});

test('真实追问可恢复，篡改追问效果的存档被拒绝', () => {
  const { E, S, st } = game('staff', 'huang');
  const fb=E.byId('ev_a_bug').choices[0].followup;
  st.turn={eventId:'ev_a_bug',round:1,pendingFollowup:JSON.parse(JSON.stringify(fb))};
  S.save(); assert.equal(S.load(), true);
  S.data.turn.pendingFollowup.choices[0].effects.trust='unsafe'; S.save();
  assert.equal(S.hasSave(), false); assert.equal(S.load(), false);
});

test('旧档提前解锁的 full 被移除，过程成就与待命来源保留', () => {
  const { E, S, st } = game(); E.armSkill(st, 'intercept', 'job');
  st.achievements=['full','dui']; S.save(); assert.equal(S.load(), true);
  assert.equal(S.data.achievements.includes('full'), false);
  assert.equal(S.data.achievements.includes('dui'), true);
  assert.equal(S.data.armed.slot, 'job');
});

console.log('核心规则回归:', passed, '/', passed, '通过');
