
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

/* Fiber calculator */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'f' };
  function ai(sex, age) { // NASEM Adequate Intake, g/day
    if (age <= 3) return 19; if (age <= 8) return 25;
    if (sex === 'm') return age <= 13 ? 31 : age <= 50 ? 38 : 30;
    return age <= 18 ? 26 : age <= 50 ? 25 : 21;
  }
  function update() {
    var age = TP.num($('tp-age')), kcal = TP.num($('tp-kcal')), cur = TP.num($('tp-cur')), msg = '';
    if (!(age >= 1 && age <= 110)) msg = 'Enter an age.';
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var a = ai(state.sex, age), byK = isFinite(kcal) && kcal > 800 ? Math.round(kcal / 1000 * 14) : null, goal = byK || a;
    $('tp-big').textContent = goal + ' g';
    $('tp-c1').textContent = a + ' g'; $('tp-c2').textContent = byK ? byK + ' g' : 'add calories'; $('tp-c3').textContent = Math.round(goal / 3) + ' g';
    var gap = isFinite(cur) ? goal - cur : null;
    $('tp-c4').textContent = gap === null ? 'add intake' : (gap > 0 ? '+' + Math.round(gap) + ' g' : 'met');
    $('tp-line').innerHTML = 'Aim for about <b>' + goal + ' g of fiber a day</b>' + (byK ? ' (14 g per 1,000 calories, the U.S. Dietary Guidelines target)' : ' (the Adequate Intake for your age and sex)') + '. ' + (gap !== null ? (gap > 0 ? 'You are about <b>' + Math.round(gap) + ' g short</b>: increase gradually over 2–3 weeks and drink more water to avoid bloating.' : 'You are already meeting the target.') : 'Most Americans eat only about 15–16 g a day.');
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + goal + ' g</b> fiber/day';
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap')); $('tp-age').value = 35; update();
})();
