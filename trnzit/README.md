# Trnzit marketing site

A static, multi-page marketing site for **Trnzit**, a treasury management platform from the Trnznd Group. It's built in plain HTML, CSS and JS with a zero-dependency Node build script.

## Quick start

```bash
cd trnzit
node build.mjs                      # writes ./dist  (Node 18+)
npx http-server dist -p 8080        # or any static server
SITE_URL=https://www.trnznd.io/trnzit node build.mjs   # default; sets canonical/OG/sitemap URLs
```

### Hosting under the group domain

The site is built to live at a slug below the group domain (default `https://www.trnznd.io/trnzit/`). Copy the contents of `dist/` into that folder on the group site. All page links are relative, so the slug can change without touching the pages; just rebuild with the new `SITE_URL`.

- Set the web server to serve `dist/404.html` for missing pages under `/trnzit/`. Its links are absolute for that reason.
- Crawlers only read `robots.txt` at the domain root. Add `Sitemap: https://www.trnznd.io/trnzit/sitemap.xml` to the group site's own `robots.txt`.
- `GROUP_URL` (default `https://www.trnznd.io`) sets the "Back to trnznd.io" links.
- A ZEND site can reuse this build (tokens, components, build script) at its own slug, e.g. `/zend/`.

`dist/` is committed so the site can be previewed or deployed as-is. Don't edit `dist/` by hand; edit `src/` and rebuild.

## Structure

```
trnzit/
├── build.mjs                 # tiny templating: partials, icons, logo, nav state, sitemap
├── tokens/design-tokens.json # design tokens mapped to Brand Guide V2.0 (with page refs)
├── docs/
│   ├── 01-brand-guide-reading.md            # read-back of the guide, conflicts, gaps, type scale
│   └── 02-placeholders-questions-assumptions.md
├── src/
│   ├── pages/                # one file per page (front matter at top)
│   ├── partials/             # head, header, footer, CTA, mock-ups, diagram, icons, logo paths
│   └── assets/
│       ├── css/tokens.css    # CSS custom properties (mirror of the JSON tokens)
│       ├── css/site.css      # components, layout, motion
│       ├── js/site.js        # nav, reveals, count-ups, pricing toggle, form validation
│       ├── fonts/            # Inter (SIL OFL), self-hosted
│       ├── img/              # OG image, touch icon
│       └── logo/             # SVG logo set (see below)
└── dist/                     # build output
```

## Pages

Home · Platform (8 capability sections) · Security &amp; Governance · Pricing · For organisations · For individuals · FAQ · About · Contact / Start free trial · Legal (Terms, Privacy, Cookies placeholders) · 404 · `brand/logo.html` (logo review sheet, noindex).

## Logo set (`src/assets/logo/`)

| File | Use |
|---|---|
| `trnzit-horizontal-light.svg` / `-dark.svg` | Primary lockup: Midnight or white wordmark |
| `trnzit-stacked-light.svg` / `-dark.svg` | Square formats, social profiles |
| `trnzit-wordmark-light.svg` / `-dark.svg` | Wordmark only |
| `trnzit-symbol.svg`, `favicon.svg` | Enso only: favicon, app icon, anything under 80px wide |
| `*-i-option-b.svg` | Alternative "i" (round dot), for approval only |

The Enso is the Trnznd symbol with its geometry unchanged, filled solid Electric Blue `#0088FF`. The letters "t", "r", "n" and "z" were traced from the supplied artwork. The "i" is newly drawn and **awaits approval** (see `brand/logo.html`).

## Quality checks run

These were run locally against `dist/` served over HTTP (no compression or CDN):

- **axe-core** (WCAG 2.0/2.1/2.2 A and AA, plus best practice): 0 violations on all 12 pages and the open mobile menu.
- **Lighthouse 12.8** (Home, Platform, Pricing): Performance 98–100, Accessibility 100, Best Practices 100, SEO 100, on both the mobile and desktop presets. Production scores will vary with hosting.
- No horizontal overflow at 390px or 1440px, and no console errors.
- All motion is disabled under `prefers-reduced-motion: reduce`.

## Motion

The motion set is: a one-time Enso draw-on in the hero (a mask stroke along the brush path), arc and orbital-dot motifs, animated dashed connection lines and pulses in the architecture diagram, count-up on the mock-up balance, scroll reveals, and hover micro-interactions on buttons and cards.
