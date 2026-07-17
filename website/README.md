# TRNZND — Scroll-Driven Landing Page

A premium, single-page **scroll-driven motion website** for **TRNZND / ZEND** — the
currency-neutral stablecoin. The Firefly-generated product film is used as a single
**fixed, full-screen background video that scrubs with scroll** (it does not autoplay);
page content scrolls over it with dark overlays for readability.

Built per the project brand kit (`../copy/brand-kit.md`) and the `BRAND-landing` skill.

## Stack

- **Vite** (vanilla JS, ES modules)
- **GSAP** + **ScrollTrigger** — scroll-based animation & pins
- **Lenis** — smooth scrolling (desktop)
- CSS variables for brand tokens (colors, type) derived from the brand kit
- Fonts: **Inter** (headings/body) + **JetBrains Mono** (data/labels) via Google Fonts

## Run locally

```bash
cd website
npm install
npm run dev
```

Then open the printed URL (default **http://localhost:5173**).

## Production build

```bash
npm run build        # outputs to website/dist (base is already './', portable)
npx serve dist       # preview over HTTP — do NOT open dist/index.html via file://
```

(`npm run build:portable` is an alias that also forces `--base=./`.)

## Project structure

```
website/
├─ index.html            # all section markup + Google Fonts link
├─ vite.config.js        # base './', keeps bg.mp4 as a real file
├─ package.json
├─ scripts/
│  └─ swap-bg-video.sh   # re-encode helper (all-keyframe H.264)
├─ src/
│  ├─ main.js            # Lenis, ScrollTrigger, video scrub, section motion
│  ├─ style.css          # tokens, layout, sections, background layers
│  └─ glass.css          # glass panels, buttons
└─ public/
   ├─ bg.mp4             # the scroll-scrubbed background video
   └─ img/               # reference stills + mobile poster
```

## Sections

Hero → Impact statement (pinned word reveal) → Reserve (feature 1) → Settlement
(feature 2) → Design & Materials → Built for Institutions (pinned card gallery) →
Specs → Register / Pre-order CTA → Footer.

## Background video — smooth scrubbing

`public/bg.mp4` is the current file. Raw AI-generated MP4s often have **sparse
keyframes**, which can make frame-accurate scroll scrubbing seek unevenly. For the
smoothest result, re-encode to **all-keyframe H.264** (a keyframe on every frame):

```bash
# from the website/ folder — requires ffmpeg
scripts/swap-bg-video.sh ../assets/videos/BRAND-scroll-background.mp4
```

> ⚠️ `ffmpeg` was **not available** in the build environment, so `public/bg.mp4` is
> currently the raw Firefly export. Scrubbing still works, but running the script
> above (locally, where ffmpeg is installed) will make it noticeably smoother.
> The manual equivalent:
> ```bash
> ffmpeg -y -i ../assets/videos/BRAND-scroll-background.mp4 -an \
>   -c:v libx264 -preset slow -crf 18 -g 1 -keyint_min 1 -sc_threshold 0 \
>   -pix_fmt yuv420p -movflags +faststart public/bg.mp4
> ```

## Responsive / mobile

On touch devices and narrow screens the heavy scrubbed video is replaced by a static
**poster image** (`public/img/mobile-poster.png`), pinned sections relax into natural
vertical stacks, and the card gallery becomes a stacked list.

## Dev hooks

In dev mode the console exposes `window.__bgv`, `window.__ST`, and `window.__lenis`.
Useful checks:

```js
window.__bgv.readyState   // 4 when fully buffered
window.__bgv.duration     // video length in seconds
window.__ST.refresh()     // recompute ScrollTrigger positions
```

## Publishing (GitHub Pages — live link)

The built site is committed to the repo-root **`docs/`** folder and served via
GitHub Pages "Deploy from a branch". To (re)publish after changes:

```bash
cd website
npm run build
rm -rf ../docs && mkdir -p ../docs && cp -r dist/* ../docs/ && touch ../docs/.nojekyll
git add ../docs && git commit -m "Update published site" && git push
```

One-time repo setting: **Settings → Pages → Build and deployment → Source:
"Deploy from a branch" → Branch: `claude/brand-kit-landing-page-hfnxg8`, folder
`/docs` → Save.** The site then goes live at `https://<user>.github.io/<repo>/`.

## Notes

- No real logos, third-party marks, or baked-in text appear in the media.
- The primary accent (teal `#00D4AA`) is used sparingly for CTAs, highlights, and glow.
- Brand tokens live at the top of `src/style.css` — change them there, not inline.
