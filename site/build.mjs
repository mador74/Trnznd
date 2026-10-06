// Builds the Trnznd site: wraps each page in src/pages with the shared head,
// header and footer, and copies assets. No dependencies: `node site/build.mjs`.
// Output goes to docs/, which GitHub Pages serves.
//
// `node site/build.mjs <out> --inline [--trnzit=<url>]` builds the clickable
// prototype for a claude.ai artifact instead: CSS, JS and the font are inlined
// into every page (the artifact viewer only loads images as separate files), and
// index.html is written without its document wrapper, which the viewer adds.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, 'src');
const args = process.argv.slice(2);
const INLINE = args.includes('--inline');
const outArg = args.find((a) => !a.startsWith('--'));
const OUT = outArg ? resolve(outArg) : join(here, '..', 'docs');
const SITE_URL = 'https://www.trnznd.io';
const TRNZIT_URL = (args.find((a) => a.startsWith('--trnzit=')) || '').slice(9) || 'https://www.trnznd.io/trnzit/'; // Trnzit's canonical URL, as set on the Trnzit site
const DASHBOARD_URL = 'https://app.trnznd.io';      // "Enter Dashboard" on the current site
const YEAR = 2026;

// Icons: 24px stroke set, same weight and caps as Trnzit's.
const ICONS = {
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chev: '<path d="M6 9l6 6 6-6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.7L16 9.5"/>',
  ext: '<path d="M7 17L17 7M9 7h8v8"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  scale: '<path d="M12 4v16M7 20h10M5 8h14"/><path d="M5 8l-3 6a3 3 0 006 0L5 8zM19 8l-3 6a3 3 0 006 0l-3-6z"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6l1-7z"/>',
  coins: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
  bank: '<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  chart: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 15l3-4 3 3 4-6"/>',
  store: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0 2.7 2.7 0 005.3 0"/><path d="M5 11v9h14v-9M10 20v-5h4v5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14a6.5 6.5 0 013.5 6"/>',
  usercheck: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0114 0"/><path d="M16 11l2 2 4-4"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  vault: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1.5M12 14.5V16M8 12h1.5M14.5 12H16M6 20v1.5M18 20v1.5"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2V5z"/><path d="M4 19a2 2 0 012-2h13"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
};
const icon = (name, cls = '') => {
  if (!ICONS[name]) throw new Error(`Unknown icon: ${name}`);
  return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
};

// The ZEND lock-up: the Trnznd Enso in solid Teal, then the zend wordmark.
const LOGO = (label = 'ZEND') =>
  `<svg viewBox="29 27 1688 606" role="img" aria-label="${label}"><use href="#lg-enso" fill="#00D4AA"/><use href="#lg-word" fill="currentColor"/></svg>`;

const NAV = [
  { id: 'zend', href: 'index.html', label: 'ZEND' },
  { id: 'business', href: 'business.html', label: 'Business' },
  { id: 'insights', href: 'insights.html', label: 'Insights' },
  { id: 'resources', label: 'Resources', menu: [
    { href: 'faq.html', label: 'FAQ', sub: 'ZEND, how it works, and governance' },
    { href: 'resources.html#documents', label: 'Documents & policies', sub: 'Whitepaper, governance, terms, risk disclosures' },
    { href: 'resources.html#transparency', label: 'Reserve transparency', sub: 'Reserve framework, attestations, audits' },
    { href: 'resources.html#guides', label: 'Video guides', sub: 'How to Trnznd' },
  ] },
  { id: 'about', href: 'about.html', label: 'About' },
  { id: 'contact', href: 'contact.html', label: 'Contact' },
];

