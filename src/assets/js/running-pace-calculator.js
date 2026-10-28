
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

/* Running pace calculator: pace, time or distance + splits + race predictions */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); }, state = { solve: 'pace', unit: 'mi' };
  var MI = 1.609344;
  function hms(s) { if (!isFinite(s) || s <= 0) return '—'; s = Math.round(s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x; }
  function readT(p) { return (TP.num($(p + 'h')) || 0) * 3600 + (TP.num($(p + 'm')) || 0) * 60 + (TP.num($(p + 's')) || 0); }
  function setT(p, s) { s = Math.round(s); $(p + 'h').value = Math.floor(s / 3600); $(p + 'm').value = Math.floor(s % 3600 / 60); $(p + 's').value = s % 60; }
  function update(e) {
    if (e && e.target && e.target.id === 'tp-race') { var v = $('tp-race').value; if (v) { var k = +v; $('tp-dist').value = TP.r1(state.unit === 'mi' ? k / MI * 100 / 100 : k).toString(); } }
    var dU = TP.num($('tp-dist')), dKm = state.unit === 'mi' ? dU * MI : dU, T = readT('tp-t'), P = readT('tp-p'), msg = '';
    if (state.solve === 'pace') { if (!(dKm > 0 && T > 0)) msg = 'Enter a distance and a time.'; else { P = T / dU; setT('tp-p', P); } }
    else if (state.solve === 'time') { if (!(dKm > 0 && P > 0)) msg = 'Enter a distance and a pace.'; else { T = P * dU; setT('tp-t', T); } }
    else { if (!(T > 0 && P > 0)) msg = 'Enter a time and a pace.'; else { dU = T / P; dKm = state.unit === 'mi' ? dU * MI : dU; $('tp-dist').value = TP.r1(dU * 100 / 100); } }
    $('tp-err').hidden = !msg; $('tp-err').textContent = msg; $('tp-out').classList.toggle('tp-dim', !!msg); if (msg) return;
    var paceKm = T / dKm, paceMi = paceKm * MI, kmh = dKm / (T / 3600);
    $('tp-big').textContent = hms(state.unit === 'mi' ? paceMi : paceKm) + ' /' + state.unit;
    $('tp-c1').textContent = hms(paceMi) + ' /mi'; $('tp-c2').textContent = hms(paceKm) + ' /km'; $('tp-c3').textContent = TP.r1(kmh) + ' km/h · ' + TP.r1(kmh / MI) + ' mph'; $('tp-c4').textContent = hms(T);
    var races = [['1 mile', MI], ['5K', 5], ['10K', 10], ['Half marathon', 21.0975], ['Marathon', 42.195]];
    $('tp-pred').innerHTML = races.map(function (r) { var t2 = T * Math.pow(r[1] / dKm, 1.06); return '<tr><th scope="row">' + r[0] + '</th><td>' + hms(t2) + '</td><td>' + hms(t2 / r[1]) + ' /km · ' + hms(t2 / r[1] * MI) + ' /mi</td></tr>'; }).join('');
    var n = Math.min(60, Math.ceil(dU)), sp = '';
    for (var i = 1; i <= n; i++) { var dd = Math.min(i, dU); sp += '<tr><th scope="row">' + (i < dU ? i : TP.r1(dU)) + ' ' + state.unit + '</th><td>' + hms(dd * (state.unit === 'mi' ? paceMi : paceKm)) + '</td></tr>'; }
    $('tp-splits').innerHTML = sp;
    $('tp-line').innerHTML = 'Pace <b>' + hms(paceMi) + ' per mile</b> (' + hms(paceKm) + ' per km) for ' + TP.r1(dU) + ' ' + state.unit + ' in ' + hms(T) + '. Race predictions use Riegel&rsquo;s formula (T2 = T1 × (D2/D1)<sup>1.06</sup>) and assume similar training for each distance.';
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + hms(state.unit === 'mi' ? paceMi : paceKm) + '</b> /' + state.unit;
  }
  TP.seg(root, 'data-solve', function (s) { state.solve = s; TP.pressed(root.querySelectorAll('[data-solve]'), 'data-solve', s); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return; var d = TP.num($('tp-dist')), P = readT('tp-p');
    if (isFinite(d)) $('tp-dist').value = TP.r1(u === 'km' ? d * MI : d / MI);
    if (P > 0) setT('tp-p', u === 'km' ? P / MI : P * MI);
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); Array.prototype.forEach.call(root.querySelectorAll('.tp-du'), function (n) { n.textContent = u; }); update();
  });
  root.addEventListener('input', update); root.addEventListener('change', update); TP.hdr(root.closest('.tp-wrap'));
  $('tp-dist').value = 3.1; setT('tp-t', 1680); update();
})();
