/* 万物改造局 · 前端主逻辑。所有外部请求只发往本站 api/，不指定上游地址。 */
(function () {
  'use strict';

  // 默认用「页面所在目录 + api/」；CloudBase 部署时 meta 会注入网关域名（静态托管域名不走函数路由）。
  var API_BASE = (function () {
    var meta = document.querySelector('meta[name="upcycle-api-base"]');
    var configured = meta ? (meta.getAttribute('content') || '').trim() : '';
    if (configured) return configured.replace(/\/?$/, '/');
    var p = window.location.pathname;
    var dir = p.charAt(p.length - 1) === '/' ? p : p.slice(0, p.lastIndexOf('/') + 1);
    return dir + 'api/';
  })();

  var FAV_KEY = 'upcycle.favorites.v1';
  var Art = window.UpcycleArt;
  var Share = window.UpcycleShare;

  var state = {
    config: null, mode: 'demo', toolLabels: { hands: '徒手' }, toolList: [], samples: [], lanes: [],
    sampleId: null, image: null, item: '', material: '', description: '', tools: [], budget: 20,
    ideas: null, specs: [], plans: [], current: null, checked: {}, favorites: [],
    forbid: [], lastBase: null, lastConstraints: null, shareCanvas: null, busy: false,
    ocr: null, ocrBusy: false,
    moreToolsOpen: false, moreForbidOpen: false, correctionOpen: false
  };

  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = String(v);
      else if (k === 'html') e.innerHTML = String(v); // 仅用于本地静态 SVG 字符串
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, String(v));
    });
    var list = kids == null ? [] : (Array.isArray(kids) ? kids : [kids]);
    list.forEach(function (k) {
      if (k === null || k === undefined || k === false) return;
      e.appendChild(k && k.nodeType ? k : document.createTextNode(String(k)));
    });
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function show(node, on) { node.classList.toggle('hidden', !on); }
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function clampBudget(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return 20;
    return Math.min(9999, Math.max(0, Math.round(n)));
  }
  function laneLabel(id) {
    var l = state.lanes.find(function (x) { return x.id === id; });
    return l ? l.label : '改造方案';
  }
  function toneClass(lane) {
    return lane === 'aesthetic' ? 'tone-orange' : (lane === 'wild' ? 'tone-indigo' : 'tone-green');
  }
  function toolName(id) { return state.toolLabels[id] || id; }
  // 界面不出现 demo / llm / demo-rule 这类内部 id。
  function modeLabel(m) {
    return m === 'live' ? '模型模式' : (m === 'saved' ? '本地收藏' : '示例模式');
  }
  function sourceLabel(s) {
    if (s === 'llm') return '模型输出';
    if (s === 'saved') return '收藏快照';
    return '本地规则方案';
  }
  function schemeLabel() { return state.mode === 'demo' ? '示例方案' : '模型方案'; }
  // 物品 / 材质信息的真实来源：只有模型视觉返回才叫「识别结果」。
  function recognizedSourceLabel() {
    var rec = state.ideas && state.ideas.recognized;
    if (!rec) return '';
    if (rec.source === 'vision') return '（识别结果）';
    if (rec.source === 'ocr') return '（照片文字线索）';
    if (rec.source === 'sample') return '（示例信息）';
    if (rec.source === 'saved') return '（收藏快照）';
    return '（填写的信息）';
  }
  function correctionToggleText() {
    if (state.correctionOpen) return '收起物品 / 材质纠正';
    return '核对 / 纠正物品与材质' + recognizedSourceLabel();
  }
  function closeCorrection() {
    state.correctionOpen = false;
    show($('recognizedBox'), false);
    $('toggleCorrection').textContent = correctionToggleText();
  }

  // 真实模型方案生成需要 15–30 秒：客户端也要有上限，且计时器必须覆盖到响应体读完，
  // 否则网关挂住时按钮会一直转、页面看起来像死掉。
  function waitMs(kind) {
    var server = Number(state.config && state.config.timeoutMs) || 20000;
    if (kind === 'ocr') return 25000;
    return Math.min(90000, Math.max(15000, server + 10000));
  }
  function withTimeout(ms) {
    if (typeof AbortController !== 'function') {
      return { signal: null, aborted: function () { return false; }, done: function () {} };
    }
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    return {
      signal: ctrl.signal,
      aborted: function () { return ctrl.signal.aborted; },
      done: function () { clearTimeout(timer); }
    };
  }
  async function api(path, payload, kind) {
    var ms = waitMs(kind || 'ideas');
    var guard = withTimeout(ms);
    var timeoutErr = {
      code: 'client_timeout',
      error: '等待超过 ' + Math.round(ms / 1000) + ' 秒，服务端可能仍在处理；稍后可直接重试（输入已保留）'
    };
    try {
      var res;
      try {
        res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: guard.signal || undefined
        });
      } catch (err) {
        if (guard.aborted()) throw timeoutErr;
        throw { code: 'network', error: '连不上服务，请检查网络；本地预览需运行 npm start' };
      }
      var raw;
      try { raw = await res.text(); } catch (err) {
        if (guard.aborted()) throw timeoutErr;
        throw { code: 'bad_response', error: '服务响应读取中断（HTTP ' + res.status + '），可以重试' };
      }
      var data;
      try { data = JSON.parse(raw); } catch (err) {
        if (guard.aborted()) throw timeoutErr;
        throw { code: 'bad_response', error: '服务返回的不是合法 JSON（HTTP ' + res.status + '），可能是网关超时，稍后可重试' };
      }
      if (!res.ok || !data.ok) {
        var message = data.code === 'EXCEED_MAX_PAYLOAD_SIZE'
          ? '照片超过接口体积上限，被网关拒绝；请换一张更小的照片（上传时会自动压缩）。'
          : (data.error || ('请求失败 HTTP ' + res.status));
        throw { code: data.code || 'api_error', error: message, status: res.status };
      }
      return data;
    } finally {
      guard.done();
    }
  }

  // ---------- 初始化 ----------
  async function init() {
    bind();
    var cfg;
    var guard = withTimeout(12000);
    try {
      var res = await fetch(API_BASE + 'config', { signal: guard.signal || undefined });
      cfg = await res.json();
    } catch (err) {
      $('modeBadge').textContent = '服务未启动';
      $('homeError').textContent = guard.aborted()
        ? '读取配置超时，请稍后刷新；本地预览需运行 npm start。'
        : '读取配置失败，请检查网络；本地预览需运行 npm start。';
      return;
    } finally {
      guard.done();
    }
    state.config = cfg.config;
    state.mode = cfg.config.mode;
    state.toolList = cfg.tools || [];
    state.toolLabels = { hands: '徒手' };
    state.toolList.forEach(function (t) { state.toolLabels[t.id] = t.label; });
    state.samples = cfg.samples || [];
    state.lanes = cfg.lanes || [];
    state.tools = (cfg.defaultTools || []).slice();

    var badge = $('modeBadge');
    badge.className = 'mode-badge ' + state.mode;
    badge.textContent = state.mode === 'demo'
      ? '示例模式'
      : '已连接模型' + (state.config.vision ? ' · 视觉已启用' : ' · 未启用视觉');

    var ocrReady = !!(state.config.ocr && state.config.ocr.configured);
    var visionOn = state.mode === 'live' && !!state.config.vision;
    $('capNote').textContent = '文字识别：' + (ocrReady ? '已配置' : '未配置') +
      ' · 方案生成：' + (state.mode === 'live' ? '已连接模型（通常 15–30 秒）' : '本地规则') +
      (visionOn ? ' · 视觉已启用：照片会发给模型看图判断物品与材质' : '');
    $('ocrStatus').textContent = ocrHintText();

    renderSamples();
    renderToolChips();
    renderForbidChips();
    loadFavorites();
    renderFavorites();
  }

  function renderSamples() {
    var box = $('sampleChips');
    clear(box);
    state.samples.forEach(function (s) {
      var chip = h('button', {
        type: 'button',
        class: 'chip sample-chip' + (state.sampleId === s.id ? ' on' : ''),
        title: s.hint
      }, [
        h('span', { class: 'mini', html: Art.sampleArt(s.id) }),
        h('span', { text: s.name })
      ]);
      chip.addEventListener('click', function () {
        state.sampleId = state.sampleId === s.id ? null : s.id;
        if (state.sampleId) {
          state.image = null;
          state.ocr = null;
          show($('previewWrap'), false);
          show($('ocrPanel'), false);
          show($('dropZone'), true);
          $('itemInput').value = s.name;
          $('materialInput').value = s.material;
        }
        renderSamples();
        $('homeError').textContent = '';
      });
      box.appendChild(chip);
    });
  }

  // 常用工具直达；其余收进「更多工具（N）」。非常用但已选中的仍留在主区，选择不会因折叠丢失。
  function chipGroup(mainId, moreId, btnId, openKey, opts) {
    var main = $(mainId), more = $(moreId), btn = $(btnId);
    clear(main); clear(more);
    var hiddenCount = 0;
    state.toolList.forEach(function (t) {
      var on = opts.isOn(t.id);
      var direct = Boolean(t.common) || on;
      var chip = h('button', {
        type: 'button',
        class: 'chip' + opts.extraClass + (on ? ' on' : ''),
        text: opts.text(t)
      });
      chip.addEventListener('click', function () { opts.onToggle(t.id); });
      (direct ? main : more).appendChild(chip);
      if (!direct) hiddenCount++;
    });
    show(more, state[openKey]);
    show(btn, hiddenCount > 0);
    if (hiddenCount > 0) {
      btn.textContent = (state[openKey] ? '收起更多工具' : '更多工具') + '（' + hiddenCount + '）';
    }
    btn.onclick = function () {
      state[openKey] = !state[openKey];
      renderToolChips();
      renderForbidChips();
    };
  }

  function renderToolChips() {
    chipGroup('toolChips', 'toolMore', 'moreToolsBtn', 'moreToolsOpen', {
      extraClass: '',
      isOn: function (id) { return state.tools.indexOf(id) >= 0; },
      text: function (t) { return t.label; },
      onToggle: function (id) {
        var i = state.tools.indexOf(id);
        if (i >= 0) state.tools.splice(i, 1); else state.tools.push(id);
        renderToolChips();
      }
    });
  }

  function renderForbidChips() {
    chipGroup('forbidChips', 'forbidMore', 'moreForbidBtn', 'moreForbidOpen', {
      extraClass: ' forbid',
      isOn: function (id) { return state.forbid.indexOf(id) >= 0; },
      text: function (t) { return '不用 ' + t.label; },
      onToggle: function (id) {
        var i = state.forbid.indexOf(id);
        if (i >= 0) state.forbid.splice(i, 1); else state.forbid.push(id);
        renderForbidChips();
      }
    });
  }

  // ---------- 上传 ----------
  function validMagic(bytes) {
    if (bytes.length < 12) return false;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
    return false;
  }
  function readAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  // CloudBase HTTP 网关对事件云函数的请求体实测约 100 KiB 上限：手机原图（2–5MB）
  // 直接发会被 413 EXCEED_MAX_PAYLOAD_SIZE 拒掉，视觉/OCR 都收不到图。
  // 所以上传后先在浏览器等比缩放 + 降质量，压到安全体积再发；原图不离开本机。
  var MAX_IMAGE_DATA_URL = 85000;
  function compressDataUrl(dataUrl, maxChars) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        try {
          var sizes = [1024, 768, 640, 512, 384];
          var qualities = [0.82, 0.72, 0.62, 0.52, 0.42];
          var canvas = document.createElement('canvas');
          var ctx = canvas.getContext('2d');
          for (var si = 0; si < sizes.length; si++) {
            var scale = Math.min(1, sizes[si] / Math.max(img.width, img.height));
            var w = Math.max(16, Math.round(img.width * scale));
            var hgt = Math.max(16, Math.round(img.height * scale));
            canvas.width = w; canvas.height = hgt;
            // 透明 PNG 转 JPEG 时先铺白底，避免出现黑块。
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, hgt);
            ctx.drawImage(img, 0, 0, w, hgt);
            for (var qi = 0; qi < qualities.length; qi++) {
              var out = canvas.toDataURL('image/jpeg', qualities[qi]);
              if (out.length <= maxChars) {
                resolve({
                  dataUrl: out, width: w, height: hgt, quality: qualities[qi],
                  bytes: Math.round((out.length - out.indexOf(',') - 1) * 0.75)
                });
                return;
              }
            }
          }
          reject(new Error('照片处理后仍超过接口体积上限，请换一张更小或更简单的照片'));
        } catch (e) { reject(e); }
      };
      img.onerror = function () { reject(new Error('照片解码失败')); };
      img.src = dataUrl;
    });
  }

  function ocrHintText() {
    var ready = !!(state.config && state.config.ocr && state.config.ocr.configured);
    if (!ready) return '服务端尚未配置文字识别凭据，点识别会明确报错；也可以直接手动填写物品。';
    return '点「识别文字」真实调用文字识别，只读包装或标签上的字；' +
      (state.mode === 'live' && state.config.vision
        ? '看图判断物品由模型在生成方案时完成。' : '它不等于看懂物品。');
  }

  async function handleFile(file) {
    var errEl = $('homeError');
    errEl.textContent = '';
    if (!file) return;
    var extOk = /\.(jpe?g|png|webp)$/i.test(file.name) || /^image\/(jpeg|png|webp)$/i.test(file.type || '');
    if (!extOk) { errEl.textContent = '只支持 JPEG / PNG / WebP 图片。'; return; }
    var max = state.config ? state.config.limits.maxImageBytes : 5 * 1024 * 1024;
    if (file.size > max) { errEl.textContent = '图片超过 5MB，请换一张小的。'; return; }
    try {
      var head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (!validMagic(head)) { errEl.textContent = '文件内容不是有效图片（文件头校验未通过）。'; return; }
      var original = await readAsDataUrl(file);
      var packed = await compressDataUrl(original, MAX_IMAGE_DATA_URL);
      var dataUrl = packed.dataUrl;
      state.image = dataUrl;
      state.sampleId = null;
      renderSamples();
      $('previewImg').src = dataUrl;
      $('previewImg').alt = '上传的闲置物照片预览：' + file.name;
      $('photoNote').textContent = '已在浏览器压缩到约 ' + Math.round(packed.bytes / 1024) + ' KB（' +
        packed.width + '×' + packed.height + '）再发送：网关对请求体约 100 KB 上限，原图不上传。' +
        '小字识别率会下降，物品拿不准可在上面手动填一句。';
      show($('previewWrap'), true);
      show($('dropZone'), false);
      state.ocr = null;
      show($('ocrPanel'), true);
      renderOcr();
      $('ocrStatus').textContent = ocrHintText();
      toast('照片已压好，可以识别包装文字，也可以直接生成方案');
    } catch (err) {
      errEl.textContent = '照片读取失败：' + (err && err.message ? err.message : '未知错误');
    }
  }

  // ---------- 照片文字识别（真实 OCR，只读文字，不冒充看图） ----------
  function renderOcr() {
    var panel = $('ocrPanel');
    var lines = $('ocrLines');
    var clue = $('ocrClue');
    clear(lines);
    clue.textContent = '';
    show(clue, false);
    show($('ocrApplyBtn'), false);
    panel.classList.remove('is-error');
    var ocr = state.ocr;
    if (!ocr) return;
    (ocr.lines || []).forEach(function (line) {
      lines.appendChild(h('span', { class: 'ocr-line' }, [
        document.createTextNode(line.text),
        h('small', { text: Math.round(line.confidence) + '%' })
      ]));
    });
    if (ocr.guess) {
      clue.textContent = '从文字里找到线索：可能是「' + ocr.guess.item + '」（材质 ' +
        ocr.guess.material + '），命中「' + ocr.guess.hit + '」。只是文字线索，请自行核对。';
      show(clue, true);
      show($('ocrApplyBtn'), true);
    }
  }

  async function runOcr() {
    if (state.ocrBusy) return;
    if (!state.image) {
      $('ocrStatus').textContent = '请先放一张照片再识别文字。';
      return;
    }
    state.ocrBusy = true;
    var btn = $('ocrBtn');
    btn.disabled = true;
    btn.textContent = '识别中…';
    $('ocrPanel').classList.remove('is-error');
    $('ocrStatus').textContent = '正在调用文字识别，照片只发到本站服务端…';
    try {
      var data = await api(API_BASE + 'ocr', { image: state.image }, 'ocr');
      state.ocr = data.ocr || null;
      renderOcr();
      $('ocrStatus').textContent = (data.ocr && data.ocr.notice) || '文字识别已调用。';
    } catch (err) {
      state.ocr = null;
      renderOcr();
      $('ocrPanel').classList.add('is-error');
      $('ocrStatus').textContent = (err.error || '文字识别失败') +
        (err.code === 'client_timeout' ? '' : '（照片已保留，可以重试）');
    } finally {
      state.ocrBusy = false;
      btn.disabled = false;
      btn.textContent = '识别文字';
    }
  }

  function applyOcrClue() {
    var clue = state.ocr && state.ocr.guess;
    if (!clue) return;
    $('itemInput').value = clue.item;
    $('materialInput').value = clue.material;
    toast('已填入文字线索，可以自己改');
  }

  // ---------- 生成三方案 ----------
  function baseFromForm() {
    return {
      item: $('itemInput').value.trim(),
      material: $('materialInput').value.trim(),
      description: $('descInput').value.trim(),
      tools: state.tools.slice(),
      budget: clampBudget($('budgetInput').value)
    };
  }

  async function generate() {
    if (state.busy) return;
    var errEl = $('homeError');
    errEl.textContent = '';
    var form = baseFromForm();
    var payload = {
      sampleId: state.sampleId,
      image: state.image,
      // 只回传已真实识别到的文字；服务端会自己重新推线索，不信任前端给的候选值。
      ocrText: state.ocr && state.ocr.joined ? state.ocr.joined : '',
      item: form.item, material: form.material, description: form.description,
      tools: form.tools, budget: form.budget, forbidden: [], extra: ''
    };
    if (!payload.sampleId && !payload.image && !payload.item) {
      errEl.textContent = '先放一张照片，或者选一个内置示例。';
      return;
    }
    var hasClue = !!(state.ocr && state.ocr.guess);
    if (state.mode === 'demo' && !payload.sampleId && !payload.item && !hasClue) {
      errEl.textContent = state.ocr && state.ocr.count
        ? '照片文字里没找到可用的物品线索，请在「这是什么」里手动填一句，再生成方案。'
        : '示例模式没有识图能力：请先识别照片上的文字（或手动填一句），再体验规则示例方案。';
      return;
    }
    state.item = payload.item; state.material = payload.material;
    state.description = payload.description; state.tools = form.tools; state.budget = form.budget;
    state.busy = true;
    var btn = $('generateBtn');
    var live = state.mode === 'live';
    var started = Date.now();
    var tick = null;
    btn.disabled = true;
    btn.textContent = live ? '模型生成中…（0 秒，通常 15–30 秒）' : '正在整理方案…';
    if (live) {
      tick = setInterval(function () {
        btn.textContent = '模型生成中…（' + Math.round((Date.now() - started) / 1000) + ' 秒，通常 15–30 秒）';
      }, 1000);
    }
    try {
      var data = await api(API_BASE + 'ideas', payload, 'ideas');
      onIdeas(data, payload);
    } catch (err) {
      errEl.textContent = (err.error || '请求失败') +
        (err.code === 'client_timeout' ? '' : '（输入已保留，可直接重试）');
    } finally {
      if (tick) clearInterval(tick);
      state.busy = false;
      btn.disabled = false; btn.textContent = '生成三种改造方案';
    }
  }

  function onIdeas(data, payload) {
    state.ideas = data;
    state.specs = data.specs || [];
    state.plans = (data.plans || []).concat(data.alternatives || []);
    state.lastBase = {
      sampleId: payload.sampleId, image: payload.image, ocrText: payload.ocrText,
      item: payload.item, material: payload.material, description: payload.description,
      tools: payload.tools.slice(), budget: payload.budget
    };
    state.lastConstraints = data.constraints;
    state.forbid = [];
    state.checked = {};
    $('refineBudget').value = data.constraints.budget;
    $('refineExtra').value = '';
    renderForbidChips();
    show($('refineResult'), false);
    show($('explainBox'), false);
    // 纠正表单默认收起，需要改的时候再展开。
    $('correctItem').value = (data.recognized && data.recognized.item) || state.item || '';
    $('correctMaterial').value = (data.recognized && data.recognized.material) || state.material || '';
    state.correctionOpen = false;
    show($('recognizedBox'), false);
    var toggle = $('toggleCorrection');
    toggle.textContent = correctionToggleText();
    show(toggle, true);
    renderResults();
    showView('results');
  }

  function showView(name) {
    ['Home', 'Results', 'Detail'].forEach(function (v) {
      show($('view' + v), v.toLowerCase() === name);
    });
    window.scrollTo(0, 0);
  }

  function renderResults() {
    var d = state.ideas;
    if (!d) return;
    var itemName = (d.recognized && d.recognized.item) || state.item || '闲置物';
    $('resultsTitle').textContent = '三种改法 · ' + itemName;
    // 结果页只在这里写一句模式说明；标题下的 meta 只放客观信息，不再重复三遍。
    var c = d.constraints || {};
    $('resultsMeta').textContent = '可行 ' + (d.plans || []).length + ' / 3 种 · 预算 ¥' + (c.budget || 0) +
      ' · 已有工具 ' + ((c.tools || []).length) + ' 件' +
      (d.visionUsed ? ' · 有图片输入' : '');
    var notice = $('noticeBox');
    notice.textContent = d.notice || '';
    notice.className = 'notice-box' + (state.mode === 'live' ? ' live' : '');

    var cards = $('cards');
    clear(cards);
    state.lanes.forEach(function (lane) {
      var plan = (d.plans || []).find(function (p) { return p.lane === lane.id; });
      var bad = (d.infeasible || []).find(function (p) { return p.lane === lane.id; });
      cards.appendChild(plan ? planCard(plan) : disabledCard(lane, bad));
    });

    var status = $('laneStatus');
    clear(status);
    (d.laneStatus || []).forEach(function (s) {
      status.appendChild(h('span', {
        class: 'lane-pill' + (s.feasible ? '' : ' no'),
        text: s.label + (s.feasible ? ' · ¥' + s.estimatedCost : ' · 不可行：' + s.reason)
      }));
    });
    if ((d.notes || []).length) {
      status.appendChild(h('span', { class: 'lane-pill', text: '约束生效：' + d.notes.slice(0, 2).join(' / ') }));
    }

    var alt = $('infeasibleBox');
    clear(alt);
    var hasBad = (d.infeasible || []).length > 0;
    var hasAlt = (d.alternatives || []).length > 0;
    show(alt, hasBad || hasAlt);
    if (hasBad) {
      alt.appendChild(h('h3', { text: '此限制下做不了的款式' }));
      alt.appendChild(h('p', { text: d.infeasible.map(function (x) { return x.title + '：' + x.reason; }).join('；') }));
    }
    if (hasAlt) {
      alt.appendChild(h('h3', { text: '可行的替代做法（不是原方案）' }));
      var list = h('div', { class: 'alt-list' });
      d.alternatives.forEach(function (p) {
        var b = h('button', { type: 'button', class: 'ghost-btn', text: p.title + ' · ¥' + p.estimatedCost });
        b.addEventListener('click', function () { openDetail(p); });
        list.appendChild(b);
      });
      alt.appendChild(list);
    }
  }

  function planCard(plan) {
    var card = h('div', { class: 'card ' + toneClass(plan.lane) });
    var starred = isFavorite(plan);
    var star = h('button', { type: 'button', class: 'star-btn' + (starred ? ' on' : ''), text: starred ? '★' : '☆', title: '收藏到本地' });
    star.addEventListener('click', function () { toggleFavorite(plan); renderResults(); });
    card.appendChild(h('div', { class: 'card-head' }, [
      h('span', { class: 'lane-tag', text: laneLabel(plan.lane) }), star
    ]));
    card.appendChild(h('h3', { text: plan.title }));
    card.appendChild(h('p', { class: 'result', text: '改造成：' + plan.result }));
    var holder = h('div', { class: 'diagram-holder' });
    holder.appendChild(Art.renderDiagram(plan.diagram, plan.lane));
    card.appendChild(holder);
    card.appendChild(h('p', { class: 'summary', text: plan.summary }));
    card.appendChild(h('div', { class: 'stat-row' }, [
      stat('¥' + plan.estimatedCost, '费用估计'),
      stat(plan.timeMinutes + ' 分钟', '预计用时'),
      stat(plan.difficulty, '难度')
    ]));
    var actions = h('div', { class: 'card-actions' });
    var go = h('button', { type: 'button', class: 'primary-btn', text: '做这个 →' });
    go.addEventListener('click', function () { openDetail(plan); });
    actions.appendChild(go);
    var md = h('button', { type: 'button', class: 'ghost-btn', text: '清单' });
    md.addEventListener('click', function () { openDetail(plan); downloadMd(); });
    actions.appendChild(md);
    card.appendChild(actions);
    return card;
  }

  function stat(value, label) {
    return h('div', { class: 'stat' }, [h('b', { text: value }), h('span', { text: label })]);
  }

  function disabledCard(lane, bad) {
    var card = h('div', { class: 'card disabled' });
    card.appendChild(h('div', { class: 'card-head' }, [h('span', { class: 'lane-tag', text: lane.label })]));
    card.appendChild(h('h3', { text: lane.label + '暂不可行' }));
    card.appendChild(h('p', { class: 'summary', text: bad ? bad.reason : '当前预算与工具条件下没有可行做法' }));
    card.appendChild(h('div', { class: 'card-actions' }, [
      h('button', { type: 'button', class: 'ghost-btn', disabled: 'disabled', text: '限制太紧，做不了' })
    ]));
    return card;
  }

  // ---------- 制作视图 ----------
  function openDetail(plan) {
    state.current = plan;
    state.checked = {};
    show($('compareWrap'), true);
    show($('detailGrid'), true);
    show($('stepsPanel'), true);
    show($('detailActions'), true);
    show($('explainBox'), false);
    $('refineError').textContent = '';
    renderDetail();
    showView('detail');
  }

  function renderDetail() {
    var p = state.current;
    if (!p) return;
    var d = state.ideas;
    $('detailTitle').textContent = p.title;
    $('detailMeta').textContent = laneLabel(p.lane) + ' · 改造成 ' + p.result +
      ' · ¥' + p.estimatedCost + '（估计） · ' + p.timeMinutes + ' 分钟 · ' + p.difficulty;

    // 原物：照片 / 内置示例线稿 / 占位
    var orig = $('originalBody');
    clear(orig);
    if (state.image) {
      orig.appendChild(h('img', { src: state.image, alt: '上传的闲置物照片' }));
      $('originalCaption').textContent = '你上传的照片';
    } else {
      var art = h('div', { class: 'art', html: Art.sampleArt(state.sampleId || 'none') });
      orig.appendChild(art);
      $('originalCaption').textContent = state.sampleId ? '内置示例线稿' : '未上传照片 · 按描述生成';
    }
    var diag = $('detailDiagram');
    clear(diag);
    diag.appendChild(Art.renderDiagram(p.diagram, p.lane));

    $('costTotal').textContent = '合计 ¥' + p.estimatedCost + '（估计）';
    var mats = $('materialList');
    clear(mats);
    (p.materials || []).forEach(function (m) {
      mats.appendChild(h('div', { class: 'mat-line' }, [
        h('span', {}, [m.name, h('span', { class: 'qty', text: m.qty || '' })]),
        h('span', { class: 'cost', text: '¥' + m.cost })
      ]));
    });

    var tools = $('toolList');
    clear(tools);
    if (!p.toolsUsed || !p.toolsUsed.length) {
      tools.appendChild(h('span', { class: 'chip', text: '只需徒手' }));
    } else {
      p.toolsUsed.forEach(function (t) { tools.appendChild(h('span', { class: 'chip', text: toolName(t) })); });
    }

    var notes = $('noteList');
    clear(notes);
    var allNotes = (p.notes || []).slice();
    if ((d && d.costNote) && allNotes.indexOf(d.costNote) < 0) allNotes.push(d.costNote);
    allNotes.forEach(function (n) { notes.appendChild(h('li', { text: n })); });

    var safety = $('safetyHints');
    clear(safety);
    (d && d.safety ? d.safety : []).forEach(function (s) {
      safety.appendChild(h('div', { class: 'safety-hint', text: s }));
    });

    renderSteps();
    $('refineBudget').value = state.lastConstraints ? state.lastConstraints.budget : state.budget;
    renderForbidChips();
    var favBtn = $('favCurrent');
    var starred = isFavorite(p);
    favBtn.textContent = starred ? '★ 已收藏（点击取消）' : '☆ 收藏这个';
    favBtn.classList.toggle('on', starred);
    favBtn.onclick = function () { toggleFavorite(p); renderDetail(); };
  }

  function renderSteps() {
    var p = state.current;
    var box = $('stepList');
    clear(box);
    (p.steps || []).forEach(function (s, i) {
      var cb = h('input', { type: 'checkbox' });
      cb.checked = Boolean(state.checked[i]);
      var item = h('div', { class: 'step-item' + (cb.checked ? ' done' : '') }, [
        cb,
        h('div', { class: 'step-body' }, [
          h('div', { class: 'step-label', text: (i + 1) + '. ' + s.label + (s.minutes ? ' · ' + s.minutes + ' 分钟' : '') }),
          h('div', { class: 'step-text', text: s.text }),
          s.note ? h('div', { class: 'step-note', text: '效果打折扣：' + s.note }) : null,
          s.tools && s.tools.length ? h('div', { class: 'step-note', text: '用到：' + s.tools.map(toolName).join('、') }) : null
        ])
      ]);
      cb.addEventListener('change', function () {
        state.checked[i] = cb.checked;
        item.classList.toggle('done', cb.checked);
        updateStepProgress();
      });
      box.appendChild(item);
    });
    updateStepProgress();
  }

  function updateStepProgress() {
    var total = (state.current && state.current.steps || []).length;
    var done = Object.keys(state.checked).filter(function (k) { return state.checked[k]; }).length;
    $('stepProgress').textContent = done + ' / ' + total + ' 已完成';
  }

  // ---------- 追加限制 ----------
  async function refine() {
    if (state.busy || !state.current || !state.lastBase) return;
    var errEl = $('refineError');
    errEl.textContent = '';
    var constraints = {
      budget: clampBudget($('refineBudget').value),
      tools: state.tools.slice(),
      forbidden: state.forbid.slice(),
      extra: $('refineExtra').value.trim()
    };
    var payload = {
      base: state.lastBase,
      planId: state.current.id,
      currentPlan: state.current,
      specs: state.specs,
      constraints: constraints
    };
    state.busy = true;
    var btn = $('refineBtn');
    btn.disabled = true; btn.textContent = '重新算…';
    try {
      var data = await api(API_BASE + 'refine', payload, 'refine');
      state.ideas = data;
      state.specs = data.specs || state.specs;
      state.lastConstraints = data.constraints;
      state.plans = (data.plans || []).concat(data.alternatives || []);
      state.checked = {};
      show($('refineResult'), true);
      var result = $('refineResult');
      clear(result);
      var pills = h('div', { class: 'changed' });
      (data.changed || []).forEach(function (c) { pills.appendChild(h('span', { class: 'changed-pill', text: c })); });
      (data.notes || []).slice(0, 3).forEach(function (n) { pills.appendChild(h('span', { class: 'changed-pill', text: n })); });
      result.appendChild(pills);
      if (data.plan) {
        state.current = data.plan;
        show($('compareWrap'), true);
        show($('detailGrid'), true);
        show($('stepsPanel'), true);
        show($('detailActions'), true);
        show($('explainBox'), false);
        renderDetail();
        toast('已按新限制重做');
      } else {
        showInfeasible(data);
        toast('限制下做不了，已给可行替代');
      }
    } catch (err) {
      errEl.textContent = (err.error || '迭代失败') +
        (err.code === 'client_timeout' ? '' : '（限制与输入已保留，可直接重试）');
    } finally {
      state.busy = false;
      btn.disabled = false; btn.textContent = '按限制重做';
    }
  }

  function showInfeasible(data) {
    show($('compareWrap'), false);
    show($('detailGrid'), false);
    show($('stepsPanel'), false);
    show($('detailActions'), false);
    var box = $('explainBox');
    clear(box);
    show(box, true);
    box.appendChild(h('div', { text: data.explanation || '此款式在当前限制下没有可行做法。' }));
    var substitutes = (data.substitutes && data.substitutes.length ? data.substitutes : data.alternatives) || [];
    var list = h('div', { class: 'alt-list' });
    substitutes.forEach(function (p) {
      var b = h('button', { type: 'button', class: 'ghost-btn', text: p.title + ' · ¥' + p.estimatedCost });
      b.addEventListener('click', function () {
        state.current = p;
        show($('compareWrap'), true); show($('detailGrid'), true);
        show($('stepsPanel'), true); show($('detailActions'), true);
        show(box, false);
        renderDetail();
      });
      list.appendChild(b);
    });
    if (substitutes.length) {
      box.appendChild(h('p', { text: '下面这些是同限制下真正可行的替代做法，不是原方案：' }));
      box.appendChild(list);
    }
  }

  // ---------- 收藏 ----------
  function favKey(plan) {
    return plan.id + '|' + JSON.stringify(state.lastConstraints || {});
  }
  function isFavorite(plan) {
    return state.favorites.some(function (f) { return f.key === favKey(plan); });
  }
  function loadFavorites() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      state.favorites = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.favorites)) state.favorites = [];
    } catch (err) { state.favorites = []; }
  }
  function saveFavorites() {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(state.favorites.slice(0, 40))); }
    catch (err) { toast('本地存储写入失败'); }
  }
  function toggleFavorite(plan) {
    var key = favKey(plan);
    var i = state.favorites.findIndex(function (f) { return f.key === key; });
    if (i >= 0) {
      state.favorites.splice(i, 1);
      toast('已取消收藏');
    } else {
      var spec = (state.specs || []).find(function (s) { return s.id === plan.id; }) || null;
      state.favorites.unshift({
        key: key,
        savedAt: new Date().toISOString(),
        item: (state.ideas && state.ideas.recognized && state.ideas.recognized.item) || state.item || '闲置物',
        material: (state.ideas && state.ideas.recognized && state.ideas.recognized.material) || state.material || '',
        sampleId: state.sampleId,
        mode: state.mode,
        source: state.ideas ? state.ideas.source : 'demo-rule',
        constraints: JSON.parse(JSON.stringify(state.lastConstraints || {})),
        plan: JSON.parse(JSON.stringify(plan)),
        spec: spec ? JSON.parse(JSON.stringify(spec)) : null
      });
      toast('已存到本机收藏');
    }
    saveFavorites();
    renderFavorites();
  }
  function renderFavorites() {
    $('favCount').textContent = String(state.favorites.length);
    var box = $('favList');
    clear(box);
    if (!state.favorites.length) {
      box.appendChild(h('p', { class: 'hint', text: '还没有收藏。打开一个方案点右上角的星标。' }));
      return;
    }
    state.favorites.forEach(function (f, idx) {
      var item = h('div', { class: 'fav-item' }, [
        h('h4', { text: f.plan.title }),
        h('p', { text: f.item + ' · ' + modeLabel(f.mode) + ' · ' + String(f.savedAt).slice(0, 10) }),
        h('div', { class: 'fav-actions' }, [
          (function () {
            var b = h('button', { type: 'button', class: 'ghost-btn', text: '打开' });
            b.addEventListener('click', function () { openFavorite(f); });
            return b;
          })(),
          (function () {
            var b = h('button', { type: 'button', class: 'ghost-btn', text: '删除' });
            b.addEventListener('click', function () {
              state.favorites.splice(idx, 1);
              saveFavorites(); renderFavorites(); renderResults();
            });
            return b;
          })()
        ])
      ]);
      box.appendChild(item);
    });
  }
  function openFavorite(f) {
    state.mode = f.mode === 'live' ? 'live' : 'demo';
    state.sampleId = f.sampleId || null;
    state.image = null;
    state.item = f.item; state.material = f.material;
    state.ideas = {
      recognized: { item: f.item, material: f.material, source: 'saved' },
      notice: '这是本地收藏的方案快照（' + modeLabel(f.mode) + ' / ' + sourceLabel(f.source) + '），不含照片。',
      plans: [f.plan], alternatives: [], infeasible: [], notes: [], safety: [],
      laneStatus: [], constraints: f.constraints, costNote: '费用为估计；未核实材质不保证安全、承重与防水。'
    };
    state.specs = f.spec ? [f.spec] : [];
    state.plans = [f.plan];
    state.lastBase = {
      sampleId: f.sampleId || null, image: null, item: f.item, material: f.material,
      description: '', tools: (f.constraints && f.constraints.tools) || [], budget: (f.constraints && f.constraints.budget) || 20
    };
    state.lastConstraints = f.constraints || { budget: 20, tools: [], forbidden: [], extra: '' };
    state.forbid = (f.constraints && f.constraints.forbidden) || [];
    state.current = f.plan;
    state.checked = {};
    show($('favDrawer'), false);
    closeCorrection();
    openDetail(f.plan);
  }

  // ---------- 导出 ----------
  function safeName(s) {
    return String(s || '方案').replace(/[\\/:*?"<>|\r\n]/g, '_').slice(0, 36);
  }
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
  }
  function markdown() {
    var p = state.current;
    var d = state.ideas || {};
    var c = state.lastConstraints || {};
    var lines = [];
    lines.push('# 制作清单 · ' + (p.title || '改造方案'));
    lines.push('');
    lines.push('- 原物：' + ((d.recognized && d.recognized.item) || state.item || '闲置物'));
    lines.push('- 材质：' + ((d.recognized && d.recognized.material) || state.material || '未填写'));
    lines.push('- 款式：' + laneLabel(p.lane) + ' / 改造成 ' + (p.result || ''));
    lines.push('- 方案来源：' + (d.source === 'llm' ? '配置模型输出（服务端校验）' : (d.source === 'demo-rule' ? '示例模式本地规则方案' : '本地收藏快照')));
    var recSource = d.recognized && d.recognized.source;
    if (recSource === 'ocr') lines.push('- 信息线索：照片上真实读到的文字（文字识别），不是看图识别结果');
    else if (recSource === 'vision') lines.push('- 信息线索：模型视觉识别结果，可纠正');
    lines.push('- 约束：预算 ¥' + (c.budget || 0) + '；已有工具 ' + ((c.tools || []).map(toolName).join('、') || '仅徒手') +
      '；禁用 ' + ((c.forbidden || []).map(toolName).join('、') || '无'));
    lines.push('');
    lines.push('> ' + schemeLabel() + ' / 示意，不是实物成品。费用为估计值；未核实材质不保证安全、承重与防水。');
    lines.push('');
    // 尺寸只从 diagram.dims 取，和详情页结构图、分享卡是同一份标注。
    var dims = p.diagram && p.diagram.dims;
    if (dims) {
      lines.push('## 结构尺寸');
      lines.push('- 宽：' + dims.width);
      lines.push('- 深：' + dims.depth);
      lines.push('- 高：' + dims.height);
      lines.push('- 板件与连接：' + dims.note);
      lines.push('');
      lines.push('> 以上标注与详情页结构图、分享卡一致；裁板、折叠线与三等分连接位置按这组尺寸对应。');
      lines.push('');
    }
    lines.push('## 材料');
    (p.materials || []).forEach(function (m) {
      lines.push('- ' + m.name + (m.qty ? ' × ' + m.qty : '') + ' · ¥' + m.cost + '（估计）');
    });
    lines.push('');
    lines.push('合计：¥' + p.estimatedCost + '（估计）');
    lines.push('');
    lines.push('## 工具');
    lines.push((p.toolsUsed || []).length ? (p.toolsUsed || []).map(toolName).join('、') : '只需徒手');
    lines.push('');
    lines.push('## 制作步骤');
    (p.steps || []).forEach(function (s, i) {
      lines.push('- [ ] ' + (i + 1) + '. ' + s.label + '：' + s.text +
        (s.tools && s.tools.length ? '（工具：' + s.tools.map(toolName).join('、') + '）' : '') +
        (s.note ? '（注意：' + s.note + '）' : ''));
    });
    lines.push('');
    lines.push('## 必要注意点');
    (p.notes || []).forEach(function (n) { lines.push('- ' + n); });
    lines.push('- ' + (d.costNote || '费用为估计；未核实材质不保证安全、承重与防水。'));
    (d.safety || []).forEach(function (s) { lines.push('- ' + s); });
    lines.push('');
    lines.push('---');
    lines.push('万物改造局 · 结构示意仅为示意，不表示已完成实物制作。');
    return lines.join('\n') + '\n';
  }
  function downloadMd() {
    if (!state.current) return;
    var name = '万物改造局-制作清单-' + safeName(state.current.title) + '.md';
    downloadBlob(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }), name);
    toast('制作清单已下载');
  }
  async function openShare() {
    if (!state.current) return;
    var p = state.current;
    var tone = Art.tone(p.lane).main;
    var isDemo = state.mode === 'demo';
    // 与详情页用同一个 renderDiagram，图示（含宽/深/高标注）不会两处各画一套。
    var svg = Art.renderDiagram(p.diagram, p.lane);
    var canvas = await Share.buildCard({
      plan: p,
      item: (state.ideas && state.ideas.recognized && state.ideas.recognized.item) || state.item || '闲置物',
      laneLabel: laneLabel(p.lane) + ' · ' + schemeLabel(),
      tone: tone,
      isDemo: isDemo,
      diagramSvg: svg
    });
    state.shareCanvas = canvas;
    var wrap = $('canvasWrap');
    clear(wrap);
    wrap.appendChild(canvas);
    $('shareNote').textContent = isDemo
      ? '标注「示例方案 / 示意」：本地规则生成，未调用模型、未做图像识别；结构图与详情页一致，卡片上的「步骤摘要」不是完整步骤。'
      : '标注「模型方案 / 示意」，不表示已完成实物制作；结构图与详情页一致，卡片上的「步骤摘要」不是完整步骤。';
    show($('shareModal'), true);
  }
  function downloadPng() {
    var canvas = state.shareCanvas;
    if (!canvas) return;
    var name = '万物改造局-分享卡-' + safeName(state.current.title) + '.png';
    if (canvas.toBlob) {
      canvas.toBlob(function (blob) {
        if (blob) { downloadBlob(blob, name); toast('分享卡 PNG 已下载'); }
      }, 'image/png');
    } else {
      var a = h('a', { href: canvas.toDataURL('image/png'), download: name });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      toast('分享卡 PNG 已下载');
    }
  }

  // ---------- 事件绑定 ----------
  function bind() {
    $('fileInput').addEventListener('change', function (e) {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      e.target.value = '';
    });
    var dz = $('dropZone');
    ['dragenter', 'dragover'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); });
    });
    dz.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    $('clearPhoto').addEventListener('click', function () {
      state.image = null;
      state.ocr = null;
      $('previewImg').removeAttribute('src');
      show($('previewWrap'), false);
      show($('ocrPanel'), false);
      show($('dropZone'), true);
    });
    $('ocrBtn').addEventListener('click', runOcr);
    $('ocrApplyBtn').addEventListener('click', applyOcrClue);
    $('generateBtn').addEventListener('click', generate);
    $('backHome').addEventListener('click', function () { showView('home'); });
    $('backResults').addEventListener('click', function () { renderResults(); showView('results'); });
    $('toggleCorrection').addEventListener('click', function () {
      state.correctionOpen = !state.correctionOpen;
      show($('recognizedBox'), state.correctionOpen);
      $('toggleCorrection').textContent = correctionToggleText();
    });
    $('applyCorrection').addEventListener('click', function () {
      $('itemInput').value = $('correctItem').value.trim();
      $('materialInput').value = $('correctMaterial').value.trim();
      closeCorrection();
      generate();
    });
    $('favBtn').addEventListener('click', function () { show($('favDrawer'), $('favDrawer').classList.contains('hidden')); });
    $('closeFav').addEventListener('click', function () { show($('favDrawer'), false); });
    $('refineBtn').addEventListener('click', refine);
    $('downloadMd').addEventListener('click', downloadMd);
    $('shareBtn').addEventListener('click', openShare);
    $('downloadPng').addEventListener('click', downloadPng);
    $('closeShare').addEventListener('click', function () { show($('shareModal'), false); });
    $('shareModal').addEventListener('click', function (e) {
      if (e.target === $('shareModal')) show($('shareModal'), false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { show($('shareModal'), false); show($('favDrawer'), false); }
    });
  }

  init();
})();
