// The ASCII backdrop: the field (field.js) drawn at one texel per 9-device-px cell, then each screen cell prints a glyph
// from a ramp by the field's ink, in its colour. One knob of its own: a tint, the field leaning to one colour (a
// product's), eased over ~0.7 s. The field fades out toward the top of the canvas, so words above it stay clear.
//
//   import { backdrop } from '@atem-lab/kit/backdrop.js';
//   const field = backdrop(canvas);           // canvas sized by CSS; it follows its size
//   field.setTint('#2de2e6', 0.82);           // lean to a colour; setTint(null, 0) to let go
//   field.stop();                             // stop drawing
import { FIELD_GLSL, STOPS_LINEAR, hexLin, program, quad } from './field.js';

export const CELL = 9;            // device px per cell
export const RAMP = ' .·:-=+*#%@';

const FIELD_FS = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uAspect;
uniform vec3 uStops[6];
uniform float uInk;
uniform vec3 uTint;
uniform float uTintMix;
${FIELD_GLSL}
void main() {
  vec2 p = (vUv - 0.5) * uAspect;
  vec4 wave = flow(p);
  float calm = smoothstep(1.0, 0.86, vUv.y);
  gl_FragColor = vec4(wave.rgb * calm, clamp(wave.a * calm * uInk, 0.0, 1.0));
}`;

const ASCII_FS = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform vec2 uGrid;
uniform vec2 uResolution;
uniform sampler2D uGlyphs;
uniform float uCount;
uniform float uCell;
uniform float uSaturation;
uniform float uGain;
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));
}
void main() {
  vec2 px = vUv * uResolution;
  vec2 cell = floor(px / uCell);
  vec4 texel = texture2D(uScene, (cell + 0.5) / uGrid);
  vec3 c = texel.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float idx = floor(clamp(texel.a * uGain, 0.0, 0.999) * uCount);
  vec2 local = fract(px / uCell);
  float glyph = texture2D(uGlyphs, vec2((idx + local.x) / uCount, local.y)).r;
  vec3 col = min(mix(vec3(l), c, uSaturation) * uGain * glyph, vec3(1.0));
  gl_FragColor = vec4(toSrgb(col), 1.0);
}`;

export function backdrop(canvas, { fps = 30, gain = 1.4, saturation = 1, ink = 1.4, cell = CELL } = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  const none = { setTint() {}, stop() {} };
  if (!gl) return none;

  const field = program(gl, FIELD_FS);
  const ascii = program(gl, ASCII_FS);
  quad(gl);

  // Glyph atlas: white glyphs on black, one 64 px square each.
  const atlasCanvas = document.createElement('canvas');
  const atlas = gl.createTexture();
  let dirty = true;
  function drawAtlas() {
    const size = 64;
    atlasCanvas.width = size * RAMP.length;
    atlasCanvas.height = size;
    const ctx = atlasCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, atlasCanvas.width, size);
    ctx.fillStyle = '#fff';
    ctx.font = `500 ${size * 0.8}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < RAMP.length; i++) ctx.fillText(RAMP[i], i * size + size / 2, size / 2 + size * 0.04);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    dirty = true;
  }

  // The field's target: one texel per cell.
  const target = gl.createTexture();
  const fbo = gl.createFramebuffer();
  let cols = 0, rows = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
    const c = Math.ceil(w / cell), r = Math.ceil(h / cell);
    if (c !== cols || r !== rows) {
      cols = c; rows = r;
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      dirty = true;
    }
  }

  const tint = { rgb: [1, 1, 1], to: [1, 1, 1], mix: 0, target: 0 };
  function render(t) {
    const w = canvas.width, h = canvas.height;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(field.p);
    gl.uniform2f(field.u.uUvScale, (cols * cell) / w, (rows * cell) / h);
    gl.uniform1f(field.u.uTime, t);
    gl.uniform2f(field.u.uAspect, w / h, 1);
    gl.uniform3fv(field.u.uStops, STOPS_LINEAR);
    gl.uniform1f(field.u.uInk, ink);
    gl.uniform3fv(field.u.uTint, tint.rgb);
    gl.uniform1f(field.u.uTintMix, tint.mix);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(ascii.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.uniform1i(ascii.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.uniform1i(ascii.u.uGlyphs, 1);
    gl.uniform2f(ascii.u.uUvScale, 1, 1);
    gl.uniform2f(ascii.u.uGrid, cols, rows);
    gl.uniform2f(ascii.u.uResolution, w, h);
    gl.uniform1f(ascii.u.uCount, RAMP.length);
    gl.uniform1f(ascii.u.uCell, cell);
    gl.uniform1f(ascii.u.uSaturation, saturation);
    gl.uniform1f(ascii.u.uGain, gain);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawAtlas();
  if (document.fonts) document.fonts.load('500 48px "JetBrains Mono"').then(drawAtlas);

  // The tint moves toward its target by time (a ~160 ms constant: most of the way in ~0.7 s), so the change is seen.
  let tintAt = performance.now();
  const start = performance.now();
  let last = -1, raf = 0;
  function tick() {
    resize();
    const now = performance.now();
    if (tint.mix !== tint.target || tint.rgb.some((v, i) => v !== tint.to[i])) {
      const k = 1 - Math.exp(-(now - tintAt) / 160);
      tint.mix += (tint.target - tint.mix) * k;
      tint.rgb = tint.rgb.map((v, i) => v + (tint.to[i] - v) * k);
      if (Math.abs(tint.mix - tint.target) < 0.002) tint.mix = tint.target;
      if (tint.rgb.every((v, i) => Math.abs(v - tint.to[i]) < 0.002)) tint.rgb = tint.to.slice();
      dirty = true;
    }
    tintAt = now;
    const t = Math.floor(((now - start) / 1000) * fps) / fps;
    if (t !== last || dirty) { last = t; dirty = false; render(t); }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return {
    setTint(hex, amount) {
      if (hex) tint.to = hexLin(hex);
      tint.target = amount;
    },
    stop() { cancelAnimationFrame(raf); },
  };
}
