#!/usr/bin/env python3
"""牛马求生记 · 数据文件校验：node 真实加载（同浏览器）+ 结构 + 引用完整性。"""
import json, re, subprocess, sys, os, shutil, io

HERE = os.path.dirname(os.path.abspath(__file__))
STAFF_PERSONAS = {"huang", "zhen", "zhan", "cai", "jin"}
MID_PERSONAS = {"shetou", "baoyu", "jiquan"}
BOSS_PERSONAS = {"normal", "biantai", "feiren"}
PERSONAS = STAFF_PERSONAS | MID_PERSONAS | BOSS_PERSONAS
JOBS = {"staff", "mid", "boss"}
NPCS = {"jia", "chang", "jinba", "lai", "an", "juan", "wang", "lisa"}  # 兼容默认；实际用 data/characters.js 的 npcs
ITEMS = {"coffee", "cookie", "film", "recorder", "resign", "report"}
SERIES = {"pua", "blame", "client", "exclude", "meeting", "overtime", "politics", "fish", "story", "boss"}
SLOTS = {"morning", "am", "noon", "pm", "evening", "off"}
RARITY = {"common", "rare", "epic"}
SCENES = {"im", "ticket", "chat", "boss"}
STAT_KEYS = {"mood", "kpi", "bond", "trust", "fish", "money"}
EFFECT_COUNTER_KEYS = {"pot", "gang", "gossip"}
COUNTERS = {"fishToilet", "piesHeard", "duiWins", "wangTalks", "overtimeStreak", "piesDrawn", "potPassed"}

def load_via_node():
    node = shutil.which("node")
    if not node:
        raise RuntimeError("node 不可用")
    out = subprocess.run([node, os.path.join(HERE, "dump_data.js")],
                         capture_output=True, text=True, timeout=30)
    if out.returncode != 0:
        raise RuntimeError("node 加载失败:\n" + out.stderr)
    return json.loads(out.stdout)

def check_effects(where, eff, errs):
    if not isinstance(eff, dict):
        errs.append(f"{where}: effects 不是对象"); return
    for k, v in eff.items():
        if k in EFFECT_COUNTER_KEYS:
            if not isinstance(v, int) or isinstance(v, bool):
                errs.append(f"{where}: 计数器增量非法 {k}={v}")
            continue
        if k not in STAT_KEYS:
            errs.append(f"{where}: 未知属性键 {k}"); continue
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            errs.append(f"{where}: 属性值非法 {k}={v}")
        if k == "money" and abs(v * 2 - round(v * 2)) > 1e-9:
            errs.append(f"{where}: money 步进必须 0.5 ({v})")

# 事件池 → 该池玩家可选的人设（general 池三条线共用，不做限制）
POOL_PERSONAS = {
    "staff": STAFF_PERSONAS,
    "mid": MID_PERSONAS,
    "boss": BOSS_PERSONAS,
}

def check_choice_count(where, ev, errs):
    """每个职级的人设都应有 ≥2 个可见选项：hidden 白名单不能把选项抽空"""
    pool = ev.get("pool")
    cond = ev.get("cond") or {}
    job = cond.get("job") or (pool if pool in POOL_PERSONAS else None)
    if not job or job == "general":
        return
    choices = ev.get("choices") or []
    for pid in POOL_PERSONAS.get(job, set()):
        visible = 0
        for c in choices:
            h = c.get("hidden")
            hs = [h] if isinstance(h, str) else (h or [])
            if not hs or pid in hs:
                visible += 1
        if visible < 2:
            errs.append(f"{where}: {pid} 只有 {visible} 个可见选项（<2）")

def check_hidden_reachable(where, ch, pool, errs, cond=None):
    """hidden 是白名单语义：限定了该池玩家无法选择的人设 = 永远不会出现的死选项"""
    if "hidden" not in ch:
        return
    h = ch["hidden"]
    hs = [h] if isinstance(h, str) else list(h)
    # 事件自带 cond.job（如 ev_evening_mid）时，用 cond.job 判定
    job = (cond or {}).get("job") or (pool if pool in POOL_PERSONAS else None)
    if not job:
        return
    allowed = POOL_PERSONAS.get(job, set())
    dead = [x for x in hs if x not in allowed]
    if dead:
        errs.append(f"{where}: hidden {dead} 不属于 {job} 线可达人设（死选项）")

