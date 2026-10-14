// 牛马求生记 · 渲染与交互
window.UI = (function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const C = () => window.CHARACTERS;

  // ---------- 音效 ----------
  let audioCtx = null;
  function soundOn() { return localStorage.getItem("niuma_sound") !== "off"; }
  function toggleSound() {
    const v = localStorage.getItem("niuma_sound") === "off" ? "on" : "off";
    localStorage.setItem("niuma_sound", v);
    return v === "on";
  }
  function beep(freq, dur, delay, type) {
    if (!soundOn()) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || "sine"; o.frequency.value = freq;
      g.gain.value = 0.04;
      o.connect(g); g.connect(audioCtx.destination);
      const t = audioCtx.currentTime + (delay || 0);
      o.start(t); g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.stop(t + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  const sfx = {
    msg() { beep(880, 0.09); beep(660, 0.09, 0.09); },
    ok() { beep(523, 0.08); beep(784, 0.12, 0.08); },
    bad() { beep(330, 0.12); beep(220, 0.16, 0.1); },
    boss() { beep(196, 0.2, 0, "square"); beep(196, 0.2, 0.22, "square"); },
    achieve() { beep(659, 0.08); beep(880, 0.08, 0.08); beep(1046, 0.14, 0.16); }
  };

  // ---------- 屏幕切换 ----------
  let cancelTransition = null;
  function showScreen(id) {
    if (cancelTransition) cancelTransition();
    if (id !== "screen-main") stopTimer();
    clearInlineReply();
    closeOverlay();
    $$(".screen").forEach(s => s.classList.add("hidden"));
    $("#" + id).classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  // 私房钱/存款的显示：老板没有月薪，用「万」说话；员工用月薪
  const WAN_PER_UNIT = 1.68;                    // 1 格 = 1 个月薪 ≈ 1.68 万元
  function moneyAbs(v, job) {
    return job === "boss" ? `¥${(v * WAN_PER_UNIT).toFixed(1)} 万` : `¥${v.toFixed(1)} 个月薪`;
  }
  function moneyDelta(v, job) {
    const sign = v > 0 ? "+" : "-";
    return job === "boss"
      ? `${sign}¥${(Math.abs(v) * WAN_PER_UNIT).toFixed(1)} 万`
      : `${sign}¥${Math.abs(v).toFixed(1)}`;
  }
  function moneyTitle(st) {
    return st.char.job === "boss"
      ? `私房钱：1 格 ≈ ¥${WAN_PER_UNIT} 万（约一个月薪），当前约 ¥${(st.stats.money * Engine.WAGE_YUAN).toLocaleString("zh-CN")} 元`
      : `1 个月薪 = ${Engine.WAGE_YUAN} 元，即约 ¥${Math.round(st.stats.money * Engine.WAGE_YUAN).toLocaleString("zh-CN")} 元`;
  }

  // ---------- 文案标签 ----------
  function statLabels(job) {
    const maps = {
      staff: { mood: "心态", kpi: "KPI", bond: "人缘", trust: "领导信任", fish: "摸鱼值", money: "存款" },
      mid: { mood: "心态", kpi: "团队KPI", bond: "团队士气", trust: "上级信任", fish: "摸鱼值", money: "存款" },
      boss: { mood: "心态", kpi: "现金流", bond: "员工士气", trust: "投资人信任", fish: "自由度", money: "私房钱" }
    };
    return maps[job] || maps.staff;
  }

  // 属性行统一渲染（侧栏 / 创建页预览 / 结局页共用）
  function statRows(stats, job, only) {
    const L = statLabels(job);
    return (only || ["mood", "kpi", "bond", "trust", "fish"]).map(k => {
      const v = stats[k];
      return `<div class="statrow"><span class="statlabel">${L[k]}</span>${barHtml(v, statColor(k, v))}<span class="statval">${Math.round(v)}</span></div>`;
    }).join("");
  }

  function barHtml(pct, color) {
    return `<div class="bar"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, pct))}%;background:${color || ""}"></div></div>`;
  }

  function statColor(k, v) {
    if (k === "mood") return v < 25 ? "#ff4d4f" : v < 50 ? "#faad14" : "#52c41a";
    if (k === "kpi") return v < 30 ? "#ff4d4f" : "#1677ff";
    return "#8c8ea0";
  }

  // ---------- 主状态与完整资料 ----------
  let renderedEvent = null, renderedChoices = [], renderedLines = [];
  function counterHtml(st) {
    const t = T(st.char.job);
    return `<div class="mini-counters"><span class="chip">🍳 ${t.pot} ×${esc(st.pot)}</span>
      <span class="chip">⚔️ ${t.gang} ×${esc(st.gang)}</span><span class="chip">🍉 ${t.gossip} ×${esc(st.gossip)}</span></div>`;
  }
  function contextHtml(st) {
    if (!renderedEvent) return "";
    const L = statLabels(st.char.job);
    // 只读已展示的正文与可见选项，不借隐藏效果提前透露结果。
    const visible = [Engine.eventTitle(st, renderedEvent), ...renderedLines, ...renderedChoices.map(c => c.text)].join(" ");
    const info = [];
    if (/月薪|工资|奖金|红包|自费|自掏|垫付|先垫|请客|下午茶.*[费钱]|[花扣付]钱|私房钱|存款/.test(visible)) info.push(`${L.money} ${moneyAbs(st.stats.money, st.char.job)}`);
    if (renderedEvent.series === "fish" || /摸鱼|打盹|午睡|自由度/.test(visible)) info.push(`${L.fish} ${Math.round(st.stats.fish)}`);
    return info.length ? `<div class="context-info">${info.map(esc).join(" · ")}</div>` : "";
  }
  function openProfile(st) {
    const L = statLabels(st.char.job), persona = C().personas[st.char.persona], job = C().jobs[st.char.job];
    const dept = C().depts.find(d => d.id === st.char.dept) || C().depts[0];
    overlay(`<h2 id="dialog-title">${persona.emoji} ${esc(st.char.name)} · 工牌</h2>
      <p class="sheet-description">${esc(st.char.no)} · ${dept.emoji} ${esc(dept.name)} · ${esc(job.name)} · ${esc(persona.title)}</p>
      <div class="stats">${statRows(st.stats, st.char.job)}<div class="statrow"><span class="statlabel">${L.money}</span><span class="statval money">${moneyAbs(st.stats.money, st.char.job)}</span></div><p class="sheet-description">${esc(moneyTitle(st))}</p></div>
      ${counterHtml(st)}<p class="goal">🎯 本周目标：${esc(job.goal)}</p>
      <p class="sheet-description">${st.char.job === "boss" ? "自由度不压低董事会评分；高自由度仍关联充分授权结局。" : "摸鱼越高，基础绩效中的这一项越低；高摸鱼也关联躺平结局，存在取舍。"}</p>
      ${packHtml(st, true)}`, "profile", true);
    bindPack($("#overlay-card"), st);
  }
  function openPack(st) {
    overlay(`<h2 id="dialog-title">${st.char.job === "boss" ? "💼 公文包 · 技能" : "🎒 背包 · 技能"}</h2>${packHtml(st, true)}`, "pack", true);
    $("#side-toggle").setAttribute("aria-expanded", "true");
    bindPack($("#overlay-card"), st);
  }
  function renderSidebar(st) {
    updateTopbar(st);
    const L = statLabels(st.char.job);
    $("#sidebar").innerHTML = `<button id="summary-toggle" class="quiet-stats" aria-label="查看完整属性" aria-haspopup="dialog">${["mood", "kpi", "bond", "trust"].map(k => {
      const v = Math.round(st.stats[k]);
      const risk = k === "mood" && v < 25 || k === "kpi" && v < 30;
      return `<span class="quick-stat${risk ? " at-risk" : ""}"><span>${L[k]}</span><b>${v}</b>${risk ? '<span class="risk-mark" aria-label="偏低">!</span>' : ""}</span>`;
    }).join("")}</button>${contextHtml(st)}`;
    $("#sidebar").inert = replyPending;
    $("#summary-toggle").onclick = () => openProfile(st);
    $("#profile-toggle").onclick = () => openProfile(st);
    $("#side-toggle").onclick = () => openPack(st);
    renderSkillBar(st, renderedEvent);
  }
  function showSettings(onRestart) {
    overlay(`<h2 id="dialog-title">设置</h2><div class="btn-col"><button id="btn-sound" class="btn ghost">${soundOn() ? "🔊 音效已开启" : "🔇 音效已关闭"}</button><button id="btn-restart" class="btn ghost">重新入职</button></div>`, "settings", true);
    $("#btn-sound").onclick = () => { toggleSound(); $("#btn-sound").textContent = soundOn() ? "🔊 音效已开启" : "🔇 音效已关闭"; };
    $("#btn-restart").onclick = onRestart;
  }

  function packHtml(st, descriptions = false) {
    const persona = C().personas[st.char.persona], job = C().jobs[st.char.job];
    let html = `<div class="side-title">道具</div><div class="items">`;
    if (!st.items.length) html += `<span class="empty">空空如也</span>`;
    st.items.forEach((id, index) => {
      const it = C().items[id];
      if (!it || typeof it.name !== "string") return;
      const usable = ["coffee", "cookie", "report", "resign", "exit"].includes(id);
      const desc = st.char.job === "boss" && it.descBoss ? it.descBoss : it.desc;
      const descId = `pack-desc-${id}-${index}`;
      html += `<button class="item pack-item-card ${usable ? "usable" : "passive"}" ${usable ? `data-item="${id}"` : `data-info="${id}"`}${usable && replyPending ? " disabled" : ""} aria-label="${esc(it.name)}"${descriptions ? ` aria-describedby="${descId}"` : ""} title="${esc(desc)}">
        <span class="item-heading"><span class="item-icon" aria-hidden="true">${it.emoji}</span><strong class="item-name">${esc(it.name)}</strong></span>
        ${descriptions ? `<span id="${descId}" class="item-description">${esc(desc)}</span>` : ""}</button>`;
    });
    html += `</div>`;
    html += `<div class="side-title">技能</div><div class="skills">`;
    const ps = persona.skill;
    const usesTag = (sk, n) => (sk && sk.trigger === "passive") ? "" : `<span class="uses">×${n}</span>`;
    if (ps) html += `<div class="skill"><div class="skill-heading"><span aria-hidden="true">${ps.emoji}</span><strong>${esc(ps.name)}</strong> ${usesTag(ps, st.skillUses.persona)}</div><p class="skill-description">${esc(ps.desc)}</p></div>`;
    if (job.skill) html += `<div class="skill"><div class="skill-heading"><span aria-hidden="true">${job.skill.emoji}</span><strong>${esc(job.skill.name)}</strong> ${usesTag(job.skill, st.skillUses.job)}</div><p class="skill-description">${esc(job.skill.desc)}</p></div>`;
    if (st.armed) html += `<div class="skill armed">⏳ 技能已待命，${T(st.char.job).armed}</div>`;
    html += `</div>`;
    if (descriptions && !replyPending && !st.done) {
      const skills = Engine.manualSkills(st, renderedEvent);
      if (skills.length) html += `<div class="pack-skill-actions">${skills.map(sk => `<button class="skill-btn" data-slot="${sk.slot}"${sk.armed ? ' disabled' : ''}>${sk.emoji} ${sk.armed ? "已待命" : "发动"}【${esc(sk.name)}】</button>`).join("")}</div>`;
    }
    return html;
  }

  function bindPack(root, st) {
    root.querySelectorAll(".skill-btn").forEach(btn => btn.addEventListener("click", () => {
      const slot = btn.dataset.slot;
      closeOverlay();
      window.App.useSkill(slot, renderedEvent);
    }));
    root.querySelectorAll(".item.usable").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.item;
        if (id === "resign" || id === "exit") {
          confirmAction("确认提前结束本局？", `使用【${C().items[id].name}】后，本局立即结束并进入对应结局。`, () => window.App.useItem(id));
        } else {
          closeOverlay();
          window.App.useItem(id);
        }
      });
    });
    root.querySelectorAll("[data-info]").forEach(btn => {
      btn.addEventListener("click", () => {
        const it = C().items[btn.dataset.info];
        overlay(`<h2 id="dialog-title">${it.emoji} ${esc(it.name)}</h2><p class="sheet-description">${esc(it.desc)}</p>`, "info", true);
      });
    });
  }

  // ---------- 日历 ----------
  function renderCalendar(st) {
    let html = "";
    for (let d = 1; d <= 7; d++) {
      const cls = d < st.day ? "past" : d === st.day ? "today" : "";
      html += `<span class="day ${cls}">${Engine.DAY_NAMES[d]}</span>`;
    }
    // 本周进度：天 + 时段都要算进去，让玩家看见"还剩多少"
    const slots = (Engine.SLOT_KEYS || []).length || 6;
    const frac = Math.max(0, Math.min(1, (st.day - 1 + (st.slotIdx || 0) / slots) / 7));
    const pct = Math.round(frac * 100);
    html += `<div class="week-prog" role="progressbar" aria-label="本周进度" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">`
      + `<i style="width:${pct}%"></i></div>`;
    $("#day-calendar").innerHTML = html;
  }

  // ---------- 事件卡 ----------
  // 真转义：玩家输入（姓名/工号）与存档数据都要经过它再进 innerHTML
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // 一条原文 → 一条头像消息，明确的角色前缀才标注人名。
  // 只有白名单里的前缀才算「发言人」，其余带冒号的行按系统旁白渲染（避免把旁白误判成人说话）
  let NPC_BY_NAME = null, SPEAKER_SET = null;
  function npcOf(name) {
    if (!NPC_BY_NAME) {
      NPC_BY_NAME = {};
      Object.values(C().npcs).forEach(n => { NPC_BY_NAME[n.name] = n; });
    }
    if (NPC_BY_NAME[name]) return NPC_BY_NAME[name];
    // 前缀别名：「董事会陈老」→ 陈老、「财务老周」→ 老周、「猎头Lisa」→ Lisa
    let hit = null;
    Object.keys(NPC_BY_NAME).forEach(k => {
      if (name.includes(k) && (!hit || k.length > hit.length)) hit = k;
    });
    return hit ? NPC_BY_NAME[hit] : null;
  }
  function isSpeaker(name) {
    if (!SPEAKER_SET) SPEAKER_SET = new Set(C().speakers || []);
    return SPEAKER_SET.has(name) || !!npcOf(name);
  }

  function speakerProfile(name) {
    const npc = npcOf(name);
    const icons = { "系统": "⚙️", "银行App": "🏦", "后台数据": "📊", "线上 P0": "🚨", "PPT": "📽️", "员工": "👥", "投资人": "💼", "客户": "🤝", "领导": "👔", "前台": "🛎️", "保安": "🛡️", "HR": "🪪", "董事会": "🏛️", "孩子": "🧒", "@所有人": "📣" };
    const own = name === "你" && window.GameState.data?.char;
    return { name, role: npc?.role, emoji: npc?.emoji || (own ? C().personas[own.persona].emoji : icons[name]) || "🗣️" };
  }
  function sceneProfile(line, used) {
    const rules = [
      [/茶水间|接水|咖啡|杯子/, "☕", "茶水间"],
      [/全员会|周会|会议|会场|晨会/, "📣", "会议现场"],
      [/邮件|抄送/, "📨", "邮件通知"],
      [/摸鱼|打盹|午睡/, "🐟", "休息时段"],
      [/工资|奖金|红包|垫付|存款/, "💴", "收支事项"],
      [/HR|人事|考勤/, "🪪", "人事通知"],
      [/需求|方案|PPT|文件|报告/, "📑", "工作事项"],
      [/群里|群聊|钉钉|微信|私聊|手机/, "📱", "聊天记录"],
      [/食堂|午饭|吃饭/, "🍱", "休息时段"],
      [/加班|深夜|工位|电脑|代码/, "💻", "工作现场"]
    ];
    const match = rules.find(([pattern]) => pattern.test(line));
    let emoji = match ? match[1] : "🏢", name = match ? match[2] : "场景";
    if (used.has(emoji)) emoji = ["🗂️", "📌", "📝", "🏢"].find(icon => !used.has(icon)) || emoji;
    used.add(emoji);
    return { name, emoji };
  }
  function linesHtml(lines) {
    let lastSpeaker = null;
    const used = new Set();
    const row = (profile, text, cls) => `<div class="chatline ${cls}"><div class="message-avatar" aria-hidden="true">${profile.emoji}</div><div class="message-content"><div class="who">${esc(profile.name)}${profile.role ? `<span class="who-role">${esc(profile.role)}</span>` : ""}</div><div class="txt">${esc(text)}</div></div></div>`;
    return (lines || []).map(ln => {
      const m = ln.match(/^([^：]{1,6})：([\s\S]*)$/);
      if (m && isSpeaker(m[1])) {
        lastSpeaker = speakerProfile(m[1]);
        return row(lastSpeaker, m[2], "in");
      }
      const quote = ln.startsWith("「") || ln.startsWith("“");
      // 独立引号行只沿用紧邻且明确的说话人，不根据“提到某人”猜身份。
      if (quote && lastSpeaker) return row(lastSpeaker, ln, "in");
      if (quote) return row({ name: "现场消息", emoji: "🗣️" }, ln, "in");
      const speaker = Object.values(C().npcs).find(n =>
        ["说：", "问：", "回：", "说:", "问:", "回:"].some(cue => {
          const at = ln.indexOf(n.name + cue);
          return at >= 0 && /^[\s]*[「“]/.test(ln.slice(at + n.name.length + cue.length));
        }));
      lastSpeaker = speaker ? speakerProfile(speaker.name) : null;
      return row(sceneProfile(ln, used), ln, "sys");
    }).join("");
  }
  function isOa(st, ev) {
    return ev.scene === "ticket" || /^【(?:邮件|审批|工单)】/.test(Engine.eventTitle(st, ev));
  }
  function storyHtml(st, ev, lines) {
    if (!isOa(st, ev)) return linesHtml(lines);
    return `<div class="oa-form"><div class="oa-field">事项：${esc(Engine.eventTitle(st, ev).replace(/^【[^】]*】/, ""))}<br>状态：<span class="oa-status">待处理</span></div>${lines.map(ln => `<p>${esc(ln)}</p>`).join("")}</div>`;
  }

  function renderChoices(st, rawChoices, ev) {
    let ch = "";
    $("#choices").setAttribute("aria-label", isOa(st, ev) ? "处理意见" : "回复选项");
    if (!rawChoices || !rawChoices.length) {
      // 兜底：数据异常时不锁死流程
      $("#choices").innerHTML = `<button class="choice" data-i="-1">（无可用选项）继续 →</button>`;
      $("#choices .choice").addEventListener("click", () => { stopTimer(); window.App.skip(); });
      return;
    }
    rawChoices.forEach((c, i) => {
      const need = c.needItem ? ` <span class="need">需${C().items[c.needItem].name}</span>` : "";
      const gang = (c.gang || c.isDui) ? `<span class="tag gang">刚</span>` : "";
      const isCrazy = /发疯/.test(c.text);
      ch += `<button class="choice${isCrazy ? " crazy" : ""}" data-i="${i}">${gang}<span class="choice-text">${esc(c.text)}</span>${need}</button>`;
    });
    $("#choices").innerHTML = ch;
    $$("#choices .choice").forEach(btn => {
      btn.addEventListener("click", () => {
        stopTimer();
        window.App.choose(parseInt(btn.dataset.i, 10));
      });
    });
    const first = $("#choices .choice");
    if (first && document.activeElement === document.body) {
      try { first.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ }
    }
  }

  function renderEvent(st, ev, choices) {
    clearInlineReply();
    updateTopbar(st);
    renderedEvent = ev;
    const list = choices || Engine.visibleChoices(st, ev);
    renderedChoices = list;
    renderedLines = Engine.eventLines(st, ev);
    renderCalendar(st);
    renderSidebar(st);
    const lines = renderedLines;
    const isBoss = ev.series === "boss" || Engine.isDailyBoss(ev);
    const head = `<div class="event-head ${isBoss ? "boss" : ev.scene}">
        <div class="event-heading"><span class="scene-channel">${isOa(st, ev) ? "OA · 待处理" : "即时消息"}</span><span class="event-title">${esc(Engine.eventTitle(st, ev))}</span></div>
        ${ev.timer ? `<span class="timer-chip">⏱ ${ev.timer}s</span>` : ""}
      </div>`;
    $("#event-card").className = "event-card scene-" + (isBoss ? "boss" : ev.scene);
    // 一次性引导：告诉玩家背包/技能在哪（只提示一次，之后不再打扰）
    let tip = "";
    try {
      if (!localStorage.getItem("niuma_tip_drawer")) {
        localStorage.setItem("niuma_tip_drawer", "1");
        const packName = st.char.job === "boss" ? "公文包 · 技能" : "背包 · 技能";
        const skillHint = st.char.job === "boss"
          ? "老板的技能随时可发动，代价记在别人身上。"
          : "有的技能要等到特定事件（比如甩锅）才能发动。";
        tip = `<div class="tip-line">💡 聊天框右下角的「${packName}」图标可查看道具和技能；${skillHint}</div>`;
      }
    } catch (e) { /* 隐私模式下 localStorage 不可用时静默跳过 */ }
    $("#event-card").innerHTML = head + `<div class="event-body">${storyHtml(st, ev, lines)}${tip}</div>`;
    renderChoices(st, list, ev);
    renderSkillBar(st, ev);
    const card = $("#event-card");
    if (card) {
      card.scrollTop = 0;                    // 新事件从顶部开始读，别停在上一题的半截
      card.classList.remove("enter");        // 重放一次入场动画：新事件"送达到手"的感觉
      void card.offsetWidth;
      card.classList.add("enter");
    }
    if (ev.timer) startTimer(ev.timer);
    else stopTimer();
    if (isBoss) sfx.boss(); else sfx.msg();
  }

  // 追问轮：同一个事件里接着出下一题
  function renderFollowupRound(st, ev, fb, round, choices) {
    const list = choices || Engine.filterChoices(st, fb.choices);
    renderedChoices = list;
    renderedLines = renderedLines.concat(fb.lines || []);
    renderSidebar(st);
    const body = $("#event-card .event-body");
    if (body) {
      body.insertAdjacentHTML("beforeend",
        `<div class="round-mark">追问 ${round}</div>` + linesHtml(fb.lines));
    }
    renderChoices(st, list, ev);
    renderSkillBar(st, ev);
    stopTimer();
    const chip = $(".timer-chip");           // 清掉上一轮的倒计时读数（追问轮没有限时）
    if (chip) chip.remove();
    const card = $("#event-card");
    // 只移动卡片内部滚动区，不能把整张卡片向页面顶部滚。
    const marks = body ? body.querySelectorAll(".round-mark") : [];
    const latest = marks[marks.length - 1];
    if (latest) card.scrollTo({ top: card.scrollTop + latest.getBoundingClientRect().top - card.getBoundingClientRect().top - 12, behavior: scrollBehavior() });
    sfx.msg();
  }

  // ---------- 日期转场：常规 / 周六加班 / 周日终局 ----------
  const DAY_LINES = {
    2: ["快递都还没拆，活又来了", "周二，一个不上不下的日子"],
    3: ["周中节点，甲方验收日在逼近", "周三，最容易被拉进会议的一天"],
    4: ["离周末还有两天，离崩溃也还有两天", "周四，会议纪要写得比小说长"],
    5: ["周报要交了，贾总的眼神开始变亮", "周五，汇报日"],
    6: ["⚠ 周六 · 加班日 · 没有加班费", "这一天的工位，灯是自愿亮的（并不）"],
    7: ["本周最后一天 · 绩效面谈日", "周日见绩效，成败在此一谈"]
  };

  // 老板线的日期转场：共用的台词会露出打工人口吻，这里单独覆盖
  const DAY_LINES_BOSS = {
    2: ["周一刚过，红点已经排到了明天", "周二，一个不上不下的日子"],
    3: ["周三，客户的耐心和现金流的余额一起见底", "周中节点，你的日历全是会"],
    4: ["离周末还有两天，离下一笔回款也还有两天", "周四，董事会开始看数字了"],
    5: ["今晚的材料明天要交，董事会的耐心比贾总还薄", "周五，汇报日"],
    6: ["⚠ 周六 · 加班日 · 全公司都在，你更得在", "这一天的灯，是为别人亮的"],
    7: ["本周最后一天 · 董事会评估日", "周日见董事会，方向盘还在你手里"]
  };

  function showDayTransition(st, kind, onDone) {
    if (cancelTransition) cancelTransition();
    const day = st.day;
    const pool = (st.char.job === "boss" ? (DAY_LINES_BOSS[day] || DAY_LINES[day]) : DAY_LINES[day]) || [""];
    const line = pool[Math.floor(Math.random() * pool.length)];
    let cls = "day-transition", tag = "OA 系统推送", icon = "📆";
    if (kind === "overtime") { cls += " kind-overtime"; tag = "钉钉提醒 · 紧急"; icon = "🔥"; }
    else if (kind === "final") { cls += " kind-final"; tag = "本周最后一天"; icon = "🏁"; }
    else if (kind === "start") { cls += " kind-start"; tag = "新的一周开始"; icon = "🚀"; }
    const html = `
      <div class="${cls}">
        <div class="dt-tag">${tag}</div>
        <div class="dt-icon">${icon}</div>
        <div class="dt-day">${Engine.DAY_NAMES[day]}</div>
        <div class="dt-line">${line}</div>
        <button id="day-skip" class="dt-hint">轻点继续</button>
      </div>`;
    overlay(html, "transition");
    if (kind === "overtime") sfx.boss(); else sfx.msg();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(tid);
      cancelTransition = null;
      $("#overlay").removeEventListener("click", finish);   // 超时路径也要摘掉监听
      closeOverlay();
      onDone();
    };
    const tid = setTimeout(finish, kind === "overtime" ? 2100 : 1700);
    $("#overlay").addEventListener("click", finish);
    cancelTransition = () => {
      done = true;
      clearTimeout(tid);
      $("#overlay").removeEventListener("click", finish);
      cancelTransition = null;
    };
  }

  function renderSkillBar(st, ev) {
    const skills = Engine.manualSkills(st, ev);
    const ready = skills.filter(sk => !sk.armed).length;
    const toggle = $("#side-toggle"), name = st.char.job === "boss" ? "公文包与技能" : "背包与技能";
    toggle.querySelector(".pack-ready").classList.toggle("hidden", ready === 0 || replyPending);
    toggle.setAttribute("aria-label", `打开${name}${ready && !replyPending ? `，${ready} 个可用技能` : ""}`);
    toggle.title = `${name}${ready && !replyPending ? ` · ${ready} 个可用技能` : ""}`;
  }

  // ---------- 倒计时 ----------
  let timerHandle = null, timerLeft = 0, timerTotal = 0, timerLastAt = null;
  let pageSuspended = false;
  function paintTimer() {
    const bar = $("#event-card .timerbar"), chip = $(".timer-chip");
    if (bar) { bar.style.width = (timerLeft / timerTotal * 100) + "%"; bar.classList.toggle("urgent", timerLeft <= 3000); }
    if (chip) chip.textContent = `${timerLastAt === null ? "⏸" : "⏱"} ${Math.max(0, Math.ceil(timerLeft / 1000))}s`;
  }
  function consumeTime() {
    if (timerLastAt === null) return;
    const now = performance.now();
    timerLeft = Math.max(0, timerLeft - (now - timerLastAt));
    timerLastAt = now;
  }
  function syncTimerPause() {
    if (!timerTotal) return;
    const paused = document.hidden || pageSuspended || !$("#overlay").classList.contains("hidden");
    if (paused) {
      consumeTime();
      clearInterval(timerHandle); timerHandle = null; timerLastAt = null;
    } else if (timerLastAt === null) {
      timerLastAt = performance.now();
      timerHandle = setInterval(() => {
        consumeTime(); paintTimer();
        if (timerLeft <= 0) { stopTimer(); window.App.timeout(); }
      }, 100);
    }
    paintTimer();
  }
  function startTimer(sec) {
    stopTimer();
    timerLeft = timerTotal = sec * 1000;
    const bar = document.createElement("div");
    bar.className = "timerbar";
    $("#event-card").prepend(bar);
    syncTimerPause();
  }
  function stopTimer() {
    clearInterval(timerHandle); timerHandle = null;
    timerLastAt = null; timerLeft = timerTotal = 0;
    const bar = $("#event-card .timerbar");
    if (bar) bar.remove();
  }
  document.addEventListener("visibilitychange", syncTimerPause);
  window.addEventListener("pagehide", () => { pageSuspended = true; syncTimerPause(); });
  window.addEventListener("pageshow", () => { pageSuspended = false; syncTimerPause(); });

  // ---------- 覆盖层 ----------
  let overlayDismissible = false, overlayFocus = null, savedOverflow = null;
  function overlay(html, cls, dismissible = false) {
    const card = $("#overlay-card"), layer = $("#overlay");
    if (layer.classList.contains("hidden")) {
      overlayFocus = document.activeElement;
      savedOverflow = document.body.style.overflow;
    }
    overlayDismissible = dismissible;
    card.className = "overlay-card " + (cls || "");
    card.innerHTML = (dismissible ? `<div class="sheet-controls"><button class="sheet-handle" aria-label="下拉关闭弹层"></button><button class="sheet-close tb-btn" aria-label="关闭弹层">×</button></div>` : "") + html;
    card.style.transform = ""; card.style.opacity = "";
    card.setAttribute("tabindex", "-1");
    if (card.querySelector("#dialog-title")) card.setAttribute("aria-labelledby", "dialog-title");
    else { card.removeAttribute("aria-labelledby"); card.setAttribute("aria-label", cls === "report" ? "日报" : cls === "reply" ? "本次选择结果" : "日期转场"); }
    layer.classList.remove("hidden");
    $$(".screen").forEach(s => { s.inert = true; });
    document.body.style.overflow = "hidden";
    syncTimerPause();
    const close = card.querySelector(".sheet-close");
    if (close) close.addEventListener("click", closeOverlay);
    bindSheetDrag(card);
    const btn = card.querySelector("#ov-btn, .sheet-close, #day-skip");
    (btn || card).focus({ preventScroll: true });
  }

  function bindSheetDrag(card) {
    const handle = card.querySelector(".sheet-handle");
    if (!handle) return;
    let startY = null, dy = 0;
    handle.addEventListener("click", closeOverlay);
    handle.addEventListener("touchstart", e => { startY = e.touches[0].clientY; dy = 0; card.style.transition = "none"; }, { passive: true });
    handle.addEventListener("touchmove", e => {
      if (startY === null) return;
      dy = Math.max(0, e.touches[0].clientY - startY);
      card.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    const reset = () => { startY = null; card.style.transition = ""; card.style.transform = ""; };
    handle.addEventListener("touchend", () => { const dismiss = dy > 80; reset(); if (dismiss) closeOverlay(); });
    handle.addEventListener("touchcancel", reset);
  }

  document.addEventListener("keydown", e => {
    if ($("#overlay").classList.contains("hidden")) return;
    if (e.key === "Escape") { e.preventDefault(); if (overlayDismissible) closeOverlay(); return; }
    if (e.key !== "Tab") return;
    const nodes = Array.from($("#overlay-card").querySelectorAll('button:not(:disabled), input, select, a[href], summary, [tabindex="0"]')).filter(el => el.getClientRects().length);
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (!first) { e.preventDefault(); $("#overlay-card").focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $("#overlay").addEventListener("click", e => {
    if (overlayDismissible && e.target === $("#overlay")) closeOverlay();
  });
  function closeOverlay() {
    const wasOpen = !$("#overlay").classList.contains("hidden");
    $("#overlay").classList.add("hidden");
    overlayDismissible = false;
    $$(".screen").forEach(s => { s.inert = false; });
    if (wasOpen) {
      document.body.style.overflow = savedOverflow || "";
      const toggle = $("#side-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
      if (overlayFocus && overlayFocus.isConnected && !overlayFocus.closest(".hidden")) overlayFocus.focus({ preventScroll: true });
      overlayFocus = null;
      syncTimerPause();
    }
  }
  function confirmAction(title, message, onConfirm) {
    overlay(`<h2 id="dialog-title">${esc(title)}</h2><p class="sheet-description">${esc(message)}</p>
      <div class="btn-row"><button id="dialog-cancel" class="btn ghost">取消</button><button id="dialog-confirm" class="btn primary">确认</button></div>`, "confirm", true);
    $("#dialog-cancel").addEventListener("click", closeOverlay);
    $("#dialog-confirm").addEventListener("click", e => { e.currentTarget.disabled = true; closeOverlay(); onConfirm(); });
    $("#dialog-cancel").focus({ preventScroll: true });
  }
  function scrollBehavior() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; }

  function deltaChips(delta, job) {
    const L = window.App.statLabels();
    if (!job) { try { job = window.App.state().char.job; } catch (e) { job = "staff"; } }
    let html = "";
    for (const k in delta) {
      if (!delta[k]) continue;
      const v = delta[k];
      const cls = v > 0 ? "up" : "down";
      const icon = v > 0 ? "▲" : "▼";
      const name = k === "money" ? L.money : (L[k] || k);
      const val = k === "money" ? moneyDelta(v, job) : (v > 0 ? "+" : "") + Math.round(v);
      html += `<span class="delta ${cls}">${icon} ${name} ${val}</span>`;
    }
    return html || `<span class="delta">风平浪静</span>`;
  }

  let replyPending = false;
  function clearInlineReply() {
    replyPending = false;
    const sidebar = $("#sidebar");
    if (sidebar) sidebar.inert = false;
  }
  function resourceFeedback(st, delta) {
    const L = statLabels(st.char.job), info = [];
    if (delta && delta.money) info.push(`${L.money} ${moneyAbs(st.stats.money, st.char.job)}`);
    if (delta && delta.fish) info.push(`${L.fish} ${Math.round(st.stats.fish)}`);
    return info.length ? `<p class="context-outcome">${info.map(esc).join(" · ")}</p>` : "";
  }
  function showReply(ev, choice, res) {
    stopTimer();
    let html = `<div class="reply-emoji">${res.judged === true ? "🎯" : res.judged === false ? "💥" : "💬"}</div>`;
    html += `<div class="reply-text">${esc(res.reply)}</div>`;
    (res.meta || []).forEach(m => { html += `<div class="meta-line">${esc(m)}</div>`; });
    html += `<div class="deltas">${deltaChips(res.delta, window.App.state().char.job)}</div>${resourceFeedback(window.App.state(), res.delta)}`;
    if (window.App.state().done) {
      html += `<button id="ov-btn" class="btn primary">……</button>`;
    } else if (res.followup) {
      html += `<div class="more-hint">对方还有话说……</div>`;
      html += `<button id="ov-btn" class="btn primary">接着说 →</button>`;
    } else {
      html += `<button id="ov-btn" class="btn primary">${window.App.state().char.job === "boss" ? "继续经营" : "继续打工"}</button>`;
    }
    const major = window.App.state().done || ev.series === "boss" || Engine.isDailyBoss(ev);
    const st = window.App.state(), body = $("#event-card .event-body");
    const status = body.querySelector(".oa-status");
    if (status) status.textContent = res.followup ? "处理中" : "已处理";
    body.insertAdjacentHTML("beforeend", `<div class="chatline out"><div class="message-content"><div class="who">${esc(st.char.name)} · 已发送</div><div class="txt">${esc(choice.text)}</div></div><div class="message-avatar" aria-hidden="true">${C().personas[st.char.persona].emoji}</div></div>`);
    if (major) overlay(html, "reply");
    else {
      replyPending = true;
      $("#sidebar").inert = true;
      const btnHtml = html.slice(html.indexOf('<button id="ov-btn"'));
      const textHtml = html.slice(0, html.indexOf('<button id="ov-btn"'));
      body.insertAdjacentHTML("beforeend", `<div class="inline-reply chatline in" role="status"><div class="message-avatar" aria-hidden="true">💬</div><div class="message-content"><div class="who">反馈</div>${textHtml}</div></div>`);
      renderSkillBar(st, ev);
      $("#choices").innerHTML = btnHtml.replace('id="ov-btn"', 'id="reply-continue"');
      const card = $("#event-card"), result = body.querySelector(".inline-reply:last-child");
      card.scrollTo({ top: card.scrollTop + result.getBoundingClientRect().top - card.getBoundingClientRect().top - 12, behavior: scrollBehavior() });
    }
    sfx[res.judged === false ? "bad" : "ok"]();
    const next = $(major ? "#ov-btn" : "#reply-continue");
    next.focus({ preventScroll: true });
    next.addEventListener("click", () => {
      next.disabled = true;
      clearInlineReply();
      closeOverlay();
      window.App.afterReply();
    }, { once: true });
  }

  // 老板视角语录（一线/中层共用上面那套）
  const DAY_QUOTES_BOSS = [
    "今天的你：现金流 +1，头发 −1。",
    "当老板的一天，从「我来拍板」开始，到「我改主意」结束。",
    "整层楼的灯都灭了，只剩你这一盏——这不叫勤奋，这叫电费。",
    "你摸的不是鱼，是别人的人生。",
    "饼画得越圆，账越难平。",
    "锅从天上来，先看看它姓什么。",
    "坚持住，周日在等你（的董事会）。"
  ];

  const DAY_QUOTES = [
    "今天的你：牛马 +1，快乐 -1。",
    "打工人的一天，从「收到」开始，到「收到」结束。",
    "工位上的灯，是这层楼最后的诚实。",
    "你摸的不是鱼，是自由的碎片。",
    "周报写得越好，人生写得越少。",
    "锅从天上来，先接住再说。",
    "坚持住，周日在等你（的绩效）。"
  ];

  function showDayReport(st, onNext) {
    const d = st.day;                    // 刚结束的那一天（1~6）
    const dayHead = st.char.job === "boss" ? "📊 经营简报已归档" : "📭 日报已归档";
    let html = `<div class="report-head">第 ${d} 天 · ${dayHead}</div>`;
    html += `<div class="deltas big">${deltaChips(st.dayDelta, st.char.job)}</div>`;
    const quotes = st.char.job === "boss" ? DAY_QUOTES_BOSS : DAY_QUOTES;
    html += `<div class="report-quote">「${quotes[d % quotes.length]}」</div>`;
    Engine.checkAchievements(st);
    const applicable = Engine.achievementsFor(st);
    const ach = (st.dayAchievements || []).map(id => applicable.find(a => a.id === id)).filter(Boolean);
    ach.forEach(a => { html += `<div class="meta-line">🏅 成就解锁：${a.emoji} ${a.name}</div>`; });
    if (ach.length) sfx.achieve();
    const nextDay = Engine.DAY_NAMES[d + 1] || "周日";
    html += `<button id="ov-btn" class="btn primary">${d >= 6 ? "迎接周日" : "开始" + nextDay}</button>`;
    overlay(html, "report");
    $("#ov-btn").addEventListener("click", () => { closeOverlay(); onNext(); });
  }

  // ---------- 结局 ----------
  function endingCopyText(st, ending) {
    const tc = T(st.char.job);
    const L = statLabels(st.char.job);
    const line1 = ending.text.split("\n")[0];
    const isBoss = st.char.job === "boss";
    const isMid = st.char.job === "mid";
    const rating = isBoss
      ? `董事会评语：${ending.bossWord}${ending.bossSpin ? "（" + ending.bossSpin + "）" : ""}`
      : `绩效 ${ending.perf} · 评级 ${ending.grade}`;
    const luckLine = isMid && ending.luck ? [`🎲 绩效归因：${ending.luck.text}`] : [];
    return [
      isBoss
        ? `【牛马求生记】我这一周的经营结果：${ending.emoji} ${ending.name}（${rating}）`
        : `【牛马求生记】我的一周打工鉴定结果：${ending.emoji} ${ending.name}（${rating}）`,
      `「${line1}」`,
      ...(ending.epilogue ? [`${C().personas[st.char.persona].emoji} ${C().personas[st.char.persona].title}：${ending.epilogue}`] : []),
      ...luckLine,
      `${L.mood}${Math.round(st.stats.mood)} · ${L.kpi}${Math.round(st.stats.kpi)} · ${L.bond}${Math.round(st.stats.bond)} · ${L.trust}${Math.round(st.stats.trust)} · ${L.fish}${Math.round(st.stats.fish)}`,
      (st.journal && st.journal.length ? `📋 本周 ${st.journal.length} 次选择${reviewStats(st).dui ? " · " + tc.copyDui + " " + reviewStats(st).dui : ""}${reviewStats(st).pot ? " · " + tc.copyPot + " " + reviewStats(st).pot : ""}${reviewStats(st).ot ? " · " + tc.copyOt + " " + reviewStats(st).ot : ""}` : null),
      `${tc.copyChips}×${st.pot} ${tc.copyGang}×${st.gang} 成就×${st.achievements.length}/${Engine.achievementsFor(st).length}`,
      `身份：${st.char.no} ${st.char.name} · ${C().jobs[st.char.job].name} · ${C().personas[st.char.persona].title}`,
      isBoss
        ? `来卷卷科技当一周老板——你会发现自己也挺会讲。`
        : `来卷卷科技打一周工，看看你是哪种牛马。`
    ].filter(x => x !== null).join("\n");
  }

  // 绩效档位刻度条（S 3.75 / A 3.5+ / B 3.5 / C 3.5- / D 3.25）
  function gradeScaleHtml(grade) {
    const bands = Engine.GRADE_BANDS;
    return `<div class="grade-scale">` + bands.map(b =>
      `<span class="gs gs-${b.grade} ${b.grade === grade ? "on" : ""}">${b.grade}<b>${b.label}</b></span>`
    ).join("") + `</div>`;
  }

  // 老板刻度：只有形容词，没有数字，也没有差评
  function bossScaleHtml(grade) {
    return `<div class="grade-scale boss-scale">` + Engine.BOSS_BANDS.map(b =>
      `<span class="gs boss ${b.grade === grade ? "on" : ""}">${b.word}</span>`
    ).join("") + `</div>`;
  }

  // 按职级走三套评级展示
  function gradeBlockHtml(st, ending) {
    if (st.char.job === "boss") {
      return `
        <div class="end-perf boss-rating">董事会评语：<b class="gp-${ending.grade}">${esc(ending.bossWord || ending.gradeLabel)}</b></div>
        <div class="boss-note">${esc(ending.bossNote || "")}</div>
        ${bossScaleHtml(ending.grade)}
        ${ending.bossSpin ? `<div class="boss-spin">${ending.bossSpin}</div>` : ""}`;
    }
    const luck = st.char.job === "mid"
      ? (ending.luck
        ? `<div class="luck-note"><span class="luck-tag">🎲 绩效归因</span>${ending.luck.text}<span class="luck-delta">${ending.luck.delta > 0 ? "+" : ""}${ending.luck.delta.toFixed(2)}</span></div>`
        : `<div class="luck-note none"><span class="luck-tag">🎲 绩效归因</span>本周没有意外，纯按表现核算。</div>`)
      : "";
    return `
      <div class="end-perf">绩效 <b class="gp-${ending.grade}">${esc(ending.perf)}</b> · 评级 <b class="gp-${ending.grade}">${ending.grade}</b> 档</div>
      ${gradeScaleHtml(ending.grade)}
      ${luck}`;
  }

  function copyText(text, what) {
    const done = () => window.App.miniToast(`📋 ${what || "发疯文案"}已复制，${what ? "去看看" : "去群里发吧"}`);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { window.App.miniToast("复制失败，可长按卡片保存"); }
      ta.remove();
    }
  }

  // 内部契约：showEnding 必须收到完整结局对象。
  // 不可信路径（localStorage 快照）已由 GameState.validEnding 拦住，这里再拦住内部调用错误与旧版存档，
  // 抛出的错误会被 main.js 的全局错误边界接住并提示「返回标题」，而不是在渲染中途爆 TypeError。
  function assertEnding(ending) {
    const bad = [];
    if (!ending || typeof ending !== "object") bad.push("ending 不是对象");
    else {
      if (typeof ending.name !== "string" || !ending.name) bad.push("缺少 name");
      if (typeof ending.text !== "string" || !ending.text) bad.push("缺少 text");
      if (typeof ending.grade !== "string" || !ending.grade) bad.push("缺少 grade");
    }
    if (bad.length) throw new Error("结局数据不完整（" + bad.join("、") + "），可能是旧版本存档或内部调用错误");
    return ending;
  }

  function showEnding(st, ending, options = {}) {
    assertEnding(ending);
    const t = T(st.char.job);
    const ach = Engine.finalAchievements(st);
    if (!options.readOnly && window.GameState.data === st) window.GameState.save();
    const isBoss = st.char.job === "boss";
    const L = statLabels(st.char.job);
    const line1 = ending.text.split("\n")[0];
    const eName = esc(ending.name), eText = esc(ending.text), eLine1 = esc(line1);
    const statsHtml = statRows(st.stats, st.char.job);

    let achHtml = "";
    Engine.achievementsFor(st).forEach(a => {
      const got = st.achievements.includes(a.id);
      const label = got ? a.name : (a.hidden ? "???" : a.name);
      const tip = got || !a.hidden ? a.desc : "隐藏成就 · 用这个人设打通属于他的结局";
      achHtml += `<button class="ach ${got ? "got" : ""}${a.hidden && !got ? " mystery" : ""}" data-ach="${esc(a.id)}" title="${esc(tip)}">${got ? a.emoji : "🔒"} ${esc(label)}</button>`;
    });

    $("#screen-ending").innerHTML = `
      <div class="ending-card grade-${ending.grade}-edge">
        <div class="end-hero">
          ${isBoss
            ? `<div class="end-seal seal-boss" aria-hidden="true">${esc(ending.bossWord || "很好")}<span>评语</span></div>`
            : `<div class="end-seal" aria-hidden="true">${ending.grade}<span>评级</span></div>`}
          <div class="end-emoji">${ending.emoji}</div>
          <h2 class="end-name">${eName}</h2>
          ${gradeBlockHtml(st, ending)}
          <div class="end-badge">${isBoss ? "本周经营复盘 · 仅供本人参考" : "一周生存鉴定 · " + C().jobs[st.char.job].name}</div>
        </div>
        <div class="end-quote">「${eLine1}」</div>
        <div class="end-fulltext">${eText.replace(/\n/g, "<br>")}</div>
        ${ending.epilogue ? `<div class="end-epilogue">
          <div class="ee-label">${C().personas[st.char.persona].emoji} ${esc(C().personas[st.char.persona].title)} · 专属收尾</div>
          <div class="ee-text">${esc(ending.epilogue)}</div>
        </div>` : ""}
        <div class="end-id">${esc(st.char.no)} · ${esc(st.char.name)} · ${C().personas[st.char.persona].title}</div>
        <div class="end-stats">${statsHtml}
          <div class="end-chips">
            <span class="chip ${st.pot >= 3 ? "danger" : ""}">🍳 ${t.pot} ×${esc(st.pot)}</span>
            <span class="chip">⚔️ ${t.gang} ×${esc(st.gang)}</span>
            <span class="chip">🏅 成就 ×${st.achievements.length}/${Engine.achievementsFor(st).length}</span>
          </div>
        </div>
        <div class="ach-list">${achHtml}</div>
        <canvas id="share-canvas" width="750" height="1320" class="share-canvas hidden" aria-hidden="true"></canvas>
        <div class="btn-row">
          <button id="btn-copy-text" class="btn ghost">复制发疯文案</button>
          <button id="btn-again" class="btn ghost">${isBoss ? "再经营一周" : "再打一周工"}</button>
        </div>
        <p class="tips">${isBoss ? "打开卡片预览后可长按保存 · 下周继续讲你的故事" : "打开卡片预览后可长按保存分享 · 愿你下周不用再来"}</p>
      </div>
      <div class="btn-row ending-actions">
        <button id="btn-save-card" class="btn primary">保存结局卡片</button>
        <button id="btn-review" class="btn ghost">${RC(st.char.job).btn}</button>
      </div>`;
    showScreen("screen-ending");
    if (ach.length) sfx.achieve();
    $("#btn-again").addEventListener("click", () => {
      const again = () => {
        if (!options.readOnly) window.GameState.clear();
        showScreen("screen-title"); refreshTitle();
      };
      if (options.readOnly) again();
      else confirmAction(isBoss ? "再经营一周？" : "再打一周工？", "将清除本局存档，最近一次结局仍可回看。", again);
    });
    $$("#screen-ending [data-ach]").forEach(btn => btn.addEventListener("click", () => {
      const a = Engine.achievementsFor(st).find(x => x.id === btn.dataset.ach);
      const visible = st.achievements.includes(a.id) || !a.hidden;
      overlay(`<h2 id="dialog-title">${visible ? esc(a.name) : "隐藏成就"}</h2><p class="sheet-description">${visible ? esc(a.desc) : "隐藏成就 · 用这个人设打通属于他的结局"}</p>`, "info", true);
    }));
    $("#btn-review").addEventListener("click", () => showReview(st));
    $("#btn-copy-text").addEventListener("click", () => copyText(endingCopyText(st, ending)));
    $("#btn-save-card").addEventListener("click", () => {
      drawShareCard(st, ending);
      showImagePreview($("#share-canvas").toDataURL("image/png"), `牛马求生记-${ending.name}.png`, "本周结局卡片");
    });
  }

  function showImagePreview(url, filename, title) {
    overlay(`<h2 id="dialog-title">${esc(title)}</h2><img class="share-preview" src="${url}" alt="${esc(title)}">
      <p class="tips">可长按图片保存，也可以下载后分享。</p>
      <div class="btn-row"><a id="image-download" class="btn primary" href="${url}" download="${esc(filename)}">下载图片</a>
      <button id="image-share" class="btn ghost hidden">系统分享</button></div>`, "share", true);
    const button = $("#image-share");
    if (typeof navigator.canShare !== "function" || typeof navigator.share !== "function") return;
    fetch(url).then(r => r.blob()).then(blob => {
      if (!button.isConnected) return;
      const file = new File([blob], filename, { type: "image/png" });
      if (!navigator.canShare({ files: [file] })) return;
      button.classList.remove("hidden");
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await navigator.share({ files: [file], title }); }
        catch (err) { if (err.name !== "AbortError") window.App.miniToast("当前环境无法分享，请保存图片后分享。"); }
        finally { if (button.isConnected) button.disabled = false; }
      });
    }).catch(() => { /* 下载与长按保存仍可用。 */ });
  }

  // ---------- 打工周报（工单实物感 · 三色：墨 / 朱 / 琥珀） ----------
  function deltaList(delta) {
    return ["mood", "kpi", "bond", "trust", "fish", "money"]
      .filter(k => delta && delta[k] !== undefined && delta[k] !== 0)
      .map(k => ({ k: k, v: delta[k], abs: Math.abs(delta[k]) }));
  }

  function topDeltaList(delta) {
    return deltaList(delta).filter(x => x.abs >= 2).sort((a, b) => b.abs - a.abs).slice(0, 2);
  }

  function deltaText(x, job) {
    const L = statLabels(job);
    const v = x.k === "money"
      ? moneyDelta(x.v, job)
      : (x.v > 0 ? "+" + x.v : String(x.v));
    return `${x.v > 0 ? "▲" : "▼"}${L[x.k]} ${v}`;
  }

  function topDeltas(delta, job) {
    return topDeltaList(delta).map(x =>
      `<span class="rv-d ${x.v > 0 ? "up" : "down"}">${deltaText(x, job)}</span>`).join("");
  }

  function badgeList(j, job) {
    const t = T(job);
    const b = [];
    if (j.isDui) b.push({ t: "⚔️ " + (j.judged === false ? t.duiFail : t.dui), w: 30 });
    if (j.passed) b.push({ t: "🥏 " + t.potPassed, w: 28 });
    if (j.cdelta && j.cdelta.pot > 0) b.push({ t: "🍳 " + t.catchPot + " +" + j.cdelta.pot, w: 26 });
    if (j.timid && !j.auto) b.push({ t: "🙈 " + t.timid, w: 20 });
    if (j.cdelta && j.cdelta.gossip > 0) b.push({ t: "🍉 " + t.gossipAct + " +" + j.cdelta.gossip, w: 14 });
    if (j.overtime) b.push({ t: "🌙 加班", w: 10 });
    return b.sort((x, y) => y.w - x.w).slice(0, 2).map(x => x.t);
  }

  function topBadges(j, job) {
    return badgeList(j, job).map(t => `<span class="rv-tag">${t}</span>`).join("");
  }

  function entryTags(j, job) {
    const tm = T(job);
    const t = [];
    if (j.isDui) t.push(`<span class="rv-tag">⚔️ ${j.judged === false ? tm.duiFail : tm.dui}</span>`);
    else if (j.judged === true) t.push('<span class="rv-tag">🎲 判定成功</span>');
    else if (j.judged === false) t.push('<span class="rv-tag">🎲 判定失败</span>');
    if (j.round > 0) t.push(`<span class="rv-tag">💬 追问 ${esc(j.round)}</span>`);
    if (j.auto) t.push('<span class="rv-tag">⏰ 超时</span>');
    if (j.overtime) t.push('<span class="rv-tag">🌙 加班</span>');
    if (j.chain) t.push('<span class="rv-tag">🔗 连锁到次日</span>');
    if (j.flags && j.flags.length) t.push('<span class="rv-tag">📝 留下后账</span>');
    if (j.kill) t.push('<span class="rv-tag">⚰️ 本周终结</span>');
    if (j.cdelta && j.cdelta.pot > 0) t.push(`<span class="rv-tag">🍳 ${tm.catchPot} +${j.cdelta.pot}</span>`);
    if (j.cdelta && j.cdelta.gang > 0) t.push(`<span class="rv-tag">⚔️ ${tm.gang} +${j.cdelta.gang}</span>`);
    if (j.cdelta && j.cdelta.gossip > 0) t.push(`<span class="rv-tag">🍉 ${tm.gossipAct} +${j.cdelta.gossip}</span>`);
    return t.join("");
  }

  function reviewStats(st) {
    const J = (st.journal || []).filter(j => j && typeof j === "object");
    const s = { total: J.length, dui: 0, pot: 0, ot: 0, fish: 0, follow: 0, auto: 0 };
    const moodByDay = {};
    J.forEach(j => {
      if (j.isDui && j.judged !== false) s.dui++;
      if (j.cdelta && j.cdelta.pot > 0) s.pot += j.cdelta.pot;
      if (j.overtime) s.ot++;
      if (j.delta && j.delta.fish > 0) s.fish++;
      if (j.round > 0) s.follow++;
      if (j.auto) s.auto++;
      moodByDay[j.day] = (moodByDay[j.day] || 0) + ((j.delta && j.delta.mood) || 0);
    });
    const days = Object.keys(moodByDay).map(Number);
    s.moodByDay = moodByDay;
    s.worst = days.length ? days.reduce((a, b) => moodByDay[a] <= moodByDay[b] ? a : b) : null;
    s.best = days.length ? days.reduce((a, b) => moodByDay[a] >= moodByDay[b] ? a : b) : null;
    return s;
  }

  // 老板线的关键词换成经营口径（同一套统计，换一套说法）
  const VERDICT_BOSS = {
    empty: "本周关键词：空白。你签了字，但没人知道签了什么。",
    dui: "本周关键词：拍板。你一句话定生死，会议室安静得能听见空调。",
    pot: "本周关键词：兜底。你替所有人挡了子弹，然后在简报里写成「主动担当」。",
    fish: "本周关键词：授权。你有大把时间，因为活儿都在别人桌上。",
    ot: "本周关键词：熬夜。整层楼的灯都灭了，只剩你这盏。",
    follow: "本周关键词：追问。你问的每一句「为什么」，都变成了下级的通宵。"
  };

  function reviewVerdict(s, job) {
    const boss = job === "boss";
    if (!s.total) return boss ? VERDICT_BOSS.empty : "本周关键词：空白。你不记得自己干了什么，公司也不记得。";
    if (s.dui >= 5) return boss ? VERDICT_BOSS.dui : "本周关键词：硬刚。你把聊天记录当证据，把会议记录当武器。";
    if (s.pot >= 3) return boss ? VERDICT_BOSS.pot : "本周关键词：接锅。你替所有人挡了子弹，没人给你发勋章。";
    if (s.fish >= 12) return boss ? VERDICT_BOSS.fish : "本周关键词：隐身。你在工位上完成了一次完美的消失。";
    if (s.ot >= 6) return boss ? VERDICT_BOSS.ot : "本周关键词：加班。这栋楼的夜灯，是你交的电费。";
    if (s.follow >= 8) return boss ? VERDICT_BOSS.follow : "本周关键词：被追问。你每句「收到」后面，都跟着一句「但是」。";
    return boss
      ? "本周关键词：经营。没有高光，也没有翻车——公司还在，你也还在。"
      : "本周关键词：活着。没有高光，也没有翻车——这就是大多数人的一周。";
  }

  // 关键词只做一处强调（琥珀下划线），其余是普通正文
  function verdictHtml(st, s) {
    const v = reviewVerdict(s, st.char.job);
    const m = v.match(/^本周关键词：(.+?)。(.*)$/);
    if (!m) return esc(v);
    return `本周关键词：<em>${esc(m[1])}</em>。${esc(m[2])}`;
  }

  // 统计条：竖线分隔的表格，不用中点串
  function tallyPairs(s, job) {
    const tl = T(job).tally;
    return [[s.total, "次选择"], [s.dui, tl.dui], [s.pot, tl.pot],
      [s.ot, tl.ot], [s.fish, tl.fish], [s.follow, tl.follow]].filter(x => x[0]);
  }

  function tallyHtml(s, job) {
    return `<div class="rv-tally">`
      + tallyPairs(s, job).map(x => `<div><b>${x[0]}</b><span>${x[1]}</span></div>`).join("")
      + `</div>`;
  }

  function scoreEntry(j) {
    const d = j.delta || {};
    const mag = ["mood", "kpi", "bond", "trust", "fish"].reduce((a, k) => a + Math.abs(d[k] || 0), 0);
    let score = mag;
    if (j.chain) score += 40;
    if (j.flags && j.flags.length) score += 26;
    if (j.kill) score += 200;
    if (j.cdelta && j.cdelta.pot > 0) score += 16 + j.cdelta.pot * 5;
    if (j.counters && j.counters.length) score += 12;
    if (j.isDui) score += 12;
    if (j.judged === false) score += 10;
    if (j.rarity === "epic") score += 14; else if (j.rarity === "rare") score += 7;
    if (j.round > 0) score += 5;
    if (j.auto) score += 9;
    return score;
  }

  function isConsequence(j) {
    return !!(j.chain || (j.flags && j.flags.length) || j.kill
      || (j.cdelta && j.cdelta.pot > 0) || (j.counters && j.counters.length));
  }

  function pickTop(J, n) {
    const scored = J.filter(j => j && typeof j === "object").map((j, i) => ({ j: j, i: i, score: scoreEntry(j) }));
    const byScore = scored.slice().sort((a, b) => b.score - a.score);
    const picked = [], usedDays = {};
    const take = (list, cap, ignoreDays) => {
      let c = 0;
      for (const x of list) {
        if (picked.length >= n || c >= cap) break;
        if (picked.indexOf(x) >= 0) continue;
        if (!ignoreDays && usedDays[x.j.day]) continue;
        usedDays[x.j.day] = true; picked.push(x); c++;
      }
    };
    take(byScore.filter(x => isConsequence(x.j)), 3);
    take(byScore, n - picked.length);
    take(byScore, n - picked.length, true);
    return picked.sort((a, b) => a.i - b.i);
  }

  const CAPTIONS = {
    kill: ["就是这一笔。心态归零，本周提前收工——连工位上的绿萝都不知道该替谁难过。",
           "收官之笔：你把自己用完了。邮箱还在，人已经下班（永久）了。"],
    chain: ["这句话被记下了。第二天，账单准时送到你桌上。",
            "你以为事情过去了？它只是被排进了明天的日程。"],
    flag: ["你答应了。在职场上，「答应」这两个字比合同还贵。",
           "你在这句话上签了字，利息下周结算。"],
    pot: ["锅本来不是你的，但你签收了，签得还挺体面。",
          "你伸手接住了那口锅，动作熟练得让人心疼。"],
    auto: ["你犹豫了几秒，系统替你选了最安全那个——怂，也是一种稳定输出。",
           "倒计时归零，你没选，于是算法替你体面地认了怂。"],
    duiWin: ["你把证据甩在桌上，全场安静三秒——这三秒是你这周唯一的高光。",
             "硬刚成功。你赢了这一局，代价写在下个季度的预算里。"],
    duiFail: ["你选择硬刚，然后被现实按着头补了一课。",
              "刚是刚了，就是没赢。"],
    judgeFail: ["运气站在了对面，你成了会议纪要里的反面案例。",
                "你赌了一把，庄家是领导。"],
    bigDown: ["这一天你经历了从「我可以」到「我为什么要」的全过程。",
              "一口气掉了这么多心态，这不是上班，这是潜水。"],
    bigUp: ["别高兴太早，公司发糖通常是为了下一巴掌。",
            "久违的正收益。你甚至开始怀疑自己是不是被优化名单漏掉了。"],
    overtime: ["灯还亮着。你以为你在拼事业，其实你在拼电费。"],
    fish: ["摸鱼值又涨了。你在工位上完成了本日最有效的一次消失。",
           "你在上班时间完成了自我修复，账单由公司承担。"],
    normal: ["平平无奇的一笔，但它确实消耗了你一天里的某个小时。"]
  };

  // 周报评语里的打工人口吻：老板线换成老板视角
  const CAPTIONS_BOSS = {
    judgeFail: ["运气站在了对面，你成了董事会纪要里的反面案例。",
                "你赌了一把，庄家是周期。"],
    bigUp: ["别高兴太早，账做平了不代表钱回来了。",
            "久违的正收益。你甚至开始怀疑这是不是会计的失误。"],
    bigDown: ["这一天你经历了从「我很有信心」到「我们先看看数据」的全过程。",
              "一口气掉了这么多现金流，这不是经营，这是跳水。"],
    fish: ["你在办公室里完成了本日最有效的一次消失。",
           "老板的摸鱼不叫摸鱼，叫「在外面找资源」。"],
    overtime: ["灯还亮着。你以为你在拼事业，其实你在拼估值。"]
  };

  const SPECIAL_CAPTIONS = {
    ev_gen_toilet: ["带薪如厕，公司付费。这是本周 ROI 最高的一笔。",
                    "你把生理需求做成了带薪项目，还提前达成了里程碑。"],
    ev_gen_toilet__boss: ["躲进楼梯间的那半小时，是本周唯一没人找你的时间。",
                          "你在楼梯间完成了本季度最高效的一次放空。"],
    ev_wang: ["王阿姨说完就走了，留你一个人在楼道里消化人生。",
              "扫地僧的金句，通常比季度复盘有用。"],
    ev_gen_milktea: ["你为团队凝聚力付了钱。团队记住了奶茶，没记住你。",
                     "奶茶到桌的那十分钟，是本周唯一的团队建设。"],
    ev_a_fubao: ["「福报」两个字被你记在笔记本最后一页，旁边画了个问号。",
                 "关于福报的讨论，最终结论是：先福报自己。"],
    ev_bo_allhands_pie: ["饼画得很大，落地的只有掌声。",
                         "你在台上讲复利，台下在算这个月房租。"],
    ev_gen_at_all: ["@所有人。你第一个回了「收到」，然后忘了这件事。",
                    "你打出「收到」的时候，手指比脑子快。"],
    ev_mid_morale: ["士气这东西涨得慢、掉得快，你两边都试过了。",
                    "你努力让团队开心，团队努力让你别看他们。"],
    ev_bo_family_call: ["孩子画里那个方块，比任何 KPI 都更像你。",
                        "「爸爸在开会」——这句话你今年已经说了几百遍。"],
    ev_bo_ai_replace: ["AI 不要加班费，也不要年终奖，它甚至不会在群里阴阳你。",
                       "你优化了岗位，也优化掉了几个会说真话的人。"],
    ev_bo_rival_dinner: ["那顿饭吃得很好，鱼没卷过，你有。"],
    ev_bo_audit_invoice: ["发票上的两个点，你选了最贵的那种省心。"]
  };

  function hashStr(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
    return h;
  }

  function captionOf(j, job) {
    const over = (job === "boss") ? CAPTIONS_BOSS : null;
    const d = j.delta || {};
    const mood = d.mood || 0;
    let pool;
    const pick = (name, def) => (over && over[name]) ? over[name] : def;
    if (j.kill) pool = CAPTIONS.kill;
    else if (j.chain) pool = CAPTIONS.chain;
    else if (j.flags && j.flags.length) pool = CAPTIONS.flag;
    else if (j.cdelta && j.cdelta.pot > 0) pool = CAPTIONS.pot;
    else if (SPECIAL_CAPTIONS[j.evId + (job === "boss" ? "__boss" : "")]) pool = SPECIAL_CAPTIONS[j.evId + (job === "boss" ? "__boss" : "")];
    else if (SPECIAL_CAPTIONS[j.evId]) pool = SPECIAL_CAPTIONS[j.evId];
    else if (j.auto) pool = CAPTIONS.auto;
    else if (j.isDui && j.judged === false) pool = CAPTIONS.duiFail;
    else if (j.isDui) pool = CAPTIONS.duiWin;
    else if (j.judged === false) pool = pick("judgeFail", CAPTIONS.judgeFail);
    else if (j.overtime) pool = pick("overtime", CAPTIONS.overtime);
    else if ((d.fish || 0) >= 6) pool = pick("fish", CAPTIONS.fish);
    else if (mood <= -12) pool = pick("bigDown", CAPTIONS.bigDown);
    else if (mood >= 8) pool = pick("bigUp", CAPTIONS.bigUp);
    else pool = CAPTIONS.normal;
    if (!pool || !pool.length) pool = CAPTIONS.normal;
    return pool[hashStr((j.evId || "") + j.slot + (j.text || "")) % pool.length];
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function momentHtml(st, x, n) {
    const j = x.j;
    const chips = topDeltas(j.delta, st.char.job), badges = topBadges(j, st.char.job);
    return `<li class="rv-moment">`
      + `<div class="rv-mhead"><span class="rv-no">${pad2(n)}</span>`
      + `<span class="rv-when">${Engine.DAY_NAMES[j.day]} · ${Engine.SLOT_LABELS[Engine.SLOT_KEYS[j.slot]] || ""}</span></div>`
      + `<div class="rv-ev">${esc(j.title || "")}</div>`
      + `<div class="rv-said">「${esc(j.text || "")}」</div>`
      + `<p class="rv-cap">${esc(captionOf(j, st.char.job))}</p>`
      + ((chips || badges) ? `<div class="rv-meta">${chips}${badges}</div>` : "")
      + `</li>`;
  }

  function fullEntryHtml(st, j) {
    return `<li class="rv-item">`
      + `<div class="rv-row1"><span class="rv-slot">${Engine.DAY_NAMES[j.day]} · ${Engine.SLOT_LABELS[Engine.SLOT_KEYS[j.slot]] || ""}</span>`
      + `<span class="rv-ev2">${esc(j.title || "")}</span></div>`
      + `<div class="rv-said">「${esc(j.text || "")}」</div>`
      + `<div class="rv-meta">${topDeltas(j.delta, st.char.job)}${entryTags(j, st.char.job)}</div></li>`;
  }

  // 计数器术语按职级：老板攒的不是「黑锅」，是「我兜的责任」；「刚值」是「拍板」
  const TERMS = {
    staff: {
      pot: "黑锅", gang: "刚值", gossip: "八卦",
      dui: "硬刚", duiFail: "硬刚失败", potPassed: "甩锅成功", catchPot: "接锅", timid: "认怂",
      gossipAct: "吃瓜", armed: "接锅时自动生效",
      tally: { dui: "次硬刚", pot: "次接锅", fish: "次摸鱼", ot: "次加班", follow: "次被追问" },
      copyChips: "黑锅", copyGang: "刚值", copyDui: "硬刚", copyPot: "接锅", copyOt: "加班"
    },
    boss: {
      pot: "担责", gang: "拍板", gossip: "风向",
      dui: "拍板硬顶", duiFail: "拍板被驳回", potPassed: "把责任归位", catchPot: "亲自兜底", timid: "暂缓决策",
      gossipAct: "听风", armed: "兜底时自动生效",
      tally: { dui: "次拍板", pot: "次兜底", fish: "次授权", ot: "次熬夜", follow: "次追问" },
      copyChips: "担责", copyGang: "拍板", copyDui: "拍板", copyPot: "兜底", copyOt: "熬夜"
    }
  };
  const T = (job) => TERMS[job === "boss" ? "boss" : "staff"];

  // 周报文案按职级：老板不打工，也不写「员工自制」的周报
  const REVIEW_COPY = {
    staff: {
      firm: "卷卷科技 · 员工自制", title: "打工周报", stamp: "自制", save: "保存周报图片",
      aria: "打工周报图片（点击保存后生成）", file: "打工周报", toast: "📋 打工周报图片已保存，快去分享呀",
      btn: "📋 本周周报", canvasFirm: "卷 卷 科 技 · 员 工 自 制", footer: "牛马求生记 · 一周打工闯关", docNo: "工单号 NIUMA-"
    },
    boss: {
      firm: "卷卷科技 · 本周经营纪要", title: "经营周报", stamp: "亲笔", save: "保存经营周报图片",
      aria: "经营周报图片（点击保存后生成）", file: "经营周报", toast: "📊 经营周报图片已保存，去发给投资人",
      btn: "📋 本周经营周报", canvasFirm: "卷 卷 科 技 · 本 周 经 营 纪 要", footer: "牛马求生记 · 赢家不需要解释", docNo: "文件编号 JJ-"
    }
  };
  const RC = (job) => REVIEW_COPY[job === "boss" ? "boss" : "staff"];

  // 兜底微事件（「无事发生」那一类）不算名场面，只计入总选择次数
  const isFillerEntry = (j) => {
    const id = (j && j.evId) || "";
    return id.indexOf("ev_fill_") === 0 || id.indexOf("__filler") === 0;
  };

  function showReview(st) {
    const rc = RC(st.char.job);
    const all = (st.journal || []).filter(j => j && typeof j === "object");
    const J = all.filter(j => !isFillerEntry(j));
    const fillerCount = all.length - J.length;
    const s = reviewStats(st);
    const persona = C().personas[st.char.persona];
    const moments = pickTop(J, 4);
    const shown = moments.map(x => x.i);
    const rest = pickTop(J.filter((j, i) => shown.indexOf(i) < 0), 6);
    const momentsHtml = moments.map((x, idx) => momentHtml(st, x, idx + 1)).join("");
    const restHtml = rest.map(x => fullEntryHtml(st, x.j)).join("");
    const empty = !J.length;

    $("#screen-review").innerHTML = `
      <div class="review-card">
        <div class="rv-band"></div>
        <div class="rv-body">
          <div class="rv-head">
            <div class="rv-firm">${rc.firm}</div>
            <h2 class="rv-title">${rc.title}</h2>
            <div class="rv-sub"><b>${esc(st.char.no)}</b> ${esc(st.char.name)}　${C().jobs[st.char.job].name}　${persona.emoji} ${esc(persona.title)}</div>
            <div class="rv-stamp">${rc.stamp}</div>
          </div>
          <p class="rv-verdict">${verdictHtml(st, s)}</p>
          ${empty ? '<p class="rv-empty">这一周没有留下任何名场面。</p>' : `
          ${tallyHtml(s, st.char.job)}
          <ul class="rv-moments">${momentsHtml}</ul>
          ${rest.length ? `<details class="rv-all"><summary>再看 ${rest.length} 条名场面（本周共 ${s.total} 次选择）</summary><ol class="rv-list">${restHtml}</ol></details>` : ""}`}
          <div class="btn-row">
            <button id="rv-save" class="btn primary">${rc.save}</button>
            <button id="rv-back" class="btn ghost">返回结局</button>
          </div>
          ${fillerCount ? `<p class="tips">另有 ${fillerCount} 次「无事发生」的碎片时间，没进名场面——它们也挺好，只是不值得写进周报。</p>` : ""}
          <p class="tips">图片可直接长按或右键保存分享 · 这份周报不经过${st.char.job === "boss" ? "董事会" : "贾总"}审批</p>
        </div>
        <canvas id="review-canvas" width="750" height="1240" style="display:none" role="img" aria-label="${rc.aria}"></canvas>
      </div>`;
    showScreen("screen-review");
    $("#rv-back").addEventListener("click", () => showScreen("screen-ending"));
    $("#rv-save").addEventListener("click", () => {
      drawReviewCard(st, s, moments);
      showImagePreview($("#review-canvas").toDataURL("image/png"), `${rc.file}-${st.char.name}-W${st.day}.png`, rc.title);
    });
  }

  // 存图：与页面同构（红带 + 抬头 + 斜章 + 统计条 + 编号卡片）
  function drawReviewCard(st, s, moments) {
    const rc = RC(st.char.job);
    const cv = $("#review-canvas");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
    const INK = "#e9e6df", INK2 = "#a8a49b", INK3 = "#948f85";
    const RED = "#e35b54", AMBER = "#d9a441";
    const SHEET = "#1a1d23", CARD = "#20242b", LINE = "#2b2f37";
    ctx.fillStyle = "#14161a"; ctx.fillRect(0, 0, W, H);
    // 纸面
    roundRect(ctx, 40, 34, W - 80, H - 68, 6); ctx.fillStyle = SHEET; ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = RED; ctx.fillRect(40, 34, W - 80, 7);
    ctx.textAlign = "left";
    ctx.fillStyle = INK3; ctx.font = `19px ${FONT}`;
    ctx.fillText(rc.canvasFirm, 78, 104);
    ctx.fillStyle = INK; ctx.font = `bold 40px ${FONT}`;
    ctx.fillText(rc.title, 78, 158);
    const persona = C().personas[st.char.persona];
    ctx.fillStyle = INK2; ctx.font = `20px ${FONT}`;
    ctx.fillText(`${st.char.no} ${st.char.name}　${C().jobs[st.char.job].name}　${persona.title}`, 78, 194);
    // 斜章
    ctx.save();
    ctx.translate(W - 130, 140); ctx.rotate(-.09);
    ctx.strokeStyle = RED; ctx.lineWidth = 3;
    roundRect(ctx, -56, -28, 112, 56, 5); ctx.stroke();
    ctx.fillStyle = RED; ctx.textAlign = "center";
    ctx.font = `bold 22px ${FONT}`; ctx.fillText("自制", 0, 8);
    ctx.restore();
    // 关键词行
    ctx.textAlign = "left";
    ctx.fillStyle = INK; ctx.font = `25px ${FONT}`;
    wrapText(ctx, reviewVerdict(s, st.char.job), 78, 252, W - 156, 36, 2);
    // 统计条（表格）
    const pairs = tallyPairs(s, st.char.job);
    const bw = (W - 156) / pairs.length, ty = 300, th = 66;
    ctx.fillStyle = CARD; roundRect(ctx, 78, ty, W - 156, th, 4); ctx.fill();
    ctx.strokeStyle = LINE; ctx.stroke();
    pairs.forEach((p, i) => {
      const cx = 78 + bw * i;
      if (i) { ctx.beginPath(); ctx.moveTo(cx, ty + 12); ctx.lineTo(cx, ty + th - 12); ctx.stroke(); }
      ctx.fillStyle = INK; ctx.font = `bold 24px ${FONT}`;
      ctx.fillText(String(p[0]), cx + 18, ty + 32);
      ctx.fillStyle = INK3; ctx.font = `17px ${FONT}`;
      ctx.fillText(p[1], cx + 18, ty + 54);
    });
    // 名场面卡片
    let top = 380;
    let lastBottom = top;
    moments.forEach((x, idx) => {
      const j = x.j;
      const ch = 176;
      ctx.fillStyle = CARD; roundRect(ctx, 78, top, W - 156, ch, 4); ctx.fill();
      ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = AMBER; ctx.font = `bold 19px ${FONT}`;
      ctx.fillText(pad2(idx + 1), 100, top + 32);
      ctx.fillStyle = INK3; ctx.font = `17px ${FONT}`;
      ctx.fillText(`${Engine.DAY_NAMES[j.day]} · ${Engine.SLOT_LABELS[Engine.SLOT_KEYS[j.slot]] || ""}`, 138, top + 32);
      ctx.fillStyle = INK; ctx.font = `bold 25px ${FONT}`;
      wrapText(ctx, j.title || "", 100, top + 66, W - 200, 30, 1);
      ctx.fillStyle = INK2; ctx.font = `20px ${FONT}`;
      wrapText(ctx, `「${j.text || ""}」`, 100, top + 94, W - 200, 26, 1);
      ctx.fillStyle = AMBER; ctx.fillRect(100, top + 110, 3, 44);
      ctx.fillStyle = INK; ctx.font = `21px ${FONT}`;
      wrapText(ctx, captionOf(j, st.char.job), 114, top + 130, W - 230, 25, 2);   // 必须带 job：否则导出的图片回落到员工评语
      const meta = topDeltaList(j.delta).map(d => deltaText(d, st.char.job)).concat(badgeList(j, st.char.job));
      if (meta.length) {
        ctx.fillStyle = INK2; ctx.font = `17px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(meta.join("   "), W - 100, top + 164);   // 标签统一放卡片右下角
        ctx.textAlign = "left";
      }
      lastBottom = top + ch;
      top += ch + 12;
    });
    cv.dataset.lastBlockEnd = String(lastBottom);
    // 页脚
    ctx.fillStyle = INK3; ctx.font = `19px ${FONT}`;
    ctx.fillText(rc.footer, 78, H - 74);
    ctx.textAlign = "right";
    ctx.fillText(`${rc.docNo}${st.char.no}-W${st.day}`, W - 78, H - 74);
    ctx.textAlign = "left";
  }
  // ---------- 结局分享卡（Canvas 手绘） ----------
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 分享卡上的评级块（老板只有形容词刻度；一线/中层用绩效分刻度）
  function drawGradeBlock(ctx, st, ending, W, FONT, rrect) {
    const gradeColor = { S: "#faad14", A: "#52c41a", B: "#69b1ff", C: "#bfbfbf", D: "#ff4d4f" }[ending.grade] || "#bfbfbf";
    ctx.textAlign = "center";
    if (st.char.job === "boss") {
      // 老板线「永不差评」：字母只是内部分档，最低档也得是暖色（C/D 不再映射成灰与红）
      const bossColor = { S: "#faad14", A: "#e8c46a", B: "#d9a441", C: "#c99a3f", D: "#b98a34" }[ending.grade] || "#d9a441";
      const ws = fitFontSize(ctx, ending.bossWord || "", W - 120, 44, 28, "bold", FONT);
      ctx.fillStyle = bossColor; ctx.font = `bold ${ws}px ${FONT}`;
      ctx.fillText(ending.bossWord, W / 2, 436);
      const bw = 150, gap = 12, totalW = Engine.BOSS_BANDS.length * bw + (Engine.BOSS_BANDS.length - 1) * gap;
      let x = (W - totalW) / 2;
      Engine.BOSS_BANDS.forEach(b => {
        const on = b.grade === ending.grade;
        ctx.fillStyle = on ? bossColor : "#20232c";
        rrect(ctx, x, 458, bw, 42, 8); ctx.fill();
        ctx.fillStyle = on ? "#12141a" : "#5f6275";
        ctx.font = `bold 24px ${FONT}`;
        ctx.fillText(b.word, x + bw / 2, 487);
        x += bw + gap;
      });
      ctx.fillStyle = "#8b8fa3"; ctx.font = `24px ${FONT}`;
      wrapText(ctx, ending.bossNote || "", W / 2, 532, W - 140, 30, 2);
      if (ending.bossSpin) {
        ctx.fillStyle = "#5f6275"; ctx.font = `22px ${FONT}`;
        wrapText(ctx, ending.bossSpin, W / 2, 588, W - 140, 28, 2);
      }
      return;
    }
    ctx.fillStyle = gradeColor; ctx.font = `bold 38px ${FONT}`;
    ctx.fillText(`评级 ${ending.grade} · 绩效 ${ending.perf}`, W / 2, 432);
    const bands = Engine.GRADE_BANDS;
    const bw = 104, gap = 10, totalW = bands.length * bw + (bands.length - 1) * gap;
    let x = (W - totalW) / 2;
    bands.forEach(b => {
      const on = b.grade === ending.grade;
      ctx.fillStyle = on ? gradeColor : "#20232c";
      rrect(ctx, x, 452, bw, 42, 8); ctx.fill();
      ctx.fillStyle = on ? "#12141a" : "#5f6275";
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillText(`${b.grade} ${b.label}`, x + bw / 2, 479);
      x += bw + gap;
    });
    if (st.char.job === "mid") {
      ctx.fillStyle = ending.luck ? "#faad14" : "#5f6275"; ctx.font = `22px ${FONT}`;
      const txt = ending.luck ? `🎲 绩效归因：${ending.luck.text}` : "🎲 绩效归因：本周没有意外，纯按表现核算。";
      wrapText(ctx, txt, W / 2, 528, W - 120, 28, 2);
    }
  }

  // 按可用宽度自动缩字号（卡面文字绝不被裁切）
  function fitFontSize(ctx, text, maxW, start, min, weight, FONT) {
    let size = start;
    for (;;) {
      ctx.font = `${weight ? weight + " " : ""}${size}px ${FONT}`;
      if (ctx.measureText(text).width <= maxW || size <= min) break;
      size -= 2;
    }
    return size;
  }

  function drawShareCard(st, ending) {
    const rc = RC(st.char.job);        // 分享卡页脚的文件编号也要按职级（老板＝文件编号 JJ-）
    const t = T(st.char.job);
    const cv = $("#share-canvas");
    const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    const FONT = '"PingFang SC", "Microsoft YaHei", sans-serif';
    // 背景
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#15171d"); g.addColorStop(.55, "#1b1e26"); g.addColorStop(1, "#111318");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 顶部红头带
    const band = ctx.createLinearGradient(0, 0, W, 0);
    band.addColorStop(0, "#ff5b5d"); band.addColorStop(.5, "#e04545"); band.addColorStop(1, "#7a2a2d");
    ctx.fillStyle = band; ctx.fillRect(0, 0, W, 14);

    const isBoss = st.char.job === "boss";
    ctx.textAlign = "center";
    ctx.fillStyle = "#7d8093"; ctx.font = `24px ${FONT}`;
    ctx.fillText(isBoss ? "卷 卷 科 技 · 本 周 经 营 情 况 通 报" : "卷 卷 科 技 · 一 周 生 存 鉴 定 报 告", W / 2, 66);

    // 工牌条
    ctx.fillStyle = "#20232c";
    roundRect(ctx, 50, 92, W - 100, 96, 16); ctx.fill();
    ctx.textAlign = "left";
    ctx.font = `44px ${FONT}`;
    ctx.fillText(C().personas[st.char.persona].emoji, 74, 156);
    ctx.fillStyle = "#eceef2"; ctx.font = `bold 34px ${FONT}`;
    ctx.fillText(st.char.name, 140, 136);
    const cardLine = `${st.char.no} · ${C().jobs[st.char.job].name} · ${C().personas[st.char.persona].title}`;
    const cardLineSize = fitFontSize(ctx, cardLine, W - 200, 22, 15, "", FONT);
    ctx.fillStyle = "#8b8fa3"; ctx.font = `${cardLineSize}px ${FONT}`;
    ctx.fillText(cardLine, 140, 168);
    ctx.fillStyle = "#52c41a";
    ctx.beginPath(); ctx.arc(W - 82, 128, 7, 0, Math.PI * 2); ctx.fill();

    // HERO：巨大结局（名字按宽度自适应，长标题不再被左右裁切）
    ctx.textAlign = "center";
    ctx.font = `140px ${FONT}`;
    ctx.fillText(ending.emoji, W / 2, 300);
    const nameSize = fitFontSize(ctx, ending.name, W - 90, 64, 30, "bold", FONT);
    cv.dataset.nameSize = String(nameSize);
    ctx.fillStyle = "#ffffff"; ctx.font = `bold ${nameSize}px ${FONT}`;
    ctx.fillText(ending.name, W / 2, 384);

    // 评级块（老板 / 一线·中层 两套刻度）
    drawGradeBlock(ctx, st, ending, W, FONT, roundRect);

    // 分隔虚线
    ctx.strokeStyle = "#2c2f3d"; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(60, 624); ctx.lineTo(W - 60, 624); ctx.stroke();
    ctx.setLineDash([]);

    // 金句块
    ctx.fillStyle = "#20232c";
    roundRect(ctx, 50, 640, W - 100, 106, 16); ctx.fill();
    ctx.fillStyle = "#e04545";
    roundRect(ctx, 50, 640, 8, 106, 4); ctx.fill();
    const line1 = ending.text.split("\n")[0];
    ctx.fillStyle = "#dcdee8"; ctx.font = `29px ${FONT}`;
    wrapText(ctx, line1, W / 2 + 4, 682, W - 170, 40, 2);

    // 人设专属收尾（同一个结局，不同人设说法完全不同）
    if (ending.epilogue) {
      ctx.fillStyle = "#20232c";
      roundRect(ctx, 50, 758, W - 100, 130, 16); ctx.fill();
      ctx.fillStyle = "#faad14";
      roundRect(ctx, 50, 758, 8, 130, 4); ctx.fill();
      ctx.textAlign = "left";
      const pe = C().personas[st.char.persona];
      ctx.fillStyle = "#faad14"; ctx.font = `22px ${FONT}`;
      ctx.fillText(pe.emoji + " " + pe.title + " · 专属收尾", 78, 792);
      ctx.fillStyle = "#c9cad4"; ctx.font = `25px ${FONT}`;
      wrapText(ctx, ending.epilogue, 78, 828, W - 160, 30, 3);
      ctx.textAlign = "center";
    }

    // 体检报告
    ctx.textAlign = "left";
    ctx.fillStyle = "#7d8093"; ctx.font = `22px ${FONT}`;
    ctx.fillText("本周体征", 60, 922);
    const L = statLabels(st.char.job);
    let y = 956;
    for (const k of ["mood", "kpi", "bond", "trust", "fish"]) {
      const v = Math.round(st.stats[k]);
      ctx.fillStyle = "#9a9db0"; ctx.font = `26px ${FONT}`;
      ctx.fillText(L[k], 60, y);
      ctx.fillStyle = "#2a2d3a";
      roundRect(ctx, 200, y - 18, 400, 18, 9); ctx.fill();
      ctx.fillStyle = statColor(k, v);
      roundRect(ctx, 200, y - 18, Math.max(8, 400 * Math.max(0, Math.min(100, v)) / 100), 18, 9); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = "right"; ctx.fillText(String(v), W - 60, y); ctx.textAlign = "left";
      y += 42;
    }

    // 战绩徽章
    const badges = [`🍳 ${t.pot} ×${st.pot}`, `⚔️ ${t.gang} ×${st.gang}`, `🏅 成就 ×${st.achievements.length}/${Engine.achievementsFor(st).length}`];
    let bx = 60;
    ctx.font = `24px ${FONT}`;
    badges.forEach(b => {
      const w = ctx.measureText(b).width + 34;
      ctx.fillStyle = "#20232c";
      roundRect(ctx, bx, 1130, w, 44, 22); ctx.fill();
      ctx.fillStyle = "#c9cad4";
      ctx.fillText(b, bx + 17, 1160);
      bx += w + 12;
    });

    // 成就 emoji 行
    ctx.font = `28px ${FONT}`;
    const gotEmojis = Engine.achievementsFor(st).filter(a => st.achievements.includes(a.id)).map(a => a.emoji).slice(0, 12);
    ctx.fillStyle = "#8b8fa3";
    ctx.fillText(gotEmojis.length ? gotEmojis.join(" ") : "（本周没解锁成就，但活下来了）", 60, 1210);

    // 公章：纯属虚构
    ctx.save();
    ctx.translate(W - 118, H - 68); ctx.rotate(-.24);
    ctx.strokeStyle = "rgba(224, 69, 69, .95)"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 48, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "rgba(224, 69, 69, .95)";
    ctx.textAlign = "center"; ctx.font = `bold 22px ${FONT}`;
    ctx.fillText("纯属", 0, -8); ctx.fillText("虚构", 0, 20);
    ctx.restore();

    // 页脚
    ctx.textAlign = "left";
    ctx.fillStyle = "#5f6275"; ctx.font = `24px ${FONT}`;
    ctx.fillText(isBoss ? "牛马求生记 · 赢家不需要解释" : "牛马求生记 · 活过这一周，就是胜利", 60, H - 74);
    ctx.fillStyle = "#3d404f"; ctx.font = `20px ${FONT}`;
    ctx.fillText(`${rc.docNo}${st.char.no}-W${st.day}`, 60, H - 40);
  }

  function wrapText(ctx, text, cx, y, maxW, lh, maxLines) {
    let line = "", yy = y, lines = 0;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) {
        if (maxLines && lines >= maxLines - 1) { ctx.fillText(line + "…", cx, yy); return; }
        ctx.fillText(line, cx, yy); line = ch; yy += lh; lines++;
      } else line += ch;
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  // ---------- 角色创建 ----------
  const SURNAMES = ["牛", "马", "朱", "皮", "赖", "甘", "来", "钟", "贾", "甄"];
  const GIVEN = ["有闲", "小冲", "奋进", "摸摸", "铁柱", "卷卷", "清醒", "不卷", "淡定", "搬砖"];
  function personasOfJob(jobId) {
    return Object.values(C().personas).filter(p => p.job === jobId);
  }

  function randomBadge() {
    const jobs = Object.keys(C().jobs);
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const list = personasOfJob(job);
    const depts = C().depts.map(d => d.id);
    return {
      job,
      persona: list[Math.floor(Math.random() * list.length)].id,
      dept: depts[Math.floor(Math.random() * depts.length)],
      name: SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)],
      no: "JJ" + String(1000 + Math.floor(Math.random() * 9000))
    };
  }

  let sel = { job: "staff", persona: "huang", dept: "tech", name: "牛有闲", no: "JJ0721" };

  let createStep = 1;
  function renderCreate(options = {}) {
    if (!options.preserve) createStep = 1;
    let jobs = "";
    Object.values(C().jobs).forEach(j => {
      jobs += `<div class="pick-card ${sel.job === j.id ? "on" : ""}" data-job="${j.id}" role="button" tabindex="0" aria-pressed="${sel.job === j.id}">
        <div class="pick-emoji">${j.emoji}</div>
        <div class="pick-main">
          <div class="pick-line"><span class="pick-name">${j.name}</span><span class="pick-tag">${j.tagline}</span></div>
          <div class="pick-goal">🎯 ${j.goal}</div>
        </div></div>`;
    });
    // 人设随职级切换：一线 5 种、中层 3 种、老板 3 种
    const list = personasOfJob(sel.job);
    if (!list.some(p => p.id === sel.persona)) sel.persona = list[0].id;
    let ps = "";
    list.forEach(p => {
      ps += `<div class="pick-card sm ${sel.persona === p.id ? "on" : ""}" data-persona="${p.id}" role="button" tabindex="0" aria-pressed="${sel.persona === p.id}">
        <div class="pick-emoji">${p.emoji}</div>
        <div class="pick-main">
          <div class="pick-line"><span class="pick-name">${p.name}</span></div>
          <div class="pick-tag">${p.title}</div>
        </div></div>`;
    });
    let depts = "";
    C().depts.forEach(d => {
      depts += `<option value="${d.id}" ${sel.dept === d.id ? "selected" : ""}>${d.emoji} ${d.name}</option>`;
    });
    $("#screen-create").innerHTML = `
      <div class="create-card">
        <h2>入职登记表 <span class="form-no">（卷卷科技 HR-001）</span></h2>
        <p class="create-step-info">${createStep === 1 ? "1 / 2 · 职级与人设" : "2 / 2 · 工牌与初始属性"}</p>
        <div class="create-stage ${createStep !== 1 ? "hidden" : ""}">
        <div class="sec-title">① 选择职级线</div>
        <div class="pick-grid jobs">${jobs}</div>
        <div class="sec-title">② 选择人设 <span class="sec-note">${C().jobs[sel.job].name}专属 · ${list.length} 种</span></div>
        <div class="pick-grid personas">${ps}</div>
        </div><div class="create-stage ${createStep !== 2 ? "hidden" : ""}">
        <p class="sec-note">${esc(C().jobs[sel.job].name)} · ${esc(C().personas[sel.persona].title)}</p>
        <div class="sec-title">③ 工牌信息</div>
        <div class="badge-form">
          <input id="in-name" aria-label="姓名" maxlength="6" value="${esc(sel.name)}" placeholder="姓名">
          <select id="in-dept" aria-label="部门">${depts}</select>
          <span class="badge-no">${esc(sel.no)}</span>
          <button id="btn-random" class="btn ghost sm">🎲 随机身份与工牌</button>
        </div>
        <div class="stat-preview" id="stat-preview"></div>
        </div>
        <div class="btn-row create-actions">
          <button id="btn-back" class="btn ghost">${createStep === 1 ? "返回" : "上一步"}</button>
          <button id="btn-create-next" class="btn primary ${createStep !== 1 ? "hidden" : ""}">下一步 · 工牌信息</button>
          <button id="btn-start" class="btn primary ${createStep !== 2 ? "hidden" : ""}">开始上班 🐂</button>
        </div>
      </div>`;
    const redraw = (focusSelector) => {
      const scrollY = window.scrollY;
      renderCreate({ preserve: true });
      window.scrollTo(0, scrollY);
      const focus = $(focusSelector);
      if (focus) focus.focus({ preventScroll: true });
    };
    const pickable = (el, apply) => {
      el.addEventListener("click", apply);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); apply(); }
      });
    };
    $$("#screen-create .pick-card[data-job]").forEach(el => {
      pickable(el, () => { sel.job = el.dataset.job; redraw('[data-job="' + sel.job + '"]'); });
    });
    $$("#screen-create .pick-card[data-persona]").forEach(el => {
      pickable(el, () => { sel.persona = el.dataset.persona; redraw('[data-persona="' + sel.persona + '"]'); });
    });
    $("#in-name").addEventListener("input", e => { sel.name = e.target.value; renderPreview(); });
    $("#in-dept").addEventListener("change", e => { sel.dept = e.target.value; renderPreview(); });
    $("#btn-random").addEventListener("click", () => { sel = randomBadge(); renderCreate(); window.scrollTo(0, 0); });
    $("#btn-create-next").addEventListener("click", () => { createStep = 2; renderCreate({ preserve: true }); window.scrollTo(0, 0); $("#btn-back").focus({ preventScroll: true }); });
    $("#btn-back").addEventListener("click", () => {
      if (createStep === 2) { createStep = 1; renderCreate({ preserve: true }); window.scrollTo(0, 0); $("#btn-create-next").focus({ preventScroll: true }); }
      else { showScreen("screen-title"); refreshTitle(); }
    });
    $("#btn-start").addEventListener("click", () => {
      $("#btn-start").disabled = true;
      if (document.activeElement) document.activeElement.blur();
      const cfg = JSON.parse(JSON.stringify(sel));
      cfg.name = cfg.name.trim() || "无名牛马";
      window.App.newGame(cfg);
    });
    renderPreview();
  }

  function previewStats() {
    const job = C().jobs[sel.job], persona = C().personas[sel.persona];
    const s = {};
    for (const k in job.stats) s[k] = job.stats[k];
    for (const k in (persona.mods || {})) s[k] = (s[k] || 0) + persona.mods[k];
    for (const k of ["mood", "kpi", "bond", "trust", "fish"]) s[k] = Math.max(5, Math.min(100, s[k]));
    return s;
  }

  function renderPreview() {
    // 创建页文案跟着职级：老板是「接手公司」，不是「入职报到」
    const isBossPick = sel.job === "boss";
    const startBtn = $("#btn-start");
    if (startBtn) startBtn.textContent = isBossPick ? "开始经营 👑" : "开始上班 🐂";
    const noEl = document.querySelector(".form-no");
    if (noEl) noEl.textContent = isBossPick ? "（卷卷科技 BD-001）" : "（卷卷科技 HR-001）";
    const s = previewStats();
    const L = statLabels(sel.job);
    const job = C().jobs[sel.job], persona = C().personas[sel.persona];
    let html = `<div class="pv-title">初始属性预览</div>`;
    html += `<div class="preview-quote">${persona.emoji} ${persona.name}「${persona.quote}」</div>`;
    html += statRows(s, sel.job);
    if (persona.skill) html += `<div class="skill" title="${persona.skill.desc}">${persona.skill.emoji} ${persona.skill.name}：${persona.skill.desc}</div>`;
    if (job.skill) html += `<div class="skill" title="${job.skill.desc}">${job.skill.emoji} ${job.skill.name}：${job.skill.desc}</div>`;
    html += `<div class="goal">🎯 本周目标：${job.goal}</div>`;
    $("#stat-preview").innerHTML = html;
  }

  function refreshTitle() {
    $("#btn-continue").classList.toggle("hidden", !window.GameState.hasSave());
    const last = $("#btn-last-ending");
    if (last) last.classList.toggle("hidden", !window.GameState.hasLastEnding());
  }

  // ---- 全局错误边界提示条 ----
  function showErrorBanner(text) {
    const el = $("#error-banner");
    if (!el) return;
    $("#error-text").textContent = text;
    el.classList.remove("hidden");
  }
  function hideErrorBanner() {
    const el = $("#error-banner");
    if (el) el.classList.add("hidden");
  }

  function updateTopbar(st) {
    // 标题页/创建页还没有存档，st 为 null：这里必须直接返回，
    // 否则音效开关等入口会抛 "Cannot read properties of null (reading 'slotIdx')"
    if (!st || !st.char) return;
    const slotKey = Engine.SLOT_KEYS[st.slotIdx] || "morning";
    $("#tb-day").textContent = `${Engine.DAY_NAMES[st.day]} · ${Engine.SLOT_LABELS[slotKey]}`;
    $("#player-avatar").textContent = C().personas[st.char.persona].emoji;
    $("#player-name").textContent = st.char.name;
    $("#profile-toggle").setAttribute("aria-label", `${st.char.name}，查看工牌、属性与目标`);
    $("#profile-toggle").title = st.char.name;
  }

  // Safari 的软键盘不总是改变布局视口；把创建页的操作条抬到可视区域。
  function updateKeyboardInset() {
    const vv = window.visualViewport;
    const editing = document.activeElement && document.activeElement.matches("#screen-create input, #screen-create select");
    const inset = vv && editing && vv.scale === 1 ? Math.max(0, innerHeight - vv.height - vv.offsetTop) : 0;
    document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
  }
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", updateKeyboardInset);
    window.visualViewport.addEventListener("scroll", updateKeyboardInset);
  }
  document.addEventListener("focusin", updateKeyboardInset);
  document.addEventListener("focusout", () => requestAnimationFrame(updateKeyboardInset));

  // 只暴露 main.js 实际调用的接口，其余保持模块内部
  return {
    showScreen, renderSidebar, renderEvent, renderFollowupRound,
    showDayTransition, renderSkillBar, showReply, showDayReport, showEnding,
    renderCreate, refreshTitle, updateTopbar, statLabels, toggleSound, showReview,
    // fitFontSize 仅供自动化测试校准卡片排版（不在产品流程中直接调用）
    showErrorBanner, hideErrorBanner, fitFontSize, confirmAction, showSettings
  };
})();
