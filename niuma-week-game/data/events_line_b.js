window.EV_LINE_B = [
  {
    "id": "ev_mid_report_killed", "series": "meeting", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【汇报】方向不对", "scene": "boss",
    "lines": [
      "你准备了三天的汇报，讲到第 2 页。",
      "贾总：「这个方向不对，重新讲。」——重新讲的意思是：重新做。"
    ],
    "choices": [
      { "text": "接住：「好的，我今晚重做」", "effects": { "trust": 5, "mood": -10, "fish": -6 },
        "chain": { "id": "ev_mid_chain_promise", "afterDays": 2 },
        "reply": "你微笑着合上 PPT。三天的心血，在「方向不对」四个字里归零。" },
      { "text": "追问：「能具体说说哪里不对吗」", "gang": 1, "isDui": true,
        "judge": { "base": 0.55,
          "successEffects": { "trust": 4, "bond": 6 },
          "successReply": "你说出了具体问题，贾总给出了具体方向。职场奇迹：一次对齐，真的对齐了。",
          "failEffects": { "mood": -8, "trust": -4 },
          "failReply": "贾总：「你先体会。」体会，是玄学的高级形态。" } },
      { "text": "先摸清贾总今天的心情再讲", "hidden": "jiquan",
        "effects": { "fish": 4, "trust": 2 },
        "reply": "你花十分钟看了贾总的朋友圈和今天点的下午茶，重新排了讲稿顺序。情报战，从茶水间开始。" }
    ]
  },
  {
    "id": "ev_mid_press_down", "series": "overtime", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【压活】三天能做完吧？", "scene": "im",
    "lines": [
      "贾总把一个新需求甩给你：「三天，能做完吧？」",
      "你看着团队已经排满的排期，把「不能」咽了回去。"
    ],
    "choices": [
      { "text": "硬着头皮压给团队，加三天班", "chain": { "id": "ev_mid_chain_promise", "afterDays": 2 }, "overtime": true,
        "effects": { "kpi": 6, "bond": -10, "mood": -8 },
        "reply": "你把活分下去时加了三个「辛苦」。团队回复「收到」的速度，比平时慢了两分钟。", "followup": {
          "lines": ["散会后，小王跟到茶水间，压低声音。", "小王：「哥，这活……到底是谁加的？」"],
          "choices": [
            { "text": "「客户临时加的」", "effects": { "bond": 3, "trust": -2, "mood": -3 },
              "reply": "小王「哦」了一声，转身走了。谎话很短，但它在你心里住了三天。" },
            { "text": "「是我在贾总面前没扛住」", "effects": { "bond": 10, "trust": -4, "mood": -5 },
              "reply": "小王愣了两秒：「……行，那我们一起做。」承认一次软弱，换来团队半年的信任，这笔买卖不亏。" },
            { "hidden": "baoyu", "text": "【发疯】「是你加的，你忘了？」", "gang": 1, "isDui": true,
              "effects": { "mood": 8, "bond": -6 },
              "reply": "小王的脸白了一下，然后笑了：「哥，你这招狠。」——你保住了上级，也保住了气势，唯独没保住那个加班的晚上。" }
          ,
            { "text": "「我去跟贾总要资源，别硬扛」", "hidden": "jiquan", "effects": { "trust": 4, "mood": 2, "bond": 4 }, "reply": "贾总批了一个外包名额。团队松了口气，你多了一个要管的供应商。" }
          ]
        } },
      { "text": "谈优先级：「做这个，就得放下那个」", "gang": 1, "isDui": true,
        "judge": { "base": 0.55,
          "successEffects": { "trust": 6, "bond": 8 },
          "successReply": "贾总想了想：「那先放那个。」管理，第一次像管理。",
          "failEffects": { "mood": -8, "trust": -6 },
          "failReply": "贾总：「都要做。」都要，就是都要你。" } },
      { "text": "排期表美化大法：悄悄挪走两件事", "hidden": "jiquan",
        "effects": { "fish": 8, "kpi": 4, "trust": 2 },
        "reply": "你动了一下排期的格子，像俄罗斯方块一样消掉了一层。没人发现，除了排期表本身。" }
    ]
  },
  {
    "id": "ev_mid_blame_pingpong", "series": "blame", "pool": "mid", "rarity": "common",
    "days": [2, 3, 4, 5, 6],
    "title": "【甩锅】技术口径问题", "scene": "chat",
    "lines": [
      "运营部把数据事故定性为「技术口径问题」——翻译：你们技术部的锅。",
      "实际原因：他们改了取数口径，没通知任何人。"
    ],
    "choices": [
      { "text": "当场拉群对质，甩出时间线", "gang": 1, "isDui": true,
        "judge": { "base": 0.6, "evidence": true,
          "successEffects": { "trust": 5, "bond": 8 },
          "successReply": "时间线甩出，锅当空转体三周半，回到运营部。你的团队在群里刷了一排「哥稳」。",
          "failEffects": { "mood": -8, "pot": 1 },
          "failReply": "对方总监开口：「先解决问题，再谈责任。」责任，被一个「先」字压住了。" }, "followup": {
          "lines": ["贾总私聊你。老板的私聊只有两种意思：夸你，或者让你背。", "贾总：「运营那边有点情绪，你处理一下。」"],
          "choices": [
            { "text": "去运营部当面喝杯茶，把话说圆", "effects": { "trust": 6, "bond": -4, "mood": -5 },
              "reply": "你在运营部坐了半小时，喝了杯凉的。事平了，锅也没了。" },
            { "text": "实事求是，把时间线再发一遍", "gang": 1, "isDui": true, "effects": { "trust": -4, "bond": 6, "mood": 5 },
              "reply": "你把时间线发到了合作群。运营总监回「收到」。你的团队第一次觉得，跟着你有底。" },
            { "text": "下次先内部对齐，再对外", "effects": { "trust": 4, "kpi": 2, "mood": -2 },
              "reply": "你学会了中层的第一个字：稳。代价是下一次锅来时，你少了一分锐气。" }
          ,
            { "text": "在群里@他，但说得很客气", "hidden": "shetou", "effects": { "trust": 3, "bond": -2, "mood": 3 }, "reply": "你那条消息用了三个「辛苦」和两个「感谢」。锅没动，但所有人都看懂了你什么意思。" }
          ]
        } },
      { "text": "先解决问题，回头再算账", "effects": { "kpi": 5, "trust": 3, "mood": -4 },
        "reply": "你带着团队两小时修完。复盘会上你说「我们先扛了」。五个字，团队记了很久。" },
      { "text": "【发疯】直接@对方老大：「口径谁改的？」", "hidden": "baoyu", "gang": 1, "isDui": true,
        "effects": { "bond": 10, "trust": -6, "mood": 8 },
        "reply": "群里安静两分钟。对方老大回复：「我改的，我们担。」有时候，就差一句直球。" }
    ]
  },
  {
    "id": "ev_mid_resign", "series": "story", "pool": "mid", "rarity": "rare",
    "days": [2, 3, 4, 5, 6],
    "title": "【挽留】骨干要走", "scene": "boss",
    "lines": [
      "你的骨干小王约你 1v1：「哥，我想出去看看。」",
      "他是团队最能打的人，也是上个月被你压了三次活的人。"
    ],
    "choices": [
      { "text": "谈心＋申请加薪留住",
        "judge": { "base": 0.5,
          "successEffects": { "bond": 8, "mood": 6 },
          "successReply": "加薪批了。小王留下来，看你的眼神多了点东西。钱能留人，真心能留心，都要。",
          "failEffects": { "bond": -12, "mood": -10 },
          "failReply": "加薪没批。小王还是走了，离职原因写：个人发展。你把「对不起」写在了心里。" } },
      { "text": "放他走：「去更好的地方」", "npc": { "an": 5 },
        "effects": { "bond": -8, "mood": -6, "trust": 4 },
        "reply": "你帮他改了推荐语。他走到电梯口回头说：「哥，对不起。」你摆摆手。牛马的缘分，到这里。" },
      { "text": "【发疯】陪他一起改简历", "hidden": "baoyu", "gang": 1, "isDui": true,
        "effects": { "bond": 10, "mood": 10, "trust": -6 },
        "reply": "你俩在会议室互相改简历，笑出了声。他没走成，你倒收到了两个面试邀请。" }
    ]
  },
  {
    "id": "ev_mid_pie_speaker", "series": "pua", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【画饼】传声筒", "scene": "chat",
    "lines": [
      "贾总在全员会画了个大饼，转头对你说：「你给大家解读解读。」",
      "解读一个连自己都不信的饼，这是中层的日常。"
    ],
    "choices": [
      { "text": "忠实传达，加上演技", "counter": "piesHeard",
        "effects": { "trust": 8, "bond": -8, "mood": -8 },
        "reply": "你把饼翻译成了三段论。团队听懂了饼，也听懂了你。" },
      { "text": "传达时加料：「做到就兑现」", "counter": "piesHeard",
        "judge": { "base": 0.5,
          "successEffects": { "bond": 8, "trust": 4 },
          "successReply": "团队士气上来了。你赌的是贾总不敢当众不认账。",
          "failEffects": { "bond": -10, "mood": -10 },
          "failReply": "有员工当众问：「上次的饼呢？」你被夹在中间，两面受气。" } },
      { "text": "【发疯】「这饼要吃到，先看这季度数据」", "gang": 1, "isDui": true,
        "effects": { "trust": -4, "bond": 10, "mood": 4 },
        "reply": "你把饼和 KPI 绑在一起讲。团队觉得真实，贾总觉得你懂他。双赢，罕见。" }
    ]
  },
  {
    "id": "ev_mid_resource_war", "series": "politics", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【资源】抢人大战", "scene": "ticket",
    "lines": [
      "新项目启动会变成了资源争夺战。",
      "市场部要你团队支援两周，产品部也要支援两周。你的团队，一共十个人。"
    ],
    "choices": [
      { "text": "各让一周，两头得罪一半", "effects": { "kpi": 2, "bond": -6, "mood": -6 },
        "reply": "你的团队像一块被掰开的蛋糕。两边的感谢，都只有一半。" },
      { "text": "拿数据说话：「排期已满，二选一」", "gang": 1, "isDui": true,
        "judge": { "base": 0.55,
          "successEffects": { "trust": 6, "mood": 4 },
          "successReply": "你甩出排期表，两个部门当场开会，决定自己解决。表格，有时候是武器。",
          "failEffects": { "trust": -8, "mood": -8 },
          "failReply": "两边一起找贾总告状。你的排期表成了呈堂证供——告你的那种。" } },
      { "text": "「可以支援，走外包预算」", "hidden": "jiquan",
        "effects": { "fish": 6, "trust": 4, "mood": 2 },
        "reply": "你把矛盾转移给了预算流程。两个月后审批下来，项目早黄了，完美。" }
    ]
  },
  {
    "id": "ev_mid_morale", "series": "story", "pool": "mid", "rarity": "common",
    "days": [2, 3, 4, 5, 6],
    "title": "【士气】没人说话的午休", "scene": "im",
    "lines": [
      "连续三周高压，团队午休没人说话，饭点没人动。",
      "实习生小卷偷偷问你：「哥，我们组是不是要没了？」"
    ],
    "choices": [
      { "text": "自费下午茶＋宣布「周五六点跑」", "effects": { "money": -1, "bond": 12, "mood": 6 },
        "reply": "奶茶下桌，灯准时熄。小卷说这是她入职以来最开心的一天。成本：一个月工资。", "followup": {
          "lines": ["奶茶喝完，小卷举手问了一个要命的问题。", "小卷：「哥，周五六点跑……以后每周都算数吗？」"],
          "choices": [
            { "text": "「算，我定成组规」", "chain": { "id": "ev_mid_chain_promise", "afterDays": 1 }, "flag": "fridayRule", "effects": { "bond": 10, "trust": -4, "mood": 4 },
              "reply": "你把「周五六点跑」写进了组内文档。三个月后你会知道：制度是你自己给自己挖的最体面的坑。" },
            { "text": "「这周特殊，下周看情况」", "effects": { "bond": -5, "trust": 2, "mood": -3 },
              "reply": "小卷「哦」了一声，把奶茶杯捏扁了。团队第一次觉得，你说的话要打七折。" },
            { "text": "【发疯】「不但算数，我请全组去看电影」", "gang": 1, "isDui": true,
              "effects": { "money": -1, "bond": 12, "mood": 8, "trust": -3 },
              "reply": "全组在影厅笑到前仰后合。你花了一个月工资，买到了这一周唯一真实的士气数据。" }
          ,
            { "text": "「算数，但先把这版做完」", "hidden": "baoyu", "effects": { "bond": 4, "kpi": 3, "mood": -2 }, "reply": "全组没说话，活干得比以前快。这就是你的管理风格：给一点甜，再压一座山。" }
          ]
        } },
      { "text": "带头冲刺，扛过去再说", "overtime": true,
        "effects": { "kpi": 8, "bond": -8, "mood": -10 },
        "reply": "「再冲一周。」你第无数次说这句话。这句话的信用额度，快刷爆了。" },
      { "text": "表率式卷入：「我陪你们一起」", "hidden": "shetou", "overtime": true,
        "effects": { "kpi": 6, "bond": 6, "mood": -12 },
        "reply": "你的灯亮到最晚。士气没崩，你先哑了嗓子。团队看你的眼神：心疼，但没人敢劝。" }
    ]
  },
  {
    "id": "ev_mid_layoff_list", "series": "story", "pool": "mid", "rarity": "epic",
    "days": [4, 5, 6], "cond": { "trustLt": 40 },
    "title": "【名单】裁两个，周五前", "scene": "boss",
    "lines": [
      "安小姐把名单递给你：「从你团队出两个，本周五前。」",
      "你扫了一眼，两个名字都是你心里标过「重点培养」的。"
    ],
    "choices": [
      { "text": "争取替代方案：「降本不裁员」", "gang": 1, "isDui": true,
        "judge": { "base": 0.45,
          "successEffects": { "bond": 12, "trust": -6, "mood": 8 },
          "successReply": "你用数据争到了替代方案。安小姐说，你是第一个敢还价的中层。",
          "failEffects": { "mood": -14, "bond": -10 },
          "failReply": "方案被驳回。你还得亲手去谈。这次谈完，你删掉了自己写的「管理心得」文档。" } },
      { "text": "执行，谈的时候尽量体面", "npc": { "an": 5 },
        "effects": { "trust": 6, "bond": -16, "mood": -14 },
        "reply": "你谈了两次，请了两次咖啡，说了两次「对不起」。体面，是刀鞘。刀还是刀。" },
      { "text": "「我打个电话」", "hidden": "jiquan", "npc": { "an": -6 },
        "effects": { "trust": 8, "mood": 2, "bond": 4 },
        "reply": "第二天，名单上你团队的名字消失了，换成了别的部门。你不想知道电话里说了什么。" }
    ]
  },
  {
    "id": "ev_mid_up_resource", "series": "politics", "pool": "mid", "rarity": "rare",
    "days": [2, 3, 4, 5, 6],
    "title": "【要人】换来的大饼", "scene": "boss",
    "lines": [
      "你向贾总申请加两个人，换来一顿一小时的大饼。",
      "「人手的问题，要用效率解决。」——效率，就是让现有的人更累。"
    ],
    "choices": [
      { "text": "谢谢贾总，回去自己消化", "effects": { "mood": -10, "bond": -4 },
        "reply": "你回工位把大饼切成小块，分给了团队的排期表。" },
      { "text": "再争取一次，用离职率数据", "gang": 1, "isDui": true,
        "judge": { "base": 0.5,
          "successEffects": { "trust": 5, "bond": 8 },
          "successReply": "离职率曲线放出来，贾总沉默了：「招一个吧。」数据不会画饼，所以偶尔能赢饼。",
          "failEffects": { "mood": -10, "trust": -4 },
          "failReply": "贾总：「数据要看趋势。」趋势：继续没人，继续累。" } },
      { "text": "「那我跟老领导那边借两个人」", "hidden": "jiquan", "npc": { "jia": -4 },
        "effects": { "trust": 8, "mood": 6 },
        "reply": "贾总：「不用不用，我这边想想办法。」第二天，HC 批了。世界的运行方式，深不可测。" }
    ]
  },
  {
    "id": "ev_mid_sandwich", "series": "story", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【夹心】上下夹击", "scene": "im",
    "lines": [
      "上午贾总骂你「管理太软」，下午团队说你「胳膊肘往外拐」。",
      "你坐在中间，像一块被两片面包嫌弃的火腿。"
    ],
    "choices": [
      { "item": "coffee", "text": "下楼走一圈，买杯咖啡", "effects": { "mood": 8, "fish": 4, "money": -0.5 },
        "reply": "你绕着公司走了一圈，看完了一整条街的猫。回来接着当火腿。另一杯你没喝，塞进抽屉，留给下午三点的自己。", "followup": {
          "lines": ["工位还没坐热，贾总的消息就来了。", "贾总：「听人说你刚才下楼了？管理层要稳。」"],
          "choices": [
            { "text": "「去楼下买咖啡，顺便想方案」", "effects": { "trust": 4, "mood": -4 },
              "reply": "贾总回：「好，注意效率。」——在职场，「顺便」两个字能救命，也能买时间。" },
            { "text": "「我去缓了十分钟，不然我会炸」", "effects": { "trust": -5, "mood": 7, "bond": 4 },
              "reply": "贾总没回。第二天他给你加了一项「情绪管理」的隐性考核，但团队知道你没装，反而更服你。" },
            { "hidden": "baoyu", "text": "【发疯】「我在做市场调研，调研猫」", "gang": 1, "isDui": true,
              "effects": { "mood": 10, "trust": -6, "fish": 3 },
              "reply": "贾总回了一个问号，然后把你拉进了一个叫「创新思考群」的新群。没人知道那个群是干嘛的。" }
          ,
            { "text": "上楼汇报，把锅说成机会", "hidden": "jiquan", "chain": { "id": "ev_chain_pua_remember", "afterDays": 1 }, "effects": { "trust": 5, "bond": -4, "mood": 2 }, "reply": "贾总听完点头：「你这个人，会看大局。」团队在楼下等你，看你的眼神有点复杂。" }
          ]
        } },
      { "text": "找安小姐聊聊「管理困惑」", "npc": { "an": 5 },
        "effects": { "mood": 6, "trust": 2 },
        "reply": "安小姐微笑着听完，说：「夹心层都这样。」安慰的方式，是确认大家都惨。" },
      { "text": "【发疯】在管理群发「今天被上下夹击」", "gang": 1, "isDui": true,
        "effects": { "mood": 8, "bond": 6, "trust": -4 },
        "reply": "群里破天荒安静，然后中层同事们排着队点赞。原来大家都在夹，只是没人说。" }
    ]
  },
  {
    "id": "ev_mid_chain_promise", "series": "blame", "pool": "mid", "rarity": "epic",
    "days": [3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【连锁】查无此话", "scene": "boss",
    "lines": [
      "贾总在会上：「上次说的方向，不是这个呀。」",
      "上次他说的是哪个？没有记录。会议室里，只有空气记得。"
    ],
    "choices": [
      { "text": "当场复述当时的原话", "gang": 1, "isDui": true,
        "judge": { "base": 0.55, "evidence": true,
          "successEffects": { "trust": 4, "mood": 6 },
          "successReply": "你的记忆力和表达能力同时在线。贾总：「哦，那是我记错了。」四个字，千金重。",
          "failEffects": { "mood": -10, "kpi": -6 },
          "failReply": "「总之现在这个不对。」总之，是领导力的终极词汇。" } },
      { "text": "认下，回去做第三版", "pot": 1,
        "effects": { "kpi": -8, "mood": -12 },
        "reply": "你回去开第三版。第一版死了，第二版陪葬，第三版在难产。" },
      { "text": "会后发邮件「确认会上结论」", "hidden": "jiquan",
        "effects": { "trust": 6, "fish": 4, "mood": 4 },
        "reply": "邮件发出，十分钟后收到回复「按邮件为准」。从此，你的嘴不再是记录仪，邮件才是。" }
    ]
  },
  {
    "id": "ev_mid_nap", "series": "fish", "pool": "mid", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["noon"], "timer": 6,
    "title": "【偷闲】中层的十分钟", "scene": "im",
    "lines": [
      "下午 1 点，你在小会议室躺平了十分钟。",
      "门外传来脚步声——听起来，像贾总的。"
    ],
    "choices": [
      { "text": "弹起来，假装研究白板", "timid": true,
        "effects": { "mood": 6, "fish": 6, "trust": 2 },
        "reply": "你用 0.5 秒完成从躺平到深思的姿态切换。白板上什么都没有，你的眼神很专业。" },
      { "text": "继续躺，反锁门", "judge": { "base": 0.5,
          "successEffects": { "mood": 10, "fish": 8 },
          "successReply": "脚步声走远了。十分钟后你满血复活，无人知晓。",
          "failEffects": { "mood": -6, "trust": -4 },
          "failReply": "敲门声响起：「里面有人吗？」你：「有……在开电话会。」" } },
      { "text": "让助理在门口守着", "hidden": "shetou",
        "effects": { "fish": 10, "mood": 8, "bond": -6 },
        "reply": "助理在门口替你拦了三个找你的人。关系户的中层，连午睡都有编制。" }
    ]
  }
];
