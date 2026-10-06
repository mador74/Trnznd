# Trnznd website

The trnznd.io site, rebuilt in the Trnzit look and feel so the group reads as one family. It is plain HTML, CSS and a little JavaScript. There is no framework and nothing to install.

## Build

```bash
node site/build.mjs          # writes the site to docs/ (served by GitHub Pages)
node site/build.mjs out/     # or to any other folder
```

Then preview over HTTP (fonts don’t load from `file://`):

```bash
cd docs && python3 -m http.server 8000
```

Commit `docs/` after building. GitHub Pages serves it from the branch.

### Clickable prototype (claude.ai artifact)

```bash
node site/build.mjs <out> --inline --trnzit=https://claude.ai/artifact/YBuV8hYxgnEsWngZUUhtjY
```

This inlines the CSS, JS and font into every page, as the artifact viewer requires, and points the Trnzit links at the Trnzit prototype. Publish `<out>/index.html` with the other pages and images as supporting files. The current prototype is at https://claude.ai/artifact/WraLy881KNXDy4tkFHYq4r.

## Structure

```
site/
  build.mjs                 shared head, header, footer, icon set; assembles pages
  src/
    pages/                  one file per page; meta block at the top (title, description, nav)
      legal/  brand/
    partials/sprite.html    the Enso and wordmark as inline SVG symbols
    assets/css/group.css    the group design system, identical to Trnzit's (keep in step)
    assets/css/trnznd.css   Trnznd-only additions
    assets/js/site.js       progressive enhancement (menus, reveals, tabs, form checks)
    assets/fonts/           Inter (Latin subset), self-hosted
    assets/img/             brand artwork rendered by site/art (see below), WebP
    assets/logo/            Trnznd logo set, plus the Trnzit lock-up used on the group card
```

Inside a page, `{{i:name}}` inserts an icon, `{{logo}}` the lock-up, `{{dashboard}}` and `{{trnzit}}` the external URLs, and `{{root}}` the relative path to the site root.

## Artwork

The images are original brand artwork drawn in code, so there are no stock or third-party pictures to license. `site/art/scenes.html` draws each scene on a canvas: the wireframe Earth with trade routes, the Enso of light, currencies converging into one stable line, the settlement flow and the reserve orbits. `site/art/render.mjs` writes them to `src/assets/img/` as WebP:

```bash
NODE_PATH=$(npm root -g) node site/art/render.mjs   # needs Playwright with Chromium
```

Change a scene's seed or parameters in `render.mjs` to get a different composition.

## Pages

ZEND (home), Business, Insights, Resources, FAQ, About, Contact, the legal pages (important notice, risk, terms, privacy, complaints, cookies), the brand logo set and a 404 page.

## Before launch

Anything not yet confirmed is marked on the page with a dashed blue `[placeholder]`. To list them all:

```bash
grep -o 'class="ph">[^<]*' -r docs --include=*.html
```

Also outstanding:

- The contact form validates but has no endpoint; connect it in `site.js`.
- The legal pages are outlines only, apart from the important notice, which matches the current site footer word for word. The current site already publishes Terms, Privacy, Risk Disclosures and a Complaints Policy: move their wording across.
- Insights: each post card needs its URL, date and, where the old card cut it off, its full title. Resources: link the Whitepaper, Governance Framework and Compliance Overview files.
- The “d” in the wordmark was built from the “n” of the traced artwork. Check it against the master logo (see `brand/logo.html`).
- External URLs are set at the top of `build.mjs`: the Dashboard (`app.trnznd.io`) and Trnzit (`www.trnznd.io/trnzit/`).

The previous scroll-driven landing page (Vite, in `website/`) is retired. It is in git history at commit `13da6d5`.
