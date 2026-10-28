
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

/* Protein calculator */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { unit: 'us' };
  var G = { sed: [0.8, 1.0, 'a sedentary adult (RDA)'], active: [1.2, 1.6, 'regular exercise'], muscle: [1.6, 2.2, 'building muscle'], cut: [1.8, 2.4, 'losing fat while keeping muscle'], endur: [1.2, 1.6, 'endurance training'], older: [1.0, 1.2, 'adults 65 and over'], preg: [1.1, 1.3, 'pregnancy (2nd–3rd trimester)'] };
  function update() {
    var kg = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1), goal = $('tp-goal').value, meals = +$('tp-meals').value;
    var useLean = $('tp-lean').checked, bf = TP.num($('tp-bf')), msg = '';
    if (!(kg >= 30 && kg <= 250)) msg = 'Enter your weight.'; else if (useLean && !(bf >= 3 && bf <= 60)) msg = 'Enter body fat % or untick the lean-mass option.';
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var base = useLean ? kg * (1 - bf / 100) * 1.15 : kg, r = G[goal], lo = Math.round(base * r[0]), hi = Math.round(base * r[1]), mid = Math.round((lo + hi) / 2);
    $('tp-big').textContent = lo + '–' + hi + ' g';
    $('tp-c1').textContent = mid + ' g'; $('tp-c2').textContent = Math.round(mid / meals) + ' g'; $('tp-c3').textContent = (mid * 4) + ' kcal'; $('tp-c4').textContent = r[0] + '–' + r[1] + ' g/kg';
    $('tp-line').innerHTML = 'For <b>' + r[2] + '</b>, aim for <b>' + lo + '–' + hi + ' g of protein a day</b> (' + r[0] + '–' + r[1] + ' g per kg' + (useLean ? ' of adjusted lean weight' : ' of body weight') + '). Split over ' + meals + ' meals, that is about <b>' + Math.round(mid / meals) + ' g per meal</b>. Examples of 25 g: 100 g (3.5 oz) chicken breast, 4 eggs, 250 g Greek yogurt, or 1 scoop of whey plus milk.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + lo + '–' + hi + ' g</b> protein/day';
  }
  TP.seg(root, 'data-unit', function (u) { var w = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1); state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-wtu').textContent = u === 'us' ? 'lb' : 'kg'; if (isFinite(w)) $('tp-wt').value = u === 'us' ? Math.round(w / 0.45359237) : Math.round(w); update(); });
  $('tp-lean').addEventListener('change', function () { $('tp-bf-row').hidden = !$('tp-lean').checked; update(); });
  root.addEventListener('input', update); root.addEventListener('change', update); TP.hdr(root.closest('.tp-wrap')); $('tp-wt').value = 170; update();
})();
