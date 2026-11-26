// The field: North Star's flow field (its AmbientField), the one source for everything drawn from it — the ASCII
// backdrop (backdrop.js) and the colour cursor (mark.js). GLSL ES 1.0 (WebGL 1).
//
// FIELD_GLSL defines `vec4 flow(vec2 p)`: rgb is the colour, a the ink (how much of a glyph to print). It needs these
// uniforms declared by the shader that includes it: float uTime; vec3 uStops[6]; vec3 uTint; float uTintMix.

export const STOPS = ['#2de2e6', '#3d7bff', '#ff3d9a', '#ff3d9a', '#ffd23f', '#2de2e6']; // cyan → blue → magenta → yellow → cyan

export const FIELD_GLSL = `
const float PI = 3.14159265;
const float LIFE = 9.0;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = ROT * p * 2.03; a *= 0.5; }
  return v;
}
float generation(vec2 p, vec2 r, float seed, float age) {
  vec2 dir = normalize(vec2(hash(vec2(seed, 1.3)) - 0.5, hash(vec2(seed, 7.9)) - 0.5) + 1e-3);
  vec2 off = vec2(seed * 17.31, seed * 9.17) + dir * age * 0.35;
  vec2 w = ROT * p + (r - 0.5) * 1.8 + off;
  float strands = fbm(vec2(w.x * 0.7 + age * 0.4, w.y * 8.0));
  float body = smoothstep(0.4, 0.7, fbm(w * vec2(0.6, 1.8) + 2.0 * r));
  float shape = smoothstep(0.38, 0.78, strands) * body;
  float env = smoothstep(0.0, 0.55, age) * (1.0 - smoothstep(1.25, 2.0, age));
  float swell = 0.55 + 0.75 * sin(PI * clamp(age / 2.0, 0.0, 1.0));
  return shape * env * swell;
}
vec3 ribbon(float x) {
  x = fract(x) * 5.0;
  float k = floor(x), f = x - k;
  vec3 a = k < 0.5 ? uStops[0] : k < 1.5 ? uStops[1] : k < 2.5 ? uStops[2] : k < 3.5 ? uStops[3] : uStops[4];
  vec3 b = k < 0.5 ? uStops[1] : k < 1.5 ? uStops[2] : k < 2.5 ? uStops[3] : k < 3.5 ? uStops[4] : uStops[5];
  return mix(a, b, f);
}
vec4 flow(vec2 p) {
  float t = uTime * 0.09;
  vec2 q = vec2(fbm(p * 1.2 + vec2(0.0, t)), fbm(p * 1.2 + vec2(5.2, -t * 0.8)));
  vec2 r = vec2(fbm(p * 1.1 + 3.0 * q + vec2(1.7 + t * 0.6, 9.2)), fbm(p * 1.1 + 3.0 * q + vec2(8.3, 2.8 - t * 0.5)));
  float gen = uTime / LIFE;
  float g = floor(gen);
  float ph = fract(gen);
  float older = generation(p, r, g, ph + 1.0);
  float younger = generation(p, r, g + 1.0, ph);
  float lum = clamp(max(older, younger), 0.0, 1.0);
  vec3 hue = ribbon(0.18 + q.x * 1.1 + r.y * 0.9 + lum * 0.35 - t * 0.25);
  float whiteOlder = step(hash(vec2(g, 3.7)), 0.3) * step(2.0, g);
  float whiteYounger = step(hash(vec2(g + 1.0, 3.7)), 0.3) * step(2.0, g + 1.0);
  float white = (whiteOlder * older + whiteYounger * younger) / (older + younger + 1e-4);
  white = max(white, smoothstep(0.7, 0.78, fbm(p * 1.6 + r * 2.0 + vec2(7.0, 3.0) + t * 0.3)));
  hue = mix(hue, vec3(1.0), white);
  hue = mix(hue, uTint, uTintMix);
  return vec4(hue * (0.6 + 0.4 * lum), lum * mix(1.0, 0.8, white));
}`;

export const QUAD_VS = `
attribute vec2 aPos;
varying vec2 vUv;
uniform vec2 uUvScale;
void main() { vUv = (aPos * 0.5 + 0.5) * uUvScale; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Colours in linear light, as the field mixes them (three.js's Color does the same).
export const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const hexLin = (h) => [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
export const toSrgb = (v) => { v = Math.min(1, Math.max(0, v)); return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; };
export const STOPS_LINEAR = new Float32Array(STOPS.flatMap(hexLin));

// Compile and link a program from the quad vertex shader and a fragment shader; its uniforms by name.
export function program(gl, fs, vs = QUAD_VS) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

// A full-screen quad in attribute 0.
export function quad(gl) {
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
}
