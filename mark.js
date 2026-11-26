// ATEM's mark: a terminal block cursor (a 1:2 cell). Every product has two:
//   solid  — the cursor in the product's colour, blinking (white ATEM, cyan North Star, red Orrery);
//   colour — the cursor filled with the home page's field (backdrop.js), its colours only, never blinking: all of the
//            ribbon for ATEM, shades of blue for North Star, shades of red for Orrery; flowing, or one frozen frame.
// window.atemMark: { PRODUCTS, blinkOn(t), icon(ctx, px, opts), word(ctx, opts), wordWidth(ctx, opts), og(ctx, W, H, product), step() }
window.atemMark = (() => {
  const PRODUCTS = {
    atem: { name: 'ATEM', ink: '#ffffff', ramp: null },
    ns: { name: 'North Star', ink: '#2de2e6', ramp: ['#0b2a73', '#1f5fff', '#2de2e6', '#b4fdff'], text: 'north-star' },
    g: { name: 'Orrery', ink: '#e8264f', ramp: ['#5a0718', '#b3123c', '#e8264f', '#ff6f8a'], text: 'orrery' },
  };
  // The site's blink: on for 55 % of 1.1 s.
  const blinkOn = (t) => (t % 1100) < 605;

  // ── The field: backdrop.js's shader (untinted, without its top fade), on a 96×96 grid over 1.5 units, read back so
  // any canvas can take a window of it. One field per product, each started at its own moment.
  const FIELD = (() => {
    const GW = 96, GH = 96, SW = 36, SH = 72, FPS = 30, GAIN = 1.4;
    const STOPS = ['#2de2e6', '#3d7bff', '#ff3d9a', '#ff3d9a', '#ffd23f', '#2de2e6'];
    const api = { tick: 0, step() {}, get: () => null };
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const gl = cv.getContext('webgl', { antialias: false, preserveDrawingBuffer: false });
    if (!gl) return api;
    const vs = 'attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';
    const fs = `precision highp float;
varying vec2 vUv; uniform float uTime; uniform vec3 uStops[6];
const float PI = 3.14159265; const float LIFE = 9.0;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p = ROT*p*2.03; a *= 0.5; } return v; }
float generation(vec2 p, vec2 r, float seed, float age){
  vec2 dir = normalize(vec2(hash(vec2(seed,1.3))-0.5, hash(vec2(seed,7.9))-0.5)+1e-3);
  vec2 off = vec2(seed*17.31, seed*9.17) + dir*age*0.35;
  vec2 w = ROT*p + (r-0.5)*1.8 + off;
  float strands = fbm(vec2(w.x*0.7 + age*0.4, w.y*8.0));
  float body = smoothstep(0.4, 0.7, fbm(w*vec2(0.6,1.8) + 2.0*r));
  float shape = smoothstep(0.38, 0.78, strands)*body;
  float env = smoothstep(0.0, 0.55, age)*(1.0 - smoothstep(1.25, 2.0, age));
  float swell = 0.55 + 0.75*sin(PI*clamp(age/2.0, 0.0, 1.0));
  return shape*env*swell; }
vec3 ribbon(float x){ x = fract(x)*5.0; float k = floor(x), f = x-k;
  vec3 a = k<0.5?uStops[0]:k<1.5?uStops[1]:k<2.5?uStops[2]:k<3.5?uStops[3]:uStops[4];
  vec3 b = k<0.5?uStops[1]:k<1.5?uStops[2]:k<2.5?uStops[3]:k<3.5?uStops[4]:uStops[5];
  return mix(a, b, f); }
void main(){
  vec2 p = (vUv-0.5)*1.5;
  float t = uTime*0.09;
  vec2 q = vec2(fbm(p*1.2+vec2(0.0,t)), fbm(p*1.2+vec2(5.2,-t*0.8)));
  vec2 r = vec2(fbm(p*1.1+3.0*q+vec2(1.7+t*0.6,9.2)), fbm(p*1.1+3.0*q+vec2(8.3,2.8-t*0.5)));
  float gen = uTime/LIFE; float g = floor(gen); float ph = fract(gen);
  float older = generation(p, r, g, ph+1.0); float younger = generation(p, r, g+1.0, ph);
  float lum = clamp(max(older, younger), 0.0, 1.0);
  vec3 hue = ribbon(0.18 + q.x*1.1 + r.y*0.9 + lum*0.35 - t*0.25);
  float wo = step(hash(vec2(g,3.7)),0.3)*step(2.0,g); float wy = step(hash(vec2(g+1.0,3.7)),0.3)*step(2.0,g+1.0);
  float white = (wo*older + wy*younger)/(older+younger+1e-4);
  white = max(white, smoothstep(0.7, 0.78, fbm(p*1.6 + r*2.0 + vec2(7.0,3.0) + t*0.3)));
  hue = mix(hue, vec3(1.0), white);
  gl_FragColor = vec4(hue*(0.6+0.4*lum), 1.0); }`;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return api;
      gl.attachShader(prog, sh);
    }
    gl.bindAttribLocation(prog, 0, 'aPos'); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    gl.uniform3fv(gl.getUniformLocation(prog, 'uStops'), new Float32Array(STOPS.flatMap((h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255)))));
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, GW, GH);

    const toSrgb = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
    const hsv = (r, g, b) => {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let h = 0;
      if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return [h / 6, mx ? d / mx : 0, mx];
    };
    const SEEDS = { atem: 14, ns: 51, g: 88 };
    const fields = new Map();
    let ft = -1;
    const start = performance.now();

    function render(f, t) {
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.readPixels(0, 0, GW, GH, gl.RGBA, gl.UNSIGNED_BYTE, f.data);
      // The window: the place with the most different colours; re-chosen every 2.5 s, moved to only when the current
      // place has gone dull, and glided to.
      const colourful = (wx, wy) => {
        const bins = new Set(); let light = 0;
        for (let y = wy; y < wy + SH; y += 6) for (let x = wx; x < wx + SW; x += 6) {
          const i = (y * GW + x) * 4, [h, s, v] = hsv(f.data[i], f.data[i + 1], f.data[i + 2]);
          if (s > 0.25) bins.add(Math.floor(h * 12)); light += v;
        }
        return bins.size + light / 400;
      };
      const now = performance.now();
      if (f.tx < 0 || now - f.chosenAt > 2500) {
        let best = -1, bx = 0, by = 0;
        for (let y = 0; y <= GH - SH; y += 6) for (let x = 0; x <= GW - SW; x += 6) { const n = colourful(x, y); if (n > best) { best = n; bx = x; by = y; } }
        f.score = best;
        if (f.tx < 0) { f.wx = bx; f.wy = by; }
        if (f.tx < 0 || colourful(Math.round(f.wx), Math.round(f.wy)) < best * 0.7) { f.tx = bx; f.ty = by; }
        f.chosenAt = now;
      }
      f.wx += (f.tx - f.wx) * 0.04; f.wy += (f.ty - f.wy) * 0.04;
    }
    // still: the most colourful of many moments, frozen
    api.get = (product, still) => {
      const key = product + (still ? '|still' : '');
      let f = fields.get(key);
      if (!f) {
        f = { data: new Uint8Array(GW * GH * 4), wx: 0, wy: 0, tx: -1, ty: -1, chosenAt: 0, still, seed: SEEDS[product] || 0 };
        fields.set(key, f);
        if (still) {
          let bestT = f.seed, best = -1;
          for (let t = f.seed; t < f.seed + 150; t += 2.3) { f.tx = -1; render(f, t); if (f.score > best) { best = f.score; bestT = t; } }
          f.tx = -1; render(f, bestT);
        } else render(f, f.seed + Math.max(0, ft));
      }
      f.used = true;
      return f;
    };
    api.step = () => {
      const t = Math.floor(((performance.now() - start) / 1000) * FPS) / FPS;
      if (t === ft) return false;
      ft = t; api.tick++;
      for (const f of fields.values()) { if (f.used && !f.still) render(f, f.seed + t); f.used = false; }
      return true;
    };
    // u, v in 0..1 across the window (v from the top) → sRGB 0..1, pushed to full brightness
    api.sample = (f, u, v) => {
      const x = Math.min(GW - 1, Math.floor(f.wx + u * SW)), y = Math.min(GH - 1, Math.max(0, Math.floor(f.wy + SH - 1 - v * SH)));
      const i = (y * GW + x) * 4, d = f.data;
      let r = toSrgb(d[i] / 255 * GAIN), g = toSrgb(d[i + 1] / 255 * GAIN), b = toSrgb(d[i + 2] / 255 * GAIN);
      const mx = Math.max(r, g, b, 0.05); r /= mx; g /= mx; b /= mx;
      const l = (r + g + b) / 3; r = l + (r - l) * 1.15; g = l + (g - l) * 1.15; b = l + (b - l) * 1.15;
      return [Math.min(1, Math.max(0, r)), Math.min(1, Math.max(0, g)), Math.min(1, Math.max(0, b))];
    };
    api.hsv = hsv;
    return api;
  })();

  // A product's shades: the field's hue picks a place along the product's ramp (pale where the field is white).
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const RAMPS = {};
  for (const k in PRODUCTS) if (PRODUCTS[k].ramp) RAMPS[k] = PRODUCTS[k].ramp.map(hex);
  function tone(ramp, r, g, b) {
    const [h, s, v] = FIELD.hsv(r, g, b);
    let t = 1 - Math.abs(2 * h - 1);
    t = t * s + 0.72 * (1 - s);
    t = Math.min(0.999, Math.max(0, t)) * (ramp.length - 1);
    const i = Math.floor(t), f = t - i, a = ramp[i], c = ramp[i + 1];
    const k = 0.85 + 0.15 * v;
    return [(a[0] + (c[0] - a[0]) * f) * k, (a[1] + (c[1] - a[1]) * f) * k, (a[2] + (c[2] - a[2]) * f) * k];
  }

  // The colour cursor: the window's colours as one smooth wash across the whole rectangle.
  const washCv = document.createElement('canvas'); washCv.width = 12; washCv.height = 24;
  const washCtx = washCv.getContext('2d'); const washImg = washCtx.createImageData(12, 24);
  function wash(ctx, x, y, w, h, product, still) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const f = FIELD.get(product, still);
    if (!f) { ctx.fillStyle = PRODUCTS[product].ink; ctx.fillRect(x, y, w, h); ctx.restore(); return; }
    const ramp = RAMPS[product];
    for (let j = 0; j < 24; j++) for (let i = 0; i < 12; i++) {
      let c = FIELD.sample(f, (i + 0.5) / 12, (j + 0.5) / 24);
      if (ramp) c = tone(ramp, c[0], c[1], c[2]);
      const q = (j * 12 + i) * 4;
      washImg.data[q] = c[0] * 255; washImg.data[q + 1] = c[1] * 255; washImg.data[q + 2] = c[2] * 255; washImg.data[q + 3] = 255;
    }
    washCtx.putImageData(washImg, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(washCv, 0.5, 0.5, 11, 23, x, y, w, h);
    ctx.restore();
  }

  // An icon, px device pixels square.
  //   mode 'fav':   a black rounded square, the cursor 6×12 on its 16-px grid (x 5, y 2): sharp at 16, 32 and 48.
  //   mode 'bleed': a full black square (iOS, Android, macOS round its corners themselves), the cursor 44 % tall.
  function icon(ctx, px, { product = 'atem', variant = 'solid', still = false, mode = 'fav', on = true } = {}) {
    const B = mode === 'fav' ? 16 : 100, k = px / B;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, px, px); ctx.scale(k, k);
    ctx.fillStyle = '#000';
    if (mode === 'fav') { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, 16, 16, 3.5) : ctx.rect(0, 0, 16, 16); ctx.fill(); }
    else ctx.fillRect(0, 0, B, B);
    const [x, y, w, h] = mode === 'fav' ? [5, 2, 6, 12] : [39, 28, 22, 44];
    if (variant === 'colour') wash(ctx, x, y, w, h, product, still);
    else if (on) { ctx.fillStyle = PRODUCTS[product].ink; ctx.fillRect(x, y, w, h); }
    ctx.restore();
  }

  // The name, as the site sets it: atem in Michroma; for a product a slash and its name in its own face; then the
  // cursor, 0.52 × 1.04 em of the mono size m, on the baseline.
  function layout(ctx, m, product) {
    ctx.font = `400 ${0.82 * m}px Michroma`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.04 * 0.82 * m}px`;
    const atemW = ctx.measureText('atem').width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    let cx = atemW, textW = 0;
    if (product && product !== 'atem') {
      cx += 0.56 * m;
      ctx.font = product === 'ns' ? `400 ${m}px "JetBrains Mono"` : `400 ${0.9 * m}px "Major Mono Display"`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = product === 'ns' ? `${-0.045 * m}px` : '0px';
      textW = ctx.measureText(PRODUCTS[product].text).width;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      cx += textW;
    }
    cx += 0.06 * m;
    return { atemW, cursorX: cx, width: cx + 0.52 * m };
  }
  const wordWidth = (ctx, { m, product }) => layout(ctx, m, product).width;
  function word(ctx, { m, x = 0, base, product = 'atem', variant = 'solid', still = false, on = true, light = false }) {
    const L = layout(ctx, m, product), P = PRODUCTS[product];
    const ink = light ? '#111111' : '#ffffff', tone = product === 'atem' ? ink : P.ink;
    ctx.save();
    ctx.font = `400 ${0.82 * m}px Michroma`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.04 * 0.82 * m}px`;
    ctx.fillStyle = product === 'atem' ? ink : '#8a8a8a';
    ctx.fillText('atem', x, base);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    if (product !== 'atem') {
      ctx.save(); ctx.fillStyle = tone; ctx.translate(x + L.atemW + 0.28 * m, base - 0.893 * m + 0.5225 * m); ctx.rotate(16 * Math.PI / 180);
      ctx.fillRect(-0.05 * m, -0.5225 * m, 0.1 * m, 1.045 * m); ctx.restore();
      ctx.font = product === 'ns' ? `400 ${m}px "JetBrains Mono"` : `400 ${0.9 * m}px "Major Mono Display"`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = product === 'ns' ? `${-0.045 * m}px` : '0px';
      ctx.fillStyle = tone; ctx.fillText(P.text, x + L.atemW + 0.56 * m, base);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    }
    const cx = x + L.cursorX, top = base - 0.86 * m, w = 0.52 * m, h = 1.04 * m;
    if (variant === 'colour') wash(ctx, cx, top, w, h, product, still);
    else if (on) { ctx.fillStyle = product === 'atem' ? ink : P.ink; ctx.fillRect(cx, top, w, h); }
    ctx.restore();
    return L.width;
  }

  // The link preview, 1200 × 630 units: the name with the still colour cursor.
  function og(ctx, W, H, product = 'atem') {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    ctx.scale(W / 1200, H / 630);
    const m = product === 'atem' ? 170 : 104;
    word(ctx, { m, x: 100, base: product === 'atem' ? 360 : 345, product, variant: 'colour', still: true });
    ctx.font = '500 26px "Geist Mono"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2.6px';
    ctx.fillStyle = '#8a8a8a'; ctx.fillText(product === 'ns' ? 'ATEM-LAB.COM/NORTH-STAR' : 'ATEM-LAB.COM', 100, 548);
    if (product === 'atem') {
      ctx.textAlign = 'right';
      ctx.fillStyle = PRODUCTS.ns.ink; ctx.fillText('NORTH STAR', 910, 548);
      ctx.fillStyle = PRODUCTS.g.ink; ctx.fillText('ORRERY', 1100, 548);
    }
    ctx.restore();
  }

  return { PRODUCTS, blinkOn, icon, word, wordWidth, og, step: () => FIELD.step(), get tick() { return FIELD.tick; } };
})();
