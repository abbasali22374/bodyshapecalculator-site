
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

/* Average Height by Country — searchable table + your height vs a country */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var DATA = JSON.parse($('tp-data').textContent), SD = { m: 7.1, f: 6.6 };
  var state = { sex: 'm', unit: 'us' };
  var els = { ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'), country: $('tp-country'), q: $('tp-q'),
    pct: $('tp-pct'), cat: $('tp-cat'), avg: $('tp-avg'), more: $('tp-more'), line: $('tp-line'), body: $('tp-tbody'), cap: $('tp-tcap'), err: $('tp-err'), out: $('tp-out'), mobile: $('tp-mstrip') };
  function ftin(cm) { var t = cm / 2.54, f = Math.floor(t / 12), i = Math.round((t - f * 12) * 10) / 10; if (i >= 12) { f++; i = 0; } return f + ' ft ' + i + ' in'; }
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function the(n) { return /^(United States|United Kingdom|United Arab Emirates|Netherlands|Philippines|Bahamas|Gambia|Czech Republic|Republic of the Congo|Central African Republic|Dominican Republic|Maldives|Marshall Islands|Solomon Islands|Cook Islands|DR Congo)$/.test(n) ? 'the ' + n : n; }
  function list() { return DATA[state.sex]; }
  function fillCountries() {
    var cur = els.country.value || 'United States';
    els.country.innerHTML = list().map(function (r) { return '<option' + (r[0] === cur ? ' selected' : '') + '>' + r[0] + '</option>'; }).join('');
    if (!list().some(function (r) { return r[0] === cur; })) els.country.value = 'United States';
  }
  function table() {
    var q = (els.q.value || '').toLowerCase(), rows = list(), h = readH(), html = '';
    rows.forEach(function (r, i) {
      if (q && r[0].toLowerCase().indexOf(q) < 0) return;
      var you = isFinite(h) ? (h >= r[1] ? '<span class="tp-pill tp-c3">taller</span>' : '<span class="tp-pill tp-c1">shorter</span>') : '';
      html += '<tr><th scope="row">' + (i + 1) + '. ' + r[0] + '</th><td>' + r[1].toFixed(1) + ' cm</td><td>' + ftin(r[1]) + '</td><td>' + you + '</td></tr>';
    });
    els.body.innerHTML = html || '<tr><td colspan="4">No country matches “' + q.replace(/</g, '') + '”</td></tr>';
    els.cap.textContent = 'Average height of 19-year-old ' + (state.sex === 'm' ? 'men' : 'women') + ' by country (' + rows.length + ' countries)';
  }
  function update() {
    var h = readH(), msg = '';
    if (!(h >= 120 && h <= 230)) msg = 'Enter your height (4 ft to 7 ft 6 in, or 120–230 cm) to compare.';
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    table(); if (msg) return;
    var row = list().filter(function (r) { return r[0] === els.country.value; })[0] || list()[0];
    var p = TP.Phi((h - row[1]) / SD[state.sex]), n = list().filter(function (r) { return h > r[1]; }).length;
    els.pct.textContent = TP.pctText(p); els.avg.textContent = row[1].toFixed(1) + ' cm';
    els.more.textContent = n + ' of ' + list().length;
    var d = h - row[1];
    els.cat.textContent = Math.abs(d) < 2 ? 'About average' : (d > 0 ? 'Taller than average' : 'Shorter than average'); els.cat.className = 'tp-pill tp-' + (Math.abs(d) < 2 ? 'c3' : d > 0 ? 'c2' : 'c1');
    els.line.innerHTML = 'At <b>' + ftin(h) + ' (' + h.toFixed(1) + ' cm)</b> you are ' + (Math.abs(d) < 0.5 ? 'right at' : '<b>' + Math.abs(d).toFixed(1) + ' cm (' + (Math.abs(d) / 2.54).toFixed(1) + ' in) ' + (d > 0 ? 'taller' : 'shorter') + '</b> than') + ' the average young ' + (state.sex === 'm' ? 'man' : 'woman') + ' in ' + the(row[0]) + ', taller than about <b>' + Math.round(p * 100) + '%</b> of them, and taller than the average in <b>' + n + '</b> of ' + list().length + ' countries listed.';
    if (els.mobile) els.mobile.innerHTML = '<b>' + TP.pctText(p) + '</b> in ' + row[0];
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); fillCountries(); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return; var h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us';
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = Math.round(t - f * 12); } else els.cm.value = Math.round(h); }
    update();
  });
  root.addEventListener('input', update); root.addEventListener('change', update);
  TP.hdr(root.closest('.tp-wrap'));
  els.ft.value = 5; els.inch.value = 10; fillCountries(); update();
})();
