# atem-lab.com

The site at https://atem-lab.com (GitHub Pages, the org's site). `north-star/` is North Star's product page (one page, hand-written: the pieces are drawn after the app and move with the scroll). The app itself is `atem-lab/north-star`, at https://north-star.atem-lab.com/; `404.html` sends its old links under `/north-star/` on. `logos/` shows every logo.

`kit/` is a copy of [atem-lab/kit](https://github.com/atem-lab/kit) at the tag in `kit/VERSION`: the ASCII backdrop, the mark, the name's CSS, tokens and fonts. Don't edit it here: change the kit, tag it, then `scripts/kit.sh <tag>` and raise the `?v=` on the pages that load it. Icons and link previews come from the kit's `npm run icons`.