def check_choice(where, ch, ids, errs, pool=None, cond=None, npcs=None):
    if not isinstance(ch.get("text"), str):
        errs.append(f"{where}: choice 缺 text")
    if "hidden" in ch:
        h = ch["hidden"]
        ok = h in PERSONAS or (isinstance(h, list) and set(h) <= PERSONAS)
        if not ok: errs.append(f"{where}: hidden 非法人设 {h}")
    if "needItem" in ch and ch["needItem"] not in ITEMS:
        errs.append(f"{where}: needItem 非法 {ch['needItem']}")
    if "item" in ch and ch["item"] not in ITEMS:
        errs.append(f"{where}: item 非法 {ch['item']}")
    if "effects" in ch: check_effects(where + ".effects", ch["effects"], errs)
    if "judge" in ch:
        j = ch["judge"]
        b = j.get("base")
        if not isinstance(b, (int, float)) or not (0 < b <= 1):
            errs.append(f"{where}: judge.base 非法 {b}")
        if "evidence" in j and not isinstance(j["evidence"], bool):
            errs.append(f"{where}: judge.evidence 应为布尔值")
        for sub in ("successEffects", "failEffects"):
            if sub in j: check_effects(f"{where}.{sub}", j[sub], errs)
    if "pot" in ch and (not isinstance(ch["pot"], int) or ch["pot"] <= 0):
        errs.append(f"{where}: pot 非法")
    if "npc" in ch:
        if not isinstance(ch["npc"], dict):
            errs.append(f"{where}: npc 应为对象")
        else:
            for k, v in ch["npc"].items():
                if npcs is not None and k not in npcs: errs.append(f"{where}: npc 非法 {k}")
                elif not isinstance(v, int): errs.append(f"{where}: npc 值非法 {k}")
    if "counter" in ch:
        c = ch["counter"]; cs = [c] if isinstance(c, str) else c
        for x in cs:
            if x not in COUNTERS: errs.append(f"{where}: counter 非法 {x}")
    if "chain" in ch:
        cid = ch["chain"].get("id"); ad = ch["chain"].get("afterDays")
        if cid not in ids: errs.append(f"{where}: chain 引用不存在 {cid}")
        if not (isinstance(ad, int) and 1 <= ad <= 2):
            errs.append(f"{where}: chain.afterDays 应为 1~2 ({ad})")
    if "failFlag" in ch or "flag" in ch:
        pass
    if "overtime" in ch and not isinstance(ch["overtime"], bool):
        errs.append(f"{where}: overtime 应为布尔值")
    if "isDui" in ch and not isinstance(ch["isDui"], bool):
        errs.append(f"{where}: isDui 应为布尔值")
    # 追问轮：含 lines + choices，选项按同一套规则递归校验
    if "followup" in ch:
        fb = ch["followup"]
        fw = where + ".followup"
        if not isinstance(fb, dict):
            errs.append(f"{fw}: 应为对象")
        else:
            if not isinstance(fb.get("lines"), list) or not (1 <= len(fb["lines"]) <= 4):
                errs.append(f"{fw}: lines 异常")
            fch = fb.get("choices")
            if not fch or not (2 <= len(fch) <= 4):
                errs.append(f"{fw}: 选项数异常 {len(fch) if fch else 0}")
            else:
                for i, c in enumerate(fch):
                    check_choice(f"{fw}.c{i}", c, ids, errs, pool, cond, npcs)
                    check_hidden_reachable(f"{fw}.c{i}", c, pool, errs, cond)
                # 追问同样要保证每个可达人设都有 ≥2 个可见选项
                job = (cond or {}).get("job") or (pool if pool in POOL_PERSONAS else None)
                if job:
                    for pid in POOL_PERSONAS.get(job, set()):
                        vis = 0
                        for c in fch:
                            h = c.get("hidden")
                            hs = [h] if isinstance(h, str) else (h or [])
                            if not hs or pid in hs:
                                vis += 1
                        if vis < 2:
                            errs.append(f"{fw}: {pid} 只有 {vis} 个可见选项（<2）")

