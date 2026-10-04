import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

// Simple line icons (24×24 viewBox, drawn with currentColor) so the collapsed rail stays readable.
const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  plus: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v8M8 12h8',
  send: 'M4 12l16-8-6 16-2-6z',
  swap: 'M7 7h12l-3-3M17 17H5l3 3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  invoice: 'M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M9 7h6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
};
export const Icon = ({ name }) => (
  <svg className="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
);

/**
 * Left-hand menu: every page visible, grouped by section. Collapses to an icon rail on desktop
 * and becomes a slide-in drawer on phones (`mobileOpen`).
 */
export default function Sidebar({ sections, collapsed, onToggle, mobileOpen, onCloseMobile }) {
  const { pathname } = useLocation();
  useEffect(() => onCloseMobile(), [pathname]); // close the phone drawer after navigating
  return (
    <>
      {mobileOpen && <div className="sidebar__scrim" onClick={onCloseMobile} aria-hidden="true" />}
      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' open' : ''}`} aria-label="Sections">
        <button type="button" className="sidebar__toggle" onClick={onToggle} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu'}>
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
          <span className="sidebar__label">Collapse</span>
        </button>
        <nav>
          {sections.map((s) => (
            <div className="sidebar__section" key={s.label}>
              <div className="sidebar__heading">{s.label}</div>
              {s.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.end} className="sidebar__link" title={collapsed ? `${it.text}${it.hint ? ' · ' + it.hint : ''}` : it.hint}>
                  <Icon name={it.icon} />
                  <span className="sidebar__label">{it.text}</span>
                  {it.lock && <span className="sidebar__label lock" title="Not included in Basic">🔒</span>}
                  {it.count > 0 && <span className="sidebar__count">{it.count}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
