---
name: verify
description: Build, run, and drive this Next.js photo-globe app to verify changes at its real surface (browser).
---

# Verify: photos (Next.js photo globe)

## Build & launch

```bash
npm ci                    # node_modules is not checked in
npm run build             # next build; also the typecheck gate for JSON imports
npm run start             # serves the production build on http://localhost:3000
```

`npm run check` (tsc) and `npm run lint` are quick pre-flight gates.
`npm run knip` fails unless knip is installed globally — not part of `npm ci`.

## Drive it (headless Chromium + Playwright)

Playwright is NOT a project dependency. Install `playwright-core` in the
scratchpad (not the repo) and launch the pre-installed browser:

```js
const { chromium, devices } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
```

Gotchas that cost time:

- The globe takes ~6-9s after load (intro camera flight + lazy data chunks)
  before screenshots are representative.
- The album list renders TWO different components: desktop Chrome UA gets
  `ChromeMenuItem`s (no `.album-list-item` spans); every other UA (mobile,
  Firefox, Safari) gets `<span class="album-list-item">` items. Pick the
  path you need via the context's `userAgent` / a `devices[...]` preset.
- Mobile flows: use `devices['iPhone 13']` and `.tap()`. After the first
  select the list slides mostly off-viewport — reach later items with a
  JS-dispatched `MouseEvent('click', { bubbles: true })`, not `.click()`.
- Camera motion (zoom/sway) is verified by diffing two screenshots a few
  seconds apart; CSS animations by sampling `getComputedStyle(...)
  .backgroundPosition` (or animationName) twice.
- `reducedMotion: 'reduce'` on the browser context exercises the
  prefers-reduced-motion branches (globe sway guard + CSS animation: none).