def check_event(e, ids, errs, npcs=None):
    where = e.get("id", "???")
    if not re.match(r"^ev_[a-z0-9_]+$", where):
        errs.append(f"id 命名不合法: {where}")
    if e.get("series") not in SERIES: errs.append(f"{where}: series 非法 {e.get('series')}")
    if e.get("pool") not in JOBS | {"general"}: errs.append(f"{where}: pool 非法 {e.get('pool')}")
    if e.get("rarity") not in RARITY: errs.append(f"{where}: rarity 非法")
    if e.get("scene") not in SCENES: errs.append(f"{where}: scene 非法 {e.get('scene')}")
    if "scheduledOnly" in e and not isinstance(e["scheduledOnly"], bool):
        errs.append(f"{where}: scheduledOnly 应为布尔值")
    if "scheduledOnlyJobs" in e:
        jobs = e["scheduledOnlyJobs"]
        if not isinstance(jobs, list) or not jobs or any(j not in JOBS for j in jobs):
            errs.append(f"{where}: scheduledOnlyJobs 应为非空职级列表")
    if not e.get("title"):
        errs.append(f"{where}: 缺 title")
    if "variants" not in e:
        if not isinstance(e.get("lines"), list) or not (1 <= len(e["lines"]) <= 5):
            errs.append(f"{where}: lines 异常")
    if "days" in e and not all(isinstance(d, int) and 1 <= d <= 7 for d in e["days"]):
        errs.append(f"{where}: days 非法")
    if "slots" in e and not set(e["slots"]) <= SLOTS:
        errs.append(f"{where}: slots 非法 {e['slots']}")
    if "timer" in e and not (3 <= e["timer"] <= 15):
        errs.append(f"{where}: timer 应在 3~15 秒")
    if "cond" in e:
        allowed = {"trustLt","trustGt","kpiLt","kpiGt","moodLt","moodGt","bondLt","bondGt",
                   "potGte","gangGte","dayGte","persona","job","flag","npcGte"}
        for k, v in e["cond"].items():
            if k not in allowed: errs.append(f"{where}: cond 键非法 {k}")
            elif k == "persona" and v not in PERSONAS: errs.append(f"{where}: cond.persona 非法")
            elif k == "job" and v not in JOBS: errs.append(f"{where}: cond.job 非法")
            elif k == "npcGte" and not isinstance(v, dict): errs.append(f"{where}: cond.npcGte 非法")
    if "variants" in e:
        for job, var in e["variants"].items():
            if job not in JOBS: errs.append(f"{where}: variants 非法职级 {job}"); continue
            if "lines" not in var or "choices" not in var:
                errs.append(f"{where}.variants.{job} 缺 lines/choices"); continue
            if not (2 <= len(var["choices"]) <= 4):
                errs.append(f"{where}.variants.{job}: 选项数 {len(var['choices'])}")
            for i, ch in enumerate(var["choices"]):
                check_choice(f"{where}.variants.{job}.c{i}", ch, ids, errs, job, None, npcs)
                check_hidden_reachable(f"{where}.variants.{job}.c{i}", ch, job, errs, None)
    else:
        chs = e.get("choices")
        if not chs or not (2 <= len(chs) <= 4):
            errs.append(f"{where}: 选项数异常 {len(chs) if chs else 0}")
        else:
            check_choice_count(where, e, errs)
            for i, ch in enumerate(chs):
                check_choice(f"{where}.c{i}", ch, ids, errs, e.get("pool"), e.get("cond"), npcs)
                check_hidden_reachable(f"{where}.c{i}", ch, e.get("pool"), errs, e.get("cond"))


def check_repeat_and_skills(e, errs):
    """repeat 必须是正整数；人设/职级技能的 trigger 必须是引擎认识的值"""
    if "repeat" in e:
        r = e["repeat"]
        if not isinstance(r, int) or isinstance(r, bool) or r < 1:
            errs.append(f"{e.get('id')}: repeat 应为正整数，实际 {r}")

def check_reachable(where, ev, boss_slots, errs):
    """事件声明的 (days × slots) 若全被每日 Boss 占死，则永远不会被抽到"""
    days, slots = ev.get("days"), ev.get("slots")
    if not days or not slots:
        return
    if ev.get("pool") == "boss" and (ev.get("weight") or 0) >= 999:
        return                     # 每日 Boss 本身就是占位者
    for d in days:
        for sl in slots:
            if sl not in boss_slots.get(d, set()):
                return             # 找到一个未被占用的时段即可达
    errs.append(f"{where}: 声明的时段全被每日 Boss 占用，事件永远抽不到（days={days}, slots={slots}）")

def check_speaker_prefixes(where, ev, speakers, warns):
    """带冒号但不是白名单发言人的行 → 会渲染成系统旁白，提醒作者确认是否有意"""
    lines = []
    if "lines" in ev:
        lines = ev["lines"]
    for job, var in (ev.get("variants") or {}).items():
        lines = lines + list(var.get("lines") or [])
    for ln in lines:
        m = re.match(r'^([^：]{1,6})：', ln)
        if m and m.group(1) not in speakers:
            warns.append(f"{where}: 行首「{m.group(1)}：」不在 speakers 白名单 → 会按旁白渲染（确认是否有意）")

