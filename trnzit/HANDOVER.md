# Trnzit marketing site: developer handover

This pack contains everything needed to host the Trnzit marketing site at `https://www.trnznd.io/trnzit/`. It's a static site: plain HTML, CSS and a small JavaScript file. It has no framework, no database, no server-side code and no third-party requests (fonts are self-hosted, and there's no analytics or tracking).

If anything here conflicts with what you see in the code, the code is the source of truth. Please raise the conflict with the Trnzit team rather than guessing.

## 1. What's in the pack

| Folder / file | What it is | Do you need it to host? |
|---|---|---|
| `site/` | The finished, built website (a copy of `dist/`). Upload this as-is. | **Yes** |
| `source/` | The editable source: `src/`, `build.mjs`, `tokens/`. Rebuild `site/` from this. | Yes, for any future edits |
| `HANDOVER.md` | This document | Read first |
| `README.md` | Project readme (structure, build, logo set, checks) | Reference |
| `docs/placeholders.csv` | Every unfinished item shown on the site, with file and line number | **Yes, before launch** |
| `docs/01-brand-guide-reading.md` | How the TRNZND Brand Guide V2.0 was applied | Reference |
| `docs/02-placeholders-questions-assumptions.md` | Decisions log: every answer, assumption and open question | Reference |
| `docs/03-removed-for-later.md` | Bank/card/invoicing content removed for now, to restore later | Reference |
| `screenshots/desktop-1440/` | Full-page screenshot of every page at 1440px wide | Visual reference |
| `screenshots/mobile-390/` | Full-page screenshot of every page at 390px wide (2x) | Visual reference |
| `screenshots/states/` | Interactive states: Solutions menu, mobile menu, pricing monthly, FAQ open, form errors | Visual reference |
| `graphics/` | Each diagram and product mock-up exported as a PNG (2x) | Reference only; the site uses live HTML/SVG versions |
| `brand/logo-svg/` | Master SVG logo set (the files the site uses) | Reference / other uses |
| `brand/logo-png/` | PNG exports of every logo, 512px and 2048px wide, transparent | For use outside the website |
| `brand/design-tokens.json` | Colours, type, spacing, radii, motion, mapped to the brand guide | Reference |

The screenshots and `graphics/` PNGs are reference images only. Every diagram, chart, mock-up and icon on the site is built in HTML, CSS and inline SVG, so nothing has to be cut from images.

## 2. Hosting it (the short version)

1. Copy the **contents** of `site/` into the `/trnzit/` folder of `www.trnznd.io`. Keep the folder structure exactly as it is.
2. Configure the web server to serve `/trnzit/404.html` (with HTTP status 404) for missing URLs under `/trnzit/`. Its links are absolute, so it works at any depth.
3. Add this line to the **group site's** root `robots.txt`, because crawlers only read `robots.txt` at the domain root:
   `Sitemap: https://www.trnznd.io/trnzit/sitemap.xml`
4. Serve over HTTPS only, and apply the headers in section 4.
5. Work through the pre-launch checklist in section 8.

All internal links are relative, so the site works at any path. Only the canonical, Open Graph and sitemap URLs contain the full address. If the slug or domain changes, rebuild (section 3) with the new `SITE_URL`.

Pages are served as `.html` files (e.g. `/trnzit/pricing.html`). If you want extensionless URLs, add rewrites on the server; the built links will still point to `.html`, so keep both working.

## 3. Building from source

You need Node.js 18 or later and nothing else. There are no npm dependencies and no `npm install` step.

```bash
cd source
node build.mjs                                  # writes ./dist
SITE_URL=https://www.trnznd.io/trnzit GROUP_URL=https://www.trnznd.io node build.mjs   # explicit (these are the defaults)
npx http-server dist -p 8080                     # preview locally (any static server works)
```

| Variable | Default | Controls |
|---|---|---|
| `SITE_URL` | `https://www.trnznd.io/trnzit` | Canonical tags, Open Graph image/URLs, `sitemap.xml`, `robots.txt`, 404 page links |
| `GROUP_URL` | `https://www.trnznd.io` | "Back to trnznd.io" links in the group bar and menu |

Never edit `dist/` by hand: edit `src/` and rebuild. The build:

