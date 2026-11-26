// ATEM's mark: a terminal block cursor (a 1:2 cell). Every product has two:
//   solid  — the cursor in the product's colour, blinking (white ATEM, cyan North Star, red Orrery);
//   colour — the cursor filled with the field's colours (field.js), never blinking: all of them for ATEM, the product's
//            shades for the others (tokens.js `ramp`); flowing, or one frozen frame (`still`) for print and files.
//
//   import * as mark from '@atem-lab/kit/mark.js';
//   mark.icon(ctx, 32, { product: 'ns' });                                    // a favicon
//   mark.icon(ctx, 180, { product: 'atem', variant: 'colour', mode: 'bleed' });
//   function frame(t) { mark.step(); ...draw with on: blinkOn(t)...; requestAnimationFrame(frame); }
// Text needs fonts.css loaded first (document.fonts.load).
import { FIELD_GLSL, STOPS_LINEAR, toSrgb, program, quad } from './field.js';
import { products, blinkOn } from './tokens.js';

export { products, blinkOn };

// ── The field on a 96×96 grid over 1.5 units, read back so any canvas can take a window of it. One per product, each
// started at its own moment.
const field = (() => {
  const GW = 96, GH = 96, SW = 36, SH = 72, FPS = 30, GAIN = 1.4;
  const api = { tick: 0, step: () => false, get: () => null };
  if (typeof document === 'undefined') return api;
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const gl = cv.getContext('webgl', { antialias: false });
  if (!gl) return api;
  let prog;
  try {
    prog = program(gl, `precision highp float;
varying vec2 vUv; uniform float uTime; uniform vec3 uStops[6]; uniform vec3 uTint; uniform float uTintMix;
${FIELD_GLSL}
void main() { gl_FragColor = vec4(flow((vUv - 0.5) * 1.5).rgb, 1.0); }`);
  } catch { return api; }
  gl.useProgram(prog.p);
  quad(gl);
  gl.uniform2f(prog.u.uUvScale, 1, 1);
  gl.uniform3fv(prog.u.uStops, STOPS_LINEAR);
  gl.uniform3fv(prog.u.uTint, [1, 1, 1]);
  gl.uniform1f(prog.u.uTintMix, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, GW, GH);

  const SEEDS = { atem: 14, ns: 51, g: 88 };
  const fields = new Map();
  let ft = -1;
  const start = performance.now();

  function render(f, t) {
    gl.uniform1f(prog.u.uTime, t);
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
  return api;
})();

function hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, mx ? d / mx : 0, mx];
}

/** Advance the flowing fields to now; call once per animation frame. True when they moved. */
export const step = () => field.step();
/** Counts the fields' frames: redraw a flowing colour cursor when it changes. */
export const tick = () => field.tick;

// A product's shades: the field's hue picks a place along the product's ramp (pale where the field is white).
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const RAMPS = {};
for (const k in products) if (products[k].ramp) RAMPS[k] = products[k].ramp.map(hex);
function tone(ramp, r, g, b) {
  const [h, s, v] = hsv(r, g, b);
  let t = 1 - Math.abs(2 * h - 1);
  t = t * s + 0.72 * (1 - s);
  t = Math.min(0.999, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.floor(t), f = t - i, a = ramp[i], c = ramp[i + 1];
  const k = 0.85 + 0.15 * v;
  return [(a[0] + (c[0] - a[0]) * f) * k, (a[1] + (c[1] - a[1]) * f) * k, (a[2] + (c[2] - a[2]) * f) * k];
}

// The colour cursor: the window's colours as one smooth wash across the whole rectangle.
let washCv, washCtx, washImg;
export function wash(ctx, x, y, w, h, product = 'atem', still = false) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const f = field.get(product, still);
  if (!f) { ctx.fillStyle = products[product].ink; ctx.fillRect(x, y, w, h); ctx.restore(); return; }
  if (!washCv) { washCv = document.createElement('canvas'); washCv.width = 12; washCv.height = 24; washCtx = washCv.getContext('2d'); washImg = washCtx.createImageData(12, 24); }
  const ramp = RAMPS[product];
  for (let j = 0; j < 24; j++) for (let i = 0; i < 12; i++) {
    let c = field.sample(f, (i + 0.5) / 12, (j + 0.5) / 24);
    if (ramp) c = tone(ramp, c[0], c[1], c[2]);
    const q = (j * 12 + i) * 4;
    washImg.data[q] = c[0] * 255; washImg.data[q + 1] = c[1] * 255; washImg.data[q + 2] = c[2] * 255; washImg.data[q + 3] = 255;
  }
  washCtx.putImageData(washImg, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(washCv, 0.5, 0.5, 11, 23, x, y, w, h);
  ctx.restore();
}

/**
 * An icon, px device pixels square.
 *   mode 'fav':   a black rounded square, the cursor 6×12 on its 16-px grid (x 5, y 2): sharp at 16, 32 and 48.
 *   mode 'bleed': a full black square (iOS, Android and macOS round the corners themselves), the cursor 44 % tall.
 * on: false draws the blink's off frame (solid only; the colour cursor never blinks).
 */
export function icon(ctx, px, { product = 'atem', variant = 'solid', still = false, mode = 'fav', on = true } = {}) {
  const B = mode === 'fav' ? 16 : 100, k = px / B;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, px, px); ctx.scale(k, k);
  ctx.fillStyle = '#000';
  if (mode === 'fav') { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(0, 0, 16, 16, 3.5) : ctx.rect(0, 0, 16, 16); ctx.fill(); }
  else ctx.fillRect(0, 0, B, B);
  const [x, y, w, h] = mode === 'fav' ? [5, 2, 6, 12] : [39, 28, 22, 44];
  if (variant === 'colour') wash(ctx, x, y, w, h, product, still);
  else if (on) { ctx.fillStyle = products[product].ink; ctx.fillRect(x, y, w, h); }
  ctx.restore();
}

