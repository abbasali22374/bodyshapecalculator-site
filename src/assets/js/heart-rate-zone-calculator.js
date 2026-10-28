
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

/* Heart rate zone calculator (% max HR and Karvonen) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { method: 'karvonen' };
  var Z = [[50, 60, 'Zone 1', 'Very light', 'Warm-up, recovery, easy walking', '#78a0c8'], [60, 70, 'Zone 2', 'Light', 'Base endurance; easy conversation; most fat used for fuel', '#8cc878'],
           [70, 80, 'Zone 3', 'Moderate', 'Aerobic fitness; talking in short sentences', '#e8c97a'], [80, 90, 'Zone 4', 'Hard', 'Threshold work; a few words at a time', '#d6a064'], [90, 100, 'Zone 5', 'Maximum', 'Short intervals; no talking', '#d67864']];
  function update() {
    var a = TP.num($('tp-age')), rhr = TP.num($('tp-rhr')), mx = TP.num($('tp-max')), err = $('tp-err'), msg = '';
    if (!isFinite(mx) && !(a >= 10 && a <= 100)) msg = 'Enter your age (or a measured maximum heart rate).';
    else if (state.method === 'karvonen' && !(rhr >= 30 && rhr <= 110)) msg = 'Enter your resting heart rate (30–110 bpm), or switch to % of max.';
    err.hidden = !msg; err.textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var M = isFinite(mx) && mx > 100 ? mx : 208 - 0.7 * a, R = state.method === 'karvonen' ? rhr : 0;
    function at(p) { return Math.round(R + (M - R) * p / 100); }
    $('tp-big').textContent = Math.round(M) + ' bpm';
    $('tp-rows').innerHTML = Z.map(function (z) { var lo = at(z[0]), hi = at(z[1]); return '<tr><th scope="row"><span class="tp-dot" style="background:' + z[5] + ';margin-right:8px"></span>' + z[2] + ' · ' + z[3] + '</th><td><b style="color:var(--cr)">' + lo + '–' + hi + '</b> bpm</td><td>' + z[0] + '–' + z[1] + '%</td><td>' + z[4] + '</td></tr>'; }).join('');
    $('tp-line').innerHTML = (state.method === 'karvonen' ? 'Karvonen (heart rate reserve) zones use your resting heart rate of <b>' + R + ' bpm</b> and a maximum of <b>' + Math.round(M) + ' bpm</b>; they are usually more accurate for fit people.' : 'Zones as a percentage of a maximum heart rate of <b>' + Math.round(M) + ' bpm</b>.') + (isFinite(mx) && mx > 100 ? '' : ' Maximum estimated with the Tanaka formula (208 − 0.7 × age).') + ' Zone 2: <b>' + at(60) + '–' + at(70) + ' bpm</b>.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = 'Zone 2 <b>' + at(60) + '–' + at(70) + '</b> bpm';
  }
  TP.seg(root, 'data-m', function (m) { state.method = m; TP.pressed(root.querySelectorAll('[data-m]'), 'data-m', m); $('tp-rhr-row').hidden = m !== 'karvonen'; update(); });
  root.addEventListener('input', update); TP.hdr(root.closest('.tp-wrap')); $('tp-age').value = 35; $('tp-rhr').value = 62; update();
})();