function header(r, current) {
  const items = NAV.map((n) => {
    if (n.menu) {
      const isCur = current === n.id;
      return `        <li class="nav__item">
          <button class="nav__trigger${isCur ? ' is-current' : ''}" type="button" aria-expanded="false" aria-controls="menu-${n.id}" data-menu-trigger>${n.label} ${icon('chev')}</button>
          <ul class="nav__menu" id="menu-${n.id}" hidden>
${n.menu.map((m) => `            <li><a href="${r}${m.href}">${m.label}<span>${m.sub}</span></a></li>`).join('\n')}
          </ul>
        </li>`;
    }
    return `        <li><a class="nav__link" href="${r}${n.href}"${current === n.id ? ' aria-current="page"' : ''}>${n.label}</a></li>`;
  }).join('\n');
  const actions = (sm) => `<a class="btn btn--secondary${sm}" href="${DASHBOARD_URL}">Enter Dashboard</a>
        <a class="btn btn--primary${sm}" href="${r}contact.html?type=access">Request access</a>`;
  return `<div class="brand-rule" aria-hidden="true"></div>
<nav class="group-bar" aria-label="Trnznd Group"><div class="container group-bar__inner"><span>Trnznd Group: ZEND and Trnzit</span><a href="${TRNZIT_URL}">Trnzit: stablecoin treasury management, by Trnznd ${icon('ext', 'ext')}</a></div></nav>
<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="logo logo--header" href="${r}index.html">${LOGO('ZEND home')}<span class="logo__desc">Global Stability,<br> by Trnznd</span></a>
    <nav class="nav" id="site-nav" aria-label="Main" data-nav>
      <ul class="nav__list">
${items}
        <li class="nav__group"><a class="nav__link" href="${TRNZIT_URL}">Trnzit ${icon('ext')}</a></li>
      </ul>
      <div class="header-actions">
        ${actions('')}
      </div>
    </nav>
    <div class="header-actions header-actions--desktop">
      ${actions(' btn--sm')}
    </div>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" data-nav-toggle>
      <span class="sr-only">Menu</span>${icon('menu')}
    </button>
  </div>
</header>`;
}

function footer(r) {
  const col = (title, links) => `      <div class="footer-col">
        <h2>${title}</h2>
        <ul>
${links.map(([h, l]) => `          <li><a href="${/^https?:/.test(h) ? h : r + h}">${l}</a></li>`).join('\n')}
        </ul>
      </div>`;
  return `<footer class="site-footer on-dark">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="logo" href="${r}index.html">${LOGO('ZEND home')}</a>
        <p><span class="tagline">Global Stability, by Trnznd</span>Purpose Beyond Payment. Engineered for stability, compliant by design, made to transcend barriers.</p>
        <a class="footer-parent" href="${r}about.html#group"><span>A Trnznd Group product</span><img src="${r}assets/logo/trnznd-logo-dark.webp" width="150" height="50" alt="Trnznd"></a>
      </div>
${col('ZEND', [['index.html', 'ZEND'], ['index.html#how-it-works', 'How it works'], ['business.html', 'For business'], [DASHBOARD_URL, 'Enter Dashboard']])}
${col('Resources', [['insights.html', 'Insights'], ['faq.html', 'FAQ'], ['resources.html#documents', 'Documents & policies'], ['resources.html#transparency', 'Reserve transparency']])}
${col('Company', [['about.html', 'The Trnznd Group'], ['contact.html', 'Contact'], ['contact.html?type=access', 'Request access'], [TRNZIT_URL, 'Trnzit']])}
${col('Legal', [['legal/notice.html', 'Important notice'], ['legal/risk.html', 'Risk disclosures'], ['legal/terms.html', 'Terms & conditions'], ['legal/privacy.html', 'Privacy'], ['legal/complaints.html', 'Complaints'], ['legal/cookies.html', 'Cookies']])}
    </div>
    <div class="disclaimer">
      <p><strong>Important notice:</strong> ZEND is designed as a settlement and treasury utility asset. It is not intended to be marketed, offered or used as an investment product, security, collective investment scheme, deposit, savings product or speculative instrument, and it carries no ownership rights in Trnznd, entitlement to profits, dividends, interest or voting rights, or any expectation of financial return. No asset is entirely free from risk. Access to Trnznd services is subject to onboarding, identity verification, compliance and eligibility requirements. <a href="${r}legal/notice.html">Read the full notice</a>.</p>
    </div>
    <div class="footer-bottom">
      <p style="margin:0">© ${YEAR} Trnznd, S.A. All rights reserved.</p>
      <ul>
        <li><a href="${r}legal/terms.html">Terms</a></li>
        <li><a href="${r}legal/privacy.html">Privacy</a></li>
        <li><a href="${r}legal/cookies.html">Cookies</a></li>
        <li><a href="${r}brand/logo.html">Brand assets</a></li>
      </ul>
    </div>
  </div>
</footer>`;
}

