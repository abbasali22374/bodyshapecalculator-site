
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

/* FFMI Calculator — fat-free mass index, normalized FFMI, muscle potential (runs in the browser) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool');
  if (!root) return;
  var CAT = { m: [[17, 'Below average', 'c1'], [20, 'Average', 'c3'], [22, 'Trained', 'c2'], [23.5, 'Very muscular', 'c4'], [25, 'Elite natural', 'c4'], [99, 'Rarely natural', 'c5']],
              f: [[14.5, 'Below average', 'c1'], [17, 'Average', 'c3'], [18.5, 'Trained', 'c2'], [20, 'Very muscular', 'c4'], [21.5, 'Elite natural', 'c4'], [99, 'Rarely natural', 'c5']] };
  var LIM = { m: 25, f: 21.5 }, RANGE = { m: [15, 27], f: [12, 23] };
  var $ = function (id) { return document.getElementById(id); };
  var state = { sex: 'm', unit: 'us', bfm: 'known' };
  var els = { ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'), wt: $('tp-wt'), wtU: $('tp-wt-u'), bf: $('tp-bf'), bfRow: $('tp-bf-row'),
    navy: $('tp-navy'), neck: $('tp-neck'), waist: $('tp-waist'), hip: $('tp-hip'), hipRow: $('tp-hip-row'), lu: root.querySelectorAll('.tp-lu'),
    err: $('tp-err'), out: $('tp-out'), ffmi: $('tp-ffmi'), cat: $('tp-cat'), marker: $('tp-marker'), raw: $('tp-raw'), lean: $('tp-lean'), fat: $('tp-fat'), bfo: $('tp-bfo'),
    pot: $('tp-pot'), line: $('tp-line'), mobile: $('tp-mstrip'), ticks: $('tp-ticks') };
  function wOut(kg) { return state.unit === 'us' ? Math.round(kg / TP.LB) + ' lb' : TP.r1(kg).toFixed(1) + ' kg'; }
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function navy(sex, h, neck, waist, hip) {
    if (sex === 'm') return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
    return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
  }
  function cat(sex, v) { var t = CAT[sex]; for (var i = 0; i < t.length; i++) if (v < t[i][0]) return t[i]; return t[t.length - 1]; }
  function ticks() {
    var r = RANGE[state.sex], html = '';
    for (var v = r[0]; v <= r[1]; v += 2) html += '<span style="left:' + ((v - r[0]) / (r[1] - r[0]) * 100) + '%">' + v + '</span>';
    els.ticks.innerHTML = html;
    var bands = root.querySelectorAll('.tp-bands i'), t = CAT[state.sex], prev = r[0];
    t.forEach(function (c, i) { var end = Math.min(c[0], r[1]); bands[i].style.width = ((end - prev) / (r[1] - r[0]) * 100) + '%'; prev = end; });
  }
  function update() {
    var sex = state.sex, h = readH(), w = TP.num(els.wt) * (state.unit === 'us' ? TP.LB : 1), bf, msg = '';
    var k = state.unit === 'us' ? TP.IN : 1;
    if (!(h >= 120 && h <= 230)) msg = 'Enter your height: 4 ft to 7 ft 6 in (120–230 cm).';
    else if (!(w >= 30 && w <= 250)) msg = 'Enter your weight: 66–550 lb (30–250 kg).';
    else if (state.bfm === 'known') { bf = TP.num(els.bf); if (!(bf >= 3 && bf <= 60)) msg = 'Enter your body fat percentage (3–60%), or switch to "Estimate it".'; }
    else {
      var n = TP.num(els.neck) * k, wa = TP.num(els.waist) * k, hp = TP.num(els.hip) * k;
      if (!(n > 20 && wa > 40) || (sex === 'f' && !(hp > 50))) msg = 'Enter neck and waist' + (sex === 'f' ? ' and hips' : '') + ' to estimate body fat.';
      else { bf = navy(sex, h, n, wa, hp); if (!(bf >= 3 && bf <= 60)) msg = 'Those measurements give an unlikely body fat. Check the units and where you measured.'; }
    }
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }
    var m = h / 100, lean = w * (1 - bf / 100), raw = lean / (m * m), norm = raw + 6.1 * (1.8 - m), c = cat(sex, norm), r = RANGE[sex];
    els.ffmi.textContent = norm.toFixed(1); els.cat.textContent = c[1]; els.cat.className = 'tp-pill tp-' + c[2];
    els.marker.style.left = Math.min(99, Math.max(1, (norm - r[0]) / (r[1] - r[0]) * 100)) + '%';
    els.raw.textContent = raw.toFixed(1); els.lean.textContent = wOut(lean); els.fat.textContent = wOut(w - lean); els.bfo.textContent = bf.toFixed(1) + '%';
    var leanMax = (LIM[sex] - 6.1 * (1.8 - m)) * m * m, bfT = sex === 'm' ? 10 : 18, wMax = leanMax / (1 - bfT / 100);
    els.pot.textContent = wOut(wMax) + ' at ' + bfT + '%';
    var gap = leanMax - lean;
    els.line.innerHTML = 'Your normalized FFMI is <b>' + norm.toFixed(1) + '</b> (' + c[1].toLowerCase() + '). You carry <b>' + wOut(lean) + '</b> of lean mass at ' + bf.toFixed(1) + '% body fat. ' +
      (gap > 0 ? 'At a natural-limit FFMI of ' + LIM[sex] + ' you would carry about <b>' + wOut(leanMax) + '</b> of lean mass, about ' + wOut(gap) + ' more than now; at ' + bfT + '% body fat that is about ' + wOut(wMax) + '.' :
        'You are at or above the FFMI of ' + LIM[sex] + ' that most drug-free lifters reach as a ceiling.') +
      (state.bfm === 'navy' ? ' Body fat estimated with the U.S. Navy tape method.' : '');
    if (els.mobile) els.mobile.innerHTML = 'FFMI <b>' + norm.toFixed(1) + '</b> · ' + c[1];
  }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); els.hipRow.hidden = s !== 'f'; ticks(); update(); });
  TP.seg(root, 'data-bfm', function (b) { state.bfm = b; TP.pressed(root.querySelectorAll('[data-bfm]'), 'data-bfm', b); els.bfRow.hidden = b !== 'known'; els.navy.hidden = b === 'known'; update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return;
    var h = readH(), w = TP.num(els.wt) * (state.unit === 'us' ? TP.LB : 1), k0 = state.unit === 'us' ? TP.IN : 1;
    var circ = [els.neck, els.waist, els.hip].map(function (e) { return TP.num(e) * k0; });
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u);
    els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us'; els.wtU.textContent = u === 'us' ? 'lb' : 'kg';
    Array.prototype.forEach.call(els.lu, function (n) { n.textContent = u === 'us' ? 'in' : 'cm'; });
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = Math.round(t - f * 12); } else els.cm.value = Math.round(h); }
    if (isFinite(w)) els.wt.value = u === 'us' ? Math.round(w / TP.LB) : TP.r1(w);
    [els.neck, els.waist, els.hip].forEach(function (e, i) { if (isFinite(circ[i])) e.value = u === 'us' ? TP.r1(circ[i] / TP.IN) : TP.r1(circ[i]); });
    update();
  });
  root.addEventListener('input', update);
  TP.hdr(root.closest('.tp-wrap'));
  els.ft.value = 5; els.inch.value = 10; els.wt.value = 180; els.bf.value = 15; ticks(); update();
})();
