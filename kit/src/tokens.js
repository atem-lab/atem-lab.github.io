// ATEM's shared tokens. tokens.css says the same in CSS: change both together.

export const colors = {
  black: '#000000',
  white: '#ffffff',
  fg: '#e6e6e6',
  dim: '#8a8a8a',
  line: 'rgba(255, 255, 255, 0.16)',
  cyan: '#2de2e6',
  blue: '#3d7bff',
  magenta: '#ff3d9a',
  yellow: '#ffd23f',
  green: '#3dff8a',
  orrery: '#e8264f',
};

export const ease = {
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
  move: 'cubic-bezier(0.33, 1, 0.68, 1)',
};

// The products. ink: the solid cursor's colour, and the product's one colour everywhere. ramp: the shades the colour
// cursor takes from the field (null: all of the field's colours). label: the name after `atem/`, as the site writes it;
// slug: its address. face: the label's typeface.
export const products = {
  atem: { name: 'ATEM', ink: colors.white, ramp: null },
  ns: { name: 'North Star', label: 'North Star', slug: 'north-star', ink: colors.cyan, ramp: ['#0b2a73', '#1f5fff', '#2de2e6', '#b4fdff'], face: 'mono' },
  g: { name: 'Orrery', label: 'orrery', slug: 'orrery', ink: colors.orrery, ramp: ['#5a0718', '#b3123c', '#e8264f', '#ff6f8a'], face: 'major' },
};

// The cursor blinks on for 55 % of 1.1 s.
export const blink = { period: 1100, on: 0.55 };
export const blinkOn = (t) => (t % blink.period) < blink.period * blink.on;
