// 图鉴的跨局持久化、幂等归档、旧记录导入和不可信存储边界。
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const ROOT = path.join(__dirname, '..');
let passed = 0;
function setup(blocked = false, initial = null) {
  const store = new Map(initial ? [['niuma_collection_v1', initial]] : []);
  const localStorage = {
    getItem(k) { if (blocked) throw Error('denied'); return store.get(k) || null; },
    setItem(k, v) { if (blocked) throw Error('quota'); store.set(k, String(v)); },
    removeItem(k) { store.delete(k); }
  };
  const ctx = vm.createContext({ window: {}, localStorage });
  for (const name of ['data/characters.js', 'data/endings.js', 'data/achievements.js', 'data/events_general.js',
    'data/events_line_a.js', 'data/events_line_b.js', 'data/events_line_c.js', 'data/events_boss.js',
    'data/events_relations.js', 'data/filler.js', 'js/state.js', 'js/engine.js', 'js/collection.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, name), 'utf8'), ctx);
  }
  const { GameState: S, Engine: E, Collection: C } = ctx.window; E.init();
  let count = 0;
  function finish(job = 'staff', persona = 'huang', id = 'normal', grade = 'B') {
    S.fresh({ job, persona, name: '不应写进图鉴的姓名', no: 'TEST' + (++count) });
    S.data.done = true; S.data.endingId = id; E.finalAchievements(S.data);
    const ending = Object.assign({}, ctx.window.ENDINGS.find(e => e.id === id), { grade });
    return { st: S.data, ending };
  }
  return { S, E, C, ctx, store, finish };
}
function test(name, fn) { fn(); passed++; console.log('✓', name); }

test('仅列出各职级实际可达的 33 类基础结局', () => {
  const { C } = setup();
  assert.equal(C.catalog().length, 33);
  assert.equal(C.catalog().some(e => e.key === 'staff|boss_win'), false);
  assert.equal(C.catalog().some(e => e.key === 'boss|zhen_win'), false);
});
test('当前局归档后，重开和清除当前进度不会清空收集', () => {
  const { C, S, store, finish } = setup(), r = finish();
  const delta = C.record(r.st, r.ending);
  assert.equal(delta.endings[0], 'staff|normal'); assert.ok(delta.achievements.includes('full'));
  S.clear(); S.fresh({ job: 'boss', persona: 'normal' });
  assert.equal(C.summary().endings, 1);
  assert.equal(JSON.stringify([...store]).includes('不应写进图鉴的姓名'), false);
});
test('同一局重复结算保留本次新收集，重玩相同结局不重复发放', () => {
  const { C, finish } = setup(), a = finish();
  const first = JSON.stringify(C.record(a.st, a.ending));
  assert.equal(JSON.stringify(C.record(a.st, a.ending)), first);
  const b = finish(); assert.equal(C.record(b.st, b.ending).endings.length, 0);
  assert.equal(C.summary().endings, 1);
});
test('同一结局只更新更高评级，跨职级独立收集', () => {
  const { C, finish } = setup();
  for (const grade of ['C', 'A', 'D']) { const r = finish('staff', 'huang', 'normal', grade); C.record(r.st, r.ending); }
  assert.equal(C.read().endings['staff|normal'], 'A');
  const boss = finish('boss', 'normal'); C.record(boss.st, boss.ending);
  assert.equal(C.summary().endings, 2);
  assert.equal(C.read().achievementJobs.boss_pie, undefined);
});
test('记住成就首次获得的职级，老板版名称与说明可正确展示', () => {
  const { C, finish } = setup();
  const r = finish('boss', 'normal'); C.record(r.st, r.ending);
  assert.equal(C.read().achievementJobs.full, 'boss');
});
test('不归档未完成游戏，不接收其他人设成就', () => {
  const { C, S, finish } = setup();
  S.fresh({ job: 'staff', persona: 'huang' });
  assert.equal(C.record(S.data, { id: 'normal', grade: 'A' }).endings.length, 0);
  const r = finish(); r.st.achievements.push('sig_feiren'); C.record(r.st, r.ending);
  assert.equal(C.read().achievements.includes('sig_feiren'), false);
});
test('最近结局可导入图鉴，原结局快照和当前存档保持原样', () => {
  const { C, S, store, finish } = setup(), r = finish();
  S.saveLastEnding(r.st, r.ending); S.fresh({ job: 'mid', persona: 'shetou' });
  const ending = store.get(S.LAST_KEY), current = store.get(S.SAVE_KEY);
  C.importLastEnding(); C.importLastEnding();
  assert.equal(C.summary().endings, 1);
  assert.equal(store.get(S.LAST_KEY), ending); assert.equal(store.get(S.SAVE_KEY), current);
});
test('存储禁用仍能在本页归档与查看', () => {
  const { C, finish } = setup(true), r = finish();
  assert.doesNotThrow(() => C.record(r.st, r.ending));
  assert.equal(C.summary().endings, 1); assert.ok(C.summary().achievements > 0);
});
test('无效存储与未知条目不进入图鉴，摘要只接受已知标识', () => {
  const { C } = setup(false, '{"endings":{"__proto__":"S","staff|normal":"A","staff|boss_win":"S"},"achievements":["full","full","missing"]}');
  assert.equal(C.summary().endings, 1); assert.equal(C.summary().achievements, 1);
  const delta = C.cleanDelta({ endings: ['staff|normal', '<script>'], achievements: ['missing', 'full'] });
  assert.equal(delta.endings.length, 1); assert.equal(delta.achievements.length, 1);
  assert.equal(setup(false, '{broken').C.summary().endings, 0);
});
console.log('图鉴回归:', passed, '/', passed, '通过');
