// 关系回响：前面的选择会在后面的普通时段回来找你。
window.EV_RELATIONS = [
  {
    id: "ev_rel_juan_blame", pool: "general", series: "blame", rarity: "rare", weight: 6,
    days: [1, 2, 3, 4], scene: "chat", title: "【会议】小卷被点名",
    lines: ["例会上，一份被改过三次的材料出了错。署名栏里只剩实习生小卷。", "小卷：「我提交的时候，不是这个版本……」", "赖前辈把杯子放下：「先别解释，谁署名谁负责。」"],
    choices: [
      { text: "「先核对记录，这次我来说明」", pot: 1, flag: "juanProtected", npc: { juan: 8 },
        chain: { id: "ev_rel_juan_logs", afterDays: 1 }, effects: { trust: 2, bond: 4, mood: -4 },
        reply: "你接住了这次点名，也接住了一口锅。散会时，小卷没有说谢谢，只把原始文件夹又检查了一遍。" },
      { text: "先逐项核对流程，别急着给人定责", npc: { juan: 3 }, effects: { kpi: 2, mood: -2 },
        reply: "会又开了二十分钟。材料里的问题找出来两个，署名里的问题，暂时没人提。" },
      { text: "让小卷自己把经过说完", npc: { juan: -3 }, effects: { trust: 2, bond: -3, mood: 1 },
        reply: "你把话筒推了过去。小卷讲得磕磕绊绊，赖前辈看了三次表。会议纪要最后只写：加强新人培养。" }
    ]
  },
  {
    id: "ev_rel_juan_logs", pool: "general", series: "story", rarity: "rare", scheduledOnly: true,
    days: [2, 3, 4, 5, 6], scene: "im", title: "【私信】小卷发来一个文件夹",
    cond: { flag: "juanProtected", npcGte: { juan: 5 } },
    lines: ["小卷：「上次你替我说明情况，我没忘。」", "小卷：「我找到了原始提交日志，谁改了哪里，时间都在。你留一份吧。」"],
    choices: [
      { text: "收下日志，另存一份", flag: "juanLogs", npc: { juan: 2 },
        chain: { id: "ev_rel_juan_review", afterDays: 1 }, effects: { mood: 3, kpi: 2 },
        reply: "你给文件夹起名「最终版_真的最终版」，又备份了一份。小卷回了个握拳表情。这次，证据没有只活在聊天窗口里。" },
      { text: "让他先保管，我把时间线记下来", npc: { juan: 1 },
        chain: { id: "ev_rel_juan_review", afterDays: 1 }, effects: { bond: 2, trust: 1 },
        reply: "你记下了几个时间点，没把文件另存。小卷说「需要的时候找我」。这句话，暂时比公司的知识库可靠。" }
    ]
  },
  {
    id: "ev_rel_juan_review", pool: "general", series: "blame", rarity: "rare", scheduledOnly: true,
    days: [3, 4, 5, 6, 7], scene: "chat", title: "【复盘】那份材料又回来了",
    cond: { flag: "juanProtected" },
    lines: ["复盘会上，赖前辈再次提起那份材料：「这次得有个明确结论。」", "小卷看向你。上回你替他说过的话，这回他也带了回来。"],
    choices: [
      { text: "贴出小卷给的原始日志", cond: { flag: "juanLogs" }, npc: { juan: 3 },
        effects: { trust: 6, kpi: 3, mood: 6 },
        reply: "提交时间、修改账号、版本差异，三列排得整整齐齐。赖前辈停了两秒：「那就按记录来。」上次你护住了一个人，这次他护住了事实。" },
      { text: "请小卷一起把经过说明白", npc: { juan: 2 }, effects: { bond: 4, trust: 2, mood: -3 },
        reply: "你们把时间线从头说了一遍。没人鼓掌，但会议纪要终于写上了两个人的名字，而不是只留一个人的责任。" },
      { text: "先补齐材料，再申请核对版本", effects: { kpi: 4, trust: 1, mood: -5 },
        reply: "你保住了今天的交付，把争议记进了待办。待办没有自己消失，至少这次你也没有假装忘记。" }
    ]
  },
  {
    id: "ev_rel_lai_deleted", pool: "staff", series: "blame", rarity: "epic", scheduledOnly: true,
    days: [2, 3, 4, 5, 6, 7], scene: "im", title: "【后账】共享记录不见了",
    cond: { flag: "laiChallenged" },
    lines: ["赖前辈：「上次你在群里补分工，我记得很清楚。」", "你打开共享文件：历史版本不见了，编辑权限也被收回。", "赖前辈：「没有记录的事，别再拿到会上说。」"],
    choices: [
      { text: "调出之前另存的版本和确认记录", cond: { flag: "recordsBackedUp" },
        effects: { trust: 5, kpi: 2, mood: 8 },
        reply: "你没有去问谁删了文件，只把备份和确认记录贴了出来。赖前辈发来一条「收到」。你以前多做的那一步，今天替你少受了一次气。" },
      { text: "请小卷补回原始日志", cond: { flag: "juanLogs" }, npc: { juan: 3 },
        effects: { bond: 5, trust: 4, mood: 4 },
        reply: "小卷把日志发到你们的小窗：「我一直留着。」你们没有在群里争吵，版本记录已经把话说完了。" },
      { text: "找管理员申请恢复历史版本", judge: { base: 0.65, evidence: true,
          successEffects: { trust: 4, mood: 5 }, successReply: "管理员从备份里找到了记录。你提交恢复申请时写的是「排查版本问题」，没有写「排查前辈」。大家都看懂了。",
          failEffects: { mood: -5, kpi: -3 }, failReply: "管理员说旧记录暂时恢复不了。你先补了三小时材料，把申请单号留了下来。求助有成本，沉默也有。" } },
      { text: "先重做一版，保住今天的交付", pot: 1, effects: { kpi: 4, mood: -8 },
        reply: "你花了一下午把文件重做出来。记录没找回来，新的交付又署上了你的名字。锅也跟着来了。" }
    ]
  }
];
