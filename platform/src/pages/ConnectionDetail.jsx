import { Link, useNavigate, useParams } from 'react-router-dom';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '../state/store.jsx';
import { balances, connectionUsd, history, priceOf, usdOf } from '../lib/ledger.js';
import { amount, date, dateTime, relative, money, moneyShort } from '../lib/format.js';
import { useState } from 'react';
import { ASSETS, CONNECTION_TYPES, can, isFiatConn } from '../data/seed.js';
import { SEND_METHODS } from '../lib/send.js';
import { ConfirmButton, ConnIcon, Modal, Stat, StatusBadge } from '../components/ui.jsx';
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
        <Stat label="Balance" value={money(v)} sub={`Last synced ${relative(c.lastSync)} · ${dateTime(c.lastSync)}`} />
        <Stat label="Assets held" value={rows.filter((r) => r.q > 0).length} sub={rows.map((r) => r.a).join(' · ')} />
        <Stat label="To reconcile" value={unrec} sub={`Connected since ${date(c.connectedAt)}`} />
      </div>

      <SendingPanel c={c} />

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
                    <td className="num">{money(priceOf(r.a))}</td>
                    <td className="num">{money(r.usd)}</td>
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
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} tickFormatter={moneyShort} width={60} domain={['auto', 'auto']} />
                <Tooltip formatter={(x) => money(x)} labelFormatter={date} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
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

function SendingPanel({ c }) {
  const { dispatch, me } = useStore();
  const [enabling, setEnabling] = useState(false);
  const manage = can(me, 'manageConnections');
  if (isFiatConn(c))
    return <div className="card card__body small"><strong>Sending</strong> · Bank and card payments are not available yet. This account is read-only.</div>;
  const method = SEND_METHODS[c.type];
  return (
    <div className="card card__body row wrap">
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="row"><strong>Sending</strong>{c.sendEnabled ? <span className="badge pos">On</span> : <span className="badge">Off</span>}</div>
        <div className="small muted">{method.label}. {method.detail}</div>
      </div>
      {manage && (c.sendEnabled
        ? <ConfirmButton className="btn sm" prompt="Click again to switch off" onConfirm={() => dispatch({ type: 'SET_SEND_ENABLED', id: c.id, enabled: false })}>Switch off sending</ConfirmButton>
        : <button className="btn sm primary" onClick={() => (c.type === 'wallet' || c.type === 'custodian' ? dispatch({ type: 'SET_SEND_ENABLED', id: c.id, enabled: true }) : setEnabling(true))}>Switch on sending</button>)}
      {enabling && <EnableExchangeSending c={c} onClose={() => setEnabling(false)} />}
    </div>
  );
}

function EnableExchangeSending({ c, onClose }) {
  const { dispatch } = useStore();
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [checks, setChecks] = useState({ scope: false, ip: false, list: false });
  const ok = key.trim() && secret.trim() && Object.values(checks).every(Boolean);
  const tick = (k) => setChecks((x) => ({ ...x, [k]: !x[k] }));
  return (
    <Modal title={`Switch on sending for ${c.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!ok} onClick={() => { dispatch({ type: 'SET_SEND_ENABLED', id: c.id, enabled: true }); onClose(); }}>Switch on</button>
    </>}>
      <p className="small">To pass payment instructions to the exchange, TRNZND needs a <strong>second, separate API key</strong> that can submit withdrawals. Your read-only key stays as it is. This key lets TRNZND pass on instructions your authorised releasers have approved. It is not a wallet key: the exchange keeps custody of the assets and executes each payment.</p>
      <label className="field"><span>Withdrawal-instruction API key</span><input id="wk-key" className="mono" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
      <label className="field"><span>Withdrawal-instruction API secret</span><input id="wk-secret" className="mono" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" /></label>
      <label className="row small"><input type="checkbox" checked={checks.scope} onChange={() => tick('scope')} />The key can withdraw but cannot trade.</label>
      <label className="row small"><input type="checkbox" checked={checks.ip} onChange={() => tick('ip')} />The key only works from TRNZND’s published IP addresses.</label>
      <label className="row small"><input type="checkbox" checked={checks.list} onChange={() => tick('list')} />Withdrawals are limited to my whitelisted addresses at the exchange as well.</label>
      <div className="notice warn small">Demo: nothing is stored or sent. In production the API credential is encrypted, and only used to forward a payment after your approval rules are met and an authorised releaser has confirmed it with their own 2-step check.</div>
    </Modal>
  );
}
