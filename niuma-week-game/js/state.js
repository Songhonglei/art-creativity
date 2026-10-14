// 牛马求生记 · 状态与存档
window.GameState = {
  SAVE_KEY: "niuma_week_save_v1",
  LAST_KEY: "niuma_last_ending_v1",
  data: null,

  fresh(cfg) {
    const C = window.CHARACTERS;
    const job = C.jobs[cfg.job], persona = C.personas[cfg.persona];
    const stats = { mood: 0, kpi: 0, bond: 0, trust: 0, fish: 0, money: 0 };
    for (const k in job.stats) stats[k] = job.stats[k];
    for (const k in (persona.mods || {})) stats[k] = (stats[k] || 0) + persona.mods[k];
    for (const k of ["mood", "kpi", "bond", "trust", "fish"]) {
      stats[k] = Math.max(5, Math.min(100, stats[k]));
    }
    stats.money = Math.max(0.5, Math.min(6, stats.money));

    this.data = {
      char: {
        job: cfg.job, persona: cfg.persona, dept: cfg.dept || "tech",
        name: cfg.name || "无名牛马", no: cfg.no || ("JJ" + String(1000 + Math.floor(Math.random() * 9000)))
      },
      day: 1, slotIdx: 0,
      stats,
      pot: 0, gang: 0, gossip: 0,
      counters: { fishToilet: 0, piesHeard: 0, duiWins: 0, wangTalks: 0, overtimeStreak: 0, piesDrawn: 0, potPassed: 0 },
      flags: {},
      npc: {},
      items: [job.startItem || "resign"],   // 一线/中层：辞职信；老板：退出协议
      skillUses: {
        persona: persona.skill && persona.skill.uses != null ? persona.skill.uses : 0,
        job: job.skill && job.skill.uses != null ? job.skill.uses : 0
      },
      armed: null,
      turn: null,          // 当前回合（事件id + 追问轮次），刷新后可原样恢复
      scheduled: [],
      forced: [],
      usedEvents: [],
      usedToday: [],
      dayDelta: {},
      minMood: stats.mood,
      firstBondDone: false,
      endingId: null, done: false,
      achievements: [],
      dayAchievements: [],
      journal: [],         // 本周决策流水（周报回顾）
      startTs: Date.now()
    };
    this.save();
  },

  save() {
    try { localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },

  events() {
    return [].concat(window.EV_GENERAL || [], window.EV_LINE_A || [], window.EV_LINE_B || [],
      window.EV_LINE_C || [], window.EV_BOSSES || [], window.EV_FILLER || []);
  },

  // 可修复的旧档字段先清理；角色、时间、属性等核心字段交给 valid 拒绝非法值。
  normalize(d) {
    const record = v => v && typeof v === "object" && !Array.isArray(v);
    if (!record(d)) return null;
    const own = (obj, key) => typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
    const events = new Map(this.events().map(e => [e.id, e]));
    const statKeys = ["mood", "kpi", "bond", "trust", "fish", "money"];
    const numbers = (value, keys, integers = false) => Object.fromEntries(
      Object.entries(record(value) ? value : {}).filter(([k, v]) =>
        (!keys || keys.includes(k)) && Number.isFinite(v) && (!integers || (Number.isInteger(v) && v >= 0))));
    const queue = (list, forced) => (Array.isArray(list) ? list : []).flatMap(raw => {
      const x = forced && typeof raw === "string" ? { id: raw, expireDay: 7 } : raw;
      const id = record(x) && (forced ? x.id : x.eventId);
      if (!events.has(id)) return [];
      if (!forced && (!Number.isInteger(x.fireDay) || x.fireDay < 1 || x.fireDay > 7)) return [];
      const expireDay = x.expireDay === undefined ? Math.min(7, (x.fireDay || 5) + 2) : x.expireDay;
      if (!Number.isInteger(expireDay) || expireDay < 1 || expireDay > 7 || (!forced && expireDay < x.fireDay)) return [];
      return [forced ? { id, expireDay } : { eventId: id, fireDay: x.fireDay, expireDay }];
    });
    d.forced = queue(d.forced, true);
    d.scheduled = queue(d.scheduled, false);
    d.items = [...new Set((Array.isArray(d.items) ? d.items : []).filter(id => own(window.CHARACTERS.items, id)))];
    d.usedEvents = (Array.isArray(d.usedEvents) ? d.usedEvents : []).filter(id => events.has(id));
    d.usedToday = (Array.isArray(d.usedToday) ? d.usedToday : []).filter(id => events.has(id));
    d.flags = Object.fromEntries(Object.entries(record(d.flags) ? d.flags : {}).filter(([, v]) => typeof v === "boolean"));
    d.counters = Object.assign({ fishToilet: 0, piesHeard: 0, duiWins: 0, wangTalks: 0,
      overtimeStreak: 0, piesDrawn: 0, potPassed: 0 }, numbers(d.counters, null, true));
    d.dayDelta = numbers(d.dayDelta, statKeys);
    d.npc = numbers(d.npc, Object.keys(window.CHARACTERS.npcs));
    const uses = numbers(d.skillUses, ["job", "persona"], true);
    d.skillUses = { job: uses.job || 0, persona: uses.persona || 0 };
    const persona = window.CHARACTERS.personas[d.char && d.char.persona];
    const job = window.CHARACTERS.jobs[d.char && d.char.job];
    if (d.armed) {
      const kind = typeof d.armed === "string" ? d.armed : d.armed.kind;
      const slots = typeof d.armed === "string" ? ["persona", "job"] : [d.armed.slot];
      const slot = slots.find(k => (k === "persona" || k === "job") &&
        (k === "persona" ? persona : job)?.skill?.arm === kind && d.skillUses[k] > 0);
      d.armed = slot ? { kind, slot } : null;
    }
    const knownAchievements = new Set((window.ACHIEVEMENTS || []).map(a => a.id));
    d.achievements = [...new Set((Array.isArray(d.achievements) ? d.achievements : []).filter(id => knownAchievements.has(id)))];
    d.dayAchievements = [...new Set((Array.isArray(d.dayAchievements) ? d.dayAchievements : [])
      .filter(id => d.achievements.includes(id)))];
    d.minMood = d.minMood === undefined ? d.stats && d.stats.mood : d.minMood;
    if (Number.isFinite(d.minMood) && Number.isFinite(d.stats && d.stats.mood)) {
      d.minMood = Math.min(d.minMood, d.stats.mood);
    }
    // 修正旧版在日报提前发出的整周成就；已完成且实际条件成立的短局仍保留。
    d.achievements = d.achievements.filter(id => id !== "full" || (d.done === true && d.minMood >= 50));
    d.dayAchievements = d.dayAchievements.filter(id => d.achievements.includes(id));
    if (d.luck != null) {
      const known = (window.Engine && window.Engine.MID_LUCK || [])
        .find(x => x.id === d.luck.id && x.text === d.luck.text && x.delta === d.luck.delta);
      d.luck = known ? Object.assign({}, known) : null;
    }
    const strings = list => (Array.isArray(list) ? list : []).filter(v => typeof v === "string");
    d.journal = (Array.isArray(d.journal) ? d.journal : []).filter(record).map(j => {
      const out = Object.assign({}, j, {
        day: Number.isInteger(j.day) && j.day >= 1 && j.day <= 7 ? j.day : 1,
        slot: Number.isInteger(j.slot) && j.slot >= 0 && j.slot < 6 ? j.slot : 0,
        delta: numbers(j.delta, statKeys), cdelta: numbers(j.cdelta, ["pot", "gang", "gossip"]),
        flags: strings(j.flags), counters: strings(j.counters), npc: strings(j.npc)
      });
      for (const key of ["evId", "title", "text", "series", "rarity"]) out[key] = typeof j[key] === "string" ? j[key] : "";
      return out;
    }).slice(-80);
    // 追问只接受当前职级配置中真实存在的内容，绝不执行存档自带的任意 effects。
    if (record(d.turn) && d.turn.pendingFollowup) {
      const ev = events.get(d.turn.eventId);
      const variant = ev && ev.variants && (ev.variants[d.char.job] || ev.variants.staff);
      const candidates = [];
      const scan = (choices, depth) => (choices || []).forEach(ch => {
        if (!ch.followup || depth > 2) return;
        candidates.push(ch.followup); scan(ch.followup.choices, depth + 1);
      });
      scan((variant && variant.choices) || (ev && ev.choices), 1);
      const saved = JSON.stringify(d.turn.pendingFollowup);
      const canonical = candidates.find(fb => JSON.stringify(fb) === saved);
      if (!canonical) return null;
      d.turn.pendingFollowup = JSON.parse(JSON.stringify(canonical));
    }
    return d;
  },

  // 结构校验：存档可能被手动改坏（或跨版本），坏档一律当没有存档，避免白屏
  valid(d) {
    if (!d || typeof d !== "object" || d.done) return false;
    const c = d.char;
    const own = (obj, key) => typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);
    if (!c || typeof c.name !== "string" || typeof c.no !== "string" || !own(window.CHARACTERS.jobs, c.job)) return false;
    if (!own(window.CHARACTERS.personas, c.persona)) return false;
    const persona = window.CHARACTERS.personas[c.persona];
    if (!persona) return false;
    if (persona.job && persona.job !== c.job) return false;   // 人设必须属于该职级（防止改档越权）
    const st = d.stats;
    if (!st || typeof st !== "object") return false;
    for (const k of ["mood", "kpi", "bond", "trust", "fish", "money"]) {
      if (typeof st[k] !== "number" || !isFinite(st[k])) return false;
      if (st[k] < 0 || st[k] > (k === "money" ? 6 : 100)) return false;
    }
    if (!Number.isInteger(d.day) || d.day < 1 || d.day > 7) return false;
    if (!Number.isInteger(d.slotIdx) || d.slotIdx < 0 || d.slotIdx > (d.day === 7 ? 2 : 6)) return false;
    for (const k of ["pot", "gang", "gossip"]) {
      if (!Number.isInteger(d[k]) || d[k] < 0) return false;
    }
    if (!Number.isFinite(d.minMood) || d.minMood < 0 || d.minMood > 100) return false;
    if (!Array.isArray(d.usedEvents) || !Array.isArray(d.scheduled) || !Array.isArray(d.items)) return false;
    if (!d.flags || typeof d.flags !== "object" || !d.counters || typeof d.counters !== "object") return false;
    if (!Array.isArray(d.achievements)) return false;
    if (d.journal !== undefined && !Array.isArray(d.journal)) return false;
    if (!d.items.every(id => own(window.CHARACTERS.items, id))) return false;
    if (!d.scheduled.every(x => x && Number.isInteger(x.fireDay) && x.fireDay >= 1 && x.fireDay <= 7)) return false;
    if (d.turn != null) {
      if (!Number.isInteger(d.turn.round) || d.turn.round < 0 || d.turn.round > 2) return false;
      if (!this.events().some(e => e.id === d.turn.eventId)) return false;
      if (d.turn.round > 0 && !d.turn.pendingFollowup) return false;
    }
    return true;
  },

  load() {
    try {
      const s = localStorage.getItem(this.SAVE_KEY);
      if (!s) return false;
      const d = this.normalize(JSON.parse(s));
      if (!this.valid(d)) return false;
      this.data = d;
      return true;
    } catch (e) { return false; }
  },

  hasSave() {
    try {
      const s = localStorage.getItem(this.SAVE_KEY);
      if (!s) return false;
      return this.valid(this.normalize(JSON.parse(s)));
    } catch (e) { return false; }
  },

  // ---- 结局记录：打完一周后额外存一份，刷新/重开也能回看结局与分享卡 ----
  saveLastEnding(st, ending) {
    try {
      localStorage.setItem(this.LAST_KEY, JSON.stringify({ st, ending, savedAt: Date.now() }));
    } catch (e) { /* 忽略配额等异常 */ }
  },

  // 结局快照的形状校验：这份数据会被渲染进 DOM，改档者不该能注入任意 HTML
  validEnding(e) {
    if (!e || typeof e !== "object") return false;
    // 游戏文案里不会出现尖括号：出现即视为被篡改（渲染层另有 esc() 兜底）
    const clean = v => typeof v === "string" && v.indexOf("<") < 0 && v.indexOf(">") < 0;
    const ids = (window.ENDINGS || []).map(x => x.id);
    if (typeof e.id !== "string" || ids.indexOf(e.id) < 0) return false;
    if (!clean(e.name) || !clean(e.text) || !clean(e.emoji)) return false;
    if (e.name.length > 40 || e.text.length > 600 || e.emoji.length > 8) return false;
    if (typeof e.grade !== "string" || ["S", "A", "B", "C", "D"].indexOf(e.grade) < 0) return false;
    for (const k of ["gradeLabel", "perf", "bossWord", "bossNote", "bossSpin", "epilogue"]) {
      if (e[k] !== undefined && (!clean(e[k]) || e[k].length > 600)) return false;
    }
    if (e.luck !== undefined && e.luck !== null) {
      if (typeof e.luck !== "object" || !clean(e.luck.text) || e.luck.text.length > 160) return false;
      if (!Number.isFinite(e.luck.delta)) return false;
    }
    return true;
  },

  loadLastEnding() {
    try {
      const raw = localStorage.getItem(this.LAST_KEY);
      if (!raw) return null;
      const rec = JSON.parse(raw);
      if (!rec || !rec.st || !rec.ending) return null;
      rec.st = this.normalize(rec.st);
      if (!rec.st) return null;
      if (!this.valid(Object.assign({}, rec.st, { done: false }))) return null;   // 复用存档校验
      if (!this.validEnding(rec.ending)) return null;                            // 结局卡片同样校验
      return rec;
    } catch (e) { return null; }
  },

  hasLastEnding() { return !!this.loadLastEnding(); },

  clearLastEnding() {
    try { localStorage.removeItem(this.LAST_KEY); } catch (e) { /* 忽略 */ }
  },

  clear() {
    try { localStorage.removeItem(this.SAVE_KEY); } catch (e) { /* ignore */ }
    this.data = null;
  }
};
