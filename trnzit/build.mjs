#!/usr/bin/env node
// Zero-dependency static build for the Trnzit site.
//   node build.mjs          -> writes ./dist
// Templating (deliberately tiny):
//   front matter   <!--- key: value --->   at the top of each page
//   {{> name}}     include src/partials/name.html
//   {{root}}       relative path to site root ("" or "../")
//   {{icon:name}}  inline line icon from src/partials/icons.mjs
//   {{logo}} {{logo-symbol}} {{enso-draw}}  inline logo SVG (uses page-level <defs>)
//   {{nav:key}}    aria-current="page" when the page's `nav` matches key
//   {{title}} {{description}} {{canonical}} {{year}}
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { icon } from './src/partials/icons.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');
// Production address: the site lives at a slug below the group domain, e.g. https://www.trnznd.io/trnzit
const SITE_URL = (process.env.SITE_URL || 'https://www.trnznd.io/trnzit').replace(/\/$/, '');
const GROUP_URL = process.env.GROUP_URL || 'https://www.trnznd.io';
const YEAR = new Date().getFullYear();

const logoPaths = JSON.parse(readFileSync(join(SRC, 'partials/logo-paths.json'), 'utf8'));
const LOGO_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><path id="lg-enso" d="${logoPaths.enso}"/><path id="lg-word" d="${logoPaths.word}"/></defs></svg>`;
const LOGO = `<svg viewBox="29 27 1763 606" role="img" aria-label="Trnzit"><use href="#lg-enso" fill="#0088FF"/><use href="#lg-word" fill="currentColor"/></svg>`;
const LOGO_SYMBOL = `<svg viewBox="29 22 615 615" role="img" aria-label="Trnzit"><use href="#lg-enso" fill="#0088FF"/></svg>`;
// One-time draw-on: a thick stroke along the Enso's centreline masks the filled brush shape.
// Starts at the heavy "loaded brush" end (right) and travels anticlockwise to the dry-brush tail.
const ENSO_DRAW = `<svg class="enso-draw" viewBox="29 22 615 615" aria-hidden="true" focusable="false"><mask id="enso-mask" maskUnits="userSpaceOnUse" x="-100" y="-100" width="900" height="900"><path class="enso-mask-stroke" pathLength="1" d="M535.1 485.1A252 252 0 0 0 140.7 171.4A252 252 0 0 0 529.5 492" fill="none" stroke="#fff" stroke-width="185"/></mask><use href="#lg-enso" fill="#0088FF" mask="url(#enso-mask)"/></svg>`;

const partials = {};
for (const f of readdirSync(join(SRC, 'partials'))) {
  if (extname(f) === '.html') partials[f.replace('.html', '')] = readFileSync(join(SRC, 'partials', f), 'utf8');
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function render(tpl, ctx, depth = 0) {
  if (depth > 5) throw new Error('Partial nesting too deep');
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, n) => {
    if (!(n in partials)) throw new Error(`Missing partial: ${n}`);
    return render(partials[n], ctx, depth + 1);
  });
  return tpl
    .replace(/\{\{icon:([\w-]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{nav:([\w-]+)\}\}/g, (_, k) => (ctx.nav === k ? 'aria-current="page"' : ''))
    .replace(/\{\{navgroup:([\w-]+)\}\}/g, (_, k) => (ctx.navgroup === k ? 'is-current' : ''))
    .replace(/\{\{logo\}\}/g, LOGO)
    .replace(/\{\{logo-symbol\}\}/g, LOGO_SYMBOL)
    .replace(/\{\{enso-draw\}\}/g, ENSO_DRAW)
    .replace(/\{\{logo-defs\}\}/g, LOGO_DEFS)
    .replace(/\{\{(title|description|canonical|robots|bodyclass|ogimage)\}\}/g, (_, k) => ctx[k] ?? '')
    .replace(/\{\{year\}\}/g, String(YEAR))
    .replace(/\{\{group\}\}/g, GROUP_URL)
    .replace(/\{\{root\}\}/g, ctx.root);
}

function parse(src) {
  const m = src.match(/^<!---([\s\S]*?)--->\s*/);
  const meta = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const i = line.indexOf(':');
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return { meta, body: m ? src.slice(m[0].length) : src };
}

function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{}:;,>])\s*/g, '$1').replace(/;}/g, '}').trim();
}

// ---- build ----
if (existsSync(DIST)) rmSync(DIST, { recursive: true });
mkdirSync(DIST, { recursive: true });

// assets
for (const f of walk(join(SRC, 'assets')).filter((f) => !f.includes('/assets/css/'))) {
  const out = join(DIST, 'assets', relative(join(SRC, 'assets'), f));
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(f, out);
}
// single bundled stylesheet
const css = ['tokens.css', 'site.css'].map((f) => readFileSync(join(SRC, 'assets/css', f), 'utf8')).join('\n');
mkdirSync(join(DIST, 'assets/css'), { recursive: true });
writeFileSync(join(DIST, 'assets/css/trnzit.min.css'), minifyCss(css));
copyFileSync(join(SRC, 'assets/logo/favicon.svg'), join(DIST, 'favicon.svg'));

// pages
const pages = walk(join(SRC, 'pages')).filter((f) => f.endsWith('.html'));
const urls = [];
for (const file of pages) {
  const rel = relative(join(SRC, 'pages'), file);
  const depth = rel.split('/').length - 1;
  const { meta, body } = parse(readFileSync(file, 'utf8'));
  const path = rel.replace(/index\.html$/, '');
  const ctx = {
    // 404 can be served at any URL, so its links must be absolute
    root: rel === '404.html' ? `${SITE_URL}/` : depth ? '../'.repeat(depth) : '',
    title: meta.title ? `${meta.title}` : 'Trnzit',
    description: meta.description || '',
    nav: meta.nav || '',
    navgroup: meta.navgroup || '',
    canonical: `${SITE_URL}/${path}`,
    robots: meta.robots || 'index, follow',
    bodyclass: meta.bodyclass || '',
    ogimage: `${SITE_URL}/assets/img/og-image.png`,
  };
  const html = render(`${partials.head}${partials.header}<main id="main">${body}</main>${partials.footer}`, ctx);
  const out = join(DIST, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  if (!/noindex/.test(ctx.robots) && !/404/.test(rel)) urls.push(ctx.canonical);
}
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
// Crawlers only read robots.txt at the domain root, so add this sitemap line to the group site's robots.txt
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
writeFileSync(join(DIST, '.nojekyll'), '');
console.log(`Built ${pages.length} pages -> ${relative(process.cwd(), DIST) || '.'}`);