def check_skill_trigger(label, skill, errs):
    if not skill:
        return
    TRIGGERS = {"manual_any", "manual_blame", "passive", "auto_mood", "auto_lethal"}
    if skill.get("trigger") not in TRIGGERS:
        errs.append(f"{label}: skill.trigger 非法 {skill.get('trigger')}")
    u = skill.get("uses")
    if not isinstance(u, int) or isinstance(u, bool) or u < 0:
        errs.append(f"{label}: skill.uses 非法 {u}")

ACH_KEYS = {"mood", "kpi", "bond", "trust", "fish", "money", "minMood", "pot", "gang", "gossip"} | COUNTERS

def check_achievements(ach, endings, errs):
    ids, eids = set(), {e.get("id") for e in endings}
    for a in ach:
        aid = a.get("id")
        if not aid:
            errs.append("成就缺少 id"); continue
        if aid in ids:
            errs.append(f"成就 id 重复: {aid}")
        ids.add(aid)
        if a.get("stage", "process") not in {"process", "final"}:
            errs.append(f"成就 {aid} 的判定阶段非法")
        t = a.get("test") or ""
        m = re.match(r"^(\w+)(>=|<=|>|<)(\d+(?:\.\d+)?)$", t)
        if m:
            if m.group(1) not in ACH_KEYS:
                errs.append(f"成就 {aid} 的统计键无法解析: {m.group(1)}")
        elif t.startswith("flag "):
            if not t[5:].strip():
                errs.append(f"成就 {aid} 的 flag 条件为空")
        elif t.startswith("ending "):
            if t[7:] not in eids:
                errs.append(f"成就 {aid} 引用了不存在的结局: {t[7:]}")
        else:
            errs.append(f"成就 {aid} 的 test 语法非法: {t!r}")
        p = a.get("persona")
        if p is not None and p not in PERSONAS:
            errs.append(f"成就 {aid} 的 persona 非法: {p}")
        jb = a.get("job")
        if jb is not None and jb not in JOBS:
            errs.append(f"成就 {aid} 的 job 非法: {jb}")
        if "hidden" in a and not isinstance(a.get("hidden"), bool):
            errs.append(f"成就 {aid} 的 hidden 必须是布尔值")
        nm = a.get("name") or ""
        if not (2 <= len(nm) <= 20):
            errs.append(f"成就 {aid} 的名字长度非法: {nm!r}")
        if not a.get("emoji"):
            errs.append(f"成就 {aid} 缺少 emoji")
    for pid in sorted(PERSONAS):
        own = [a for a in ach if a.get("persona") == pid]
        if not [a for a in own if not a.get("hidden")]:
            errs.append(f"人设 {pid} 缺少专属成就")
        if not [a for a in own if a.get("hidden")]:
            errs.append(f"人设 {pid} 缺少签名隐藏成就")
    print(f"  成就: {len(ach)} 个（通用 {len([a for a in ach if not a.get('persona')])}"
          f" · 人设专属 {len([a for a in ach if a.get('persona') and not a.get('hidden')])}"
          f" · 隐藏签名 {len([a for a in ach if a.get('hidden')])}）")

def item_reachability(all_events):
    """返回 (item -> 可获得它的职级集合, [(位置, 道具, 可选中它的职级集合)])"""
    obtain, need = {}, []
    ALLJ = {"staff", "mid", "boss"}

    def jobs_of(e, default_jobs):
        cj = (e.get("cond") or {}).get("job")
        return {cj} if cj else default_jobs

    def scan(choices, jobs, where):
        for i, ch in enumerate(choices or []):
            if ch.get("item"):
                obtain.setdefault(ch["item"], set()).update(jobs)
            if ch.get("needItem"):
                need.append((f"{where}.c{i}", ch["needItem"], set(jobs)))

    for e in all_events:
        pool = e.get("pool")
        base = set(ALLJ) if pool == "general" else {pool}
        base = jobs_of(e, base)
        scan(e.get("choices"), base, e.get("id", "?"))
        for job, v in (e.get("variants") or {}).items():
            scan(v.get("choices"), {job}, f"{e.get('id','?')}.variants.{job}")
    return obtain, need


