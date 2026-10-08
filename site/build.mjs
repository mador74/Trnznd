// Builds the three connected Trnznd sites into docs/ (served by GitHub Pages):
//   /         the Trnznd Group site   (src/group)
//   /zend/    the Zend site           (src/zend)
//   /trnzit/  the Trnzit site         (src/trnzit, finished pages copied with links resolved)
// Group and Zend pages are wrapped in their site's head, header and footer; all three
// share the cross-site strip and the assets in src/assets. No dependencies:
//   node site/build.mjs
//
// `node site/build.mjs <out> --inline` builds the clickable prototype for a claude.ai
// artifact instead: CSS, JS and the font are inlined into every page (the artifact viewer
// only loads images as separate files), and the group home page is written without its
// document wrapper, which the viewer adds.
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
const DASHBOARD_URL = 'https://zend.trnznd.io';     // the Zend Portal: every "Enter Zend Portal" / "Zend Portal" link
const TRNZIT_PORTAL_URL = 'https://app.trnznd.io';  // the Trnzit Portal: every "Enter Trnzit Portal" / "Trnzit Portal" link
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

// The Zend lock-up: the Trnznd Enso in solid Teal, then the zend wordmark.
const LOGO = (label = 'Zend') =>
  `<svg viewBox="29 27 1688 606" role="img" aria-label="${label}"><use href="#lg-enso" fill="#00D4AA"/><use href="#lg-word" fill="currentColor"/></svg>`;

// ── Site-wide legal lines: in the footer notice of every page on all three sites ──
const TRADING_NAME = 'Trnznd is a trading name of the Trnznd group of companies.'; // the group notice opens with this sentence too
const NO_SOLICITATION = 'Nothing on this website is an offer, invitation or solicitation to acquire any product or service in any jurisdiction, or to any person, where it would be unlawful to make one.';
const groupNotice = (product) => `<p>${TRADING_NAME} ${product} ${NO_SOLICITATION}</p>`;

