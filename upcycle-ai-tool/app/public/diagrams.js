/* 万物改造局 · 本地 SVG 结构示意（尺寸标注 + 折叠线），不加载任何外部资源。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var TONES = {
    practical: { main: '#2f6b4f', soft: '#e6f0e8', ink: '#244f3c' },
    aesthetic: { main: '#c9762a', soft: '#fbead6', ink: '#a55c1c' },
    wild: { main: '#4a5b86', soft: '#e9ecf5', ink: '#3b4a73' }
  };
  var NEUTRAL = '#8d8a7c';
  var LINE = '#ded4c0';

  function el(tag, attrs, text) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, String(attrs[k]));
    });
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function add(parent, tag, attrs, text) {
    var node = el(tag, attrs, text);
    parent.appendChild(node);
    return node;
  }
  function line(parent, x1, y1, x2, y2, opts) {
    opts = opts || {};
    return add(parent, 'line', {
      x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: opts.stroke || NEUTRAL,
      'stroke-width': opts.width || 1,
      'stroke-dasharray': opts.dash || null,
      'stroke-linecap': 'round',
      transform: opts.transform || null,
      opacity: opts.opacity === undefined ? 1 : opts.opacity
    });
  }
  function rect(parent, x, y, w, h, opts) {
    opts = opts || {};
    return add(parent, 'rect', {
      x: x, y: y, width: w, height: h, rx: opts.rx || 0,
      fill: opts.fill || 'none',
      stroke: opts.stroke || NEUTRAL,
      'stroke-width': opts.width || 1,
      'stroke-dasharray': opts.dash || null,
      opacity: opts.opacity === undefined ? 1 : opts.opacity
    });
  }
  function poly(parent, points, opts) {
    opts = opts || {};
    return add(parent, 'polygon', {
      points: points,
      fill: opts.fill || 'none',
      stroke: opts.stroke || NEUTRAL,
      'stroke-width': opts.width || 1,
      'stroke-dasharray': opts.dash || null,
      transform: opts.transform || null,
      opacity: opts.opacity === undefined ? 1 : opts.opacity
    });
  }
  function circle(parent, cx, cy, r, opts) {
    opts = opts || {};
    return add(parent, 'circle', {
      cx: cx, cy: cy, r: r,
      fill: opts.fill || 'none',
      stroke: opts.stroke || NEUTRAL,
      'stroke-width': opts.width || 1,
      'stroke-dasharray': opts.dash || null
    });
  }
  function label(parent, x, y, text, opts) {
    opts = opts || {};
    return add(parent, 'text', {
      x: x, y: y,
      'font-size': opts.size || 10,
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fill: opts.fill || '#6f7468',
      'text-anchor': opts.anchor || 'start',
      'letter-spacing': opts.spacing || 0
    }, text);
  }
  function dimH(parent, x1, x2, y, text) {
    line(parent, x1, y, x2, y, { stroke: NEUTRAL, width: 1 });
    line(parent, x1, y - 4, x1, y + 4, { stroke: NEUTRAL, width: 1 });
    line(parent, x2, y - 4, x2, y + 4, { stroke: NEUTRAL, width: 1 });
    label(parent, (x1 + x2) / 2, y - 6, text, { anchor: 'middle', size: 9, fill: '#6f7468' });
  }
  function dimV(parent, y1, y2, x, text) {
    line(parent, x, y1, x, y2, { stroke: NEUTRAL, width: 1 });
    line(parent, x - 4, y1, x + 4, y1, { stroke: NEUTRAL, width: 1 });
    line(parent, x - 4, y2, x + 4, y2, { stroke: NEUTRAL, width: 1 });
    var t = add(parent, 'text', {
      x: x - 8, y: (y1 + y2) / 2, 'font-size': 9,
      'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fill: '#6f7468', 'text-anchor': 'middle',
      transform: 'rotate(-90 ' + (x - 8) + ' ' + ((y1 + y2) / 2) + ')'
    }, text);
    return t;
  }

  // 不裁切分支的整瓶线稿：带原厂瓶盖，不画切口虚线，也不出现「切口」字样。
  function wholeBottle(svg, T, SOFT, withScene, wText, hText) {
    rect(svg, 147, 48, 26, 11, { rx: 2, fill: SOFT, stroke: T, width: 1.4 });
    rect(svg, 150, 59, 20, 10, { fill: '#fffdf8', stroke: T, width: 1.2 });
    add(svg, 'path', {
      d: 'M150 69 L128 88 Q124 94 124 102 L124 186 Q124 196 134 196 L186 196 Q196 196 196 186 L196 102 Q196 94 192 88 L170 69 Z',
      fill: '#fffdf8', stroke: T, 'stroke-width': 1.5
    });
    if (withScene) {
      for (var k = 0; k < 5; k++) circle(svg, 136 + k * 12, 187 - (k % 2) * 4, 4, { fill: SOFT, stroke: T, width: 0.8 });
      poly(svg, '150,182 160,156 172,182', { fill: SOFT, stroke: T, width: 1 });
    }
    label(svg, 204, 62, '原厂瓶口 · 未裁切', { size: 9, fill: T });
    dimH(svg, 124, 196, 208, wText);
    dimV(svg, 48, 196, 104, hText);
  }

  function build(spec, lane) {
    spec = spec || {};
    var tone = TONES[lane] || TONES.practical;
    var svg = el('svg', {
      viewBox: '0 0 320 220', width: '100%', height: '100%',
      role: 'img', 'aria-label': '改造结构示意图（含尺寸与折叠线）',
      preserveAspectRatio: 'xMidYMid meet'
    });
    rect(svg, 0, 0, 320, 220, { fill: '#fffdf8', stroke: 'none' });
    // 工作台网格底
    for (var gx = 20; gx < 320; gx += 20) line(svg, gx, 8, gx, 212, { stroke: '#f0eadc', width: 0.6, opacity: 0.75 });
    for (var gy = 20; gy < 220; gy += 20) line(svg, 8, gy, 312, gy, { stroke: '#f0eadc', width: 0.6, opacity: 0.75 });

    var w = Math.max(20, Math.min(1200, Number(spec.w) || 240));
    var h = Math.max(20, Math.min(1200, Number(spec.h) || 160));
    var unit = String(spec.unit || 'mm').slice(0, 8);
    var fold = Boolean(spec.fold);
    // dims 由方案数据提供，是宽/深/高文字标注的唯一真源（详情、PNG、清单都读它）。
    // 立体图里竖向是「高」，斜向是「深」；没有 dims 时退回原来的 w/h 平面标注。
    var dims = spec.dims && typeof spec.dims === 'object' ? spec.dims : null;
    var wText = dims && dims.width ? dims.width : (w + ' ' + unit);
    var hText = dims && dims.height ? dims.height : (h + ' ' + unit);
    var dText = dims && dims.depth ? dims.depth : '';
    var T = tone.main;
    var SOFT = tone.soft;

    var type = spec.type || 'flat-mosaic';
    if (type === 'box-divider') {
      poly(svg, '60,72 250,72 285,48 95,48', { fill: SOFT, stroke: T, width: 1.4 });
      rect(svg, 60, 72, 190, 88, { fill: '#fffdf8', stroke: T, width: 1.6 });
      poly(svg, '250,72 285,48 285,136 250,160', { fill: SOFT, stroke: T, width: 1.4 });
      line(svg, 123, 72, 123, 160, { stroke: T, width: 1.3 });
      line(svg, 187, 72, 187, 160, { stroke: T, width: 1.3 });
      line(svg, 60, 116, 250, 116, { stroke: T, width: 0.9, dash: '4 4' });
      if (fold) {
        line(svg, 60, 72, 250, 72, { stroke: T, width: 1, dash: '6 4' });
        line(svg, 123, 72, 123, 160, { stroke: T, width: 0.9, dash: '3 4' });
        line(svg, 187, 72, 187, 160, { stroke: T, width: 0.9, dash: '3 4' });
      }
      dimH(svg, 60, 250, 182, wText);
      dimV(svg, 72, 160, 44, hText);
      if (dText) {
        // 顶面斜边＝进深。放到图右下空白处，避开左上角三条结构标注，也不和尺寸线叠字。
        label(svg, 308, 198, '斜向 ' + dText, { size: 9, anchor: 'end', fill: '#6f7468' });
      }
    } else if (type === 'flat-mosaic') {
      rect(svg, 60, 48, 200, 112, { fill: SOFT, stroke: T, width: 1.5 });
      poly(svg, '60,160 130,48 200,160', { fill: '#fffdf8', stroke: T, width: 1.1 });
      poly(svg, '130,48 200,48 260,160 200,160', { fill: '#fffdf8', stroke: T, width: 1.1, opacity: 0.8 });
      poly(svg, '60,48 130,48 95,104', { fill: SOFT, stroke: T, width: 1.1 });
      line(svg, 130, 48, 130, 160, { stroke: T, width: 1, dash: '5 4' });
      line(svg, 60, 104, 260, 104, { stroke: T, width: 0.9, dash: '5 4' });
      line(svg, 200, 48, 200, 160, { stroke: T, width: 0.9, dash: '5 4' });
      dimH(svg, 60, 260, 182, wText);
      dimV(svg, 48, 160, 44, hText);
    } else if (type === 'ramp') {
      poly(svg, '55,150 275,150 275,62 55,118', { fill: SOFT, stroke: T, width: 1.6 });
      poly(svg, '55,118 275,62 275,48 55,104', { fill: '#fffdf8', stroke: T, width: 1.2 });
      poly(svg, '55,150 55,104 72,100 72,150', { fill: '#fffdf8', stroke: T, width: 1.1 });
      line(svg, 55, 118, 275, 62, { stroke: T, width: 1, dash: '6 4' });
      line(svg, 96, 140, 220, 108, { stroke: T, width: 1.1, dash: '4 4' });
      line(svg, 130, 132, 130, 118, { stroke: T, width: 1.4 });
      line(svg, 200, 114, 200, 98, { stroke: T, width: 1.4 });
      circle(svg, 92, 138, 5, { fill: T, stroke: T });
      label(svg, 196, 90, '15°', { size: 9, fill: T });
      dimH(svg, 55, 275, 182, wText);
      dimV(svg, 62, 150, 40, hText);
    } else if (type === 'cylinder') {
      if (spec.whole) {
        wholeBottle(svg, T, SOFT, false, wText, hText);
      } else {
        add(svg, 'ellipse', { cx: 160, cy: 56, rx: 66, ry: 15, fill: SOFT, stroke: T, 'stroke-width': 1.5 });
        rect(svg, 94, 56, 132, 98, { fill: '#fffdf8', stroke: T, width: 1.5 });
        add(svg, 'path', { d: 'M94 154 A66 15 0 0 0 226 154', fill: 'none', stroke: T, 'stroke-width': 1.4 });
        line(svg, 94, 56, 94, 154, { stroke: T, width: 0.8, opacity: 0.5 });
        line(svg, 226, 56, 226, 154, { stroke: T, width: 0.8, opacity: 0.5 });
        line(svg, 94, 68, 226, 68, { stroke: T, width: 1.1, dash: '6 4' });
        label(svg, 236, 72, '切口', { size: 9, fill: T });
        dimH(svg, 94, 226, 182, wText);
        dimV(svg, 56, 154, 74, hText);
      }
    } else if (type === 'hang') {
      if (spec.whole) {
        wholeBottle(svg, T, SOFT, false, wText, hText);
      } else {
      line(svg, 160, 24, 160, 158, { stroke: T, width: 1.3, dash: '3 4' });
      for (var i = 0; i < 5; i++) {
        var cx = 96 + i * 32;
        var cy = 58 + (i % 2) * 78;
        line(svg, 160, 24, cx, cy - 16, { stroke: NEUTRAL, width: 0.7, opacity: 0.6 });
        add(svg, 'path', {
          d: 'M' + cx + ' ' + (cy - 16) + ' C' + (cx - 22) + ' ' + (cy - 4) + ' ' + (cx - 16) + ' ' + (cy + 22) + ' ' + cx + ' ' + (cy + 26) +
             ' C' + (cx + 16) + ' ' + (cy + 22) + ' ' + (cx + 22) + ' ' + (cy - 4) + ' ' + cx + ' ' + (cy - 16) + ' Z',
          fill: SOFT, stroke: T, 'stroke-width': 1.2
        });
        line(svg, cx, cy - 14, cx, cy + 24, { stroke: T, width: 0.8, dash: '3 3' });
      }
        dimH(svg, 80, 240, 200, wText);
        dimV(svg, 24, 160, 58, hText);
      }
    } else if (type === 'terrarium') {
      if (spec.whole) {
        wholeBottle(svg, T, SOFT, true, wText, hText);
      } else {
      add(svg, 'path', { d: 'M104 150 L104 76 Q104 42 160 42 Q216 42 216 76 L216 150', fill: SOFT, stroke: T, 'stroke-width': 1.6 });
      rect(svg, 94, 150, 132, 14, { fill: '#fffdf8', stroke: T, width: 1.4 });
      for (var k = 0; k < 7; k++) circle(svg, 116 + k * 15, 143 - (k % 3) * 4, 5, { fill: '#fffdf8', stroke: T, width: 0.9 });
      poly(svg, '150,138 170,104 190,138', { fill: '#fffdf8', stroke: T, width: 1.2 });
      line(svg, 104, 76, 216, 76, { stroke: T, width: 1, dash: '5 4' });
        dimH(svg, 94, 226, 186, wText);
        dimV(svg, 42, 164, 78, hText);
      }
    } else if (type === 'fabric') {
      poly(svg, '96,52 224,52 236,156 84,156', { fill: SOFT, stroke: T, 'stroke-width': 1.6 });
      line(svg, 96, 52, 224, 52, { stroke: T, width: 1.1, dash: '5 4' });
      line(svg, 84, 130, 236, 130, { stroke: T, width: 0.9, dash: '4 4' });
      for (var f = 0; f < 9; f++) {
        var fx = 90 + f * 17;
        line(svg, fx, 156, fx, 172, { stroke: T, width: 1.1 });
      }
      line(svg, 160, 52, 160, 130, { stroke: T, width: 0.8, dash: '3 4' });
      dimH(svg, 96, 224, 192, wText);
      dimV(svg, 52, 156, 68, hText);
      label(svg, 90, 184, '剪口深 40', { size: 9, fill: T });
    } else if (type === 'weave') {
      for (var b = 0; b < 3; b++) {
        var bx = 96 + b * 44;
        poly(svg, (bx) + ',48 ' + (bx + 26) + ',48 ' + (bx + 12 + (b % 2) * 12) + ',164 ' + (bx - 14 + (b % 2) * 12) + ',164',
          { fill: b === 1 ? '#fffdf8' : SOFT, stroke: T, width: 1.3 });
        line(svg, bx + 13, 48, bx + 13 + (b % 2) * 6, 164, { stroke: T, width: 0.8, dash: '4 4' });
      }
      rect(svg, 84, 44, 152, 8, { fill: '#fffdf8', stroke: T, width: 1.2 });
      dimH(svg, 84, 236, 190, wText);
      dimV(svg, 44, 164, 66, hText);
    } else if (type === 'pinwheel') {
      for (var p = 0; p < 4; p++) {
        var a = p * 90;
        poly(svg, '160,110 160,42 196,58', {
          fill: SOFT, stroke: T, width: 1.3,
          transform: 'rotate(' + a + ' 160 110)'
        });
        line(svg, 160, 110, 160, 42, { stroke: T, width: 0.8, dash: '4 4', transform: 'rotate(' + a + ' 160 110)' });
      }
      circle(svg, 160, 110, 8, { fill: '#fffdf8', stroke: T, width: 1.4 });
      line(svg, 160, 118, 160, 178, { stroke: T, width: 2 });
      dimH(svg, 100, 220, 196, wText);
      dimV(svg, 42, 178, 80, hText);
    } else {
      rect(svg, 70, 55, 180, 100, { fill: SOFT, stroke: T, width: 1.5 });
      line(svg, 70, 105, 250, 105, { stroke: T, width: 1, dash: '5 4' });
      dimH(svg, 70, 250, 182, wText);
    }

    // 结构标注（文本内容一律用 textContent 写入，不插入 HTML）
    var labels = Array.isArray(spec.labels) ? spec.labels.slice(0, 3) : [];
    labels.forEach(function (text, i) {
      rect(svg, 12, 10 + i * 15, 4, 4, { fill: T, stroke: 'none' });
      label(svg, 20, 15 + i * 15, String(text).slice(0, 24), { size: 8.5, fill: '#6f7468' });
    });
    label(svg, 308, 212, '结构示意 · 非实物成品', { size: 8, fill: '#9c9a8c', anchor: 'end' });
    return svg;
  }

  // 内置示例的线稿插画，全部是本地静态 SVG 字符串。
  var SAMPLE_ART = {
    carton: '<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" aria-label="瓦楞纸箱线稿"><g fill="none" stroke="#2f6b4f" stroke-width="2" stroke-linejoin="round"><path d="M18 34 60 20l42 14v44L60 92 18 78Z"/><path d="M18 34l42 14 42-14M60 48v44"/><path d="M32 27l42 14" stroke-dasharray="4 4" opacity=".55"/></g><path d="M18 34 60 20l42 14-42 14Z" fill="#e6f0e8" opacity=".7"/></svg>',
    bottle: '<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" aria-label="透明饮料瓶线稿"><g fill="none" stroke="#c9762a" stroke-width="2" stroke-linejoin="round"><path d="M48 14h24v10l8 8v50a6 6 0 0 1-6 6H46a6 6 0 0 1-6-6V32l8-8Z"/><path d="M40 44h40M40 62h40" stroke-dasharray="4 4" opacity=".6"/><path d="M48 14h24" stroke-width="3"/></g><rect x="42" y="46" width="36" height="14" rx="2" fill="#fbead6" opacity=".8"/></svg>',
    tshirt: '<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" aria-label="旧T恤线稿"><g fill="none" stroke="#4a5b86" stroke-width="2" stroke-linejoin="round"><path d="M42 16 24 26l-10 20 16 8 6-8v38h48V46l6 8 16-8-10-20-18-10-12 10Z"/><path d="M42 16q18 18 36 0" stroke-dasharray="4 4" opacity=".6"/><path d="M36 72h48" stroke-dasharray="3 4" opacity=".5"/></g><path d="M42 16 24 26l-10 20 16 8 6-8v38h48V46l6 8 16-8-10-20-18-10-12 10Z" fill="#e9ecf5" opacity=".55"/></svg>',
    none: '<svg viewBox="0 0 120 96" xmlns="http://www.w3.org/2000/svg" aria-label="未上传照片"><g fill="none" stroke="#9c9a8c" stroke-width="2" stroke-linejoin="round"><rect x="20" y="20" width="80" height="58" rx="4"/><path d="M20 64l24-20 16 12 18-16 22 20" stroke-dasharray="4 4"/><circle cx="80" cy="36" r="6"/></g></svg>'
  };

  window.UpcycleArt = {
    renderDiagram: build,
    sampleArt: function (key) { return SAMPLE_ART[key] || SAMPLE_ART.none; },
    tone: function (lane) { return TONES[lane] || TONES.practical; }
  };
})();
