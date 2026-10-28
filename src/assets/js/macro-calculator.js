
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

var NU = (function () {
  function bmr(sex, kg, cm, age) { return 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161); }
  return { bmr: bmr };
})();

/* Macro calculator: Mifflin-St Jeor TDEE + goal + macro split */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'm', unit: 'us', goal: 'maintain', diet: 'balanced' };
  function readH() { return state.unit === 'us' ? (TP.num($('tp-ft')) * 12 + (TP.num($('tp-in')) || 0)) * 2.54 : TP.num($('tp-cm')); }
  var GOAL = { lose2: [-0.20, 'To lose weight faster'], lose: [-0.15, 'To lose weight'], maintain: [0, 'To maintain your weight'], gain: [0.10, 'To build muscle'] };
  var DIET = { balanced: [null, 0.30], lowcarb: [null, 0.40], highprot: [2.2, 0.25], lowfat: [null, 0.20], keto: [null, 0.70] };
  function update() {
    var sex = state.sex, age = TP.num($('tp-age')), h = readH(), kg = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1), act = +$('tp-act').value, msg = '';
    if (!(age >= 15 && age <= 90)) msg = 'Enter an age between 15 and 90.'; else if (!(h >= 120 && h <= 230)) msg = 'Enter your height.'; else if (!(kg >= 35 && kg <= 250)) msg = 'Enter your weight.';
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var tdee = NU.bmr(sex, kg, h, age) * act, g = GOAL[state.goal], kcal = Math.round(tdee * (1 + g[0]) / 10) * 10;
    var floor = sex === 'm' ? 1500 : 1200; if (kcal < floor) kcal = floor;
    var protPerKg = DIET[state.diet][0] || (state.goal === 'maintain' ? 1.6 : (state.goal === 'gain' ? 1.8 : 2.0));
    var p = Math.round(kg * protPerKg), fatPct = DIET[state.diet][1], f = Math.round(kcal * fatPct / 9), c = Math.round((kcal - p * 4 - f * 9) / 4);
    if (state.diet === 'keto') { c = 25; f = Math.round((kcal - p * 4 - c * 4) / 9); }
    if (c < 0) { c = 0; f = Math.round((kcal - p * 4) / 9); }
    $('tp-big').textContent = kcal.toLocaleString('en-US') + ' kcal';
    $('tp-p').textContent = p + ' g'; $('tp-c').textContent = c + ' g'; $('tp-f').textContent = f + ' g'; $('tp-t').textContent = Math.round(tdee).toLocaleString('en-US') + ' kcal';
    var tot = p * 4 + c * 4 + f * 9;
    $('tp-bars').innerHTML = [['Protein', p * 4, p, '#8fc4be'], ['Carbs', c * 4, c, '#e8c97a'], ['Fat', f * 9, f, '#d6a064']].map(function (x) { return '<div class="tp-bar"><span>' + x[0] + '</span><i><em style="width:' + (x[1] / tot * 100) + '%;background:' + x[3] + '"></em></i><b>' + Math.round(x[1] / tot * 100) + '%</b></div>'; }).join('');
    var meals = +$('tp-meals').value;
    $('tp-line').innerHTML = '<b>' + g[1] + '</b>, eat about <b>' + kcal.toLocaleString('en-US') + ' calories</b> a day: <b>' + p + ' g protein</b>, <b>' + c + ' g carbs</b> and <b>' + f + ' g fat</b>. Over ' + meals + ' meals that is about ' + Math.round(p / meals) + ' g protein, ' + Math.round(c / meals) + ' g carbs and ' + Math.round(f / meals) + ' g fat per meal. Maintenance is about ' + Math.round(tdee).toLocaleString('en-US') + ' kcal (Mifflin-St Jeor). Adjust by 100–200 kcal after 2–3 weeks based on your progress.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + kcal + '</b> kcal · P' + p + ' C' + c + ' F' + f;
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  TP.seg(root, 'data-goal', function (s) { state.goal = s; TP.pressed(root.querySelectorAll('[data-goal]'), 'data-goal', s); update(); });
  TP.seg(root, 'data-unit', function (u) { var h = readH(), w = TP.num($('tp-wt')) * (state.unit === 'us' ? 0.45359237 : 1); state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-h-us').hidden = u !== 'us'; $('tp-h-m').hidden = u === 'us'; $('tp-wtu').textContent = u === 'us' ? 'lb' : 'kg';
    if (isFinite(h)) { if (u === 'us') { var t = h / 2.54, f = Math.floor(t / 12); $('tp-ft').value = f; $('tp-in').value = Math.round(t - f * 12); } else $('tp-cm').value = Math.round(h); }
    if (isFinite(w)) $('tp-wt').value = u === 'us' ? Math.round(w / 0.45359237) : Math.round(w); update(); });
  $('tp-diet').addEventListener('change', function () { state.diet = $('tp-diet').value; update(); });
  root.addEventListener('input', update); root.addEventListener('change', update); TP.hdr(root.closest('.tp-wrap'));
  $('tp-age').value = 30; $('tp-ft').value = 5; $('tp-in').value = 10; $('tp-wt').value = 180; update();
})();