// ── Cross-site strip: the same on every page of all three sites ─────────────
// The strip sticks to the top with the site header directly under it, so the two scroll as one block.
const SWITCH_CSS = '@media (min-width:1281px){.header-actions--desktop .btn--secondary{display:inline-flex}}/* Parent credit in the Zend and Trnzit footers */.footer-parent{display:inline-flex;flex-direction:column;gap:10px;margin-top:var(--space-5);text-decoration:none;color:var(--ash);font-family:var(--font-secondary);font-size:var(--fs-small);font-weight:600}.footer-parent img{width:150px;height:auto}.footer-parent:hover{color:var(--white);text-decoration:none}/* CTA panels: the call-to-action style on every site. Light by default; dark inside dark bands. All panels look the same at rest; only the one under the pointer (or keyboard focus) highlights. */.cta-panels{list-style:none;margin:var(--space-6) 0 0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));max-width:46rem}.center .cta-panels{margin-inline:auto}.cta-panels li a{display:grid;grid-template-columns:1fr auto;align-items:center;column-gap:16px;height:100%;padding:16px 20px;border:1px solid var(--border);border-radius:var(--radius-card);background:var(--white);color:var(--midnight);text-align:left;text-decoration:none;font-family:var(--font-secondary);box-shadow:var(--shadow-sm);transition:border-color var(--t-fast) var(--ease),background-color var(--t-fast) var(--ease),box-shadow var(--t-fast) var(--ease),transform var(--t-fast) var(--ease)}.cta-panels li a:hover,.cta-panels li a:focus-visible{border-color:var(--teal);background:rgba(0,212,170,.14);box-shadow:0 0 0 1px var(--teal),var(--shadow-md);transform:translateY(-2px);text-decoration:none}.cta-panels li a:focus-visible{outline:2px solid var(--focus);outline-offset:3px}.cta-panels__name{grid-column:1;font-weight:700;font-size:1.0625rem;color:var(--midnight)}.cta-panels__desc{grid-column:1;margin-top:2px;font-size:var(--fs-small);line-height:1.45;color:var(--graphite)}.cta-panels li a>svg{grid-column:2;grid-row:1 / span 2;width:20px;height:20px;color:var(--teal);transition:transform var(--t-fast) var(--ease)}.cta-panels li a:hover>svg,.cta-panels li a:focus-visible>svg{transform:translateX(3px)}:is(.section--dark,.cta-band,.on-dark) .cta-panels li a{border-color:rgba(255,255,255,.14);background:rgba(10,15,30,.55);box-shadow:none;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}:is(.section--dark,.cta-band,.on-dark) .cta-panels li a:hover,:is(.section--dark,.cta-band,.on-dark) .cta-panels li a:focus-visible{border-color:var(--teal);background:rgba(0,212,170,.12);box-shadow:0 0 0 1px var(--teal),0 12px 32px -12px rgba(0,212,170,.35)}:is(.section--dark,.cta-band,.on-dark) .cta-panels__name{color:var(--teal)}:is(.section--dark,.cta-band,.on-dark) .cta-panels__desc{color:#C9CED6}.cta-panels--stack{grid-template-columns:minmax(0,1fr);max-width:min(36rem,48vw)}.cta-panels--row{max-width:none;margin-top:var(--space-7)}@media (max-width:960px){.cta-panels--stack{max-width:40rem}}.disclaimer p + p{margin-top:12px}:root{--switch-h:41px}html:has(.site-switch){scroll-padding-top:calc(88px + var(--switch-h))}html:has(.site-switch):has(.subnav){scroll-padding-top:calc(148px + var(--switch-h))}.site-switch{position:sticky;top:env(safe-area-inset-top,0px);z-index:51}.site-switch + .site-header{top:calc(env(safe-area-inset-top,0px) + var(--switch-h));background:var(--white);-webkit-backdrop-filter:none;backdrop-filter:none}.site-switch ~ * .subnav{top:calc(76px + var(--switch-h))}.site-switch .group-bar__inner{min-height:40px}.site-switch__list{display:flex;align-items:center;gap:2px;list-style:none;margin:0;padding:0}.site-switch .site-switch__list a{display:inline-block;padding:5px 10px;border-radius:8px;color:var(--steel);font-weight:600;text-decoration:none}.site-switch .site-switch__list a:hover{color:var(--midnight);background:var(--white);text-decoration:none}.site-switch .site-switch__list a[aria-current]{color:var(--midnight);background:var(--white);box-shadow:inset 0 -2px 0 var(--teal)}';
// Trnzit's menu is longer than Zend's: tighten it on smaller desktops so both header buttons fit.
const TRNZIT_HEADER_CSS = '@media (min-width:1281px){.nav__link,.nav__trigger{padding-inline:8px}.nav__list{gap:0}.header-inner{gap:var(--space-4)}}@media (min-width:1281px){.logo--header .logo__desc{display:none}}';
function siteSwitch(r, current) {
  const items = [['group', 'index.html', 'Trnznd Group'], ['zend', 'zend/index.html', 'Zend'], ['trnzit', 'trnzit/index.html', 'Trnzit']];
  const note = { group: '', zend: 'Zend is a product of Trnznd S.A.', trnzit: 'Trnzit is a product of Trnznd Technologies' }[current];
  return `<nav class="group-bar site-switch" aria-label="Trnznd Group sites"><style>${SWITCH_CSS}${current === 'trnzit' ? TRNZIT_HEADER_CSS : ''}</style><div class="container group-bar__inner"><ul class="site-switch__list">${items.map(([id, h, l]) => `<li><a href="${r}${h}"${id === current ? ' aria-current="true"' : ''}>${l}</a></li>`).join('')}</ul>${note ? `<span>${note}</span>` : ''}</div></nav>`;
}

const navItems = (list, current) => list.map((n) => {
  if (n.menu) {
    return `        <li class="nav__item">
          <button class="nav__trigger${current === n.id ? ' is-current' : ''}" type="button" aria-expanded="false" aria-controls="menu-${n.id}" data-menu-trigger>${n.label} ${icon('chev')}</button>
          <ul class="nav__menu" id="menu-${n.id}" hidden>
${n.menu.map((m) => `            <li><a href="${m.href}">${m.label}<span>${m.sub}</span></a></li>`).join('\n')}
          </ul>
        </li>`;
  }
  return `        <li><a class="nav__link" href="${n.href}"${current === n.id ? ' aria-current="page"' : ''}>${n.label}</a></li>`;
}).join('\n');

