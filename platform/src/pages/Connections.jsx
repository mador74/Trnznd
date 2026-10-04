import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { balances, connectionUsd } from '../lib/ledger.js';
import { relative, shortAddr, usd } from '../lib/format.js';
import { CONNECTION_TYPES, CRYPTO, FIAT, can, isFiatConn } from '../data/seed.js';
import { canAddConnection, limitLabel, planOf } from '../lib/plans.js';
import { ConnIcon, Modal, StatusBadge } from '../components/ui.jsx';

export default function Connections() {
  const { state, me } = useStore();
  const [adding, setAdding] = useState(false);
  const bal = balances(state);
  const total = state.connections.reduce((s, c) => s + connectionUsd(bal[c.id]), 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Connections</h1>
          <p>Exchanges, custodians, wallets, bank accounts and credit cards, all linked with read-only access. TRNZND never holds keys or permissions that can move funds.</p>
        </div>
        <span className="spacer" />
        <span className="small muted">{state.connections.length} of {limitLabel(planOf(state).maxConnections)} connections used</span>
        {can(me, 'manageConnections') && <button className="btn primary" disabled={!canAddConnection(state)} onClick={() => setAdding(true)}>+ Add connection</button>}
      </div>
      {!canAddConnection(state) && (
        <div className="notice warn small">Your {planOf(state).name} plan allows {planOf(state).maxConnections} connections. <Link to="/settings">Upgrade to Institution</Link> for unlimited connections.</div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Connection</th><th>Type</th><th>Access</th><th>Last sync</th><th>Status</th><th className="num">Balance</th><th className="num">Share</th></tr>
            </thead>
            <tbody>
              {state.connections.map((c) => {
                const v = connectionUsd(bal[c.id]);
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="row">
                        <ConnIcon type={c.type} />
                        <div>
                          <Link to={`/connections/${c.id}`} style={{ fontWeight: 600 }}>{c.name}</Link>
                          <div className="muted small">{c.network}{c.address && <> · <span className="mono">{shortAddr(c.address)}</span></>}{c.accountMask && <> · {c.accountMask}</>}</div>
                        </div>
                      </div>
                    </td>
                    <td>{CONNECTION_TYPES[c.type].label}</td>
                    <td className="small">
                      {CONNECTION_TYPES[c.type].auth}
                      {c.consentExpires && <ConsentNote iso={c.consentExpires} />}
                    </td>
                    <td>{relative(c.lastSync)}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="num">{usd(v)}</td>
                    <td className="num">{total ? ((v / total) * 100).toFixed(1) : 0}%</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={5}><strong>Aggregated total</strong></td>
                <td className="num"><strong>{usd(total)}</strong></td>
                <td className="num">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {adding && <AddConnection onClose={() => setAdding(false)} />}
    </div>
  );
}

function ConsentNote({ iso }) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  return <div className={days <= 14 ? 'neg' : 'muted'}>{days <= 0 ? 'Consent expired — reconnect' : `Consent renews in ${days} days`}</div>;
}

function AddConnection({ onClose }) {
  const { dispatch } = useStore();
  const [type, setType] = useState('exchange');
  const [name, setName] = useState('');
  const [network, setNetwork] = useState('Ethereum');
  const [address, setAddress] = useState('');
  const [key, setKey] = useState('');
  const [secret, setSecret] = useState('');
  const [readOnly, setReadOnly] = useState(false);
  const [assets, setAssets] = useState(['USDT', 'USDC']);
  const [institution, setInstitution] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [consented, setConsented] = useState(false);
  const isWallet = type === 'wallet';
  const isFiat = isFiatConn({ type });
  const valid = name.trim() && (isFiat
    ? institution.trim() && consented
    : assets.length && (isWallet ? address.trim().length >= 10 : key.trim() && secret.trim() && readOnly));

  const save = () => {
    // Prototype: credentials are discarded, never stored. See ARCHITECTURE.md → "Credential handling".
    const connection = isFiat
      ? { name: name.trim(), type, network: `${institution.trim()} · ${currency}`, institution: institution.trim(), accountMask: '••••' + String(Math.floor(1000 + Math.random() * 9000)),
          assets: [currency], consentExpires: new Date(Date.now() + 90 * 86400000).toISOString() }
      : { name: name.trim(), type, network: isWallet ? network : 'Multi-chain', address: isWallet ? address.trim() : undefined, assets };
    dispatch({ type: 'ADD_CONNECTION', connection, openingBalances: Object.fromEntries(connection.assets.map((a) => [a, 0])) });
    onClose();
  };

  return (
    <Modal
      title="Add connection"
      onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!valid} onClick={save}>Connect</button></>}
    >
      <label className="field">
        <span>Provider type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <optgroup label="Digital assets">
            {Object.entries(CONNECTION_TYPES).filter(([, v]) => !v.fiat).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </optgroup>
          <optgroup label="Fiat (open banking)">
            {Object.entries(CONNECTION_TYPES).filter(([, v]) => v.fiat).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </optgroup>
        </select>
      </label>
      <label className="field">
        <span>Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Settlement exchange — Asia desk" />
      </label>
      {isFiat ? (
        <>
          <div className="grid cols-2">
            <label className="field"><span>Bank or card issuer</span><input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Search your bank" /></label>
            <label className="field"><span>Account currency</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>{FIAT.map((f) => <option key={f}>{f}</option>)}</select>
            </label>
          </div>
          <div className="notice small">
            In production you are sent to your bank’s own login page to approve <strong>read-only</strong> access: balances and transactions only, never payments.
            Banks ask you to renew this consent periodically; how often depends on the country.
          </div>
          <label className="row small">
            <input type="checkbox" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            Simulate: I approved read-only access at my bank.
          </label>
        </>
      ) : isWallet ? (
        <>
          <label className="field">
            <span>Network</span>
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              {['Ethereum', 'Tron', 'Solana', 'Bitcoin', 'Polygon', 'Arbitrum', 'Base'].map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Public address or xpub</span>
            <input className="mono" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x… / T… / xpub…" />
          </label>
          <div className="notice small">Only public information is needed. Never paste a seed phrase or private key into any website.</div>
        </>
      ) : (
        <>
          <label className="field"><span>API key</span><input className="mono" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" /></label>
          <label className="field"><span>API secret</span><input className="mono" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" /></label>
          <label className="row small">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
            I confirm this key has read-only permissions (no trading, no withdrawals).
          </label>
          <div className="notice warn small">Demo: the key is not sent anywhere and is discarded on save. In production it would be encrypted server-side and its scopes verified with the provider.</div>
        </>
      )}
      {!isFiat && <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Assets to track</legend>
        <div className="row wrap">
          {CRYPTO.map((a) => (
            <label key={a} className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={assets.includes(a)} onChange={() => setAssets((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>}
    </Modal>
  );
}
