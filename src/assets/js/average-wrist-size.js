
var TP = (function () {
  'use strict';
  var IN = 2.54, LB = 0.45359237;
  function num(el) { if (!el) return NaN; var v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function erf(x) { var s = x < 0 ? -1 : 1; x = Math.abs(x); var t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); }
  function Phi(z) { return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function ord(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function pctText(p) { p = Math.round(p * 100); if (p < 1) return 'below 1st'; if (p > 99) return 'above 99th'; return ord(p); }
  function pressed(list, attr, val) { Array.prototype.forEach.call(list, function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === val ? 'true' : 'false'); }); }
  function seg(root, attr, fn) { Array.prototype.forEach.call(root.querySelectorAll('[' + attr + ']'), function (b) { b.addEventListener('click', function () { fn(b.getAttribute(attr)); }); }); }
  function hdr(wrap) {
    var h = document.querySelector('.site-header');
    function set() { if (h && wrap) wrap.style.setProperty('--tp-hdr', Math.round(h.getBoundingClientRect().height) + 'px'); }
    set(); window.addEventListener('resize', set);
  }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  return { IN: IN, LB: LB, num: num, r1: r1, Phi: Phi, ord: ord, pctText: pctText, pressed: pressed, seg: seg, hdr: hdr, fmt: fmt };
})();

/* Average Wrist Size — percentile, frame size, watch & bracelet sizing (runs in the browser) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool');
  if (!root) return;
  var S = { m: [17.6, 0.88], f: [15.5, 0.79] };       // ANSUR II, cm
  // median wrist (in) by height midpoint (in), ANSUR II
  var BYH = { m: [[62.5, 6.5], [64.5, 6.7], [66.5, 6.8], [68.5, 6.9], [70.5, 7.0], [72.5, 7.1], [74.5, 7.3], [76.5, 7.3]],
              f: [[58.5, 5.7], [60.5, 5.9], [62.5, 6.0], [64.5, 6.1], [66.5, 6.3], [68.5, 6.4]] };
  var CSD = { m: 0.30, f: 0.27 }; // in, spread at a given height (from middle-half ranges)
  var $ = function (id) { return document.getElementById(id); };
  var state = { sex: 'm', unit: 'us' };
  var els = { w: $('tp-w'), wU: $('tp-w-u'), ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'), err: $('tp-err'), out: $('tp-out'),
    pct: $('tp-pct'), cat: $('tp-cat'), marker: $('tp-marker'), hpct: $('tp-hpct'), frame: $('tp-frame'), watch: $('tp-watch'), band: $('tp-band'), line: $('tp-line'), mobile: $('tp-mstrip') };
  function len(cm) { return state.unit === 'us' ? TP.r1(cm / TP.IN).toFixed(1) + ' in' : TP.r1(cm).toFixed(1) + ' cm'; }
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function medianAt(sex, hin) {
    var t = BYH[sex], i;
    if (hin <= t[0][0]) return t[0][1] + (hin - t[0][0]) * (t[1][1] - t[0][1]) / (t[1][0] - t[0][0]);
    if (hin >= t[t.length - 1][0]) return t[t.length - 1][1] + (hin - t[t.length - 1][0]) * 0.05;
    for (i = 0; i < t.length - 1; i++) if (hin <= t[i + 1][0]) return t[i][1] + (hin - t[i][0]) * (t[i + 1][1] - t[i][1]) / (t[i + 1][0] - t[i][0]);
  }
  function label(p) { return p < 0.10 ? ['Small', 'c1'] : p < 0.25 ? ['Slightly small', 'c1'] : p <= 0.75 ? ['Average', 'c3'] : p <= 0.90 ? ['Slightly large', 'c4'] : ['Large', 'c5']; }
  function update() {
    var sex = state.sex, v = TP.num(els.w) * (state.unit === 'us' ? TP.IN : 1), h = readH(), msg = '';
    if (!(v >= 10 && v <= 26)) msg = 'Enter your wrist circumference: usually 5–8.5 in (13–22 cm).';
    else if (isFinite(h) && !(h >= 120 && h <= 230)) msg = 'Height should be between 4 ft and 7 ft 6 in (120–230 cm), or leave it blank.';
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }
    var p = TP.Phi((v - S[sex][0]) / S[sex][1]), lab = label(p);
    els.pct.textContent = TP.pctText(p); els.cat.textContent = lab[0]; els.cat.className = 'tp-pill tp-' + lab[1];
    els.marker.style.left = Math.min(99, Math.max(1, p * 100)) + '%';
    var txt = 'A <b>' + len(v) + '</b> wrist is larger than about <b>' + Math.round(p * 100) + '%</b> of ' + (sex === 'm' ? 'men' : 'women') + ' (average ' + len(S[sex][0]) + ').';
    if (isFinite(h)) {
      var med = medianAt(sex, h / TP.IN) * TP.IN, ph = TP.Phi((v - med) / (CSD[sex] * TP.IN)), r = h / v, fr;
      if (sex === 'm') fr = r > 10.4 ? 'Small' : (r >= 9.6 ? 'Medium' : 'Large'); else fr = r > 11.0 ? 'Small' : (r >= 10.1 ? 'Medium' : 'Large');
      els.hpct.textContent = TP.pctText(ph); els.frame.textContent = fr;
      txt += ' For your height the typical wrist is <b>' + len(med) + '</b>, so you are in the <b>' + TP.pctText(ph) + '</b> percentile for your height. Height-to-wrist ratio ' + r.toFixed(1) + ' = <b>' + fr.toLowerCase() + ' frame</b>.';
    } else { els.hpct.textContent = 'add height'; els.frame.textContent = 'add height'; }
    var win = v / TP.IN;
    els.watch.textContent = win < 6.0 ? '28–36 mm' : (win < 6.5 ? '34–38 mm' : (win < 7.0 ? '36–40 mm' : (win < 7.5 ? '38–42 mm' : (win < 8.0 ? '40–44 mm' : '42–46 mm'))));
    els.band.textContent = len(v + 1.3) + ' – ' + len(v + 2.5);
    els.line.innerHTML = txt;
    if (els.mobile) els.mobile.innerHTML = '<b>' + len(v) + '</b> · ' + TP.pctText(p) + ' percentile';
  }
  function fill(cm) { els.w.value = state.unit === 'us' ? TP.r1(cm / TP.IN) : TP.r1(cm); }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); fill(S[s][0]); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return;
    var v = TP.num(els.w) * (state.unit === 'us' ? TP.IN : 1), h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u);
    els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us'; els.wU.textContent = u === 'us' ? 'in' : 'cm';
    if (isFinite(v)) fill(v);
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = Math.round(t - f * 12); } else els.cm.value = Math.round(h); }
    update();
  });
  root.addEventListener('input', update);
  TP.hdr(root.closest('.tp-wrap'));
  fill(17.8); els.ft.value = 5; els.inch.value = 10; update();
})();
