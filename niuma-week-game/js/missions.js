// 每局可选的小目标，只奖励档案贴纸，不改变属性、概率和评级。
window.Missions = (function () {
  const goals = [
    { id: "six_replies", emoji: "📨", name: "已读，已回", desc: "完成 6 次事件回复（含追问与超时回复）。", target: 6,
      hit: j => j.kind === "choice" },
    { id: "speak_up", emoji: "📣", name: "嘴替上线", desc: "成功硬刚 2 次。", target: 2,
      hit: j => j.kind === "choice" && j.isDui && j.judged !== false },
    { id: "take_break", emoji: "🐟", name: "忙里偷闲", desc: "通过事件回复，实际增加摸鱼值／自由度 2 次。", target: 2,
      hit: j => j.kind === "choice" && j.delta.fish > 0 },
    { id: "good_mood", emoji: "🌱", name: "精神小绿洲", desc: "通过事件回复，实际恢复心态 3 次。", target: 3,
      hit: j => j.kind === "choice" && j.delta.mood > 0 },
    { id: "good_company", emoji: "🤝", name: "搭子养成记", desc: "通过事件回复，实际增加人缘／士气 3 次。", target: 3,
      hit: j => j.kind === "choice" && j.delta.bond > 0 },
    { id: "keep_receipt", emoji: "🧾", name: "这事我留痕了", desc: "保留会议摘要或小卷日志，或获得一支录音笔。", target: 1, jobs: ["staff"],
      hit: j => j.kind === "choice" && (j.flags.some(f => ["recordsBackedUp", "juanLogs"].includes(f)) || (j.newItems || []).includes("recorder")) }
  ];
  const get = id => goals.find(g => g.id === id);
  const available = st => goals.filter(g => !g.jobs || g.jobs.includes(st.char.job));
  function describe(st, id) {
    const fish = st.char.job === "boss" ? "自由度" : "摸鱼值";
    const bond = { staff: "人缘", mid: "团队士气", boss: "员工士气" }[st.char.job];
    return get(id).desc.replace("摸鱼值／自由度", fish).replace("人缘／士气", bond);
  }
  function offer(st) {
    // 独立伪随机流：不消耗游戏 Math.random，不改变剧情抽取与概率判定。
    let seed = 2166136261;
    for (const c of [st.startTs, st.char.no, st.char.job, st.char.persona].join(":")) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
    const pool = available(st).slice();
    for (let i = pool.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const j = seed % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { version: 1, offered: pool.slice(0, 2).map(g => g.id), selected: [], status: "pending", progress: {} };
  }
  function normalize(st) {
    const m = st.missions, ids = new Set(available(st).map(g => g.id));
    const offered = [...new Set((Array.isArray(m?.offered) ? m.offered : []).filter(id => ids.has(id)))];
    // 旧局从接受时开始计数；旧结局不补发目标，也不篡改原始记录。
    if (!m || offered.length !== 2 || !["pending", "accepted", "ignored"].includes(m.status)) return st.done ? null : offer(st);
    const selected = m.status === "accepted" ? offered.filter(id => Array.isArray(m.selected) && m.selected.includes(id)) : [];
    const status = m.status === "accepted" && !selected.length ? "ignored" : m.status;
    const progress = Object.fromEntries(selected.map(id => [id,
      Number.isInteger(m.progress?.[id]) ? Math.max(0, Math.min(get(id).target, m.progress[id])) : 0]));
    return { version: 1, offered, selected, status, progress };
  }
  function accept(st, ids) {
    if (st.done || st.missions?.status !== "pending" || !Array.isArray(ids)) return false;
    const selected = st.missions.offered.filter(id => ids.includes(id));
    st.missions = { ...st.missions, status: selected.length ? "accepted" : "ignored", selected,
      progress: Object.fromEntries(selected.map(id => [id, 0])) };
    return true;
  }
  function update(st, entry) {
    const m = st.missions, completed = [];
    if (m?.status !== "accepted") return completed;
    for (const id of m.selected) {
      const g = get(id);
      if (m.progress[id] >= g.target || !g.hit(entry)) continue;
      if (++m.progress[id] === g.target) completed.push(id);
    }
    return completed;
  }
  function completed(st) {
    const m = st.missions;
    return m?.status === "accepted" ? m.selected.filter(id => get(id) && m.progress[id] >= get(id).target) : [];
  }
  return { catalog: () => goals.map(({ hit, jobs, ...g }) => g), get, describe, offer, normalize, accept, update, completed };
})();
