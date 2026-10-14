window.EV_BOSSES = [
  {
    "id": "ev_boss_mon", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [1], "slots": ["morning"],
    "title": "【周一Boss战】OKR 对齐大法", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "全员会上，贾总：你来说说这周的 OKR。",
          "追问三连：为什么是这个？和公司战略怎么对齐？你的思考是什么？"
        ],
        "choices": [
          { "text": "黑话三连：「以终为始，以始为终」", "counter": "piesHeard",
            "effects": { "trust": 6, "mood": -6 },
            "reply": "你说了一段自己都没听懂的话，全场点头。黑话十级，通过。" },
          { "text": "说人话：「把需求做完，少出 bug」",
            "judge": { "base": 0.5,
              "successEffects": { "bond": 8, "trust": 2 },
              "successReply": "全场鼓掌。贾总愣了一下：「质朴。」质朴，有时是最高级的对齐。",
              "failEffects": { "mood": -6, "trust": -4 },
              "failReply": "贾总：「格局小了。」格局，是打工人的第二把刀。" } },
          { "text": "【发疯】「我的 OKR 是：活着下班」", "hidden": "zhen", "gang": 1, "isDui": true,
            "effects": { "trust": -10, "mood": 10, "bond": 10 },
            "reply": "全场先静后笑。实习生小卷低头狂记笔记，把这句写进了自己的 OKR。" }
        ]
      },
      "mid": {
        "lines": [
          "你要替团队定 OKR，贾总当场改了三版。",
          "第三版和第一版一模一样。你看着屏幕，陷入哲学思考。"
        ],
        "choices": [
          { "text": "按第三版重排，团队辛苦一下", "effects": { "bond": -8, "trust": 8 },
            "reply": "团队看到第三版 OKR 时，群里齐刷刷的「收到」，和一排省略号。" },
          { "text": "拿着数据坚持原版", "gang": 1, "isDui": true,
            "judge": { "base": 0.55,
              "successEffects": { "bond": 10, "trust": 4 },
              "successReply": "数据赢了。贾总：「行，按你说的。」你保住了团队的睡眠。",
              "failEffects": { "bond": -6, "trust": -6, "mood": -6 },
              "failReply": "贾总：「你要理解我的意思。」——他的意思是：按他说的。" } },
          { "text": "【发疯】把三版并列发给团队投票", "hidden": "baoyu", "gang": 1, "isDui": true,
            "effects": { "bond": 12, "trust": -10, "mood": 6 },
            "reply": "团队全票投了工作量最小的版本。贾总看到投票结果时，办公室气压低了 5 度。" }
        ]
      },
      "boss": {
      "title": "【周一Boss战】投资人三连问",
        "lines": [
          "周一早 9 点，投资人视频会。",
          "三连问：增长点在哪？壁垒是什么？什么时候盈利？——三连问，每个都在你的痛处蹦迪。"
        ],
        "choices": [
          { "text": "讲故事：「第二增长曲线正在成形」", "counter": "piesHeard",
            "effects": { "trust": 8, "mood": -6 },
            "reply": "投资人点了点头。曲线成没成形不知道，你先把自己讲热了。" },
          { "text": "数据实答，含亏损",
            "judge": { "base": 0.45,
              "successEffects": { "trust": 10, "bond": 6 },
              "successReply": "「难得你敢说真话。下一轮，我们再看。」——真话居然值钱。",
              "failEffects": { "trust": -10, "mood": -8 },
              "failReply": "投资人转头看了一眼别家的增长曲线。空气，突然很安静。" } },
          { "text": "【发疯】「你们上次投的那家，也这么问过」", "hidden": "feiren", "gang": 1, "isDui": true,
            "effects": { "trust": -12, "mood": 10, "bond": 8 },
            "reply": "会议室安静三秒。投资人生气，但你出气了。贾总在旁边把茶杯捏出了响。" }
        ]
      }
    }
  },
  {
    "id": "ev_boss_tue", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [2], "slots": ["am"],
    "title": "【周二Boss战】就改个按钮", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "常改拿着需求来了：「就改个按钮，不改逻辑的。」",
          "评审会上，「一个按钮」变成：交互重做、样式重做、文案重做。逻辑：确实没改——因为逻辑没了。"
        ],
        "choices": [
          { "text": "照单全收，周末是个什么东西", "effects": { "mood": -12, "kpi": 6, "trust": 4 },
            "reply": "你在需求单上写下「收到」。笔很轻，字很沉。" },
          { "text": "要求走变更流程，白纸黑字", "npc": { "chang": -8 },
            "effects": { "trust": 3, "mood": 2 },
            "reply": "常改不情愿地补了变更单。未来的你，会感谢现在的你。" },
          { "text": "「这属于需求变更，我拉个评审会」", "hidden": "zhan",
            "judge": { "base": 0.55,
              "successEffects": { "trust": 6, "fish": 4, "mood": 4 },
              "successReply": "评审会一致认为：工期顺延三天。流程，是油条最好的朋友。",
              "failEffects": { "mood": -8, "trust": -4 },
              "failReply": "贾总拍板：「特事特办。」特的是事，办的是你。" } }
        ]
      },
      "mid": {
        "lines": [
          "常改绕过你，直接找你下属改了需求。",
          "下属做完被你看到时，你才知道这事。信息：没有。尊重：也没有。"
        ],
        "choices": [
          { "text": "找常改立规矩：改需求先过我", "gang": 1, "isDui": true, "npc": { "chang": -6 },
            "effects": { "bond": 8, "trust": -4 },
            "reply": "你守住了团队的边界。常改嘴上说「好的好的」，转头抄送了贾总。" },
          { "text": "算了，让下属忍一忍", "effects": { "bond": -10, "mood": -6 },
            "reply": "下属「嗯」了一声。那一声里，有一份悄悄投出去的简历。" },
          { "text": "给常改回一份《排期风险表》", "hidden": "shetou",
            "effects": { "trust": 6, "kpi": 4, "mood": -8 },
            "reply": "表格做得很专业，常改看得很沉默。卷，有时候是种防御。" }
        ]
      },
      "boss": {
      "title": "【周二Boss战】「老板要的」",
        "lines": [
          "常改：「这个方案，是老板要的。」",
          "——你就是老板。你要过吗？没有。"
        ],
        "choices": [
          { "text": "反问：我要过吗？", "gang": 1, "isDui": true, "npc": { "chang": -4 },
            "effects": { "bond": 8, "mood": 6 },
            "reply": "常改：「呃……我以为您要的。」你的公司，连你都要不到信息。" },
          { "text": "配合演出：「对，我要的」", "effects": { "mood": -8, "trust": 4 },
            "reply": "你给自己画了个饼。老板的饼，自己消化。" },
          { "text": "【发疯】「以后『老板要的』，先来问老板」", "gang": 1, "isDui": true,
            "effects": { "bond": 12, "trust": -4, "mood": 8 },
            "reply": "全员群公告发出后，「老板要的」这个万能句式，当周使用率降为 0。" }
        ]
      }
    }
  },
  {
    "id": "ev_boss_wed", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [3], "slots": ["pm"],
    "title": "【周三Boss战】五彩斑斓的黑", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "金爸爸的终极审美需求来了：",
          "「Logo 放大一点，再缩小一点。要那种五彩斑斓的黑。周五要，今天周三。」"
        ],
        "choices": [
          { "text": "通宵调色，调出一个 #000 偏紫 5%", "effects": { "mood": -20, "kpi": 10, "trust": 8 },
            "reply": "凌晨两点，你调出了人类已知最接近「五彩斑斓的黑」的颜色。金爸爸：「嗯，有内味了。」" },
          { "text": "讲色彩学：黑色没有色相",
            "judge": { "base": 0.45,
              "successEffects": { "mood": 8, "kpi": 4 },
              "successReply": "你甩出《色彩原理》，金爸爸：「行吧，你们专业的。」知识，偶尔护主。",
              "failEffects": { "mood": -12, "trust": -6 },
              "failReply": "金爸爸：「我不要专业，我要五彩斑斓的黑。」甲方的世界，物理不存在。" } },
          { "text": "转给外包「增个援」", "hidden": "zhan",
            "effects": { "mood": 5, "kpi": 8, "fish": 6 },
            "reply": "锅已起飞，准确降落在乙方头顶。愿外包兄弟安息。" }
        ]
      },
      "mid": {
        "lines": [
          "金爸爸的需求砸进你团队，设计师已经改到第 18 稿。",
          "小卷在工位上小声说：「哥，世界上真的有那种黑吗？」"
        ],
        "choices": [
          { "text": "自己出面和金爸爸对齐标准", "effects": { "mood": -10, "bond": 12, "trust": 5 },
            "reply": "你替团队挡了三个小时的视频会。设计师看你的眼神，像看最后一个好人。" },
          { "text": "让设计师再改一版", "effects": { "bond": -12, "kpi": 6, "mood": -4 },
            "reply": "第 19 稿发出后，金爸爸回了两个字：不行。你俩一齐沉默。" },
          { "text": "一个电话过去", "hidden": "jiquan", "npc": { "jinba": 5 },
            "effects": { "mood": 8, "trust": 6 },
            "reply": "金爸爸：「哎呀老苟的事，那必须办。」黑不黑的，不重要了。" }
        ]
      },
      "boss": {
      "title": "【周三Boss战】大客户的五彩斑斓的黑",
        "lines": [
          "金爸爸，你 40% 的营收来源，提出两个要求：",
          "一，降价 20%。二，要五彩斑斓的黑。"
        ],
        "choices": [
          { "text": "咬住价格，送增值服务",
            "judge": { "base": 0.5,
              "successEffects": { "trust": 6, "kpi": 6, "mood": 6 },
              "successReply": "你送了他一个「VIP 专属顾问」。他觉得赚了，你觉得稳了。",
              "failEffects": { "kpi": -8, "trust": -4, "mood": -8 },
              "failReply": "金爸爸：「那我找别家了。」谈判桌上，最贵的是底气。" } },
          { "text": "降价保订单", "effects": { "kpi": -8, "trust": 6, "mood": -6 },
            "reply": "单子保住了。财务部的眼神，像在看一个正在流血的钱包。" },
          { "text": "【发疯】「黑就是黑，五彩斑斓的那是黑洞」", "hidden": "biantai", "gang": 1, "isDui": true, "npc": { "jinba": -8 },
            "effects": { "trust": -6, "mood": 10, "bond": 8 },
            "reply": "金爸爸挂了电话。十分钟后他发来消息：「……行吧，纯黑。」甲方也是人，只是偶尔不是。" }
        ]
      }
    }
  },
  {
    "id": "ev_boss_thu", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [4], "slots": ["am"],
    "title": "【周四Boss战】P0 事故复盘会", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "线上 P0：核心功能不可用 47 分钟。",
          "复盘会上，贾总：「说说吧，怎么回事。」所有人都在看发言名单，名单上写着你。"
        ],
        "choices": [
          { "text": "认锅，交出三千字复盘", "pot": 1,
            "effects": { "kpi": -8, "trust": 5, "mood": -10 },
            "reply": "复盘写得很深，深到把锅底都刨出来了。贾总点头：态度端正。" },
          { "text": "摆时间线：这锅该谁背", "gang": 1, "isDui": true,
            "judge": { "base": 0.5, "evidence": true,
              "successEffects": { "trust": 4, "mood": 8, "bond": 4 },
              "successReply": "时间线清晰如法医报告。锅在空中转了三圈，落在流程头上。流程没有感情，很好。",
              "failEffects": { "mood": -12, "pot": 1 },
              "failReply": "「别纠结细节了。」细节，恰恰是锅的形状。" },
            "needItem": "recorder" },
          { "text": "【发疯】「先说事实，再说责任」", "hidden": "zhen", "gang": 1, "isDui": true,
            "judge": { "base": 0.55,
              "successEffects": { "trust": 6, "bond": 8, "mood": 8 },
              "successReply": "你条理清晰地讲完事实，全场服气。贾总：「……可以。」公道，偶尔迟到但不缺席。",
              "failEffects": { "mood": -10, "pot": 1 },
              "failReply": "「事实重要还是态度重要？」——原来说态度的是他。" } }
        ]
      },
      "mid": {
        "lines": [
          "P0 复盘会，贾总需要一个「责任人」。",
          "名单在你手里：是替团队挡，还是交出执行的同学。"
        ],
        "choices": [
          { "text": "挡锅：「流程问题，责任在我」", "pot": 1,
            "effects": { "bond": 15, "trust": -6, "mood": -8 },
            "reply": "你把锅稳稳接住。当晚团队群里刷了一屏「哥牛逼」。你笑着，胃疼着。" },
          { "text": "交出执行同学", "effects": { "bond": -20, "trust": 8, "mood": -6 },
            "reply": "你说了「执行层面的问题」。团队安静了。第二天，那个工位上的绿萝蔫了。" },
          { "text": "「流程+执行，双因素整改」", "hidden": "jiquan",
            "judge": { "base": 0.55,
              "successEffects": { "bond": 8, "trust": 6, "mood": 4 },
              "successReply": "黑话救了所有人：锅被「因素」两个字稀释掉了。",
              "failEffects": { "bond": -8, "trust": -6, "pot": 1 },
              "failReply": "贾总：「说人话。」——说人话的结果，就是得有人背。" } }
        ]
      },
      "boss": {
      "title": "【周四Boss战】董事会质询",
        "lines": [
          "周四，董事会临时质询：现金流量表为什么这么难看？",
          "会议室里坐着三位董事，和一台正在录屏的电脑。"
        ],
        "choices": [
          { "text": "全盘坦白＋整改方案", "effects": { "trust": 6, "kpi": -6, "mood": -10 },
            "reply": "你把家底摊开。董事：「坦诚。」坦诚的代价，是接下来一小时的方向盘会。" },
          { "text": "继续讲增长故事",
            "judge": { "base": 0.45,
              "successEffects": { "trust": 8, "mood": 4 },
              "successReply": "故事讲圆了。董事们点点头——他们也在给 LP 讲故事，彼此彼此。",
              "failEffects": { "trust": -12, "mood": -10 },
              "failReply": "董事打断：「我要数字，不要散文。」你的散文，当场被退稿。" } },
          { "text": "【发疯】「钱在烧，但烧得值」", "hidden": "biantai", "gang": 1, "isDui": true,
            "effects": { "trust": -8, "mood": 8, "bond": 6 },
            "reply": "说完你自己都愣了：这话居然有点帅。董事会不高兴，但员工群很提气。" }
        ]
      }
    }
  },
  {
    "id": "ev_boss_fri", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [5], "slots": ["pm"],
    "title": "【周五Boss战】周报文学大赛", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "周五下午，全部门周报评比。",
          "规则很简单：把「没干完」，写成「阶段性成果沉淀」。文采即正义。"
        ],
        "choices": [
          { "text": "文学化包装：「完成了从0到0.8的突破」", "counter": "piesHeard",
            "effects": { "trust": 8, "kpi": 4, "mood": -4 },
            "reply": "你的周报获得「结构清晰、有沉淀」的好评。0 到 0.8，数学上很诚实，文学上很辉煌。" },
          { "text": "如实写：干了三件事，两件没干完", "effects": { "mood": 6, "trust": -4 },
            "reply": "领导看着你的周报沉默良久：「你很有勇气。」勇气，在绩效表上没有栏位。" },
          { "text": "把周报做成 20 页 PPT", "hidden": "cai",
            "effects": { "trust": 12, "mood": -10, "kpi": 6 },
            "reply": "三件事，20 页 PPT，平均每件事 6.6 页。你赢了比赛，输了一个周末。" }
        ]
      },
      "mid": {
        "lines": [
          "你汇总完团队的周报交上去，贾总改完发回来。",
          "数据和结论全改了，署名：贾总。你的团队看着改后的版本，集体沉默。"
        ],
        "choices": [
          { "text": "接受魔改，团队我来安抚", "effects": { "trust": 6, "bond": -8, "mood": -6 },
            "reply": "你在群里发了句「大家辛苦」。四个字，接住了所有委屈的一半。" },
          { "text": "找贾总对齐：「数据能不能不改」",
            "judge": { "base": 0.5,
              "successEffects": { "bond": 10, "trust": 4 },
              "successReply": "贾总：「行，按你的来。」你为团队守住了一次真实。",
              "failEffects": { "mood": -8, "trust": -4 },
              "failReply": "贾总：「这叫汇报的艺术。」艺术，源于数据之上。" } },
          { "text": "【发疯】把原版直接发到大群", "hidden": "baoyu", "gang": 1, "isDui": true,
            "effects": { "trust": -10, "bond": 12, "mood": 8 },
            "reply": "原版发出，数据醒目。贾总没说话。你的团队，永远记得这个周五。" }
        ]
      },
      "boss": {
      "title": "【周五Boss战】本月经营故事",
        "lines": [
          "周五，你要给投资人交「本月经营故事」。",
          "核心挑战：把「亏损」写成一个让人想加注的故事。"
        ],
        "choices": [
          { "text": "用数据说话，附三条对策",
            "judge": { "base": 0.5,
              "successEffects": { "trust": 8, "mood": 6 },
              "successReply": "投资人：「思路清楚，下月我们再聊。」数据，是最贵的故事。",
              "failEffects": { "trust": -6, "mood": -6 },
              "failReply": "投资人：「数字我看到了，逻辑呢？」逻辑：亏损。再问：逻辑。" } },
          { "text": "讲愿景：「我们在重塑行业」", "counter": "piesHeard",
            "effects": { "trust": 5, "mood": -4 },
            "reply": "你写了一篇小作文，用词宏大。宏大到你差点信了。" },
          { "text": "【发疯】把亏损写成「战略性投入」", "gang": 1, "isDui": true,
            "judge": { "base": 0.55,
              "successEffects": { "trust": 8, "mood": 6 },
              "successReply": "「投入」一词，价值百万。投资人当场表示下月追加考察。",
              "failEffects": { "trust": -8, "mood": -6 },
              "failReply": "投资人回了三个字：「接着烧。」你不知道是讽刺还是同意。" } }
        ]
      }
    }
  },
  {
    "id": "ev_boss_sat", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [6], "slots": ["noon"],
    "title": "【周六Boss战】团建还是加班", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "周六，公司团建：爬山＋聚餐＋才艺表演。",
          "通知里写着「自愿参加」，后面跟着「统计名单报贾总」。"
        ],
        "choices": [
          { "text": "去，给领导一个面子", "effects": { "mood": -8, "trust": 6, "fish": -6 },
            "reply": "你爬了一座山，走了一万八千步，加了两个平时不用加的人。这算团建吗？算，团建的是信任。" },
          { "text": "不去，在家躺尸", "effects": { "mood": 10, "trust": -8 },
            "reply": "你睡到自然醒，下午点了份炸鸡。名单上没有你，贾总记住了这一点。" },
          { "text": "去，但全程隐形", "effects": { "fish": 6, "trust": -2, "mood": 2 },
            "reply": "你在山顶看云，在饭局剥虾，才艺表演时去续了三次茶。存在感：0。恢复值：满。" },
          { "text": "【发疯】抢麦唱《爱如火》", "hidden": "cai", "flag": "karaoke",
            "effects": { "mood": 10, "bond": 8, "trust": -4 },
            "reply": "你一开嗓，全场举起手机。第二天，你成了公司内网热帖主角：《原来他是这样的人》。" }
        ]
      },
      "mid": {
        "lines": [
          "团建预算被砍半，原定的度假村变成了公司楼下烧烤摊。",
          "团队看着通知，没说话。你也看着通知，没说话。"
        ],
        "choices": [
          { "text": "自掏腰包补齐", "effects": { "money": -1, "bond": 14, "mood": -4 },
            "reply": "你补了差价，团队吃上了烧烤。没人知道钱是谁出的，但每个人都吃得很香。" },
          { "text": "改成「自愿参加的线上团建」", "effects": { "bond": -10, "mood": 2, "trust": -4 },
            "reply": "线上团建：大家在会议室里安静地吃了 40 分钟零食。散会。" },
          { "text": "【发疯】团建费直接折现发红包", "gang": 1, "isDui": true,
            "effects": { "bond": 10, "money": -1.5, "trust": -6 },
            "reply": "你在群里发了 30 个红包：「团建自由。」团队欢呼。贾总的眉毛，皱成了山川。" }
        ]
      },
      "boss": {
      "title": "【周六Boss战】团建讲话",
        "lines": [
          "周六团建，全员看着你，等你讲话。",
          "你手里的稿子上写着：「再讲两点。」实际上有八点。"
        ],
        "choices": [
          { "text": "画饼讲话：「明年，上市」", "counter": "piesHeard",
            "effects": { "bond": 8, "trust": 4, "mood": -4 },
            "reply": "你说完「明年上市」，台下响起礼貌的掌声。你自己都数了数，这是第几次说「明年」。" },
          { "text": "说真话：「公司很难，但我们一起扛」", "effects": { "bond": 14, "trust": -8, "mood": -6 },
            "reply": "真话说完，现场安静，然后有人带头鼓掌。真话很短，但很贵。" },
          { "text": "【发疯】讲话取消，直接发红包", "gang": 1, "isDui": true,
            "effects": { "bond": 16, "money": -1.5, "mood": 8 },
            "reply": "你把讲稿合上：「都吃好喝好。」那天团建的合影里，每个人都在笑。真的笑。" }
        ]
      }
    }
  },
  {
    "id": "ev_boss_sun", "series": "boss", "pool": "boss", "rarity": "epic", "weight": 1000,
    "days": [7], "slots": ["am"],
    "title": "【终局Boss战】绩效面谈", "scene": "boss",
    "variants": {
      "staff": {
        "lines": [
          "周日晚上，小会议室。安小姐微笑着翻开表格，贾总坐在旁边转笔。",
          "「这一周，辛苦了。我们聊聊绩效。」"
        ],
        "choices": [
          { "text": "听宣判，点头上税", "effects": { "mood": -4 },
            "reply": "你说「好的收到谢谢」，面谈 8 分钟结束。门外，天已经黑了。" },
          { "text": "做最后陈述：列出全部产出",
            "judge": { "base": 0.55,
              "successEffects": { "trust": 6, "mood": 8 },
              "successReply": "你一条条列完，安小姐在本子上写得很慢。数字，有时候会说话。",
              "failEffects": { "mood": -8 },
              "failReply": "「产出不代表价值。」价值，是一个无法被反驳的词。" } },
          { "text": "【发疯】反问：「那公司给我的呢？」", "hidden": "zhen", "gang": 1, "isDui": true,
            "effects": { "trust": -8, "mood": 10, "bond": 6 },
            "reply": "会议室安静五秒。贾总停止转笔。这个问题没有答案，但值得被问一次。" }
        ]
      },
      "mid": {
        "lines": [
          "绩效周，双面夹击：先给下属打分，再被贾总打分。",
          "你手里的名额：S 一个，C 一个。你的团队，八个人。"
        ],
        "choices": [
          { "text": "平均主义：全员 B，安全上岸", "effects": { "bond": 4, "trust": 4, "mood": -2 },
            "reply": "全员 B，无人欢喜无人愁。你用平庸换来了和平，和平值多少绩效，明年见。" },
          { "text": "按真实表现打", "effects": { "bond": -6, "trust": 8, "mood": -6 },
            "reply": "该 S 的 S，该 C 的 C。有人谢你，有人删了你。真实，是有价格的。" },
          { "text": "【发疯】给团队硬争第二个 S", "hidden": "baoyu", "gang": 1, "isDui": true,
            "judge": { "base": 0.5,
              "successEffects": { "bond": 14, "mood": 8 },
              "successReply": "你拿数据争下来一个名额。团队知道后，那天晚上的灯亮到很晚——在干活的灯。",
              "failEffects": { "trust": -8, "mood": -4 },
              "failReply": "贾总：「名额就是管理。」管理，翻译过来是：没有。" } }
        ]
      },
      "boss": {
      "title": "【终局Boss战】董事会评估会",
        "lines": [
          "周日晚，董事会年终（周）评估会。",
          "议题只有一行：这个 CEO，下一周还干不干？"
        ],
        "choices": [
          { "text": "汇报成果：数字+故事各一半",
            "judge": { "base": 0.5,
              "successEffects": { "trust": 8, "mood": 6 },
              "successReply": "一半数字一半故事，比例刚好。董事：「继续吧。」你保住了方向盘。",
              "failEffects": { "trust": -8, "mood": -8 },
              "failReply": "「故事我们听腻了。」原来故事的保质期，只有一周。" } },
          { "text": "承认不足＋给出新打法", "effects": { "trust": 4, "bond": 4, "mood": -4 },
            "reply": "你说了三次「我的责任」。董事们的表情，从寒冷转成了常温。" },
          { "text": "【发疯】「下周，我画个真饼给你们」", "hidden": "biantai", "gang": 1, "isDui": true,
            "effects": { "trust": -6, "bond": 8, "mood": 8 },
            "reply": "全场愣住，然后有人笑了。会议室第一次有了人味。董事会也需要一点发疯。" }
        ]
      }
    }
  }
];