def check_item_reachability(all_events, errs, warns, chars=None):
    """needItem 是白名单门槛：某条线拿不到该道具，这个选项对那条线就是永远不出现的死选项"""
    obtain, need = item_reachability(all_events)
    # 起始道具按职级（一线/中层=辞职信，老板=退出协议）
    jobs_def = (chars or {}).get("jobs") or {}
    for jid, jd in jobs_def.items():
        obtain.setdefault(jd.get("startItem") or "resign", set()).add(jid)
    obtain.setdefault("resign", set()).update({"staff", "mid"})
    for job in sorted(JOBS):
        got = sorted(i for i, js in obtain.items() if job in js)
        warns.append(f"{job} 线可获得道具: {got}")
    for where, item, jobs in need:
        lack = sorted(j for j in jobs if j not in obtain.get(item, set()))
        if lack:
            errs.append(f"{where} 需要道具 {item}，但 {'/'.join(lack)} 线拿不到 → 死选项")


def check_duplicate_effect_keys(root, errs):
    """同一 effects 块里重复写同名键（后一个会静默覆盖前一个）——正则替换最容易踩的坑"""
    import glob
    for path in sorted(glob.glob(os.path.join(root, "data", "*.js"))):
        src = io.open(path, encoding="utf-8").read()
        for m in re.finditer(r'"effects"\s*:\s*\{([^{}]*)\}', src):
            keys = re.findall(r'"([a-z]+)"\s*:', m.group(1))
            dup = {k for k in keys if keys.count(k) > 1}
            if dup:
                line = src[:m.start()].count("\n") + 1
                errs.append(f"{os.path.basename(path)}:{line} effects 重复键 {sorted(dup)}（后者会覆盖前者）")


def check_filler(filler, idset, errs):
    """兜底微事件池：结构简单、效果轻微、必须有重复上限（否则一周只出现一次）"""
    if not filler:
        errs.append("填充事件池 EV_FILLER 缺失或为空")
        return
    seen = set()
    for f in filler:
        fid = f.get("id", "?")
        if not str(fid).startswith("ev_fill_"):
            errs.append(f"填充事件 {fid} 的 id 应以 ev_fill_ 开头")
        if fid in seen:
            errs.append(f"填充事件 id 重复: {fid}")
        if fid in idset:
            errs.append(f"填充事件 id 与正式事件冲突: {fid}")
        seen.add(fid)
        if not f.get("title"):
            errs.append(f"{fid} 缺 title")
        if not f.get("lines"):
            errs.append(f"{fid} 缺 lines")
        if not f.get("repeat"):
            errs.append(f"{fid} 必须声明 repeat（否则一周只能出现一次）")
        for k in ("needItem", "hidden", "judge", "chain", "cond"):
            if k in f:
                errs.append(f"{fid} 不应含 {k}（兜底事件保持简单）")
        # variants 允许（老板线换视角），但变体自身也要保持简单
        for jb, v in (f.get("variants") or {}).items():
            if len(v.get("choices") or []) < 2:
                errs.append(f"{fid}.variants.{jb} 至少要有 2 个选项")
            for k in ("needItem", "hidden", "judge", "chain", "cond"):
                if any(k in c for c in (v.get("choices") or [])):
                    errs.append(f"{fid}.variants.{jb} 不应含 {k}")
        chs = f.get("choices") or []
        if len(chs) < 2:
            errs.append(f"{fid} 至少要有 2 个选项（否则又变成点一下跳过）")
        if len(chs) > 3:
            errs.append(f"{fid} 选项不宜超过 3 个（兜底事件要短）")
        for i, c in enumerate(chs):
            if not c.get("reply"):
                errs.append(f"{fid}.c{i} 缺 reply")
            eff = c.get("effects") or {}
            check_effects(f"{fid}.c{i}", eff, errs)
            for k, v in eff.items():
                if k in STAT_KEYS and abs(v) > 6:
                    errs.append(f"{fid}.c{i} 效果过大 {k}={v}（兜底事件应轻微）")


