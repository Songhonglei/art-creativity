window.CHARACTERS = {
  jobs: {
    staff: {
      id: "staff", startItem: "resign", name: "一线牛马", emoji: "🐂", tagline: "被安排得明明白白",
      desc: "需求是你的，锅是你的，功劳是别人的。",
      goal: "活过绩效周，别进优化名单",
      stats: { mood: 85, kpi: 60, bond: 55, trust: 50, fish: 50, money: 1.0 }
    },
    mid: {
      id: "mid", startItem: "resign", name: "中层夹心", emoji: "🥪", tagline: "上有贾总，下有团队",
      desc: "向上汇报、向下压活，两头挨打还得微笑。",
      goal: "不当背锅侠 + 团队不被团灭",
      stats: { mood: 75, kpi: 65, bond: 60, trust: 60, fish: 40, money: 2.0 },
      skill: { id: "intercept", name: "背锅拦截", emoji: "🛡️",
        desc: "甩锅事件中发动：锅在空中被你优雅转移，黑锅不+1，团队士气-10（每局1次）",
        uses: 1, trigger: "manual_blame", arm: "intercept" }
    },
    boss: {
      id: "boss", startItem: "exit", name: "老板本板", emoji: "👑", tagline: "对投资人讲故事，对员工画饼",
      desc: "现金流是命，士气是气，投资人信任是融资的底气。",
      goal: "现金流≥62 + 投资人信任≥75 + 员工士气≥35",
      stats: { mood: 70, kpi: 50, bond: 60, trust: 55, fish: 45, money: 3.0 },
      skill: { id: "pie", name: "画饼大师", emoji: "🥧",
        desc: "任意事件发动：员工士气+10（每局2次）；首次发动约2天后出现反噬剧情，后果由选项决定（本周至多1次，临近结局可能不触发）",
        uses: 2, trigger: "manual_any", effects: { bond: 10 },
        schedule: { eventId: "ev_chain_pie_backlash", afterDays: 2 }, counter: "piesDrawn" }
    }
  },

  // 人设按职级分化：一线 5 种 / 中层 3 种 / 老板 3 种
  // rules 是引擎可读的被动规则，skill 是技能；不再用角色 id 硬编码逻辑
  personas: {
    /* ---------- 一线牛马 ---------- */
    huang: {
      id: "huang", job: "staff", name: "黄老实", emoji: "🐂", title: "老实巴交",
      quote: "好的，收到，马上改。",
      desc: "不敢拒绝，活得最累。全公司的「方便帮个忙吗」都精准降落在你头上。",
      mods: { mood: 5, kpi: 8, bond: -10 },
      skill: { id: "silent", name: "闷声干活", emoji: "🤐",
        desc: "甩锅事件中发动：本次接锅不掉 KPI，改为心态-10（每局2次）",
        uses: 2, trigger: "manual_blame", arm: "silent" },
      rules: { potMagnet: true }
    },
    zhen: {
      id: "zhen", job: "staff", name: "甄刚", emoji: "🧨", title: "00后整顿职场",
      quote: "我已读，但我乱回。",
      desc: "该怼就怼，仲裁函是你的毕业证。上班可以，受气不行。",
      mods: { kpi: -5, fish: 10, trust: -20 },
      skill: { id: "arbitration", name: "仲裁预告", emoji: "⚖️",
        desc: "心态将被一击打穿时自动触发：把心态稳在10，并回敬对方（每局1次）",
        uses: 1, trigger: "auto_mood" },
      rules: { moodGuard: 10, rebel: true }
    },
    zhan: {
      id: "zhan", job: "staff", name: "詹油", emoji: "🐟", title: "老油条·摸鱼大师",
      quote: "这不是我的锅，是流程的锅。",
      desc: "工龄十年，锅过留痕。向上管理十级学者，甩锅界乒乓球冠军。",
      mods: { bond: 20, fish: 35, kpi: -10, money: 0.5 },
      skill: { id: "upmanage", name: "向上管理", emoji: "🎩",
        desc: "被动：概率判定成功率+35%；每天第一次人缘收益翻倍",
        uses: 99, trigger: "passive" },
      rules: { judgeBonus: 0.35, firstBondMul: 2 }
    },
    cai: {
      id: "cai", job: "staff", name: "蔡优秀", emoji: "📈", title: "卷王·卷心菜",
      quote: "好的贾总，我今晚再看看。",
      desc: "领导的贴心小棉袄，同事眼里的卷心菜。卷是卷了点，但晋升也是真的快。",
      mods: { kpi: 15, trust: 10, mood: -15 },
      skill: { id: "ppt", name: "PPT 大法", emoji: "🖥️",
        desc: "被动：周五汇报Boss事件收益+50%；晚间加班抉择解锁隐藏选项",
        uses: 99, trigger: "passive" },
      rules: { bossReportMul: 1.5 }
    },
    jin: {
      id: "jin", job: "staff", name: "金汤匙", emoji: "🥄", title: "关系户·皇亲国戚",
      quote: "这事儿……我打个电话问问。",
      desc: "出事有人兜底，但同事看你的眼神都自带距离感。",
      mods: { trust: 40, kpi: -20, bond: -15, fish: 15, money: 2.0 },
      skill: { id: "backup", name: "有人罩我", emoji: "📞",
        desc: "致命打击自动触发：一通神秘电话替你挡下（每局1次）",
        uses: 1, trigger: "auto_lethal" },
      rules: { saveLethal: true }
    },

    /* ---------- 中层夹心 ---------- */
    shetou: {
      id: "shetou", job: "mid", name: "苗甜嘴", emoji: "🍯", title: "口蜜腹剑",
      quote: "辛苦你了，这个锅我们一起扛（你扛）。",
      desc: "会上永远第一个支持你，会后永远第一个转发你的问题给老板。",
      mods: { trust: 15, bond: -15 },
      skill: { id: "smile_dagger", name: "笑里藏刀", emoji: "🗡️",
        desc: "甩锅事件中发动：锅被你笑着转给同级，黑锅不+1，团队士气-10（每局2次）",
        uses: 2, trigger: "manual_blame", arm: "intercept" },
      rules: {}
    },
    baoyu: {
      id: "baoyu", job: "mid", name: "雷震霆", emoji: "⛈️", title: "狂风暴雨",
      quote: "这个我不听解释，我只看结果！",
      desc: "开会拍桌子是你的管理风格，团队的战栗是你的 KPI 润滑剂。",
      mods: { kpi: 12, mood: -10, bond: -15 },
      skill: { id: "slam", name: "拍桌子", emoji: "👊",
        desc: "甩锅事件中发动：当场拍桌，本次判定必定成功（每局2次）",
        uses: 2, trigger: "manual_blame", arm: "forceJudge" },
      rules: { rebel: true }
    },
    jiquan: {
      id: "jiquan", job: "mid", name: "苟向上", emoji: "🪜", title: "鸡犬升天",
      quote: "跟对人，比做对事重要。",
      desc: "你的站队技术全公司第一：跟着谁，谁升；你也就跟着升。",
      mods: { trust: 30, kpi: -8, bond: -10 },
      skill: { id: "hug_leg", name: "抱大腿", emoji: "🦵",
        desc: "被动：一切上级信任的正向收益 +50%",
        uses: 99, trigger: "passive" },
      rules: { trustMul: 1.5 }
    },

    /* ---------- 老板本板 ---------- */
    normal: {
      id: "normal", job: "boss", name: "尚正常", emoji: "🙂", title: "正常老板",
      quote: "大家辛苦了，早点下班。",
      desc: "这周唯一一个记得员工也是人的老板。稀有度：传说。",
      mods: { mood: 15, bond: 20, kpi: -10, trust: -10 },
      skill: { id: "empathy", name: "好好说话", emoji: "💬",
        desc: "任意事件发动：把话说清楚，心态+10、员工士气+8（每局2次）",
        uses: 2, trigger: "manual_any", effects: { mood: 10, bond: 8 } },
      rules: {}
    },
    biantai: {
      id: "biantai", job: "boss", name: "常加班", emoji: "😈", title: "变态老板",
      quote: "我都是凌晨三点睡的，你们为什么不行？",
      desc: "把「狼性」当企业文化，把「福报」当工资发。员工在你眼里是耗材。",
      mods: { kpi: 15, trust: 10, mood: -15, bond: -20 },
      skill: { id: "pressure", name: "极限施压", emoji: "🔥",
        desc: "任意事件发动：本月现金流+12，员工士气-10（每局2次）",
        uses: 2, trigger: "manual_any", effects: { kpi: 12, bond: -10 } },
      rules: {}
    },
    feiren: {
      id: "feiren", job: "boss", name: "冷资本", emoji: "🤖", title: "不是人的老板",
      quote: "情绪不产生现金流。",
      desc: "你已经完成了从人到资本的进化。财报比你的人更值得关心。",
      mods: { kpi: 25, trust: 20, bond: -25, mood: -20, money: 1 },
      skill: { id: "cost_cut", name: "降本增效", emoji: "✂️",
        desc: "任意事件发动：投资人信任+12，员工士气-12（每局2次）",
        uses: 2, trigger: "manual_any", effects: { trust: 12, bond: -12 } },
      rules: {}
    }
  },

  depts: [
    { id: "tech", name: "技术部", emoji: "💻", flavor: "改bug" },
    { id: "product", name: "产品部", emoji: "📱", flavor: "写PRD" },
    { id: "ops", name: "运营部", emoji: "📣", flavor: "背数据" },
    { id: "market", name: "市场部", emoji: "💸", flavor: "花钱" },
    { id: "finance", name: "财务部", emoji: "🧾", flavor: "卡报销" }
  ],
  npcs: {
    jia: { name: "贾总", emoji: "🧔", role: "画饼大师·VP" },
    chang: { name: "常改", emoji: "📝", role: "产品经理" },
    jinba: { name: "金爸爸", emoji: "🤵", role: "客户·甲方爸爸" },
    lai: { name: "赖前辈", emoji: "🦝", role: "老资历·抢功专家" },
    an: { name: "安小姐", emoji: "🗡️", role: "HR 小姐姐·微笑刀客" },
    juan: { name: "小卷", emoji: "🐣", role: "实习生" },
    wang: { name: "王阿姨", emoji: "🧹", role: "保洁·扫地僧" },
    lisa: { name: "Lisa", emoji: "📞", role: "神秘猎头" },
    zhao: { name: "赵资本", emoji: "💼", role: "资本方代表" },
    chen: { name: "陈老", emoji: "🎩", role: "董事会元老" },
    qian: { name: "钱总", emoji: "🚬", role: "竞对老板" },
    zhou: { name: "老周", emoji: "🔧", role: "供应商" },
    liu: { name: "财务刘姐", emoji: "📒", role: "财务负责人" }
  },
  // 台词里允许被解析为「发言人」的前缀白名单：其余带冒号的行按系统旁白渲染
  speakers: [
    "贾总", "常改", "金爸爸", "赖前辈", "安小姐", "小卷", "王阿姨", "Lisa",
    "赵资本", "陈老", "钱总", "老周", "董事会", "董事会陈老", "财务刘姐", "财务老周", "猎头Lisa",
    "投资人", "客户", "领导", "前台", "保安", "HR", "你", "@所有人",
    "银行App", "后台数据", "线上 P0", "PPT", "系统", "员工", "孩子"
  ],
  items: {
    coffee: { name: "浓缩咖啡", emoji: "☕", desc: "心态+15" },
    cookie: { name: "小饼干", emoji: "🍪", desc: "人缘+8", descBoss: "员工士气+8" },
    film: { name: "防窥膜", emoji: "📵", desc: "被动：摸鱼类判定成功率 +20%", descBoss: "被动：自由度类判定成功率 +20%" },
    recorder: { name: "录音笔", emoji: "🎤", desc: "被动：「掏证据」类判定必成功" },
    resign: { name: "辞职信", emoji: "📄", desc: "底牌：随时打出，直接裸辞" },
    exit: { name: "退出协议", emoji: "📜", desc: "底牌：把股份卖给下一位梦想家，套现离场" },
    report: { name: "体检报告", emoji: "🩺", desc: "被动：免除一次强制加班或团建", descBoss: "被动：下一次熬夜的心态损失减半" }
  }
};