const headerShell = (switchHtml, logo, items, actions) => `<div class="brand-rule" aria-hidden="true"></div>
${switchHtml}
<header class="site-header" data-header>
  <div class="container header-inner">
    ${logo}
    <nav class="nav" id="site-nav" aria-label="Main" data-nav>
      <ul class="nav__list">
${items}
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

const footerCol = (title, links) => `      <div class="footer-col">
        <h2>${title}</h2>
        <ul>
${links.map(([h, l]) => `          <li><a href="${h}">${l}</a></li>`).join('\n')}
        </ul>
      </div>`;

// ── Zend site ────────────────────────────────────────────────────────────────
// r: path to the root of all three sites; s: path to the Zend site root.
function zendHeader(r, s, current) {
  const nav = [
    { id: 'zend', href: `${s}index.html`, label: 'Zend' },
    { id: 'business', href: `${s}business.html`, label: 'Business' },
    { id: 'insights', href: `${s}insights.html`, label: 'Insights' },
    { id: 'resources', label: 'Resources', menu: [
      { href: `${s}faq.html`, label: 'FAQ', sub: 'Zend, how it works, and governance' },
      { href: `${s}resources.html#documents`, label: 'Documents & policies', sub: 'Whitepaper, governance, terms, risk disclosures' },
      { href: `${s}resources.html#transparency`, label: 'Reserve transparency', sub: 'Reserve framework, attestations, audits' },
      { href: `${s}resources.html#guides`, label: 'Video guides', sub: 'How to Trnznd' },
    ] },
    { id: 'contact', href: `${r}contact.html`, label: 'Contact' },
  ];
  const actions = (sm) => `<a class="btn btn--secondary${sm}" href="${DASHBOARD_URL}">Enter Zend Portal</a>
        <a class="btn btn--primary${sm}" href="${r}contact.html?type=access">Request access</a>`;
  const logo = `<a class="logo logo--header" href="${s}index.html">${LOGO('Zend home')}<span class="logo__desc">Global Stability,<br> by Trnznd</span></a>`;
  return headerShell(siteSwitch(r, 'zend'), logo, navItems(nav, current), actions);
}

