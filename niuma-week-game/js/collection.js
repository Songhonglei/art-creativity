// 跨局档案只保存收集结果，与当前进度、结局原文和属性独立。
window.Collection = (function () {
  const KEY = "niuma_collection_v1", GRADES = ["S", "A", "B", "C", "D"];
  let memory = null;
  const hints = {
    promotion: "让产出与信任一起走高。", lie_flat: "留点时间给自己，也守住工作的底线。",
    hop_job: "留意那通来自猎头的电话。", crazy_famous: "有些话，全公司都想听一个人说出来。",
    sweeper: "喘不过气的时候，听听王阿姨怎么说。", fall_guy: "每次接下的责任，最后都会留下痕迹。",
    n_plus_1: "绩效周，总有人先收到通知。", normal: "平稳过完一周，也会留下一个结局。",
    resign: "背包里，还留着你自己的决定。", exhausted: "有些代价，心态会先告诉你。",
    zhen_win: "把态度和证据留到关键时刻。", boss_win: "经营的几条底线，要一起守住。"
  };

  function catalog() {
    return Object.keys(window.CHARACTERS.jobs).flatMap(job => window.ENDINGS
      .filter(e => e.id !== "boss_win" || job === "boss")
      .filter(e => e.id !== "zhen_win" || job !== "boss")
      .map(e => ({ key: job + "|" + e.id, job, id: e.id, emoji: e.emoji,
        name: job === "boss" && e.boss ? e.boss.name : e.name, hint: hints[e.id] || "换一种选择，看看会发生什么。" })));
  }
  function cleanDelta(value) {
    const keys = new Set(catalog().map(e => e.key)), ids = new Set(window.ACHIEVEMENTS.map(a => a.id));
    return {
      endings: [...new Set((Array.isArray(value && value.endings) ? value.endings : []).filter(x => keys.has(x)))],
      achievements: [...new Set((Array.isArray(value && value.achievements) ? value.achievements : []).filter(x => ids.has(x)))]
    };
  }
  function normalize(value) {
    const clean = { version: 1, endings: {}, achievements: [], stickers: [], achievementJobs: {}, lastRun: null };
    if (!value || typeof value !== "object") return clean;
    const keys = new Set(catalog().map(e => e.key));
    Object.entries(value.endings && typeof value.endings === "object" ? value.endings : {}).forEach(([key, grade]) => {
      if (keys.has(key) && GRADES.includes(grade)) clean.endings[key] = grade;
    });
    clean.achievements = cleanDelta(value).achievements;
    const stickerIds = new Set(window.Missions ? window.Missions.catalog().map(g => g.id) : []);
    clean.stickers = [...new Set((Array.isArray(value.stickers) ? value.stickers : []).filter(id => stickerIds.has(id)))];
    for (const id of clean.achievements) {
      const job = value.achievementJobs && value.achievementJobs[id];
      if (Object.prototype.hasOwnProperty.call(window.CHARACTERS.jobs, job)) clean.achievementJobs[id] = job;
    }
    if (value.lastRun && typeof value.lastRun.key === "string" && value.lastRun.key.length <= 180) {
      clean.lastRun = { key: value.lastRun.key, delta: cleanDelta(value.lastRun.delta) };
    }
    return clean;
  }
  function storage() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return normalize(null); }
  }
  function read() {
    const saved = storage();
    if (!memory) memory = saved;
    // 合并另一标签页的收集结果；存储写入失败时保留本页内存进展。
    for (const [key, grade] of Object.entries(saved.endings)) {
      if (!memory.endings[key] || GRADES.indexOf(grade) < GRADES.indexOf(memory.endings[key])) memory.endings[key] = grade;
    }
    memory.achievements = [...new Set(memory.achievements.concat(saved.achievements))];
    memory.stickers = [...new Set(memory.stickers.concat(saved.stickers))];
    memory.achievementJobs = Object.assign({}, saved.achievementJobs, memory.achievementJobs);
    return normalize(memory);
  }
  function write(value) {
    memory = normalize(value);
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* 本页仍可查看，跨刷新保存不可用 */ }
  }
  function collectStickers(st) {
    const state = read(), completed = window.Missions ? window.Missions.completed(st) : [];
    const added = completed.filter(id => !state.stickers.includes(id));
    if (added.length) { state.stickers.push(...added); write(state); }
    return added;
  }
  function record(st, ending) {
    const empty = { endings: [], achievements: [] };
    const persona = st && st.char && window.CHARACTERS.personas[st.char.persona];
    if (!st || !st.done || !persona || persona.job !== st.char.job || !ending || !GRADES.includes(ending.grade)) return empty;
    const key = st.char.job + "|" + ending.id;
    if (!catalog().some(e => e.key === key)) return empty;
    collectStickers(st);
    const state = read();
    const runKey = [st.startTs || 0, st.char.no, st.char.job, st.char.persona, ending.id].join(":").slice(0, 180);
    if (state.lastRun && state.lastRun.key === runKey) return state.lastRun.delta;
    const delta = { endings: state.endings[key] ? [] : [key], achievements: [] };
    if (!state.endings[key] || GRADES.indexOf(ending.grade) < GRADES.indexOf(state.endings[key])) state.endings[key] = ending.grade;
    const applicable = new Set(window.Engine.achievementsFor(st).map(a => a.id));
    for (const id of st.achievements || []) {
      if (!applicable.has(id)) continue;
      if (!state.achievements.includes(id)) { state.achievements.push(id); delta.achievements.push(id); }
      if (!state.achievementJobs[id]) state.achievementJobs[id] = st.char.job;
    }
    state.lastRun = { key: runKey, delta };
    write(state);
    return delta;
  }
  function importLastEnding() {
    const rec = window.GameState.loadLastEnding();
    if (rec) record(rec.st, rec.ending);
  }
  function summary() {
    const state = read(), entries = catalog();
    return { endings: Object.keys(state.endings).length, endingTotal: entries.length,
      achievements: state.achievements.length, achievementTotal: window.ACHIEVEMENTS.length,
      stickers: state.stickers.length, stickerTotal: window.Missions ? window.Missions.catalog().length : 0 };
  }
  return { catalog, read, record, importLastEnding, summary, cleanDelta, collectStickers };
})();
