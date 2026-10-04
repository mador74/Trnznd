import { useState } from 'react';
import { subUserCount, useStore } from '../state/store.jsx';
import { MAX_SUB_USERS, can } from '../data/seed.js';
import { date, usd } from '../lib/format.js';
import { Modal } from '../components/ui.jsx';

export default function Settings() {
  const { state, me } = useStore();
  const [changing, setChanging] = useState(false);
  const { plan, paymentMethod, nextInvoice } = state.billing;
  const owner = can(me, 'manageBilling');

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Plan & billing</h1><p>{state.org.name}</p></div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <div className="card__head"><h2>{plan.name} plan</h2><span className="spacer" /><span className="badge pos">Active</span></div>
          <div className="card__body">
            <div className="stat__value">{usd(plan.priceUsd)}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {plan.interval}</span></div>
            <ul className="small" style={{ paddingLeft: 18 }}>
              <li>Unlimited connections (exchanges, custodians, wallets)</li>
              <li>Business owner + up to {MAX_SUB_USERS} sub-users — {subUserCount(state.users)} in use</li>
              <li>M-of-N approval policies, address whitelisting, audit log</li>
              <li>Full transaction history and CSV export</li>
            </ul>
            <div className="muted small">Next invoice {date(nextInvoice)}</div>
          </div>
        </div>
        <div className="card">
          <div className="card__head"><h2>Payment method</h2><span className="spacer" />{owner && <button className="btn sm" onClick={() => setChanging(true)}>Change</button>}</div>
          <div className="card__body">
            <div style={{ fontWeight: 600 }}>{paymentMethod.label}</div>
            <div className="muted small">{paymentMethod.type === 'card' ? 'Charged automatically each month.' : 'Invoice issued each month; pay the exact amount on the selected network.'}</div>
            {!owner && <div className="notice small" style={{ marginTop: 12 }}>Only the Owner can change billing.</div>}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card__head"><h2>Invoices</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Paid with</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {state.invoices.map((i) => (
                <tr key={i.id}><td className="mono">{i.id}</td><td>{date(i.date)}</td><td>{i.method}</td><td className="num">{usd(i.amountUsd)}</td><td><span className="badge pos">Paid</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {changing && <PaymentMethod onClose={() => setChanging(false)} />}
    </div>
  );
}

function PaymentMethod({ onClose }) {
  const { dispatch } = useStore();
  const [type, setType] = useState('card');
  const [asset, setAsset] = useState('USDC');
  const [network, setNetwork] = useState('Ethereum');
  const networks = asset === 'USDT' ? ['Ethereum', 'Tron', 'Solana'] : ['Ethereum', 'Solana', 'Base', 'Polygon'];
  const save = () => {
    const method = type === 'card'
      ? { type: 'card', label: 'Visa •••• 4242 (demo)' }
      : { type: 'stablecoin', asset, network: networks.includes(network) ? network : networks[0], label: `${asset} on ${networks.includes(network) ? network : networks[0]}` };
    dispatch({ type: 'SET_PAYMENT_METHOD', method });
    onClose();
  };
  return (
    <Modal title="Payment method" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <label className="row"><input type="radio" checked={type === 'card'} onChange={() => setType('card')} /> Credit or debit card</label>
      <label className="row"><input type="radio" checked={type === 'stablecoin'} onChange={() => setType('stablecoin')} /> Stablecoin (USDT or USDC)</label>
      {type === 'card' ? (
        <div className="notice small">In production the card form is hosted by a PCI-DSS compliant payment processor; card numbers never touch TRNZND servers. Demo: no card is collected here.</div>
      ) : (
        <>
          <div className="grid cols-2">
            <label className="field"><span>Stablecoin</span><select value={asset} onChange={(e) => setAsset(e.target.value)}><option>USDC</option><option>USDT</option></select></label>
            <label className="field"><span>Network</span><select value={networks.includes(network) ? network : networks[0]} onChange={(e) => setNetwork(e.target.value)}>{networks.map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <div className="notice small">Each invoice shows a unique deposit address and the exact amount (50.00 {asset}). Payment is confirmed automatically once the transfer has the required confirmations. Demo: no address is generated.</div>
        </>
      )}
    </Modal>
  );
}
