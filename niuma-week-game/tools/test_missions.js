// 可选目标、获得反馈与跨局贴纸：使用真实引擎结算验证，避免镜像实现。
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
let passed = 0;
function setup(job = 'staff', persona = 'huang', store = new Map(), blocked = false) {
  const ctx = vm.createContext({ window: {}, localStorage: {
    getItem(k) { if (blocked) throw Error('denied'); return store.get(k) || null; },
    setItem(k, v) { if (blocked) throw Error('denied'); store.set(k, v); }, removeItem(k) { store.delete(k); }
  } });
  for (const file of ['data/characters.js', 'data/endings.js', 'data/achievements.js', 'data/events_general.js',
    'data/events_line_a.js', 'data/events_line_b.js', 'data/events_line_c.js', 'data/events_boss.js',
    'data/events_relations.js', 'data/filler.js', 'js/state.js', 'js/engine.js', 'js/missions.js', 'js/collection.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), ctx, { filename: file });
  }
  const { GameState: S, Engine: E, Missions: M, Collection: C } = ctx.window;
  E.init(); S.fresh({ job, persona, no: 'GOALTEST' });
  return { S, E, M, C, ctx, store, get st() { return S.data; } };
}
const plain = x => JSON.parse(JSON.stringify(x));
function offer(g, ids = ['six_replies', 'good_mood']) {
  g.st.missions = { version: 1, offered: ids, selected: [], status: 'pending', progress: {} };
}
function reply(g, choice = {}, ev = {}) {
  return g.E.resolveChoice(g.st, { id: '__mission_test', series: 'story', ...ev }, { text: '测试回复', ...choice });
}
function test(name, fn) { fn(); passed++; console.log('✓', name); }

test('所有职级每局提供两个不同的适用目标，抽取不消耗游戏随机数', () => {
  for (const [job, persona] of [['staff', 'huang'], ['mid', 'shetou'], ['boss', 'normal']]) {
    const g = setup(job, persona);
    vm.runInContext('Math.random = () => { throw Error("不可消耗剧情随机数"); };', g.ctx);
    for (let n = 0; n < 60; n++) {
      g.st.startTs = n;
      const a = g.M.offer(g.st), b = g.M.offer(g.st);
      assert.equal(a.offered.length, 2); assert.equal(new Set(a.offered).size, 2);
      assert.deepEqual(plain(a), plain(b));
      if (job !== 'staff') assert.equal(a.offered.includes('keep_receipt'), false);
    }
  }
});
for (const n of [0, 1, 2]) test('接受 ' + n + ' 个：不修改属性、技能、计数器和评级，不可重复接取', () => {
  const g = setup(); offer(g);
  const before = plain({ stats: g.st.stats, uses: g.st.skillUses, counters: g.st.counters, grade: g.E.perfScore(g.st) });
  assert.equal(g.M.accept(g.st, g.st.missions.offered.slice(0, n)), true);
  assert.equal(g.st.missions.status, n ? 'accepted' : 'ignored');
  assert.equal(g.st.missions.selected.length, n);
  assert.deepEqual(plain({ stats: g.st.stats, uses: g.st.skillUses, counters: g.st.counters, grade: g.E.perfScore(g.st) }), before);
  assert.equal(g.M.accept(g.st, g.st.missions.offered), false);
});
test('只接一个，仅所选目标计数和达成；待选择与忽略时不计数', () => {
  const g = setup(); offer(g);
  reply(g, { effects: { mood: 1 } }); assert.deepEqual(plain(g.st.missions.progress), {});
  g.M.accept(g.st, ['six_replies']);
  for (let i = 0; i < 5; i++) assert.equal(reply(g, { effects: { mood: 1 } }).completedGoals.length, 0);
  assert.deepEqual(plain(reply(g).completedGoals), ['six_replies']);
  assert.deepEqual(plain(g.st.missions.progress), { six_replies: 6 });
  assert.equal(reply(g).completedGoals.length, 0);
  const h = setup(); h.M.accept(h.st, []); reply(h, { effects: { mood: 5 } });
  assert.deepEqual(plain(h.st.missions.progress), {});
});
test('技能道具仍计入日报流水，但不冒充事件回复；属性到上限也不算回升', () => {
  const g = setup('boss', 'normal'); offer(g); g.M.accept(g.st, g.st.missions.offered);
  g.E.useManualAny(g.st, 'persona'); g.st.items.push('coffee'); g.E.useItem(g.st, 'coffee');
  assert.deepEqual(plain(g.st.missions.progress), { six_replies: 0, good_mood: 0 });
  g.st.stats.mood = 100; reply(g, { effects: { mood: 5 } });
  assert.equal(g.st.missions.progress.good_mood, 0);
});
test('硬刚失败不算成功；无概率硬刚与追问均正常累计', () => {
  const g = setup(); offer(g, ['speak_up', 'six_replies']); g.M.accept(g.st, g.st.missions.offered);
  vm.runInContext('Math.random = () => 0.99;', g.ctx);
  reply(g, { isDui: true, judge: { base: 0.1 } }); assert.equal(g.st.missions.progress.speak_up, 0);
  reply(g, { isDui: true }); assert.equal(g.st.missions.progress.speak_up, 1);
  assert.ok(reply(g, { isDui: true }).completedGoals.includes('speak_up'));
  assert.equal(g.st.missions.progress.six_replies, 3);
});
test('摸鱼、恢复、人缘、证据目标全部通过实际选择可达成', () => {
  for (const [id, choice] of [['take_break', { effects: { fish: 1 } }], ['good_mood', { effects: { mood: 1 } }],
    ['good_company', { effects: { bond: 1 } }], ['keep_receipt', { flag: 'juanLogs' }]]) {
    const g = setup(); offer(g, [id, 'six_replies']); g.M.accept(g.st, [id]);
    const target = g.M.get(id).target;
    for (let i = 0; i < target; i++) reply(g, choice);
    assert.deepEqual(plain(g.M.completed(g.st)), [id]);
  }
});
test('刷新保留同一组目标、接受结果及进度，不追溯旧流水', () => {
  const g = setup(), original = plain(g.st.missions); g.S.save(); assert.equal(g.S.load(), true);
  assert.deepEqual(plain(g.st.missions), original);
  offer(g); reply(g); g.M.accept(g.st, ['six_replies']); reply(g); g.S.save(); assert.equal(g.S.load(), true);
  assert.equal(g.st.missions.progress.six_replies, 1);
  g.st.missions.status = 'ignored'; g.st.missions.selected = []; g.S.save(); assert.equal(g.S.load(), true);
  assert.equal(g.st.missions.status, 'ignored');
});
test('旧活跃档仅补一个待选入口，旧结局不补发目标或贴纸', () => {
  const g = setup(); delete g.st.missions; g.S.save(); assert.equal(g.S.load(), true);
  assert.equal(g.st.missions.status, 'pending');
  delete g.st.missions; g.st.done = true; g.S.saveLastEnding(g.st, { ...g.ctx.window.ENDINGS.find(e => e.id === 'normal'), grade: 'B' });
  const last = g.S.loadLastEnding(); assert.equal(last.st.missions, null);
  assert.equal(g.C.collectStickers(last.st).length, 0);
});
test('未知目标、越权职级、伪造目标效果和非法进度不会进入恢复规则', () => {
  const g = setup('boss', 'normal');
  g.st.missions = { offered: ['keep_receipt', 'bogus'], status: 'accepted', selected: ['bogus'], progress: { bogus: 999 }, effects: { money: 999 } };
  g.st.missions = g.M.normalize(g.st); assert.equal(g.st.missions.status, 'pending'); assert.equal('effects' in g.st.missions, false);
  offer(g); g.st.missions.status = 'accepted'; g.st.missions.selected = ['six_replies', 'good_mood', 'bogus'];
  g.st.missions.progress = { six_replies: -1, good_mood: '3', bogus: 99 }; g.st.missions = g.M.normalize(g.st);
  assert.deepEqual(plain(g.st.missions.progress), { six_replies: 0, good_mood: 0 });
});
test('目标完成立即存贴纸，提前离职、清档、跨页刷新与重复结算均不丢不重复', () => {
  const g = setup(); offer(g); g.M.accept(g.st, ['good_mood']);
  for (let n = 0; n < 3; n++) reply(g, { effects: { mood: 1 } });
  g.S.save(); assert.deepEqual(plain(g.C.collectStickers(g.st)), ['good_mood']);
  assert.equal(g.C.collectStickers(g.st).length, 0);
  g.E.useItem(g.st, 'resign'); assert.equal(g.st.done, true); assert.equal(g.st.day, 1);
  g.S.clear(); const other = setup('boss', 'normal', g.store);
  assert.deepEqual(plain(other.C.read().stickers), ['good_mood']);
  assert.equal(other.C.summary().achievements, 0); assert.equal(other.C.summary().endings, 0);
});
test('刷新可从保存的完成进度补记贴纸；未接受与旧局不会误发', () => {
  const g = setup(); offer(g); g.M.accept(g.st, ['good_mood']);
  for (let n = 0; n < 3; n++) reply(g, { effects: { mood: 1 } });
  g.S.save(); assert.equal(g.S.load(), true);
  assert.deepEqual(plain(g.C.collectStickers(g.st)), ['good_mood']);
  const h = setup(); assert.equal(h.C.collectStickers(h.st).length, 0);
});
test('禁用存储仍可选择、完成、查看本页贴纸', () => {
  const g = setup('staff', 'huang', new Map(), true); offer(g); g.M.accept(g.st, ['good_mood']);
  for (let n = 0; n < 3; n++) reply(g, { effects: { mood: 1 } });
  g.C.collectStickers(g.st); assert.equal(g.C.summary().stickers, 1);
});
test('获得道具仅在实际入包时反馈，重复持有不重复提示', () => {
  const g = setup(); assert.deepEqual(plain(reply(g, { item: 'film' }).newItems), ['film']);
  assert.equal(reply(g, { item: 'film' }).newItems.length, 0);
  assert.equal(g.st.items.filter(id => id === 'film').length, 1);
  g.st.items.push('coffee'); g.E.useItem(g.st, 'coffee');
  assert.deepEqual(plain(reply(g, { item: 'coffee' }).newItems), ['coffee']);
});
test('证据目标采用真实配置：获得录音笔的同一回复立即达成，身份说明匹配属性', () => {
  const g = setup(); offer(g, ['keep_receipt', 'six_replies']); g.M.accept(g.st, ['keep_receipt']);
  const ev = g.E.byId('ev_chain_change_delete'), ch = g.E.visibleChoices(g.st, ev).find(c => c.item === 'recorder');
  assert.deepEqual(plain(g.E.resolveChoice(g.st, ev, ch).completedGoals), ['keep_receipt']);
  assert.match(g.M.describe(g.st, 'good_company'), /人缘/);
  const mid = setup('mid', 'shetou'); assert.match(mid.M.describe(mid.st, 'good_company'), /团队士气/);
  const boss = setup('boss', 'normal'); assert.match(boss.M.describe(boss.st, 'take_break'), /自由度/);
});
console.log(`趣味目标与获得反馈: ${passed} / ${passed} 通过`);
