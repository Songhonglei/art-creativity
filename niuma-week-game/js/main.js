// 牛马求生记 · 主流程
window.App = (function () {
  const st = () => window.GameState.data;
  let currentEvent = null;

  function boot() {
    window.Engine.init();
    document.getElementById("btn-new").addEventListener("click", () => {
      window.UI.renderCreate();
      window.UI.showScreen("screen-create");
    });
    document.getElementById("btn-continue").addEventListener("click", () => {
      if (window.GameState.load()) { enterMain(); resumeTurn(); }
    });
    document.getElementById("btn-settings").addEventListener("click", () => {
      window.UI.showSettings(() => {
        window.UI.confirmAction("确定放弃本周，重新开始吗？", "当前存档将被覆盖。", () => {
          window.GameState.clear();
          window.UI.showScreen("screen-title");
          window.UI.refreshTitle();
        });
      });
    });
    document.getElementById("err-skip").addEventListener("click", () => {
      window.UI.hideErrorBanner();
      try { skip(); } catch (e) { onFatal(e, "recover"); }
    });
    document.getElementById("err-home").addEventListener("click", () => {
      window.UI.hideErrorBanner();
      window.UI.showScreen("screen-title");
      window.UI.refreshTitle();
    });
    document.getElementById("btn-last-ending").addEventListener("click", showLastEnding);
    // 任何未被捕获的异常/未处理的 Promise 拒绝都会走到这里，给出可见提示而不是静默卡死
    window.addEventListener("error", (e) => onFatal(e.error || new Error(e.message || "未知错误"), "runtime"));
    window.addEventListener("unhandledrejection", (e) => onFatal(e.reason || new Error("Promise 异常"), "promise"));
    window.UI.refreshTitle();
  }

  // ---- 全局错误边界 ----
  // 错误账本：被这里 catch 掉的异常既不冒泡到 window.onerror，也不进 CDP 的
  // exceptionThrown —— 之前 deltaChips 的 ReferenceError 就是这样静默地变成"流程卡死"。
  // 记一笔既方便自动化断言，也方便线上排查。
  window.__appErrors = window.__appErrors || [];
  let lastFatalAt = 0;
  function onFatal(err, where) {
    const now = Date.now();
    const msg0 = err && err.message ? err.message : String(err);
    window.__appErrors.push({ where, message: msg0, at: new Date().toISOString() });
    if (window.__appErrors.length > 50) window.__appErrors.shift();   // 只留最近 50 条
    if (now - lastFatalAt < 1500) return;          // 防抖：错误风暴只提示一次
    lastFatalAt = now;
    try { console.error("[牛马求生记]", where, err); } catch (e) { /* 忽略 */ }
    const msg = err && err.message ? err.message : String(err);
    try { window.UI.showErrorBanner(`${where} · ${msg}`); } catch (e) { /* 最坏情况：连提示都画不出来 */ }
  }

  // 关键流程统一包一层：异常不再中断游戏，而是变成可见提示 + 恢复入口
  function guarded(name, fn) {
    return function (...args) {
      try { return fn.apply(this, args); }
      catch (err) { onFatal(err, name); }
    };
  }

  function newGame(cfg) {
    window.GameState.fresh(cfg);
    enterMain();
    // 周一开场：新的一周，进入状态
    window.UI.showDayTransition(st(), "start", nextSlot);
  }

  function enterMain() { window.UI.showScreen("screen-main"); }
  function statLabels() { return window.UI.statLabels(st().char.job); }
  function updateTopbar() { window.UI.updateTopbar(st()); }

  function filler() {
    return {
      id: "__filler" + Math.random(), series: "fish", pool: "general", rarity: "common",
      title: "【平静】无事发生", scene: "im",
      lines: ["这段时间风平浪静，群里没人@你。", "你摸了一条鱼，无人知晓。"],
      choices: [{ text: "静静享受这一刻", effects: { fish: 4, mood: 2 }, reply: "平静，是牛马最贵的奢侈品。" }]
    };
  }

  function nextSlot() {
    const s = st();
    updateTopbar();
    if (s.done) { finishWeek(); return; }
    if (s.slotIdx >= window.Engine.slotsThisDay(s.day)) {
      if (s.day >= 7) { finishWeek(); return; }
      window.UI.showDayReport(s, () => {
        const from = s.day;
        window.Engine.endDay(s);          // 进入新的一天
        window.GameState.save();
        if (from === 5) {
          window.UI.showDayTransition(s, "overtime", nextSlot);   // 周五 → 周六：加班日
        } else if (s.day === 7) {
          window.UI.showDayTransition(s, "final", nextSlot);      // 周日：本周最后一天
        } else {
          window.UI.showDayTransition(s, "normal", nextSlot);
        }
      });
      return;
    }
    let ev = window.Engine.pickEvent(s);
    if (!ev) ev = filler();
    currentEvent = ev;
    pendingFollowup = null;
    round = 0;
    activeChoices = window.Engine.visibleChoices(s, ev);
    // 回合落盘：刷新页面后能回到同一题，而不是重抽（也防止用刷新重复领收益）
    s.turn = { eventId: ev.id, round: 0, pendingFollowup: null };
    window.GameState.save();
    window.UI.renderEvent(s, ev, activeChoices);
  }

  let pendingFollowup = null;   // 当前事件待展开的追问
  let round = 0;                // 追问轮次
  let activeChoices = [];       // 当前生效的选项表（首轮=事件选项，追问轮=追问选项）

  let autoPick = false;          // 由 timeout() 置位：标记这一次是超时自动作答

  function choose(i) {
    const s = st();
    // 回合幂等：结算后立刻清空当前选项表，任何重复点击/超时回调都取不到选项 → 直接返回
    const ch = activeChoices[i];
    if (!ch) return;
    activeChoices = [];
    const res = window.Engine.resolveChoice(s, currentEvent, ch);
    // 决策流水补记：这是第几轮追问、是否超时自动作答
    const j = s.journal && s.journal[s.journal.length - 1];
    if (j) { j.round = round; if (autoPick) j.auto = true; }
    autoPick = false;
    pendingFollowup = res.followup || null;
    // 防御：追问最多 2 轮，避免数据写成环路
    if (pendingFollowup && round >= 2) pendingFollowup = null;
    if (pendingFollowup) {
      // 还有追问：时段先不推进，把追问轮次写进存档
      s.turn = { eventId: currentEvent.id, round: round + 1, pendingFollowup: pendingFollowup };
    } else {
      // 本时段作答完毕：立刻推进并落盘（刷新不会重放同一时段）
      s.slotIdx++;
      s.turn = null;
    }
    if (s.done) settleWeek();  // 致命回复尚未关闭也要保存完整结局，刷新可回看。
    window.GameState.save();
    window.UI.renderSidebar(s);
    window.UI.showReply(currentEvent, ch, res);
  }

  function timeout() {
    if (!activeChoices.length) return;        // 已作答完毕：倒计时回调直接失效
    let idx = activeChoices.findIndex(c => c.timid);
    if (idx < 0) idx = 0;
    autoPick = true;                          // 周报里标成「超时未答，系统替你怂了」
    choose(idx);
  }

  function afterReply() {
    const s = st();
    if (s.done) { finishWeek(); return; }
    // 一题答完，接着出下一题（同一个事件内）
    if (pendingFollowup) {
      const fb = pendingFollowup;
      pendingFollowup = null;
      round++;
      activeChoices = window.Engine.filterChoices(s, fb.choices);
      window.UI.renderFollowupRound(s, currentEvent, fb, round, activeChoices);
      return;
    }
    round = 0;
    activeChoices = [];
    window.GameState.save();
    nextSlot();
  }

  // 续玩：优先恢复存档里的当前回合（事件 + 追问轮），否则抽下一个时段
  function resumeTurn() {
    const s = st();
    if (s.done) { finishWeek(); return; }
    const t = s.turn;
    const ev = t && t.eventId ? window.Engine.byId(t.eventId) : null;
    if (ev) {
      currentEvent = ev;
      round = t.round || 0;
      activeChoices = window.Engine.visibleChoices(s, ev);
      window.UI.renderEvent(s, ev, activeChoices);
      if (t.pendingFollowup) {
        const fb = t.pendingFollowup;
        activeChoices = window.Engine.filterChoices(s, fb.choices);
        window.UI.renderFollowupRound(s, ev, fb, round, activeChoices);
      }
      pendingFollowup = null;   // 已渲染，等玩家作答
      return;
    }
    nextSlot();
  }

  // 兜底：事件没有任何可见选项时，直接进入下一时段，避免流程锁死
  function skip() {
    const s = st();
    s.slotIdx++;
    s.turn = null;
    pendingFollowup = null;
    round = 0;
    activeChoices = [];
    window.GameState.save();
    nextSlot();
  }

  function useItem(id) {
    const s = st();
    const r = window.Engine.useItem(s, id);
    if (!r) return;
    window.GameState.save();
    window.UI.renderSidebar(s);
    if (s.done) { finishWeek(); return; }
    miniToast(r.label + " " + r.text);
  }

  function useSkill(slot, ev) {
    const s = st();
    if (slot === "job" || slot === "persona") {
      const key = slot === "job" ? "job" : "persona";
      const src = key === "job" ? window.Engine.jobOf(s).skill : window.Engine.personaOf(s).skill;
      if (src && src.trigger === "manual_any") {
        const r = window.Engine.useManualAny(s, slot);
        if (r) {
          if (s.done) { window.GameState.save(); finishWeek(); return; }
          window.GameState.save();
          window.UI.renderSidebar(s);
          window.UI.renderSkillBar(s, ev);
          miniToast(r.label + " " + r.text);
        }
        return;
      }
      const armKind = (src && src.arm) || "silent";
      const ok = window.Engine.armSkill(s, armKind, slot);
      if (ok) {
        window.GameState.save();
        window.UI.renderSidebar(s);
        window.UI.renderSkillBar(s, ev);
        miniToast(`⏳ 【${src.name}】已待命：下一个甩锅事件中自动生效。`);
      }
    }
  }

  // 回看上一次结局（刷新或重开后仍可查看 / 重新保存分享卡）
  // 本周周报回顾
  function showReview() {
    window.UI.showReview(st());
  }

  function showLastEnding() {
    const rec = window.GameState.loadLastEnding();
    if (!rec) { window.App.miniToast("没有找到结局记录"); return; }
    window.UI.showEnding(rec.st, rec.ending, { readOnly: true });
  }

  function settleWeek() {
    const s = st();
    s.done = true;
    s.endingId = s.endingId || window.Engine.computeEnding(s);
    let base = window.ENDINGS.find(e => e.id === s.endingId) || window.ENDINGS[0];
    // 老板线：换成老板视角的结局名与文案（自信、专横、把失败说成战略）
    if (s.char.job === "boss" && base.boss) {
      base = Object.assign({}, base, { name: base.boss.name, text: base.boss.text });
    }
    // 中层：约 30% 的绩效由运气决定（掷一次并存档，避免重掷）
    if (s.char.job === "mid" && s.luck === undefined) {
      s.luck = window.Engine.rollMidLuck();
    }
    // 绩效分（3.75 / 3.5 / 3.25 刻度）+ 结局语义约束 → 最终评级
    const g = window.Engine.finalGrade(s, base);
    s.perfScore = g.score;              // 内部测算分（连续值，仅存档记录）
    s.grade = g.grade;
    s.gradeLabel = g.label;             // 一线/中层对外展示值：3.75 / 3.5+ / 3.5 / 3.5- / 3.25
    // 界面只展示档位值，避免「3.24 分 · 3.25 档」这种自相矛盾的读感；老板线则只给形容词
    let ending = Object.assign({}, base, {
      grade: g.grade, gradeLabel: g.label, perf: g.label, perfRaw: g.score,
      numeric: g.numeric, bossWord: g.word, bossNote: g.note, bossSpin: g.spin, luck: g.luck
    });
    // 人设层：签名结局换整套文案 + 追加该人设的专属收尾台词
    ending = window.Engine.applyPersonaEnding(s, ending);
    window.Engine.finalAchievements(s);
    window.GameState.save();
    // 额外存一份「结局快照」：即使 done 存档不可续玩，也让结局页可以回看
    window.GameState.saveLastEnding(JSON.parse(JSON.stringify(s)), ending);
    return ending;
  }

  function finishWeek() {
    activeChoices = [];
    pendingFollowup = null;
    window.UI.showEnding(st(), settleWeek());
  }

  function miniToast(text) {
    const el = document.getElementById("mini-toast");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  document.addEventListener("DOMContentLoaded", boot);

  return {
    newGame: guarded("newGame", newGame),
    choose: guarded("choose", choose),
    timeout: guarded("timeout", timeout),
    afterReply: guarded("afterReply", afterReply),
    useItem: guarded("useItem", useItem),
    useSkill: guarded("useSkill", useSkill),
    skip: guarded("skip", skip),
    showLastEnding: guarded("showLastEnding", showLastEnding),
    showReview: guarded("showReview", showReview),
    miniToast, state: st, statLabels
  };
})();
