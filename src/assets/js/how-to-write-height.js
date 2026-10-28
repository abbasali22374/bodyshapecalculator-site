
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

/* How to Write Height — formatter (runs in the browser) */
(function () {
  'use strict';
  var root = document.getElementById('tp-tool'); if (!root) return;
  var $ = function (id) { return document.getElementById(id); };
  var state = { unit: 'us' };
  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'];
  function readH() { return state.unit === 'us' ? (TP.num($('tp-ft')) * 12 + (TP.num($('tp-in')) || 0)) * TP.IN : TP.num($('tp-cm')); }
  function update() {
    var cm = readH(), err = $('tp-err'), out = $('tp-list');
    if (!(cm >= 30 && cm <= 275)) { err.hidden = false; err.textContent = 'Enter a height between 1 ft and 9 ft (30–275 cm).'; out.innerHTML = ''; return; }
    err.hidden = true;
    var tin = cm / 2.54, f = Math.floor(tin / 12), i = Math.round(tin - f * 12); if (i === 12) { f++; i = 0; }
    var ih = Math.round((tin - f * 12) * 2) / 2; if (ih >= 12) ih = 0;
    var rows = [
      ['Everyday writing', f + ' ft ' + i + ' in'],
      ['Feet and inches symbols', f + '′' + i + '″'],
      ['Typewriter style', f + '\'' + i + '"'],
      ['Spelled out', f + (f === 1 ? ' foot ' : ' feet ') + i + (i === 1 ? ' inch' : ' inches')],
      ['Before a noun (AP style)', 'a ' + f + '-foot-' + i + ' player'],
      ['Words (formal)', WORDS[f] ? WORDS[f].charAt(0).toUpperCase() + WORDS[f].slice(1) + ' feet ' + (WORDS[i] || i) + ' inches' : f + ' feet ' + i + ' inches'],
      ['Total inches', Math.round(tin) + ' in'],
      ['Centimeters', Math.round(cm) + ' cm'],
      ['Meters', (cm / 100).toFixed(2) + ' m'],
      ['Medical / forms (cm, 1 decimal)', (Math.round(cm * 10) / 10).toFixed(1) + ' cm'],
      ['Both systems', f + ' ft ' + i + ' in (' + Math.round(cm) + ' cm)']
    ];
    out.innerHTML = rows.map(function (r, k) { return '<li><span>' + r[0] + '</span><b>' + r[1].replace(/</g, '&lt;') + '</b><button type="button" class="wh-copy" data-i="' + k + '">Copy</button></li>'; }).join('');
    out.onclick = function (e) {
      var b = e.target.closest('.wh-copy'); if (!b) return;
      var txt = rows[+b.getAttribute('data-i')][1];
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1200); });
    };
    if ($('tp-mstrip')) $('tp-mstrip').innerHTML = '<b>' + f + '′' + i + '″</b> = ' + Math.round(cm) + ' cm';
  }
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return; var h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u); $('tp-h-us').hidden = u !== 'us'; $('tp-h-m').hidden = u === 'us';
    if (isFinite(h)) { if (u === 'us') { var t = h / 2.54, f = Math.floor(t / 12); $('tp-ft').value = f; $('tp-in').value = Math.round(t - f * 12); } else $('tp-cm').value = Math.round(h); }
    update();
  });
  root.addEventListener('input', update);
  TP.hdr(root.closest('.tp-wrap'));
  $('tp-ft').value = 5; $('tp-in').value = 10; update();
})();
