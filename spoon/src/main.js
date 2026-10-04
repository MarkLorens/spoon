import * as THREE from "three";

const cl = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const sm = (a, b, x) => {
  const t = cl((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const smax = (a, b, k) => {
  const h = cl(0.5 + (0.5 * (a - b)) / k);
  return b + (a - b) * h + k * h * (1 - h);
};
const LEN = 6;
const W = (u) => {
  const q = (u - 0.17) / 0.17;
  const bowl = q * q < 1 ? 0.62 * Math.sqrt(1 - q * q) * (1 - 0.1 * q) : 0;
  let h = (0.075 + 0.2 * sm(0.36, 0.9, u)) * sm(0.22, 0.33, u);
  if (u > 0.9) {
    const r = (u - 0.9) / 0.1;
    h *= Math.sqrt(Math.max(0, 1 - r * r));
  }
  return smax(bowl, h, 0.06);
};
const BASE = (u) =>
  0.55 * sm(0.3, 0.6, u) + 0.6 * Math.pow(Math.max(0, u - 0.62), 2);
const DEP = (u) => {
  const q = (u - 0.17) / 0.165;
  const bowl = q * q < 1 ? 0.24 * Math.pow(1 - q * q, 0.6) : 0;
  return bowl + 0.022 * sm(0.42, 0.6, u) * (1 - sm(0.9, 1, u));
};
const TH = (u) => 0.05 + 0.05 * sm(0.28, 0.42, u) * (1 - 0.45 * sm(0.55, 1, u));
const BG = [
  [0, "#ffffff"],
  [1.0, "#f5f5f7"],
  [1.48, "#f5f5f7"],
  [1.6, "#0b0d10"],
  [1.95, "#0b0d10"],
  [2.08, "#f5f5f7"],
  [2.9, "#f5f5f7"],
  [3.06, "#0b0b0c"],
  [3.93, "#0b0b0c"],
  [4.06, "#f5f5f7"],
  [4.9, "#f5f5f7"],
  [5.04, "#000000"],
  [5.96, "#000000"],
  [6.12, "#fbfbfd"],
].map(([t, h]) => [t, [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))]);

class Component {
  mount() {
    this.boot();
    this.bind();
  }
  unmount() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    if (this.ac) this.ac.abort();
    if (this.renderer) this.renderer.dispose();
  }

  bind() {
    const { signal } = (this.ac = new AbortController());
    const go = (y) => (e) => {
      e.preventDefault();
      window.scrollTo({
        top: y(),
        behavior: this.still.matches ? "auto" : "smooth",
      });
    };
    const nav = {
      top: go(() => 0),
      specs: go(() =>
        this.secs ? this.secs[1].offsetTop + innerHeight * 0.3 : 0,
      ),
      buy: go(() => document.documentElement.scrollHeight),
    };
    for (const key in nav)
      document
        .querySelectorAll(`[data-go="${key}"]`)
        .forEach((el) => el.addEventListener("click", nav[key], { signal }));

    const btn = this.$("sp-buy-btn"),
      label = this.$("sp-buy-label"),
      done = this.$("sp-buy-done"),
      msg = this.$("sp-buy-added");
    if (btn)
      btn.addEventListener(
        "click",
        () => {
          if (label) label.hidden = true;
          if (done) done.hidden = false;
          if (msg) msg.hidden = false;
        },
        { signal },
      );
  }

  boot() {
    this.$ = (id) => document.getElementById(id);
    this.still = matchMedia("(prefers-reduced-motion: reduce)");
    this.t0 = performance.now();
    this.shows = [...document.querySelectorAll("[data-show]")].map((el) => ({
      el,
      sec: +el.dataset.sec,
      r: el.dataset.show.split(",").map(Number),
      shift: !el.hasAttribute("data-noshift"),
      intro: +(el.dataset.intro || 0),
      inter: el.hasAttribute("data-interactive"),
    }));
    this.secs = [...document.querySelectorAll("[data-spacer]")];
    this.computeCog();
    this.drawMicro();
    this.onResize = () => this.resize();
    window.addEventListener("resize", this.onResize);
    this.resize();
    document.fonts?.ready.then(() => this.resize());
    const loop = () => {
      if (this.dead) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
    try {
      this.T = THREE;
      this.initGL();
      this.resize();
    } catch (e) {
      console.error(e);
    }
  }

  computeCog() {
    let m = 0,
      sx = 0,
      sy = 0;
    for (let i = 0; i <= 2000; i++) {
      const u = i / 2000,
        w = W(u) * TH(u);
      m += w;
      sx += w * (u - 0.5) * LEN;
      sy += w * (BASE(u) - DEP(u) * 0.6);
    }
    this.cx = sx / m;
    this.cy = sy / m;
    this.ucog = this.cx / LEN + 0.5;
  }

  P(u, phi) {
    const v = Math.cos(phi),
      s = Math.sin(phi);
    const y =
      BASE(u) -
      DEP(u) * (1 - v * v) +
      (TH(u) / 2) * Math.sign(s) * Math.pow(Math.abs(s), 0.55);
    return [(u - 0.5) * LEN - this.cx, y - this.cy, W(u) * v];
  }
  C(u, dy = 0) {
    return [(u - 0.5) * LEN - this.cx, BASE(u) - this.cy + dy, 0];
  }

  buildPart(u0, u1, n, M) {
    const T = this.T,
      pos = [],
      idx = [];
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1),
        u = u0 + (u1 - u0) * (0.5 - 0.5 * Math.cos(Math.PI * k));
      for (let j = 0; j < M; j++) pos.push(...this.P(u, (j / M) * Math.PI * 2));
    }
    for (let i = 0; i < n - 1; i++)
      for (let j = 0; j < M; j++) {
        const a = i * M + j,
          b = i * M + ((j + 1) % M),
          c = (i + 1) * M + j,
          d = (i + 1) * M + ((j + 1) % M);
        idx.push(a, c, b, b, c, d);
      }
    for (const [ring, flip] of [
      [0, true],
      [n - 1, false],
    ]) {
      const b0 = pos.length / 3;
      let x = 0,
        y = 0,
        z = 0;
      for (let j = 0; j < M; j++) {
        const o = (ring * M + j) * 3;
        x += pos[o];
        y += pos[o + 1];
        z += pos[o + 2];
      }
      pos.push(x / M, y / M, z / M);
      for (let j = 0; j < M; j++) {
        const o = (ring * M + j) * 3;
        pos.push(pos[o], pos[o + 1], pos[o + 2]);
      }
      for (let j = 0; j < M; j++) {
        const a = b0 + 1 + j,
          b = b0 + 1 + ((j + 1) % M);
        flip ? idx.push(b0, b, a) : idx.push(b0, a, b);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new T.Mesh(g, this.mat);
  }

  initGL() {
    const T = this.T;
    const canvas = this.$("sp-canvas");
    const r = (this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    }));
    r.setClearColor(0x000000, 0);
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.scene = new T.Scene();
    this.cam = new T.PerspectiveCamera(26, 1, 0.1, 200);

    const env = new T.Scene();
    env.add(
      new T.Mesh(
        new T.BoxGeometry(30, 22, 30),
        new T.MeshBasicMaterial({
          color: new T.Color(0.2, 0.2, 0.21),
          side: T.BackSide,
        }),
      ),
    );
    const floor = new T.Mesh(
      new T.PlaneGeometry(30, 30),
      new T.MeshBasicMaterial({ color: new T.Color(0.05, 0.05, 0.05) }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -7;
    env.add(floor);
    const panel = (w, h, c, p) => {
      const m = new T.Mesh(
        new T.PlaneGeometry(w, h),
        new T.MeshBasicMaterial({
          color: new T.Color(c, c, c),
          side: T.DoubleSide,
        }),
      );
      m.position.set(...p);
      m.lookAt(0, 0, 0);
      env.add(m);
    };
    panel(14, 5, 4, [0, 9, 2]);
    panel(3, 12, 3, [-10, 1, 3]);
    panel(3, 12, 2, [10, 1, -2]);
    panel(16, 4, 1.2, [0, 2, -12]);
    panel(10, 3, 1, [0, -3, 10]);
    panel(4, 4, 2.5, [6, 6, 8]);
    const pm = new T.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(env, 0.02).texture;

    this.mat = new T.MeshPhysicalMaterial({
      color: 0xdfe2e6,
      metalness: 1,
      roughness: 0.14,
      side: T.DoubleSide,
      transparent: true,
    });
    this.root = new T.Group();
    this.rot = new T.Group();
    this.pivot = new T.Group();
    this.rot.rotation.order = "ZYX";
    this.scene.add(this.root);
    this.root.add(this.rot);
    this.rot.add(this.pivot);
    this.full = this.buildPart(0.0005, 0.9995, 320, 80);
    this.parts = [
      [0.0005, 0.33, 140],
      [0.33, 0.52, 60],
      [0.52, 0.9995, 170],
    ].map(([a, b, n]) => this.buildPart(a, b, n, 80));
    this.pivot.add(this.full, ...this.parts);

    const lp = [];
    for (let i = 0; i <= 44; i++) {
      const u = 0.004 + (0.992 * i) / 44;
      for (let j = 0; j < 48; j++)
        lp.push(
          ...this.P(u, (j / 48) * 6.2832),
          ...this.P(u, ((j + 1) / 48) * 6.2832),
        );
    }
    for (let k = 0; k < 12; k++) {
      const ph = (k / 12) * 6.2832;
      for (let i = 0; i < 220; i++)
        lp.push(
          ...this.P(0.002 + (0.996 * i) / 220, ph),
          ...this.P(0.002 + (0.996 * (i + 1)) / 220, ph),
        );
    }
    const lg = new T.BufferGeometry();
    lg.setAttribute("position", new T.Float32BufferAttribute(lp, 3));
    this.wire = new T.LineSegments(
      lg,
      new T.LineBasicMaterial({
        color: 0xcfdbe6,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.pivot.add(this.wire);

    this.bowlC = new T.Vector3(...this.C(0.17, -DEP(0.17) * 0.5));
    this.v = new T.Vector3();
  }

  resize() {
    const w = innerWidth,
      h = innerHeight,
      a = w / h,
      tanH = Math.tan((13 * Math.PI) / 180);
    this.mobile = a < 0.8;
    const d = Math.max(6 / 0.66 / (2 * tanH * a), 4.2 / (2 * tanH));
    this.halfH = d * tanH;
    this.halfW = this.halfH * a;
    const m = this.mobile;
    const zoom = m ? 2.3 : 2.7,
      mx = m ? 0 : 0.3,
      my = m ? -0.22 : 0;
    const buy = m
      ? [0, 0.4, 1.4, 0, -1.25, 0.95]
      : [-0.42, 0, 1.42, 0, -0.72, 0.72];
    const sx = [0.95, 0.3, -0.18];
    this.K = [
      [0.0, 0, -0.24, 1.2, 0, -0.55, 0.78, 0, 0, 0],
      [0.4, 0, -0.22, 1.05, 0, -0.45, 0.86, 0, 0, 0],
      [1.0, 0, -0.04, 0, 0, 0, 1, 0, 0, 0],
      [1.46, 0, -0.04, 0, 0, 0, 1, 0, 0, 0],
      [1.6, 0, 0, 0, 0, 0, 0.92, 0, 1, 0],
      [1.95, 0, 0, 0, 0, 0, 0.92, 0, 1, 0],
      [2.1, 0, -0.02, 0.32, 0, 0, 0.95, 0, 0, 0],
      [2.88, 0, -0.02, 0.32, 0, 0, 0.95, 0, 0, 0],
      [3.1, mx, my, 1.3, 0.2, 0.4, zoom, 0, 0, 1],
      [3.92, mx, my, 1.15, -0.25, 0.55, zoom * 1.08, 0, 0, 1],
      [4.1, 0, -0.04, sx[0], sx[1], sx[2], m ? 0.92 : 0.8, 0, 0, 0],
      [4.18, 0, -0.04, sx[0], sx[1], sx[2], m ? 0.92 : 0.8, 0, 0, 0],
      [4.6, 0, -0.04, sx[0], sx[1] + 0.05, sx[2], m ? 0.82 : 0.76, 1, 0, 0],
      [4.86, 0, -0.04, sx[0], sx[1] + 0.08, sx[2], m ? 0.82 : 0.76, 1, 0, 0],
      [5.02, 0, -0.18, 1.05, 0, -0.6, 0.9, 0, 0, 0],
      [5.95, 0, -0.14, 1.2, 0, -0.22, 0.98, 0, 0, 0],
      [6.42, buy[0], buy[1], buy[2], buy[3], buy[4], buy[5], 0, 0, 0],
      [8, buy[0], buy[1], buy[2], buy[3], buy[4], buy[5], 0, 0, 0],
    ];
    this.labOff = m
      ? [
          [-14, -70],
          [0, 64],
          [14, -70],
        ]
      : [
          [-30, -110],
          [0, 96],
          [30, -110],
        ];
    // Exploded view: lower the spoon until the BOWL label (above its anchor) clears the heading.
    // ponytail: assumes the bowl anchor sits near the spoon's center; below ~550px tall THIS BIT drops off-screen.
    const head = this.$("sp-shape-head"),
      lab = this.$("x-lab0");
    if (head && lab) {
      const room =
        head.parentElement.offsetTop +
        head.offsetHeight +
        16 +
        lab.firstElementChild.offsetHeight -
        this.labOff[0][1];
      const yMax = 1 - (2 * room) / h;
      for (const row of this.K)
        if (row[0] >= 4.1 && row[0] <= 4.86) row[2] = Math.min(row[2], yMax);
    }
    const b = this.$("sp-buy");
    if (b)
      Object.assign(
        b.style,
        m
          ? {
              left: "6vw",
              right: "6vw",
              top: "auto",
              bottom: "6vh",
              marginTop: "0",
              maxWidth: "none",
            }
          : {
              left: "54vw",
              right: "auto",
              top: "50%",
              bottom: "auto",
              marginTop: "-170px",
              maxWidth: "440px",
            },
      );
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      this.renderer.setSize(w, h, false);
      this.cam.aspect = a;
      this.cam.position.set(0, 0, d);
      this.cam.updateProjectionMatrix();
    }
  }

  ramp(p, a, b) {
    if (b <= a) return p >= a ? 1 : 0;
    return sm(0, 1, (p - a) / (b - a));
  }

  frame() {
    const now = performance.now(),
      vh = innerHeight;
    let t = 0;
    for (let i = 0; i < this.secs.length; i++) {
      const r = this.secs[i].getBoundingClientRect();
      if (r.top <= 0.5) {
        const span = r.height - vh;
        t = i + (span > 0 ? cl(-r.top / span) : 1);
      }
    }
    for (const s of this.shows) {
      const p = t - s.sec;
      let o = this.ramp(p, s.r[0], s.r[1]) * (1 - this.ramp(p, s.r[2], s.r[3]));
      if (s.intro && !this.still.matches)
        o *= sm(0, 1, (now - this.t0 - s.intro) / 1000);
      const st = s.el.style;
      st.opacity = o.toFixed(3);
      st.visibility = o < 0.005 ? "hidden" : "visible";
      if (s.shift) st.transform = `translateY(${((1 - o) * 22).toFixed(1)}px)`;
      if (s.inter) st.pointerEvents = o > 0.5 ? "auto" : "none";
    }
    let i = 0;
    while (i < BG.length - 2 && t > BG[i + 1][0]) i++;
    const e = cl((t - BG[i][0]) / (BG[i + 1][0] - BG[i][0]));
    const c = BG[i][1].map((v, k) => Math.round(v + (BG[i + 1][1][k] - v) * e));
    this.$("sp-bg").style.background = `rgb(${c})`;

    const K = this.K;
    let a = K[0],
      b = K[0],
      f = 0;
    if (t >= K[K.length - 1][0]) a = b = K[K.length - 1];
    else
      for (let j = 0; j < K.length - 1; j++)
        if (t >= K[j][0] && t <= K[j + 1][0]) {
          a = K[j];
          b = K[j + 1];
          f = sm(0, 1, (t - a[0]) / (b[0] - a[0]));
          break;
        }
    const S = a.map((v, k) => v + (b[k] - v) * f);
    this.$("sp-grid").style.opacity = S[8].toFixed(3);
    if (!this.renderer) return;

    const still = this.still.matches;
    const intro = still
      ? 1
      : 1 - Math.pow(1 - cl((now - this.t0 - 150) / 2200), 3);
    const time = now / 1000;
    const p2 = t - 2,
      q = cl((p2 - 0.1) / 0.8);
    const amp = still ? 0 : sm(0, 0.12, p2) * (1 - sm(0.9, 1, p2));
    const sway = amp * 0.09 * Math.exp(-3.2 * q) * Math.cos(10 * q);
    const float = still
      ? 0
      : 0.012 * this.halfH * Math.sin(time * 0.9) * (1 - S[9]) * (1 - S[8]);
    this.root.position.set(
      S[1] * this.halfW,
      S[2] * this.halfH + float - (1 - intro) * 0.3 * this.halfH,
      0,
    );
    this.root.scale.setScalar(S[6] * (0.93 + 0.07 * intro));
    this.rot.rotation.set(S[3], S[4], S[5] + sway + (1 - intro) * 0.25);
    this.pivot.position.copy(this.bowlC).multiplyScalar(-S[9]);
    const ex = S[7];
    this.full.visible = ex < 0.002;
    this.parts.forEach((m) => (m.visible = ex >= 0.002));
    this.parts[0].position.set(-0.95 * ex, -0.04 * ex, 0);
    this.parts[0].rotation.z = 0.05 * ex;
    this.parts[1].position.set(0, 0.34 * ex, 0);
    this.parts[2].position.set(0.95 * ex, 0.06 * ex, 0);
    this.parts[2].rotation.z = -0.03 * ex;
    this.mat.opacity = intro * (1 - 0.88 * S[8]);
    this.wire.material.opacity = S[8] * 0.85;
    this.wire.visible = S[8] > 0.002;
    this.root.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.cam);
    this.annotate(t, S);
  }

  pr(p, obj) {
    const v = this.v.set(p[0], p[1], p[2]);
    (obj || this.pivot).localToWorld(v);
    v.project(this.cam);
    return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
  }
  L(id, a, b) {
    const e = this.$(id);
    e.setAttribute("x1", a[0]);
    e.setAttribute("y1", a[1]);
    e.setAttribute("x2", b[0]);
    e.setAttribute("y2", b[1]);
  }
  A(id, o) {
    const e = this.$(id);
    for (const k in o) e.setAttribute(k, o[k]);
  }

  annotate(t, S) {
    const p1 = t - 1;
    if (p1 > -0.1 && p1 < 1.1) {
      const C = this.pr(this.C(0.3)),
        B = this.pr(this.C(0.6)),
        Ar = this.pr([(0.6 - 0.5) * LEN - this.cx, BASE(0.3) - this.cy, 0]);
      const ext = (P, k) => [
        C[0] + (P[0] - C[0]) * k,
        C[1] + (P[1] - C[1]) * k,
      ];
      const dp = sm(0, 1, (p1 - 0.1) / 0.28);
      const B2 = ext(B, 1.3),
        A2 = ext(Ar, 1.3);
      this.L("m-ref", C, A2);
      this.L("m-arm", C, B2);
      const armLen = Math.hypot(B2[0] - C[0], B2[1] - C[1]);
      this.$("m-arm").style.strokeDasharray = armLen;
      this.$("m-arm").style.strokeDashoffset = armLen * (1 - dp);
      const r = 0.72 * Math.hypot(B[0] - C[0], B[1] - C[1]);
      const aA = Math.atan2(Ar[1] - C[1], Ar[0] - C[0]),
        aB = Math.atan2(B[1] - C[1], B[0] - C[0]);
      const pA = [C[0] + r * Math.cos(aA), C[1] + r * Math.sin(aA)],
        pB = [C[0] + r * Math.cos(aB), C[1] + r * Math.sin(aB)];
      this.A("m-arc", {
        d: `M${pA[0]},${pA[1]} A${r},${r} 0 0 0 ${pB[0]},${pB[1]}`,
      });
      const al = r * Math.abs(aB - aA);
      this.$("m-arc").style.strokeDasharray = al;
      this.$("m-arc").style.strokeDashoffset =
        al * (1 - sm(0, 1, (p1 - 0.2) / 0.2));
      this.A("m-dot", { cx: C[0], cy: C[1] });
      const am = (aA + aB) / 2;
      this.A("m-label", {
        x: C[0] + (r + 16) * Math.cos(am),
        y: C[1] + (r + 16) * Math.sin(am) + 4,
      });
      this.$("m-label").style.opacity = sm(0, 1, (p1 - 0.32) / 0.08);
      this.$("g-arc").style.color = S[8] > 0.5 ? "#e8edf2" : "#1d1d1f";
      const yLow = BASE(0.17) - DEP(0.17) - this.cy - 0.55;
      const x0 = -0.5 * LEN - this.cx,
        x1 = 0.5 * LEN - this.cx;
      const T0 = this.pr([x0, yLow, 0]),
        T1 = this.pr([x1, yLow, 0]);
      this.L("b-len", T0, T1);
      this.L(
        "b-e1",
        this.pr([x0, BASE(0) - this.cy - 0.1, 0]),
        this.pr([x0, yLow - 0.12, 0]),
      );
      this.L(
        "b-e2",
        this.pr([x1, BASE(1) - this.cy - 0.1, 0]),
        this.pr([x1, yLow - 0.12, 0]),
      );
      const s = 7;
      this.A("b-ar", {
        d: `M${T0[0] + s},${T0[1] - s * 0.5} L${T0[0]},${T0[1]} L${T0[0] + s},${T0[1] + s * 0.5} M${T1[0] - s},${T1[1] - s * 0.5} L${T1[0]},${T1[1]} L${T1[0] - s},${T1[1] + s * 0.5}`,
      });
      this.A("b-len-t", { x: (T0[0] + T1[0]) / 2, y: T0[1] + 22 });
      this.L(
        "b-cl",
        this.pr([x0 - 0.3, BASE(0) - this.cy - DEP(0.17) * 0.5, 0]),
        this.pr([this.C(0.32)[0], BASE(0) - this.cy - DEP(0.17) * 0.5, 0]),
      );
      const R0 = this.pr([
        this.C(0.1)[0],
        BASE(0.1) - DEP(0.1) - TH(0.1) / 2 - this.cy,
        0,
      ]);
      const R1 = [R0[0] - 50, R0[1] + 46],
        R2 = [R1[0] - 40, R1[1]];
      this.A("b-r", { points: `${R0} ${R1} ${R2}` });
      this.A("b-r-t", { x: R2[0] - 8, y: R2[1] + 4 });
      const H0 = this.pr(this.C(0.8, TH(0.8) / 2)),
        H1 = [H0[0] + 40, H0[1] - 54],
        H2 = [H1[0] + 40, H1[1]];
      this.A("b-t", { points: `${H0} ${H1} ${H2}` });
      this.A("b-t-t", { x: H2[0] + 8, y: H2[1] + 4 });
    }
    const p2 = t - 2;
    if (p2 > -0.1 && p2 < 1.1) {
      const O = this.pr([0, 0, 0]);
      const U = this.pr([
        0,
        BASE(this.ucog) - DEP(this.ucog) - TH(this.ucog) / 2 - this.cy - 0.02,
        0,
      ]);
      const top = [O[0], O[1] - Math.max(70, innerHeight * 0.12)];
      this.L("c-v", top, [O[0], U[1] + 24]);
      this.A("c-c", { cx: O[0], cy: O[1] });
      const r = 9;
      this.A("c-q", {
        d: `M${O[0]},${O[1]} L${O[0] + r},${O[1]} A${r},${r} 0 0 0 ${O[0]},${O[1] - r} Z M${O[0]},${O[1]} L${O[0] - r},${O[1]} A${r},${r} 0 0 0 ${O[0]},${O[1] + r} Z`,
      });
      this.A("c-tri", {
        d: `M${U[0]},${U[1] + 2} L${U[0] - 14},${U[1] + 26} L${U[0] + 14},${U[1] + 26} Z`,
      });
      this.L("c-base", [U[0] - 34, U[1] + 26.5], [U[0] + 34, U[1] + 26.5]);
      this.A("c-t1", { x: top[0], y: top[1] - 22 });
      this.A("c-t2", { x: top[0], y: top[1] - 6 });
    }
    const p3 = t - 3;
    if (p3 > 0.6 && p3 < 1.1) {
      const B = this.pr([this.bowlC.x - 0.12, this.bowlC.y + 0.02, 0.08]);
      const lr = this.$("sp-loupe").firstElementChild.getBoundingClientRect();
      const cxl = lr.left + lr.width / 2,
        cyl = lr.top + lr.height / 2,
        rad = lr.width / 2;
      const dx = B[0] - cxl,
        dy = B[1] - cyl,
        dl = Math.hypot(dx, dy) || 1;
      this.L("l-lead", B, [cxl + (dx / dl) * rad, cyl + (dy / dl) * rad]);
      this.A("l-dot", { cx: B[0], cy: B[1] });
    }
    const p4 = t - 4;
    if (p4 > 0.4 && p4 < 1.05) {
      const anchors = [
        this.C(0.17, -DEP(0.17) + TH(0.17)),
        this.C(0.43, TH(0.43) / 2),
        this.C(0.76, TH(0.76) / 2),
      ];
      anchors.forEach((pt, k) => {
        const A0 = this.pr(pt, this.parts[k]);
        const o = this.labOff[k],
          Lp = [A0[0] + o[0], A0[1] + o[1]];
        const el = this.$("x-lab" + k);
        // Keep the centered label on screen (narrow phones clip the BOWL caption).
        const half = el.firstElementChild.offsetWidth / 2 + 8;
        Lp[0] = Math.min(Math.max(Lp[0], half), innerWidth - half);
        this.L("x-l" + k, A0, Lp);
        this.A("x-d" + k, { cx: A0[0], cy: A0[1] });
        el.style.left = Lp[0] + "px";
        el.style.top = Lp[1] + "px";
      });
    }
  }

  drawMicro() {
    const c = this.$("sp-micro");
    if (!c) return;
    const S = 420;
    c.width = S;
    c.height = S;
    const ctx = c.getContext("2d"),
      img = ctx.createImageData(S, S),
      d = img.data;
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const N = 64,
      sd = [];
    for (let i = 0; i < N; i++)
      sd.push([
        rnd() * S,
        rnd() * S,
        130 + rnd() * 80,
        rnd() * Math.PI,
        rnd(),
        14 + rnd() * 18,
      ]);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let d1 = 1e9,
          d2 = 1e9,
          i1 = 0;
        for (let i = 0; i < N; i++) {
          const dx = x - sd[i][0],
            dy = y - sd[i][1],
            dd = dx * dx + dy * dy;
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
            i1 = i;
          } else if (dd < d2) d2 = dd;
        }
        const g = sd[i1];
        let v = g[2];
        const edge = Math.sqrt(d2) - Math.sqrt(d1);
        if (g[4] > 0.55) {
          const s = x * Math.cos(g[3]) + y * Math.sin(g[3]);
          if (((s % g[5]) + g[5]) % g[5] < 4) v *= 1.12;
        }
        if (edge < 2.4) v *= 0.35 + 0.65 * (edge / 2.4);
        v += (rnd() - 0.5) * 14;
        const rr = Math.hypot(x - S / 2, y - S / 2) / (S / 2);
        v *= 1 - 0.35 * rr * rr;
        const o = (y * S + x) * 4;
        d[o] = v * 0.95;
        d[o + 1] = v * 0.97;
        d[o + 2] = v;
        d[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  }
}

new Component().mount();
