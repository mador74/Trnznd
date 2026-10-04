import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { balances, connectionUsd } from '../lib/ledger.js';
import { relative, shortAddr, usd } from '../lib/format.js';
import { ASSETS, CONNECTION_TYPES, can } from '../data/seed.js';
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
          <p>Exchanges, custodians and wallets linked with read-only access. TRNZND never holds keys that can move funds.</p>
        </div>
        <span className="spacer" />
        {can(me, 'manageConnections') && <button className="btn primary" onClick={() => setAdding(true)}>+ Add connection</button>}
      </div>

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
                          <div className="muted small">{c.network}{c.address && <> · <span className="mono">{shortAddr(c.address)}</span></>}</div>
                        </div>
                      </div>
                    </td>
                    <td>{CONNECTION_TYPES[c.type].label}</td>
                    <td className="small">{CONNECTION_TYPES[c.type].auth}</td>
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
  const isWallet = type === 'wallet';
  const valid = name.trim() && assets.length && (isWallet ? address.trim().length >= 10 : key.trim() && secret.trim() && readOnly);

  const save = () => {
    // Prototype: credentials are discarded, never stored. See ARCHITECTURE.md → "Credential handling".
    dispatch({
      type: 'ADD_CONNECTION',
      connection: { name: name.trim(), type, network: isWallet ? network : 'Multi-chain', address: isWallet ? address.trim() : undefined, assets },
      openingBalances: Object.fromEntries(assets.map((a) => [a, 0])),
    });
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
          {Object.entries(CONNECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Settlement exchange — Asia desk" />
      </label>
      {isWallet ? (
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
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Assets to track</legend>
        <div className="row wrap">
          {Object.keys(ASSETS).map((a) => (
            <label key={a} className="row small" style={{ gap: 4 }}>
              <input type="checkbox" checked={assets.includes(a)} onChange={() => setAssets((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))} />
              {a}
            </label>
          ))}
        </div>
      </fieldset>
    </Modal>
  );
}
