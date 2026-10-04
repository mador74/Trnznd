import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store.jsx';
import { balances, cashflow, connectionUsd, history, totalsByAsset, TX_TYPES, usdOf } from '../lib/ledger.js';
import { deriveStatus } from '../lib/policy.js';
import { amount, date, displayCurrency, relative, money, moneyShort } from '../lib/format.js';
import { CONNECTION_TYPES, isFiatConn } from '../data/seed.js';
import { planOf } from '../lib/plans.js';
import { valueAt } from '../lib/prices.js';
import { connectionConvertBlock } from '../lib/convert.js';
import { invoiceTotal, invoiceStatus } from '../lib/invoice.js';
import { ConnIcon, SERIES, Stat, StatusBadge } from '../components/ui.jsx';

const axis = { fontSize: 11, fill: 'var(--muted)' };
const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 } };

export default function Dashboard() {
  const { state, me } = useStore();
  const bal = balances(state);
  const total = state.connections.reduce((s, c) => s + connectionUsd(bal[c.id]), 0);
  const byAsset = totalsByAsset(state, bal);
  const sumOf = (pred) => state.connections.filter(pred).reduce((s, c) => s + connectionUsd(bal[c.id]), 0);
  const digital = sumOf((c) => !isFiatConn(c));
  const bank = sumOf((c) => c.type === 'bank');
  const cards = sumOf((c) => c.type === 'card');
  const stable = byAsset.filter((a) => a.kind === 'stablecoin').reduce((s, a) => s + a.usd, 0);
  const positive = byAsset.filter((a) => a.usd > 0);
  const positiveTotal = positive.reduce((s, a) => s + a.usd, 0);
  const plan = planOf(state);
  const unpaid = state.invoices.filter((i) => ['sent', 'overdue'].includes(invoiceStatus(i)));
  const overdue = unpaid.filter((i) => invoiceStatus(i) === 'overdue');
  const unpaidUsd = unpaid.reduce((s, i) => s + usdOf(i.currency, invoiceTotal(i)), 0);
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

      <div className="grid dash">
        <div className="card">
          <div className="card__head"><h2>Total treasury value — 90 days</h2><span className="spacer" /><span className="muted small">In {displayCurrency()}, at demo prices</span></div>
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
                <YAxis tick={axis} tickFormatter={moneyShort} width={64} domain={['auto', 'auto']} />
                <Tooltip {...tip} formatter={(v) => money(v)} labelFormatter={date} />
                <Area dataKey="usd" name="Value" stroke="#00b894" strokeWidth={2} fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Holdings by asset</h2><span className="spacer" /><span className="muted small">USD includes bank, net of cards</span></div>
          <div className="card__body row" style={{ alignItems: 'center' }}>
            <div style={{ width: 150, height: 150, flex: 'none' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={positive} dataKey="usd" nameKey="asset" innerRadius={45} outerRadius={70} stroke="var(--surface)" strokeWidth={2}>
                    {positive.map((a, i) => <Cell key={a.asset} fill={SERIES[i % SERIES.length]} />)}
                  </Pie>
                  <Tooltip {...tip} formatter={(v) => money(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="legend" style={{ flex: 1 }}>
              {positive.map((a, i) => (
                <div className="legend__row" key={a.asset}>
                  <span className="dot" style={{ background: SERIES[i % SERIES.length] }} />
                  <strong>{a.asset}</strong>
                  <span className="spacer" />
                  <span className="muted">{((a.usd / positiveTotal) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <h2>Digital asset accounts</h2>
        <span className="spacer" />
        <Link className="btn sm" to="/connections">Manage connections</Link>
      </div>
      <div className="grid cols-3">
        {state.connections.filter((c) => !isFiatConn(c)).map((c) => <ConnCard key={c.id} c={c} bal={bal} total={total} unrec={unrec} />)}
      </div>
      <div className="row"><h3 className="muted">Bank accounts and cards</h3></div>
      <div className="grid cols-3">
        {state.connections.filter(isFiatConn).map((c) => <ConnCard key={c.id} c={c} bal={bal} total={total} unrec={unrec} />)}
      </div>

      <div className="grid cols-3">
        <Stat label="Net treasury" value={money(total)} sub={<span className={change30 >= 0 ? 'pos' : 'neg'}>{change30 >= 0 ? '▲' : '▼'} {moneyShort(Math.abs(change30))} in 30 days</span>} />
        <Stat label="Exchanges, custodians & wallets" value={money(digital)} sub={`Stablecoins ${money(stable)} (${((stable / (digital || 1)) * 100).toFixed(0)}%)`} />
        <Stat label="Bank cash · card balances" value={money(bank)} sub={<span>Credit cards owed <span className="neg">{money(-cards)}</span></span>} />
        <Stat label="Unpaid invoices" value={money(unpaidUsd)} sub={<Link to="/invoices">{unpaid.length} open{overdue.length ? `, ${overdue.length} overdue` : ''} →</Link>} />
        {plan.approvals ? (
          <Stat label="Awaiting approval" value={pending.length} sub={<Link to="/approvals">Review requests →</Link>} />
        ) : (
          <Stat label="Approvals" value="—" sub={<Link to="/settings">Available on Premium →</Link>} />
        )}
        <Stat label="To reconcile" value={unrec.length} sub={<Link to="/transactions?status=unreconciled">Reconcile now →</Link>} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card__head"><h2>Cash in and out</h2><span className="spacer" /><span className="muted small">Excludes internal transfers and conversions</span></div>
          <div className="card__body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={flows} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={axis} />
                <YAxis tick={axis} tickFormatter={moneyShort} width={64} />
                <Tooltip {...tip} formatter={(v) => money(v)} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="in" name="Money in" fill="#00d4aa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="out" name="Money out" fill="#0088ff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {!plan.approvals ? (
          <div className="card">
            <div className="card__head"><h2>Unpaid invoices</h2><span className="spacer" /><Link to="/invoices" className="small">All invoices</Link></div>
            {unpaid.length === 0 && <div className="empty">No unpaid invoices.</div>}
            {unpaid.slice(0, 4).map((i) => (
              <div className="list-row" key={i.id}>
                <div><div style={{ fontWeight: 600 }}>{i.number} · {amount(invoiceTotal(i), i.currency)}</div><div className="muted small">Due {date(i.dueDate)}</div></div>
                <span className="spacer" />
                <span className={`badge ${invoiceStatus(i) === 'overdue' ? 'neg' : 'warn'}`}>{invoiceStatus(i) === 'overdue' ? 'Overdue' : 'Awaiting payment'}</span>
              </div>
            ))}
          </div>
        ) : (
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
        )}
      </div>

      <div className="card">
        <div className="card__head"><h2>Recent activity</h2><span className="spacer" /><Link to="/transactions" className="small">Full ledger</Link></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Connection</th><th>Type</th><th>Counterparty</th><th className="num col-in">In</th><th className="num col-out">Out</th></tr></thead>
            <tbody>
              {state.transactions.slice(0, 8).map((t) => (
                <tr key={t.id}>
                  <td>{date(t.date)}</td>
                  <td>{state.connections.find((c) => c.id === t.connectionId)?.name || <span className="muted">Removed</span>}</td>
                  <td>{TX_TYPES[t.type]}</td>
                  <td>{t.counterparty}</td>
                  <td className="num col-in">{t.amount > 0 && <><div className="pos">{amount(t.amount, t.asset)}</div><div className="small muted">{money(valueAt(t, state.priceAnchor))}</div></>}</td>
                  <td className="num col-out">{t.amount < 0 && <><div className="neg">{amount(-t.amount, t.asset)}</div><div className="small muted">{money(-valueAt(t, state.priceAnchor))}</div></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConnCard({ c, bal, total, unrec }) {
  const isCard = c.type === 'card';
  const v = connectionUsd(bal[c.id]);
  const n = unrec.filter((t) => t.connectionId === c.id).length;
  const top = Object.entries(bal[c.id] || {}).filter(([, q]) => q > 0).sort((a, b) => usdOf(b[0], b[1]) - usdOf(a[0], a[1]));
  return (
    <div className="card feed">
      <div className="feed__top">
        <ConnIcon type={c.type} />
        <div style={{ minWidth: 0 }}>
          <Link to={`/connections/${c.id}`} className="feed__name">{c.name}</Link>
          <div className="muted small">{CONNECTION_TYPES[c.type].label} · synced {relative(c.lastSync)}</div>
        </div>
      </div>
      <div className="feed__bal">
        <span className="muted">{isCard ? 'Balance owed' : 'Balance'}</span>
        <strong className={isCard ? 'neg' : ''}>{money(isCard ? -v : v)}</strong>
      </div>
      <div className="feed__bal small">
        <span className="muted">{isCard ? 'Account' : 'Share of treasury'}</span>
        <span>{isCard ? c.accountMask : `${((v / total) * 100).toFixed(1)}%`}</span>
      </div>
      <div className="feed__assets">
        {isCard ? <span className="badge">{c.institution}</span> : top.slice(0, 4).map(([a, q]) => <span className="badge" key={a}>{amount(q, a)}</span>)}
      </div>
      <span className="spacer" />
      <div className="card__foot">
        {n > 0 ? (
          <Link className="btn primary sm" to={`/transactions?connection=${c.id}&status=unreconciled`}>Reconcile {n} item{n > 1 ? 's' : ''}</Link>
        ) : (
          <span className="badge pos">All reconciled</span>
        )}
        <span className="spacer" />
        {!connectionConvertBlock(c) && <Link className="small" to={`/convert?connection=${c.id}`}>Convert</Link>}
        <Link className="small" to={`/connections/${c.id}`}>View account</Link>
      </div>
    </div>
  );
        }
