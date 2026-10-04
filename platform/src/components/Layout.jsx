import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { ROLES } from '../data/seed.js';
import { deriveStatus, cannotSignReason } from '../lib/policy.js';
import { ConfirmButton } from './ui.jsx';
import { planOf } from '../lib/plans.js';

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

  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="brand">
            <span className="brand__mark" />
            trnznd <span className="brand__sub">Treasury</span>
          </Link>
          <span className="org">{state.org.name} · {plan.name}</span>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/connections">Connections</NavLink>
            <NavLink to="/transactions">Transactions</NavLink>
            <NavLink to="/invoices">Invoices</NavLink>
            <NavLink to="/approvals">
              Approvals{plan.approvals ? toSign > 0 && <span className="count" title="Waiting for your signature">{toSign}</span> : <span className="lock" title="Not included in Basic">🔒</span>}
            </NavLink>
            <NavLink to="/team">Team</NavLink>
            <NavLink to="/audit">Audit log</NavLink>
            <NavLink to="/settings">Billing</NavLink>
          </nav>
          <span className="spacer" />
          <label className="row small" title="Prototype only: switch user to simulate multi-party approvals">
            <span className="who-label" style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>Signed in as</span>
            <select aria-label="Signed in as" value={state.currentUserId} onChange={(e) => dispatch({ type: 'SET_CURRENT_USER', userId: e.target.value })}>
              {active.map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {ROLES[u.role].label}</option>
              ))}
            </select>
          </label>
          <button className="icon-btn" onClick={toggle} aria-label="Toggle dark mode">{theme === 'dark' ? '☀' : '☾'}</button>
        </div>
      </header>
      <div className="demo-banner">
        Prototype with demo data only — no real accounts are connected and prices are static.{' '}
        <ConfirmButton className="btn ghost sm" prompt="Click again to reset everything" onConfirm={() => dispatch({ type: 'RESET' })}>Reset demo</ConfirmButton>
      </div>
      <main className="page">
        <Outlet />
      </main>
    </>
  );
}
