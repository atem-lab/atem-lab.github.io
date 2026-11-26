# @atem-lab/kit

ATEM's shared pieces, one source for atem-lab.com and the apps:

| File | What |
|---|---|
| `src/field.js` | The field: North Star's flow field as one GLSL source (`flow(p)`), its colour stops, WebGL helpers. |
| `src/backdrop.js` | The ASCII backdrop: the field printed as glyphs (` .·:-=+*#%@`) in 9-px cells, with a tint to lean toward a product's colour. |
| `src/mark.js` | The mark: the cursor icon, the name (`atem/North Star▮`), the link preview, the favicon SVG. |
| `src/tokens.js` · `src/tokens.css` | Colours, easings, the products (name, slug, colour, shades), the blink. |
| `src/name.css` | The name in HTML and CSS, with its blinking cursor. |
| `src/fonts.css` · `fonts/` | Michroma, JetBrains Mono, Inter, Geist Mono, Major Mono Display (SIL OFL 1.1, licences beside them). |
| `scripts/icons.mjs` | `npm run icons [out]`: every product's favicons, touch and app icons and link preview, drawn by `mark.js`. |

Plain ES modules and CSS, no build and no dependencies: they run as they are in a browser and in a bundler.

## The mark

A terminal block cursor, one cell: 1 wide, 2 tall. Every product has two:

- **solid**: the cursor in the product's colour, blinking (on 55 % of 1.1 s). ATEM white `#ffffff`, North Star cyan `#2de2e6`, Orrery red `#e8264f`.
- **colour**: the cursor filled with the field's colours, **never blinking**: all of them for ATEM, shades of blue for North Star, shades of red for Orrery. It flows on screens; `still: true` is one frozen frame for print, files and link previews.

The favicon is the solid one, still, on its 16-px grid (the cursor 6 × 12 at x 5, y 2), so it stays sharp at 16, 32 and 48 px.

## Rules

- One colour per product, the one in `tokens.js`.
- The colour cursor never blinks: the field is its motion.
- Motion always plays: nothing here reads `prefers-reduced-motion`.
- Fonts load from the same origin as the page: no third party sees a visit.

## Using it

**An app with a bundler** (North Star): install a tagged version from GitHub.

```sh
npm install github:atem-lab/kit#v0.1.0
```

```js
import { backdrop } from '@atem-lab/kit/backdrop.js';
import * as mark from '@atem-lab/kit/mark.js';
import '@atem-lab/kit/fonts.css';
```

**A static site** (atem-lab.com): a copy of a tagged version, served from the site itself, so the fonts and scripts come from its own origin.

```sh
scripts/kit.sh v0.1.0        # in the site's repo: fetches the tag into /kit/
```

```html
<link rel="stylesheet" href="/kit/src/fonts.css">
<script type="module">
  import { backdrop } from '/kit/src/backdrop.js';
  backdrop(document.querySelector('canvas.field'));
</script>
```

## Changing it

1. Change it here; look at it with `npm run demo` (the backdrop, the names and every icon).
2. Raise `version` in `package.json` and tag it: `git tag v0.2.0 && git push --tags`.
3. In each place that uses it, move to the new tag (`npm install github:atem-lab/kit#v0.2.0`, or `scripts/kit.sh v0.2.0`), and if the mark changed, run `npm run icons` and copy the files in.