// The name, as the site sets it: atem in Michroma; for a product a slash and its label in its own face; then the cursor,
// 0.52 × 1.04 em of the mono size m, on the baseline.
const productFont = (p, m) => (products[p].face === 'major' ? `400 ${0.9 * m}px "Major Mono Display"` : `400 ${m}px "JetBrains Mono"`);
const productSpacing = (p, m) => (products[p].face === 'major' ? '0px' : `${-0.045 * m}px`);
function layout(ctx, m, product) {
  ctx.font = `400 ${0.82 * m}px Michroma`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.04 * 0.82 * m}px`;
  const atemW = ctx.measureText('atem').width;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  let cx = atemW;
  if (product !== 'atem') {
    cx += 0.56 * m;
    ctx.font = productFont(product, m);
    if ('letterSpacing' in ctx) ctx.letterSpacing = productSpacing(product, m);
    cx += ctx.measureText(products[product].label).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  cx += 0.06 * m;
  return { atemW, cursorX: cx, width: cx + 0.52 * m };
}
/** The name's width at mono size m. */
export const wordWidth = (ctx, { m, product = 'atem' }) => layout(ctx, m, product).width;
/** The name, its baseline at `base`. Returns its width. */
export function word(ctx, { m, x = 0, base, product = 'atem', variant = 'solid', still = false, on = true, light = false }) {
  const L = layout(ctx, m, product), P = products[product];
  const ink = light ? '#111111' : '#ffffff', toneInk = product === 'atem' ? ink : P.ink;
  ctx.save();
  ctx.font = `400 ${0.82 * m}px Michroma`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${-0.04 * 0.82 * m}px`;
  ctx.fillStyle = product === 'atem' ? ink : '#8a8a8a';
  ctx.fillText('atem', x, base);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  if (product !== 'atem') {
    ctx.save(); ctx.fillStyle = toneInk; ctx.translate(x + L.atemW + 0.28 * m, base - 0.893 * m + 0.5225 * m); ctx.rotate(16 * Math.PI / 180);
    ctx.fillRect(-0.05 * m, -0.5225 * m, 0.1 * m, 1.045 * m); ctx.restore();
    ctx.font = productFont(product, m);
    if ('letterSpacing' in ctx) ctx.letterSpacing = productSpacing(product, m);
    ctx.fillStyle = toneInk; ctx.fillText(P.label, x + L.atemW + 0.56 * m, base);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }
  const cx = x + L.cursorX, top = base - 0.86 * m, w = 0.52 * m, h = 1.04 * m;
  if (variant === 'colour') wash(ctx, cx, top, w, h, product, still);
  else if (on) { ctx.fillStyle = toneInk; ctx.fillRect(cx, top, w, h); }
  ctx.restore();
  return L.width;
}

/** The link preview, drawn into W × H (designed at 1200 × 630): the name with the still colour cursor. */
export function og(ctx, W, H, product = 'atem') {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  ctx.scale(W / 1200, H / 630);
  const m = product === 'atem' ? 170 : 104;
  word(ctx, { m, x: 100, base: product === 'atem' ? 360 : 345, product, variant: 'colour', still: true });
  ctx.font = '500 26px "Geist Mono"'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2.6px';
  ctx.fillStyle = '#8a8a8a';
  ctx.fillText(product === 'atem' ? 'ATEM-LAB.COM' : `ATEM-LAB.COM/${products[product].slug.toUpperCase()}`, 100, 548);
  if (product === 'atem') {
    ctx.textAlign = 'right';
    ctx.fillStyle = products.ns.ink; ctx.fillText('NORTH STAR', 910, 548);
    ctx.fillStyle = products.g.ink; ctx.fillText('ORRERY', 1100, 548);
  }
  ctx.restore();
}

/** The favicon as SVG, for a product (solid, on its 16-px grid). */
export const faviconSvg = (product = 'atem') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3.5"/><rect x="5" y="2" width="6" height="12" fill="${products[product].ink}"/></svg>`;
