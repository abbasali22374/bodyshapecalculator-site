
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

/* VO2 max calculator — 4 methods + Cooper Institute norms */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { sex: 'm', m: 'hr', unit: 'us' };
  var AGES = [[20, 29], [30, 39], [40, 49], [50, 59], [60, 69], [70, 79]];
  var N = { m: [[41.7, 45.4, 51.1, 55.4], [40.5, 44, 48.3, 54], [38.5, 42.4, 46.4, 52.5], [35.6, 39.2, 43.4, 48.9], [32.3, 35.5, 39.5, 45.7], [29.4, 32.3, 36.7, 42.1]],
            f: [[36.1, 39.5, 43.9, 49.6], [34.4, 37.8, 42.4, 47.4], [33, 36.3, 39.7, 45.3], [30.1, 33, 36.7, 41.1], [27.5, 30, 33, 37.8], [25.9, 28.1, 30.9, 36.7]] };
  function rating(v, sex, age) {
    var i = 0; for (; i < AGES.length - 1; i++) if (age <= AGES[i][1]) break;
    var t = N[sex][i], lab = v >= t[3] ? ['Superior', 'c2'] : v >= t[2] ? ['Excellent', 'c2'] : v >= t[1] ? ['Good', 'c3'] : v >= t[0] ? ['Fair', 'c4'] : ['Poor', 'c5'];
    return [lab, t, AGES[i]];
  }
  function show(id, on) { $(id).hidden = !on; }
  function update() {
    var sex = state.sex, age = TP.num($('tp-age')), v = NaN, msg = '', how = '';
    if (!(age >= 18 && age <= 90)) msg = 'Enter an age between 18 and 90.';
    else if (state.m === 'hr') {
      var mx = TP.num($('tp-mhr')), r = TP.num($('tp-rhr')); if (!isFinite(mx)) mx = 208 - 0.7 * age;
      if (!(r >= 30 && r <= 110)) msg = 'Enter your resting heart rate (30–110 bpm).'; else { v = 15.3 * mx / r; how = 'Uth heart-rate ratio: 15.3 × ' + Math.round(mx) + ' ÷ ' + r; }
    } else if (state.m === 'cooper') {
      var d = TP.num($('tp-dist')) * (state.unit === 'us' ? 1609.344 : 1000);
      if (!(d >= 800 && d <= 5000)) msg = 'Enter the distance you covered in 12 minutes (0.5–3.1 miles or 0.8–5 km).'; else { v = (d - 504.9) / 44.73; how = 'Cooper 12-minute test: (' + Math.round(d) + ' m − 504.9) ÷ 44.73'; }
    } else if (state.m === 'run') {
      var mins = TP.num($('tp-rmin')) + (TP.num($('tp-rsec')) || 0) / 60;
      if (!(mins >= 7 && mins <= 30)) msg = 'Enter your 1.5-mile (2.4 km) run time.'; else { v = 483 / mins + 3.5; how = '1.5-mile run: 483 ÷ ' + mins.toFixed(2) + ' min + 3.5'; }
    } else {
      var wt = TP.num($('tp-wt')) * (state.unit === 'us' ? 1 : 2.20462), wm = TP.num($('tp-wmin')) + (TP.num($('tp-wsec')) || 0) / 60, hr = TP.num($('tp-whr'));
      if (!(wt > 66 && wm >= 8 && wm <= 30 && hr >= 60 && hr <= 220)) msg = 'Enter your weight, 1-mile walk time and heart rate at the finish.';
      else { v = 132.853 - 0.0769 * wt - 0.3877 * age + 6.315 * (sex === 'm' ? 1 : 0) - 3.2649 * wm - 0.1565 * hr; how = 'Rockport 1-mile walk test'; }
    }
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var R = rating(v, sex, age);
    $('tp-big').textContent = v.toFixed(1); $('tp-cat').textContent = R[0][0]; $('tp-cat').className = 'tp-pill tp-' + R[0][1];
    var t = R[1]; $('tp-marker').style.left = Math.max(1, Math.min(99, (v - (t[0] - 8)) / ((t[3] + 6) - (t[0] - 8)) * 100)) + '%';
    $('tp-ticks').innerHTML = t.map(function (x, i) { return '<span style="left:' + ((x - (t[0] - 8)) / ((t[3] + 6) - (t[0] - 8)) * 100) + '%">' + x + '</span>'; }).join('');
    $('tp-line').innerHTML = 'Estimated VO2 max: <b>' + v.toFixed(1) + ' ml/kg/min</b> (' + how + '). For ' + (sex === 'm' ? 'men' : 'women') + ' aged ' + R[2][0] + '–' + R[2][1] + ', that is <b>' + R[0][0].toLowerCase() + '</b> on the Cooper Institute norms: fair from ' + t[0] + ', good from ' + t[1] + ', excellent from ' + t[2] + ' and superior from ' + t[3] + '.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = 'VO2 max <b>' + v.toFixed(1) + '</b> · ' + R[0][0];
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); update(); });
  TP.seg(root, 'data-unit', function (u) { state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); Array.prototype.forEach.call(root.querySelectorAll('.tp-du'), function (n) { n.textContent = u === 'us' ? 'mi' : 'km'; }); $('tp-wtu').textContent = u === 'us' ? 'lb' : 'kg'; update(); });
  TP.seg(root, 'data-m', function (m) { state.m = m; TP.pressed(root.querySelectorAll('[data-m]'), 'data-m', m); ['hr', 'cooper', 'run', 'walk'].forEach(function (k) { show('tp-f-' + k, k === m); }); update(); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap'));
  $('tp-age').value = 35; $('tp-rhr').value = 60; $('tp-dist').value = 1.5; $('tp-rmin').value = 12; $('tp-rsec').value = 30; $('tp-wt').value = 170; $('tp-wmin').value = 14; $('tp-wsec').value = 0; $('tp-whr').value = 130; update();
})();