def main():
    try:
        data = load_via_node()
    except RuntimeError as ex:
        print("[FAIL] 加载失败:", ex); sys.exit(1)
    errs = []
    chars, endings, ach = data["characters"], data["endings"], data["achievements"]
    if set(chars["jobs"]) != JOBS: errs.append("jobs 不全")
    if set(chars["personas"]) != PERSONAS: errs.append("personas 不全")
    if len(endings) < 10: errs.append("结局过少")
    if len(ach) < 10: errs.append("成就过少")
    check_achievements(ach, endings, errs)
    GRADES = {"S", "A", "B", "C", "D"}
    for e in endings:
        if e.get("grade") not in GRADES:
            errs.append(f"结局 {e.get('id')} grade 非法 {e.get('grade')}")
        for k in ("gradeCap", "gradeFloor"):
            if k in e and e[k] not in GRADES:
                errs.append(f"结局 {e.get('id')} {k} 非法 {e[k]}")
        if "gradeCap" in e and "gradeFloor" in e:
            order = ["D", "C", "B", "A", "S"]
            if order.index(e["gradeFloor"]) > order.index(e["gradeCap"]):
                errs.append(f"结局 {e.get('id')}: gradeFloor 高于 gradeCap")

    # 人设/职级技能声明校验
    for pid, p in chars["personas"].items():
        check_skill_trigger(f"persona {pid}", p.get("skill"), errs)
    for jid, j in chars["jobs"].items():
        check_skill_trigger(f"job {jid}", j.get("skill"), errs)

    all_events, all_ids = [], []
    for label, evs in data["events"].items():
        if evs is None:
            errs.append(f"事件池 {label} 缺失"); continue
        all_events += evs
        all_ids += [e["id"] for e in evs]
        print(f"  {label}: {len(evs)} 个事件")
    dup = {x for x in all_ids if all_ids.count(x) > 1}
    if dup: errs.append(f"id 重复: {dup}")
    idset = set(all_ids)

    # 每日 Boss 占位表：{day: {slot, ...}}
    boss_slots = {}
    for e in all_events:
        if e.get("pool") == "boss" and (e.get("weight") or 0) >= 999:
            for d in e.get("days") or []:
                boss_slots.setdefault(d, set()).update(e.get("slots") or [])

    speakers = set(chars.get("speakers") or [])
    warns = []
    for e in all_events:
        check_event(e, idset, errs, set(chars.get("npcs") or {}))
        check_repeat_and_skills(e, errs)
        check_reachable(e.get("id", "???"), e, boss_slots, errs)
        check_speaker_prefixes(e.get("id", "???"), e, speakers, warns)

    # ---- 道具可达性（v3.6 新增：防止 needItem 死选项） ----
    check_item_reachability(all_events, errs, warns, chars)
    # ---- 兜底微事件池（v3.6 新增） ----
    check_filler(data.get("filler"), idset, errs)

    check_duplicate_effect_keys(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), errs)

    # ---- 人设专属结局台词（v1.8） ----
    pe = data.get("personaEpilogues") or {}
    pov = data.get("personaOverrides") or {}
    ending_ids = {e.get("id") for e in endings}
    for pid in sorted(PERSONAS):
        ep = pe.get(pid)
        if not ep:
            errs.append(f"人设 {pid} 缺少专属收尾台词")
        else:
            for k in ("win", "lose"):
                t = ep.get(k)
                if not isinstance(t, str) or not t.strip():
                    errs.append(f"人设 {pid} 的 {k} 台词缺失")
                elif not (8 <= len(t) <= 60):
                    errs.append(f"人设 {pid} 的 {k} 台词长度 {len(t)} 超出 8~60（卡面放不下）")
        if pid not in pov:
            errs.append(f"人设 {pid} 缺少签名结局覆盖")
    for pid, ov in pov.items():
        if pid not in PERSONAS:
            errs.append(f"签名结局覆盖里的人设非法: {pid}")
            continue
        if not ov:
            errs.append(f"人设 {pid} 的签名结局覆盖为空")
        for eid, pt in ov.items():
            if eid not in ending_ids:
                errs.append(f"人设 {pid} 的签名结局 id 不存在: {eid}")
            nm = pt.get("name")
            if not isinstance(nm, str) or not (2 <= len(nm) <= 24):
                errs.append(f"{pid}.{eid} 签名结局名长度非法: {nm}")
            tx = pt.get("text")
            if not isinstance(tx, str) or not (40 <= len(tx) <= 240):
                errs.append(f"{pid}.{eid} 签名结局文案长度非法: {len(tx) if isinstance(tx, str) else tx}")
    print(f"  人设台词: {len(pe)} 个人设 × win/lose · 签名结局: {sum(len(v) for v in pov.values())} 个")

    print(f"  合计事件: {len(all_events)}（含 {len(data['events']['bosses'])} 个每日Boss）")
    if warns:
        print(f"\n[WARN] {len(warns)} 条提示（不阻断）：")
        for x in warns[:20]: print("  ~", x)
    if errs:
        print("\n[FAIL]")
        for x in errs[:50]: print("  -", x)
        sys.exit(1)
    print("[OK] 全部数据校验通过")

if __name__ == "__main__":
    main()
