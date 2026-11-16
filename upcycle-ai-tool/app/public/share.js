/* 分享卡 PNG：纯 Canvas 本地绘制。不含 API 配置、隐私信息、二维码。
   排版用固定分区，步骤区与页脚不重叠；结构图直接复用详情页那张 SVG。 */
(function () {
  'use strict';
  var W = 1080;
  var H = 1440;
  var SCALE = 2;
  var INK = '#2c352e';
  var MUTED = '#767d71';
  var PAPER = '#fbf7ee';
  var LINE = '#e0d7c5';
  var GREEN = '#2f6b4f';
  var ORANGE = '#c9762a';

  // 固定基线：所有区块位置固定，内容多少不会把步骤挤到页脚上。
  var L = {
    badgeY: 142, laneY: 240, titleY: 320, titleStep: 74, subY: 440,
    panelY: 470, panelH: 360, statY: 860, statH: 112,
    matTitleY: 1010, matFirstY: 1050, matStep: 34,
    stepTitleY: 1126, stepFirstY: 1170, stepStep: 40,
    footerLineY: 1290, footerY1: 1330, footerY2: 1362
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function seeded(n) {
    var s = n % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    var out = [];
    var line = '';
    var chars = String(text || '').split('');
    for (var i = 0; i < chars.length; i++) {
      var test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = chars[i];
        if (out.length >= maxLines) break;
      } else {
        line = test;
      }
    }
    if (out.length < maxLines && line) out.push(line);
    return out;
  }

  // 单行截断并加省略号：步骤摘要只占一行，不许撑到页脚区。
  function ellipsis(ctx, text, maxWidth) {
    var s = String(text || '');
    if (ctx.measureText(s).width <= maxWidth) return s;
    for (var n = s.length - 1; n > 0; n--) {
      var t = s.slice(0, n) + '…';
      if (ctx.measureText(t).width <= maxWidth) return t;
    }
    return '…';
  }

  // 把详情页的 SVG 节点序列化成图片，保证分享卡和详情看到的是同一张图。
  function detailSvgImage(svgNode) {
    if (!svgNode || typeof XMLSerializer === 'undefined') return Promise.resolve(null);
    try {
      var clone = svgNode.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', '320');
      clone.setAttribute('height', '220');
      clone.removeAttribute('class');
      var src = 'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent(new XMLSerializer().serializeToString(clone));
      var img = new Image();
      return new Promise(function (resolve) {
        img.onload = function () { resolve(img); };
        img.onerror = function () { resolve(null); };
        img.src = src;
      });
    } catch (err) {
      return Promise.resolve(null);
    }
  }

  // 只有详情页 SVG 不可用时才走这个简化示意，且尺寸文字同样读 dims。
  function drawFallbackDiagram(ctx, spec, x, y, w, h, color) {
    spec = spec || {};
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    var t = spec.type || 'flat-mosaic';
    var cx = x + w / 2;
    if (t === 'box-divider' || t === 'ramp' || t === 'flat-mosaic' || t === 'weave') {
      ctx.fillStyle = '#f1ecdf';
      roundRect(ctx, x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.58, 10);
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(x + w * 0.37, y + h * 0.2); ctx.lineTo(x + w * 0.37, y + h * 0.78);
      ctx.moveTo(x + w * 0.63, y + h * 0.2); ctx.lineTo(x + w * 0.63, y + h * 0.78);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (t === 'cylinder' || t === 'terrarium') {
      ctx.beginPath();
      ctx.ellipse(cx, y + h * 0.24, w * 0.24, h * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeRect(cx - w * 0.24, y + h * 0.24, w * 0.48, h * 0.48);
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(cx - w * 0.24, y + h * 0.4); ctx.lineTo(cx + w * 0.24, y + h * 0.4); ctx.stroke();
      ctx.setLineDash([]);
    } else if (t === 'pinwheel') {
      for (var p = 0; p < 4; p++) {
        ctx.save();
        ctx.translate(cx, y + h * 0.47);
        ctx.rotate(p * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(0, -h * 0.3); ctx.lineTo(w * 0.13, -h * 0.22);
        ctx.closePath();
        ctx.fillStyle = '#f1ecdf'; ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(cx, y + h * 0.47, 10, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.7); ctx.lineTo(x + w * 0.5, y + h * 0.25);
      ctx.lineTo(x + w * 0.82, y + h * 0.7); ctx.closePath();
      ctx.fillStyle = '#f1ecdf'; ctx.fill(); ctx.stroke();
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(x + w * 0.5, y + h * 0.25); ctx.lineTo(x + w * 0.5, y + h * 0.7); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = MUTED;
    ctx.font = '20px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    var d = spec.dims;
    var dim = d && d.width ? [d.width, d.depth, d.height].filter(Boolean).join(' / ')
      : ((Number(spec.w) || 240) + ' × ' + (Number(spec.h) || 160) + ' ' + String(spec.unit || 'mm'));
    ctx.fillText(dim, cx, y + h - 18);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawDiagram(ctx, spec, img, x, y, w, h, color) {
    if (img) {
      var scale = Math.min(w / 320, h / 220);
      var dw = 320 * scale, dh = 220 * scale;
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
      return 'detail-svg';
    }
    drawFallbackDiagram(ctx, spec, x, y, w, h, color);
    return 'fallback';
  }

  async function buildCard(data) {
    var plan = data.plan || {};
    var item = String(data.item || '闲置物');
    var laneLabel = String(data.laneLabel || '改造方案');
    var tone = data.tone || GREEN;
    var isDemo = Boolean(data.isDemo);
    var schemeLabel = isDemo ? '示例方案' : '模型方案';
    var canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;
    var ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    var rnd = seeded(20261106);
    for (var i = 0; i < 1600; i++) {
      var px = rnd() * W, py = rnd() * H;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(120,110,90,0.035)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(px, py, 1.6, 1.6);
    }
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, 36, 36, W - 72, H - 72, 24);
    ctx.stroke();

    // 页眉
    ctx.fillStyle = ORANGE;
    ctx.beginPath(); ctx.arc(84, 100, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK;
    ctx.font = '600 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('万物改造局', 108, 110);
    ctx.fillStyle = MUTED;
    ctx.font = '20px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('UPCYCLE BUREAU', W - 84, 108);
    ctx.textAlign = 'left';

    // 示例模式明确标「示例方案」，不冒充模型输出
    ctx.strokeStyle = ORANGE;
    ctx.lineWidth = 2;
    roundRect(ctx, 84, L.badgeY, 250, 46, 23);
    ctx.stroke();
    ctx.fillStyle = ORANGE;
    ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(schemeLabel + ' / 示意', 106, L.badgeY + 30);

    ctx.fillStyle = tone;
    ctx.font = '600 26px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(laneLabel, 84, L.laneY);

    ctx.fillStyle = INK;
    ctx.font = '700 62px "Songti SC", "PingFang SC", serif';
    var titleLines = wrap(ctx, plan.title || '改造方案', W - 168, 2);
    titleLines.forEach(function (ln, idx) { ctx.fillText(ln, 84, L.titleY + idx * L.titleStep); });

    ctx.fillStyle = MUTED;
    ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(ellipsis(ctx, '原物：' + item + '   →   ' + (plan.result || '改造示意'), W - 168), 84, L.subY);

    // 结构示意面板：与详情页共用同一张 SVG
    ctx.fillStyle = '#fffdf8';
    roundRect(ctx, 84, L.panelY, W - 168, L.panelH, 20);
    ctx.fill();
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.stroke();
    var img = await detailSvgImage(data.diagramSvg);
    var diagramSource = drawDiagram(ctx, plan.diagram, img, 110, L.panelY + 10, W - 220, L.panelH - 20, tone);
    // 详情 SVG 自带「结构示意 · 非实物成品」角标，这里不再重复写一遍。

    // 三个数据块
    var stats = [
      ['预计费用', '¥ ' + (Number(plan.estimatedCost) || 0) + '（估计）'],
      ['预计用时', (Number(plan.timeMinutes) || 0) + ' 分钟'],
      ['难度', plan.difficulty || '入门']
    ];
    var statW = (W - 168 - 32) / 3;
    stats.forEach(function (s, idx) {
      var sx = 84 + idx * (statW + 16);
      ctx.fillStyle = '#f2ecdf';
      roundRect(ctx, sx, L.statY, statW, L.statH, 14);
      ctx.fill();
      ctx.fillStyle = MUTED;
      ctx.font = '22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(s[0], sx + 24, L.statY + 40);
      ctx.fillStyle = INK;
      ctx.font = '600 32px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(s[1], sx + 24, L.statY + 86);
    });

    // 主要材料
    ctx.fillStyle = INK;
    ctx.font = '600 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('主要材料', 84, L.matTitleY);
    var materials = (plan.materials || []).slice(0, 5);
    ctx.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = MUTED;
    var matLines = wrap(ctx, materials.map(function (m) { return m.name + (m.qty ? ' × ' + m.qty : ''); }).join(' · ') || '原物', W - 168, 2);
    matLines.forEach(function (ln, idx) { ctx.fillText(ln, 84, L.matFirstY + idx * L.matStep); });

    // 步骤摘要：明确标为摘要，且固定只画 3 行，不与页脚争位置
    var allSteps = plan.steps || [];
    var shown = Math.min(3, allSteps.length);
    ctx.fillStyle = INK;
    ctx.font = '600 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('步骤摘要', 84, L.stepTitleY);
    ctx.fillStyle = MUTED;
    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('共 ' + allSteps.length + ' 步 · 这里列出前 ' + shown + ' 步 · 完整做法见制作清单', W - 84, L.stepTitleY);
    ctx.textAlign = 'left';
    ctx.font = '23px "PingFang SC", "Microsoft YaHei", sans-serif';
    for (var si = 0; si < shown; si++) {
      var sy = L.stepFirstY + si * L.stepStep;
      ctx.fillStyle = tone;
      ctx.fillText(String(si + 1).padStart(2, '0'), 84, sy);
      ctx.fillStyle = MUTED;
      ctx.fillText(ellipsis(ctx, allSteps[si].label + '：' + allSteps[si].text, W - 230), 138, sy);
    }

    // 页脚：分割线固定在步骤区下方
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(84, L.footerLineY); ctx.lineTo(W - 84, L.footerLineY); ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = '20px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(isDemo
      ? schemeLabel + ' / 示意 · 本地规则生成，未调用模型、未做图像识别'
      : schemeLabel + ' / 示意 · 不表示已完成实物制作', 84, L.footerY1);
    ctx.fillText('费用为估计；未核实材质不保证安全、承重与防水。', 84, L.footerY2);
    ctx.textAlign = 'right';
    ctx.fillText('万物改造局', W - 84, L.footerY2);
    ctx.textAlign = 'left';

    // 供验证脚本做「不重叠 / 图示同源」的精确断言，不影响 PNG 内容。
    canvas.__layout = {
      stepsLastBaseline: L.stepFirstY + (shown - 1) * L.stepStep,
      footerLineY: L.footerLineY,
      footerY1: L.footerY1,
      diagramSource: diagramSource,
      diagramDims: (plan.diagram && plan.diagram.dims) || null,
      isDemo: isDemo,
      schemeLabel: schemeLabel,
      stepTitle: '步骤摘要'
    };
    return canvas;
  }

  window.UpcycleShare = { buildCard: buildCard };
})();
