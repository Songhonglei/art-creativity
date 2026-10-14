// 牛马求生记 · 游戏引擎：事件抽取 / 判定 / 结算 / 结局
window.Engine = (function () {
  const SLOT_KEYS = ["morning", "am", "noon", "pm", "evening", "off"];
  const SLOT_LABELS = { morning: "早间", am: "上午", noon: "午休", pm: "下午", evening: "晚间", off: "下班" };
  const DAY_NAMES = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };
  const STAT_KEYS = ["mood", "kpi", "bond", "trust", "fish"];
  const COUNTER_KEYS = ["pot", "gang", "gossip"];
  const RARITY_W = { common: 10, rare: 5, epic: 2 };

  let ALL = [], BY_ID = {};

  function init() {
    ALL = [].concat(window.EV_GENERAL, window.EV_LINE_A, window.EV_LINE_B, window.EV_LINE_C, window.EV_BOSSES);
    BY_ID = {};
    ALL.concat(window.EV_FILLER || []).forEach(e => { BY_ID[e.id] = e; });
  }

  function slotsThisDay(day) { return day === 7 ? 2 : 6; }

  function condOk(cond, st) {
    if (!cond) return true;
    const s = st.stats;
    const C = [
      ["trustLt", v => s.trust < v], ["trustGt", v => s.trust > v],
      ["kpiLt", v => s.kpi < v], ["kpiGt", v => s.kpi > v],
      ["moodLt", v => s.mood < v], ["moodGt", v => s.mood > v],
      ["bondLt", v => s.bond < v], ["bondGt", v => s.bond > v],
      ["potGte", v => st.pot >= v], ["gangGte", v => st.gang >= v],
      ["dayGte", v => st.day >= v],
      ["persona", v => st.char.persona === v],
      ["job", v => st.char.job === v],
      ["flag", v => !!st.flags[v]]
    ];
    for (const [k, fn] of C) {
      if (cond[k] !== undefined && !fn(cond[k])) return false;
    }
    if (cond.npcGte) {
      for (const k in cond.npcGte) {
        if ((st.npc[k] || 0) < cond.npcGte[k]) return false;
      }
    }
    return true;
  }

  function isDailyBoss(e) { return e.pool === "boss" && (e.weight || 0) >= 999; }

  function bossFor(st) {
    const slotKey = SLOT_KEYS[st.slotIdx];
    return ALL.find(e => isDailyBoss(e) && (e.days || []).includes(st.day) && (e.slots || []).includes(slotKey)
      && !st.usedEvents.includes(e.id)) || null;
  }

  function byId(id) { return BY_ID[id] || null; }

  function pickEvent(st) {
    // 防呆：没调 init() 时 ALL/BY_ID 是空的，严格池永远为空 → 会静默退化成"全是兜底微事件"。
    // 这个坑让排查脚本得出过错误结论，所以这里直接自愈。
    if (!ALL.length) init();
    // 每日 Boss 占用自己的固定时段，连锁留在队列等待其它时段。
    const boss = bossFor(st);
    if (boss) return markUsed(st, boss);
    // 1) 强制队列（连锁事件）
    //    规则：条件满足 且（时段匹配 或 已到过期日）→ 播放；条件始终不满足且已过期 → 丢弃
    //    时段不匹配时"延后"而不是硬塞或丢弃，避免「周日早间弹出只该在下班时段发生的邀约」
    const slotKeyNow = SLOT_KEYS[st.slotIdx];
    for (let i = 0; i < st.forced.length; i++) {
      const raw = st.forced[i];
      const item = typeof raw === "string" ? { id: raw, expireDay: 7 } : raw;
      const ev = BY_ID[item.id];
      const expireDay = item.expireDay || 7;
      if (!ev) { st.forced.splice(i, 1); i--; continue; }
      const done = st.usedEvents.includes(item.id) && !ev.repeat;
      const okCond = condOk(ev.cond, st);
      const overdue = st.day > expireDay;
      if (done) { st.forced.splice(i, 1); i--; continue; }
      if (overdue && !okCond) { st.forced.splice(i, 1); i--; continue; }   // 依赖条件始终没满足：放弃
      if (!okCond) continue;                                              // 还可能满足：留到后面的时段
      const slotOk = !ev.slots || ev.slots.includes(slotKeyNow);
      const dayOk = !ev.days || ev.days.includes(st.day);
      const lastChance = st.day >= expireDay || st.day >= 7;
      if ((slotOk && dayOk) || lastChance) {
        st.forced.splice(i, 1);
        return markUsed(st, ev);
      }
      // 时段/日期不匹配：继续等待，但排在其它待播连锁之后
    }
    // 2) 加权随机
    const slotKey = SLOT_KEYS[st.slotIdx];
    const pool = eligiblePool(st, slotKey);
    if (!pool.length) {
      // 严格池空了：从「兜底微事件池」里挑一条，而不是重复一次性剧情。
      // 取舍（500 局实测）：放宽成「本周重复」会让一次性事件重复 2.46 次/周；改成填充池后
      // 一次性事件重复 0 次，且填充事件本身有 6 条 + repeat 上限 + 按「用得最少」优先，
      // 不会像早前那样一周反复刷同一条「无事发生」。
      const fill = pickFiller(st);
      if (fill) return markUsed(st, fill);
      return null;
    }
    const weights = pool.map(e => (e.weight != null ? e.weight : (RARITY_W[e.rarity] || 10)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return markUsed(st, pool[i]);
    }
    return markUsed(st, pool[pool.length - 1]);
  }

  function eligiblePool(st, slotKey) {
    return ALL.filter(e => {
      if (isDailyBoss(e)) return false;
      if (e.scheduledOnly || (e.scheduledOnlyJobs || []).includes(st.char.job)) return false;
      if (st.scheduled.some(x => x.eventId === e.id && x.fireDay > st.day)) return false;
      if (e.pool !== "general" && e.pool !== st.char.job) return false;
      if (e.days && !e.days.includes(st.day)) return false;
      if (e.slots && !e.slots.includes(slotKey)) return false;
      if (!condOk(e.cond, st)) return false;
      if (st.usedToday.includes(e.id)) return false;
      if (st.usedEvents.includes(e.id)) {
        // 数据里声明 repeat: N 的事件可重复出现（如王阿姨、带薪如厕）
        const cap = e.repeat || 0;
        const times = st.counters["rep_" + e.id] || 0;
        if (!cap || times >= cap) return false;
      }
      return true;
    });
  }

  function markUsed(st, ev) {
    if (!st.usedToday.includes(ev.id)) st.usedToday.push(ev.id);
    if (ev.repeat) st.counters["rep_" + ev.id] = (st.counters["rep_" + ev.id] || 0) + 1;
    if (!st.usedEvents.includes(ev.id)) st.usedEvents.push(ev.id);   // 原实现这里重复判了一次，行为等价，简化掉
    return ev;
  }

  // 兜底微事件：不进 ALL、不参与正常抽取，只在严格池为空时用。
  // 策略：今天没出现过 → 优先还没到 repeat 上限的 → 同组内按「本周用得最少」优先（同分随机）
  function pickFiller(st) {
    const all = window.EV_FILLER || [];
    if (!all.length) return null;
    const todayOk = all.filter(e => !st.usedToday.includes(e.id));
    if (!todayOk.length) return null;
    const under = todayOk.filter(e => (st.counters["rep_" + e.id] || 0) < (e.repeat || 1));
    const from = under.length ? under : todayOk;
    const used = e => st.counters["rep_" + e.id] || 0;
    const min = Math.min.apply(null, from.map(used));
    const cands = from.filter(e => used(e) === min);
    return cands[Math.floor(Math.random() * cands.length)];
  }

  // 取当前职级的事件变体；只写了部分职级时返回 null，调用方回退到事件本身
  function variantOf(st, ev) {
    if (!ev.variants) return null;
    return ev.variants[st.char.job] || ev.variants.staff || null;
  }

  function visibleChoices(st, ev) {
    const v = variantOf(st, ev);
    return filterChoices(st, (v && v.choices) || ev.choices);
  }

  // 过滤人设隐藏项与道具门槛（追问轮次复用同一套规则）
  function filterChoices(st, choices) {
    return (choices || []).filter(c => {
      if (c.needItem && !st.items.includes(c.needItem)) return false;
      if (c.hidden) {
        const hs = Array.isArray(c.hidden) ? c.hidden : [c.hidden];
        if (!hs.includes(st.char.persona)) return false;
      }
      return true;
    });
  }

  // 事件标题：允许职级变体覆盖（老板线的标题常常需要换人称）
  function eventTitle(st, ev) {
    const v = variantOf(st, ev);
    return (v && v.title) || ev.title || "";
  }

  function eventLines(st, ev) {
    const v = variantOf(st, ev);
    return (v && v.lines) || ev.lines || [];
  }

  // 发动待命技能（闷声干活 / 背锅拦截 / 拍桌子）
  function armedSkill(st) {
    if (!st.armed) return null;
    if (typeof st.armed === "object") return st.armed;
    // 旧存档只有类型，无法还原点击来源；沿用旧版的匹配顺序。
    const slot = ["persona", "job"].find(key => {
      const src = (key === "job" ? jobOf(st) : personaOf(st)).skill;
      return src && src.arm === st.armed && st.skillUses[key] > 0;
    });
    return slot ? { kind: st.armed, slot } : null;
  }

  function armSkill(st, skillId, slot) {
    if (st.armed) return false;
    const key = slot || ["persona", "job"].find(k => {
      const src = (k === "job" ? jobOf(st) : personaOf(st)).skill;
      return src && src.arm === skillId && st.skillUses[k] > 0;
    });
    if (key !== "job" && key !== "persona") return false;
    const src = (key === "job" ? jobOf(st) : personaOf(st)).skill;
    if (!src || src.arm !== skillId || st.skillUses[key] <= 0) return false;
    st.armed = { kind: skillId, slot: key };
    recordChange(st, { kind: "skill", evId: "__skill_" + src.id,
      title: "【技能】" + src.name, text: "发动【" + src.name + "】（待命）", series: "story", delta: {} });
    return true;
  }

  function personaOf(st) { return window.CHARACTERS.personas[st.char.persona] || {}; }
  function jobOf(st) { return window.CHARACTERS.jobs[st.char.job] || {}; }
  function rulesOf(st) { return personaOf(st).rules || {}; }

  // 通用「任意事件发动」技能：效果、连锁、计数全部来自数据配置
  function useManualAny(st, slot) {
    const src = slot === "job" ? jobOf(st).skill : personaOf(st).skill;
    if (!src || src.trigger !== "manual_any") return null;
    const key = slot === "job" ? "job" : "persona";
    if (st.skillUses[key] <= 0) return null;
    st.skillUses[key]--;
    if (src.counter) st.counters[src.counter] = (st.counters[src.counter] || 0) + 1;
    const before = Object.assign({}, st.stats);
    const delta = {};
    for (const k in (src.effects || {})) {
      if (k === "money") {
        st.stats.money = Math.max(0, Math.min(6, st.stats.money + src.effects[k]));
        delta.money = Math.round((st.stats.money - before.money) * 10) / 10;
      } else {
        st.stats[k] = clampStat(st.stats[k] + src.effects[k]);
        delta[k] = st.stats[k] - before[k];
      }
    }
    if (src.schedule && !st.usedEvents.includes(src.schedule.eventId) &&
        !st.forced.some(x => (typeof x === "string" ? x : x.id) === src.schedule.eventId) &&
        !st.scheduled.some(x => x.eventId === src.schedule.eventId)) {
      const fd = Math.min(7, st.day + src.schedule.afterDays);
      st.scheduled.push({ eventId: src.schedule.eventId, fireDay: fd, expireDay: Math.min(7, fd + 2) });
    }
    st.minMood = Math.min(st.minMood, st.stats.mood);
    if (st.stats.mood <= 0) { st.stats.mood = 0; st.done = true; st.endingId = "exhausted"; }
    recordChange(st, { kind: "skill", evId: "__skill_" + src.id,
      title: "【技能】" + src.name, text: "发动【" + src.name + "】", series: "story", delta,
      counters: src.counter ? [src.counter] : [] });
    return { label: `【${src.name}】发动`, text: src.desc, delta };
  }

  function useItem(st, itemId) {
    const idx = st.items.indexOf(itemId);
    if (idx < 0) return null;
    if (itemId === "coffee") {
      st.items.splice(idx, 1);
      const b = st.stats.mood; st.stats.mood = clampStat(st.stats.mood + 15);
      return itemResult(st, itemId, { label: "☕ 浓缩咖啡", text: "心态 +15。心脏：谢谢你。", delta: { mood: st.stats.mood - b } });
    }
    if (itemId === "cookie") {
      st.items.splice(idx, 1);
      const b = st.stats.bond; st.stats.bond = clampStat(st.stats.bond + 8);
      const bl = st.char.job === "boss" ? "员工士气" : "人缘";
      return itemResult(st, itemId, { label: "🍪 小饼干", text: bl + " +8。分出去的是饼干，收回来的是人心。", delta: { bond: st.stats.bond - b } });
    }
    if (itemId === "report") {
      st.items.splice(idx, 1);
      st.flags.reportShown = true;
      const where = st.char.job === "boss" ? "办公桌最显眼的位置" : "工位最显眼的位置";
      return itemResult(st, itemId, { label: "🩺 体检报告", text: `你把体检报告放在了${where}。本局下一次加班事件的心态损失减半。`, delta: {} });
    }
    if (itemId === "resign") {
      st.items.splice(idx, 1);
      st.flags.resigned = true;
      st.done = true;
      st.endingId = "resign";
      return itemResult(st, itemId, { label: "📄 辞职信", text: "你打出了这张底牌。世界没有崩塌——先崩的是贾总的表情。", delta: {} });
    }
    if (itemId === "exit") {
      // 老板的底牌：不是辞职，是把股份卖掉（endings.js 的老板版 resign =「急流勇退 · 套现离场」）
      st.items.splice(idx, 1);
      st.flags.resigned = true;
      st.done = true;
      st.endingId = "resign";
      return itemResult(st, itemId, { label: "📜 退出协议", text: "你签了字，手都没抖。世界没有崩塌——先崩的是贾总的表情。", delta: {} });
    }
    return null;
  }

  function clampStat(v) { return Math.max(0, Math.min(100, v)); }

  // 选项、主动技能和道具共用流水入口；记录实际增量，供日报和周报统计。
  function recordChange(st, entry) {
    for (const [k, v] of Object.entries(entry.delta || {})) {
      st.dayDelta[k] = (st.dayDelta[k] || 0) + v;
    }
    if (!Array.isArray(st.journal)) st.journal = [];
    st.journal.push(Object.assign({ day: st.day, slot: st.slotIdx, kind: "choice", rarity: "common",
      judged: null, isDui: false, overtime: false, timid: false, round: 0, auto: false,
      cdelta: {}, chain: null, flags: [], counters: [], npc: [], passed: false, kill: !!st.done }, entry));
    if (st.journal.length > 80) st.journal.splice(0, st.journal.length - 80);
    checkAchievements(st);
  }

  function itemResult(st, itemId, result) {
    recordChange(st, { kind: "item", evId: "__item_" + itemId, series: "story",
      title: "【道具】" + window.CHARACTERS.items[itemId].name,
      text: "使用【" + window.CHARACTERS.items[itemId].name + "】", delta: result.delta,
      flags: itemId === "report" ? ["reportShown"] : (st.flags.resigned ? ["resigned"] : []) });
    return result;
  }

  function resolveChoice(st, ev, choice) {
    const before = JSON.parse(JSON.stringify(st.stats));
    const potGangBefore = { pot: st.pot, gang: st.gang, gossip: st.gossip, potPassed: st.counters.potPassed };
    const meta = [];
    let judged = null; // true 成功 / false 失败 / null 无判定
    let reply = "";

    let eff = Object.assign({}, choice.effects || {});
    // 拆出计数器增量
    const effCounters = {};
    for (const k of COUNTER_KEYS) {
      if (eff[k] !== undefined) { effCounters[k] = eff[k]; delete eff[k]; }
    }

    // ---- 判定 ----
    const rules = rulesOf(st);
    const hasItem = !choice.needItem || st.items.includes(choice.needItem);
    if (choice.judge && hasItem) {
      let p = choice.judge.base;
      const pBase = p;                                              // 记录原始成功率，用于"加成是否救了这一把"的提示
      let bonusSrc = "";
      if (rules.judgeBonus) { p = Math.min(0.95, p + rules.judgeBonus); bonusSrc = "【" + (personaOf(st).skill || {}).name + "】被动：判定成功率 +" + Math.round(rules.judgeBonus * 100) + "%"; } // 向上管理
      if (st.items.includes("film") && ev.series === "fish") { p = Math.min(0.95, p + 0.2); bonusSrc = "📵 防窥膜：" + (st.char.job === "boss" ? "自由度类判定 +20%" : "摸鱼类判定 +20%"); } // 防窥膜
      if (st.items.includes("recorder") && choice.judge.evidence === true) {
        p = 1; bonusSrc = "🎤 录音笔：证据类判定必成";
      }
      const roll = Math.random();
      judged = roll < p;
      // 只有"没这个加成就会失败"时才提示，避免刷屏
      if (judged && bonusSrc && p > pBase) {
        if (roll >= pBase) meta.push(bonusSrc + "——差一点就翻车，它把你捞回来了。");
      }
      const armed = armedSkill(st);
      if (!judged && armed && armed.kind === "forceJudge" && st.skillUses[armed.slot] > 0) {
        // 拍桌子：当场翻盘，本次判定强制成功
        st.skillUses[armed.slot]--;
        st.armed = null;
        judged = true;
        meta.push("【拍桌子】发动：桌子一响，道理就站在了你这边。");
      }
      const sub = judged ? "success" : "fail";
      // 必须拷贝：下面要 delete 计数器键，直接改会污染共享的事件数据（同一局内二次触发即失效）
      const subEff = Object.assign({}, choice.judge[sub + "Effects"] || {});
      for (const k of COUNTER_KEYS) {
        if (subEff[k] !== undefined) { effCounters[k] = (effCounters[k] || 0) + subEff[k]; delete subEff[k]; }
      }
      Object.assign(eff, subEff);
      reply = choice.judge[sub + "Reply"] || choice.reply || "";
      if (!judged && choice.failFlag) st.flags[choice.failFlag] = true;
    } else {
      reply = choice.reply || "";
    }

    // ---- 技能修正（发动型待命） ----
    let potDeltaTop = (choice.pot || 0);
    const armed = armedSkill(st);
    let silentName = null;
    if (armed && armed.kind === "silent" && ev.series === "blame") {
      const key = st.skillUses[armed.slot] > 0 ? armed.slot : null;
      if (key && (eff.kpi < 0 || potDeltaTop > 0)) {
        if (eff.kpi < 0) { eff.mood = (eff.mood || 0) + eff.kpi; eff.kpi = 0; }
        st.skillUses[key]--;
        silentName = key === "persona" ? personaOf(st).skill.name : jobOf(st).skill.name;
      }
      st.armed = null;
    }
    if (armed && armed.kind === "intercept" && ev.series === "blame") {
      const potAdd = potDeltaTop + (effCounters.pot || 0);
      if (potAdd > 0) {
        const key = armed.slot;
        if (st.skillUses[key] > 0) {
          potDeltaTop = 0;
          effCounters.pot = 0;
          eff.bond = (eff.bond || 0) - 10;
          st.skillUses[key]--;
          const nm = key === "persona" ? personaOf(st).skill.name : jobOf(st).skill.name;
          meta.push(`【${nm}】发动：锅在空中被你优雅转移（团队士气 -10）。`);
        }
      }
      st.armed = null;
    }
    // 体检报告：加班类事件心态损失减半（一次性）
    if (st.flags.reportShown && ev.series === "overtime" && (eff.mood || 0) < 0) {
      eff.mood = Math.ceil(eff.mood / 2);
      st.flags.reportShown = false;
      meta.push("🩺 体检报告：加班的心态损失减半（一次性）。");
    }
    // 周五 Boss 汇报收益倍率（PPT大法）
    if (rules.bossReportMul && ev.id === "ev_boss_fri") {
      let boosted = false;
      for (const k of ["kpi", "trust"]) {
        if (eff[k] > 0) { eff[k] = Math.round(eff[k] * rules.bossReportMul); boosted = true; }
      }
      if (boosted) meta.push("【PPT大法】被动：汇报收益 +50%。");
    }
    // 每天第一次人缘收益倍率（向上管理）
    if (rules.firstBondMul && !st.firstBondDone && eff.bond > 0) {
      eff.bond = eff.bond * rules.firstBondMul;
      st.firstBondDone = true;
      meta.push("【向上管理】今天第一次人缘收益 ×2。");
    }
    // 上级信任收益倍率（抱大腿）
    if (rules.trustMul && eff.trust > 0) {
      eff.trust = Math.round(eff.trust * rules.trustMul);
      meta.push("【抱大腿】被动：上级信任收益 +50%。");
    }

    // ---- 致命保护（规则驱动） ----
    const potTotal = potDeltaTop + (effCounters.pot || 0);
    const moodAfter = st.stats.mood + (eff.mood || 0);
    const kpiAfter = st.stats.kpi + (eff.kpi || 0);
    const lethal = moodAfter <= 0 || (eff.kpi <= -10 && kpiAfter < 25);
    if (lethal && rules.saveLethal && st.skillUses.persona > 0) {
      st.skillUses.persona--;
      st.flags.jinSaved = true;
      for (const k of ["mood", "kpi", "bond", "trust", "fish"]) {
        if (eff[k] < 0) eff[k] = 0;
      }
      if (effCounters.pot < 0) effCounters.pot = 0;
      meta.push(`【${personaOf(st).skill.name}】发动：一通神秘电话，替你挡下了这一击。`);
    } else if (lethal && moodAfter <= 0 && rules.moodGuard && st.skillUses.persona > 0) {
      st.skillUses.persona--;
      eff.mood = rules.moodGuard - st.stats.mood;
      st.counters.duiWins++;
      meta.push(`【${personaOf(st).skill.name}】发动：心态稳在 ${rules.moodGuard}，顺便回敬了一个白眼。`);
    }

    // ---- 应用属性 ----
    const delta = {};
    for (const k of STAT_KEYS) {
      if (eff[k]) {
        st.stats[k] = clampStat(st.stats[k] + eff[k]);
        delta[k] = st.stats[k] - before[k];
      }
    }
    if (eff.money) {
      const b = st.stats.money;
      st.stats.money = Math.max(0, Math.min(6, st.stats.money + eff.money));
      delta.money = Math.round((st.stats.money - b) * 10) / 10;
    }
    // ---- 计数器与旗标 ----
    // 老实巴交的「背锅体质」：只要沾上锅，就比谁都多背一口（对应人设台词）
    if (potTotal) {
      const extra = rulesOf(st).potMagnet ? 1 : 0;
      st.pot = Math.max(0, st.pot + potTotal + extra);
    }
    if (silentName) {
      const added = st.pot - potGangBefore.pot;
      meta.push(`【${silentName}】发动：KPI 保住了，心态替你顶了锅，黑锅 ${added > 0 ? "+" : ""}${added}。`);
    }
    if (choice.gang) st.gang += choice.gang;
    if (choice.gossip) st.gossip += choice.gossip;
    for (const k in effCounters) {
      if (k === "pot") continue;      // 黑锅已在 potTotal 里结算过，这里再算会翻倍
      st[k] = (st[k] || 0) + effCounters[k];
    }
    if (choice.counter) {
      const cs = Array.isArray(choice.counter) ? choice.counter : [choice.counter];
      cs.forEach(c => { st.counters[c] = (st.counters[c] || 0) + 1; });
    }
    if (choice.npc) {
      for (const k in choice.npc) st.npc[k] = (st.npc[k] || 0) + choice.npc[k];
    }
    if (choice.flag) st.flags[choice.flag] = true;
    if (choice.item && !st.items.includes(choice.item)) st.items.push(choice.item);
    if (choice.overtime === true) st.counters.overtimeStreak++;
    if (choice.overtime === false) st.counters.overtimeStreak = 0;
    // 硬刚成功判定：显式 isDui（不再拿 gang 兼职，避免「加了刚值却没算硬刚」的歧义）
    const isDui = choice.isDui !== undefined ? !!choice.isDui : false;
    if (isDui && judged !== false) st.counters.duiWins++;
    // 甩锅乒乓球：锅被成功转手 3 次 → 解锁成就旗标
    if (ev.series === "blame" && isDui && judged === true) {
      st.counters.potPassed++;
      if (st.counters.potPassed >= 2) st.flags.pingpong = true;   // 3 次在全游戏范围内几乎凑不齐
    }
    // 周报文学家：周五 Boss 正向收益
    if (ev.id === "ev_boss_fri" && ((delta.trust || 0) > 0 || (delta.kpi || 0) > 0)) st.flags.weeklyPerfect = true;
    // 连锁排程（带过期日：最多等 2 天，到期即使时段不匹配也照播，保证内容不丢）
    if (choice.chain && !st.usedEvents.includes(choice.chain.id)) {
      const fireDay = Math.min(7, st.day + choice.chain.afterDays);
      st.scheduled.push({ eventId: choice.chain.id, fireDay, expireDay: Math.min(7, fireDay + 2) });
    }

    // ---- 心态归零 ----
    st.minMood = Math.min(st.minMood, st.stats.mood);
    if (st.stats.mood <= 0) {
      st.stats.mood = 0;
      st.done = true;
      st.endingId = "exhausted";
    }

    // ---- 决策流水（周报回顾用）：谁、哪天、哪个时段、选了什么、代价是什么 ----
    recordChange(st, {
      day: st.day, slot: st.slotIdx,
      evId: ev.id, title: eventTitle(st, ev), series: ev.series, rarity: ev.rarity || "common",
      text: choice.text,
      judged: judged,                       // true 判定成功 / false 失败 / null 无判定
      isDui: isDui, overtime: choice.overtime === true, timid: !!choice.timid,
      round: 0, auto: false,                // 由 main.js 在回合结束时补上追问轮次与超时标记
      delta: delta,                         // 属性增量（mood/kpi/bond/trust/fish/money）
      cdelta: {                             // 计数器增量
        pot: st.pot - potGangBefore.pot,
        gang: st.gang - potGangBefore.gang,
        gossip: st.gossip - potGangBefore.gossip
      },
      // 「影响了后续」的证据：周报只挑这些来讲
      chain: choice.chain ? choice.chain.id : null,
      flags: choice.flag ? [choice.flag] : [],
      counters: choice.counter ? (Array.isArray(choice.counter) ? choice.counter : [choice.counter]) : [],
      npc: choice.npc ? Object.keys(choice.npc) : [],
      passed: ((st.counters.potPassed || 0) - (potGangBefore.potPassed || 0)) > 0,   // 甩锅成功：锅被转手
      kill: !!st.done
    });

    return { reply, judged, meta, delta, followup: choice.followup || null };
  }

  function endDay(st) {
    // 周三活下来
    if (st.day === 3) st.flags.surviveWed = true;
    // 睡一觉，心态小幅回血（牛马也要喘口气）
    const b = st.stats.mood;
    st.stats.mood = clampStat(st.stats.mood + 6);
    if (st.stats.mood > b) st.minMood = Math.min(st.minMood, st.stats.mood);
    // 连锁引爆检查
    st.day += 1;
    st.slotIdx = 0;
    st.usedToday = [];
    st.firstBondDone = false;
    st.dayDelta = {};
    st.dayAchievements = [];
    const due = st.scheduled.filter(s => s.fireDay <= st.day);
    st.scheduled = st.scheduled.filter(s => s.fireDay > st.day);
    due.forEach(x => {
      if (!st.forced.some(y => (typeof y === "string" ? y : y.id) === x.eventId)) {
        st.forced.push({ id: x.eventId, expireDay: x.expireDay || Math.min(7, (x.fireDay || st.day) + 2) });
      }
    });
    checkAchievements(st);
  }

  // ---------- 绩效分与评级（互联网刻度：3.75 / 3.5 / 3.25） ----------
  // 五维加权算综合分（0~5 分制），再按档位映射到 S/A/B/C/D
  function perfScore(st) {
    const s = st.stats;
    const isBoss = st.char.job === "boss";
    // 老板的档位只看经营面：自由度（授权程度）不该压分——
    // 否则「充分授权 · 我不进办公室」这条褒义结局会被自己的评分系统惩罚。
    const base = isBoss
      ? s.kpi * 0.35 + s.trust * 0.30 + s.bond * 0.20 + s.mood * 0.15
      : s.kpi * 0.40 + s.trust * 0.25 + s.bond * 0.15 + s.mood * 0.10 + (100 - s.fish) * 0.10;
    let score = base / 20;
    score -= st.pot * (isBoss ? 0.02 : 0.06);                // 背过的锅（老板线叫「担当」，只轻微影响）
    if (!isBoss && st.flags.caughtFish) score -= 0.04;       // 摸鱼被抓（老板没有这个判定）
    if (st.counters.overtimeStreak >= 4) score -= isBoss ? 0.03 : 0.05;   // 连轴转
    if (st.flags.promisedReport) score += 0.03;              // 答应过的活按时交
    return Math.round(Math.max(2.5, Math.min(4.0, score)) * 100) / 100;
  }

  const GRADE_BANDS = [
    { grade: "S", label: "3.75", min: 3.75, max: 5 },
    { grade: "A", label: "3.5+", min: 3.55, max: 3.75 },
    { grade: "B", label: "3.5", min: 3.45, max: 3.55 },
    { grade: "C", label: "3.5-", min: 3.25, max: 3.45 },
    { grade: "D", label: "3.25", min: 0, max: 3.25 }
  ];

  // 结局语义约束：评级既要看综合分，也要看你这周到底活成了什么样
  function applyEndingBounds(score, ending) {
    if (ending) {
      if (ending.gradeCap) {
        const b = GRADE_BANDS.find(x => x.grade === ending.gradeCap);
        if (b) score = Math.min(score, b.max - 0.01);
      }
      if (ending.gradeFloor) {
        const b = GRADE_BANDS.find(x => x.grade === ending.gradeFloor);
        if (b) score = Math.max(score, b.min);
      }
    }
    return Math.round(Math.max(2.5, Math.min(5, score)) * 100) / 100;
  }

  function gradeOf(score) {
    const b = GRADE_BANDS.find(x => score >= x.min && score < x.max) || GRADE_BANDS[GRADE_BANDS.length - 1];
    return { grade: b.grade, label: b.label };
  }

  // ============================================================
  // 老板专属评级：没有档位分，只有形容词，而且永远没有差评
  // 讽刺点：老板怎么做都是对的——公司倒了叫「战略性重组」，人走光了叫「组织效率提升」
  // ============================================================
  const BOSS_BANDS = [
    { grade: "S", word: "非常好", min: 3.75, max: 99, note: "董事会：「超出预期。」（你把明年的收入记在了今年）" },
    { grade: "A", word: "很好", min: 3.50, max: 3.75, note: "董事会：「稳健。」（你只是没犯错，但这句话不用写进公开信）" },
    { grade: "B", word: "好", min: 3.25, max: 3.50, note: "董事会：「辛苦了。」（公司还活着，人走了三成）" },
    { grade: "C", word: "挺好", min: -99, max: 3.25, note: "董事会：「方向是对的，只是节奏问题。」（先把分红发了）" }
  ];

  // 结局再糟，评语也能圆回来
  const BOSS_SPIN = {
    boss_win: "对外口径：「超额完成年度目标。」",
    promotion: "对外口径：「从优秀走向卓越。」",
    exhausted: "你凌晨三点在会议室倒下了，公告写的是「连续奋战后的短暂休整」。",
    n_plus_1: "团队被优化到只剩你，评语是「组织效率显著提升」。",
    fall_guy: "你成了全公司最大的一口锅，评语是「敢于担当」。",
    normal: "全年无亮点，评语是「稳中有进」——虽然并没有进。",
    lie_flat: "你半年没出现在办公室，评语是「充分授权、抓大放小」。",
    crazy_famous: "你的发疯视频上了热搜，评语是「个人品牌为公司带来巨大曝光」。",
    sweeper: "你和保洁阿姨聊了一周，评语是「深入一线、贴近群众」。",
    hop_job: "猎头把你挖走了，评语是「人才输出，行业影响力提升」。",
    resign: "你把股份卖给了下一位梦想家，评语是「成功退出，行业典范」。",
    zhen_win: "员工集体仲裁，评语是「推动行业用工规范」。"
  };

  function bossGradeOf(score, ending) {
    const b = BOSS_BANDS.find(x => score >= x.min && score < x.max) || BOSS_BANDS[BOSS_BANDS.length - 1];
    const spin = (ending && BOSS_SPIN[ending.id]) || "";
    return { grade: b.grade, word: b.word, note: b.note, spin };
  }

  // ============================================================
  // 中层专属：约 30% 的绩效根本不由你决定
  // 讽刺点：中层的能力不如站队、不如手气、不如副总有没有离职
  // ============================================================
  const MID_LUCK_CHANCE = 0.30;
  const MID_LUCK = [
    { id: "camp_wrong", text: "站队错误：你力挺的那位副总，这周被调去了「创新孵化业务」。", delta: -0.16 },
    { id: "boss_left", text: "靠山离职：挺你的副总提了离职，新来的 VP 带来了自己的嫡系。", delta: -0.19 },
    { id: "golf", text: "高尔夫事故：陪老板打球时，你不小心赢了两杆。", delta: -0.21 },
    { id: "mahjong", text: "麻将手气：团建麻将你连胡三把，赢了老板 380 元。", delta: -0.23 },
    { id: "moments", text: "朋友圈翻车：加班动态没屏蔽老板，也没屏蔽老板的对家。", delta: -0.12 },
    { id: "late_intro", text: "自我介绍：新 VP 到岗那天你在开会，错过了全员介绍。", delta: -0.11 },
    { id: "credit_gone", text: "署名问题：你的名字被写进了别人的上报邮件，且排在最后一位。", delta: -0.14 },
    { id: "name_wrong", text: "花名册乌龙：HR 把你的汇报线画到了隔壁部门。", delta: -0.09 },
    { id: "elevator", text: "电梯巧遇：你帮投资人按了楼层，还顺口聊了两句行业趋势。", delta: 0.16 },
    { id: "stand_in", text: "临时代班：老板临时缺席，你替他讲完了那页 PPT，讲得比他还好。", delta: 0.14 }
  ];

  function rollMidLuck() {
    if (Math.random() >= MID_LUCK_CHANCE) return null;
    return MID_LUCK[Math.floor(Math.random() * MID_LUCK.length)];
  }

  // 结算用：算出最终绩效 + 评级（按职级走三套体系）
  function finalGrade(st, ending) {
    let base = perfScore(st);
    // 中层：先叠运气，再受结局约束（否则会出现「毕业大礼包 + A 档」的矛盾）
    let luck = null;
    if (st.char.job === "mid") {
      luck = st.luck === undefined ? null : st.luck;
      if (luck) base = Math.round(Math.max(2.5, Math.min(5, base + luck.delta)) * 100) / 100;
    }
    base = applyEndingBounds(base, ending);
    // 老板：只给形容词，没有数字，也没有差评
    if (st.char.job === "boss") {
      const b = bossGradeOf(base, ending);
      return { score: base, grade: b.grade, label: b.word, word: b.word, note: b.note, spin: b.spin, numeric: false, luck: null };
    }
    const g = gradeOf(base);
    return { score: base, grade: g.grade, label: g.label, numeric: true, luck };
  }

  // ---------- 结局 ----------
  function computeEnding(st) {
    if (st.endingId) return st.endingId;
    const s = st.stats;
    if (st.char.job === "boss" && s.kpi >= 62 && s.trust >= 75 && s.bond >= 35) return "boss_win";
    // 变态老板的签名路径：本周做过硬核压榨动作（hardline，均为 biantai 专属选项），或把士气压垮
    if (st.char.job === "boss" && (st.flags.hardline || s.bond < 25)) return "n_plus_1";
    if (s.kpi >= 85 && s.trust >= 80) return "promotion";
    // 「充分授权」只在数字撑得住时才算褒义：一线/中层怕被抓摸鱼，
    // 老板没有 caughtFish 这个风险，若不加约束，老板线会被 lie_flat 一家吞掉（实测 600/600）。
    if (s.fish >= 85 && !st.flags.caughtFish) {
      if (st.char.job !== "boss" || (s.kpi >= 50 && s.bond >= 35)) return "lie_flat";
    }
    if (st.flags.tookLisa && s.kpi >= 60) return "hop_job";
    if (rulesOf(st).rebel && st.gang >= 4 && s.kpi >= 35 && s.trust <= 45) return "zhen_win";
    if (st.flags.crazyFamous) return "crazy_famous";
    if (st.counters.wangTalks >= 2 && s.mood < 35) return "sweeper";
    // 老实巴交的签名路径：锅攒够就是「敢于担当」。不要求信任低——他越顺从，领导越信任他（实测中位 73）
    if (rulesOf(st).potMagnet && st.pot >= 2) return "fall_guy";
    if (st.pot >= 2 && s.trust < 45) return "fall_guy";
    if (s.kpi < 50) return "n_plus_1";
    return "normal";
  }

  // ---------- 成就 ----------
  function parseTest(t) {
    // 形如 "fishToilet>=3" / "flag xxx" / "ending xxx" / "minMood>=50"
    const m = t.match(/^(\w+)(>=|<=|>|<)(\d+(?:\.\d+)?)$/);   // 支持小数（存款/私房钱按月薪计）
    if (m) return { kind: "stat", key: m[1], op: m[2], val: Number(m[3]) };
    if (t.startsWith("flag ")) return { kind: "flag", key: t.slice(5) };
    if (t.startsWith("ending ")) return { kind: "ending", key: t.slice(7) };
    return null;
  }

  function statValue(st, key) {
    if (key === "minMood") return st.minMood;
    if (key in st.stats) return st.stats[key];
    if (key in st.counters) return st.counters[key];
    if (key === "pot") return st.pot;
    if (key === "gang") return st.gang;
    if (key === "gossip") return st.gossip;
    return 0;
  }

  // 该角色适用的成就清单：通用成就 + 本场人设的专属/签名成就
  function achievementsFor(st) {
    const isBoss = st.char.job === "boss";
    return window.ACHIEVEMENTS
      .filter(a => (!a.persona || a.persona === st.char.persona) && (!a.job || a.job === st.char.job))
      // 老板线改名：同一套判定，员工语态的成就换成老板口径（bossName/bossDesc）
      .map(a => (isBoss && (a.bossName || a.bossDesc))
        ? Object.assign({}, a, { name: a.bossName || a.name, desc: a.bossDesc || a.desc })
        : a);
  }

  function checkAchievements(st, stage = "process") {
    const unlocked = [];
    for (const a of achievementsFor(st)) {
      if (st.achievements.includes(a.id)) continue;
      if (a.stage === "final" && stage !== "final") continue;
      const t = parseTest(a.test);
      if (!t) continue;
      let ok = false;
      if (t.kind === "flag") ok = !!st.flags[t.key];
      else if (t.kind === "ending") ok = st.endingId === t.key;
      else {
        const v = statValue(st, t.key);
        ok = t.op === ">=" ? v >= t.val : t.op === "<=" ? v <= t.val : t.op === ">" ? v > t.val : v < t.val;
      }
      if (ok) {
        st.achievements.push(a.id);
        if (!Array.isArray(st.dayAchievements)) st.dayAchievements = [];
        st.dayAchievements.push(a.id);
        unlocked.push(a);
      }
    }
    return unlocked;
  }

  function finalAchievements(st) {
    if (!st.done) return checkAchievements(st);
    if (!st.flags.resigned) st.flags.resignUnused = true;
    return checkAchievements(st, "final");
  }

  // 手动技能可用性（人设技能 + 职级技能，规则全部来自数据）
  function manualSkills(st, ev) {
    const list = [];
    const add = (src, slot, uses) => {
      if (!src || uses <= 0) return;
      if (src.trigger === "manual_any") {
        list.push({ slot, id: src.id, name: src.name, emoji: src.emoji, desc: src.desc, arm: null });
      } else if (src.trigger === "manual_blame" && ev && ev.series === "blame") {
        const armed = armedSkill(st);
        list.push({ slot, id: src.id, name: src.name, emoji: src.emoji, desc: src.desc, arm: src.arm || "silent", armed: !!armed && armed.slot === slot && armed.kind === src.arm });
      }
    };
    add(personaOf(st).skill, "persona", st.skillUses.persona);
    add(jobOf(st).skill, "job", st.skillUses.job);
    return list;
  }

  // 人设专属结局：签名结局覆盖（整段换文案）+ 人设专属收尾台词（win/lose 由评级决定）
  function applyPersonaEnding(st, ending) {
    const pid = st.char.persona;
    let out = Object.assign({}, ending);
    const ov = (window.PERSONA_ENDING_OVERRIDE || {})[pid];
    if (ov && ov[out.id]) out = Object.assign(out, ov[out.id]);
    const ep = (window.PERSONA_EPILOGUE || {})[pid];
    if (ep) {
      const win = st.char.job === "boss"
        ? ["非常好", "很好"].indexOf(out.bossWord) >= 0
        : ["S", "A", "B"].indexOf(out.grade) >= 0;
      out.epilogue = win ? ep.win : ep.lose;
      out.epilogueWin = win;
    }
    return out;
  }

  // 1 个月薪 = 16800 元（UI 用「个月薪」显示，文案金额按此换算，避免「17 块 ↔ 半月薪」这类矛盾）
  const WAGE_YUAN = 16800;

  return {
    WAGE_YUAN,
    init, byId, pickEvent, resolveChoice, endDay, computeEnding,
    applyPersonaEnding,
    checkAchievements, finalAchievements, achievementsFor, useItem, useManualAny, armSkill,
    manualSkills, visibleChoices, filterChoices, eventLines, eventTitle, variantOf, personaOf, jobOf,
    perfScore, finalGrade, GRADE_BANDS, BOSS_BANDS, MID_LUCK, rollMidLuck,   // perfScore/MID_LUCK 供平衡调试
    slotsThisDay, isDailyBoss,
    SLOT_KEYS, SLOT_LABELS, DAY_NAMES
  };
})();