function zendFooter(r, s) {
  return `<footer class="site-footer on-dark">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="logo" href="${s}index.html">${LOGO('Zend home')}</a>
        <p><span class="tagline">Global Stability, by Trnznd</span>Purpose Beyond Payment.</p>
        <p class="footer-brand__more">Engineered for stability, compliant by design, built to transcend barriers.</p>
        <a class="footer-parent" href="${r}index.html#group"><span>Brought to you by Trnznd</span><img src="${r}assets/logo/trnznd-logo-dark.webp" width="150" height="50" alt="Trnznd"></a>
      </div>
${footerCol('<span class="brand-case">Zend</span>', [[`${s}index.html`, 'Zend'], [`${s}index.html#how-it-works`, 'How it works'], [`${s}business.html`, 'For business'], [DASHBOARD_URL, 'Enter Zend Portal']])}
${footerCol('Resources', [[`${s}insights.html`, 'Insights'], [`${s}faq.html`, 'FAQ'], [`${s}resources.html#documents`, 'Documents & policies'], [`${s}resources.html#transparency`, 'Reserve transparency']])}
${footerCol('Company', [[`${r}index.html`, 'The Trnznd Group'], [`${r}contact.html`, 'Contact'], [`${r}contact.html?type=access`, 'Request access'], [`${r}trnzit/index.html`, 'Trnzit']])}
${footerCol('Legal', [[`${s}legal/notice.html`, 'Important notice'], [`${s}legal/risk.html`, 'Risk disclosures'], [`${s}legal/terms.html`, 'Terms & conditions'], [`${s}legal/privacy.html`, 'Privacy'], [`${s}legal/complaints.html`, 'Complaints'], [`${s}legal/cookies.html`, 'Cookies']])}
    </div>
    <div class="disclaimer">
      <p><strong>Important notice:</strong> Zend is designed as a settlement and treasury utility asset. It is not intended to be marketed, offered or used as an investment product, security, collective investment scheme, deposit, savings product or speculative instrument, and it carries no ownership rights in Trnznd, entitlement to profits, dividends, interest or voting rights, or any expectation of financial return. No asset is entirely free from risk. Access to Trnznd services is subject to onboarding, identity verification, compliance and eligibility requirements. <a href="${s}legal/notice.html">Read the full notice</a>.</p>
      ${groupNotice('Zend is offered by Trnznd S.A. and is available on Ethereum, Solana and Tron.')}
    </div>
    <div class="footer-bottom">
      <p style="margin:0">© ${YEAR} Trnznd, S.A. All rights reserved.</p>
      <ul>
        <li><a href="${s}legal/terms.html">Terms</a></li>
        <li><a href="${s}legal/privacy.html">Privacy</a></li>
        <li><a href="${s}legal/cookies.html">Cookies</a></li>
        <li><a href="${s}brand/logo.html">Brand assets</a></li>
      </ul>
    </div>
  </div>
</footer>`;
}

// ── Group site ───────────────────────────────────────────────────────────────
function groupHeader(r, s, current) {
  const nav = [
    { id: 'about', href: `${r}index.html`, label: 'The group' },
    { id: 'zend', href: `${r}zend/index.html`, label: 'Zend' },
    { id: 'trnzit', href: `${r}trnzit/index.html`, label: 'Trnzit' },
  ];
  const actions = (sm) => `<a class="btn btn--primary${sm}" href="${r}contact.html">Contact us</a>`;
  const logo = `<a class="logo logo--header logo--group" href="${r}index.html"><img src="${r}assets/logo/trnznd-logo-light.webp" width="135" height="45" alt="Trnznd Group home"><span class="logo__desc">Purpose<br> Beyond Payment</span></a>`;
  return headerShell(siteSwitch(r, 'group'), logo, navItems(nav, current), actions);
}

function groupFooter(r) {
  return `<footer class="site-footer on-dark">
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <a class="logo logo--group" href="${r}index.html"><img src="${r}assets/logo/trnznd-logo-dark.webp" width="150" height="50" alt="Trnznd Group home"></a>
        <p><span class="tagline">Purpose Beyond Payment</span></p>
        <ul class="footer-entities">
          <li><strong>Trnznd S.A.</strong>Panama-incorporated technology company<br>Tower Financial Center, Panama</li>
          <li><strong>Trnznd Technologies</strong>UAE-incorporated technology and software company<br>DIFC Innovation Hub, UAE</li>
        </ul>
      </div>
${footerCol('Group', [[`${r}index.html`, 'The group'], [`${r}index.html#group`, 'What the group offers'], [`${r}contact.html`, 'Contact']])}
${footerCol('Products', [[`${r}zend/index.html`, 'Zend'], [`${r}zend/business.html`, 'Zend for business'], [`${r}trnzit/index.html`, 'Trnzit'], [`${r}trnzit/platform.html`, 'Trnzit platform'], [DASHBOARD_URL, 'Zend Portal'], [TRNZIT_PORTAL_URL, 'Trnzit Portal']])}
${footerCol('Product legal', [[`${r}zend/legal/notice.html`, 'Zend notices & terms'], [`${r}trnzit/legal/terms.html`, 'Trnzit terms']])}
${footerCol('Group legal', [[`${r}legal/privacy.html`, 'Privacy'], [`${r}legal/cookies.html`, 'Cookies']])}
    </div>
    <div class="disclaimer">
      <p><strong>Important notice:</strong> Trnznd is a trading name of the Trnznd group of companies. Each product is offered by a separate legal entity within the group: Zend by Trnznd S.A., and Trnzit by Trnznd Technologies, each under its own terms, notices and policies. Access to any product is at the sole discretion of the user and of the entity that provides it, and is subject to that entity’s onboarding, verification and eligibility requirements.</p>
      <p>${NO_SOLICITATION}</p>
    </div>
    <div class="footer-bottom">
      <p style="margin:0">© ${YEAR} Trnznd Group. All rights reserved.</p>
      <ul>
        <li><a href="${r}legal/privacy.html">Privacy</a></li>
        <li><a href="${r}legal/cookies.html">Cookies</a></li>
      </ul>
    </div>
  </div>
</footer>`;
}

const SITES = [
  { id: 'group', dir: 'group', base: '', header: groupHeader, footer: groupFooter, titleSuffix: ' · Trnznd Group', defaultTitle: 'Trnznd Group · Purpose Beyond Payment', siteName: 'Trnznd Group' },
  { id: 'zend', dir: 'zend', base: 'zend/', header: zendHeader, footer: zendFooter, titleSuffix: ' · Zend', defaultTitle: 'Zend · Global Stability, by Trnznd', siteName: 'Zend by Trnznd' },
];

let inlineCss = '', inlineJs = '';
if (INLINE) {
  const font = readFileSync(join(SRC, 'assets', 'fonts', 'inter-latin.woff2')).toString('base64');
  inlineCss = ['group.css', 'trnznd.css'].map((f) => readFileSync(join(SRC, 'assets', 'css', f), 'utf8')).join('\n')
    .replace('url("../fonts/inter-latin.woff2")', `url(data:font/woff2;base64,${font})`);
  inlineJs = readFileSync(join(SRC, 'assets', 'js', 'site.js'), 'utf8');
}

// Landing intro (pages with `intro: yes`): the ring of light on Midnight, drawn in, then opened as a portal
// onto the page. Shown once per browser session, never with reduced motion, and skipped on any input.
const INTRO_HEAD = (r) => `<link rel="preload" as="image" href="${r}assets/img/intro-enso.webp" imagesrcset="${r}assets/img/intro-enso-sm.webp 581w, ${r}assets/img/intro-enso.webp 1163w" imagesizes="min(77vmin, 580px)">
<script>(function(){if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;try{if(sessionStorage.getItem('trnznd-intro'))return;sessionStorage.setItem('trnznd-intro','1')}catch(e){}document.documentElement.classList.add('has-intro')})()</script>`;
const INTRO = (r) => `<div class="intro" aria-hidden="true" data-intro><div class="intro__iris"></div><div class="intro__ground"></div><div class="intro__glow"></div><img class="intro__enso" src="${r}assets/img/intro-enso.webp" srcset="${r}assets/img/intro-enso-sm.webp 581w, ${r}assets/img/intro-enso.webp 1163w" sizes="min(77vmin, 580px)" width="1163" height="1164" alt="" decoding="sync"><img class="intro__word" src="${r}assets/img/intro-wordmark.webp" width="1186" height="331" alt=""></div>`;

function head(r, meta, outPath, site) {
  const url = SITE_URL + '/' + outPath.replace(/(^|\/)index\.html$/, '$1');
  const title = meta.title ? `${meta.title}${site.titleSuffix}` : site.defaultTitle;
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
<meta property="og:site_name" content="${site.siteName}">
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
<script>document.documentElement.classList.add('js')</script>${meta.intro === 'yes' ? '\n' + INTRO_HEAD(r) : ''}
</head>
<body>${meta.intro === 'yes' ? '\n' + INTRO(r) : ''}
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

// Links between the three sites, resolved for a page's depth.
const crossLinks = (text, r, s) => text
  .replace(/\{\{group\}\}/g, r)
  .replace(/\{\{zend\}\}/g, `${r}zend/`)
  .replace(/\{\{trnzit\}\}/g, `${r}trnzit/`)
  .replace(/\{\{root\}\}/g, s)
  .replace(/\{\{dashboard\}\}/g, DASHBOARD_URL)
  .replace(/\{\{trnzit-portal\}\}/g, TRNZIT_PORTAL_URL);

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(SRC, 'assets'), join(OUT, 'assets'), { recursive: true });
cpSync(join(SRC, 'favicon.svg'), join(OUT, 'favicon.svg'));
writeFileSync(join(OUT, '.nojekyll'), '');
const sprite = readFileSync(join(SRC, 'partials', 'sprite.html'), 'utf8').trim();

let count = 0;
for (const site of SITES) {
  const dir = join(SRC, site.dir);
  for (const file of walk(dir).filter((f) => f.endsWith('.html'))) {
    const rel = relative(dir, file).split('\\').join('/');
    const outPath = site.base + rel;
    const r = '../'.repeat(outPath.split('/').length - 1);
    const s = r + site.base;
    const { meta, body } = parse(file);
    let content = crossLinks(body
      .replace(/\{\{i:([a-z]+)\}\}/g, (_, n) => icon(n))
      .replace(/\{\{logo\}\}/g, LOGO())
      .replace(/\{\{dashboard\}\}/g, DASHBOARD_URL), r, s)
      // shared assets live at the root of all three sites
      .replace(/((?:src|href)=")(?:\.\.\/)*(assets\/|favicon\.svg)/g, `$1${r}$2`)
      // srcset holds several URLs: rewrite each asset path in it
      .replace(/srcset="([^"]*)"/g, (m, v) => `srcset="${v.replace(/(^|,\s*)(?:\.\.\/)*(assets\/)/g, `$1${r}$2`)}"`);
    if (site.id === 'zend') {
      // contact and "about the group" are group pages
      content = content
        .replace(/href="(?:\.\.\/)*contact\.html/g, `href="${r}contact.html`)
        .replace(/href="(?:\.\.\/)*about\.html/g, `href="${r}index.html`);
    }
    if (/\{\{/.test(content)) throw new Error(`Unresolved token in ${outPath}`);
    const script = INLINE ? `<script>${inlineJs}</script>` : `<script src="${r}assets/js/site.js" defer></script>`;
    let html = [head(r, meta, outPath, site), sprite, site.header(r, s, meta.nav), `<main id="main">${content.trim()}\n</main>`, site.footer(r, s), script, '</body>', '</html>', ''].join('\n');
    if (INLINE && outPath === 'index.html') {
      // The artifact viewer wraps the entry page itself: keep the title first, drop the wrapper.
      html = html.replace(/^<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n<title>[^<]*<\/title>/, '<title>Trnznd</title>')
        .replace('</head>\n<body>\n', '').replace(/\n<\/body>\n<\/html>\n$/, '\n');
      if (html.startsWith('<!doctype')) throw new Error('Could not unwrap index.html for the artifact build');
    }
    mkdirSync(dirname(join(OUT, outPath)), { recursive: true });
    writeFileSync(join(OUT, outPath), html);
    count++;
  }
}

// Trnzit: finished pages (styles inlined), copied with the strip and cross-site links resolved.
const TRNZIT = join(SRC, 'trnzit');
let tcount = 0;
for (const file of walk(TRNZIT)) {
  const rel = relative(TRNZIT, file).split('\\').join('/');
  const outPath = 'trnzit/' + rel;
  mkdirSync(dirname(join(OUT, outPath)), { recursive: true });
  if (!file.endsWith('.html')) { cpSync(file, join(OUT, outPath)); continue; }
  const r = '../'.repeat(outPath.split('/').length - 1);
  const html = crossLinks(readFileSync(file, 'utf8').replace('{{site-switch}}', siteSwitch(r, 'trnzit')).replace('{{group-notice}}', groupNotice('Trnzit is provided by Trnznd Technologies.')), r, r + 'trnzit/');
  if (/\{\{(group|zend|trnzit|root|site-switch|group-notice|trnzit-portal|dashboard)\}\}/.test(html)) throw new Error(`Unresolved token in ${outPath}`);
  writeFileSync(join(OUT, outPath), html);
  tcount++;
}
console.log(`Built ${count} group and Zend pages and ${tcount} Trnzit pages into ${relative(process.cwd(), OUT) || '.'}`);
