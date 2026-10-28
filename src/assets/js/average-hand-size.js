
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

/* Average Hand Size — percentiles + glove size (runs in the browser) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool');
  if (!root) return;
  // ANSUR II 5th / 50th / 95th (cm) -> normal fit
  var D = { m: { len: [17.7, 19.3, 21.0], br: [8.1, 8.8, 9.6], circ: [19.5, 21.2, 23.0] }, f: { len: [16.5, 18.0, 19.9], br: [7.2, 7.8, 8.5], circ: [17.3, 18.7, 20.2] } };
  function ms(a) { return [a[1], (a[2] - a[0]) / 3.29]; }
  var $ = function (id) { return document.getElementById(id); };
  var state = { sex: 'm', unit: 'us' };
  var els = { len: $('tp-len'), br: $('tp-br'), circ: $('tp-circ'), u: root.querySelectorAll('.tp-lu'), ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'),
    err: $('tp-err'), out: $('tp-out'), pct: $('tp-pct'), cat: $('tp-cat'), marker: $('tp-marker'), pBr: $('tp-pbr'), pCirc: $('tp-pcirc'), glove: $('tp-glove'), ratio: $('tp-ratio'), line: $('tp-line'), mobile: $('tp-mstrip') };
  function len(cm) { return state.unit === 'us' ? TP.r1(cm / TP.IN).toFixed(1) + ' in' : TP.r1(cm).toFixed(1) + ' cm'; }
  function rd(el) { return TP.num(el) * (state.unit === 'us' ? TP.IN : 1); }
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function P(v, a) { var m = ms(a); return TP.Phi((v - m[0]) / m[1]); }
  function label(p) { return p < 0.10 ? ['Small', 'c1'] : p < 0.25 ? ['Slightly small', 'c1'] : p <= 0.75 ? ['Average', 'c3'] : p <= 0.90 ? ['Slightly large', 'c4'] : ['Large', 'c5']; }
  function glove(circCm, sex) {
    var n = Math.round(circCm / TP.IN * 2) / 2, letter;
    if (sex === 'm') letter = n < 7.5 ? 'XS' : n < 8.25 ? 'S' : n < 9.25 ? 'M' : n < 10.25 ? 'L' : n < 11.25 ? 'XL' : 'XXL';
    else letter = n < 6.25 ? 'XS' : n < 7 ? 'S' : n < 7.75 ? 'M' : n < 8.5 ? 'L' : 'XL';
    return letter + ' · size ' + n;
  }
  function update() {
    var sex = state.sex, L = rd(els.len), B = rd(els.br), Cc = rd(els.circ), h = readH(), msg = '';
    if (!(L >= 12 && L <= 26)) msg = 'Enter your hand length: usually 6–9 in (15–23 cm).';
    else if (isFinite(B) && !(B >= 5 && B <= 13)) msg = 'Hand breadth is usually 2.5–4.5 in (6–12 cm).';
    else if (isFinite(Cc) && !(Cc >= 13 && Cc <= 30)) msg = 'Hand circumference is usually 6–11 in (15–28 cm).';
    else if (isFinite(h) && !(h >= 120 && h <= 230)) msg = 'Height should be between 4 ft and 7 ft 6 in (120–230 cm), or leave it blank.';
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }
    var d = D[sex], p = P(L, d.len), lab = label(p);
    els.pct.textContent = TP.pctText(p); els.cat.textContent = lab[0]; els.cat.className = 'tp-pill tp-' + lab[1];
    els.marker.style.left = Math.min(99, Math.max(1, p * 100)) + '%';
    els.pBr.textContent = isFinite(B) ? TP.pctText(P(B, d.br)) : 'add breadth';
    var circ = isFinite(Cc) ? Cc : (isFinite(B) ? B * (d.circ[1] / d.br[1]) : null);
    els.pCirc.textContent = isFinite(Cc) ? TP.pctText(P(Cc, d.circ)) : 'add it';
    els.glove.textContent = circ ? glove(circ, sex) + (isFinite(Cc) ? '' : '*') : 'add breadth';
    els.ratio.textContent = isFinite(h) ? (L / h * 100).toFixed(1) + '%' : 'add height';
    var t = 'A hand length of <b>' + len(L) + '</b> is longer than about <b>' + Math.round(p * 100) + '%</b> of ' + (sex === 'm' ? 'men' : 'women') + ' (median ' + len(d.len[1]) + ').';
    if (isFinite(h)) { var exp = h * (sex === 'm' ? 0.110 : 0.110); t += ' At your height a typical hand is about <b>' + len(exp) + '</b> long.'; }
    if (circ && !isFinite(Cc)) t += ' *Glove size estimated from breadth; measure around the knuckles for a firm size.';
    els.line.innerHTML = t;
    if (els.mobile) els.mobile.innerHTML = '<b>' + len(L) + '</b> · ' + TP.pctText(p) + ' percentile';
  }
  function fill(sex) { var d = D[sex], f = state.unit === 'us' ? function (c) { return TP.r1(c / TP.IN); } : TP.r1; els.len.value = f(d.len[1]); els.br.value = f(d.br[1]); els.circ.value = ''; }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); fill(s); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return;
    var vals = [els.len, els.br, els.circ].map(rd), h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u);
    els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us';
    Array.prototype.forEach.call(els.u, function (n) { n.textContent = u === 'us' ? 'in' : 'cm'; });
    [els.len, els.br, els.circ].forEach(function (el, i) { el.value = isFinite(vals[i]) ? (u === 'us' ? TP.r1(vals[i] / TP.IN) : TP.r1(vals[i])) : ''; });
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = Math.round(t - f * 12); } else els.cm.value = Math.round(h); }
    update();
  });
  root.addEventListener('input', update);
  TP.hdr(root.closest('.tp-wrap'));
  fill('m'); update();
})();
