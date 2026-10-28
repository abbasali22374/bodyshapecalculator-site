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

/* Shoulder-to-Waist Ratio Calculator (+ chest-to-waist) with 3D (runs in the browser) */
(function () {
  'use strict';
  var C = window.BVCore, root = document.getElementById('tp-tool');
  if (!C || !root) return;
  var GOLD = 1.618, WIDTH = { m: 0.433, f: 0.438 }; // bideltoid width ~ share of shoulder circumference (ANSUR II)
  var MEN = [1.26, 0.119]; // ANSUR II men: median, spread
  var $ = function (id) { return document.getElementById(id); };
  var state = { sex: 'm', unit: 'us' };
  var els = { sh: $('tp-sh'), wa: $('tp-wa'), ch: $('tp-ch'), u: root.querySelectorAll('.tp-lu'), ft: $('tp-ft'), inch: $('tp-in'), cm: $('tp-cm'), hUS: $('tp-h-us'), hM: $('tp-h-m'),
    err: $('tp-err'), out: $('tp-out'), ratio: $('tp-ratio'), cat: $('tp-cat'), marker: $('tp-marker'), pct: $('tp-pct'), cw: $('tp-cw'), gw: $('tp-gw'), gs: $('tp-gs'),
    line: $('tp-line'), canvas: $('tp-canvas'), capA: $('tp-cap-a'), capB: $('tp-cap-b'), note: $('tp-note'), mobile: $('tp-mstrip') };
  function len(cm) { return state.unit === 'us' ? TP.r1(cm / TP.IN).toFixed(1) + ' in' : TP.r1(cm).toFixed(1) + ' cm'; }
  function rd(el) { return TP.num(el) * (state.unit === 'us' ? TP.IN : 1); }
  function readH() { return state.unit === 'us' ? (TP.num(els.ft) * 12 + (TP.num(els.inch) || 0)) * TP.IN : TP.num(els.cm); }
  function band(r, sex) {
    if (sex === 'm') return r < 1.18 ? ['Below average', 'c1'] : r < 1.34 ? ['Average', 'c3'] : r < 1.46 ? ['Athletic', 'c4'] : r < 1.6 ? ['Strong V-taper', 'c2'] : ['Golden ratio+', 'c2'];
    return r < 1.15 ? ['Straight', 'c1'] : r < 1.30 ? ['Average', 'c3'] : r < 1.45 ? ['Defined waist', 'c4'] : ['Very defined', 'c2'];
  }
  function weightFor(sex, H, waist) { var lo = 35, hi = 220; for (var i = 0; i < 36; i++) { var m = (lo + hi) / 2; if (C.makeBody(sex, H, m).waist < waist) lo = m; else hi = m; } return (lo + hi) / 2; }
  var pending = 0, last = null;
  function draw(b) { last = b; if (pending) return; pending = requestAnimationFrame(function () { pending = 0; paint(last); }); }
  function paint(bodies) {
    var cv = els.canvas; if (!cv || !bodies) return;
    var cssW = cv.clientWidth || 480, cssH = Math.round(cssW * (cssW < 520 ? 0.95 : 0.72));
    var dpr = Math.min(window.devicePixelRatio || 1, 2), Wd = Math.round(cssW * dpr), Hd = Math.round(cssH * dpr);
    if (cv.width !== Wd || cv.height !== Hd) { cv.width = Wd; cv.height = Hd; }
    cv.style.height = cssH + 'px';
    var ctx = cv.getContext('2d'), img = ctx.createImageData(Wd, Hd);
    var models = bodies.map(function (b) { return C.buildModel(b); }), col = Wd / 2, half = 1;
    models.forEach(function (m) { for (var y = 2; y < m.H; y += 3) { var e = C.extentsAt(m, y, 0); if (e) half = Math.max(half, -e[0], e[1]); } });
    var scale = Math.min(Hd * 0.9 / bodies[0].height, col * 0.46 / half);
    C.rasterize(img.data, Wd, Hd, models[0], { cxPx: col * 0.5, groundPx: Hd * 0.97, scale: scale, theta: 0, color: [143, 196, 190] });
    C.rasterize(img.data, Wd, Hd, models[1], { cxPx: col * 1.5, groundPx: Hd * 0.97, scale: scale, theta: 0, color: [221, 199, 158] });
    ctx.clearRect(0, 0, Wd, Hd); ctx.putImageData(img, 0, 0);
  }
  function update() {
    var sex = state.sex, S = rd(els.sh), W = rd(els.wa), Ch = rd(els.ch), h = readH(), msg = '';
    if (!(S >= 70 && S <= 170)) msg = 'Enter your shoulder circumference: usually 36–56 in (90–140 cm), measured around the widest part of the shoulders.';
    else if (!(W >= 50 && W <= 170)) msg = 'Enter your waist: usually 25–50 in (64–127 cm).';
    else if (isFinite(Ch) && !(Ch >= 60 && Ch <= 170)) msg = 'Chest is usually 30–55 in (76–140 cm), or leave it blank.';
    else if (isFinite(h) && !(h >= 120 && h <= 230)) msg = 'Height should be between 4 ft and 7 ft 6 in (120–230 cm), or leave it blank.';
    els.err.textContent = msg; els.err.hidden = !msg; els.out.classList.toggle('tp-dim', !!msg);
    if (msg) { if (els.mobile) els.mobile.textContent = '—'; return; }
    var r = S / W, b = band(r, sex);
    els.ratio.textContent = r.toFixed(2); els.cat.textContent = b[0]; els.cat.className = 'tp-pill tp-' + b[1];
    els.marker.style.left = Math.min(99, Math.max(1, (r - 0.9) / (1.8 - 0.9) * 100)) + '%';
    els.pct.textContent = sex === 'm' ? TP.pctText(TP.Phi((r - MEN[0]) / MEN[1])) : '—';
    els.cw.textContent = isFinite(Ch) ? (Ch / W).toFixed(2) : 'add chest';
    els.gw.textContent = len(S / GOLD); els.gs.textContent = len(W * GOLD);
    var t = 'Your shoulder-to-waist ratio is <b>' + r.toFixed(2) + '</b>. ';
    if (sex === 'm') t += 'That is higher than about <b>' + Math.round(TP.Phi((r - MEN[0]) / MEN[1]) * 100) + '%</b> of U.S. Army men (median 1.26). ';
    t += r >= GOLD ? 'You are at or beyond the golden ratio of 1.618.' : 'To reach the golden ratio of 1.618 you would need a waist of <b>' + len(S / GOLD) + '</b> at your current shoulders, or shoulders of <b>' + len(W * GOLD) + '</b> at your current waist.';
    if (isFinite(Ch)) t += ' Chest-to-waist: <b>' + (Ch / W).toFixed(2) + '</b>' + (sex === 'm' ? (Ch / W >= 1.25 ? ' (a clear V shape).' : Ch / W >= 1.1 ? ' (moderate taper).' : ' (little taper).') : '.');
    els.line.innerHTML = t;
    if (els.mobile) els.mobile.innerHTML = 'Ratio <b>' + r.toFixed(2) + '</b> · ' + b[0];
    var H = isFinite(h) ? h : (sex === 'm' ? 178 : 165);
    var you = C.makeBody(sex, H, weightFor(sex, H, W)); you.waist = W; you.shoulders = S * WIDTH[sex]; if (isFinite(Ch)) you.bust = Ch; C.sanitize(you);
    var gW = Math.min(W, S / GOLD), gold = C.makeBody(sex, H, weightFor(sex, H, gW)); gold.waist = gW; gold.shoulders = S * WIDTH[sex]; if (isFinite(Ch)) gold.bust = Ch; C.sanitize(gold);
    els.capA.textContent = 'You · ' + r.toFixed(2); els.capB.textContent = (r >= GOLD ? 'Golden ratio (you are there)' : 'At 1.618 · waist ' + len(gW));
    els.note.textContent = isFinite(h) ? '' : 'Add your height to scale the figures to you.';
    draw([you, gold]);
  }
  function fill(sex) { var f = state.unit === 'us' ? function (c) { return TP.r1(c / TP.IN); } : TP.r1; els.sh.value = f(sex === 'm' ? 118 : 103); els.wa.value = f(sex === 'm' ? 91.5 : 80); els.ch.value = ''; }
  TP.seg(root, 'data-sex', function (s) { state.sex = s; TP.pressed(root.querySelectorAll('[data-sex]'), 'data-sex', s); fill(s); update(); });
  TP.seg(root, 'data-unit', function (u) {
    if (u === state.unit) return;
    var vals = [els.sh, els.wa, els.ch].map(rd), h = readH();
    state.unit = u; TP.pressed(root.querySelectorAll('[data-unit]'), 'data-unit', u);
    els.hUS.hidden = u !== 'us'; els.hM.hidden = u === 'us';
    Array.prototype.forEach.call(els.u, function (n) { n.textContent = u === 'us' ? 'in' : 'cm'; });
    [els.sh, els.wa, els.ch].forEach(function (el, i) { el.value = isFinite(vals[i]) ? (u === 'us' ? TP.r1(vals[i] / TP.IN) : TP.r1(vals[i])) : ''; });
    if (isFinite(h)) { if (u === 'us') { var t = h / TP.IN, f = Math.floor(t / 12); els.ft.value = f; els.inch.value = Math.round(t - f * 12); } else els.cm.value = Math.round(h); }
    update();
  });
  root.addEventListener('input', update);
  if (window.ResizeObserver) new ResizeObserver(function () { if (last) draw(last); }).observe(els.canvas);
  TP.hdr(root.closest('.tp-wrap'));
  fill('m'); update();
})();
