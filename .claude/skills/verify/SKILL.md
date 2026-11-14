---
name: verify
description: Build, run, and drive this Next.js photo-globe app to verify changes at its real surface (browser).
---

# Verify: photos (Next.js photo globe)

## Build & launch

```bash
npm ci                    # node_modules is not checked in
npm run build             # next build (Turbopack); also runs the typecheck
npm run start             # serves the production build on http://localhost:3000
```

`npm run check` (tsc), `npm run lint` (eslint) and `npm run knip` are quick
pre-flight gates; all three should be clean. `next build` no longer lints.

Kill an old server with `pkill -f next-server` before starting a new one: the
process renames itself, so `pkill -f "next start"` misses it and the new
server silently fails to bind while the stale one keeps serving.

## Drive it (headless Chromium + Playwright)

Playwright is NOT a project dependency. Use the pre-installed one from a
script outside the repo:

```js
const { chromium, devices } = require('playwright');
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});
```

Gotchas that cost time:

- The image CDN (images.sean.ventures) is usually unreachable from a sandbox.
  Stub it with `context.route('https://images.sean.ventures/**', ...)` and
  fulfil with a generated image of the photo's aspect ratio (see
  src/lib/photos.json for dimensions). Playwright disables the HTTP cache
  while routing, so repeat requests for one URL are expected.
- The globe takes ~6-9s after load (lazy chunk + arrival flight) before
  screenshots are representative. `.landing[data-ready="true"]` means the
  globe has rendered; `data-glass-live="true"` means the glass pass is on.
- WebGL is software rendered here. At deviceScaleFactor 2 on a desktop
  viewport it drops below one frame per second and timing-based checks
  fail: test behaviour at scale 1, and only take stills at 2.
- State lives in data attributes on `.landing`: `data-active`,
  `data-leaving`. The camera readout is `.hud--readout` (it holds figure
  spaces, U+2007: strip them before matching).
- Layout is chosen by viewport shape, not user agent. Wide (>= 900px, or
  landscape >= 640px): the list is `.index > .index__list .index__item`
  (hover previews, click opens) and the callout is `.callout-anchor`
  (`data-pinned`, and its inline `translate3d(x, y, 0)` is the focused
  marker's screen position). Narrow: `.deck__card` cards, `.deck__tick`
  ruler buttons, `.landing-nav__index` opens the `.sheet` dialog.
- On touch the first tap on a place selects it and the second opens it.
- Albums without photos (`photoCount` 0) render as `<button>`, not links.
- Leaving the list with the mouse ends a hover preview and the globe flies
  home, so to click a marker first focus its list item with the keyboard
  (focus keeps the place in view), then click at the anchor's position.
- Camera motion is verified by reading `.hud--readout` twice, or by
  diffing two screenshots a few seconds apart.
- `reducedMotion: 'reduce'` on the browser context exercises the
  prefers-reduced-motion branches (no arrival flight, no dive, no sway,
  CSS animations off).
- Album pages: photos are in the server HTML (`img.hdr-image`), and
  `data-settled` flips to "true" once each has loaded.
