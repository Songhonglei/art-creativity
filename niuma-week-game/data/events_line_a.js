window.EV_LINE_A = [
  {
    "id": "ev_a_fubao", "series": "pua", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【画饼】福报论", "scene": "boss",
    "lines": ["全员会上，贾总说：「加班不是问题，问题是你要学会享受加班。」", "「这是福报，年轻人。」"],
    "choices": [
      { "text": "鼓掌，眼睛里进了一点福报", "counter": "piesHeard",
        "effects": { "trust": 6, "mood": -10 },
        "reply": "你鼓掌的手是热的，心是凉的。福报，先记账上。", "followup": {
          "lines": ["散会时贾总拍了下你的肩。", "贾总：「很好，明天给我一份『福报落地计划』。」"],
          "choices": [
            { "text": "今晚就写出来", "flag": "promisedReport", "overtime": true, "chain": { "id": "ev_flag_overpromise", "afterDays": 1 },
              "effects": { "kpi": 6, "trust": 5, "mood": -8 },
              "reply": "你写完时楼下只剩保安。这份计划第二天被贾总转发到大群——署名是你的，功劳是「团队」的。" },
            { "text": "明天上午给", "flag": "promisedReport", "effects": { "trust": 2, "mood": 2 },
              "reply": "你给自己留了一晚。第二天上午交，贾总说「下次快一点」。" },
            { "hidden": "zhen", "text": "【发疯】我打算先福报自己一晚", "gang": 1, "isDui": true,
              "effects": { "mood": 12, "trust": -7, "bond": 6 },
              "reply": "贾总笑了三秒，然后把这个笑话讲给了别的老板听。你成了会议段子。" }
          ,
            { "text": "今晚就出一版《福报落地方案》", "hidden": "cai", "overtime": true, "chain": { "id": "ev_flag_overpromise", "afterDays": 1 }, "effects": { "kpi": 4, "trust": 5, "mood": -8 }, "reply": "贾总第二天把方案转发到了大群，署名是你的，功劳是「团队」的。" }
          ]
        } },
      { "text": "低头记笔记，就记下「福报」俩字", "effects": { "trust": 3, "mood": -4 },
        "reply": "你把这两个字记在了笔记本最后一页，旁边画了个问号。" },
      { "text": "【发疯】举手：「福报能折现吗」", "hidden": "zhen", "gang": 1, "isDui": true,
        "effects": { "trust": -8, "mood": 12, "bond": 8 },
        "reply": "全场憋笑憋出内伤。贾总：「……这个问题很有意思。」意思是：你等着。" }
    ]
  },
  {
    "id": "ev_a_young", "series": "pua", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【画饼】你还年轻", "scene": "im",
    "lines": ["贾总：「这次晋升没你，别灰心，你还年轻。」", "「年轻人，机会还很多。」——具体是哪一年，他没说。"],
    "choices": [
      { "text": "谢谢领导的画……鼓舞", "counter": "piesHeard", "effects": { "mood": -8, "trust": 4 },
        "reply": "你把「谢谢」说得很标准，标准得像客服。" },
      { "text": "追问：「那我什么时候算不年轻？」", "effects": { "trust": -5, "mood": 5 },
        "reply": "贾总端起茶杯，用喝茶回避了这个问题。" },
      { "text": "主动请缨：「我还有精力，下次给我」", "hidden": "cai", "counter": "piesHeard",
        "effects": { "trust": 8, "mood": -12, "kpi": 4 },
        "reply": "卷王的自我修养：别人吃不到的饼，我先垫垫肚子。" }
    ]
  },
  {
    "id": "ev_a_scold", "series": "pua", "pool": "staff", "rarity": "epic",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【名场面】我骂你是为你好", "scene": "boss",
    "lines": ["周会上，贾总指着你的方案：「这做的什么东西？」", "「我这么骂你，是为你好。别的人，我懒得说。」"],
    "choices": [
      { "text": "低头认错，脸皮当铠甲", "effects": { "mood": -15, "trust": 5 },
        "reply": "你说「收到」的声音很稳，手在桌子底下抖。铠甲，是会生锈的。", "followup": {
          "lines": ["骂完三分钟，贾总语气一转。", "贾总：「……行了，晚上一起吃个饭？」"],
          "choices": [
            { "text": "去，全程听他讲创业史", "chain": { "id": "ev_chain_pua_remember", "afterDays": 1 }, "effects": { "trust": 6, "mood": -8, "bond": 3 },
              "reply": "你听了两小时「我当年睡公司地板」。饭后他拍你肩膀：「你这孩子不错。」——原来骂人和请你吃饭，是同一套流程。" },
            { "text": "「今晚有安排，改天」", "effects": { "trust": -4, "mood": 6, "fish": 3 },
              "reply": "贾总「哦」了一声。你保住了晚上八点到十一点的自由，代价是下周例会的第一个点名。" },
            { "hidden": "zhen", "text": "【发疯】「贾总，骂完请吃饭算加班吗」", "gang": 1, "isDui": true,
              "effects": { "mood": 10, "trust": -7 },
              "reply": "贾总笑了：「你这孩子，会算账。」当晚他没请你，但你成了他嘴里「有点意思」的那个人。" }
          ,
            { "text": "「我出去抽根烟，回来再受训」", "hidden": "zhan", "effects": { "mood": 5, "fish": 3, "trust": -3 }, "reply": "你在楼下抽了十分钟，回来时贾总已经忘了骂到哪儿。有时候躲一下，比硬扛有效。" }
          ]
        } },
      { "text": "冷静追问：具体哪里有问题，我记一下", "gang": 1, "isDui": true,
        "judge": { "base": 0.55,
          "successEffects": { "trust": 4, "mood": 2 },
          "successReply": "你用专业击穿情绪，逐条追问。贾总：「……你先坐下。」坐下，是胜利。",
          "failEffects": { "mood": -10, "trust": -4 },
          "failReply": "贾总：「你这是态度问题！」——翻译：别问，问就是态度。" } },
      { "text": "把录音笔轻轻放到桌上", "needItem": "recorder", "gang": 1, "isDui": true,
        "effects": { "trust": -10, "mood": 10 },
        "reply": "会议室安静得能听见录音笔的电流声。贾总：「今天先到这。」" }
    ]
  },
  {
    "id": "ev_a_credit", "series": "exclude", "pool": "staff", "rarity": "rare",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【背刺】功劳去哪了", "scene": "chat",
    "lines": ["大群里，赖前辈发了份《项目总结》，获得领导点赞。", "里面 80% 是你干的活，署名只有他。"],
    "choices": [
      { "text": "算了，牛不跟人争", "effects": { "mood": -12, "bond": 2 },
        "reply": "你在心里给自己发了个奖。奖杯是空气的，但心态是真的碎。", "followup": {
          "lines": ["走廊上，赖前辈追了上来。", "赖前辈：「刚才那事儿，我可没抢啊。」"],
          "choices": [
            { "text": "「我知道，是流程的问题」", "effects": { "bond": 4, "mood": 2 },
              "reply": "赖前辈松了口气，顺手把「流程」两个字也揽了一半。你们谁都没提功劳，但都笑得很客气。" },
            { "text": "「那您帮我说一句？」", "effects": { "bond": 5, "trust": -2, "mood": -3 },
              "reply": "第二天早会上，赖前辈真的替你说了。他说的方式是：「你这次也参与了，虽然主要是执行。」——你谢了他。" },
            { "hidden": "zhen", "text": "【发疯】「那下次我抢您的」", "gang": 1, "isDui": true,
              "effects": { "mood": 8, "bond": -5, "trust": 2 },
              "reply": "赖前辈愣住，然后笑了：「行啊，你学得快。」从那天起，他看你的眼神变了——从俯视，变成了平视。" }
          ,
            { "text": "「要不我问问家里，能不能打个招呼」", "hidden": "jin", "effects": { "trust": 5, "mood": 5, "gossip": 1 }, "reply": "第二天那份功劳的邮件被补发了一遍，你的名字在第一个。没人问为什么。" }
          ]
        } },
      { "text": "群里礼貌补充：「我补充几点分工」", "gang": 1, "isDui": true,
        "judge": { "base": 0.6,
          "successEffects": { "bond": 6, "trust": 4 },
          "successReply": "你礼貌而致命地列出了分工表。赖前辈的表情管理，崩了一角。",
          "failEffects": { "mood": -8 },
          "failReply": "赖前辈回：「年轻人别太计较。」计较少年，记住了。" },
        "npc": { "lai": -10 } },
      { "text": "私聊贾总：「家里让我问问项目分工」", "hidden": "jin",
        "effects": { "trust": 6, "mood": 4 }, "npc": { "lai": -10 },
        "reply": "贾总秒回：「分工我看过了，你贡献很大。」关系户的含金量。" }
    ]
  },
  {
    "id": "ev_a_nodoc", "series": "exclude", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【排挤】自己悟", "scene": "im",
    "lines": ["你需要核心文档，赖前辈说：「你自己找找呀。」", "你找了一圈：有权限的没内容，有内容的没权限。"],
    "choices": [
      { "text": "挨个找人要权限，磨一天", "effects": { "kpi": -6, "mood": -8, "fish": -6 },
        "reply": "你用一天时间解锁了一份文档。文档不难，难的是人心。" },
      { "text": "当面找赖前辈要", "judge": { "base": 0.5,
          "successEffects": { "bond": 4, "mood": 4 },
          "successReply": "当着领导的面，赖前辈不好拒绝：「发你了。」权力，是要当面使的。",
          "failEffects": { "mood": -8 },
          "failReply": "「我最近忙，你问小王吧。」小王说问前辈。球，又回来了。" } },
      { "text": "自己反推一份「逻辑推导版」", "hidden": "zhan", "effects": { "fish": 6, "kpi": 4, "mood": 4 },
        "reply": "你花两小时反推了一份文档，细节对不上，开会够用了。油条的智慧。" }
    ]
  },
  {
    "id": "ev_a_kitchen_isolate", "series": "exclude", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【排挤】哦，是你啊", "scene": "im",
    "lines": ["你端着杯子进茶水间，聊天的资深同事们停下话头。", "「哦，是你啊。」语气像在念工号。"],
    "choices": [
      { "text": "微笑点头，接水就走", "effects": { "mood": -5 },
        "reply": "你接了半杯水，端回工位。水是温的，人是凉的。" },
      { "text": "自来熟，主动加入话题", "judge": { "base": 0.45,
          "successEffects": { "bond": 6, "gossip": 2 },
          "successReply": "你接了个梗，居然接住了。人群的墙，有时候就差一个梗。",
          "failEffects": { "mood": -8 },
          "failReply": "你接的梗，冷场了。茶水间的空气，比冰美式还凉。" } },
      { "text": "【发疯】「聊什么呢，带我一个」", "gang": 1, "isDui": true,
        "effects": { "bond": 4, "mood": 4 },
        "reply": "一秒安静后，有人噗嗤笑了。孤立，有时候缺的只是一个敢开口的人。" }
    ]
  },
  {
    "id": "ev_a_bug", "series": "blame", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【甩锅】这谁写的？", "scene": "chat",
    "lines": ["线上出 bug，群里炸了。", "领导第一句：「这是谁写的代码？」——署名是你。"],
    "choices": [
      { "text": "先修后说", "effects": { "kpi": 4, "mood": -8, "trust": 3 },
        "reply": "你两小时修复上线。等甩锅大会开始时，路修好了，锅追不上你。", "followup": {
          "lines": ["复盘会照常召开，会议主题措辞严谨：", "「本次线上问题的归因与改进」。"],
          "choices": [
            { "text": "主动认领「流程待完善」", "pot": 1, "effects": { "trust": 4, "mood": -6 },
              "reply": "你替所有人把锅接住了。会后有人拍你：「哥，稳。」你笑着，心里在记账——这口锅，你签收了。" },
            { "text": "甩出一份《上线检查清单》", "effects": { "kpi": 3, "trust": 3, "mood": -3 },
              "reply": "清单做得又快又全，会上一致通过。从此这份清单成了规矩——也成了你以后每次上线都要填的表。" },
            { "hidden": "zhen", "text": "【发疯】「谁写的谁举手，我先举一半」", "gang": 1, "isDui": true,
              "effects": { "mood": 9, "trust": -5, "bond": 5 },
              "reply": "全场哄堂大笑，气氛瞬间松弛。领导也笑了，笑完在纪要里写：「当事人已认识到问题。」" }
          ,
            { "text": "「是我写的，我认」", "hidden": "huang", "effects": { "trust": 5, "mood": -10, "bond": 3 }, "reply": "会场上安静了几秒。领导点点头：「有这个态度就好。」——老实人的代价，永远是自己付。" }
          ]
        } },
      { "text": "查日志，自证是上游数据问题", "gang": 1, "isDui": true,
        "judge": { "base": 0.55,
          "successEffects": { "trust": 4, "mood": 8 },
          "successReply": "日志清清楚楚：上游数据格式变了。锅，当庭改判。",
          "failEffects": { "mood": -10, "pot": 1 },
          "failReply": "日志显示，确实是你的代码。技术不撒谎，这是它最讨厌的地方。" } },
      { "text": "认了：「是我没测到位」", "hidden": "huang", "pot": 1,
        "effects": { "mood": -10, "trust": 6, "kpi": -4 },
        "reply": "黄老实定理又双叒生效：锅是你的，奖励是大家的。" }
    ]
  },
  {
    "id": "ev_a_req_change", "series": "blame", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3],
    "title": "【埋雷】就改一点点", "scene": "im",
    "lines": ["常改：「就改一点点，不改逻辑的，很快。」", "这是本周第三次「一点点」。"],
    "choices": [
      { "text": "帮他改了，懒得留书面记录", "effects": { "kpi": 3, "mood": -4 },
        "chain": { "id": "ev_chain_change_delete", "afterDays": 2 },
        "reply": "你三分钟改完。记录？什么记录？改需求不需要记录，需要回忆。" },
      { "text": "要求补需求文档，留痕", "npc": { "chang": -8 },
        "effects": { "trust": 3, "mood": 2 },
        "reply": "常改不情不愿补了文档。周一的你，救了周四的你。" },
      { "text": "【发疯】先说清楚：改完验收标准别变", "hidden": "zhen", "gang": 1, "isDui": true, "npc": { "chang": -5 },
        "effects": { "trust": -4, "mood": 6 },
        "reply": "你把丑话说在前面。常改嘴上说「好好好」，眼神说「牛马」。" }
    ]
  },
  {
    "id": "ev_a_client_voice", "series": "client", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【客户】60秒语音×5", "scene": "chat",
    "lines": ["金爸爸发来 5 条微信语音，每条 60 秒。", "第 4 条的要点是：第 1-3 条作废，以第 5 条为准。"],
    "choices": [
      { "text": "认真听完，逐条转文字", "effects": { "kpi": 4, "mood": -10, "fish": -6 },
        "reply": "40 分钟后，你获得了一份 2000 字的需求，和轻微的耳鸣。", "followup": {
          "lines": ["金爸爸：「对了，还有几点补充。」", "又是 3 条 60 秒语音。"],
          "choices": [
            { "text": "继续听，听到麻木", "effects": { "kpi": 5, "mood": -8 },
              "reply": "你听完时，已经掌握了这个项目 90% 的废话和 10% 的关键点。" },
            { "text": "打个电话，让他一次说完", "judge": { "base": 0.55,
                "successEffects": { "trust": 4, "mood": 8, "kpi": 2 },
                "successReply": "金爸爸在电话里说了 4 分钟，效率比 8 条语音高十倍。他最后说：「早该打电话的。」",
                "failEffects": { "mood": -8, "trust": -4 },
                "failReply": "金爸爸：「我在开会。」电话挂了，语音又来了两条。" } },
            { "text": "转文字后写摘要发回去确认", "effects": { "kpi": 4, "mood": -3, "trust": 3 },
              "reply": "你把 8 条语音变成 12 行文字，金爸爸回：「对，就是这样。」——史上第一次需求对上了。" }
          ,
            { "text": "把八条语音整理成需求文档", "hidden": "cai", "chain": { "id": "ev_chain_change_delete", "afterDays": 1 }, "effects": { "kpi": 5, "mood": -6 }, "reply": "文档交出去，第二天就被改了三处。你终于理解为什么大家都不爱写文档。" }
          ]
        } },
      { "text": "转给实习生：「练练听力」", "hidden": "zhan", "npc": { "juan": -5 },
        "effects": { "bond": -4, "fish": 8, "mood": 4 },
        "reply": "小卷听完发来 600 字总结。人才，就是这么被用的。" },
      { "text": "【发疯】回文字：「请发文字版，为了留痕」", "gang": 1, "isDui": true, "npc": { "jinba": -5 },
        "effects": { "mood": 6 },
        "reply": "金爸爸发来三个字：「真麻烦。」——但发的是文字版。" }
    ]
  },
  {
    "id": "ev_a_client_eve", "series": "client", "pool": "staff", "rarity": "epic",
    "days": [2, 4],
    "title": "【客户】验收前夜全部推翻", "scene": "boss",
    "lines": ["晚上 10 点，金爸爸：验收前我们再对一下。", "「这个方向，能不能全部推翻重来？明天要。」"],
    "choices": [
      { "text": "通宵改", "effects": { "mood": -20, "kpi": 10, "trust": 8 },
        "reply": "凌晨 4 点，你交出一版新的。金爸爸：「嗯，还是第一版好。」", "followup": {
          "lines": ["早上 9 点，贾总把你叫进小会议室。", "贾总：「客户还是要第一版。那你昨晚干的那些……算什么？」"],
          "choices": [
            { "text": "「算我们项目的过山车」", "effects": { "mood": 6, "trust": 2 },
              "reply": "贾总被逗笑了：「你还挺会说话。」——用一句玩笑保住自己的精神状态，是牛马的高级技能。" },
            { "text": "「算加班成本，请记工时」", "money": 0.5, "effects": { "kpi": 2, "trust": -4, "mood": 3 },
              "reply": "贾总看了你两秒：「记上吧。」工时记上了，你的名字也记上了——两种记法，你选了贵的那种。" },
            { "hidden": "zhen", "text": "【发疯】「算我给您表演的行为艺术」", "gang": 1, "isDui": true,
              "effects": { "mood": 11, "trust": -6, "bond": 5 },
              "reply": "走廊里有人笑出了声。贾总摆摆手让你出去，转身却在项目群里发了你的名字——这次是「能扛」。" }
          ,
            { "text": "「我先睡，明早再想」", "hidden": "zhan", "effects": { "mood": 8, "fish": 5, "trust": -4 }, "reply": "你睡了六小时，醒来发现贾总半夜自己改完了。有些活，你不接就真的会有人接——偶尔值得赌一把。" }
          ]
        } },
      { "text": "摆事实：推翻要走变更流程，加钱加时间", "gang": 1, "isDui": true,
        "judge": { "base": 0.5,
          "successEffects": { "mood": 8, "trust": 3 },
          "successReply": "金爸爸沉默半分钟：「那……按原版。」你省下了一个通宵。",
          "failEffects": { "mood": -8, "trust": -8 },
          "failReply": "金爸爸：「跟你们老板说！」——老板：跟你们甲方说！" } },
      { "text": "打给金爸爸：「哥，我家里说……」", "hidden": "jin", "npc": { "jinba": 5 },
        "effects": { "trust": 6, "mood": 8 },
        "reply": "金爸爸态度 180 度转弯：「都是自己人，不急。」神秘的电话，神秘的力量。" }
    ]
  },
  {
    "id": "ev_a_meeting_brain", "series": "meeting", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【脑暴】你的想法呢？", "scene": "ticket",
    "lines": ["脑暴会冷场，主持人点你：「你的想法呢？」", "这个需求 5 分钟前刚被否掉一版一模一样的。"],
    "choices": [
      { "text": "黑话念经：「打组合拳，形成合力」", "effects": { "trust": 4, "fish": -2 },
        "reply": "你说了一段谁都没听懂的话，全场点头。黑话，是成年人的护身符。" },
      { "text": "真话：「刚才小王说的，我同意」", "effects": { "bond": 8, "mood": 4, "trust": -2 },
        "reply": "你把功劳让给了小王。小王看你的眼神，像看亲人。" },
      { "text": "【发疯】「我的想法是，这会可以散了」", "gang": 1, "isDui": true,
        "effects": { "mood": 10, "bond": 6, "trust": -8 },
        "reply": "会议提前 40 分钟结束。你被写进了本周会议纪要的「其他事项」。" }
    ]
  },
  {
    "id": "ev_a_report_fine", "series": "meeting", "pool": "staff", "rarity": "common",
    "days": [2, 3, 4, 5],
    "title": "【周报】工时明细令", "scene": "ticket",
    "lines": ["新规定：周报要写每天每小时的工时明细。", "你周三上午 10:00-10:15 的记录是：思考。"],
    "choices": [
      { "text": "如实写，包括「思考」和「对齐」", "effects": { "mood": 4, "trust": -2 },
        "reply": "领导看着你 45 个「对齐」，陷入了沉思。" },
      { "text": "翻译成黑话：「策略性洞察输出」", "effects": { "trust": 4, "mood": -2 },
        "reply": "同样 15 分钟，换了个写法，瞬间战略了。" },
      { "text": "把摸鱼写成「行业调研」", "hidden": "cai", "effects": { "trust": 6, "fish": 6, "mood": 2 },
        "reply": "你把带薪如厕写成了「行业调研」。文学，改变命运。" }
    ]
  },
  {
    "id": "ev_a_fish_caught", "series": "fish", "pool": "staff", "rarity": "rare",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【危险】背后一声咳", "scene": "im",
    "lines": ["你正在带薪冲浪，背后传来一声咳嗽。", "回头，领导站在你身后 1.5 米处。"],
    "choices": [
      { "text": "装作在查资料", "judge": { "base": 0.45,
          "successEffects": { "fish": 4, "mood": 4 },
          "successReply": "你指着屏幕上恰好打开的行业报告。天助自助者。",
          "failEffects": { "trust": -10, "mood": -10 },
          "failReply": "屏幕上是《甄嬛传》第 42 集。" },
        "failFlag": "caughtFish" },
      { "text": "认了：「在休息，马上干活」", "flag": "caughtFish",
        "effects": { "mood": -6, "trust": -6 },
        "reply": "你关掉页面。领导：「劳逸结合，但别太结合。」" },
      { "text": "「我在做竞品调研」", "hidden": "zhan",
        "judge": { "base": 0.65,
          "successEffects": { "fish": 6, "trust": 2 },
          "successReply": "你面不改色，把追剧说成了沉浸式用户洞察。",
          "failEffects": { "trust": -8, "mood": -8 },
          "failReply": "领导：「那你说说，刚才那集演了什么？」" },
        "failFlag": "caughtFish" }
    ]
  },
  {
    "id": "ev_a_fish_pot", "series": "fish", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【摸鱼】工位生态园", "scene": "im",
    "lines": ["你工位上多了三盆绿萝、一缸鱼、一个「退退退」立牌。", "同事路过都说：这工位，有点东西。"],
    "choices": [
      { "text": "继续扩建生态园", "effects": { "fish": 8, "mood": 8, "money": -0.5 },
        "reply": "你的工位成了楼层打卡点。领导：「很有生活气息。」欣慰又担忧。" },
      { "text": "把绿萝分给同事", "effects": { "bond": 8, "mood": 4 },
        "reply": "三盆绿萝，三份友谊。植物的迁移，就是社交的迁移。" },
      { "text": "全部换成贵价摆件", "hidden": "jin", "effects": { "trust": 4, "bond": -8, "mood": 2 },
        "reply": "同事路过你的工位，脚步都会不自觉放轻一点。" }
    ]
  },
  {
    "id": "ev_a_xianyu", "series": "fish", "pool": "staff", "rarity": "rare",
    "days": [2, 3, 4, 5, 6],
    "title": "【副业】闲鱼被同事发现", "scene": "im",
    "lines": ["你的闲鱼副业（代做 PPT）被同事发现了。", "他下一个订单，并要求「内部价」。"],
    "choices": [
      { "text": "接单，友情价", "effects": { "money": 1, "fish": 4, "bond": 4 },
        "reply": "下班后的你，是另一个人：PPT 之魂，燃烧吧。" },
      { "text": "婉拒：「最近忙」", "effects": { "mood": -2 },
        "reply": "你守护了下班后的自己。他转头找了别人，也挺好。" },
      { "text": "【发疯】发朋友圈「接单，同事八折」", "gang": 1, "isDui": true, "gossip": 2,
        "effects": { "money": 1.5, "trust": -4, "bond": 6 },
        "reply": "你收获了 3 个订单，和 1 次领导旁敲侧击：「你的主业还要吗？」" }
    ]
  },
  {
    "id": "ev_a_politics_queue", "series": "politics", "pool": "staff", "rarity": "common",
    "days": [2, 3, 4, 5],
    "title": "【站队】你站谁？", "scene": "im",
    "lines": ["茶水间传闻：贾总和王总监在争下季度的预算。", "有同事带着小道消息来问你：「你站谁？」"],
    "choices": [
      { "text": "「我站公司，我站业务」", "effects": { "trust": 2, "mood": 2 },
        "reply": "标准答案，滴水不漏。你在两边的名单里，都写了个「？」" },
      { "text": "押注贾总", "gossip": 1, "effects": { "trust": 6, "mood": -4 },
        "reply": "你把命运押给了画饼大师。饼熟之前，一切都是信仰。" },
      { "text": "「我站食堂，今天有红烧肉」", "hidden": "zhan",
        "effects": { "bond": 8, "fish": 4, "mood": 6 },
        "reply": "这个回答让所有人都笑了。会幽默的人，在政治风暴里是中立的。" }
    ]
  },
  {
    "id": "ev_a_snack", "series": "politics", "pool": "staff", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6],
    "title": "【悬案】薯片失窃", "scene": "im",
    "lines": ["你藏在抽屉里的薯片，被吃空了。", "袋子叠得整整齐齐，像一份挑衅。"],
    "choices": [
      { "text": "贴纸条：「再吃，秃头警告」", "gossip": 1, "effects": { "bond": 4, "mood": 6 },
        "reply": "第二天，抽屉里多了一包新薯片和纸条：「对不起，头可要保重。」" },
      { "item": "cookie", "text": "算了，再买一包", "effects": { "mood": -3, "money": -0.5 },
        "reply": "你喂饱了办公室的神秘生物。它没有名字，只有胃口。多买的那一包，你塞进了抽屉最里面。" },
      { "text": "【发疯】装摄像头，全员通报", "gang": 1, "isDui": true,
        "judge": { "base": 0.5,
          "successEffects": { "bond": -6, "mood": 12 },
          "successReply": "监控拍下真凶：赖前辈。从此你的零食，再也没丢过。",
          "failEffects": { "mood": -8, "money": -0.5 },
          "failReply": "行政：「不可以装摄像头。」你的薯片，继续神秘失踪。" } }
    ]
  },
  {
    "id": "ev_a_leaver", "series": "story", "pool": "staff", "rarity": "common",
    "days": [2, 3, 4, 5, 6],
    "title": "【送别】他拍了拍你", "scene": "boss",
    "lines": ["干了三年的老同事今天离职，抱着纸箱路过你工位。", "他停下来，拍了拍你的肩，只说了一个字：「跑。」"],
    "choices": [
      { "text": "追出去问：「去哪，带带我」", "effects": { "mood": 8, "fish": 4 },
        "reply": "他给你指了条路：「先把手上的活干明白，猎头自然会来。」" },
      { "text": "目送，继续敲键盘", "effects": { "mood": -6, "kpi": 4 },
        "reply": "你看着电梯门合上，回头继续改第 18 版方案。牛马的宿命，是牛马。" },
      { "text": "【发疯】群里发「欢送老哥，跑得漂亮」", "gang": 1, "isDui": true,
        "effects": { "bond": 10, "mood": 10, "trust": -6 },
        "reply": "群里安静十秒，然后弹出 8 个「恭喜」。都是心里话，借你的嘴。" }
    ]
  },
  {
    "id": "ev_a_perf_warn", "series": "story", "pool": "staff", "rarity": "rare",
    "days": [4, 5, 6], "cond": { "trustLt": 30 },
    "title": "【预警】咖啡间谈话", "scene": "boss",
    "lines": ["安小姐约你「喝咖啡」。", "「最近状态不太好呀。绩效的话……别有压力。」", "「没有压力」四个字，压力拉满。"],
    "choices": [
      { "text": "表决心：「我会努力的」", "counter": "piesHeard", "effects": { "trust": 6, "mood": -12, "kpi": 4 },
        "reply": "你说完，安小姐在本子上写了两个字。你看不清，但猜得到。" },
      { "text": "问清楚：「我具体差在哪」", "judge": { "base": 0.5,
          "successEffects": { "trust": 4, "mood": -4 },
          "successReply": "她说了三条，你都记下了。至少，知道敌人是谁了。",
          "failEffects": { "mood": -10 },
          "failReply": "「呃，是一种综合表现。」综合表现，翻译过来是：说不出口。" } },
      { "text": "「要不，您问我叔？」", "hidden": "jin", "effects": { "trust": 10, "mood": 8 },
        "reply": "安小姐的笑容僵了 0.5 秒：「那个……不用麻烦家里。」" }
    ]
  },
  {
    "id": "ev_a_overtime_at5", "series": "overtime", "pool": "staff", "rarity": "common",
    "days": [2, 4], "slots": ["pm"],
    "title": "【下班前】8点线上会", "scene": "chat",
    "lines": ["17:55，你已经在收拾包了。", "@所有人：今晚 8 点线上会议，对齐一下。"],
    "choices": [
      { "text": "掐点上线，静音吃瓜", "effects": { "fish": 8, "mood": 2, "trust": -4 },
        "reply": "会上说了 40 分钟，核心结论：明天再对齐。", "followup": {
          "lines": ["会议刚散，领导私聊弹出来。", "领导：「你今天没发言，是不认同吗？」"],
          "choices": [
            { "text": "「在听，怕打断节奏」", "effects": { "trust": 4, "mood": -3 },
              "reply": "领导回了个「👍」。你盯着这个表情看了很久，思考它到底代表什么——答案是：什么也不代表。" },
            { "text": "「我发言了，在静音」", "judge": { "base": 0.5,
                "successEffects": { "trust": 3, "mood": 6 },
                "successReply": "领导沉默两秒：「……那下次记得取消静音。」这事翻篇了，甚至还有点好笑。",
                "failEffects": { "trust": -8, "mood": -7 },
                "failReply": "领导：「会议记录里没有你的发言。」——有些真相，比静音更难解释。" } },
            { "hidden": "zhen", "text": "【发疯】「我在吃瓜，瓜很甜」", "gang": 1, "isDui": true,
              "effects": { "mood": 9, "trust": -7, "fish": 3 },
              "reply": "领导回了个问号。三分钟后群里多了一条新规：「非工作内容请勿在会议中传播。」你笑了。" }
          ,
            { "text": "「我让同事帮忙记一下，纪要我看」", "hidden": "jin", "effects": { "mood": 6, "trust": -2, "fish": 3 }, "reply": "同事把纪要发来时附了一句：「后半段他们在夸你。」——这句话是真是假，你决定相信。" }
          ]
        } },
      { "text": "认真参加并发言", "effects": { "trust": 6, "mood": -10, "kpi": 4 },
        "reply": "你贡献了会议里唯一的结论。领导很满意，你很饿。" },
      { "text": "【发疯】「8 点我有事，明天行吗」", "hidden": "zhen", "gang": 1, "isDui": true,
        "effects": { "mood": 8, "trust": -8 },
        "reply": "对方沉默三分钟，回：「那明天早上。」你赢了今晚，欠了明早。" }
    ]
  }
];
