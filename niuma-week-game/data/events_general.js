window.EV_GENERAL = [
  {
    "id": "ev_flag_overpromise", "series": "overtime", "pool": "general", "rarity": "rare", "weight": 8,
    "days": [2, 3, 4, 5, 6, 7], "slots": ["morning", "am", "noon", "pm", "evening"],
    "title": "【后账】你答应过的那份东西", "scene": "ticket",
    "lines": [
      "昨天你答应的「今晚就写」，今天变成了日程表上的一格。",
      "贾总的日历里，9:30 那一行写着你的名字，备注是「他自己说的」。"
    ],
    "choices": [
      { "text": "把连夜写的版本直接交上去", "effects": { "kpi": 6, "trust": 6, "mood": -6 },
        "reply": "贾总翻了两页：「嗯，还行。」「还行」在老板词典里，等于「不错」。" },
      { "text": "坦白：还没写完，要半天", "effects": { "trust": -5, "mood": 4, "kpi": -2 },
        "reply": "贾总看了你三秒：「那你昨天为什么说今晚？」这个问题没有正确答案。" },
      { "text": "【发疯】交一份空白模板，标题写「待填充的人生」", "gang": 1, "isDui": true,
        "effects": { "mood": 12, "trust": -8, "bond": 8 },
        "reply": "贾总把空白模板投到了大屏上，全场安静三秒，然后有人笑出了声。你成了本周最有种的人。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【后账】你画的那个饼，到期了",
      "lines": ["上周你在全员大会上承诺「下周出方案」，今天它变成了日程表上的一格。",
                "贾总把会议室订好了，备注写着「老板自己说的」。"],
      "choices": [
        { "text": "把方案拍出来，管它对不对", "effects": { "kpi": 6, "trust": 6, "mood": -6 },
          "reply": "方案你讲了四十分钟。董事会没人提问——没人提问，有时候比被提问更可怕。" },
        { "text": "坦白：还没成型，要一周", "effects": { "trust": -5, "mood": 4, "kpi": -2 },
          "reply": "贾总在群里发了句「老板说下周」。下周的你，已经被这周的你说死了。" },
        { "text": "【发疯】让全员一起写，署名都算我的", "gang": 1, "isDui": true, "effects": { "mood": 12, "trust": -8, "bond": 8 },
          "reply": "你把这活摊给了全公司，署名留给自己。散会后有人在茶水间说：「老板又搞共创了。」" }
      ]
    } }
  },
  {
    "id": "ev_gen_late", "series": "politics", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5], "slots": ["morning"],
    "title": "【通勤】电梯惊魂", "scene": "im",
    "lines": [
      "电梯门开了，里面站着贾总。",
      "你的工牌忘在工位上，手里还捏着半张没吃完的煎饼。"
    ],
    "choices": [
      { "text": "低头看手机，装作没看见", "effects": { "fish": 3, "mood": -2, "trust": -2 },
        "reply": "电梯一路无声。贾总看了你三眼，你看了手机三眼，双赢。", "followup": {
          "lines": ["电梯到 18 楼，贾总忽然开口。", "贾总：「小王，你这煎饼……哪家买的？」"],
          "choices": [
            { "text": "楼下那家，五块一个", "effects": { "trust": 3, "mood": 2 },
              "reply": "贾总点点头：「便宜。」电梯门开了，你俩都没提迟到的事。" },
            { "text": "「明天我给您带一个」", "effects": { "trust": 6, "money": -0.5, "mood": -3 },
              "reply": "第二天你多买了一个煎饼。贾总收下了，也从那天起记住了你的名字——好事还是坏事，待定。" },
            { "text": "【发疯】「贾总，食堂也有」", "gang": 1, "isDui": true,
              "effects": { "mood": 6, "trust": -4 },
              "reply": "贾总沉默了两层楼：「……食堂我熟。」你赢了口舌，输了下个季度的预算。" }
          ,
            { "text": "「我知道一家更绝的，明天带两份」", "hidden": "zhan", "effects": { "trust": 4, "money": -1, "mood": -2 }, "reply": "第二天你带了两份。贾总吃了，还问你能不能办张月卡。" }
          ]
        } },
      { "text": "大方问好，把煎饼递过去", "effects": { "trust": 5, "mood": 3 }, "npc": { "jia": 5 },
        "reply": "贾总：「年轻人要吃好早餐。」饼和煎饼，今天都到位了。" },
      { "text": "【发疯】贾总早！我迟到了，特此报告", "hidden": "zhen", "gang": 1, "isDui": true,
        "effects": { "trust": -8, "mood": 8 },
        "reply": "甄刚式坦白局。贾总愣住：「……至少你诚实。」" }
    ]
  ,
    "variants": { "boss": {
      "title": "【通勤】清晨七点四十的电梯",
      "lines": ["早上 7:40，电梯门开了，里面站着刚下夜班的小卷，眼圈比你的黑。",
                "她手里捏着一份还没交的排期表，你手里捏着刚买的咖啡。"],
      "choices": [
        { "text": "低头看手机，装作没看见", "effects": { "fish": 3, "mood": -2, "trust": -2 },
          "followup": {
            "lines": ["电梯到 18 楼，小卷忽然开口。", "小卷：「老板，您也这么早？」"],
            "choices": [
              { "text": "随口一句「睡不着」", "effects": { "trust": 3, "mood": 2 },
                "reply": "她点点头，没再问。电梯门开了，你俩都没提排期表的事。" },
              { "text": "「明天我请你喝咖啡」", "effects": { "trust": 6, "money": -0.5, "mood": -3 },
                "reply": "第二天你多买了一杯。她收下了，也从那天起敢在群里直接 @ 你——好事还是坏事，待定。" },
              { "text": "【发疯】「公司的咖啡机也很好喝」", "gang": 1, "isDui": true, "effects": { "mood": 6, "trust": -4 },
                "reply": "她沉默了两层楼：「……那台机器上周就坏了。」你赢了口舌，输了下个季度的员工满意度。" },
              { "text": "「我知道一家更绝的，明天带两份」", "hidden": "feiren", "effects": { "trust": 4, "money": -1, "mood": -2 },
                "reply": "第二天你带了两份。她喝了，还问你能不能办张月卡。" }
            ] } },
        { "text": "把咖啡递给她", "npc": { "jia": 5 }, "effects": { "trust": 5, "mood": 3 },
          "reply": "她愣了两秒，接过去说了声谢谢。这杯咖啡的钱，不到这个季度团建预算的千分之一，作用超过它。" },
        { "text": "【发疯】「老板今天迟到，扣自己半天工资」", "hidden": "normal", "gang": 1, "isDui": true, "effects": { "trust": -8, "mood": 8 },
          "reply": "你在群里发了这么一句。三分钟后，全员群里冒出七个「老板早」。迟到，被你做成了企业文化。" }
      ]
    } }
  },
  {
    "id": "ev_gen_badge", "series": "story", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5], "slots": ["morning"],
    "title": "【门禁】工牌呢？", "scene": "im",
    "lines": ["前台保安拦住了你：工牌没带？", "你摸遍全身，只在口袋里找到一张昨天的外卖单。"],
    "choices": [
      { "text": "折返拿工牌", "effects": { "mood": -5, "fish": -5, "kpi": -2 },
        "reply": "来回二十分钟里，你想明白了什么叫通勤的意义。" },
      { "text": "报工号刷脸进", "judge": { "base": 0.6,
          "successEffects": { "trust": -2, "mood": 2 },
          "successReply": "保安大哥看了看你：「哦，牛马B区037，进吧。」",
          "failEffects": { "mood": -8 },
          "failReply": "系统：人脸与工号不符。你：我就是我。保安：那你证明给我看。" } },
      { "text": "冲保安笑笑往里走", "hidden": "jin",
        "reply": "保安：「您慢走——啊不，您里边请。」关系户的含金量。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【门禁】新保安不认识你",
      "lines": ["前台保安拦住了你：工牌没带？",
                "你摸遍全身，只在口袋里找到一张昨天的报销单——上面签着你的名字。"],
      "choices": [
        { "text": "折返拿工牌", "effects": { "mood": -5, "fish": -5, "kpi": -2 },
          "reply": "你走了十二分钟拿回工牌，一路上都在想：为什么我给自己打工，还要证明我是我。" },
        { "text": "报工号刷脸进", "judge": { "base": 0.6,
            "successEffects": { "trust": -2, "mood": 2 },
            "successReply": "保安看了看屏幕：「哦，B 区 037……不对，您是老板？」他说完自己先愣住了。",
            "failEffects": { "mood": -8 },
            "failReply": "系统：人脸与工号不符。你：我就是老板。保安：那您证明一下——他不是在为难你，他是新来的。" } },
        { "text": "冲保安笑笑往里走", "hidden": "normal", "effects": { },
          "reply": "你笑着进去了。当天下午，行政给他补了一份《高管名单》，还顺手教了他怎么认车。" }
      ]
    } }
  },
  {
    "id": "ev_gen_standup", "series": "meeting", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5], "slots": ["am"],
    "title": "【晨会】轮流汇报", "scene": "chat",
    "lines": ["晨会站会，每个人 30 秒说进展。", "轮到你了。上一位的「进展」说了三分钟。"],
    "choices": [
      { "text": "标准三件套：在做，在做，还没做完", "effects": { "kpi": 2, "trust": 2, "mood": -3 },
        "reply": "你用 10 个字汇报了 8 小时的人生。", "followup": {
          "lines": ["领导在群里发了一句「汇报要具体到小时」，然后抬头看向你。", "全会议室 12 个人的目光，同时落在你身上。"],
          "choices": [
            { "text": "当场补一份小时级明细", "overtime": true, "effects": { "trust": 5, "kpi": 3, "mood": -7, "fish": -4 },
              "reply": "你现场编了 8 行，其中 3 行是「沟通」。领导很满意，你很想离职。" },
            { "text": "老实说「下次提前准备」", "effects": { "trust": 2, "mood": -2 },
              "reply": "领导点头：「态度不错。」——职场上，「态度不错」通常意味着这事先记着。" },
            { "text": "【发疯】「那我把睡觉也算进去」", "gang": 1, "isDui": true,
              "effects": { "mood": 9, "trust": -6, "bond": 5 },
              "reply": "会议室集体憋笑。领导记下了你的名字，备注大概是「刺头」，但同事从此敬你三分。" }
          ,
            { "text": "顺手做个汇报模板，全组复用", "hidden": "cai", "effects": { "kpi": 3, "trust": 4, "mood": -4, "bond": 3 }, "reply": "模板当晚做好，第二天全组都在用。你成了那个「把内耗变成资产」的人——代价是又少睡了两小时。" }
          ]
        } },
      { "text": "把「没做完」说成「正在闭环」", "effects": { "trust": 4, "fish": -3 },
        "reply": "领导满意点头。闭环是一种信仰，没做完是一种修行。" },
      { "text": "【发疯】说实话：在等上游，上游在等常改", "gang": 1, "isDui": true,
        "effects": { "bond": 8, "trust": -6 }, "npc": { "chang": -5 },
        "reply": "会议室安静了半秒，然后所有人疯狂点头。常改记下了你的工号。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【晨会】你听别人轮流汇报",
      "lines": ["晨会站会，每个人 30 秒说进展。",
                "轮到你——所有人自动把 30 秒改成了「老板先说」。"],
      "choices": [
        { "text": "标准三件套：在做，在做，还没做完", "effects": { "kpi": 2, "trust": 2, "mood": -3 },
          "reply": "你说了三句正确的废话，全场点头如啄米。原来「废话」和「指示」的区别，是说话的人坐哪。",
          "followup": {
            "lines": ["你随口补了一句：「以后汇报要具体到小时。」",
                      "全会议室低头记笔记，贾总已经在群里新建了一个模板。"],
            "choices": [
              { "text": "当场补一份小时级明细", "overtime": true, "effects": { "trust": 5, "kpi": 3, "mood": -7, "fish": -4 },
                "reply": "你现场编了 8 行，其中 3 行是「对齐」。全场点头如啄米——你很后悔自己带头起了这个头。" },
              { "text": "老实说「下次提前准备」", "effects": { "trust": 2, "mood": -2 },
                "reply": "贾总点头：「明白，我立刻建模板。」——你随口一句话，当天下午变成了三条制度。" },
              { "text": "【发疯】「那我把睡觉也算进去」", "gang": 1, "isDui": true, "effects": { "mood": 9, "trust": -6, "bond": 5 },
                "reply": "会议室集体憋笑，没人敢先笑。三分钟后，这句「睡觉也算工作」被匿名搬上了脉脉——你成了本周最有人味的老板。" },
              { "text": "顺手做个模板，全公司复用", "hidden": "feiren", "effects": { "kpi": 3, "trust": 4, "mood": -4, "bond": 3 },
                "reply": "模板当晚做好，第二天全公司都在用。你把内耗做成了流程——代价是大家又少睡了两小时。" }
            ] } },
        { "text": "把「没做完」说成「正在闭环」", "effects": { "trust": 4, "fish": -3 },
          "reply": "「闭环」两个字一出，全场的肩膀都松了。语言，是老板最便宜的福利。" },
        { "text": "【发疯】说实话：我也在等上游", "gang": 1, "isDui": true, "npc": { "chang": -5 }, "effects": { "bond": 8, "trust": -6 },
          "reply": "会议室静了三秒，然后有人小声鼓掌。三分钟后，常改撤回了自己刚发的进度。" }
      ]
    } }
  },
  {
    "id": "ev_gen_align", "series": "meeting", "pool": "general", "rarity": "rare",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【会议】拉通对齐会", "scene": "ticket",
    "lines": [
      "日历弹出邀请：【拉通对齐会】参会 12 人，议程：对齐一下。",
      "两小时后，唯一的结论是：下周再开一个会。"
    ],
    "choices": [
      { "text": "全程认真记笔记", "effects": { "trust": 3, "mood": -10, "fish": -8 },
        "reply": "你记满了三页纸，每一页都是「对齐」。" },
      { "text": "假装信号不好退出会议", "judge": { "base": 0.5,
          "successEffects": { "fish": 8, "mood": -2 },
          "successReply": "「喂？喂——信号不好」挂断。你的演技值得一座奥斯卡。",
          "failEffects": { "trust": -6, "mood": -5 },
          "failReply": "刚挂断，领导私信：「你网络挺好啊，刚才还发了朋友圈。」" } },
      { "text": "【发疯】提议：我们能不能邮件对齐", "gang": 1, "isDui": true,
        "effects": { "bond": 10, "trust": -8, "mood": 6 },
        "reply": "全会议室寂静三秒后，爆发出雷鸣般的掌声——在心里。会议提前 20 分钟结束，你是功臣，也是眼中钉。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【会议】拉通对齐会（我在场）",
      "lines": ["日历弹出邀请：【拉通对齐会】参会 12 人，议程：对齐一下。",
                "你一坐下，议程自动从「对齐」变成了「请老板指示」。"],
      "choices": [
        { "text": "全程认真记笔记", "effects": { "trust": 3, "mood": -10, "fish": -8 },
          "reply": "你记了两页，没人敢先开口。原来老板的笔记，就是会议的最终结论。" },
        { "text": "假装信号不好退出会议", "judge": { "base": 0.5,
            "successEffects": { "fish": 8, "mood": -2 },
            "successReply": "你关掉摄像头去阳台站了十分钟。回来时会议已经自己开完了——没人发现你不在。",
            "failEffects": { "trust": -6, "mood": -5 },
            "failReply": "刚挂断，贾总私信：「老板，您是不是不想开这个会？」" } },
        { "text": "【发疯】提议：我们能不能邮件对齐", "gang": 1, "isDui": true, "effects": { "bond": 10, "trust": -8, "mood": 6 },
          "reply": "你一句「这个会邮件对齐」，会议提前 20 分钟结束。散会时有人说：老板今天心情不错。" }
      ]
    } }
  },
  {
    "id": "ev_gen_at_all", "series": "overtime", "pool": "general", "rarity": "common",
    "days": [1, 3, 5], "slots": ["pm"], "timer": 8,
    "title": "【紧急】@所有人", "scene": "chat",
    "lines": ["【红色横幅】@所有人：今晚出个紧急汇报，明早要。", "距离下班还有 5 分钟。"],
    "choices": [
      { "text": "秒回「收到」", "timid": true, "effects": { "trust": 5, "mood": -8, "fish": -5 },
        "reply": "回复速度 0.8 秒，全群第二快。第一是那个回「收到+」的卷王。", "followup": {
          "lines": ["贾总的头像闪了一下，私聊来了。", "贾总：「那你今晚几点走？」"],
          "choices": [
            { "text": "等汇报出来再走", "overtime": true, "effects": { "trust": 6, "kpi": 4, "mood": -10 },
              "reply": "22:40，汇报发出。贾总回了一个「👍」，你盯着这个表情看了很久。" },
            { "text": "我做一半，剩下的明早补", "effects": { "trust": -3, "mood": 3, "fish": 4 },
              "reply": "你说得有理有据，贾总说「行吧」。这个「行吧」你记住了一整周。" },
            { "text": "【发疯】我今晚有安排，明早九点前交", "gang": 1, "isDui": true, "flag": "standFirm",
              "effects": { "mood": 10, "trust": -6 },
              "reply": "贾总沉默了 40 秒，回：「九点，一分钟都不能晚。」你赢了半局。" }
          ,
            { "text": "先应下来，做多少明天再说", "hidden": "zhan", "effects": { "trust": 2, "mood": 3, "fish": 3 }, "reply": "你先回了「收到」，然后把这份紧急汇报在心里排到了明天的第三位。" }
          ]
        } },
      { "text": "装没看见，晚点再说", "effects": { "fish": 5, "mood": 2, "trust": -5 },
        "reply": "已读不回的勇气，是用明天的早饭会议换的。" },
      { "text": "【发疯】回「收到，但我今晚有安排」", "gang": 1, "isDui": true,
        "effects": { "trust": -8, "mood": 10 },
        "reply": "安小姐私聊你：「什么安排这么重要？」你：「生活。」", "followup": {
          "lines": ["安小姐的头像亮了。HR 的私聊，永远比老板的可怕。", "安小姐：「方便说下是什么安排吗？」"],
          "choices": [
            { "text": "老实说：家里有事", "effects": { "mood": 6, "trust": -4 },
              "reply": "安小姐回：「理解，注意休息。」——HR 的「理解」，通常意味着档案里多了一行。" },
            { "text": "私事，不方便透露", "effects": { "mood": 8, "trust": -6, "gossip": 1 },
              "reply": "第二天全组都知道你「有事」，没人知道是什么事。神秘，是职场护甲。" },
            { "text": "【发疯】我的安排就是「不加班」", "gang": 1, "isDui": true, "counter": "duiWins",
              "effects": { "mood": 12, "trust": -8, "bond": 6 },
              "reply": "安小姐没再回。但你这句话，被同组的人截图存进了小群。" }
          ,
            { "text": "「我叔今天生日，我得去」", "hidden": "jin", "effects": { "trust": 4, "mood": 6, "gossip": 1 }, "reply": "安小姐回了个「🎂」。这理由漏洞百出，但它真的有效。" }
          ]
        } }
    ]
  ,
    "variants": { "boss": {
      "title": "【紧急】@所有人（这次是董事会）",
      "lines": ["【红色横幅】董事会秘书 @所有人：明早九点，要一版最新的现金流预测。",
                "距离你和投资人的饭局，还有 5 分钟。"],
      "choices": [
        { "text": "秒回「收到」", "timid": true, "effects": { "trust": 5, "mood": -8, "fish": -5 },
          "followup": {
            "lines": ["董事会秘书的头像闪了一下，私聊来了。", "秘书：「那您今晚几点能出这版？」"],
            "choices": [
              { "text": "等材料出来再走", "overtime": true, "effects": { "trust": 6, "kpi": 4, "mood": -10 },
                "reply": "22:40，材料发出。秘书回了一个「👍」，你盯着这个表情看了很久。" },
              { "text": "我做一半，剩下的明早补", "effects": { "trust": -3, "mood": 3, "fish": 4 },
                "reply": "你说得有理有据，董事会说「行吧」。这个「行吧」你记住了一整周。" },
              { "text": "【发疯】我今晚有安排，明早九点前交", "gang": 1, "isDui": true, "flag": "standFirm", "effects": { "mood": 10, "trust": -6 },
                "reply": "董事会沉默了 40 秒，回：「九点，一分钟都不能晚。」你赢了半局。" },
              { "text": "先应下来，做多少明天再说", "hidden": "normal", "effects": { "trust": 2, "mood": 3, "fish": 3 },
                "reply": "你先回了「收到」，然后把这份紧急材料在心里排到了明天的第三位。" }
            ] } },
        { "text": "装没看见，先吃饭", "effects": { "fish": 5, "mood": 2, "trust": -5 },
          "reply": "二十分钟后，董事会的电话直接打进来了——这就是「@所有人」和「@你」的区别。" },
        { "text": "【发疯】回「收到，但我今晚有安排」", "gang": 1, "isDui": true, "effects": { "trust": -8, "mood": 10 },
          "followup": {
            "lines": ["贾总的头像亮了。下属的私聊，通常意味着他自己也快扛不住了。", "贾总：「老板，今晚的会……要不要我替您？」"],
            "choices": [
              { "text": "「不用，我自己来」", "effects": { "mood": 6, "trust": -4 },
                "reply": "贾总回：「好的。」这句「好的」，你听着像一句「那您自己保重」。" },
              { "text": "「你自己看着办」", "effects": { "mood": 8, "trust": -6, "gossip": 1 },
                "reply": "第二天全公司都知道「老板今晚放权」，没人知道你已经三天没睡。" },
              { "text": "【发疯】「今晚谁都不许加班」", "gang": 1, "isDui": true, "counter": "duiWins", "effects": { "mood": 12, "trust": -8, "bond": 6 },
                "reply": "贾总没再回。但这句话被截图存进了小群——第二天考勤系统里，22 点后打卡的人少了一半。" },
              { "text": "「你替我去，材料我签」", "hidden": "biantai", "effects": { "trust": 4, "mood": 6, "gossip": 1 },
                "reply": "贾总回了个「好」。这份材料第二天以你的名义交了上去：字迹是他的，责任是你的。" }
            ] } }
      ]
    } }
  },
  {
    "id": "ev_gen_mailcc", "series": "politics", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["am"],
    "title": "【邮件】抄送地狱", "scene": "im",
    "lines": ["你被拉进一封邮件的抄送：12 人，主题《关于那件事的同步》。", "往下翻了 40 层楼，才看到事情本身。"],
    "choices": [
      { "text": "只回「收到，跟进中」", "effects": { "trust": 3, "fish": -2 },
        "reply": "五个字，稳住全链路。" },
      { "text": "回复全部＋小作文终结误会", "judge": { "base": 0.55,
          "successEffects": { "trust": 6, "kpi": 3 },
          "successReply": "你用一段话终结了 40 层楼的误会。领导：「这才叫结构化表达。」",
          "failEffects": { "bond": -8, "mood": -5 },
          "failReply": "小作文发出后你才发现：其中一位收件人，就是当事人本人。" } },
      { "text": "已读，不回", "hidden": "zhan", "effects": { "fish": 6, "mood": 3, "trust": -3 },
        "reply": "十年功力：不回，有时候是最强的回。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【邮件】抄送地狱（你在最上面）",
      "lines": ["你被拉进一封邮件的抄送：12 人，主题《关于那件事的同步》。",
                "往下翻了 40 层，才看到事情本身——以及你的名字被 @ 了三次。"],
      "choices": [
        { "text": "只回「收到，跟进中」", "effects": { "trust": 3, "fish": -2 },
          "reply": "你回了四个字。四小时后，这封邮件长到了 60 层楼，而你那四个字成了唯一的地基。" },
        { "text": "回复全部＋小作文终结误会", "judge": { "base": 0.55,
            "successEffects": { "trust": 6, "kpi": 3 },
            "successReply": "你用一段话终结了 40 层楼的误会。贾总转发时批注：「这才叫结构化表达。」",
            "failEffects": { "bond": -8, "mood": -5 },
            "failReply": "小作文发出后你才发现：其中一位收件人就是当事人，而他正在你对面的会议室里看着你。" } },
        { "text": "已读，不回", "hidden": "normal", "effects": { "fish": 6, "mood": 3, "trust": -3 },
          "reply": "你没回。第二天那封邮件自己安静了——权力就是：你不回，会有人替你回。" }
      ]
    } }
  },
  {
    "id": "ev_gen_canteen", "series": "story", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5], "slots": ["noon"],
    "title": "【食堂】拼桌惊魂", "scene": "im",
    "lines": ["食堂满座，只剩一张桌有空位。", "桌上坐着贾总。"],
    "choices": [
      { "text": "端着餐盘礼貌撤退", "effects": { "fish": 4, "mood": 2 },
        "reply": "你端着麻辣香锅绕行 200 米，最终和保洁王阿姨拼了桌，反而聊得很开心。" },
      { "text": "坐下聊「对公司文化的理解」", "effects": { "trust": 6, "mood": -8 }, "npc": { "jia": 6 },
        "reply": "贾总：「年轻人有想法！」你：「（这句我背了三遍）」" },
      { "text": "专注干饭，目中无人", "effects": { "fish": 6, "mood": 6, "trust": -3 },
        "reply": "干饭人干饭魂。贾总看了你一眼，你看了红烧肉三眼。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【食堂】和骂过你的人拼桌",
      "lines": ["食堂满座，只剩一张桌有空位。",
                "桌边坐着三个员工，其中一个上午在群里说过「老板有病」。"],
      "choices": [
        { "text": "端着餐盘礼貌撤退", "effects": { "fish": 4, "mood": 2 },
          "reply": "你端着盘子回了办公室。当老板的体面，有时候就是一顿没人看见的午饭。" },
        { "text": "坐下聊「你们对公司文化的理解」", "npc": { "jia": 6 }, "effects": { "trust": 6, "mood": -8 },
          "reply": "三个人同时放下筷子：「挺好的」「挺好的」「挺好的」。三份述职，一个味道。" },
        { "text": "专注干饭，目中无人", "effects": { "fish": 6, "mood": 6, "trust": -3 },
          "reply": "你吃得很快，走得也快。当天下午，行政在群里发了一条「食堂就餐高峰请勿讨论公司事务」。" }
      ]
    } }
  },
  {
    "id": "ev_gen_toilet", "series": "fish", "pool": "general", "rarity": "common", "repeat": 3,
    "days": [1, 2, 3, 4, 5, 6], "slots": ["noon"],
    "title": "【午休】带薪如厕", "scene": "im",
    "lines": ["带薪如厕，打工人最后的自留地。", "你带上手机，走进了那条走廊尽头的自由。"],
    "choices": [
      { "text": "标准 15 分钟套餐", "counter": "fishToilet", "effects": { "fish": 10, "mood": 6 },
        "reply": "隔间 15 分钟，胜过工位 2 小时。医学上不建议，精神上很科学。" },
      { "text": "王者级 40 分钟（老油条专属）", "hidden": "zhan", "counter": "fishToilet",
        "judge": { "base": 0.5,
          "successEffects": { "fish": 18, "mood": 10 },
          "successReply": "出来时神清气爽，无人察觉。真正的勇士，敢于直面漫长的隔间。",
          "failEffects": { "fish": 8, "mood": -6, "trust": -4 },
          "failReply": "工位方向传来呼喊：「人在吗？」你在隔间回了句：「在开会。」" } },
      { "text": "不去，卷起来", "effects": { "kpi": 4, "mood": -8, "fish": -8 },
        "reply": "膀胱感谢你，心态不感谢。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【午休】难得的半小时",
      "lines": ["员工午休，办公室突然安静下来。",
                "你终于有半小时，没有人来问「这个什么时候能定」。"],
      "choices": [
        { "text": "楼梯间刷 15 分钟手机", "counter": "fishToilet", "effects": { "fish": 10, "mood": 6 },
          "reply": "你把自己关进楼梯间刷了 15 分钟。没有人找你。这 15 分钟，比整个季度的团建都治愈。" },
        { "text": "四十分钟，谁的电话都不接（老油条专属）", "hidden": "normal", "counter": "fishToilet", "judge": { "base": 0.5,
            "successEffects": { "fish": 18, "mood": 10 },
            "successReply": "出来时神清气爽。真正的强者，敢于在下午三点人间蒸发。",
            "failEffects": { "fish": 8, "mood": -6, "trust": -4 },
            "failReply": "你刚出门就撞上贾总：「老板，您在里面吗？」你们对视了两秒，谁都没提这四十分钟。" } },
        { "text": "不去，继续看报表", "effects": { "kpi": 4, "mood": -8, "fish": -8 },
          "reply": "你坐回工位看了四十页报表。公司这一天的效率，被你一个人拉高了 0.3%。" }
      ]
    } }
  },
  {
    "id": "ev_gen_kitchen", "series": "politics", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["noon"],
    "title": "【茶水间】突然安静", "scene": "im",
    "lines": ["你刚进茶水间，聊得火热的同事们突然安静了。", "话题似乎和「名单」两个字有关。"],
    "choices": [
      { "text": "假装找杯子，倒水就走", "gossip": 1, "effects": { "mood": -3 },
        "reply": "你端着空杯子走出茶水间，像端着什么都没发生。", "followup": {
          "lines": ["你刚要转身，赖前辈探进头来。", "赖前辈：「诶，你们刚聊什么聊得这么开心？」"],
          "choices": [
            { "text": "「没什么，聊打印机」", "effects": { "mood": 2, "fish": 2 },
              "reply": "赖前辈「哦」了一声，眼神写着「你不说我也知道」。茶水间的墙，比工位隔板薄。" },
            { "text": "把瓜原样转述一遍", "gossip": 1, "effects": { "bond": 5, "trust": -2 },
              "reply": "三分钟后，整层楼都知道了。你正式成为茶水间情报网的一个节点——有编制的那种。" },
            { "text": "【发疯】「聊你的工位要被收走了」", "gang": 1, "isDui": true, "gossip": 1,
              "effects": { "mood": 9, "trust": -5, "bond": -3 },
              "reply": "赖前辈笑容凝固三秒，转身就走。第二天你收到一条匿名消息：「那事儿，是真的吗？」" }
          ,
            { "text": "「我什么都没听见」", "hidden": "huang", "effects": { "mood": 3, "trust": 2, "fish": 2 }, "reply": "赖前辈盯着你看了两秒，走了。你保住了耳朵，也保住了这一层楼对你的信任——老实人的护甲就是这么来的。" }
          ]
        } },
      { "text": "大胆求证：名单上有我吗", "judge": { "base": 0.4,
          "successEffects": { "gossip": 2, "mood": 3, "trust": -4 },
          "successReply": "安小姐透底：暂时没有，但你上了观察名单。知道了自己反而踏实了。",
          "failEffects": { "mood": -8, "gossip": 1 },
          "failReply": "安小姐微笑：「这个不能说。」——这个不能说，就是最大的信息。" } },
      { "text": "抛一个新瓜换入场资格", "hidden": "zhan", "gossip": 2,
        "effects": { "bond": 6, "fish": 4 },
        "reply": "你抛出「三楼在抢四楼打印机」的重磅情报，成功登顶今日茶水间热搜。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【茶水间】突然安静（他们聊的是名单）",
      "lines": ["你刚进茶水间，聊得火热的同事们突然安静了。",
                "话题似乎和「名单」两个字有关——而那份名单，是你签的。"],
      "choices": [
        { "text": "假装找杯子，倒水就走", "gossip": 1, "effects": { "mood": -3 },
          "followup": {
            "lines": ["你刚要转身，赖前辈探进头来。", "赖前辈：「老板，刚才那事儿……您听到了？」"],
            "choices": [
              { "text": "「没什么，聊打印机」", "effects": { "mood": 2, "fish": 2 },
                "reply": "他「哦」了一声，眼神写着「你不说我也知道」。茶水间的墙，比工位隔板薄。" },
              { "text": "把名单的原话转述一遍", "gossip": 1, "effects": { "bond": 5, "trust": -2 },
                "reply": "三分钟后整层楼都知道了。你就此成为公司最大的情报源——还是官方的那种。" },
              { "text": "【发疯】「聊你的工位要被收走了」", "gang": 1, "isDui": true, "gossip": 1, "effects": { "mood": 9, "trust": -5, "bond": -3 },
                "reply": "他笑容凝固三秒，转身就走。第二天你收到一条匿名消息：「那事儿，是真的吗？」" },
              { "text": "「我什么都没听见」", "hidden": "normal", "effects": { "mood": 3, "trust": 2, "fish": 2 },
                "reply": "他盯着你看了两秒，走了。你保住了这层楼对你的信任——老板的耳朵，有时候得是聋的。" }
            ] } },
        { "text": "推门进去：名单的事，直接问我", "judge": { "base": 0.4,
            "successEffects": { "gossip": 2, "mood": 3, "trust": -4 },
            "successReply": "三个人同时低头。你说「这周不动人」，办公室安静得能听见空调。这一天，你像个还行的老板。",
            "failEffects": { "mood": -8, "gossip": 1 },
            "failReply": "他们笑着散开了。第二天，两个工位上多了纸箱——传言比你先到了 HR 那里。" } },
        { "text": "自曝一个猛料：下周要发期权", "hidden": "normal", "gossip": 2, "effects": { "bond": 6, "fish": 4 },
          "reply": "你说完就后悔了。当天下午全公司都在讨论行权价——没人再记得那份名单。" }
      ]
    } }
  },
  {
    "id": "ev_gen_layoff_post", "series": "story", "pool": "general", "rarity": "common",
    "days": [2, 3, 4, 5], "slots": ["noon"],
    "title": "【午休】裁员帖", "scene": "im",
    "lines": ["午休刷手机，刷到某厂「毕业」了一批人，评论区一片「平安是福」。", "你摸了摸自己的工牌，突然觉得有点凉。"],
    "choices": [
      { "item": "report", "text": "打开招聘软件看看行情（不投）", "effects": { "mood": 5, "fish": 6 },
        "reply": "看完行情你反而睡了个好觉：原来外面更卷。平静，是比出来的。看完行情，你顺手预约了今年的体检——招聘软件最大的作用，是提醒你别猝死。" },
      { "text": "什么也不干，睡午觉", "effects": { "mood": 8, "fish": 8 },
        "reply": "裁员帖再吓人，也吓不醒一个午休的人。" },
      { "text": "转发到小群：「哈哈哈共勉」", "gossip": 1, "effects": { "bond": 5 },
        "reply": "群里安静了一分钟，然后弹出十个「哈哈哈哈」。都是懂哥。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【午休】你刷到了自己的行业新闻",
      "lines": ["午休刷手机，刷到某厂「毕业」了一批人，评论区一片「平安是福」。",
                "你忽然想起，上周那份优化名单，是自己签的字。"],
      "choices": [
        { "item": "report", "text": "打开招聘软件看看行情（不投）", "effects": { "mood": 5, "fish": 6 },
          "reply": "你刷了二十分钟，看的全是「总监以上」。行情还行——你不是在找工作，你是在给自己定价。看完行情，你顺手预约了今年的体检——招聘软件最大的作用，是提醒你别猝死。" },
        { "text": "什么也不干，睡午觉", "effects": { "mood": 8, "fish": 8 },
          "reply": "你睡了四十分钟。梦里没有名单，也没有评价。" },
        { "text": "转发到高管群：「哈哈哈共勉」", "gossip": 1, "effects": { "bond": 5 },
          "reply": "三分钟后，贾总回了一个「哈哈」，随后全员开始转发行业新闻——今天的朋友圈，像一场集体默哀。" }
      ]
    } }
  },
  {
    "id": "ev_gen_boss_walk", "series": "pua", "pool": "general", "rarity": "rare",
    "days": [1, 2, 3, 4, 5], "slots": ["pm"], "timer": 6,
    "title": "【警报】老板走过来了", "scene": "im",
    "lines": ["余光里，贾总正朝你的工位走来，距离 8 米。", "你屏幕上是招聘软件。"],
    "choices": [
      { "item": "film", "text": "闪电切屏，假装工作", "timid": true, "effects": { "fish": 3, "trust": 3, "mood": -4 },
        "reply": "切换速度 0.3 秒。你的反应速度，是被职场练出来的肌肉。第二天你在屏幕上贴了防窥膜，从此屏幕只对你一个人开放。", "followup": {
          "lines": ["贾总没走，站在你旁边看了三秒。", "贾总：「你刚才那个表，是上周的吧？」"],
          "choices": [
            { "text": "「是，我马上更新」", "effects": { "trust": 4, "kpi": 2, "mood": -5 },
              "reply": "你现场改了 20 分钟，贾总站在后面看了 20 分钟。这 20 分钟，你记住了。", },
            { "text": "硬撑「是最新版」", "judge": { "base": 0.55,
                "successEffects": { "trust": 3, "mood": 6 },
                "successReply": "贾总扫了两眼，说「行」就走了。你把这份表格存成了桌面第一图标，从此不敢动它。",
                "failEffects": { "trust": -8, "mood": -6, "pot": 1 },
                "failReply": "贾总指了指表头的日期：「12 号，今天 19 号。」这口锅，就轻轻扣在你头上了。" } },
            { "text": "【发疯】「那是我上周的人生」", "gang": 1, "isDui": true,
              "effects": { "mood": 10, "trust": -6 },
              "reply": "贾总愣了半秒，笑了一下，走了。你保住了体面，代价是他再没跟你聊过表格以外的事。" }
          ,
            { "text": "【发疯】「要不您坐我这儿看？」", "hidden": "zhen", "gang": 1, "isDui": true, "chain": { "id": "ev_chain_pua_remember", "afterDays": 1
  }, "effects": { "mood": 9, "trust": -5 }, "reply": "贾总没坐，也没走。他站了整整一分钟，然后说：「你这人挺有意思。」" }
          ]
        } },
      { "text": "最小化，继续摸，头都不抬", "hidden": "zhan",
        "judge": { "base": 0.45,
          "successEffects": { "fish": 10, "mood": 6 },
          "successReply": "贾总瞥了一眼，走了。现在的年轻人，心态真好。",
          "failEffects": { "trust": -10, "mood": -8 },
          "failReply": "贾总停下了脚步。你听到了命运的脚步声。" } },
      { "text": "【发疯】直接最小化并抬头对视", "hidden": "zhen", "gang": 1, "isDui": true,
        "effects": { "mood": 8, "trust": -6 },
        "reply": "四目相对。贾总先移开了视线。今天，你赢了。" },
      { "text": "淡定切到需求文档，皱眉装深沉", "effects": { "trust": 3, "mood": -3, "fish": -2 },
        "reply": "贾总停了两秒，扫了眼你的屏幕：「嗯，在做事就好。」他走了，你的心跳用了三分钟才回到正常频率。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【警报】贾总走过来了",
      "lines": ["余光里，贾总正朝你的办公室走来，距离 8 米。",
                "你屏幕上是招聘软件——「招人的那种」。他在门口探头：「老板，我们是不是该补个人？」"],
      "choices": [
        { "text": "闪电切屏，假装在看财报", "timid": true, "effects": { "fish": 3, "trust": 3, "mood": -4 },
          "followup": {
            "lines": ["贾总没走，站在你旁边看了三秒。", "贾总：「您刚才那个表，是上个月的吧？」"],
            "choices": [
              { "text": "「是，我马上更新」", "effects": { "trust": 4, "kpi": 2, "mood": -5 },
                "reply": "你现场改了 20 分钟，贾总站在后面看了 20 分钟。这 20 分钟，你记住了。" },
              { "text": "硬撑「是最新版」", "judge": { "base": 0.55,
                  "successEffects": { "trust": 3, "mood": 6 },
                  "successReply": "贾总扫了两眼，说「行」就走了。你把这张表存成了桌面第一图标，从此不敢动它。",
                  "failEffects": { "trust": -8, "mood": -6, "pot": 1 },
                  "failReply": "他指了指表头的日期：「12 号，今天 19 号。」这口锅，就轻轻扣在你头上了。" } },
              { "text": "【发疯】「那是我上个月的人生」", "gang": 1, "isDui": true, "effects": { "mood": 10, "trust": -6 },
                "reply": "贾总愣了半秒，笑了一下，走了。你保住了老板的体面，代价是他再没跟你聊过报表以外的事。" },
              { "text": "【发疯】「要不您坐我这儿看？」", "hidden": "normal", "gang": 1, "isDui": true, "chain": { "id": "ev_chain_pua_remember", "afterDays": 1 }, "effects": { "mood": 9, "trust": -5 },
                "reply": "贾总没坐，也没走。他站了整整一分钟，然后说：「您这人挺有意思。」" }
            ] } },
        { "text": "合上电脑，等他开口", "hidden": "normal", "judge": { "base": 0.45,
            "successEffects": { "fish": 10, "mood": 6 },
            "successReply": "他站了两秒，说「没事，就是想跟您对一下进度」，然后走了。当老板，气势有时候不用说话。",
            "failEffects": { "trust": -10, "mood": -8 },
            "failReply": "他把门关上了，然后坐下来开始汇报。你听到的第一个词是「但是」。" } },
        { "text": "【发疯】直接最小化并抬头对视", "hidden": "feiren", "gang": 1, "isDui": true, "effects": { "mood": 8, "trust": -6 },
          "reply": "四目相对。他先移开了视线。今天你赢了——代价是你也不知道自己在赢什么。" },
        { "text": "切到组织架构图，皱眉装深沉", "effects": { "trust": 3, "mood": -3, "fish": -2 },
          "reply": "他扫了眼屏幕：「嗯，我出去等您。」他走了，你的心跳用了四十秒才回到 90。" }
      ]
    } }
  },
  {
    "id": "ev_gen_ac", "series": "politics", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["pm"],
    "title": "【工位】空调之争", "scene": "im",
    "lines": ["26 度和 22 度的战争，在你工位上空打响。", "隔壁工位把遥控器藏进了抽屉第三层。"],
    "choices": [
      { "text": "委屈自己，穿上外套", "effects": { "mood": -6, "bond": 6 },
        "reply": "你穿上了工位常备外套。打工人三大件：外套、毯子、胃药。" },
      { "text": "发起民主投票", "judge": { "base": 0.6,
          "successEffects": { "bond": 4, "mood": 4 },
          "successReply": "26 度以 7:3 获胜。你赢了，虽然赢得像个群主。",
          "failEffects": { "mood": -6 },
          "failReply": "22 度获胜。原来怕热的是少数，怕冷的是你。" } },
      { "text": "默默打开小太阳取暖器", "hidden": "cai", "effects": { "fish": 4, "mood": 2, "trust": -2 },
        "reply": "你的工位形成了独立的气候系统。行政看你的眼神，有点想收费。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【办公室】26 度和 22 度的战争",
      "lines": ["26 度和 22 度的战争，在办公区上空打响。",
                "你的办公室在正中间——两边都来找你评理。"],
      "choices": [
        { "text": "委屈自己，穿上外套", "effects": { "mood": -6, "bond": 6 },
          "reply": "你在 22 度里穿了三天外套。公平这件事，就是老板先冷。" },
        { "text": "发起民主投票", "judge": { "base": 0.6,
            "successEffects": { "bond": 4, "mood": 4 },
            "successReply": "26 度以 7:3 获胜。你以为你赢了民心——其实大家只是都站空调那边。",
            "failEffects": { "mood": -6 },
            "failReply": "22 度获胜。原来怕热的才是少数，怕冷的是你——但票是你让投的，你还得认。" } },
        { "text": "默默打开小太阳取暖器", "hidden": "feiren", "effects": { "fish": 4, "mood": 2, "trust": -2 },
          "reply": "你把小太阳搬进办公室，门虚掩着。当天下午，行政在群里发了《办公区用电规范》。" }
      ]
    } }
  },
  {
    "id": "ev_gen_printer", "series": "blame", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["pm"],
    "title": "【设备】打印机卡纸", "scene": "ticket",
    "lines": ["打印机卡纸了，卡住的那页打着你的名字：《本周进展》。", "路过的领导看了一眼。"],
    "choices": [
      { "text": "拆机抢救", "effects": { "kpi": 2, "fish": -4, "mood": -3 },
        "reply": "你和打印机搏斗十分钟，赢了，手上全是墨。" },
      { "text": "喊「谁来救一下打印机」", "effects": { "bond": 4, "mood": 2 },
        "reply": "技术部小哥应声而来。社交换来技能，划算。" },
      { "text": "全扛下来：「没事，我来弄」", "hidden": "huang", "effects": { "trust": 4, "mood": -6 },
        "reply": "黄老实定理：事情不大，但都是你的。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【设备】打印机又卡了",
      "lines": ["打印机卡纸了，卡住的那页打着你的名字：《全员激励方案》。",
                "旁边员工的屏幕上，是招聘网站。他光速切走了。"],
      "choices": [
        { "text": "拆机抢救", "effects": { "kpi": 2, "fish": -4, "mood": -3 },
          "reply": "你蹲在地上拆了十分钟，取出那张纸。站起来时没人看见——但纸上的方案，第二天照常发下去了。" },
        { "text": "喊「谁来救一下打印机」", "effects": { "bond": 4, "mood": 2 },
          "reply": "三秒内来了四个人。打印机修好了，你的威严也顺便修好了。" },
        { "text": "全扛下来：「没事，我来弄」", "hidden": "normal", "effects": { "trust": 4, "mood": -6 },
          "reply": "你说「我来」。七分钟后纸出来了，你的手黑了。旁边那位默默把招聘网站关掉了。" }
      ]
    } }
  },
  {
    "id": "ev_gen_milktea", "series": "politics", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["pm"],
    "title": "【拼单】奶茶时刻", "scene": "chat",
    "lines": ["下午三点，群里发起奶茶拼单。", "这是今天最像人过的日子。"],
    "choices": [
      { "text": "发起拼单，亲自当团长", "effects": { "bond": 10, "mood": 4, "fish": -3, "money": -0.5 },
        "reply": "你抱着 14 杯奶茶走回工位，像抱着团队凝聚力。", "followup": {
          "lines": ["群里开始对账。", "你数了三遍：14 杯，转账 11 个人。"],
          "choices": [
            { "text": "自己垫上，群里不提", "effects": { "money": -0.5, "bond": 8, "mood": -5 },
              "reply": "你垫了半个月工资。没人知道，但团队气氛莫名其妙地好了——善良有时候是隐形的绩效。" },
            { "text": "群里 @所有人 提醒一下", "effects": { "money": 0.5, "mood": 3, "bond": -4 },
              "reply": "欠款 3 分钟到账。你在群里多了一个标签：「记得要钱的那个」。" },
            { "text": "【发疯】做一张《奶茶欠款明细表》发大群", "gang": 1, "isDui": true, "gossip": 1,
              "effects": { "mood": 7, "bond": -6, "kpi": 2 },
              "reply": "表格做得非常漂亮，配色专业。从此没人欠你奶茶钱，也没人找你拼单了。" }
          ,
            { "text": "「我只付我那一杯」", "hidden": "zhan", "effects": { "money": 0.5, "bond": -3, "mood": 4 }, "reply": "你只付了自己那杯，省下半个月工资。团长在群里回了一个句号，那个句号你读懂了三层意思。" }
          ]
        } },
      { "text": "跟单，AA 到底", "effects": { "bond": 3, "money": -0.5 },
        "reply": "拼单的灵魂是参与，不是消费。" },
      { "text": "【发疯】「我不喝奶茶，我喝西北风」", "gang": 1, "isDui": true,
        "effects": { "mood": 6, "bond": -4 },
        "reply": "群里安静两秒，然后有人默默给你点了一杯。西北风，加冰。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【拼单】奶茶时刻（没算上我）",
      "lines": ["下午三点，群里发起奶茶拼单。",
                "你翻了两遍群记录：14 个人的单，没有你。"],
      "choices": [
        { "text": "直接下单全公司，备注不用还", "effects": { "bond": 10, "mood": 4, "fish": -3, "money": -0.5 },
          "followup": {
            "lines": ["群里开始刷屏。", "有人问：「这单谁付的？」下面一堆人回：「不知道。」"],
            "choices": [
              { "text": "不解释，让他们猜", "effects": { "money": -0.5, "bond": 8, "mood": -5 },
                "reply": "你付了半个月工资，一个字都没提。奇怪的是，这周主动加班的人多了。" },
              { "text": "让行政发一句「老板请的」", "effects": { "money": 0.5, "mood": 3, "bond": -4 },
                "reply": "群里立刻被「谢谢老板」刷满。这三个字你收到了 14 次，一次比一次轻。" },
              { "text": "【发疯】在群里发《本周奶茶预算说明》", "gang": 1, "isDui": true, "gossip": 1, "effects": { "mood": 7, "bond": -6, "kpi": 2 },
                "reply": "表格很专业，配色也讲究。从此没人再敢拼单——包括你。" },
              { "text": "「我只付我那一杯，剩下的走团建费」", "hidden": "feiren", "effects": { "money": 0.5, "bond": -3, "mood": 4 },
                "reply": "财务当天就建了科目。你喝到了自己那杯，也失去了和他们拼单的资格。" }
            ] } },
        { "text": "跟单，AA 到底", "effects": { "bond": 3, "kpi": -4 },
          "reply": "你在群里回了一句「算我一份」。三分钟后团长单独发来收款码——他截图的时候，手都在抖。" },
        { "text": "【发疯】「我不喝奶茶，我喝西北风」", "gang": 1, "isDui": true, "effects": { "mood": 6, "bond": -4 },
          "reply": "群里安静了两秒，然后有人回：「老板，西北风不加糖。」你被记住了，以一种复杂的方式。" }
      ]
    } }
  },
  {
    "id": "ev_gen_lover", "series": "overtime", "pool": "general", "rarity": "common",
    "days": [2, 4, 6], "slots": ["off"], "timer": 8,
    "title": "【下班】「在吗」三连", "scene": "chat",
    "lines": ["21:47，工作群突然活了。", "「在吗」 「有个事」 「方便语音吗」——三连，没有正文。"],
    "choices": [
      { "text": "回「在的您说」", "timid": true, "effects": { "mood": -6, "fish": -4, "trust": 4 },
        "reply": "四个字，卖出一个晚上。" },
      { "text": "手机倒扣，明早再说", "effects": { "fish": 8, "mood": 6, "trust": -6 },
        "reply": "你把手机扣在桌上，世界瞬间安静。明天的雷，明天再炸。" },
      { "text": "【发疯】「不说什么事的话，我先撤了」", "hidden": "zhen", "gang": 1, "isDui": true,
        "effects": { "trust": -8, "mood": 10 },
        "reply": "对方秒发正文。原来「在吗」后面真的有事，就是不好意思直说。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【下班】投资人的「在吗」三连",
      "lines": ["21:47，工作群突然活了。",
                "「在吗」「有个想法」「方便语音吗」——三连，没有正文，发消息的是投资人。"],
      "choices": [
        { "text": "回「在的您说」", "timid": true, "effects": { "mood": -6, "fish": -4, "trust": 4 },
          "reply": "你回了四个字。那边「正在输入」了三十秒，最后发来一句：「明天聊。」这四十分钟你记住了。" },
        { "text": "手机倒扣，明早再说", "effects": { "fish": 8, "mood": 6, "trust": -6 },
          "reply": "你把手机扣在桌上，睡了个好觉。第二天早上，他找了你的对家聊。" },
        { "text": "【发疯】「不说什么事的话，我先撤了」", "hidden": "biantai", "gang": 1, "isDui": true, "effects": { "trust": -8, "mood": 10 },
          "reply": "你发了这句话，然后真的撤了。第二天他在董事会上说：「你们这位老板，很有个性。」" }
      ]
    } }
  },
  {
    "id": "ev_gen_takeout", "series": "story", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5, 6], "slots": ["off"],
    "title": "【悬案】外卖失踪", "scene": "im",
    "lines": ["外卖显示「已送达」，但共享冰箱里没有它。", "这是一起有组织有预谋的作案。"],
    "choices": [
      { "text": "自认倒霉，泡面", "effects": { "mood": -6, "money": -0.5 },
        "reply": "外卖的最后影像，停留在电梯监控里。泡面，永远的神。" },
      { "text": "调监控，追凶", "judge": { "base": 0.5,
          "successEffects": { "mood": 10, "bond": -6 },
          "successReply": "监控显示是隔壁工位。你礼貌拿回，对方社死。",
          "failEffects": { "mood": -8 },
          "failReply": "监控角度完美避开了案发现场。小偷懂技术。" } },
      { "text": "【发疯】群里全员通报「谁动了我的螺蛳粉」", "gang": 1, "isDui": true, "gossip": 1,
        "effects": { "mood": 6, "bond": 2 },
        "reply": "十分钟后，一份新外卖出现在你桌上，附纸条：「对不起，螺蛳粉罪不至死。」" }
    ]
  ,
    "variants": { "boss": {
      "title": "【悬案】我的饭不见了",
      "lines": ["外卖显示「已送达」，但共享冰箱里没有它。",
                "行政在群里道歉：那份饭被当成团建物资分掉了。"],
      "choices": [
        { "text": "算了，正好减脂", "effects": { "mood": -6, "money": -0.5 },
          "reply": "你点了份沙拉。半小时后，你在垃圾桶里看见了自己那份红烧肉的空盒。" },
        { "text": "调监控，追凶", "judge": { "base": 0.5,
            "successEffects": { "mood": 10, "bond": -6 },
            "successReply": "监控显示是隔壁部门的实习生。你礼貌拿回，他社死了——你成了那个「会查监控的老板」。",
            "failEffects": { "mood": -8 },
            "failReply": "监控角度完美避开了案发现场。小偷懂技术，也懂你。" } },
        { "text": "【发疯】群发「以后我的饭别动」", "gang": 1, "isDui": true, "gossip": 1, "effects": { "mood": 6, "bond": 2 },
          "reply": "群里排队道歉，队伍很长，态度很虚。第二天你桌上多了一盒同款红烧肉，署名「匿名」。" }
      ]
    } }
  },
  {
    "id": "ev_gen_moments", "series": "overtime", "pool": "general", "rarity": "common",
    "days": [1, 2, 3, 4, 5], "slots": ["off"],
    "title": "【深夜】朋友圈玄学", "scene": "im",
    "lines": ["23:58，同事发了张加班照，配文「热爱可抵岁月漫长」。", "两分钟后，贾总点了赞。"],
    "choices": [
      { "text": "跟发一张键盘照", "effects": { "trust": 5, "mood": -8, "fish": -5 },
        "reply": "你翻出上周拍的键盘照。贾总也点了赞。默契，令人心酸。" },
      { "text": "点个赞就睡", "effects": { "fish": 4, "mood": 2 },
        "reply": "点赞是职场最低成本的善意。" },
      { "text": "【发疯】发「我也热爱，热爱下班」", "gang": 1, "isDui": true,
        "effects": { "trust": -6, "mood": 10, "bond": 4 },
        "reply": "十几个同事偷偷点了赞，又都悄悄取消了。你的朋友圈，是全公司的嘴替。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【深夜】员工的加班照，@ 了你",
      "lines": ["23:58，小卷发了张加班照，配文「热爱可抵岁月漫长」，定位是公司。",
                "两分钟后，贾总在下面点了赞——他也没下班。"],
      "choices": [
        { "text": "跟发一张自己办公室的灯", "effects": { "trust": 5, "mood": -8, "fish": -5 },
          "reply": "你拍了自己办公室的灯，配文「一起加油」。十分钟后，全公司一半人的状态变成了「在线」。" },
        { "text": "点个赞就睡", "effects": { "fish": 4, "mood": 2 },
          "reply": "你点完就睡了。第二天早上，那张照片底下 47 个赞，其中 12 个来自高管群。" },
        { "text": "【发疯】发「我也热爱，热爱下班」", "gang": 1, "isDui": true, "effects": { "trust": -6, "mood": 10, "bond": 4 },
          "reply": "第二天员工群里传开了：「老板昨晚发了条朋友圈骂我们。」你没骂，但你解释了半小时。" }
      ]
    } }
  },
  {
    "id": "ev_evening_staff", "series": "overtime", "pool": "general", "rarity": "common", "weight": 50,
    "days": [1, 2, 3, 4, 5, 6], "slots": ["evening"], "cond": { "job": "staff" },
    "title": "【晚间】走，还是留？", "scene": "im",
    "lines": ["18:30，夕阳把工位染成加班的颜色。", "今日份灵魂拷问：走，还是留？"],
    "choices": [
      { "text": "准点跑，天经地义", "overtime": false, "effects": { "fish": 8, "mood": 8, "trust": -5 },
        "reply": "夕阳很美。你踩着点走出大楼，头也不回。" },
      { "text": "加班把活干完", "overtime": true, "effects": { "kpi": 6, "trust": 6, "mood": -12, "fish": -10 },
        "reply": "晚上九点，你合上电脑。工位灯照着你，像照着一头敬业的老牛。" },
      { "text": "【表演式加班】活干完也留着，等领导走", "hidden": "cai", "overtime": true,
        "effects": { "trust": 9, "kpi": 3, "mood": -14, "fish": -6 },
        "reply": "你的工位灯，是这一层最后的倔强。贾总路过时看了你一眼，记下了。" },
      { "text": "加班式摸鱼（人在魂不在）", "hidden": "zhan", "overtime": false,
        "effects": { "fish": 12, "trust": 3, "mood": 2 },
        "reply": "工时上是加班，产出上是玄学。十年功力，滴水不漏。" }
    ]
  },
  {
    "id": "ev_evening_mid", "series": "overtime", "pool": "general", "rarity": "common", "weight": 50,
    "days": [1, 2, 3, 4, 5, 6], "slots": ["evening"], "cond": { "job": "mid" },
    "title": "【晚间】团队的灯", "scene": "im",
    "lines": ["18:30，团队还有三个人的灯亮着。", "你：让他们走，还是陪他们卷？"],
    "choices": [
      { "text": "带头让团队下班：「都走，明天我顶」", "overtime": false,
        "effects": { "bond": 12, "trust": -6, "mood": 6 },
        "reply": "团队欢呼着跑路，看你的眼神像看亲人。贾总那边，你欠一次。" },
      { "text": "陪团队一起加班", "overtime": true, "effects": { "bond": 6, "kpi": 6, "mood": -12, "trust": 5 },
        "reply": "你和团队一起卷到十点。士气没崩，你先崩了半格。" },
      { "text": "布置完活就溜，让团队自己卷", "hidden": "jiquan", "overtime": false,
        "effects": { "fish": 10, "bond": -8, "trust": 3 },
        "reply": "你把「信任」留在了群里，把人留在了火锅店。" }
    ]
  },
  {
    "id": "ev_evening_boss", "series": "overtime", "pool": "general", "rarity": "common", "weight": 50,
    "days": [1, 2, 3, 4, 5, 6], "slots": ["evening"], "cond": { "job": "boss" },
    "title": "【晚间】老板的夜", "scene": "im",
    "lines": ["18:30，员工走光了，你还没走。", "桌上是现金流量表，和投资人没回的消息。"],
    "choices": [
      { "text": "应酬：陪客户喝到十一点", "overtime": true,
        "effects": { "trust": 8, "kpi": -3, "mood": -14 },
        "reply": "你举着杯说「都在酒里」。命也在酒里。" },
      { "text": "看报表，复盘省钱", "overtime": true, "effects": { "kpi": 8, "mood": -8, "trust": 3 },
        "reply": "你砍掉了下季度的下午茶预算，省下的钱够发半天工资。" },
      { "text": "【发疯】准点下班，当着全公司", "overtime": false,
        "effects": { "bond": 8, "trust": -8, "mood": 12 },
        "reply": "老板准点下班，全公司震动。有员工在群里说：「老板都敢走，我也走。」公司氛围，意外地变好了。" }
    ]
  },
  {
    "id": "ev_wang", "series": "story", "pool": "general", "rarity": "common", "weight": 9, "repeat": 3,
    "days": [1, 2, 3, 4, 5, 6], "slots": ["off"],
    "title": "【扫地僧】王阿姨", "scene": "im",
    "lines": ["保洁王阿姨在擦你工位旁的桌子。", "她瞥了一眼你的屏幕：「小伙子，脸色比上周差了。」"],
    "choices": [
      { "text": "聊两句心里话", "counter": "wangTalks", "npc": { "wang": 15 }, "effects": { "mood": 8 },
        "reply": "王阿姨边擦边听，末了说：「工作只是生活的一部分。」扫地僧，又渡一人。", "followup": {
          "lines": ["王阿姨把抹布叠了叠，压低声音。", "王阿姨：「你打算在这儿干多久啊？」"],
          "choices": [
            { "text": "先干着看吧", "effects": { "mood": 4 },
              "reply": "王阿姨点点头：「慢慢来，别把身体弄坏了。」" },
            { "text": "明年就走，攒够钱就撤", "flag": "planLeave", "effects": { "mood": 7 },
              "reply": "说出口的那一刻，你自己也愣了一下。原来你真的想过这件事。" },
            { "text": "【发疯】等我攒够钱，去开个面馆", "gang": 1, "isDui": true, "flag": "noodleDream", "gossip": 1,
              "effects": { "mood": 12, "bond": 5 },
              "reply": "王阿姨笑了：「到时候我给你擀面。」这句话你记了一整周。" }
          ,
            { "text": "「我叔说让我再待两年」", "hidden": "jin", "effects": { "trust": 4, "mood": 3, "gossip": 1 }, "reply": "王阿姨「哦」了一声，把抹布拧干：「那你就好好待着，别学他们。」" }
          ]
        } },
      { "text": "帮她倒杯水", "npc": { "wang": 10 }, "effects": { "mood": 5, "bond": 3 },
        "reply": "你俩在茶水间聊了十分钟楼里的八卦，信息量比周会大。" },
      { "text": "倾诉全部委屈", "hidden": "huang", "counter": "wangTalks", "npc": { "wang": 20 },
        "effects": { "mood": 12, "trust": -2 },
        "reply": "你说了十分钟，王阿姨听了十分钟，最后只说了一句：「你挺好的，是他们太离谱。」" }
    ]
  ,
    "variants": { "boss": {
      "title": "【扫地僧】王阿姨",
      "lines": ["保洁王阿姨在擦你办公室的门。",
                "她瞥了一眼你的屏幕：「老板，你这脸色，比上个月的财报还难看。」"],
      "choices": [
        { "text": "聊两句心里话", "npc": { "wang": 15 }, "counter": "wangTalks", "effects": { "mood": 8 },
          "reply": "你把最近的事说了两句。她听完只说了一句：「钱的事我不懂，但你这几个月，没笑过。」",
          "followup": {
            "lines": ["王阿姨把抹布叠了叠，压低声音。", "王阿姨：「老板，你这摊子，打算干多久啊？」"],
            "choices": [
              { "text": "先干着看吧", "effects": { "mood": 4 },
                "reply": "王阿姨点点头：「慢慢来，别把摊子撑坏了。」" },
              { "text": "明年要还不赚钱，就关了", "flag": "planLeave", "effects": { "mood": 7 },
                "reply": "说出口的那一刻，你自己也愣了一下。原来你真的想过这件事。" },
              { "text": "【发疯】等我攒够钱，去开个面馆", "gang": 1, "isDui": true, "flag": "noodleDream", "gossip": 1, "effects": { "mood": 12, "bond": 5 },
                "reply": "王阿姨笑了：「到时候我给你擀面。」这句话你记了一整周——包括后来那几次想关公司的时刻。" },
              { "text": "「楼上那位说，让我再撑两年」", "hidden": "normal", "effects": { "trust": 4, "mood": 3, "gossip": 1 },
                "reply": "王阿姨「哦」了一声，把抹布拧干：「那就好好撑着，别学他们。」" }
            ] } },
        { "text": "帮她倒杯水", "npc": { "wang": 10 }, "effects": { "mood": 5, "bond": 3 },
          "reply": "你给她倒了杯热水。她愣了一下：「我在这干了八年，头一回有老板给我倒水。」" },
        { "text": "倾诉全部委屈", "hidden": "normal", "npc": { "wang": 20 }, "counter": "wangTalks", "effects": { "mood": 12, "trust": -2 },
          "reply": "你对着她说了半小时。她听完说：「公司好的时候没人找我说话，不好的时候都来找我。」" }
      ]
    } }
  },
  {
    "id": "ev_lisa", "series": "story", "pool": "general", "rarity": "rare", "weight": 6,
    "days": [3, 4, 5, 6], "slots": ["off"],
    "title": "【来电】神秘猎头", "scene": "im",
    "lines": ["陌生号码，接起来是猎头 Lisa。", "「我看您的资料，跟一个机会挺匹配的，薪资上浮 40%，考虑吗？」"],
    "choices": [
      { "text": "留个微信，看看机会", "npc": { "lisa": 10 }, "effects": { "mood": 8 },
        "chain": { "id": "ev_lisa2", "afterDays": 2 },
        "reply": "你加了微信。不一定是走，但知道有人抢，睡觉都香了。" },
      { "text": "婉拒：「最近挺稳定」", "effects": { "mood": -2 },
        "reply": "挂了电话你打开银行卡余额，又把号码存了下来。稳定，是相对的。" },
      { "text": "【发疯】「现在挖我？我上周还想埋了自己」", "gang": 1, "isDui": true, "npc": { "lisa": 15 },
        "effects": { "mood": 12 }, "chain": { "id": "ev_lisa2", "afterDays": 1 },
        "reply": "Lisa 笑出了声：「更有戏了。就冲这心态，团队需要你。」" }
    ]
  ,
    "variants": { "boss": {
      "title": "【来电】神秘猎头（这次是来买公司的）",
      "lines": ["陌生号码，接起来是猎头 Lisa。",
                "「钱总想跟您聊聊贵司的估值——不是挖您，是想买您。」"],
      "choices": [
        { "text": "约他吃饭，先探探他的现金流", "npc": { "lisa": 10 }, "chain": { "id": "ev_lisa2", "afterDays": 2 }, "effects": { "mood": 8 },
          "reply": "饭桌上他先聊行业，再聊情怀，最后才报了个数字。你没接话，只是把茶杯往前推了推。" },
        { "text": "婉拒：「我还没玩够」", "effects": { "mood": -2 },
          "reply": "挂了电话，你打开后台看了一眼数据。曲线很难看，但它姓你的姓。" },
        { "text": "【发疯】「卖，但溢价三倍」", "gang": 1, "isDui": true, "npc": { "lisa": 15 }, "chain": { "id": "ev_lisa2", "afterDays": 2 }, "effects": { "mood": 12 },
          "reply": "Lisa 沉默了四秒：「这个数字，我得先笑一下。」第二天，钱总亲自打了过来。" }
      ]
    } }
  },
  {
    "id": "ev_lisa2", "series": "story", "pool": "general", "rarity": "common",
    "days": [4, 5, 6, 7], "slots": ["morning", "am", "off"],
    "title": "【来电】面试邀约", "scene": "im",
    "lines": ["Lisa：那边约你视频面试，方便吗？", "还是熟悉的下午，熟悉的会议软件。"],
    "choices": [
      { "text": "去！请假面试", "flag": "tookLisa", "effects": { "kpi": -4, "mood": 10, "trust": -3 },
        "npc": { "lisa": 10 },
        "reply": "你请了「病假」，面完感觉良好。备胎转正的路线图，清晰了。" },
      { "text": "先观望", "npc": { "lisa": 5 }, "effects": { "mood": 3 },
        "reply": "你把面试往后推了推。机会不会跑，但会瘦。" },
      { "text": "不去了，卷死在这", "npc": { "lisa": -5 }, "effects": { "mood": -4 },
        "reply": "Lisa 尊重你的选择，把机会推给了下一位。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【来电】收购方的第二次电话",
      "lines": ["Lisa：对方约您打场高尔夫，顺便把条款过一遍。",
                "还是熟悉的下午，熟悉的话术，只是这次谈的是你的公司。"],
      "choices": [
        { "text": "去，但只谈收购，不谈入职", "flag": "tookLisa", "npc": { "lisa": 10 }, "effects": { "kpi": -4, "mood": 10, "trust": -3 },
          "reply": "四个小时后你手里多了一份意向书：公司归他们，你归董事会——年薪照发，办公室照旧。" },
        { "text": "先观望", "npc": { "lisa": 5 }, "effects": { "mood": 3 },
          "reply": "你说「再看看」。Lisa 说好，然后把你公司的名字发给了另外两家。" },
        { "text": "不去，我这周要救公司", "npc": { "lisa": -5 }, "effects": { "mood": -4 },
          "reply": "你挂了电话，回到现金流表前。有些数字，比骚扰电话更值得解释。" }
      ]
    } }
  },
  {
    "id": "ev_crazy_group", "series": "story", "pool": "general", "rarity": "rare", "weight": 12,
    "days": [2, 3, 4, 5, 6], "slots": ["off"], "cond": { "moodLt": 35 },
    "title": "【凌晨】发疯的诱惑", "scene": "im",
    "lines": ["凌晨 1 点，你盯着全员群的输入框。", "心里那篇《关于我司的一些真话》已经写了 800 字。"],
    "choices": [
      { "text": "【发疯】发出去！让世界听到", "flag": "crazyFamous", "gang": 1, "isDui": true,
        "effects": { "mood": 15, "trust": -15, "bond": 5 },
        "chain": { "id": "ev_crazy_fame", "afterDays": 1
  },
        "reply": "发送成功。你关掉手机，睡了个这两周最沉的觉。爆炸是明天的事。" },
      { "text": "写完，存草稿，删掉，睡觉", "effects": { "mood": 8, "fish": 4 },
        "reply": "你删掉了 800 字真话，留下 8 个字的周报。成年人的克制，值一个 N+1。" },
      { "text": "发到只有三个人的小群", "gossip": 2, "effects": { "bond": 8, "mood": 10 },
        "reply": "小群里齐刷刷回：「发！哥你发大群！」——然后齐刷刷撤回了自己的话。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【凌晨】员工的那篇长文",
      "lines": ["凌晨 1 点，全员群里有人发了 800 字《关于我司的一些真话》。",
                "你盯着输入框，光标闪了十分钟。"],
      "choices": [
        { "text": "【发疯】在下面回「写得挺好，来我办公室聊聊」", "gang": 1, "isDui": true, "flag": "crazyFamous", "chain": { "id": "ev_crazy_fame", "afterDays": 1 }, "effects": { "mood": 15, "trust": -15, "bond": 5 },
          "reply": "你回了九个字。五分钟后，那篇文章的截图冲上了热搜——配文是「这老板有点东西」。" },
        { "text": "让 HR 按流程处理", "effects": { "mood": 8, "fish": 4 },
          "reply": "第二天法务起草了一份说明。文章没删，但评论区安静了——比删掉更让人不安。" },
        { "text": "在下面回一个「+1」", "gossip": 2, "effects": { "bond": 8, "mood": 10 },
          "reply": "你只发了两个字符。第二天全员都在猜：老板这个「+1」，是认同，还是记住了？" }
      ]
    } }
  },
  {
    "id": "ev_crazy_fame", "series": "story", "pool": "general", "rarity": "epic",
    "days": [3, 4, 5, 6], "slots": ["off"],
    "title": "【爆了】深夜独白刷屏", "scene": "boss",
    "lines": ["你早上醒来，手机 99+ 条消息。", "那篇长文被截图传出去了：热搜第七，标题《某大厂员工的深夜独白》。"],
    "choices": [
      { "text": "顺势承认，更新第二条", "flag": "crazyFamous",
        "effects": { "mood": 12, "trust": -10, "bond": 10, "money": 0.5 },
        "reply": "第二条《关于我司的更多真话》阅读 10w+。贾总在办公室摔了杯子，声音穿透了墙。" },
      { "text": "装失忆：「号被盗了」", "judge": { "base": 0.4,
          "successEffects": { "trust": -4, "mood": 6 },
          "successReply": "安小姐将信将疑地结案：「下次注意账号安全。」",
          "failEffects": { "mood": -10, "trust": -8 },
          "failReply": "安小姐微笑：「盗号的文笔，和你的周报一模一样呢。」" } },
      { "text": "私聊贾总道歉", "npc": { "jia": 5 }, "effects": { "trust": 6, "mood": -8, "bond": -6 },
        "reply": "贾总回了个「嗯」。你保住了工作，丢了点别的东西。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【爆了】那篇爆款，骂的是你",
      "lines": ["你早上醒来，手机 99+ 条消息。",
                "那篇长文被截图传出去了：热搜第七，标题《某大厂员工的深夜独白》——写的是你。"],
      "choices": [
        { "text": "顺势认了，发一封全员公开信", "flag": "crazyFamous", "effects": { "mood": 12, "trust": -10, "bond": 10, "money": 0.5 },
          "reply": "公开信里你承认「有过乱来的时刻」。投资人打电话来问，你说这叫危机公关，他说这叫上热搜不要钱。" },
        { "text": "装失忆：「这人我不认识」", "judge": { "base": 0.4,
            "successEffects": { "trust": -4, "mood": 6 },
            "successReply": "法务起草了声明，HR 提供了考勤。三天后热搜下去了，你的名字还在小群里。",
            "failEffects": { "mood": -10, "trust": -8 },
            "failReply": "安小姐微笑：「那篇文章的错别字，和您月报里的错别字一模一样呢。」" } },
        { "text": "私聊他：写得挺好，来我办公室聊聊", "npc": { "juan": 5 }, "effects": { "trust": 6, "mood": -8, "bond": -6 },
          "reply": "他来了，带着录音笔。聊了四十分钟，他带走两件事：一个调岗，和一段新素材。" }
      ]
    } }
  },
  {
    "id": "ev_isolated", "series": "exclude", "pool": "general", "rarity": "epic", "weight": 20,
    "days": [2, 3, 4, 5], "slots": ["am"], "cond": { "bondLt": 20 },
    "title": "【孤立】透明人", "scene": "boss",
    "lines": ["你发现中午没人叫你拼单，下午的会议室默认没你的位置。", "你的工位，物理意义上和心理意义上，都很安静。"],
    "choices": [
      { "text": "主动破冰，买零食", "effects": { "bond": 8, "money": -0.5, "mood": -3 },
        "reply": "三箱零食下桌，孤立解除。职场友谊，明码标价，童叟无欺。" },
      { "text": "独来独往，把自己活成岛", "effects": { "mood": -8, "fish": 10 },
        "reply": "你戴上耳机，把世界调成了单机模式。" },
      { "text": "【发疯】在群里问「我是被拉黑了吗」", "gang": 1, "isDui": true,
        "effects": { "bond": 5, "mood": 6, "trust": -4 },
        "reply": "群里炸出十几个「没有没有」。有的孤立，一戳就破。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【孤立】没有人叫你开会",
      "lines": ["你发现中午没人叫你拼单，下午的会议室默认没你的位置。",
                "你刷到群里那张合影——12 个人，笑得都很放松，没有你。"],
      "choices": [
        { "text": "主动破冰，买零食", "effects": { "bond": 8, "money": -0.5, "mood": -3 },
          "reply": "你给全组点了下午茶，署名都没留。第二天，会议邀请终于发到了你手机上。" },
        { "text": "独来独往，把自己活成岛", "effects": { "mood": -8, "fish": 10 },
          "reply": "你把自己关进办公室看了一整天报表。数字很诚实，它们从不孤立你。" },
        { "text": "【发疯】在群里问「我是被拉黑了吗」", "gang": 1, "isDui": true, "effects": { "bond": 5, "mood": 6, "trust": -4 },
          "reply": "你在全员群发了这条。十分钟后，群里冒出 30 个「老板好」。虚情假意，也是一种热情。" }
      ]
    } }
  },
  {
    "id": "ev_rescue", "series": "story", "pool": "general", "rarity": "epic", "weight": 6,
    "days": [2, 3, 4, 5, 6], "slots": ["pm"], "cond": { "bondGt": 80 },
    "title": "【名场面】同事救场", "scene": "boss",
    "lines": ["会上，领导把一个 deadline 错安在你头上。", "正要开口，三个同事同时替你说话。"],
    "choices": [
      { "text": "顺着台阶感谢大家", "effects": { "bond": 6, "mood": 12, "trust": 2 },
        "reply": "你稳稳落地。平时攒的人品，今天连本带利取了出来。" },
      { "text": "「没事，我也能做」", "hidden": "huang", "effects": { "mood": -6, "trust": 6, "bond": -4 },
        "reply": "刚被救，转身又把锅往怀里搂。黄老实，你没救了。" },
      { "text": "笑着说「这活我来吧」，把锅接过来自己干", "effects": { "bond": 8, "mood": -6, "kpi": 2 },
        "reply": "你接下了活，也接下了人缘。小卷在旁边小声说：「哥，你人真好。」——这句夸奖，大概值六个小时加班。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【名场面】有人替你说话",
      "lines": ["会上，董事会把一个 deadline 错安在你头上。",
                "正要开口，三个员工同时替你说话。"],
      "choices": [
        { "text": "顺着台阶感谢大家", "effects": { "bond": 6, "mood": 12, "trust": 2 },
          "reply": "你说「谢谢大家」。散会后你在楼道里站了两分钟：当老板，被下属护着的感觉，比签单还爽。" },
        { "text": "「没事，我也能做」", "hidden": "normal", "effects": { "mood": -6, "trust": 6, "bond": -4 },
          "reply": "你把活接了过来。他们看你的眼神变了：老板是不是不信我们能干。" },
        { "text": "笑着说「这活我来吧」，把锅接过来自己干", "effects": { "bond": 8, "mood": -6, "kpi": 2 },
          "reply": "你接了锅，当晚在办公室干到十一点——第二天，有三个员工默默留下来陪你。" }
      ]
    } }
  },
  {
    "id": "ev_chain_pua_remember", "series": "pua", "pool": "general", "rarity": "rare",
    "days": [2, 3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【记仇】贾总的微笑", "scene": "im",
    "lines": ["贾总路过你工位，停了半秒。", "「上次开会的话，我记得。」他微笑着说，微笑里没有温度。"],
    "choices": [
      { "text": "装傻：「啊？我说什么了？」", "effects": { "trust": -6, "mood": -4 },
        "reply": "你启动了失忆防御机制。贾总笑笑走了。这笑，你下周还会见到。" },
      { "text": "【发疯】「我说的话，我都负责」", "gang": 1, "isDui": true,
        "effects": { "trust": -10, "mood": 10, "bond": 5 },
        "reply": "实习生小卷在远处比了个大拇指。代价是，你上了贾总的「重点关注」名单。" },
      { "text": "递上咖啡＋诚恳道歉", "npc": { "jia": 8 }, "effects": { "trust": 6, "mood": -8 },
        "reply": "你端着咖啡说「那天我状态不好」。饼没吃到，锅先端上了。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【记仇】陈老的微笑",
      "lines": ["陈老路过你的办公室，停了半秒。",
                "「上次你说『下季度翻倍』，我记得。」他微笑着说，微笑里没有温度。"],
      "choices": [
        { "text": "装傻：「啊？我说什么了？」", "effects": { "trust": -6, "mood": -4 },
          "reply": "你启动了失忆防御。陈老笑笑走了。这个笑，你下周还会见到。" },
        { "text": "【发疯】「我说的话，我都负责」", "gang": 1, "isDui": true, "effects": { "trust": -10, "mood": 10, "bond": 5 },
          "reply": "走廊里有人听见了。三分钟后，小群里出现了「老板立 flag 了」的截图。" },
        { "text": "递上咖啡＋诚恳汇报", "npc": { "jia": 8 }, "effects": { "trust": 6, "mood": -8 },
          "reply": "你端着咖啡说「数据我会盯」。饼没吃到，锅先端上了——这口锅还是你自己画的。" }
      ]
    } }
  },
  {
    "id": "ev_chain_change_delete", "series": "blame", "pool": "general", "rarity": "epic",
    "days": [3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【事故】记录消失了", "scene": "boss",
    "lines": ["产品群里，常改发：「这个需求当初没说要改交互呀。」", "你翻聊天记录——那条消息不见了。常改撤回了它。"],
    "choices": [
      { "item": "recorder", "text": "当场甩出本地截图", "gang": 1, "isDui": true, "npc": { "chang": -10 },
        "effects": { "trust": 6, "bond": 4, "mood": 8 },
        "reply": "截图甩出，群里一片「哦——」。常改的头像暗了下去，像一部恐怖片。顺手你给手机加了个录音快捷键——留证据这件事，会上瘾。" },
      { "text": "私聊让常改认领", "judge": { "base": 0.5,
          "successEffects": { "trust": 4, "mood": 6 },
          "successReply": "常改：「哎呀我记错了，我说一下。」小胜。",
          "failEffects": { "mood": -10, "pot": 1 },
          "failReply": "常改：「你有什么证据吗？」证据在他手里，他撤回了。" } },
      { "text": "认了，谁让记录没了", "pot": 1, "effects": { "kpi": -8, "mood": -10 },
        "reply": "你默默打字：「可能是我记错了。」黑锅+1。它很轻，但很沉。" }
    ]
  ,
    "variants": { "boss": {
      "title": "【事故】下属撤回了消息",
      "lines": ["产品群里，常改发：「这个需求当初没说要改交互呀。」",
                "你翻聊天记录——那条消息不见了。他撤回了它，但你记得自己点过赞。"],
      "choices": [
        { "text": "当场甩出本地截图", "gang": 1, "isDui": true, "npc": { "chang": -10 }, "effects": { "trust": 6, "bond": 4, "mood": 8 },
          "reply": "你甩出截图。群里安静了四十秒，然后常改发了句：「老板记性真好。」这句话你听不出是夸还是骂。" },
        { "text": "私聊让他认领", "judge": { "base": 0.5,
            "successEffects": { "trust": 4, "mood": 6 },
            "successReply": "常改：「哎呀我记错了，我说一下。」——小胜，也是唯一一次他没跟你绕圈子。",
            "failEffects": { "mood": -10, "pot": 1 },
            "failReply": "常改：「老板，您有证据吗？」证据被他撤回了。这口锅悬在空中，最后落在你头上。" } },
        { "text": "算了，谁让记录没了", "effects": { "kpi": -8, "mood": -10 }, "pot": 1,
          "reply": "你说算了。会议室里所有人都记住了这句话——包括那些下次也想撤回消息的人。" }
      ]
    } }
  },
  {
    "id": "ev_chain_fallguy", "series": "blame", "pool": "general", "rarity": "epic",
    "days": [4, 5, 6], "slots": ["am", "pm"], "cond": { "potGte": 2 },
    "title": "【约谈】背锅侠实锤", "scene": "boss",
    "lines": ["周五下午，安小姐把你叫进小会议室：「本周几次事故，都得有人负责。」", "她的笑容很职业，会议室很安静。"],
    "choices": [
      { "text": "主动认领：「我复盘，我改进」", "pot": 1,
        "effects": { "trust": 4, "kpi": -10, "mood": -8 },
        "reply": "你写了一份三千字复盘。责任是你的，成长也是你的，工资还是你的。" },
      { "text": "摆出时间线：这锅该谁背", "needItem": "recorder", "gang": 1, "isDui": true, "npc": { "chang": -8 },
        "effects": { "trust": 4, "bond": -6, "mood": 8 },
        "reply": "录音清晰如法医报告。锅在空中转了三圈，稳稳落在常改头上。" },
      { "text": "【发疯】「行，锅我背，加薪也归我？」", "gang": 1, "isDui": true,
        "judge": { "base": 0.3,
          "successEffects": { "mood": 10, "trust": 2 },
          "successReply": "「……你这思路很清晰。」安小姐竟然给你申请了缓冲期。",
          "failEffects": { "mood": -10, "pot": 1 },
          "failReply": "「加薪没有，锅留下。」" } }
    ]
  ,
    "variants": { "boss": {
      "title": "【约谈】董事会要一个负责人",
      "lines": ["周五下午，陈老把你叫进小会议室：「本周几次事故，总得有人负责。」",
                "他说这话时看着你，微笑很职业，会议室很安静。"],
      "choices": [
        { "text": "主动认领：「我复盘，我改进」", "pot": 1, "effects": { "trust": 4, "kpi": -10, "mood": -8 },
          "reply": "你认了。陈老点头：「态度不错。」——在职场上，态度不错通常意味着：代价照付。" },
        { "text": "摆出时间线：这锅该谁背", "needItem": "recorder", "gang": 1, "isDui": true, "npc": { "chang": -8 }, "effects": { "trust": 4, "bond": -6, "mood": 8 },
          "reply": "你把时间线摊在桌上。陈老看了两分钟，说：「这些，你都留着？」你的背脊出了一层汗。" },
        { "text": "【发疯】「行，锅我背，加薪也归我？」", "gang": 1, "isDui": true, "judge": { "base": 0.3,
            "successEffects": { "mood": 10, "trust": 2 },
            "successReply": "陈老愣了两秒：「……这思路很清晰。」他竟然给你申请了缓冲期。",
            "failEffects": { "mood": -10, "pot": 1 },
            "failReply": "「加薪没有，锅留下。」——你听见自己笑了一声，很难听。" } }
      ]
    } }
  },
  {
    "id": "ev_chain_pie_backlash", "series": "politics", "pool": "general", "rarity": "rare", "scheduledOnlyJobs": ["boss"],
    "days": [2, 3, 4, 5, 6], "slots": ["am", "pm"],
    "title": "【反噬】饼吃多了会噎", "scene": "chat",
    "lines": ["全员群里，有员工匿名发：", "「老板，饼吃多了，噎。」点赞数在悄悄上涨。"],
    "choices": [
      { "text": "大方回应：「下次发真饼（奖金）」", "effects": { "money": -1, "bond": 10, "trust": -3, "mood": 4 },
        "reply": "你承诺了下季度奖金池。士气肉眼可见地回升，钱包肉眼可见地瘪了。" },
      { "text": "装没看见", "effects": { "bond": -8, "mood": -6 },
        "reply": "你退出群聊界面，继续看现金流。有些数字，越看越饿。" },
      { "text": "【发疯】亲自下场回：「哪里噎了？说说」", "hidden": "biantai", "gang": 1, "isDui": true,
        "effects": { "bond": 12, "mood": 8, "trust": -5 },
        "reply": "你用员工的话回了员工的话。评论区风向变了：「老板居然回？」「有点东西。」" }
    ],
    "variants": {
      "staff": {
        "title": "【反噬】饼吃多了会噎",
        "lines": ["全员群里，有同事匿名发：", "「老板，饼吃多了，噎。」点赞数在悄悄上涨。"],
        "choices": [
          { "text": "自愿晚发一个月工资", "effects": { "money": -1, "bond": 10, "trust": -3, "mood": 4 },
            "reply": "你自愿把一个月工资的到账时间往后推。群里有人点赞，也有人说你在替公司带节奏。工资可以晚到，账单照常准时。" },
          { "text": "装没看见", "effects": { "bond": -8, "mood": -6 },
            "reply": "你划走了群聊。饼没兑现，工位上的气氛也凉了一截。" }
        ]
      },
      "mid": {
        "title": "【反噬】饼吃多了会噎",
        "lines": ["团队群里，有人翻出了上次会议的承诺：", "「奖金呢？饼吃多了，噎。」消息下面，几个人默默点了赞。"],
        "choices": [
          { "text": "先垫半个月工资给团队发红包鼓舞士气", "effects": { "money": -0.5, "bond": 10, "trust": -3, "mood": 4 },
            "reply": "你先垫了半个月工资，给团队发了一轮红包。团队缓了口气，贾总却觉得你把欠账摆到了台面上。" },
          { "text": "装没看见", "effects": { "bond": -8, "mood": -6 },
            "reply": "你退出群聊，继续写汇报。团队没等到回应，也少了一点信任。" }
        ]
      },
      "boss": {
        "title": "【反噬】饼吃多了会噎",
        "lines": ["全员群里，有员工匿名发：", "「老板，饼吃多了，噎。」点赞数在悄悄上涨。"],
        "choices": [
          { "text": "大方回应：「下次发真饼（奖金）」", "effects": { "money": -1, "bond": 10, "trust": -3, "mood": 4 },
            "reply": "你承诺了下季度奖金池。士气肉眼可见地回升，钱包肉眼可见地瘪了。" },
          { "text": "装没看见", "effects": { "bond": -8, "mood": -6 },
            "reply": "你退出群聊界面，继续看现金流。有些数字，越看越饿。" },
          { "text": "【发疯】亲自下场回：「哪里噎了？说说」", "hidden": "biantai", "gang": 1, "isDui": true,
            "effects": { "bond": 12, "mood": 8, "trust": -5 },
            "reply": "你用员工的话回了员工的话。评论区风向变了：「老板居然回？」「有点东西。」" }
        ]
      }
    }
  }
];
