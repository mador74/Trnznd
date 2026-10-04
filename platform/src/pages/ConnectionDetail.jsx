import { Link, useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store.jsx';
import { balances, connectionUsd, history, priceOf, usdOf } from '../lib/ledger.js';
import { amount, date, dateTime, relative, usd, usdShort } from '../lib/format.js';
import { ASSETS, CONNECTION_TYPES, can } from '../data/seed.js';
import { ConfirmButton, ConnIcon, Stat, StatusBadge } from '../components/ui.jsx';
import Ledger from '../components/Ledger.jsx';

export default function ConnectionDetail() {
  const { id } = useParams();
  const { state, dispatch, me } = useStore();
  const nav = useNavigate();
  const c = state.connections.find((x) => x.id === id);
  if (!c) return <p>Connection not found. <Link to="/connections">Back to connections</Link></p>;

  const bal = balances(state)[c.id] || {};
  const v = connectionUsd(bal);
  const hist = history(state, 90, c.id);
  const rows = Object.entries(bal).map(([a, q]) => ({ a, q, usd: usdOf(a, q) })).sort((x, y) => y.usd - x.usd);
  const unrec = state.transactions.filter((t) => t.connectionId === c.id && !t.reconciled).length;

  return (
    <div className="stack">
      <div className="small"><Link to="/connections">← Connections</Link></div>
      <div className="page-head">
        <ConnIcon type={c.type} />
        <div>
          <h1>{c.name}</h1>
          <p>{CONNECTION_TYPES[c.type].label} · {c.network}{c.address && <> · <span className="mono">{c.address}</span></>}</p>
        </div>
        <span className="spacer" />
        <StatusBadge status={c.status} />
        <button className="btn" onClick={() => dispatch({ type: 'SYNC_CONNECTION', id: c.id })}>Sync now</button>
        {can(me, 'manageConnections') && (
          <ConfirmButton className="btn danger" prompt="Click again to disconnect" onConfirm={() => {
            dispatch({ type: 'REMOVE_CONNECTION', id: c.id });
            nav('/connections');
          }}>Disconnect</ConfirmButton>
        )}
      </div>

      <div className="grid cols-3">
        <Stat label="Balance" value={usd(v)} sub={`Last synced ${relative(c.lastSync)} · ${dateTime(c.lastSync)}`} />
        <Stat label="Assets held" value={rows.filter((r) => r.q > 0).length} sub={rows.map((r) => r.a).join(' · ')} />
        <Stat label="To reconcile" value={unrec} sub={`Connected since ${date(c.connectedAt)}`} />
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card__head"><h2>Holdings</h2></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Asset</th><th className="num">Quantity</th><th className="num">Demo price</th><th className="num">Value</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.a}>
                    <td><strong>{r.a}</strong> <span className="muted small">{ASSETS[r.a]?.name}</span></td>
                    <td className="num mono">{amount(r.q, r.a)}</td>
                    <td className="num">{usd(priceOf(r.a))}</td>
                    <td className="num">{usd(r.usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Balance — 90 days</h2></div>
          <div className="card__body" style={{ height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={hist}>
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={(d) => date(d).slice(0, 6)} minTickGap={40} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={usdShort} width={60} domain={['auto', 'auto']} />
                <Tooltip formatter={(x) => usd(x)} labelFormatter={date} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Area dataKey="usd" name="Value" stroke="#0088ff" fill="#0088ff" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <h2>Transactions</h2>
      <Ledger fixedConnection={c.id} />
    </div>
  );
}
