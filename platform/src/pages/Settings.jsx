import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { can } from '../data/seed.js';
import { date, usd } from '../lib/format.js';
import { limitLabel, planBlockers, planOf, PLAN_ORDER, PLANS, seatCount } from '../lib/plans.js';
import { ConfirmButton, Modal } from '../components/ui.jsx';

export default function Settings() {
  const { state, dispatch, me } = useStore();
  const [changing, setChanging] = useState(false);
  const { paymentMethod, nextInvoice } = state.billing;
  const current = planOf(state);
  const owner = can(me, 'manageBilling');

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Plan & billing</h1><p>{state.org.name} · {current.name} plan · next invoice {date(nextInvoice)}</p></div>
      </div>

      <div className="grid cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current.id;
          const blockers = planBlockers(state, id);
          return (
            <div className="card plan" key={id} style={isCurrent ? { borderColor: 'var(--teal)', boxShadow: '0 0 0 1px var(--teal)' } : undefined}>
              <div className="card__head">
                <h2>{p.name}</h2>
                <span className="spacer" />
                {isCurrent && <span className="badge pos">Current plan</span>}
              </div>
              <div className="card__body">
                <div className="stat__value">{usd(p.priceUsd).replace('.00', '')}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / month</span></div>
                <p className="muted small" style={{ margin: '4px 0 12px' }}>{p.blurb} Billed in US dollars.</p>
                <dl className="kv">
                  <dt>Users</dt><dd>{limitLabel(p.maxUsers)}{p.maxUsers === 1 ? ' (owner only)' : p.maxUsers ? ' in total, including the owner' : ''}</dd>
                  <dt>Connections</dt><dd>{limitLabel(p.maxConnections)} <span className="muted small">crypto, bank and card combined</span></dd>
                  <dt>Approval rules</dt><dd>{p.approvals ? 'Yes — M-of-N policies and address whitelist' : <span className="muted">Not included</span>}</dd>
                  <dt>Ledger & invoices</dt><dd>Yes</dd>
                  <dt>Open banking</dt><dd>Yes</dd>
                </dl>
              </div>
              <span className="spacer" />
              <div className="card__foot">
                {isCurrent ? (
                  <span className="small muted">{seatCount(state.users)} users · {state.connections.length} connections in use</span>
                ) : !owner ? (
                  <span className="small muted">Only the Owner can change plans.</span>
                ) : blockers.length ? (
                  <span className="small" style={{ color: 'var(--warn)' }}>{blockers.join(' ')}</span>
                ) : (
                  <ConfirmButton className="btn primary sm" prompt={`Confirm switch to ${p.name}`} onConfirm={() => dispatch({ type: 'CHANGE_PLAN', planId: id })}>
                    {p.priceUsd > current.priceUsd ? 'Upgrade' : 'Downgrade'} to {p.name}
                  </ConfirmButton>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card__head"><h2>Payment method</h2><span className="spacer" />{owner && <button className="btn sm" onClick={() => setChanging(true)}>Change</button>}</div>
        <div className="card__body">
          <div style={{ fontWeight: 600 }}>{paymentMethod.label}</div>
          <div className="muted small">{paymentMethod.type === 'card' ? 'Charged automatically each month.' : 'Invoice issued each month; pay the exact amount on the selected network.'}</div>
        </div>
      </div>
      <div className="card">
        <div className="card__head"><h2>Subscription invoices</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Invoice</th><th>Date</th><th>Paid with</th><th className="num">Amount</th><th>Status</th></tr></thead>
            <tbody>
              {state.subscriptionInvoices.map((i) => (
                <tr key={i.id}><td className="mono">{i.id}</td><td>{date(i.date)}</td><td>{i.method}</td><td className="num">{usd(i.amountUsd)}</td><td><span className="badge pos">Paid</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {changing && <PaymentMethod onClose={() => setChanging(false)} price={current.priceUsd} />}
    </div>
  );
}

function PaymentMethod({ onClose, price }) {
  const { dispatch } = useStore();
  const [type, setType] = useState('card');
  const [asset, setAsset] = useState('USDC');
  const [network, setNetwork] = useState('Ethereum');
  const networks = asset === 'USDT' ? ['Ethereum', 'Tron', 'Solana'] : ['Ethereum', 'Solana', 'Base', 'Polygon'];
  const net = networks.includes(network) ? network : networks[0];
  const save = () => {
    const method = type === 'card' ? { type: 'card', label: 'Visa •••• 4242 (demo)' } : { type: 'stablecoin', asset, network: net, label: `${asset} on ${net}` };
    dispatch({ type: 'SET_PAYMENT_METHOD', method });
    onClose();
  };
  return (
    <Modal title="Payment method" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <label className="row"><input type="radio" checked={type === 'card'} onChange={() => setType('card')} /> Credit or debit card</label>
      <label className="row"><input type="radio" checked={type === 'stablecoin'} onChange={() => setType('stablecoin')} /> Stablecoin (USDT or USDC)</label>
      {type === 'card' ? (
        <div className="notice small">In production the card form is hosted by a PCI-DSS compliant payment processor; card numbers never touch TRNZIT servers. Demo: no card is collected here.</div>
      ) : (
        <>
          <div className="grid cols-2">
            <label className="field"><span>Stablecoin</span><select value={asset} onChange={(e) => setAsset(e.target.value)}><option>USDC</option><option>USDT</option></select></label>
            <label className="field"><span>Network</span><select value={net} onChange={(e) => setNetwork(e.target.value)}>{networks.map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <div className="notice small">Each invoice shows a unique deposit address and the exact amount ({price}.00 {asset}). Payment is confirmed automatically once the transfer has the required confirmations. Demo: no address is generated.</div>
        </>
      )}
    </Modal>
  );
}
