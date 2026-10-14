#!/usr/bin/env node
/**
 * tools/e2e.js —— 牛马求生记 · 端到端回归测试（零依赖）
 *
 * 原理：内置静态服务器 + 本机 Chromium（chrome-headless-shell）+ CDP over WebSocket。
 *       Node 22+ 自带全局 WebSocket，因此不需要 playwright/puppeteer。
 *
 * 用法：
 *   node tools/e2e.js                 # 跑全部断言
 *   node tools/e2e.js --keep-open     # 结束后不关浏览器（调试用）
 *   CHROME_PATH=/path/to/chrome node tools/e2e.js
 *
 * 退出码：0 = 全部通过；1 = 有失败（失败清单打印在末尾）
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json"
};

// ---------------------------------------------------------------- 静态服务器
function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      try {
        let rel = decodeURIComponent((req.url || "/").split("?")[0]);
        if (rel === "/") rel = "/index.html";
        const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
        // 越权路径直接 404（仅本机 127.0.0.1 监听，但保持防御）
        if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(404); res.end("not found"); return; }
        if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
      } catch (e) {
        res.writeHead(400); res.end("bad request");   // 畸形 URL 不该让测试进程崩掉
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// ---------------------------------------------------------------- 找浏览器
function findBrowser() {
  const cands = [];
  if (process.env.CHROME_PATH) cands.push(process.env.CHROME_PATH);
  const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
  if (fs.existsSync(cache)) {
    const dirs = fs.readdirSync(cache).filter(d => /^(chromium|chromium_headless_shell)-/.test(d))
      .sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
    for (const d of dirs) {
      for (const sub of ["chrome-headless-shell-mac-arm64", "chrome-headless-shell-mac-x64",
                         "chrome-mac/Chromium.app/Contents/MacOS", "chrome-mac-arm64/Chromium.app/Contents/MacOS"]) {
        for (const bin of ["chrome-headless-shell", "Chromium"]) {
          cands.push(path.join(cache, d, sub, bin));
        }
      }
    }
  }
  cands.push(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"
  );
  return cands.find(p => { try { return fs.existsSync(p) && fs.statSync(p).isFile(); } catch (e) { return false; } });
}

// ---------------------------------------------------------------- 极简 CDP 客户端
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        this.handlers.forEach(h => h(msg));
      }
    });
    ws.addEventListener("close", () => {
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error("CDP 连接已关闭"));
      }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("CDP 超时: " + method)); }
      }, 40000);
      this.pending.set(id, { resolve, reject, timer });
    });
  }
  on(fn) { this.handlers.push(fn); }
}

// ---------------------------------------------------------------- 断言框架
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail: detail === undefined ? "" : String(detail) });
  console.log(`  ${ok ? "✅" : "❌"} ${name}${detail ? "  —— " + detail : ""}`);
}

// ---------------------------------------------------------------- 页面内驱动脚本
const PAGE_HELPERS = `
// 页面内错误计数器：CDP 的 Runtime.exceptionThrown 抓不到「事件监听器里抛出的异常」，
// 之前 deltaChips 的 ReferenceError 就是这样漏掉、只表现为流程卡死。
if (!window.__e2eRuntime) {
  window.__e2eRuntime = [];
  window.addEventListener('error', (e) => {
    window.__e2eRuntime.push(String((e && (e.message || (e.error && e.error.message))) || 'error'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    window.__e2eRuntime.push('unhandledrejection: ' + String((e && e.reason && e.reason.message) || (e && e.reason) || ''));
  });
}
window.__e2e = {
  sleep: (ms) => new Promise(r => setTimeout(r, ms)),
  async playWeek(job, persona, maxSteps) {
    const steps = maxSteps || 900;
    localStorage.clear();
    window.App.newGame({ job, persona, dept: 'tech', name: 'E2E', no: 'JJ1' });
    await window.__e2e.sleep(250);
    const ov0 = document.querySelector('#overlay:not(.hidden)');
    if (ov0) { ov0.click(); await window.__e2e.sleep(200); }
    let n = 0;
    while (n < steps) {
      n++;
      const inline = document.querySelector('#reply-continue');
      if (inline) { inline.click(); await window.__e2e.sleep(2); continue; }
      const b = document.querySelector('#overlay:not(.hidden) #ov-btn');
      if (b) { b.click(); await window.__e2e.sleep(2); continue; }
      const ov = document.querySelector('#overlay:not(.hidden)');
      if (ov) { ov.click(); await window.__e2e.sleep(2); continue; }
      const es = document.querySelector('#screen-ending');
      if (es && !es.classList.contains('hidden')) break;
      const cs = document.querySelectorAll('#choices .choice');
      if (cs.length) { cs[Math.floor(Math.random() * cs.length)].click(); await window.__e2e.sleep(2); continue; }
      await window.__e2e.sleep(12);
    }
    await window.__e2e.sleep(300);
    const st = window.App.state();
    return {
      steps: n,
      ended: !document.querySelector('#screen-ending').classList.contains('hidden'),
      job: st.char.job, persona: st.char.persona,
      endingName: (document.querySelector('.end-name') || {}).textContent || null,
      seal: (document.querySelector('.end-seal') || {}).textContent || null,
      journal: (st.journal || []).map(j => ({ title: j.title, evId: j.evId, day: j.day })),
      achAll: st.achievements || [],
      achVisible: window.Engine.achievementsFor(st).map(a => a.id),
      endingText: (document.querySelector('.end-fulltext') || {}).textContent || ''
    };
  },
  openReview() {
    const b = document.querySelector('#btn-review');
    if (!b) return false;
    b.click();
    return true;
  },
  reviewInfo() {
    const s = document.querySelector('#screen-review');
    return {
      moments: s.querySelectorAll('.rv-moment').length,
      foldItems: s.querySelectorAll('.rv-all .rv-item').length,
      foldText: (s.querySelector('.rv-all summary') || {}).textContent || '',
      halfPunct: /[\\u4e00-\\u9fff][,\\.!\\?:;()]/.test(s.textContent),
      hasReviewBtn: !!document.querySelector('#rv-save'),
      tips: Array.from(s.querySelectorAll('.tips')).map(e => e.textContent).join(' | ')
    };
  },
  /**
   * 用固定种子的 PRNG 跑一段初始化代码，让「随机工牌 / 随机开场白」等变成确定性内容，
   * 这样截图对比才不会被 Math.random 干扰。
   */
  seed(code) {
    const orig = Math.random;
    let s = 20261014;
    Math.random = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
    try { return eval(code); } finally { Math.random = orig; }
  },
  /** 关掉动画/过渡与光标闪烁，保证截图稳定 */
  freeze() {
    if (document.getElementById('__e2e_freeze')) return true;
    const el = document.createElement('style');
    el.id = '__e2e_freeze';
    el.textContent = '*,*::before,*::after{animation:none !important;transition:none !important;caret-color:transparent !important}' + '::-webkit-scrollbar{width:0 !important;height:0 !important;display:none !important}';
    document.head.appendChild(el);
    return true;
  },
  /** 在页面里比较两张 PNG（浏览器负责解码，Node 侧零依赖），返回差异像素占比 */
  diffPng(base64A, base64B) {
    return new Promise((resolve) => {
      const load = (src) => new Promise((res) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = () => res(null);
        img.src = 'data:image/png;base64,' + src;
      });
      Promise.all([load(base64A), load(base64B)]).then(([ia, ib]) => {
        if (!ia || !ib) { resolve({ ratio: 1, reason: '图片解码失败' }); return; }
        const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const cx = cv.getContext('2d', { willReadFrequently: true });
        cx.drawImage(ia, 0, 0);
        const A = cx.getImageData(0, 0, w, h).data;
        cx.clearRect(0, 0, w, h);
        cx.drawImage(ib, 0, 0);
        const B = cx.getImageData(0, 0, w, h).data;
        let diff = 0;
        for (let i = 0; i < A.length; i += 4) {
          if (Math.abs(A[i] - B[i]) > 6 || Math.abs(A[i + 1] - B[i + 1]) > 6 || Math.abs(A[i + 2] - B[i + 2]) > 6) diff++;
        }
        resolve({
          ratio: diff / (w * h),
          size: ia.width + 'x' + ia.height + (ia.width === ib.width && ia.height === ib.height ? '' : ' vs ' + ib.width + 'x' + ib.height)
        });
      });
    });
  }
};
true;
`;

// ---------------------------------------------------------------- 主流程
(async () => {
  const browserPath = findBrowser();
  console.log("=== 牛马求生记 · E2E ===");
  if (!browserPath) {
    console.error("找不到 Chromium/Chrome。请设置 CHROME_PATH 或安装 Playwright 的 Chromium 缓存。");
    process.exit(1);
  }
  console.log("浏览器:", browserPath);

  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "niuma-e2e-"));
  // 注意：chrome-headless-shell 加 --headless=new 会让渲染进程崩溃；
  // 且必须带 --no-sandbox --disable-dev-shm-usage，否则 macOS 上 attach 后立即 targetCrashed
  const child = spawn(browserPath, [
    "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars",
    "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", "--user-data-dir=" + profile, "about:blank"
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error("等待 DevTools 端口超时")), 30000);
    const onData = (d) => {
      buf += d.toString();
      const m = buf.match(/ws:\/\/[^\s]+/);
      if (m) { clearTimeout(timer); resolve(m[0]); }
    };
    child.stderr.on("data", onData);
    child.stdout.on("data", onData);
    child.on("exit", () => reject(new Error("浏览器提前退出")));
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
  const cdp = new CDP(ws);
  const pageErrors = [];
  cdp.on((msg) => {
    if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails || {};
      pageErrors.push((d.exception && d.exception.description) || d.text || "unknown");
    }
  });

  let sessionId = null;
  const ev = (expr, opts = {}) => cdp.send("Runtime.evaluate", Object.assign({
    expression: expr, awaitPromise: true, returnByValue: true, userGesture: true
  }, opts), sessionId);

  const evalJson = async (expr) => {
    const r = await ev(expr);
    if (r.exceptionDetails) throw new Error("页面异常: " + JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    return r.result.value;
  };

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    ({ sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }));
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Page.navigate", { url: base + "/index.html" }, sessionId);
    await new Promise(r => setTimeout(r, 900));
    await evalJson(PAGE_HELPERS);

    // ---------- A. 加载与静态资源 ----------
    console.log("\n[A] 页面加载");
    const boot = await evalJson(`(() => ({
      title: document.title,
      lang: document.documentElement.lang,
      noscript: !!document.querySelector('noscript'),
      version: (document.querySelector('link[href*="v="]') || {}).href,
      hasApp: !!window.App, hasEngine: !!window.Engine, hasUI: !!window.UI,
      screens: ['screen-title','screen-create','screen-main','screen-review','screen-ending'].every(id => !!document.getElementById(id)),
      eventCount: (window.EV_GENERAL||[]).length + (window.EV_LINE_A||[]).length + (window.EV_LINE_B||[]).length + (window.EV_LINE_C||[]).length + (window.EV_BOSSES||[]).length
    }))()`);
    check("标题正确", boot.title.includes("牛马求生记"), boot.title);
    check("lang=zh-CN", boot.lang === "zh-CN", boot.lang);
    check("有 noscript 兜底", boot.noscript === true);
    check("资源带版本号", /v=\d+\.\d+/.test(boot.version || ""), boot.version);
    check("App/Engine/UI 均已挂载", boot.hasApp && boot.hasEngine && boot.hasUI);
    check("五个屏幕齐备", boot.screens === true);
    check("事件总数 = 91", boot.eventCount === 91, String(boot.eventCount));

    // ---------- B. 存档与结局快照的防御 ----------
    console.log("\n[B] 存档防御（篡改 / 脏数据）");
    const defense = await evalJson(`(() => {
      const out = {};
      localStorage.clear();
      window.App.newGame({ job: 'staff', persona: 'huang', dept: 'tech', name: 't', no: 'JJ1' });
      const st = JSON.parse(JSON.stringify(window.App.state())); st.done = false;
      // 篡改结局快照（尝试注入 HTML）
      localStorage.setItem('niuma_last_ending_v1', JSON.stringify({
        st: st, ending: { id: 'normal', name: '<img src=x onerror=window.__xss=1>', text: 'x', emoji: 'x', grade: 'B' }
      }));
      out.tamperedRejected = window.GameState.loadLastEnding() === null;
      out.noXss = !window.__xss;
      // 脏 journal：不应抛异常
      const bad = JSON.parse(JSON.stringify(st));
      bad.journal = [{}, null, { day: 'x' }, 'str'];
      localStorage.setItem('niuma_week_save_v1', JSON.stringify(bad));
      let crashed = null;
      try { window.GameState.load(); window.UI.showReview(window.App.state()); } catch (e) { crashed = e.message; }
      out.dirtyOk = crashed === null;
      out.dirtyCrash = crashed;
      out.journalCleaned = (window.App.state().journal || []).every(j => j && typeof j === 'object');
      return out;
    })()`);
    check("篡改的结局快照被拒绝", defense.tamperedRejected === true);
    check("篡改未造成注入", defense.noXss === true);
    check("脏 journal 不再崩溃", defense.dirtyOk === true, defense.dirtyCrash || "");
    check("脏 journal 被规范化", defense.journalCleaned === true);

    // 结局页内部契约：入参不完整时必须抛出可读错误（交给全局错误边界），而不是中途 TypeError
    const guard = await evalJson(`(() => {
      const st = window.App.state();
      const catchErr = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };
      return {
        empty: catchErr(() => window.UI.showEnding(st, {})),
        nul: catchErr(() => window.UI.showEnding(st, null)),
        noText: catchErr(() => window.UI.showEnding(st, { id: 'x', name: '有名字', emoji: '🙂', grade: 'B' })),
        okEnding: catchErr(() => window.UI.showEnding(st, {
          id: 'normal', name: '冒烟结局', text: '第一行\\n第二行', emoji: '🙂', grade: 'B',
          gradeLabel: '3.5', perf: '3.5', numeric: true, bossWord: '很好', luck: null
        }))
      };
    })()`);
    check("showEnding 拒绝空结局对象", /结局数据不完整/.test(guard.empty || ""), guard.empty || "(未抛错)");
    check("showEnding 拒绝 null", /结局数据不完整/.test(guard.nul || ""), guard.nul || "(未抛错)");
    check("showEnding 拒绝缺少 text 的结局", /缺少 text/.test(guard.noText || ""), guard.noText || "(未抛错)");
    check("showEnding 接受完整结局", guard.okEnding === null, guard.okEnding || "");

    // ---------- B2. 真实入口与刷新恢复 ----------
    console.log("\n[B2] 回看 / 刷新 / 老板底牌回归");
    const readonly = await evalJson(`(() => {
      localStorage.clear();
      window.App.newGame({ job:'staff', persona:'huang', name:'旧角色', no:'OLD1' });
      document.querySelector('#overlay').click();
      window.App.useItem('resign');
      const old = window.GameState.loadLastEnding();
      window.App.newGame({ job:'staff', persona:'zhen', name:'新角色', no:'NEW1' });
      document.querySelector('#overlay').click();
      const active = window.App.state();
      const saved = localStorage.getItem(window.GameState.SAVE_KEY);
      window.UI.showScreen('screen-title'); window.UI.refreshTitle();
      document.querySelector('#btn-last-ending').click();
      const out = {
        showsOld: document.querySelector('.end-id').textContent.includes('旧角色'),
        memoryKept: window.App.state() === active,
        storageKept: localStorage.getItem(window.GameState.SAVE_KEY) === saved
      };
      document.querySelector('#btn-review').click();
      out.oldReview = document.querySelector('.rv-sub').textContent.includes('旧角色');
      document.querySelector('#rv-back').click();
      document.querySelector('#btn-again').click();
      out.againKept = localStorage.getItem(window.GameState.SAVE_KEY) === saved;
      out.title = !document.querySelector('#screen-title').classList.contains('hidden');
      document.querySelector('#btn-continue').click();
      out.continuesNew = window.App.state().char.name === '新角色' &&
        window.App.state().turn.eventId === active.turn.eventId;
      return out;
    })()`);
    check("回看显示旧角色，保留本周内存和存档", readonly.showsOld && readonly.memoryKept && readonly.storageKept);
    check("回看周报仍使用旧角色快照", readonly.oldReview);
    check("回看页再打一周回标题，原存档仍可续玩", readonly.againKept && readonly.title && readonly.continuesNew);

    const lethal = await evalJson(`(() => {
      localStorage.clear();
      window.App.newGame({ job:'staff', persona:'huang', name:'致命回合', no:'END1' });
      document.querySelector('#overlay').click();
      window.App.state().stats.mood = 1;
      document.querySelector('#choices .choice').click();
      const rec = window.GameState.loadLastEnding();
      return {
        replyVisible: !document.querySelector('#overlay').classList.contains('hidden'),
        snapshot: !!rec && rec.st.done && rec.ending.id === 'exhausted',
        finalAchievements: !!rec && rec.st.achievements.includes('resignkeep'),
        noFalseFull: !!rec && !rec.st.achievements.includes('full'),
        errors: window.__appErrors.length
      };
    })()`);
    check("致命回复未关闭已保存本局完整结局", lethal.replyVisible && lethal.snapshot && lethal.finalAchievements);
    check("心态归零的结局不会保留全勤成就", lethal.noFalseFull);
    check("刷新前流程无被捕获异常", lethal.errors === 0);
    await cdp.send("Page.reload", { ignoreCache: true }, sessionId);
    await new Promise(r => setTimeout(r, 900));
    await evalJson(PAGE_HELPERS);
    const restoredEnd = await evalJson(`(() => {
      document.querySelector('#btn-last-ending').click();
      return !document.querySelector('#screen-ending').classList.contains('hidden') &&
        document.querySelector('.end-id').textContent.includes('致命回合') &&
        window.GameState.loadLastEnding().ending.id === 'exhausted';
    })()`);
    check("致命回复期间真实刷新后仍能回看本局结局", restoredEnd);

    const fillerSnapshot = await evalJson(`(() => {
      localStorage.clear();
      window.GameState.fresh({job:'staff',persona:'huang',name:'微事件',no:'FILL1'});
      const st = window.GameState.data, ev = window.EV_FILLER[0];
      st.day=2; st.slotIdx=3; st.usedEvents=[ev.id]; st.usedToday=[ev.id];
      st.counters['rep_'+ev.id]=1;
      st.turn={eventId:ev.id,round:0,pendingFollowup:null}; window.GameState.save();
      window.UI.showScreen('screen-main'); window.UI.renderEvent(st,ev,window.Engine.visibleChoices(st,ev));
      return {id:ev.id,title:window.Engine.eventTitle(st,ev),save:localStorage.getItem(window.GameState.SAVE_KEY)};
    })()`);
    await cdp.send("Page.reload", { ignoreCache: true }, sessionId);
    await new Promise(r => setTimeout(r, 900));
    await evalJson(PAGE_HELPERS);
    const restoredFiller = await evalJson(`(() => {
      document.querySelector('#btn-continue').click();
      const st=window.App.state();
      const out={id:st.turn.eventId,title:document.querySelector('.event-title').textContent,
        save:localStorage.getItem(window.GameState.SAVE_KEY)};
      document.querySelector('#choices .choice').click();
      out.resolved=st.slotIdx===4 && st.journal.length===1 && st.journal[0].evId===out.id;
      return out;
    })()`);
    check("微事件真实刷新后恢复原题，计数和存档不变", restoredFiller.id === fillerSnapshot.id &&
      restoredFiller.title === fillerSnapshot.title && restoredFiller.save === fillerSnapshot.save);
    check("恢复的微事件可正常作答且只结算一次", restoredFiller.resolved);

    const interceptClick = await evalJson(`(() => {
      localStorage.clear();
      window.GameState.fresh({job:'mid',persona:'shetou',name:'拦截来源',no:'SKILL1'});
      const st=window.GameState.data;
      st.day=3; st.slotIdx=1;
      st.turn={eventId:'ev_mid_chain_promise',round:0,pendingFollowup:null}; window.GameState.save();
      window.UI.showScreen('screen-title'); window.UI.refreshTitle();
      document.querySelector('#btn-continue').click();
      const bond=window.App.state().stats.bond;
      document.querySelector('#side-toggle').click();
      document.querySelector('#overlay-card button[data-slot="job"]').click();
      document.querySelectorAll('#choices .choice')[1].click();
      const result=window.App.state();
      return result.pot===0 && result.stats.bond===bond-10 &&
        result.skillUses.job===0 && result.skillUses.persona===2;
    })()`);
    check("真实点击职级拦截：不加黑锅且不扣人设次数", interceptClick);

    const bossExit = await evalJson(`(() => {
      localStorage.clear();
      window.App.newGame({job:'boss',persona:'normal',name:'老板退出',no:'EXIT1'});
      document.querySelector('#overlay').click();
      document.querySelector('#side-toggle').click();
      const button=document.querySelector('#overlay-card button[data-item="exit"]');
      if (!button) return {clickable:false};
      button.click();
      document.querySelector('#dialog-confirm').click();
      const rec=window.GameState.loadLastEnding();
      return {clickable:true,ended:!document.querySelector('#screen-ending').classList.contains('hidden'),
        exit:!!rec && rec.ending.id==='resign' && rec.st.char.job==='boss'};
    })()`);
    check("老板退出协议可真实点击，并进入套现离场结局", bossExit.clickable && bossExit.ended && bossExit.exit);

    console.log("\n[B3] 成就阶段 / 技能道具流水 / 坏档恢复");
    const processAch = await evalJson(`(() => {
      localStorage.clear();
      window.GameState.fresh({job:'staff',persona:'cai',name:'瞬时成就',no:'ACH1'});
      const st=window.GameState.data; st.stats.kpi=89; st.counters.overtimeStreak=2;
      st.slotIdx=4; st.turn={eventId:'ev_evening_staff',round:0,pendingFollowup:null};
      window.GameState.save(); window.UI.showScreen('screen-title'); window.UI.refreshTitle();
      document.querySelector('#btn-continue').click();
      Array.from(document.querySelectorAll('#choices .choice'))
        .find(button => button.textContent.includes('加班把活干完')).click();
      const current=window.App.state();
      return current.achievements.includes('juan') && current.achievements.includes('p_cai') &&
        current.dayAchievements.includes('juan') && !current.achievements.includes('full');
    })()`);
    check("真实选择当场解锁过程成就，整周成就不提前发", processAch);

    const earlyEnd = await evalJson(`(() => {
      localStorage.clear();
      window.App.newGame({job:'staff',persona:'huang',name:'短局结算',no:'SHORT1'});
      document.querySelector('#overlay').click();
      const before=window.App.state().achievements.includes('full');
      document.querySelector('#side-toggle').click();
      document.querySelector('#overlay-card button[data-item="resign"]').click();
      document.querySelector('#dialog-confirm').click();
      const rec=window.GameState.loadLastEnding();
      return !before && rec.st.day===1 && rec.st.done && rec.st.achievements.includes('full');
    })()`);
    check("提前离职的短局在结算时也可获得达标成就", earlyEnd);

    const movement = await evalJson(`(() => {
      localStorage.clear();
      window.GameState.fresh({job:'boss',persona:'normal',name:'完整流水',no:'LOG1'});
      const st=window.GameState.data; st.stats.mood=60; st.stats.bond=60; st.minMood=60;
      st.items.push('coffee'); st.turn={eventId:'ev_fill_calm',round:0,pendingFollowup:null};
      window.GameState.save(); window.UI.showScreen('screen-title'); window.UI.refreshTitle();
      document.querySelector('#btn-continue').click();
      document.querySelector('#side-toggle').click();
      document.querySelector('#overlay-card button[data-slot="persona"]').click();
      document.querySelector('#side-toggle').click();
      document.querySelector('#overlay-card button[data-item="coffee"]').click();
      const current=window.App.state();
      const deltas=current.dayDelta.mood===25 && current.dayDelta.bond===8;
      document.querySelector('#side-toggle').click();
      document.querySelector('#overlay-card button[data-item="exit"]').click();
      document.querySelector('#dialog-confirm').click();
      document.querySelector('#btn-review').click();
      const moments=document.querySelector('#screen-review .rv-moments').textContent;
      const total=window.App.state().journal.length;
      document.querySelector('#rv-save').click();
      return {deltas,total,hasSkill:moments.includes('好好说话'),hasCoffee:moments.includes('浓缩咖啡'),
        image:document.querySelector('#review-canvas').toDataURL().startsWith('data:image/png')};
    })()`);
    check("技能道具实际增量进入日报，使用次数进入周报", movement.deltas && movement.total===3);
    check("技能道具参与名场面并可导出周报", movement.hasSkill && movement.hasCoffee && movement.image);

    const dirtyRecovery = await evalJson(`(() => {
      localStorage.clear();
      window.GameState.fresh({job:'staff',persona:'huang',name:'修复坏档',no:'SAFE1'});
      const st=window.GameState.data; st.day=3; st.slotIdx=2;
      st.items.push('removed_item'); st.scheduled=[null]; st.forced=[null];
      window.GameState.save(); window.UI.showScreen('screen-title'); window.UI.refreshTitle();
      document.querySelector('#btn-continue').click();
      const current=window.App.state();
      return current.day===3 && current.slotIdx===2 && current.scheduled.length===0 &&
        current.forced.length===0 && !current.items.includes('removed_item') &&
        document.querySelectorAll('#choices .choice').length>0;
    })()`);
    check("坏队列和未知道具可清理，浏览器正常续玩原进度", dirtyRecovery);

    const numericXss = await evalJson(`(() => {
      const st=window.App.state();
      st.pot='<img src=x data-review-xss onerror="window.__reviewXss=1">';
      const rejects=!window.GameState.valid(st);
      window.UI.renderSidebar(st);
      const safe=!document.querySelector('[data-review-xss]') && !window.__reviewXss;
      st.pot=0; window.UI.renderSidebar(st);
      return rejects && safe;
    })()`);
    check("非法计数器被拒绝，渲染层也转义 HTML", numericXss);

    // ---------- C/D. 三条线各打一周 ----------
    console.log("\n[C/D] 三条线完整一周（含老板线视角）");
    // 一对一映射：打工人口吻标题 vs 老板视角标题（共 21 组变体里挑可稳定覆盖的）
    const POV_PAIRS = [
      ["【警报】老板走过来了", "【警报】贾总走过来了"],
      ["【后账】你答应过的那份东西", "【后账】你画的那个饼，到期了"],
      ["【记仇】贾总的微笑", "【记仇】陈老的微笑"],
      ["【通勤】电梯惊魂", "【通勤】清晨七点四十的电梯"],
      ["【紧急】@所有人", "【紧急】@所有人（这次是董事会）"],
      ["【深夜】朋友圈玄学", "【深夜】员工的加班照，@ 了你"],
      ["【门禁】工牌呢？", "【门禁】新保安不认识你"],
      ["【晨会】轮流汇报", "【晨会】你听别人轮流汇报"],
      ["【邮件】抄送地狱", "【邮件】抄送地狱（你在最上面）"],
      ["【午休】带薪如厕", "【午休】难得的半小时"],
      ["【午休】裁员帖", "【午休】你刷到了自己的行业新闻"],
      ["【工位】空调之争", "【办公室】26 度和 22 度的战争"],
      ["【设备】打印机卡纸", "【设备】打印机又卡了"],
      ["【下班】「在吗」三连", "【下班】投资人的「在吗」三连"],
      ["【孤立】透明人", "【孤立】没有人叫你开会"],
      ["【名场面】同事救场", "【名场面】有人替你说话"],
      ["【事故】记录消失了", "【事故】下属撤回了消息"],
      ["【约谈】背锅侠实锤", "【约谈】董事会要一个负责人"]
    ];
    const STAFF_POV = POV_PAIRS.map(p => p[0]);
    const BOSS_POV = POV_PAIRS.map(p => p[1]);
    for (const [job, persona] of [["staff", "huang"], ["mid", "baoyu"], ["boss", "normal"]]) {
      await cdp.send("Page.navigate", { url: base + "/index.html" }, sessionId);
      await new Promise(r => setTimeout(r, 700));
      await evalJson(PAGE_HELPERS);
      const r = await evalJson(`window.__e2e.playWeek(${JSON.stringify(job)}, ${JSON.stringify(persona)})`);
      const label = `${job}/${persona}`;
      check(`${label} 能打完一周并进入结局`, r.ended === true, `steps=${r.steps}`);
      check(`${label} 结局页有标题与正文`, !!r.endingName && r.endingText.length > 10, r.endingName || "");
      if (job === "boss") {
        check("老板线印章是形容词（无字母评级）", !!r.seal && /[好挺]/.test(r.seal) && !/^[SABCD]/.test(r.seal), r.seal || "");
        const titles = r.journal.map(j => j.title);
        check("老板线出现老板视角标题", titles.some(t => BOSS_POV.includes(t)), titles.filter(t => BOSS_POV.includes(t)).join("、"));
        const staffLeak = titles.filter(t => STAFF_POV.includes(t));
        check("老板线不再出现打工人口吻标题", staffLeak.length === 0, staffLeak.join("、"));
        check("老板线成就含「饼王之王」（job 门禁生效）", r.achVisible.indexOf("boss_pie") >= 0);
        check("老板线不含一线专属成就", r.achVisible.indexOf("lucky") < 0);
      }
      if (job === "staff") {
        check("一线印章是字母评级", !!r.seal && /^[SABCD]/.test(r.seal), r.seal || "");
        check("一线不显示「饼王之王」（job 门禁生效）", r.achVisible.indexOf("boss_pie") < 0);
        // 可见性规则：本命 1 + 签名 1 + 通用里未被 job/persona 门禁挡住的
        check("一线可见本命专属成就", r.achVisible.indexOf("p_huang") >= 0, r.achVisible.join(","));
        check("一线可见自己的签名成就", r.achVisible.indexOf("sig_huang") >= 0);
        check("一线看不到仅老板可解锁的「饼王之王」", r.achVisible.indexOf("boss_pie") < 0);
        check("一线看不到仅金汤匙可解锁的「关系户的含金量」", r.achVisible.indexOf("lucky") < 0);
        check("一线可见成就数 ≥14", r.achVisible.length >= 14, String(r.achVisible.length));
      }
      // 周报
      const opened = await evalJson("window.__e2e.openReview()");
      await new Promise(r2 => setTimeout(r2, 400));
      const rev = await evalJson("window.__e2e.reviewInfo()");
      check(`${label} 周报可打开并有名场面`, opened === true && rev.moments > 0 && rev.moments <= 4, `moments=${rev.moments}`);
      check(`${label} 周报折叠区 ≤6 条`, rev.foldItems <= 6, `fold=${rev.foldItems}`);
      check(`${label} 周报正文无半角标点`, rev.halfPunct === false);
      check(`${label} 周报可导出图片按钮存在`, rev.hasReviewBtn === true);
      if (job === "boss") check("老板线周报提示语为董事会口径", rev.tips.includes("董事会"), (rev.tips || "").slice(0, 30));
      if (job === "staff") check("一线周报提示语仍为贾总口径", rev.tips.includes("贾总"), (rev.tips || "").slice(0, 30));
    }

    // ---------- E. 引擎一致性（纯逻辑断言） ----------
    console.log("\n[E] 引擎与数据一致性");
    const engine = await evalJson(`(() => {
      const ach = window.ACHIEVEMENTS;
      const badTest = ach.filter(a => !/^(flag |ending )?[A-Za-z_]+(>=|<=|>|<)\\d+(\\.\\d+)?$|^flag \\w+$|^ending \\w+$/.test(a.test));
      const dupIds = ach.map(a => a.id).filter((x, i) => ach.map(a => a.id).indexOf(x) !== i);
      const evs = [].concat(window.EV_GENERAL, window.EV_LINE_A, window.EV_LINE_B, window.EV_LINE_C, window.EV_BOSSES);
      const ids = evs.map(e => e.id);
      return {
        achCount: ach.length,
        badTest: badTest.map(a => a.id + ':' + a.test),
        dupAch: dupIds,
        evDup: ids.filter((x, i) => ids.indexOf(x) !== i),
        wage: window.Engine.WAGE_YUAN,
        fillers: window.EV_FILLER || [],
        topbarSafe: (() => { try { window.UI.updateTopbar(null); return true; } catch (e) { return e.message; } })(),
        itemByLine: (() => {
          const ALLJ = ["staff", "mid", "boss"];
          const out = {};
          ALLJ.forEach(j => { out[j] = [(window.CHARACTERS.jobs[j] || {}).startItem || "resign"]; });
          evs.forEach(e => {
            const pool = e.pool;
            const jobs = (e.cond && e.cond.job) ? [e.cond.job] : (pool === "general" ? ALLJ : [pool]);
            const scan = (chs, js) => (chs || []).forEach(c => { if (c.item) js.forEach(j => { if (out[j] && out[j].indexOf(c.item) < 0) out[j].push(c.item); }); });
            scan(e.choices, jobs);
            if (e.variants) Object.keys(e.variants).forEach(jb => scan(e.variants[jb].choices, [jb]));
          });
          return out;
        })(),
        // 老板变体不变量：通用池事件的老板变体必须与主线选项数一致（平衡对齐），且标题已改写
        varMismatch: evs.filter(e => e.pool === "general" && e.variants && e.variants.boss
          && e.variants.boss.choices.length !== e.choices.length).map(e => e.id),
        // 放宽到全部带 boss 变体的事件（原先只查 general 池，老板池/每日 Boss 漏检）
        varSameTitle: evs.filter(e => e.variants && e.variants.boss
          && (!e.variants.boss.title || e.variants.boss.title === e.title)).map(e => e.id),
        varCount: evs.filter(e => e.variants && e.variants.boss).length,
        bossBands: window.Engine.BOSS_BANDS,
        midLuck: window.Engine.MID_LUCK
      };
    })()`);
    check("成就 test 语法全部合法", engine.badTest.length === 0, engine.badTest.join("、"));
    check("成就 id 无重复", engine.dupAch.length === 0, engine.dupAch.join("、"));
    check("事件 id 无重复", engine.evDup.length === 0, engine.evDup.join("、"));
    check("money 锚点 = 16800 元/月薪", engine.wage === 16800, String(engine.wage));
    // 兜底微事件池（v3.6）：必须有料、且结构简单
    check("填充池存在且 ≥6 条", (engine.fillers || []).length >= 6, String((engine.fillers || []).length));
    check("填充池每条都有 ≥2 选项", (engine.fillers || []).every(f => (f.choices || []).length >= 2));
    check("填充池每条都声明 repeat", (engine.fillers || []).every(f => f.repeat >= 1));
    check("填充池 id 前缀规范", (engine.fillers || []).every(f => String(f.id).indexOf("ev_fill_") === 0));
    // 道具可达性：recorder 是 needItem 门槛用到的道具，三条线都必须能拿到
    check("三条线都能获得录音笔（无死选项）",
      ["staff", "mid", "boss"].every(j => (engine.itemByLine[j] || []).indexOf("recorder") >= 0),
      JSON.stringify(engine.itemByLine));
    check("每条线至少能拿到 4 种道具",
      ["staff", "mid", "boss"].every(j => (engine.itemByLine[j] || []).length >= 4), JSON.stringify(engine.itemByLine));
    // updateTopbar 空状态防御（P3）：在页面内调用，结果由上面的 evalJson 带回
    check("UI.updateTopbar(null) 不抛错", engine.topbarSafe === true, String(engine.topbarSafe));
    check("老板变体选项数与主线一致（平衡对齐）", engine.varMismatch.length === 0, engine.varMismatch.join("、"));
    check("通用池事件都有老板变体（≥21）", engine.varCount >= 21, String(engine.varCount));
    // 王阿姨与画饼反噬的标题不带身份口吻；反噬的老板版按确认方案保留原题。
    const neutralTitles = new Set(["ev_wang", "ev_chain_pie_backlash"]);
    const badBossTitles = engine.varSameTitle.filter(id => !neutralTitles.has(id));
    check("老板变体标题符合身份，中性标题可共用", badBossTitles.length === 0,
      badBossTitles.join("、") || "（王阿姨、画饼反噬保留中性标题）");

    // ---------- G. 样式层截图对比（视觉回归） ----------
    console.log("\n[G] 样式层截图对比");
    await cdp.send("Emulation.setDeviceMetricsOverride",
      { width: 430, height: 932, deviceScaleFactor: 2, mobile: true }, sessionId);
    const BASELINE_DIR = path.join(__dirname, "baseline");
    const updateBaseline = process.argv.includes("--update-baseline");

    const SETUPS = [
      ["01-title", `window.__e2e.seed("localStorage.clear(); window.GameState.clear(); window.UI.showScreen('screen-title'); window.UI.refreshTitle();")`],
      ["02-create", `window.__e2e.seed("localStorage.clear(); window.GameState.clear(); document.getElementById('btn-new').click();")`],
      ["03-main-event", `window.__e2e.seed("localStorage.clear(); window.App.newGame({job:'staff',persona:'huang',dept:'tech',name:'E2E',no:'JJ1'}); var ov=document.querySelector('#overlay'); if(ov) ov.click(); var st=window.App.state(); var ev=window.Engine.byId('ev_gen_late'); window.UI.showScreen('screen-main'); window.UI.renderEvent(st, ev, window.Engine.visibleChoices(st, ev));")`],
      ["04-ending", `window.__e2e.seed("var st=window.App.state(); st.done=true; var e=window.Engine.applyPersonaEnding(st,{id:'normal',name:'平平无奇打工周',text:'第一行：这一周结束了。\\\\n第二行：你活着走出来了。\\\\n第三行：下周继续。',emoji:'🙂',grade:'B',gradeLabel:'3.5',perf:'3.5',numeric:true,bossWord:'很好',bossNote:'董事会：方向是对的。',bossSpin:'对外口径：稳中有进。',luck:null}); window.UI.showEnding(st, e);")`],
      ["05-review", `window.__e2e.seed("var st=window.App.state(); st.journal=[{day:1,slot:0,evId:'ev_gen_late',title:'【通勤】电梯惊魂',text:'低头看手机，装作没看见',delta:{mood:-2,fish:3},cdelta:{pot:0},isDui:false,judged:true,round:0,flags:[],counters:[],npc:[]},{day:1,slot:3,evId:'ev_gen_at_all',title:'【紧急】@所有人',text:'秒回「收到」',delta:{mood:-8,trust:5},cdelta:{pot:0},isDui:false,judged:true,round:1,flags:['standFirm'],counters:[],npc:[]},{day:2,slot:2,evId:'ev_gen_toilet',title:'【午休】带薪如厕',text:'标准 15 分钟套餐',delta:{fish:10,mood:6},cdelta:{pot:0},isDui:false,judged:true,round:0,flags:[],counters:['fishToilet'],npc:[]},{day:3,slot:4,evId:'ev_mid_blame_pingpong',title:'【甩锅】乒乓球',text:'当场拉群对质，甩出时间线',delta:{mood:8,trust:4},cdelta:{pot:1},isDui:true,judged:true,round:0,flags:[],counters:[],npc:[]},{day:4,slot:1,evId:'ev_wang',title:'【扫地僧】王阿姨',text:'聊两句心里话',delta:{mood:8},cdelta:{pot:0},isDui:false,judged:true,round:0,flags:[],counters:['wangTalks'],npc:[]},{day:5,slot:3,evId:'ev_evening_staff',title:'【晚间】走，还是留？',text:'留下把活干完',delta:{kpi:5,mood:-6},cdelta:{pot:0},isDui:false,judged:true,round:0,flags:[],overtime:true,counters:[],npc:[]}]; window.UI.showReview(st);")`]
    ];

    if (!fs.existsSync(BASELINE_DIR)) fs.mkdirSync(BASELINE_DIR, { recursive: true });
    for (const [name, setup] of SETUPS) {
      await evalJson(setup);
      await evalJson("window.__e2e.freeze()");
      await new Promise(r => setTimeout(r, 150));
      const shot = (await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId)).data;
      if (process.argv.includes("--dump-visual")) fs.writeFileSync(path.join(os.tmpdir(), "vis-" + name + ".png"), Buffer.from(shot, "base64"));
      const file = path.join(BASELINE_DIR, name + ".png");
      if (updateBaseline || !fs.existsSync(file)) {
        fs.writeFileSync(file, Buffer.from(shot, "base64"));
        check(`[视觉] ${name} 基线已生成`, true, "tools/baseline/" + name + ".png");
        continue;
      }
      const base = fs.readFileSync(file).toString("base64");
      const d = await evalJson("window.__e2e.diffPng(" + JSON.stringify(base) + "," + JSON.stringify(shot) + ")");
      // 阈值 0.05%：相同环境重复运行实测 0.00%（完全确定性），
      // 而「单个 CSS 变量微调」这类小面积改动会产生 0.38% 左右差异 —— 阈值必须低于它才抓得住。
      check(`[视觉] ${name} 与基线一致`, d.ratio < 0.0005, `${(d.ratio * 100).toFixed(3)}% 像素差异（阈值 0.05%，${d.size || ""}）`);
    }
    // 视觉检查结束后恢复默认视口，避免影响后续断言
    await cdp.send("Emulation.clearDeviceMetricsOverride", {}, sessionId);

    // ---------- H. 本轮修复的回归护栏 ----------
    console.log("\n[H] 修复护栏（移动端布局 / 可读性 / 老板口径）");
    const fixGuard = await evalJson(`(function(){
      localStorage.clear(); window.GameState.clear();
      window.App.newGame({job:'boss', persona:'feiren', dept:'finance', name:'护栏', no:'JJ9'});
      var ov = document.querySelector('#overlay:not(.hidden)'); if (ov) ov.click();
      var st = window.App.state();
      var ev = window.Engine.byId('ev_boss_wed');
      window.UI.showScreen('screen-main');
      window.UI.renderEvent(st, ev, window.Engine.visibleChoices(st, ev));
      var cardEl = document.querySelector('#event-card');
      var card = cardEl.getBoundingClientRect();
      var dock = document.querySelector('#action-dock').getBoundingClientRect();
      var narr = document.querySelector('.chatline.sys');
      var ncs = narr ? getComputedStyle(narr) : null;
      var lum = function(c){ var m=(c||'').match(/(\\d+),\\s*(\\d+),\\s*(\\d+)/); if(!m) return 0;
        var v=[+m[1],+m[2],+m[3]].map(function(x){x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);});
        return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2]; };
      var bgOf = function(el){ var n=el; while(n){ var c=getComputedStyle(n).backgroundColor; if(c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent') return c; n=n.parentElement; } return 'rgb(16,17,22)'; };
      var r1 = lum(ncs?ncs.color:'') , r2 = lum(bgOf(narr||cardEl));
      var contrast = ((Math.max(r1,r2)+0.05)/(Math.min(r1,r2)+0.05));
      var a0 = JSON.parse(JSON.stringify(st)), a1 = JSON.parse(JSON.stringify(st));
      a0.stats.fish = 0; a1.stats.fish = 100;   // perfScore 只读 stats/pot/flags/counters
      var money = (document.querySelector('.statval.money')||{}).textContent || '';
      return {
        occlude: Math.max(0, Math.round(card.bottom - dock.top)),
        cardScrollable: getComputedStyle(cardEl).overflowY === 'auto',
        pageScroll: document.documentElement.scrollHeight > innerHeight + 1,
        narrSize: ncs ? parseFloat(ncs.fontSize) : 0,
        narrContrast: Math.round(contrast * 100) / 100,
        weekProg: !!document.querySelector('.week-prog'),
        moneyText: money,
        bossItemExit: st.items.indexOf('exit') >= 0 && st.items.indexOf('resign') < 0,
        bossAchRenamed: (function(){
          var names = window.Engine.achievementsFor(st).map(function(a){ return a.name; });
          return names.indexOf('带薪消失冠军') >= 0 && names.indexOf('带薪拉屎冠军') < 0
              && names.indexOf('融资故事大王') >= 0 && names.indexOf('周报文学家') < 0;
        })(),
        fishNoPenalty: window.Engine.perfScore(a0) === window.Engine.perfScore(a1),
        bossTitles: ['ev_boss_mon','ev_boss_fri','ev_boss_sun'].every(function(id){
          var e = window.Engine.byId(id);
          return !!(e.variants && e.variants.boss && e.variants.boss.title);
        })
      };
    })()`);
    check("选项坞不遮挡故事卡（移动端最坏情况）", fixGuard.occlude === 0, "遮挡 " + fixGuard.occlude + "px");
    check("故事卡可内部滚动（长事件不挤掉选项）", fixGuard.cardScrollable === true);
    check("主屏不再整页滚动（dvh 外壳）", fixGuard.pageScroll === false);
    check("旁白字号 ≥ 13px", fixGuard.narrSize >= 13, fixGuard.narrSize + "px");
    check("旁白对比度 ≥ 4.5:1（AA）", fixGuard.narrContrast >= 4.5, fixGuard.narrContrast + ":1");
    check("本周进度条已渲染", fixGuard.weekProg === true);
    check("老板私房钱用「万」计价", /万/.test(fixGuard.moneyText), fixGuard.moneyText);
    check("老板起始道具是退出协议而非辞职信", fixGuard.bossItemExit === true);
    check("老板成就已换口径（带薪消失冠军 / 融资故事大王）", fixGuard.bossAchRenamed === true);
    check("老板档位不受「自由度」影响", fixGuard.fishNoPenalty === true);
    check("每日 Boss 的老板变体都有独立标题", fixGuard.bossTitles === true);

    // ---------- F. 无运行期错误 ----------
    console.log("\n[F] 运行期错误");
    // 自检：故意在事件监听器里抛错，确认页面内计数器真的能抓到（这是此前漏掉 deltaChips 卡死的盲区）
    const nBefore = await evalJson("(window.__e2eRuntime || []).length");
    await evalJson(`(function(){
      var el = document.createElement('button');
      el.addEventListener('click', function(){ throw new Error('probe-listener-error'); });
      document.body.appendChild(el); el.click(); el.remove();
      return true;
    })()`);
    await new Promise(r => setTimeout(r, 150));
    const nAfter = await evalJson("(window.__e2eRuntime || []).length");
    check("错误计数器能抓到事件监听器异常（盲区自检）", nAfter > nBefore, nBefore + " → " + nAfter);

    const cdpReal = pageErrors.filter((m) => String(m).indexOf("probe-listener-error") < 0);
    check("无未捕获异常（CDP）", cdpReal.length === 0, cdpReal.slice(0, 3).join(" | "));
    const realErrs = await evalJson("(window.__e2eRuntime || []).filter(function(m){ return String(m).indexOf('probe-listener-error') < 0; })");
    check("无未捕获异常（页面内计数器，含监听器）", realErrs.length === 0, realErrs.slice(0, 3).join(" | "));
    // 关键：guarded() 会 catch 掉 App 方法的异常，上面两条都看不见——必须查应用自己的错误账本
    const appErrs = await evalJson("(window.__appErrors || []).filter(function(e){ return String(e.message).indexOf('probe-listener-error') < 0; }).map(function(e){ return e.where + ': ' + e.message; })");
    check("应用错误账本为空（guarded 捕获的异常）", appErrs.length === 0, appErrs.slice(0, 3).join(" | "));

  } catch (e) {
    check("E2E 执行未中断", false, e.message);
  } finally {
    try { ws.close(); } catch (e) {}
    if (!process.argv.includes("--keep-open")) {
      child.kill("SIGKILL");
      server.close();
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
    }
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n=== 结果：${results.length - failed.length}/${results.length} 通过 ===`);
  if (failed.length) {
    console.log("失败清单：");
    failed.forEach(f => console.log(`  ❌ ${f.name}${f.detail ? "  —— " + f.detail : ""}`));
    process.exit(1);
  }
  console.log("✅ 全部通过");
})();
