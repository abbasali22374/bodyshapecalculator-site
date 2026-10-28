
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

/* Water intake calculator */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'f', unit: 'us' };
  function update() {
    var kg = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1), ex = TP.num($('tp-ex')) || 0, hot = $('tp-hot').checked, preg = $('tp-preg').value, msg = '';
    if (!(kg >= 30 && kg <= 250)) msg = 'Enter your weight.';
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var ai = state.sex === 'm' ? 3.7 : 2.7; if (state.sex === 'f' && preg === 'p') ai = 3.0; if (state.sex === 'f' && preg === 'b') ai = 3.8;
    var byW = kg * 0.033, base = (ai * 0.8 + byW) / 2, extra = ex / 60 * 0.6 + (hot ? 0.5 : 0), drink = base + extra;
    function fmt(l) { return state.unit === 'us' ? Math.round(l * 33.814) + ' oz' : l.toFixed(1) + ' L'; }
    $('tp-big').textContent = fmt(drink);
    $('tp-c1').textContent = (drink * 33.814 / 8).toFixed(1) + ' cups'; $('tp-c2').textContent = drink.toFixed(1) + ' L'; $('tp-c3').textContent = fmt(ai); $('tp-c4').textContent = fmt(extra);
    $('tp-line').innerHTML = 'Drink about <b>' + fmt(drink) + ' (' + (state.unit === 'us' ? drink.toFixed(1) + ' L, ' : Math.round(drink * 33.814) + ' oz, ') + (drink * 33.814 / 8).toFixed(1) + ' cups) a day</b> from drinks, including water, tea, coffee and milk. Food supplies roughly another 20% of your water. ' + (extra > 0 ? 'This includes about ' + fmt(extra) + ' extra for exercise' + (hot ? ' and hot weather' : '') + '. ' : '') + 'Pale yellow urine is a simple sign you are drinking enough.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + fmt(drink) + '</b> a day';
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); $('tp-preg-row').hidden = s !== 'f'; update(); });
  TP.seg(root, 'data-unit', function (u) { var w = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1); state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-wtu').textContent = u === 'us' ? 'lb' : 'kg'; if (isFinite(w)) $('tp-wt').value = u === 'us' ? Math.round(w / 0.45359237) : Math.round(w); update(); });
  root.addEventListener('input', update); root.addEventListener('change', update); TP.hdr(root.closest('.tp-wrap')); $('tp-wt').value = 160; $('tp-ex').value = 30; update();
})();
