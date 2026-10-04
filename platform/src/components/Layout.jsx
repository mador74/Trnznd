import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { ROLES } from '../data/seed.js';
import { deriveStatus, cannotSignReason } from '../lib/policy.js';
import { ConfirmButton } from './ui.jsx';
import Sidebar from './Sidebar.jsx';
import { planOf } from '../lib/plans.js';
import { DISPLAY_CURRENCIES, REGIONS } from '../lib/fx.js';
import { displayCurrency } from '../lib/format.js';

function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('trnznd-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('trnznd-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export default function Layout() {
  const { state, dispatch } = useStore();
  const [theme, toggle] = useTheme();
  const toSign = state.requests.filter(
    (r) => deriveStatus(r, state.policies, state.users) === 'pending' && !cannotSignReason(r, state.currentUserId, state.policies, state.users),
  ).length;
  const active = state.users.filter((u) => u.status === 'active');
  const plan = planOf(state);
  const ready = state.requests.filter((r) => !['address_whitelist', 'conversion'].includes(r.type) && deriveStatus(r, state.policies, state.users) === 'approved').length;
  const sections = [
    { label: 'Overview', items: [{ to: '/', end: true, text: 'Dashboard', icon: 'home', hint: 'Balances and activity' }] },
    { label: 'Accounts', items: [
      { to: '/connections', text: 'Connections', icon: 'link', hint: 'Exchanges, custodians, wallets, banks' },
      { to: '/fund', text: 'Buy & mint', icon: 'plus', hint: 'Stablecoin on-ramp and ZEND' },
    ] },
    { label: 'Payments', items: [
      { to: '/send', text: 'Send', icon: 'send', hint: 'Pay a whitelisted counterparty', count: ready },
      { to: '/convert', text: 'Convert', icon: 'swap', hint: 'Fiat, stablecoins and crypto' },
      { to: '/approvals', text: 'Approvals', icon: 'shield', hint: plan.approvals ? 'Sign-off rules and queue' : 'Premium and Institution', count: plan.approvals ? toSign : 0, lock: !plan.approvals },
    ] },
    { label: 'Records', items: [
      { to: '/transactions', text: 'Transactions', icon: 'list', hint: 'Every movement, in and out' },
      { to: '/invoices', text: 'Invoices', icon: 'invoice', hint: 'Bill customers, get paid' },
    ] },
    { label: 'Company', items: [
      { to: '/team', text: 'Team', icon: 'users', hint: 'Users, roles and releasers' },
      { to: '/settings', text: 'Plan & billing', icon: 'card', hint: 'Basic, Premium, Institution' },
      { to: '/audit', text: 'Audit log', icon: 'clock', hint: 'Who did what, and when' },
    ] },
  ];
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('trnzit-sidebar') === 'collapsed'; } catch { return false; }
  });
  const toggleSidebar = () => setCollapsed((c) => {
    try { localStorage.setItem('trnzit-sidebar', c ? 'open' : 'collapsed'); } catch { /* ignore */ }
    return !c;
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  // Keep the sidebar pinned just under the header, whatever height the header wraps to.
  const headerRef = useRef(null);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--hdr', `${el.offsetHeight}px`));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <>
      <header className="topbar" ref={headerRef}>
        <div className="topbar__inner">
          <button type="button" className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">☰</button>
          <Link to="/" className="brand" aria-label="TRNZIT Treasury Management, by TRNZND">
            <span className="brand__mark" />
            TRNZIT <span className="brand__sub">Treasury Management, by TRNZND</span>
          </Link>
          <span className="org">{state.org.name} · {plan.name}</span>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end><span className="lbl-long">Dashboard</span><span className="lbl-short">Home</span></NavLink>
            <NavMenu label="Accounts" items={[['/connections', 'Connections', 'Exchanges, custodians, wallets, banks'], ['/fund', 'Buy & mint', 'Stablecoin on-ramp and ZEND']]} />
            <NavMenu
              label="Payments"
              badge={(plan.approvals ? toSign : 0) + ready}
              items={[
                ['/send', 'Send', 'Pay a whitelisted counterparty', ready],
                ['/convert', 'Convert', 'Fiat, stablecoins and crypto'],
                ['/approvals', plan.approvals ? 'Approvals' : 'Approvals 🔒', plan.approvals ? 'Sign-off rules and queue' : 'Premium and Institution', plan.approvals ? toSign : 0],
              ]}
            />
            <NavMenu label="Records" items={[['/transactions', 'Transactions', 'Every movement, in and out'], ['/invoices', 'Invoices', 'Bill customers, get paid']]} />
            <NavMenu label="Company" items={[['/team', 'Team', 'Users, roles and releasers'], ['/settings', 'Plan & billing', 'Basic, Premium, Institution'], ['/audit', 'Audit log', 'Who did what, and when']]} />
          </nav>
          <div className="topbar__tools">
          <label className="row small" title="Prototype only: switch user to simulate multi-party approvals">
            <span className="who-label" style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>Signed in as</span>
            <select aria-label="Signed in as" value={state.currentUserId} onChange={(e) => dispatch({ type: 'SET_CURRENT_USER', userId: e.target.value })}>
              {active.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {ROLES[u.role].label}</option>
              ))}
            </select>
          </label>
          <select className="ccy" aria-label="Display currency" title="Show all totals in this currency (demo exchange rates)"
            value={displayCurrency()} onChange={(e) => dispatch({ type: 'SET_DISPLAY_CURRENCY', code: e.target.value })}>
            {REGIONS.map((r) => (
              <optgroup key={r} label={r}>
                {Object.entries(DISPLAY_CURRENCIES).filter(([, c]) => c.region === r).map(([code, c]) => <option key={code} value={code} title={c.name}>{code} · {c.name}</option>)}
              </optgroup>
            ))}
          </select>
          <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">{theme === 'dark' ? '☀' : '☾'}</button>
          </div>
        </div>
      </header>
      <div className="demo-banner">
        Prototype with demo data only — no real accounts are connected, and prices and exchange rates are static.{' '}
        <ConfirmButton className="btn ghost sm" prompt="Click again to reset everything" onConfirm={() => dispatch({ type: 'RESET' })}>Reset demo</ConfirmButton>
      </div>
      <div className={`shell${collapsed ? ' shell--collapsed' : ''}`}>
      <Sidebar sections={sections} collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="shell__main">
      <main className="page">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer__inner">
          <div className="footer__brand"><strong>TRNZIT</strong> Treasury Management, by TRNZND · <em>Purpose Beyond Payment</em></div>
          <p>
            TRNZIT is software built and operated by TRNZND UAE, part of the TRNZND group. It is non-custodial: TRNZIT never holds
            your funds or private keys, and the only payment it receives from you is your subscription.
          </p>
          <p>
            Custody, exchange, conversion, on-ramp and open-banking services are provided by independent third-party providers,
            licensed or registered as required in their own jurisdictions, under their own terms. ZEND is issued by
            TRNZND S.A. (Panama), a separate TRNZND group company, under its own terms.
          </p>
          <div className="footer__links"><Link to="/terms">Terms and conditions</Link><span>© {new Date().getFullYear()} TRNZND UAE</span></div>
        </div>
      </footer>
      </div>
      </div>
    </>
  );
}

/** Menu group: a button that opens a short list of pages. Highlighted when one of its pages is open. */
function NavMenu({ label, items, badge = 0 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { pathname } = useLocation();
  const active = items.some(([to]) => pathname === to || pathname.startsWith(to + '/'));
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div className="navmenu" ref={ref}>
      <button type="button" className={`navmenu__btn${active ? ' active' : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}{badge > 0 && <span className="count">{badge}</span>}<span className="navmenu__caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="navmenu__list" role="menu">
          {items.map(([to, text, hint, count]) => (
            <NavLink key={to} to={to} role="menuitem" className="navmenu__item">
              <span className="row" style={{ gap: 6 }}>{text}{count > 0 && <span className="count">{count}</span>}</span>
              {hint && <span className="navmenu__hint">{hint}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
