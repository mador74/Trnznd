import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store.jsx';
import { balances, cashflow, connectionUsd, history, totalsByAsset, TX_TYPES, usdOf } from '../lib/ledger.js';
import { deriveStatus } from '../lib/policy.js';
import { amount, date, relative, usd, usdShort } from '../lib/format.js';
import { CONNECTION_TYPES } from '../data/seed.js';
import { ConnIcon, SERIES, Stat, StatusBadge } from '../components/ui.jsx';

const axis = { fontSize: 11, fill: 'var(--muted)' };
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function Dashboard() {
  const { state, me } = useStore();
  const bal = balances(state);
  const total = state.connections.reduce((s, c) => s + connectionUsd(bal[c.id]), 0);
  const byAsset = totalsByAsset(state, bal);
  const stable = byAsset.filter((a) => a.kind === 'stablecoin').reduce((s, a) => s + a.usd, 0);
  const hist = history(state, 90);
  const change30 = total - hist[hist.length - 31].usd;
  const flows = cashflow(state);
  const pending = state.requests.filter((r) => deriveStatus(r, state.policies, state.users) === 'pending');
  const unrec = state.transactions.filter((t) => !t.reconciled && state.connections.some((c) => c.id === t.connectionId));

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}, {me?.name.split(' ')[0]}. Aggregated across {state.connections.length} connections.</p>
        </div>
      </div>

      <div className="grid cols-4">
        <Stat label="Total treasury" value={usd(total)} sub={<span className={change30 >= 0 ? 'pos' : 'neg'}>{change30 >= 0 ? '▲' : '▼'} {usdShort(Math.abs(change30))} in 30 days</span>} />
        <Stat label="Stablecoins" value={usd(stable)} sub={`${((stable / total) * 100).toFixed(1)}% of treasury`} />
        <Stat label="Awaiting approval" value={pending.length} sub={<Link to="/approvals">Review requests →</Link>} />
        <Stat label="To reconcile" value={unrec.length} sub={<Link to="/transactions?status=unreconciled">Reconcile now →</Link>} />
      </div>

      <div className="grid dash">
        <div className="card">
          <div className="card__head"><h2>Total treasury value — 90 days</h2><span className="spacer" /><span className="muted small">At current demo prices</span></div>
          <div className="card__body" style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={hist} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#00d4aa" stopOpacity={0.35} />
                    <stop offset="1" stopColor="#00d4aa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={axis} tickFormatter={(d) => date(d).slice(0, 6)} minTickGap={40} />
                <YAxis tick={axis} tickFormatter={usdShort} width={64} domain={['auto', 'auto']} />
                <Tooltip {...tip} formatter={(v) => usd(v)} labelFormatter={date} />
                <Area dataKey="usd" name="Value" stroke="#00b894" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Allocation by asset</h2></div>
          <div className="card__body row" style={{ alignItems: 'center' }}>
            <div style={{ width: 150, height: 150, flex: 'none' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byAsset} dataKey="usd" nameKey="asset" innerRadius={45} outerRadius={70} stroke="var(--surface)" strokeWidth={2}>
                    {byAsset.map((a, i) => <Cell key={a.asset} fill={SERIES[i % SERIES.length]} />)}
                  </Pie>
                  <Tooltip {...tip} formatter={(v) => usd(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend" style={{ flex: 1 }}>
              {byAsset.map((a, i) => (
                <div className="legend__row" key={a.asset}>
                  <span className="dot" style={{ background: SERIES[i % SERIES.length] }} />
                  <strong>{a.asset}</strong>
                  <span className="spacer" />
                  <span className="muted">{((a.usd / total) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <h2>Connections</h2>
        <span className="spacer" />
        <Link className="btn sm" to="/connections">Manage connections</Link>
      </div>
      <div className="grid cols-3">
        {state.connections.map((c) => {
          const v = connectionUsd(bal[c.id]);
          const n = unrec.filter((t) => t.connectionId === c.id).length;
          const top = Object.entries(bal[c.id] || {}).filter(([, q]) => q > 0).sort((a, b) => usdOf(b[0], b[1]) - usdOf(a[0], a[1]));
          return (
            <div className="card feed" key={c.id}>
              <div className="feed__top">
                <ConnIcon type={c.type} />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/connections/${c.id}`} className="feed__name">{c.name}</Link>
                  <div className="muted small">{CONNECTION_TYPES[c.type].label} · synced {relative(c.lastSync)}</div>
                </div>
              </div>
              <div className="feed__bal">
                <span className="muted">Balance</span>
                <strong>{usd(v)}</strong>
              </div>
              <div className="feed__bal small">
                <span className="muted">Share of treasury</span>
                <span>{((v / total) * 100).toFixed(1)}%</span>
              </div>
              <div className="feed__assets">
                {top.slice(0, 4).map(([a, q]) => <span className="badge" key={a}>{amount(q, a)}</span>)}
              </div>
              <span className="spacer" />
              <div className="card__foot">
                {n > 0 ? (
                  <Link className="btn primary sm" to={`/transactions?connection=${c.id}&status=unreconciled`}>Reconcile {n} item{n > 1 ? 's' : ''}</Link>
                ) : (
                  <span className="badge pos">All reconciled</span>
                )}
                <span className="spacer" />
                <Link className="small" to={`/connections/${c.id}`}>View account</Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card__head"><h2>Cash in and out</h2><span className="spacer" /><span className="muted small">Excludes internal transfers and conversions</span></div>
          <div className="card__body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={flows} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} tickFormatter={usdShort} width={64} />
                <Tooltip {...tip} formatter={(v) => usd(v)} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="in" name="Money in" fill="#00d4aa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Money out" fill="#0088ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Approval queue</h2><span className="spacer" /><Link to="/approvals" className="small">All requests</Link></div>
          {pending.length === 0 && <div className="empty">Nothing waiting for approval.</div>}
          {pending.slice(0, 4).map((r) => (
            <div className="list-row" key={r.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.type === 'address_whitelist' ? `Whitelist ${r.to}` : `${amount(r.amount, r.asset)} → ${r.to}`}</div>
                <div className="muted small">{r.reference} · {relative(r.createdAt)}</div>
              </div>
              <span className="spacer" />
              <StatusBadge status="pending" />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card__head"><h2>Recent activity</h2><span className="spacer" /><Link to="/transactions" className="small">Full ledger</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Connection</th><th>Type</th><th>Counterparty</th><th className="num">Amount</th><th className="num">USD</th></tr></thead>
            <tbody>
              {state.transactions.slice(0, 8).map((t) => (
                <tr key={t.id}>
                  <td>{date(t.date)}</td>
                  <td>{state.connections.find((c) => c.id === t.connectionId)?.name || <span className="muted">Removed</span>}</td>
                  <td>{TX_TYPES[t.type]}</td>
                  <td>{t.counterparty}</td>
                  <td className={`num ${t.amount < 0 ? 'neg' : 'pos'}`}>{amount(t.amount, t.asset)}</td>
                  <td className="num">{usd(usdOf(t.asset, t.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
