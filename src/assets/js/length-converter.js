
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

/* Length converters: inches<->cm, feet(+inches)<->cm, cm->feet+inches, feet<->inches (runs in the browser) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var mode = root.getAttribute('data-mode');
  var $ = function (id) { return document.getElementById(id); };
  function n(el) { return TP.num(el); }
  function r(v, d) { var p = Math.pow(10, d); return Math.round(v * p) / p; }
  function fi(totalIn) { var f = Math.floor(totalIn / 12), i = r(totalIn - f * 12, 2); if (i >= 12) { f++; i = 0; } return [f, i]; }
  function frac(i) { // nearest 1/8 inch as a fraction string
    var w = Math.floor(i), e = Math.round((i - w) * 8); if (e === 8) { w++; e = 0; }
    var F = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];
    return e ? (w ? w + ' ' : '') + F[e] : String(w);
  }
  var big = $('tp-big'), sub = $('tp-sub'), line = $('tp-line'), err = $('tp-err'), strip = $('tp-mstrip');
  function show(b, s, l) { big.textContent = b; sub.innerHTML = s; line.innerHTML = l; if (strip) strip.innerHTML = '<b>' + b + '</b>'; }
  var busy = false;
  function update(src) {
    if (busy) return; busy = true; err.hidden = true;
    try {
      if (mode === 'in2cm') {
        var a = $('tp-a'), b = $('tp-b');
        if (src === 'b') { var cm = n(b); if (isFinite(cm)) a.value = r(cm / 2.54, 3); }
        else { var inch = n(a); if (isFinite(inch)) b.value = r(inch * 2.54, 3); }
        var i1 = n(a), c1 = n(b);
        if (!isFinite(i1)) { show('—', '', ''); return; }
        show(r(i1, 3) + ' in = ' + r(c1, 2) + ' cm', 'Also ' + r(c1 * 10, 1) + ' mm &middot; ' + r(c1 / 100, 4) + ' m &middot; ' + frac(i1) + ' in to the nearest 1/8',
          '<b>' + r(i1, 3) + ' in &times; 2.54 = ' + r(c1, 3) + ' cm</b>' + (i1 >= 12 ? '. That is ' + fi(i1)[0] + ' ft ' + fi(i1)[1] + ' in.' : '.'));
      } else if (mode === 'ft2cm') {
        var ft = n($('tp-ft')), ins = n($('tp-in')) || 0, cmEl = $('tp-cm');
        if (src === 'cm') { var c = n(cmEl); if (isFinite(c)) { var t = fi(c / 2.54); $('tp-ft').value = t[0]; $('tp-in').value = r(t[1], 2); ft = t[0]; ins = t[1]; } }
        else if (isFinite(ft)) cmEl.value = r((ft * 12 + ins) * 2.54, 2);
        if (!isFinite(ft)) { show('—', '', ''); return; }
        var tot = ft * 12 + ins, cmv = tot * 2.54;
        show(ft + ' ft ' + r(ins, 2) + ' in = ' + r(cmv, 1) + ' cm', 'Also ' + r(cmv / 100, 3) + ' m &middot; ' + r(tot, 2) + ' inches in total &middot; ' + r(ft + ins / 12, 3) + ' ft as a decimal',
          '<b>(' + ft + ' &times; 12 + ' + r(ins, 2) + ') &times; 2.54 = ' + r(tot, 2) + ' &times; 2.54 = ' + r(cmv, 2) + ' cm</b>');
      } else if (mode === 'cm2ft') {
        var cm2 = n($('tp-cm'));
        if (src === 'ft') { var f2 = n($('tp-ft')), i2 = n($('tp-in')) || 0; if (isFinite(f2)) { cm2 = (f2 * 12 + i2) * 2.54; $('tp-cm').value = r(cm2, 1); } }
        if (!isFinite(cm2)) { show('—', '', ''); return; }
        var totIn = cm2 / 2.54, p = fi(totIn);
        if (src !== 'ft') { $('tp-ft').value = p[0]; $('tp-in').value = r(p[1], 1); }
        show(r(cm2, 1) + ' cm = ' + p[0] + ' ft ' + r(p[1], 1) + ' in', 'Rounded: ' + p[0] + '′' + Math.round(p[1]) + '″ &middot; ' + r(totIn, 2) + ' inches &middot; ' + r(totIn / 12, 3) + ' ft as a decimal &middot; ' + frac(p[1]) + ' in to the nearest 1/8',
          '<b>' + r(cm2, 1) + ' &divide; 2.54 = ' + r(totIn, 2) + ' in</b>; ' + r(totIn, 2) + ' &divide; 12 = ' + p[0] + ' ft with <b>' + r(p[1], 2) + ' in</b> left over.');
      } else if (mode === 'ft2in') {
        var f3 = n($('tp-ft')), i3 = n($('tp-in')) || 0, tEl = $('tp-tot');
        if (src === 'tot') { var t3 = n(tEl); if (isFinite(t3)) { var q = fi(t3); $('tp-ft').value = q[0]; $('tp-in').value = r(q[1], 2); f3 = q[0]; i3 = q[1]; } }
        else if (isFinite(f3)) tEl.value = r(f3 * 12 + i3, 3);
        if (!isFinite(f3)) { show('—', '', ''); return; }
        var tt = f3 * 12 + i3;
        show(f3 + ' ft ' + (i3 ? r(i3, 2) + ' in ' : '') + '= ' + r(tt, 2) + ' in', 'Also ' + r(tt * 2.54, 1) + ' cm &middot; ' + r(tt / 36, 3) + ' yd &middot; ' + r(f3 + i3 / 12, 3) + ' ft as a decimal',
          '<b>' + f3 + ' ft &times; 12 = ' + r(f3 * 12, 2) + ' in</b>' + (i3 ? ', plus ' + r(i3, 2) + ' in = <b>' + r(tt, 2) + ' in</b>.' : '.'));
      }
    } finally { busy = false; }
  }
  root.addEventListener('input', function (e) { update(e.target.getAttribute('data-src')); });
  Array.prototype.forEach.call(root.querySelectorAll('[data-q]'), function (b) {
    b.addEventListener('click', function () { var v = b.getAttribute('data-q').split(','); v.forEach(function (x) { var kv = x.split('='); $(kv[0]).value = kv[1]; }); update(b.getAttribute('data-qs')); });
  });
  TP.hdr(root.closest('.tp-wrap'));
  update(root.getAttribute('data-init'));
})();
