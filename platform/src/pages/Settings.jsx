import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { can } from '../data/seed.js';
import { date, usd } from '../lib/format.js';
import { ANNUAL_MULTIPLIER, INTERVALS, intervalBlocker, limitLabel, nextCharge, paymentMethodBlocker, planBlockers, planOf, PLAN_ORDER, PLANS, priceFor, seatCount, subscriptionStatus, yearCost } from '../lib/plans.js';
import { ConfirmButton, Modal } from '../components/ui.jsx';

export default function Settings() {
  const { state, dispatch, me } = useStore();
  const [changing, setChanging] = useState(false);
  const { paymentMethod } = state.billing;
  const interval = state.billing.interval || 'monthly';
  const per = INTERVALS[interval].per;
  const current = planOf(state);
  const owner = can(me, 'manageBilling');
  const nowIso = new Date().toISOString();
  const sub = subscriptionStatus(state.billing, nowIso);
  const next = nextCharge(state.billing, nowIso);
  const intervalNote = intervalBlocker(state.billing, interval === 'monthly' ? 'annual' : 'monthly', nowIso);
  const fixedInterval = intervalNote && !/Already/.test(intervalNote);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Plan & billing</h1>
          <p>
            {state.org.name} · {current.name} plan · {INTERVALS[interval].label.toLowerCase()}
            {next ? ` · next charge ${date(next)}` : ' · no further charges'}
          </p>
        </div>
      </div>

      <Subscription sub={sub} owner={owner} price={priceFor(current.id, interval)} per={per} plan={current} card={paymentMethod} next={next} />

      <div className="row wrap" style={{ gap: 12 }}>
        <div className="seg" role="group" aria-label="Billing interval">
          {Object.values(INTERVALS).map((iv) => (
            <button key={iv.id} className={iv.id === interval ? 'active' : ''} aria-pressed={iv.id === interval}
              disabled={!owner || (iv.id !== interval && !!fixedInterval)}
              onClick={() => iv.id !== interval && dispatch({ type: 'SET_BILLING_INTERVAL', interval: iv.id })}>
              {iv.id === 'monthly' ? 'Pay monthly' : 'Pay annually'}
            </button>
          ))}
        </div>
        <span className="small muted">
          Annual is {ANNUAL_MULTIPLIER}× the monthly price, paid in advance: two months free.
          {fixedInterval ? ` ${intervalNote}` : ''}
        </span>
      </div>

      <div className="grid cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current.id;
          const blockers = planBlockers(state, id);
          const yc = yearCost(id);
          return (
            <div className="card plan" key={id} style={isCurrent ? { borderColor: 'var(--teal)', boxShadow: '0 0 0 1px var(--teal)' } : undefined}>
              <div className="card__head">
                <h2>{p.name}</h2>
                <span className="spacer" />
                {isCurrent && <span className="badge pos">Current plan</span>}
              </div>
              <div className="card__body">
                <div className="stat__value">{usd(priceFor(id, interval)).replace('.00', '')}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {per}</span></div>
                <p className="muted small" style={{ margin: '4px 0 12px' }}>
                  {interval === 'annual'
                    ? `Paid in advance. You save ${usd(yc.saving).replace('.00', '')} against ${usd(yc.monthly).replace('.00', '')} for 12 monthly payments.`
                    : `Or ${usd(yc.annual).replace('.00', '')} a year paid in advance (save ${usd(yc.saving).replace('.00', '')}).`}{' '}
                  {p.blurb} Billed in US dollars.
                </p>
                <dl className="kv">
                  <dt>Users</dt><dd>{limitLabel(p.maxUsers)}{p.maxUsers === 1 ? ' (owner only)' : p.maxUsers ? ' in total, including the owner' : ''}</dd>
                  <dt>Connections</dt><dd>{limitLabel(p.maxConnections)} <span className="muted small">crypto, bank and card combined</span></dd>
                  <dt>Approval rules</dt><dd>{p.approvals ? 'Yes — M-of-N policies and address whitelist' : <span className="muted">Not included</span>}</dd>
                  <dt>Transactions & invoices</dt><dd>Yes</dd>
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
          <div className="muted small">
            {sub.phase === 'trial'
              ? `Authorised for the free trial. Nothing is charged before ${date(sub.trialEnds)}.`
              : paymentMethod.type === 'card'
                ? `Charged automatically each ${per}.`
                : `Invoice issued each ${per}; pay the exact amount on the selected network.`}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card__head"><h2>Subscription invoices</h2></div>
        {state.subscriptionInvoices.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Date</th><th>Period</th><th>Paid with</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {state.subscriptionInvoices.map((i) => (
                  <tr key={i.id}><td className="mono">{i.id}</td><td>{date(i.date)}</td><td>{i.period || '—'}</td><td>{i.method}</td><td className="num">{usd(i.amountUsd)}</td><td><span className="badge pos">Paid</span></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">No charges yet{sub.phase === 'trial' ? ` — the free trial runs until ${date(sub.trialEnds)}.` : '.'}</div>
        )}
      </div>
      {changing && <PaymentMethod onClose={() => setChanging(false)} price={priceFor(current.id, interval)} />}
    </div>
  );
}

function Subscription({ sub, owner, price, per, plan, card, next }) {
  const { dispatch } = useStore();
  const amount = `${usd(price).replace('.00', '')} per ${per}`;
  if (sub.phase === 'trial')
    return (
      <div className="notice" role="status">
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <span className="badge info">Free trial</span>
          <strong>{sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'} left · ends {date(sub.trialEnds)}</strong>
        </div>
        <p style={{ margin: '0 0 6px' }}>
          Your card ({card.label}) is authorised, but nothing has been charged. Cancel before {date(sub.trialEnds)} and you pay nothing.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          <strong>If you do not cancel, a 12-month agreement for {plan.name} starts on {date(sub.trialEnds)}</strong>, and your card is charged {amount}
          {per === 'year' ? ' in advance' : ' for 12 months'}. After that date, cancelling does not end the agreement early.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          {owner
            ? <ConfirmButton className="btn sm danger" prompt="Click again: cancel trial, no charge" onConfirm={() => dispatch({ type: 'CANCEL_TRIAL' })}>Cancel trial (no charge)</ConfirmButton>
            : <span className="small muted">Only the Owner can cancel the trial.</span>}
          <button className="btn ghost sm" title="Prototype only: move the clock past day 14" onClick={() => dispatch({ type: 'DEMO_END_TRIAL' })}>Demo: jump to day 15</button>
        </div>
      </div>
    );
  if (sub.phase === 'cancelled')
    return (
      <div className="notice warn" role="status">
        <strong>Trial cancelled. You will not be charged.</strong> The card authorisation is released, and your access continues until {date(sub.trialEnds)}.{' '}
        {owner && <button className="btn sm" style={{ marginLeft: 6 }} onClick={() => dispatch({ type: 'UNDO_CANCEL_TRIAL' })}>Undo cancellation</button>}
      </div>
    );
  if (sub.phase === 'ended')
    return <div className="notice warn" role="status"><strong>The free trial ended after it was cancelled.</strong> No charge was made.</div>;
  if (sub.phase === 'committed')
    return (
      <div className="notice" role="status">
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <span className="badge pos">12-month agreement</span>
          <strong>{date(sub.commitmentStart)} to {date(sub.commitmentEnds)}</strong>
        </div>
        {plan.name} at {amount}{per === 'year' ? ', paid in advance' : ''}.{next ? ` Next charge on ${date(next)}.` : ''} The free trial has ended, so cancelling now does not end the agreement early.
      </div>
    );
  if (sub.phase === 'term-complete')
    return <div className="notice" role="status"><strong>Your 12-month agreement ended on {date(sub.commitmentEnds)}.</strong> [Renewal terms to be confirmed.]</div>;
  return null;
}

function PaymentMethod({ onClose, price }) {
  const { state, dispatch } = useStore();
  const coinBlocked = paymentMethodBlocker(state.billing, 'stablecoin', new Date().toISOString());
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
      <label className="row"><input type="radio" disabled={!!coinBlocked} checked={type === 'stablecoin'} onChange={() => setType('stablecoin')} /> Stablecoin (USDT or USDC)</label>
      {coinBlocked && <div className="notice warn small">{coinBlocked}</div>}
      {type === 'card' ? (
        <div className="notice small">In production the card form is hosted by a PCI-DSS compliant payment processor; card numbers never touch TRNZIT servers. Demo: no card is collected here.</div>
      ) : (
        <>
          <div className="grid cols-2">
            <label className="field"><span>Stablecoin</span><select value={asset} onChange={(e) => setAsset(e.target.value)}><option>USDC</option><option>USDT</option></select></label>
            <label className="field"><span>Network</span><select value={net} onChange={(e) => setNetwork(e.target.value)}>{networks.map((n) => <option key={n}>{n}</option>)}</select></label>
          </div>
          <div className="notice small">Each invoice shows a unique deposit address and the exact amount ({price.toLocaleString('en-US')}.00 {asset}). Payment is confirmed automatically once the transfer has the required confirmations. Demo: no address is generated.</div>
        </>
      )}
    </Modal>
  );
}
