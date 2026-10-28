/* ==========================================================================
   Body Visualizer — core engine (geometry, renderer, metrics)
   bodyshapecalculator.net
   Everything runs in the browser. No network calls, nothing is stored.
   ========================================================================== */
(function (root) {
  'use strict';

  var PI = Math.PI;
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function sq(x) { return x * x; }

  /* ---------- Sex factor: 0 = female, 1 = male, 0.5 = neutral ------------ */
  var SEX = { f: 0, m: 1, n: 0.5 };

  /* ---------- Measurement keys & absolute ranges (metric) ---------------- */
  var MEAS = ['bust', 'waist', 'hips', 'shoulders', 'inseam', 'neck', 'arm', 'thigh'];
  var RANGES = {
    height:    [120, 230],
    weight:    [30, 250],
    bust:      [60, 160],
    waist:     [45, 160],
    hips:      [60, 170],
    shoulders: [30, 65],
    inseam:    [50, 110],
    neck:      [25, 55],
    arm:       [18, 50],
    thigh:     [35, 90]
  };
  var MIN_BMI = 16, MAX_BMI = 60;

  function rangeFor(key, body) {
    var r = RANGES[key];
    var H = body ? body.height : 170;
    if (key === 'weight') {
      var h2 = sq(H / 100);
      return [Math.max(r[0], Math.ceil(MIN_BMI * h2)), Math.min(r[1], Math.floor(MAX_BMI * h2))];
    }
    if (key === 'inseam') {
      return [Math.max(r[0], Math.round(0.38 * H)), Math.min(r[1], Math.round(0.56 * H))];
    }
    return r;
  }

  /* ---------- "Typical" measurements for a given sex / height / weight --- */
  //            female  male   bmiExp(f)  bmiExp(m)  heightExp
  var REF = {
    bust:      [88,   98,    0.42, 0.42, 0.60],
    waist:     [74,   82,    0.65, 0.70, 0.60],
    hips:      [96,   97.5,  0.40, 0.36, 0.60],
    shoulders: [38.5, 48,  0.12, 0.12, 0.90],
    neck:      [31,   39,    0.32, 0.34, 0.50],
    arm:       [26,   32,    0.60, 0.60, 0.60],
    thigh:     [55,   57,    0.50, 0.50, 0.60]
  };
  function refH(s) { return lerp(165, 178, s); }
  function refBMI(s) { return lerp(22, 23, s); }

  function typical(key, s, H, W) {
    if (key === 'inseam') return 0.452 * H;
    var r = REF[key];
    var bmi = clamp(W / sq(H / 100), 14, 65);
    return lerp(r[0], r[1], s) * Math.pow(H / refH(s), r[4]) * Math.pow(bmi / refBMI(s), lerp(r[2], r[3], s));
  }

  var DEFAULT_HW = { f: [165, 60], m: [178, 76], n: [171, 68] };

  function makeBody(sex, H, W) {
    var hw = DEFAULT_HW[sex] || DEFAULT_HW.f;
    H = H || hw[0]; W = W || hw[1];
    var s = SEX[sex];
    var b = { sex: sex, height: H, weight: W };
    MEAS.forEach(function (k) { b[k] = Math.round(typical(k, s, H, W) * 2) / 2; });
    return b;
  }

  function cloneBody(b) {
    var c = {};
    for (var k in b) { if (Object.prototype.hasOwnProperty.call(b, k)) c[k] = b[k]; }
    return c;
  }

  // Keep the user's own proportions when height / weight change.
  function rebalance(body, newH, newW) {
    var s = SEX[body.sex];
    MEAS.forEach(function (k) {
      var ratio = body[k] / typical(k, s, body.height, body.weight);
      body[k] = typical(k, s, newH, newW) * ratio;
    });
    body.height = newH; body.weight = newW;
    sanitize(body);
    return body;
  }

  function sanitize(b) {
    b.height = clamp(b.height, RANGES.height[0], RANGES.height[1]);
    var wr = rangeFor('weight', b);
    b.weight = clamp(b.weight, wr[0], wr[1]);
    MEAS.forEach(function (k) {
      var r = rangeFor(k, b);
      b[k] = clamp(b[k], r[0], r[1]);
    });
    return b;
  }

  /* ---------- Monotone cubic (PCHIP) spline ------------------------------ */
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }
  function endSlope(h0, h1, d0, d1) {
    var s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
    if (sign(s) !== sign(d0)) s = 0;
    else if (sign(d0) !== sign(d1) && Math.abs(s) > 3 * Math.abs(d0)) s = 3 * d0;
    return s;
  }
  function Spline(xs, ys) {
    var n = xs.length, h = [], del = [], d = [], i;
    for (i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; del[i] = (ys[i + 1] - ys[i]) / h[i]; }
    if (n === 2) { d[0] = d[1] = del[0]; }
    else {
      for (i = 1; i < n - 1; i++) {
        if (del[i - 1] * del[i] <= 0) d[i] = 0;
        else {
          var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
          d[i] = (w1 + w2) / (w1 / del[i - 1] + w2 / del[i]);
        }
      }
      d[0] = endSlope(h[0], h[1], del[0], del[1]);
      d[n - 1] = endSlope(h[n - 2], h[n - 3], del[n - 2], del[n - 3]);
    }
    this.xs = xs; this.ys = ys; this.h = h; this.d = d; this.n = n; this.i = 0;
  }
  Spline.prototype.seg = function (x) {
    var xs = this.xs, n = this.n, i = this.i;
    if (i > n - 2) i = n - 2;
    if (x < xs[i] || x > xs[i + 1]) {
      var lo = 0, hi = n - 2;
      while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (xs[mid] <= x) lo = mid; else hi = mid - 1; }
      i = lo;
    }
    this.i = i;
    return i;
  };
  Spline.prototype.at = function (x) {
    x = clamp(x, this.xs[0], this.xs[this.n - 1]);
    var i = this.seg(x), h = this.h[i], t = (x - this.xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * this.ys[i] + (t3 - 2 * t2 + t) * h * this.d[i] +
           (-2 * t3 + 3 * t2) * this.ys[i + 1] + (t3 - t2) * h * this.d[i + 1];
  };
  Spline.prototype.diff = function (x) {
    x = clamp(x, this.xs[0], this.xs[this.n - 1]);
    var i = this.seg(x), h = this.h[i], t = (x - this.xs[i]) / h, t2 = t * t;
    return ((6 * t2 - 6 * t) * this.ys[i] + (3 * t2 - 4 * t + 1) * h * this.d[i] +
            (-6 * t2 + 6 * t) * this.ys[i + 1] + (3 * t2 - 2 * t) * h * this.d[i + 1]) / h;
  };

  /* ---------- Ellipse helpers ------------------------------------------- */
  // semi-axes (a = lateral, b = depth = k*a) of an ellipse with perimeter C
  function ellipseAB(C, k) {
    var f = PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k)));
    var a = C / f;
    return { a: a, b: a * k };
  }

  // Resample a PCHIP curve on a fine grid and low-pass it with a Gaussian so that
  // shading stays smooth (no creases at measurement stations).
  function Dense(y0, y1, ys, vals, sigma) {
    var raw = new Spline(ys, vals);
    var step = 0.5, n = Math.max(2, Math.ceil((y1 - y0) / step) + 1);
    step = (y1 - y0) / (n - 1);
    var arr = new Float32Array(n), i, j;
    for (i = 0; i < n; i++) arr[i] = raw.at(y0 + i * step);
    if (sigma > 0.01) {
      var r = Math.ceil(3 * sigma / step), ker = [], sum = 0;
      for (j = -r; j <= r; j++) { var w = Math.exp(-0.5 * sq(j * step / sigma)); ker.push(w); sum += w; }
      var sm = new Float32Array(n);
      for (i = 0; i < n; i++) {
        var acc = 0;
        for (j = -r; j <= r; j++) { var k = i + j; if (k < 0) k = 0; else if (k > n - 1) k = n - 1; acc += arr[k] * ker[j + r]; }
        sm[i] = acc / sum;
      }
      // keep the true end shape (rounded caps) — only smooth the interior
      var edge = 2.5 * sigma;
      for (i = 0; i < n; i++) {
        var dist = Math.min(i, n - 1 - i) * step, wgt = smooth(dist / edge);
        sm[i] = arr[i] * (1 - wgt) + sm[i] * wgt;
      }
      arr = sm;
    }
    var d = new Float32Array(n);
    for (i = 0; i < n; i++) {
      var a0 = arr[Math.max(0, i - 1)], a1 = arr[Math.min(n - 1, i + 1)];
      d[i] = (a1 - a0) / ((Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * step);
    }
    this.y0 = y0; this.step = step; this.n = n; this.arr = arr; this.d = d;
  }
  Dense.prototype.at = function (y) {
    var f = (y - this.y0) / this.step; if (f < 0) f = 0; else if (f > this.n - 1) f = this.n - 1;
    var i = f | 0; if (i >= this.n - 1) return this.arr[this.n - 1];
    var t = f - i; return this.arr[i] * (1 - t) + this.arr[i + 1] * t;
  };
  Dense.prototype.diff = function (y) {
    var f = (y - this.y0) / this.step; if (f < 0) f = 0; else if (f > this.n - 1) f = this.n - 1;
    var i = f | 0; if (i >= this.n - 1) return this.d[this.n - 1];
    var t = f - i; return this.d[i] * (1 - t) + this.d[i + 1] * t;
  };

  function makePart(name, st, side, sigma, fadeLo, fadeHi) {
    // st: array of {y, cx, cz, a, b}, ascending in y
    var ys = [], cx = [], cz = [], a = [], b = [], i, last = -1e9;
    for (i = 0; i < st.length; i++) {
      var y = st[i].y; if (y <= last + 1e-3) y = last + 1e-3; last = y;
      ys.push(y); cx.push(st[i].cx || 0); cz.push(st[i].cz || 0);
      a.push(Math.max(0.35, st[i].a)); b.push(Math.max(0.35, st[i].b));
    }
    var y0 = ys[0], y1 = ys[ys.length - 1], sg = sigma == null ? 1.2 : sigma;
    return {
      name: name, side: side || 1, y0: y0, y1: y1, fadeLo: fadeLo || 0, fadeHi: fadeHi || 0,
      cx: new Dense(y0, y1, ys, cx, sg), cz: new Dense(y0, y1, ys, cz, sg),
      a: new Dense(y0, y1, ys, a, sg), b: new Dense(y0, y1, ys, b, sg)
    };
  }

  /* ---------- Body -> geometry ------------------------------------------ */
  // Every sex-dependent number is a lerp between a female value (s = 0) and a
  // male value (s = 1); the neutral model sits halfway.
  function buildModel(p) {
    var s = SEX[p.sex];
    var H = p.height;
    var bmi = p.weight / sq(H / 100);
    var yC = clamp(p.inseam, 0.38 * H, 0.56 * H);         // crotch height
    var yS = H * lerp(0.812, 0.822, s);                     // shoulder line
    var tl = yS - yC;
    function yT(t) { return yC + t * tl; }

    // fat distribution: men carry it on the belly, women on hips / thighs
    var belly = Math.min(1, clamp((p.waist / p.hips - 0.78) * 4, 0, 1) *
                (0.55 + 0.45 * clamp((bmi - 19) / 10, 0, 1)) * lerp(0.85, 1.2, s));

    /* --- chest: rib cage + breast / pectoral lobes ---------------------- */
    var dC = lerp(p.bust * 0.095, p.bust * 0.03, s);        // bust minus rib girth
    var Cr = p.bust - dC * lerp(0.55, 1.0, s);
    var kB = lerp(0.72, 0.61, s);
    var kW = 0.72 + 0.14 * belly;
    var kH = lerp(0.64, 0.76, s) + 0.06 * clamp((bmi - 22) / 12, -0.5, 1);

    var Eh = ellipseAB(p.hips, kH);
    var Ew = ellipseAB(p.waist, kW);
    var Eb = ellipseAB(Cr, kB);
    var Eu = ellipseAB(Cr * lerp(0.965, 0.99, s), kB - 0.02);
    var Ec = ellipseAB(Cr * lerp(0.95, 0.985, s), kB - 0.05);
    var hhC = p.waist + (p.hips - p.waist) * 0.45;
    var Ehh = ellipseAB(hhC, (kW + kH) / 2);
    var Eth = ellipseAB(p.thigh, 0.97);
    var Enk = ellipseAB(p.neck, 0.98);
    var rA = p.arm / (2 * PI);

    /* --- torso -------------------------------------------------------- */
    var hipCz = -lerp(0.17, 0.08, s) * Eh.b;
    var waistCz = (0.02 + 0.14 * belly) * Ew.b;
    var xTop = Math.max(0.35 * Eth.a, Math.min(Eth.a * lerp(1.0, 1.1, s), Eh.a * 0.98 - Eth.a));
    var aBot = Math.min(Eh.a * 0.98, xTop + Eth.a);
    var bBot = Eth.b * 1.04, cBot = 0.4;
    var aSh = clamp(0.5 * p.shoulders - rA * 0.9, 0.75 * Eb.a, 1.10 * Eb.a);
    var tW = lerp(0.45, 0.41, s), tHip = lerp(0.145, 0.165, s), tBust = lerp(0.72, 0.735, s);
    var trapA = lerp(0.52, 0.22, s), trapB = lerp(0.86, 0.58, s);
    // breast (female) / pectoral (male) volume: a smooth shading bump on the chest
    // plus a matching forward profile in the side view
    var hF = clamp(0.44 * dC, 1.8, 5.2) * Math.pow(clamp((0.75 - s) / 0.75, 0, 1), 1.2);
    var hM = 1.0 * clamp((s - 0.25) / 0.75, 0, 1);
    var bumpH = hF + hM;
    var bustCz = lerp(0.03, 0.02, s) * Eb.b + 0.42 * hF;
    var bustB = Eb.b + 0.30 * hF;

    var torso = [
      { y: yC - 0.022 * H, a: aBot * 0.97, b: bBot * 0.90, cz: cBot },
      { y: yC - 0.004 * H, a: aBot, b: bBot, cz: cBot },
      { y: yC + (yT(tHip) - yC) * 0.48, a: lerp(aBot, Eh.a, 0.55), b: lerp(bBot, Eh.b, 0.42), cz: lerp(cBot, hipCz, 0.42) },
      { y: yT(tHip), a: Eh.a, b: Eh.b, cz: hipCz },
      { y: yT((tHip + tW) / 2 - 0.02), a: Ehh.a, b: Ehh.b, cz: lerp(hipCz, waistCz, 0.55) + 0.14 * belly * Ehh.b },
      { y: yT(tW), a: Ew.a, b: Ew.b, cz: waistCz },
      { y: yT((tW + tBust) / 2 + 0.03), a: Eu.a, b: Eu.b + 0.06 * hF, cz: 0.03 * Eu.b + 0.10 * hF },
      { y: yT(tBust), a: Eb.a, b: bustB, cz: bustCz },
      { y: yT(0.80), a: Eb.a * lerp(0.97, 1.05, s), b: Eb.b * 0.97, cz: bustCz * 0.6 },
      { y: yT(0.87), a: lerp(Ec.a, aSh, 0.45), b: Ec.b + 0.10 * hF, cz: lerp(0.05, 0.02, s) * Ec.b + 0.18 * hF },
      { y: yS - 0.016 * H, a: aSh * lerp(0.95, 1.0, s), b: 0.86 * Eb.b, cz: 0 },
      { y: yS, a: aSh * lerp(0.84, 0.92, s), b: 0.72 * Eb.b, cz: 0 },
      { y: yS + 0.010 * H, a: lerp(aSh, Enk.a, trapA), b: lerp(0.72 * Eb.b, Enk.b, trapA) * 1.05, cz: 0.2 },
      { y: yS + 0.024 * H, a: lerp(aSh, Enk.a, trapB), b: lerp(0.72 * Eb.b, Enk.b, trapB) * 1.05, cz: 0.4 },
      { y: yS + 0.036 * H, a: Enk.a * lerp(1.08, 1.42, s), b: Enk.b * lerp(1.08, 1.22, s), cz: 0.5 },
      { y: yS + 0.048 * H, a: Enk.a * 0.94, b: Enk.b * 0.94, cz: 0.6 }
    ];

    /* --- neck & head -------------------------------------------------- */
    var neck = [
      { y: 0.808 * H, a: Enk.a * 1.25, b: Enk.b * 1.25, cz: 0.3 },
      { y: 0.842 * H, a: Enk.a, b: Enk.b, cz: 0.6 },
      { y: 0.876 * H, a: Enk.a * 0.96, b: Enk.b * 0.96, cz: 1.0 },
      { y: 0.905 * H, a: Enk.a * 0.98, b: Enk.b * 0.98, cz: 1.2 }
    ];
    var hh = H * lerp(0.0640, 0.0660, s), hc = H - hh;
    var HA = H * lerp(0.0445, 0.0468, s), HB = H * 0.0585;
    var jaw = lerp(0.80, 0.94, s);
    var head = [];
    [-1, -0.965, -0.9, -0.78, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.78, 0.9, 0.965, 1].forEach(function (t) {
      var g = Math.sqrt(Math.max(0, 1 - t * t));
      var ga = g * (jaw + (1 - jaw) * smooth((t + 0.9) / 1.5));
      head.push({ y: hc + t * hh, a: Math.max(0.5, HA * ga), b: Math.max(0.5, HB * g), cz: 1.0 });
    });

    /* --- arms --------------------------------------------------------- */
    var xSh = Math.max(0.5 * p.shoulders - rA, 0.86 * Eb.a + 0.5 * rA);   // shoulder joint x
    var tanA = 0.10;                                     // slight outward hang
    var ySh0 = 0.80 * H;
    var fA = Math.pow(rA / lerp(4.3, 4.9, s), 0.5) * (H / 170) * lerp(1.0, 1.12, s);
    function armSt(y, rMul, isAbs, bMul) {
      var r = isAbs ? rMul * fA : rA * rMul;
      return { y: y, cx: xSh + (ySh0 - y) * tanA, a: r, b: r * (bMul || 1), cz: 0.3 };
    }
    function domeUp(y, r, bMul, up) {                   // rounded cap
      var out = [], h = r * 0.95;
      [28, 52, 70, 82, 90].forEach(function (deg) {
        var t = deg * PI / 180;
        out.push({ y: y + (up ? 1 : -1) * h * Math.sin(t), cx: 0, cz: 0.3, a: Math.max(0.18, r * Math.cos(t)), b: Math.max(0.18, r * bMul * Math.cos(t)) });
      });
      return out;
    }
    function armX(y) { return xSh + (ySh0 - y) * tanA; }
    var armBase = [
      armSt(0.410 * H, lerp(2.85, 3.10, s), true, 0.44),
      armSt(0.452 * H, lerp(3.25, 3.55, s), true, 0.44),
      armSt(0.487 * H, lerp(2.00, 2.25, s), true, 0.85),
      armSt(0.525 * H, lerp(2.35, 2.65, s), true, 0.90),
      armSt(0.590 * H, lerp(0.84, 0.92, s), false, 0.98),
      armSt(0.632 * H, lerp(0.77, 0.82, s), false, 0.95),
      armSt(0.690 * H, lerp(0.94, 1.02, s), false, 1.00),
      armSt(0.750 * H, lerp(1.04, 1.18, s), false, 1.02),
      armSt(0.782 * H, lerp(1.06, 1.24, s), false, 1.00),
      armSt(0.797 * H, lerp(1.00, 1.22, s), false, 0.98)
    ];
    var tipCap = domeUp(0.410 * H, lerp(2.3, 2.5, s) * fA, 0.44, false).map(function (q) { q.y = q.y - 1.2; q.cx = armX(q.y); return q; });
    var shCap = domeUp(0.797 * H, rA * lerp(1.00, 1.22, s), 0.98, true).map(function (q) { q.cx = armX(q.y); return q; });
    var armStations = tipCap.slice().reverse().concat(armBase, shCap);

    /* --- legs --------------------------------------------------------- */
    var ankleA = 3.5 * Math.pow(Eth.a / 8.8, 0.45) * Math.pow(H / 165, 0.6) * lerp(0.95, 1.10, s);
    var footL = H * lerp(0.148, 0.158, s), footW = H * lerp(0.028, 0.031, s);
    function legSt(f, aF, aM, bF, bM, cz, cxMul) {
      return { y: f * yC, cx: xTop * cxMul, cz: cz, a: Eth.a * lerp(aF, aM, s), b: Eth.b * lerp(bF, bM, s) };
    }
    var leg = [
      { y: 0, cx: xTop * 0.88, cz: 0.30 * footL, a: footW * 0.92, b: 0.50 * footL },
      { y: 0.030 * yC, cx: xTop * 0.88, cz: 0.25 * footL, a: footW, b: 0.44 * footL },
      { y: 0.075 * yC, cx: xTop * 0.88, cz: -0.4, a: ankleA * 1.05, b: ankleA * 1.15 },
      { y: 0.11 * yC, cx: xTop * 0.88, cz: -0.7, a: ankleA, b: ankleA * 1.12 },
      legSt(0.24, 0.47, 0.52, 0.50, 0.56, -0.9, 0.89),
      legSt(0.40, 0.60, 0.70, 0.66, 0.78, -0.9, 0.89 + 0.05 * s),
      legSt(0.50, 0.58, 0.64, 0.64, 0.70, -0.3, 0.90 + 0.05 * s),
      legSt(0.62, 0.62, 0.70, 0.66, 0.74, 1.0, 0.90 + 0.06 * s),
      legSt(0.78, 0.86, 0.90, 0.88, 0.95, 0.8, 0.95),
      legSt(0.90, 0.97, 0.98, 0.97, 1.00, 0.7, 0.98),
      legSt(1.00, 1.00, 1.00, 1.00, 1.00, 0.5, 1.00)
    ];

    var torsoPart = makePart('torso', torso, 1, 2.2, 4.5, 3.0);
    torsoPart.bumps = [];
    if (hF > 0.05) {
      [-1, 1].forEach(function (sg) {
        torsoPart.bumps.push({ x: sg * Eb.a * 0.50, y: yT(tBust) - 0.6, sx: 3.5 + 0.10 * dC, sy: 3.6 + 0.12 * dC, h: hF });
      });
    }
    if (hM > 0.05) {
      [-1, 1].forEach(function (sg) {
        torsoPart.bumps.push({ x: sg * Eb.a * 0.50, y: yT(tBust) + 1.2, sx: 6.6, sy: 4.3, h: hM * 1.5 });
      });
    }
    var gH = lerp(2.6, 1.0, s) * (0.8 + 0.4 * clamp((bmi - 18) / 10, 0, 1));
    [-1, 1].forEach(function (sg) {
      torsoPart.bumps.push({ x: sg * Eh.a * 0.46, y: yT(tHip) - 1.8, sx: 4.6 + 0.05 * p.hips * 0.1, sy: 5.6, h: gH, side: -1 });
    });
    var parts = [
      torsoPart,
      makePart('neck', neck, 1, 0.8, 2.0, 2.5),
      makePart('head', head, 1, 0.35, 3.0, 0),
      makePart('armR', armStations, 1, 0.7, 0, 0),
      makePart('armL', armStations, -1, 0.7, 0, 0),
      makePart('legR', leg, 1, 1.6, 0, 4.0),
      makePart('legL', leg, -1, 1.6, 0, 4.0)
    ];
    var Rb = 0;
    armStations.forEach(function (q) { Rb = Math.max(Rb, Math.abs(q.cx) + Math.max(q.a, q.b)); });
    torso.forEach(function (q) { Rb = Math.max(Rb, Math.max(q.a, q.b)); });

    return {
      H: H, parts: parts, Rb: Rb,
      levels: { bust: yT(tBust), waist: yT(tW), hips: yT(tHip), shoulder: yS },
      yCrotch: yC
    };
  }

  // Horizontal extent (cm, screen space) of the model at height y
  function extentsAt(model, y, theta) {
    var c = Math.cos(theta), s = Math.sin(theta), lo = 1e9, hi = -1e9;
    for (var i = 0; i < model.parts.length; i++) {
      var pt = model.parts[i];
      if (y < pt.y0 || y > pt.y1) continue;
      var cx = pt.cx.at(y) * pt.side, cz = pt.cz.at(y), a = pt.a.at(y), b = pt.b.at(y);
      var sc = cx * c + cz * s, E = Math.sqrt(a * a * c * c + b * b * s * s);
      if (sc - E < lo) lo = sc - E;
      if (sc + E > hi) hi = sc + E;
    }
    return lo > hi ? null : [lo, hi];
  }

  /* ---------- Rasteriser (scan-line, analytic ellipse cross-sections) ---- */
  var LX = -0.50, LY = 0.46, LZ = 0.74;
  (function () { var l = Math.sqrt(LX * LX + LY * LY + LZ * LZ); LX /= l; LY /= l; LZ /= l; })();
  var HX = LX, HY = LY, HZ = LZ + 1;
  (function () { var l = Math.sqrt(HX * HX + HY * HY + HZ * HZ); HX /= l; HY /= l; HZ /= l; })();

  var _rb = null;
  function rowBuffers(W) {
    if (_rb && _rb.W === W) return _rb;
    _rb = { W: W, zb: new Float32Array(W), S: new Float32Array(W), cov: new Uint8Array(W),
            NX: new Float32Array(W), NY: new Float32Array(W), NZ: new Float32Array(W),
            BX: new Float32Array(W), BY: new Float32Array(W), BZ: new Float32Array(W) };
    return _rb;
  }
  var rowBumps = new Float64Array(20);
  var SOFT_K = 0.9;   // 1/cm — how far apart two surfaces may be and still blend

  function rasterize(buf, W, Hp, model, o) {
    var scale = o.scale, ox = o.cxPx, gy = o.groundPx;
    var th = o.theta, c = Math.cos(th), s = Math.sin(th);
    var col = o.color, alpha = o.alpha == null ? 255 : Math.round(255 * o.alpha);
    var T = rowBuffers(W);
    var zb = T.zb, S = T.S, cov = T.cov, NX = T.NX, NY = T.NY, NZ = T.NZ, BX = T.BX, BY = T.BY, BZ = T.BZ;
    var parts = model.parts, np = parts.length;
    var top = Math.max(0, Math.floor(gy - model.H * scale) - 1), bot = Math.min(Hp - 1, Math.ceil(gy));
    var kk = SOFT_K;

    for (var py = top; py <= bot; py++) {
      var y = (gy - (py + 0.5)) / scale;
      if (y < 0 || y > model.H) continue;
      var any = false;
      for (var i = 0; i < W; i++) { zb[i] = -1e9; S[i] = 0; cov[i] = 0; NX[i] = 0; NY[i] = 0; NZ[i] = 0; }

      for (var pi = 0; pi < np; pi++) {
        var pt = parts[pi];
        if (y < pt.y0 || y > pt.y1) continue;
        var fw = 1;
        if (pt.fadeLo > 0) fw *= smooth((y - pt.y0) / pt.fadeLo);
        if (pt.fadeHi > 0) fw *= smooth((pt.y1 - y) / pt.fadeHi);
        if (fw < 0.002) fw = 0.002;
        var side = pt.side;
        var cx = pt.cx.at(y) * side, cz = pt.cz.at(y), a = pt.a.at(y), b = pt.b.at(y);
        var dcx = pt.cx.diff(y) * side, dcz = pt.cz.diff(y), da = pt.a.diff(y), db = pt.b.diff(y);
        var scx = cx * c + cz * s;
        var E = Math.sqrt(a * a * c * c + b * b * s * s);
        var x0 = Math.max(0, Math.floor(ox + (scx - E) * scale)), x1 = Math.min(W - 1, Math.ceil(ox + (scx + E) * scale));
        var a2 = 1 / (a * a), b2 = 1 / (b * b);
        var A = s * s * a2 + c * c * b2;
        // row-constant part of the chest bumps
        var bumps = null, bcount = 0;
        if (pt.bumps && pt.bumps.length) {
          bumps = rowBumps; bcount = 0;
          for (var bi = 0; bi < pt.bumps.length; bi++) {
            var bp = pt.bumps[bi], dy = (y - bp.y) / bp.sy;
            if (Math.abs(dy) > 3) continue;
            var gyv = bp.h * Math.exp(-0.5 * dy * dy);
            var o2 = bcount * 5;
            bumps[o2] = bp.x; bumps[o2 + 1] = 1 / bp.sx; bumps[o2 + 2] = gyv; bumps[o2 + 3] = -gyv * dy / bp.sy; bumps[o2 + 4] = bp.side || 1;
            bcount++;
          }
        }
        for (var px = x0; px <= x1; px++) {
          var xs = (px + 0.5 - ox) / scale;
          var X0 = xs * c - cx, Z0 = xs * s - cz;
          var Bq = 2 * (Z0 * c * b2 - X0 * s * a2);
          var Cq = X0 * X0 * a2 + Z0 * Z0 * b2 - 1;
          var D = Bq * Bq - 4 * A * Cq;
          if (D < 0) continue;
          var z = (-Bq + Math.sqrt(D)) / (2 * A);
          if (cov[px] && z < zb[px] - 4 / kk) continue;
          var Xp = X0 - z * s, Zp = Z0 + z * c;
          var gx = Xp * a2, gz = Zp * b2;
          var gl = Math.sqrt(gx * gx + gz * gz) || 1;
          var ux = gx / gl, uz = gz / gl;
          var ny = -(da * (Xp / a) * ux + db * (Zp / b) * uz + dcx * ux + dcz * uz) * 0.85;
          if (bcount && (uz > 0.05 || uz < -0.05)) {
            // smooth chest volume: perturb the normal with the gradient of Gaussian bumps
            var hx = 0, hy = 0, auz = uz < 0 ? -uz : uz, fz = auz > 0.55 ? 1 : (auz - 0.05) / 0.5, sgz = uz < 0 ? -1 : 1;
            for (var q2 = 0; q2 < bcount; q2++) {
              var o3 = q2 * 5;
              if (rowBumps[o3 + 4] !== sgz) continue;
              var dxn = (Xp - rowBumps[o3]) * rowBumps[o3 + 1], ex = Math.exp(-0.5 * dxn * dxn);
              hx += -rowBumps[o3 + 2] * ex * dxn * rowBumps[o3 + 1];
              hy += rowBumps[o3 + 3] * ex;
            }
            ux -= hx * fz * auz; ny -= hy * fz;
            var ul = Math.sqrt(ux * ux + uz * uz) || 1; ux /= ul; uz /= ul;
          }
          var nx = ux * c + uz * s, nz = -ux * s + uz * c;
          var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
          nx /= nl; ny /= nl; nz /= nl;
          any = true;
          if (!cov[px]) {
            cov[px] = 1; zb[px] = z; S[px] = fw; NX[px] = nx * fw; NY[px] = ny * fw; NZ[px] = nz * fw;
            BX[px] = nx; BY[px] = ny; BZ[px] = nz;
          } else if (z > zb[px]) {
            var sc = Math.exp(kk * (zb[px] - z));
            S[px] = S[px] * sc + fw; NX[px] = NX[px] * sc + nx * fw; NY[px] = NY[px] * sc + ny * fw; NZ[px] = NZ[px] * sc + nz * fw;
            zb[px] = z; BX[px] = nx; BY[px] = ny; BZ[px] = nz;
          } else {
            var w = Math.exp(kk * (z - zb[px])) * fw;
            S[px] += w; NX[px] += w * nx; NY[px] += w * ny; NZ[px] += w * nz;
          }
        }
      }
      if (!any) continue;
      var row = py * W * 4;
      for (var q = 0; q < W; q++) {
        if (!cov[q]) continue;
        var mx = NX[q] + 0.002 * BX[q], my = NY[q] + 0.002 * BY[q], mz = NZ[q] + 0.002 * BZ[q];
        var ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
        mx /= ml; my /= ml; mz /= ml;
        var dif = mx * LX + my * LY + mz * LZ; if (dif < 0) dif = 0;
        var hs = mx * HX + my * HY + mz * HZ; if (hs < 0) hs = 0;
        var rim = 1 - (mz < 0 ? 0 : mz); rim = rim * rim * rim;
        var sh = 0.30 + 0.70 * (dif + 0.15 * dif * (1 - dif));
        var h2 = hs * hs, h4 = h2 * h2, h8 = h4 * h4, h16 = h8 * h8;
        var sp = h16 * h8 * h2 * 0.16 + rim * 0.10;
        var k = row + q * 4;
        buf[k] = col[0] * sh + 255 * sp;
        buf[k + 1] = col[1] * sh + 255 * sp;
        buf[k + 2] = col[2] * sh + 255 * sp;
        buf[k + 3] = alpha;
      }
    }
  }

  /* ---------- Metrics ---------------------------------------------------- */
  function bmiOf(b) { return b.weight / sq(b.height / 100); }
  function bmiCategory(v) {
    if (v < 18.5) return 'Underweight range';
    if (v < 25) return 'Healthy weight range';
    if (v < 30) return 'Overweight range';
    return 'Obesity range';
  }
  function bmiShort(v) { return v < 18.5 ? 'Underweight' : (v < 25 ? 'Healthy' : (v < 30 ? 'Overweight' : 'Obesity')); }
  function whrShort(b) { var lim = b.sex === 'm' ? 0.90 : (b.sex === 'f' ? 0.85 : 0.875); return whrOf(b) > lim ? 'Above ref.' : 'Within ref.'; }
  function whtrShort(b) { var v = whtrOf(b); return v < 0.40 ? 'Slim' : (v < 0.50 ? 'Healthy' : (v < 0.60 ? 'Increased' : 'High')); }
  function healthyRange(b) {
    var h2 = sq(b.height / 100);
    return [18.5 * h2, 24.9 * h2];
  }
  function whrOf(b) { return b.waist / b.hips; }
  function whrNote(b) {
    var v = whrOf(b), lim = b.sex === 'm' ? 0.90 : (b.sex === 'f' ? 0.85 : 0.875);
    var ref = b.sex === 'm' ? '0.90' : (b.sex === 'f' ? '0.85' : '0.85 women / 0.90 men');
    return (v > lim ? 'Above' : 'At or below') + ' the WHO reference (' + ref + ')';
  }
  function whtrOf(b) { return b.waist / b.height; }
  function whtrNote(b) {
    var v = whtrOf(b);
    if (v < 0.40) return 'Below 0.40 (slim)';
    if (v < 0.50) return 'Within the commonly cited healthy range (0.40–0.49)';
    if (v < 0.60) return 'Increased — 0.50 or above';
    return 'High — 0.60 or above';
  }
  // US Navy circumference method (metric form)
  function bodyFat(b) {
    var H = b.height, m, f;
    var wn = Math.max(b.waist - b.neck, 5);
    m = 495 / (1.0324 - 0.19077 * Math.log10(wn) + 0.15456 * Math.log10(H)) - 450;
    var wf = Math.max(b.waist + b.hips - b.neck, 20);
    f = 495 / (1.29579 - 0.35004 * Math.log10(wf) + 0.22100 * Math.log10(H)) - 450;
    var v = b.sex === 'm' ? m : (b.sex === 'f' ? f : (m + f) / 2);
    return clamp(v, 3, 60);
  }
  function bodyFatNote(b, v) {
    var t = b.sex === 'm' ? [6, 14, 18, 25] : (b.sex === 'f' ? [14, 21, 25, 32] : [10, 17.5, 21.5, 28.5]);
    if (v < t[0]) return 'Very lean (athlete-level or lower)';
    if (v < t[1]) return 'Athletic range';
    if (v < t[2]) return 'Fitness range';
    if (v < t[3]) return 'Average range';
    return 'Above average range';
  }

  function bodyFatShort(b, v) {
    var t = b.sex === 'm' ? [6, 14, 18, 25] : (b.sex === 'f' ? [14, 21, 25, 32] : [10, 17.5, 21.5, 28.5]);
    return v < t[0] ? 'Very lean' : (v < t[1] ? 'Athletic' : (v < t[2] ? 'Fitness' : (v < t[3] ? 'Average' : 'Above avg.')));
  }

  var SHAPES = {
    hourglass:        { n: 'Hourglass',        url: '/hourglass-body-shape/' },
    top_hourglass:    { n: 'Top Hourglass',    url: '/hourglass-body-shape/' },
    bottom_hourglass: { n: 'Bottom Hourglass', url: '/hourglass-body-shape/' },
    triangle:         { n: 'Pear (Triangle)',  url: '/pear-body-shape/' },
    apple:            { n: 'Apple',            url: '/apple-body-shape/' },
    inverted_triangle:{ n: 'Inverted Triangle',url: '/inverted-triangle-body-shape/' },
    rectangle:        { n: 'Rectangle',        url: '/' },
    trapezoid:        { n: 'Trapezoid',        url: '/male-body-type-calculator/' },
    oval:             { n: 'Oval',             url: '/male-body-type-calculator/' },
    m_inverted:       { n: 'Inverted Triangle',url: '/male-body-type-calculator/' },
    m_triangle:       { n: 'Triangle',         url: '/male-body-type-calculator/' },
    m_rectangle:      { n: 'Rectangle',        url: '/male-body-type-calculator/' }
  };

  // Same rules (in inches) as the site's Body Type Calculators
  function classifyFemale(bustCm, waistCm, hipsCm) {
    var B = bustCm / 2.54, W = waistCm / 2.54, H = hipsCm / 2.54;
    var bh = B - H, hb = H - B, bw = B - W, hw = H - W;
    if (bh <= 1 && hb < 3.6 && (bw >= 9 || hw >= 10)) return 'hourglass';
    if (hb >= 3.6 && hb < 10 && hw >= 9) return 'bottom_hourglass';
    if (bh > 1 && bh < 10 && bw >= 9) return 'top_hourglass';
    if (Math.abs(B - H) < 3.6 && W >= B - 2 && W >= H - 2) return 'apple';
    if (hb >= 3.6 && hw < 9) return 'triangle';
    if (bh >= 3.6 && bw < 9) return 'inverted_triangle';
    return 'rectangle';
  }
  function classifyMale(chestCm, waistCm, hipsCm) {
    var C = chestCm / 2.54, W = waistCm / 2.54, H = hipsCm / 2.54;
    var ch = C - H, hc = H - C, cw = C - W;
    if (ch >= 3 && cw >= 7) return 'trapezoid';
    if (ch >= 3) return 'm_inverted';
    if (hc >= 3) return 'm_triangle';
    if (Math.abs(ch) < 3 && W >= C - 2 && W >= H - 2) return 'oval';
    return 'm_rectangle';
  }
  function classify(b) {
    var key = b.sex === 'f' ? classifyFemale(b.bust, b.waist, b.hips) : classifyMale(b.bust, b.waist, b.hips);
    return { key: key, name: SHAPES[key].n, url: SHAPES[key].url };
  }

  /* ---------- Shape presets (targets are re-checked by the classifier) --- */
  var PRESETS_F = [
    ['hourglass', 'Hourglass'], ['top_hourglass', 'Top hourglass'], ['bottom_hourglass', 'Bottom hourglass'],
    ['triangle', 'Pear'], ['apple', 'Apple'], ['inverted_triangle', 'Inverted triangle'], ['rectangle', 'Rectangle']
  ];
  var PRESETS_M = [
    ['trapezoid', 'Trapezoid'], ['m_inverted', 'Inverted triangle'], ['m_rectangle', 'Rectangle'],
    ['oval', 'Oval'], ['m_triangle', 'Triangle']
  ];
  function presetValues(key, body) {
    var H0 = body.hips, bust, waist;
    switch (key) {
      case 'hourglass':        bust = H0;                           waist = 0.70 * H0; break;
      case 'top_hourglass':    bust = H0 * 1.08;                    waist = 0.68 * H0; break;
      case 'bottom_hourglass': bust = H0 - Math.max(10, 0.11 * H0); waist = 0.70 * H0; break;
      case 'triangle':         bust = H0 - Math.max(11, 0.12 * H0); waist = 0.84 * H0; break;
      case 'apple':            bust = H0 + 1;                       waist = 1.02 * H0; break;
      case 'inverted_triangle':bust = H0 + Math.max(10, 0.115 * H0); waist = bust - Math.min(20, 0.15 * H0); break;
      case 'rectangle':        bust = H0 - 4;                       waist = 0.86 * H0; break;
      case 'trapezoid':        bust = H0 + Math.max(10, 0.10 * H0); waist = bust - 20; break;
      case 'm_inverted':       bust = H0 + 10;                      waist = bust - 12; break;
      case 'm_rectangle':      bust = H0 + 3;                       waist = bust * 0.88; break;
      case 'oval':             bust = H0 + 1;                       waist = Math.max(bust, H0) * 1.03; break;
      case 'm_triangle':       bust = H0 - 10;                      waist = bust * 0.90; break;
      default: return null;
    }
    return { bust: bust, waist: waist };
  }

  /* ---------- Swatches --------------------------------------------------- */
  var SWATCHES = [
    { n: 'Champagne', c: [221, 199, 158] },
    { n: 'Sand',      c: [232, 208, 181] },
    { n: 'Clay',      c: [201, 145, 108] },
    { n: 'Mocha',     c: [140, 92, 64] },
    { n: 'Rose',      c: [216, 160, 160] },
    { n: 'Sage',      c: [157, 181, 159] },
    { n: 'Slate',     c: [143, 163, 184] },
    { n: 'Graphite',  c: [154, 154, 154] }
  ];

  var API = {
    SEX: SEX, MEAS: MEAS, RANGES: RANGES, MIN_BMI: MIN_BMI, SWATCHES: SWATCHES,
    PRESETS_F: PRESETS_F, PRESETS_M: PRESETS_M, SHAPES: SHAPES,
    clamp: clamp, lerp: lerp, rangeFor: rangeFor, typical: typical,
    makeBody: makeBody, cloneBody: cloneBody, rebalance: rebalance, sanitize: sanitize,
    buildModel: buildModel, extentsAt: extentsAt, rasterize: rasterize,
    bmiOf: bmiOf, bmiCategory: bmiCategory, healthyRange: healthyRange, bmiShort: bmiShort, whrShort: whrShort, whtrShort: whtrShort, bodyFatShort: bodyFatShort,
    whrOf: whrOf, whrNote: whrNote, whtrOf: whtrOf, whtrNote: whtrNote,
    bodyFat: bodyFat, bodyFatNote: bodyFatNote,
    classify: classify, classifyFemale: classifyFemale, classifyMale: classifyMale,
    presetValues: presetValues
  };
  root.BVCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

/* ==========================================================================
   Body Fat Percentage Chart — calculator + 3D "what would I look like" preview
   bodyshapecalculator.net · runs entirely in the browser, nothing is sent.
   ========================================================================== */
(function () {
  'use strict';
  if (typeof document === 'undefined' || !window.BVCore) return;
  var C = window.BVCore;
  var root = document.getElementById('bfc-tool');
  if (!root) return;

  var IN = 2.54, LB = 0.45359237;
  var ACE = {
    m: [[0, 6, 'Essential fat', 'ess'], [6, 14, 'Athletes', 'ath'], [14, 18, 'Fitness', 'fit'], [18, 25, 'Average', 'avg'], [25, 101, 'Obese', 'obe']],
    f: [[0, 14, 'Essential fat', 'ess'], [14, 21, 'Athletes', 'ath'], [21, 25, 'Fitness', 'fit'], [25, 32, 'Average', 'avg'], [32, 101, 'Obese', 'obe']]
  };
  // Gallagher et al. 2000 (AJCN 72:694) — healthy range lower bound, overfat from, obese from
  var AGE = {
    m: [[20, 39, 8, 20, 25], [40, 59, 11, 22, 28], [60, 79, 13, 25, 30]],
    f: [[20, 39, 21, 33, 39], [40, 59, 23, 34, 40], [60, 79, 24, 36, 42]]
  };

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    sexBtns: root.querySelectorAll('[data-sex]'), unitBtns: root.querySelectorAll('[data-unit]'),
    age: $('bfc-age'), ft: $('bfc-ft'), inch: $('bfc-in'), cm: $('bfc-cm'), wt: $('bfc-wt'), wtU: $('bfc-wt-u'),
    neck: $('bfc-neck'), waist: $('bfc-waist'), hip: $('bfc-hip'), hipRow: $('bfc-hip-row'),
    hUS: $('bfc-h-us'), hM: $('bfc-h-m'), lenU: root.querySelectorAll('.bfc-len-u'),
    err: $('bfc-err'), out: $('bfc-out'), pct: $('bfc-pct'), cat: $('bfc-cat'), scale: $('bfc-scale'), marker: $('bfc-marker'),
    ageLine: $('bfc-ageline'), fat: $('bfc-fatmass'), lean: $('bfc-leanmass'), bmi: $('bfc-bmi'),
    tgt: $('bfc-target'), tgtVal: $('bfc-target-val'), tgtNote: $('bfc-target-note'), canvas: $('bfc-canvas'),
    capNow: $('bfc-cap-now'), capTgt: $('bfc-cap-tgt'), mobile: $('bfc-mstrip')
  };

  var state = { sex: 'm', unit: 'us', target: 15 };
  var EXAMPLE = {
    m: { age: 32, h: 178, w: 79, neck: 39, waist: 88, hip: 100 },
    f: { age: 32, h: 165, w: 63, neck: 32.5, waist: 74, hip: 98 }
  };

  function r1(v) { return Math.round(v * 10) / 10; }
  function num(el) { var v = parseFloat(String(el.value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function lenOut(cm) { return state.unit === 'us' ? r1(cm / IN) + ' in' : r1(cm) + ' cm'; }
  function wOut(kg) { return state.unit === 'us' ? Math.round(kg / LB) + ' lb' : r1(kg) + ' kg'; }

  function fill(ex) {
    els.age.value = ex.age;
    if (state.unit === 'us') {
      var tin = ex.h / IN, ft = Math.floor(tin / 12), inch = Math.round(tin - ft * 12);
      if (inch === 12) { ft++; inch = 0; }
      els.ft.value = ft; els.inch.value = inch; els.wt.value = Math.round(ex.w / LB);
      els.neck.value = r1(ex.neck / IN); els.waist.value = r1(ex.waist / IN); els.hip.value = r1(ex.hip / IN);
    } else {
      els.cm.value = Math.round(ex.h); els.wt.value = r1(ex.w);
      els.neck.value = r1(ex.neck); els.waist.value = r1(ex.waist); els.hip.value = r1(ex.hip);
    }
  }

  function read() {
    var k = state.unit === 'us' ? IN : 1, h;
    if (state.unit === 'us') h = (num(els.ft) * 12 + (num(els.inch) || 0)) * IN;
    else h = num(els.cm);
    return {
      age: num(els.age), h: h, w: num(els.wt) * (state.unit === 'us' ? LB : 1),
      neck: num(els.neck) * k, waist: num(els.waist) * k, hip: num(els.hip) * k
    };
  }

  function navy(sex, h, neck, waist, hip) {
    if (sex === 'm') return 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(h)) - 450;
    return 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(h)) - 450;
  }
  // circumference needed for a given body fat (men: waist; women: waist + hip)
  function navyInv(sex, h, neck, bf) {
    if (sex === 'm') return Math.pow(10, (1.0324 + 0.15456 * Math.log10(h) - 495 / (bf + 450)) / 0.19077) + neck;
    return Math.pow(10, (1.29579 + 0.22100 * Math.log10(h) - 495 / (bf + 450)) / 0.35004) + neck;
  }
  function aceOf(sex, bf) { var t = ACE[sex]; for (var i = 0; i < t.length; i++) if (bf < t[i][1]) return t[i]; return t[t.length - 1]; }
  function ageRow(sex, age) {
    var t = AGE[sex];
    if (!(age >= 20)) return null;
    for (var i = 0; i < t.length; i++) if (age <= t[i][1]) return t[i];
    return t[t.length - 1];
  }

  function makeBody(v) {
    var b = C.makeBody(state.sex, v.h, v.w);
    b.neck = v.neck; b.waist = v.waist;
    if (state.sex === 'f') b.hips = v.hip;
    C.sanitize(b);
    return b;
  }
  function bodyAt(b0, bf0, bf) {
    var lean = b0.weight * (1 - bf0 / 100);
    var W = lean / (1 - bf / 100);
    var b = C.cloneBody(b0);
    C.rebalance(b, b0.height, W);
    b.neck = b0.neck;
    var need = navyInv(state.sex, b.height, b.neck, bf);
    if (state.sex === 'm') b.waist = need;
    else { var k = need / (b.waist + b.hips); b.waist *= k; b.hips *= k; }
    C.sanitize(b);
    return b;
  }

  /* ---------- 3D render: now (front + side) vs target (front + side) ---------- */
  var COL_NOW = [221, 199, 158], COL_TGT = [143, 196, 190];
  var pending = 0, lastBodies = null;
  function draw(bodies) {
    lastBodies = bodies;
    if (pending) return;
    pending = (window.requestAnimationFrame || setTimeout)(function () { pending = 0; paint(lastBodies); });
  }
  function paint(bodies) {
    var cv = els.canvas; if (!cv || !bodies) return;
    var cssW = cv.clientWidth || 520, cssH = Math.round(cssW * (cssW < 520 ? 0.85 : 0.62));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = Math.round(cssW * dpr), H = Math.round(cssH * dpr);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    cv.style.height = cssH + 'px';
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(W, H);
    var tallest = Math.max(bodies[0].height, bodies[1].height);
    var scale = (H * 0.92) / tallest, ground = H * 0.97, col = W / 4;
    var models = [C.buildModel(bodies[0]), C.buildModel(bodies[1])];
    var half = 1;
    for (var mi = 0; mi < 2; mi++) {
      for (var y = 2; y < models[mi].H; y += 3) {
        for (var th = 0; th < 2; th++) {
          var ex = C.extentsAt(models[mi], y, th * Math.PI / 2);
          if (ex) half = Math.max(half, -ex[0], ex[1]);
        }
      }
    }
    scale = Math.min(scale, (col * 0.44) / half);
    var order = [[0, 0, COL_NOW], [0, 90, COL_NOW], [1, 0, COL_TGT], [1, 90, COL_TGT]];
    for (var i = 0; i < 4; i++) {
      var o = order[i];
      C.rasterize(img.data, W, H, models[o[0]], { cxPx: col * (i + 0.5) + (i < 2 ? -col * 0.06 : col * 0.06), groundPx: ground, scale: scale, theta: o[1] * Math.PI / 180, color: o[2] });
    }
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(img, 0, 0);
    // divider
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ctx.fillRect(Math.round(W / 2), Math.round(H * 0.08), Math.max(1, Math.round(dpr)), Math.round(H * 0.86));
  }

  function setPressed(list, attr, val) {
    Array.prototype.forEach.call(list, function (b) { b.setAttribute('aria-pressed', b.getAttribute(attr) === val ? 'true' : 'false'); });
  }

  function update() {
    var v = read(), sex = state.sex, msg = '';
    if (!(v.h >= 120 && v.h <= 230)) msg = 'Enter a height between 4 ft and 7 ft 6 in (120–230 cm).';
    else if (!(v.w >= 30 && v.w <= 250)) msg = 'Enter a weight between 66 and 550 lb (30–250 kg).';
    else if (!(v.neck > 20 && v.neck < 60)) msg = 'Enter your neck measurement, just below the Adam’s apple.';
    else if (!(v.waist > 40 && v.waist < 200)) msg = 'Enter your waist measurement.';
    else if (sex === 'f' && !(v.hip > 50 && v.hip < 200)) msg = 'Enter your hip measurement at the widest point.';
    else if (sex === 'm' && v.waist - v.neck < 5) msg = 'Your waist must be larger than your neck for this formula. Measure the waist at the navel.';
    var bf = msg ? NaN : navy(sex, v.h, v.neck, v.waist, v.hip);
    if (!msg && !(bf >= 2 && bf <= 60)) { msg = 'Those numbers give a result outside the formula’s range (2–60%). Double-check the units and where you measured.'; bf = NaN; }
    els.err.textContent = msg; els.err.hidden = !msg;
    els.out.classList.toggle('bfc-dim', !!msg);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }

    var a = aceOf(sex, bf);
    els.pct.textContent = r1(bf).toFixed(1) + '%';
    els.cat.textContent = a[2];
    els.cat.className = 'bfc-pill bfc-' + a[3];
    els.marker.style.left = Math.min(100, Math.max(0, bf / 45 * 100)) + '%';
    els.marker.setAttribute('aria-label', 'You: ' + r1(bf) + '%');

    var row = ageRow(sex, v.age), line;
    if (!row) line = 'Age-based ranges (Gallagher et al.) start at age 20. Use the general chart above for now.';
    else {
      var st = bf < row[2] ? ['below the healthy range', 'low'] : (bf < row[3] ? ['in the healthy range', 'ok'] : (bf < row[4] ? ['in the overfat range', 'hi'] : ['in the obesity range', 'vhi']));
      line = 'For ' + (sex === 'm' ? 'men' : 'women') + ' aged ' + row[0] + '–' + row[1] + ', a healthy range is about <b>' + row[2] + '–' + (row[3] - 1) + '%</b>. You are <b class="bfc-st-' + st[1] + '">' + st[0] + '</b>.';
      if (v.age > 79) line += ' (Table stops at 79; this uses the 60–79 row.)';
    }
    els.ageLine.innerHTML = line;
    var fatKg = v.w * bf / 100;
    els.fat.textContent = wOut(fatKg);
    els.lean.textContent = wOut(v.w - fatKg);
    els.bmi.textContent = r1(v.w / Math.pow(v.h / 100, 2)).toFixed(1);
    if (els.mobile) els.mobile.innerHTML = '<b>' + r1(bf).toFixed(1) + '%</b> ' + a[2];

    // target preview
    var t = state.target;
    var b0 = makeBody(v), b1 = bodyAt(b0, bf, t);
    els.tgtVal.textContent = t + '%';
    var dW = b1.weight - b0.weight, need = navyInv(sex, v.h, v.neck, t);
    var waistT = sex === 'm' ? need : v.waist * need / (v.waist + v.hip);
    var dir = dW < 0 ? 'lose about ' + wOut(-dW) : (dW > 0 ? 'gain about ' + wOut(dW) : 'stay the same');
    els.tgtNote.innerHTML = 'At <b>' + t + '%</b> with the same lean mass, you would weigh about <b>' + wOut(b1.weight) + '</b> (' + dir + ' of fat) and your waist would measure about <b>' + lenOut(waistT) + '</b>. That target sits in the <b>' + aceOf(sex, t)[2].toLowerCase() + '</b> band.';
    els.capNow.textContent = 'You now · ' + r1(bf).toFixed(1) + '%';
    els.capTgt.textContent = 'You at ' + t + '%';
    draw([b0, b1]);
  }

  function setSex(s) {
    state.sex = s; setPressed(els.sexBtns, 'data-sex', s);
    els.hipRow.querySelector('.bfc-opt').hidden = s === 'f';
    els.hip.required = s === 'f';
    els.hipRow.classList.toggle('bfc-optional', s === 'm');
    root.querySelectorAll('[data-scale]').forEach(function (n) { n.hidden = n.getAttribute('data-scale') !== s; });
    state.target = s === 'm' ? 15 : 22; els.tgt.value = state.target;
    fill(EXAMPLE[s]); update();
  }
  function setUnit(u) {
    if (u === state.unit) return;
    var v = read(); state.unit = u; setPressed(els.unitBtns, 'data-unit', u);
    els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us';
    els.wtU.textContent = u === 'us' ? 'lb' : 'kg';
    Array.prototype.forEach.call(els.lenU, function (n) { n.textContent = u === 'us' ? 'in' : 'cm'; });
    if (isFinite(v.h)) fill({ age: v.age, h: v.h, w: v.w, neck: v.neck, waist: v.waist, hip: v.hip });
    update();
  }

  Array.prototype.forEach.call(els.sexBtns, function (b) { b.addEventListener('click', function () { setSex(b.getAttribute('data-sex')); }); });
  Array.prototype.forEach.call(els.unitBtns, function (b) { b.addEventListener('click', function () { setUnit(b.getAttribute('data-unit')); }); });
  root.addEventListener('input', function (e) {
    if (e.target === els.tgt) state.target = parseInt(els.tgt.value, 10);
    update();
  });
  var reset = $('bfc-example');
  if (reset) reset.addEventListener('click', function () { fill(EXAMPLE[state.sex]); update(); });
  if (window.ResizeObserver) new ResizeObserver(function () { if (lastBodies) draw(lastBodies); }).observe(els.canvas);

  var hdr = document.querySelector('.site-header'), wrap = root.closest('.bfc-wrap');
  function setHdr() { if (hdr && wrap) wrap.style.setProperty('--bfc-hdr', Math.round(hdr.getBoundingClientRect().height) + 'px'); }
  setHdr(); window.addEventListener('resize', setHdr);
  root.classList.add('bfc-ready');
  setSex('m');
})();