- assembles each page in `src/pages/` from front matter (title, description, nav state) plus shared partials in `src/partials/` (`{{> name}}`);
- inlines icons (`{{icon:name}}`, from `src/partials/icons.mjs`) and the logo (`{{logo}}`, from `src/partials/logo-paths.json`);
- bundles `tokens.css` + `site.css` into `assets/css/trnzit.min.css`;
- copies fonts, images, logos and JS, and writes `sitemap.xml` and `robots.txt`.

The `brand/logo.html` page is a logo review sheet. It's set to `noindex` and left out of the sitemap; you can delete it from the live site if you prefer.

## 4. Recommended server settings

**Caching.** File names aren't fingerprinted, so:

- `*.html`, `sitemap.xml`, `robots.txt`: `Cache-Control: no-cache` (revalidate every time)
- `assets/*` and `favicon.svg`: `Cache-Control: public, max-age=86400` (one day). Use longer only if you add fingerprinting to the build.

**Compression.** Enable gzip or Brotli for HTML, CSS, JS, SVG and XML. Don't compress the `.woff2` font, which is already compressed.

**MIME types.** Make sure `.woff2` is served as `font/woff2` and `.svg` as `image/svg+xml`.

**Security headers** (suggested; check they don't clash with the group site's own policy):

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-Du+OJKJSbdUgz5nrHeWWINvez6XKDDU/tyj/5c2uvwo='; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-ancestors 'self'; base-uri 'self'
```

Notes on the CSP:

- **The hash:** each page has one tiny inline script, `document.documentElement.classList.add('js')`, which switches on the JavaScript-only styles. The hash above allows exactly that script. If you edit it, recalculate the hash.
- **`'unsafe-inline'` for styles:** pages use inline `style` attributes (mostly animation delays such as `style="--d:60ms"`), so this is needed unless those are moved into classes.
- **`form-action`:** when the contact form is connected (section 5), add the form endpoint's origin.

## 5. Things that are NOT wired up yet (developer action needed)

1. **Contact / free-trial form** (`contact.html`). It validates in the browser, but `action="#"` and the JavaScript stops submission and shows a "not yet connected" message. To connect it:
   - point the form at a real endpoint (CRM, email service or the Trnzit app's sign-up API);
   - replace the `status.textContent = …` placeholder at the end of `src/assets/js/site.js` with real submission and confirmation copy;
   - add spam protection, and record consent from the terms checkbox.

   Field names: `name`, `email`, `type` (organisation/individual), `organisation`, `plan` (free/business/premium/enterprise), `billing` (annual/monthly), `payment`, `terms`.
2. **Plan pre-selection.** Every "Start free" and "Start 30-day free trial" button links to `contact.html?plan=<plan>&billing=<annual|monthly>`, and the form pre-selects from those parameters. If sign-up moves into the Trnzit app, change every link to `contact.html` (find them with `grep -rn 'contact.html' source/src`).
3. **No "Sign in" link.** There's no link to the Trnzit app. Add one to `src/partials/header.html` once the app URL is known.
4. **Email addresses.** Support, security and contact emails are placeholders (see the CSV).
5. **Payment-method logos** (Visa, Mastercard, Google Pay, Apple Pay, PayPal, USDT, USDC) are simplified stand-ins in `src/partials/payment-logos.html`. Replace them with each brand's official artwork, used under that brand's guidelines, before launch.
6. **Analytics and cookies.** None are installed. If you add any non-essential cookies or analytics, you'll need a consent mechanism first (UK PECR / EU ePrivacy), and the Cookies page must be updated.

## 6. Placeholders on the live site

Unfinished content is wrapped in `<span class="ph">…</span>` and shows on the site as a highlighted box, so nothing unconfirmed can go live unnoticed. `docs/placeholders.csv` lists all 55, with file and line number. They fall into these groups:

- **Contact details:** support, security and contact emails; phone; legal entity name.
- **Legal:** Terms, Privacy and Cookies pages are structured outlines awaiting counsel. There's also a legal review of the financial-promotion wording on the Trade & convert section and the Providers page.
- **Technical sign-off:** the draft security practices (dashed box on Security & Governance, and one FAQ answer), API scopes per provider, authentication options, export formats.
- **Product scope:** which plans include multi-sig wallets and trading ("To confirm" cells in the pricing table), supported custodians, stablecoins per network, accepted USDT/USDC payment networks, role names.
- **Billing:** VAT/sales-tax treatment, how cancellation notice is given.

**Before launch, every `class="ph"` must be resolved or removed.** A quick check: `grep -rn 'class="ph"' source/src` should return nothing.

## 7. Page and component map

| Page | File | Notes |
|---|---|---|
| Home | `src/pages/index.html` | Hero with balances mock-up, capabilities grid, architecture diagram, governance, plans (monthly by default) |
| Platform | `src/pages/platform.html` | 8 numbered capability sections with sticky sub-nav |
| Security & Governance | `src/pages/security.html` | Principles, "never do" list, governance controls, draft practices box |
| Pricing | `src/pages/pricing.html` | 4 plan cards (annual by default), main and per-card Annual/Monthly switches, comparison table, billing terms |
| Providers | `src/pages/providers.html` | Multi-sig (Safe, Squads), exchanges, on/off-ramps, information-only disclosure |
| For organisations / individuals | `organisations.html`, `individuals.html` | Audience pages |
| FAQ | `src/pages/faq.html` | Native `<details>` accordions |
| About, Contact, 404 | `about.html`, `contact.html`, `404.html` | |
| Legal | `src/pages/legal/*.html` | Placeholders for counsel |

Shared partials in `src/partials/`:

- `head.html` (meta tags, group bar), `header.html` (logo, descriptor "Stablecoin Management, by Trnznd", navigation), `footer.html` (including the legal disclaimer), `cta.html`.
- `diagram.html` (architecture diagram: desktop SVG/HTML version plus a stacked mobile version).
- The `mock-*.html` product mock-ups, all labelled "Illustrative data" with fictional names. `mock-invoice.html` is unused and kept for later.
- `payment-logos.html`.

**Behaviour** (`src/assets/js/site.js`, no dependencies):

- the mobile menu (shown at 1280px and below), the Solutions dropdown, and sticky-header offset;
- scroll reveals and the count-up on the balance figure;
- the pricing switches, which update prices, notes and trial links, and announce changes to screen readers;
- form validation and plan pre-selection.

All motion is switched off when the visitor's system asks for reduced motion.

**Design system:** `src/assets/css/tokens.css` (CSS custom properties, mirrored in `tokens/design-tokens.json`) and `src/assets/css/site.css`.

- **Colours:** Midnight `#0A0F1E`, Teal `#00D4AA`, Electric Blue `#0088FF`, Violet `#6C3AED`.
- **Fonts:** headings use the system Helvetica stack; UI and body text use Inter, self-hosted under the SIL Open Font License (licence file included in `assets/fonts/`).
- **Text contrast:** Teal is never used for text on white, because it fails contrast.

## 8. Pre-launch checklist

- [ ] All placeholders resolved: `grep -rn 'class="ph"' source/src` returns nothing; rebuild.
- [ ] Contact/trial form connected, tested end to end, with spam protection.
- [ ] Official payment logos in place.
- [ ] Legal pages approved by counsel; financial-promotion wording reviewed.
- [ ] Security practices signed off by the technical team.
- [ ] Rebuilt with the final `SITE_URL`; `sitemap.xml` URLs and canonical tags checked.
- [ ] 404 handling, HTTPS, headers and caching configured; group `robots.txt` updated.
- [ ] Open Graph preview checked (e.g. by pasting a page link into LinkedIn or Slack). The image is `assets/img/og-image.png` (1200×630).
- [ ] Spot-check against `screenshots/` on desktop, tablet and phone, with keyboard-only navigation.
- [ ] Re-run accessibility (axe) and Lighthouse checks on the live URL.

## 9. Quality checks already run (on this build, local server)

- **axe-core (WCAG 2.2 A/AA):** 0 violations on all pages and on the open mobile menu.
- **Overflow:** no sideways scrolling on the 390px, 768px and 1440px pages checked; the header fits from 320px to 1920px.

  **Known exception:** at 320px (the smallest, oldest phones), the home page hero and the pricing comparison table run slightly wider than the screen. This was noted earlier and has not been fixed yet.
- **Lighthouse 12.8** (earlier build, Home/Platform/Pricing): 98–100 Performance, 100 Accessibility, 100 Best Practices, 100 SEO. Live scores depend on hosting.

## 10. Contacts and decisions

The decisions log (`docs/02-placeholders-questions-assumptions.md`) records every content decision made with the Trnzit team, including pricing, trial terms, supported chains and stablecoins, and alert behaviour. Content questions go to the Trnzit team, not to be resolved in code.