let inlineCss = '', inlineJs = '';
if (INLINE) {
  const font = readFileSync(join(SRC, 'assets', 'fonts', 'inter-latin.woff2')).toString('base64');
  inlineCss = ['group.css', 'trnznd.css'].map((f) => readFileSync(join(SRC, 'assets', 'css', f), 'utf8')).join('\n')
    .replace('url("../fonts/inter-latin.woff2")', `url(data:font/woff2;base64,${font})`);
  inlineJs = readFileSync(join(SRC, 'assets', 'js', 'site.js'), 'utf8');
}

function head(r, meta, path) {
  const url = SITE_URL + '/' + (path === 'index.html' ? '' : path);
  const title = meta.title ? `${meta.title} · ZEND` : 'ZEND · Global Stability, by Trnznd';
  const robots = meta.robots || 'index, follow';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${meta.description}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#FFFFFF">
<meta name="color-scheme" content="light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ZEND by Trnznd">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${meta.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE_URL}/assets/img/og-image.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${r}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${r}assets/img/apple-touch-icon.png">
${INLINE ? `<style>${inlineCss}</style>` : `<link rel="preload" href="${r}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${r}assets/css/group.css">
<link rel="stylesheet" href="${r}assets/css/trnznd.css">`}
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>`;
}

function parse(file) {
  const raw = readFileSync(file, 'utf8');
  const m = raw.match(/^<!--\n([\s\S]*?)\n-->\n/);
  if (!m) throw new Error(`Missing meta block: ${file}`);
  const meta = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { meta, body: raw.slice(m[0].length) };
}

function walk(dir) {
  return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
cpSync(join(SRC, 'favicon.svg'), join(OUT, 'favicon.svg'));
writeFileSync(join(OUT, '.nojekyll'), '');
const sprite = readFileSync(join(SRC, 'partials', 'sprite.html'), 'utf8').trim();

const PAGES = join(SRC, 'pages');
let count = 0;
for (const file of walk(PAGES).filter((f) => f.endsWith('.html'))) {
  const path = relative(PAGES, file).split('\\').join('/');
  const depth = path.split('/').length - 1;
  const r = '../'.repeat(depth);
  const { meta, body } = parse(file);
  const content = body
    .replace(/\{\{i:([a-z]+)\}\}/g, (_, n) => icon(n))
    .replace(/\{\{logo\}\}/g, LOGO())
    .replace(/\{\{dashboard\}\}/g, DASHBOARD_URL)
    .replace(/\{\{trnzit\}\}/g, TRNZIT_URL)
    .replace(/\{\{root\}\}/g, r);
  if (/\{\{/.test(content)) throw new Error(`Unresolved token in ${path}`);
  const script = INLINE ? `<script>${inlineJs}</script>` : `<script src="${r}assets/js/site.js" defer></script>`;
  let html = [head(r, meta, path), sprite, header(r, meta.nav), `<main id="main">${content.trim()}\n</main>`, footer(r), script, '</body>', '</html>', ''].join('\n');
  if (INLINE && path === 'index.html') {
    // The artifact viewer wraps the entry page itself: keep the title first, drop the wrapper.
    html = html.replace(/^<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n<title>[^<]*<\/title>/, '<title>Trnznd</title>')
      .replace('</head>\n<body>\n', '').replace(/\n<\/body>\n<\/html>\n$/, '\n');
    if (html.startsWith('<!doctype')) throw new Error('Could not unwrap index.html for the artifact build');
  }
  mkdirSync(dirname(join(OUT, path)), { recursive: true });
  writeFileSync(join(OUT, path), html);
  count++;
}
console.log(`Built ${count} pages into ${relative(process.cwd(), OUT) || '.'}`);
