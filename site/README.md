# Trnznd website

www.trnznd.io is three connected sites in one build, all in the same look and feel:

| Path | Site | Source |
|---|---|---|
| `/` | The Trnznd Group: group brief, shared Contact page, group privacy and cookies | `src/group/` |
| `/zend/` | Zend, the stablecoin from Trnznd S.A. | `src/zend/` |
| `/trnzit/` | Trnzit, the stablecoin management platform from Trnznd Technologies | `src/trnzit/` |

A strip above every header links the three. It is plain HTML, CSS and a little JavaScript. There is no framework and nothing to install.

This repository is the master copy of the Trnzit site. The earlier standalone Trnzit prototype artifact is superseded.

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
node site/build.mjs <out> --inline
```

This inlines the CSS, JS and font into every group and Zend page, as the artifact viewer requires (the Trnzit pages already carry their styles inline). Publish `<out>/index.html` with the other pages and images as supporting files. The current prototype is at https://claude.ai/artifact/WraLy881KNXDy4tkFHYq4r.

## Structure

```
site/
  build.mjs                 site strip, group and Zend headers and footers, icon set; assembles pages
  src/
    group/                  the group site at /: index (group brief), contact, 404, legal/
    zend/                   the Zend site at /zend/: one file per page, plus legal/ and brand/
    trnzit/                 the Trnzit site at /trnzit/: finished pages with their own assets
    partials/sprite.html    the Enso and the zend wordmark as inline SVG symbols
    assets/css/group.css    the group design system, identical to Trnzit's (keep in step)
    assets/css/trnznd.css   Trnznd-only additions
    assets/js/site.js       progressive enhancement (menus, reveals, tabs, form checks)
    assets/fonts/           Inter (Latin subset), self-hosted
    assets/img/             brand artwork rendered by site/art (see below), WebP
    assets/logo/            Zend logo set, the Trnznd master logo (light/dark) and the Trnzit lock-up
```

Group and Zend pages start with a meta block (title, description, nav). Inside a page, `{{i:name}}` inserts an icon, `{{logo}}` the Zend lock-up and `{{dashboard}}` the Dashboard URL. For links between sites, `{{group}}`, `{{zend}}` and `{{trnzit}}` give the relative path to each site's folder (so `{{zend}}faq.html`), and `{{root}}` the current site's own folder. In Trnzit pages `{{site-switch}}` marks where the strip goes.

Each site keeps its own legal pages. Contact is shared: every site links to the group Contact page, and `?type=` preselects the enquiry (`access`, `team`, `trnzit`, `partnership`, `press`, `updates`, `general`). Organisation details are required only for the two Zend enquiry types.

The group home page (`intro: yes` in its meta block) opens with a landing intro: the ring of light from the hero (`assets/img/intro-enso.webp`, keyed out of `enso-hero.webp` by brightness so the page shows through its middle) is drawn in on Midnight, the trnznd wordmark (`assets/img/intro-wordmark.webp`, cut from the master logo) fades in at its centre, then it opens like a portal onto the page. It plays once per browser session, is skipped by any click, key, scroll or touch, and never plays for visitors who have reduced motion turned on. The markup and session check are in `build.mjs` (`INTRO`, `INTRO_HEAD`), the timeline in `trnznd.css`.

Trnzit pages are finished HTML with their CSS and JavaScript inline, as imported. They are slower to edit than the group and Zend pages until they are moved onto the shared build.

## Artwork

The images are original brand artwork drawn in code, so there are no stock or third-party pictures to license. `site/art/scenes.html` draws each scene on a canvas: the wireframe Earth with trade routes, the Enso of light, currencies converging into one stable line, the settlement flow and the reserve orbits. `site/art/render.mjs` writes them to `src/assets/img/` as WebP:

```bash
NODE_PATH=$(npm root -g) node site/art/render.mjs   # needs Playwright with Chromium
```

Change a scene's seed or parameters in `render.mjs` to get a different composition. The group hero uses `enso-hero.webp` (and `-sm`), `enso-light.webp` flipped vertically and turned 45° anticlockwise with Pillow (its edges are extended before turning so no corners show); re-make it if the Enso scene changes.

## Pages

Group: the group brief (home), Contact, privacy, cookies and a 404 page. Zend: home, Business, Insights, Resources, FAQ, the legal pages (important notice, risk, terms, privacy, complaints, cookies) and the brand logo set. Trnzit: home, Platform, Security & Governance, Organisations, Individuals, Providers, Pricing, FAQ, Contact (trial sign-up), terms, privacy, cookies, the brand page and a 404 page.

The Zend pages used to sit at the root (`/business.html`, `/faq.html` and so on). They now live under `/zend/`, so the old URLs need redirects at the host before launch.

## Before launch

Anything not yet confirmed is marked on the page with a dashed blue `[placeholder]`. To list them all:

```bash
grep -o 'class="ph">[^<]*' -r docs --include=*.html
```

Also outstanding:

- The contact form validates but has no endpoint; connect it in `site.js`.
- The legal pages are outlines only, apart from the important notice, which matches the current site footer word for word. The current site already publishes Terms, Privacy, Risk Disclosures and a Complaints Policy: move their wording across.
- Insights: each post card needs its URL, date and, where the old card cut it off, its full title. Resources: link the Whitepaper, Governance Framework and Compliance Overview files.
- The site carries the Zend lock-up (Teal Enso, zend wordmark, “Global Stability, by Trnznd”). Its “z”, “n” and “d” are traced from the Trnznd master logo; the “e” is new. Have a designer check the “e” (see `zend/brand/logo.html`).
- The group privacy notice must name the data controller for the shared contact form (Trnznd S.A., Trnznd Technologies, or both).
- The Dashboard URL (`app.trnznd.io`) is set at the top of `build.mjs`.

The previous scroll-driven landing page (Vite, in `website/`) is retired. It is in git history at commit `13da6d5`.
