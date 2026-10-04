import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { can } from '../data/seed.js';
import { date, usd } from '../lib/format.js';
import {
  ANNUAL_MULTIPLIER, billingNow, DEFAULT_INTERVAL, INTERVALS, intervalBlocker, isUpgrade, limitLabel, nextCharge, paymentMethodBlocker, planBlockers,
  planChangeTiming, planOf, PLAN_ORDER, PLANS, priceFor, seatCount, subscriptionStatus, yearCost,
  cancellationDate, GRACE_DAYS, NOTICE_DAYS, renewalReminders,
} from '../lib/plans.js';
import { ConfirmButton, Modal } from '../components/ui.jsx';

export default function Settings() {
  const { state, dispatch, me } = useStore();
  const [changing, setChanging] = useState(false);
  const b = state.billing;
  const { paymentMethod } = b;
  const interval = b.interval || DEFAULT_INTERVAL;
  const per = INTERVALS[interval].per;
  const current = planOf(state);
  const owner = can(me, 'manageBilling');
  const t = billingNow(b);
  const sub = subscriptionStatus(b, t);
  const next = nextCharge(b, t);
  const live = sub.phase === 'trial' || sub.phase === 'committed';
  const intervalNote = intervalBlocker(b, interval === 'monthly' ? 'annual' : 'monthly', t);
  const shown = b.scheduledInterval?.interval || interval;
  const short = (n) => usd(n).replace('.00', '');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Plan & billing</h1>
          <p>
            {state.org.name} · {current.name} plan · {INTERVALS[interval].label.toLowerCase()}
            {next ? ` · next charge ${date(next.at)}: ${usd(next.amountUsd)}` : ' · no further charges'}
          </p>
        </div>
      </div>

      {b.clockOffsetMs > 0 && (
        <div className="notice small">Demo clock moved forward {Math.round(b.clockOffsetMs / 86400000)} days, to {date(t)}. Reset demo to return to today.</div>
      )}

      <Subscription sub={sub} owner={owner} b={b} plan={current} next={next} />

      <div className="row wrap" style={{ gap: 12 }}>
        <div className="seg" role="group" aria-label="Billing interval">
          {['annual', 'monthly'].map((k) => INTERVALS[k]).map((iv) => (
            <button key={iv.id} className={iv.id === shown ? 'active' : ''} aria-pressed={iv.id === shown}
              disabled={!owner || !live || (iv.id !== shown && !!intervalNote && !/Already/.test(intervalNote))}
              onClick={() => iv.id !== shown && dispatch({ type: 'SET_BILLING_INTERVAL', interval: iv.id })}>
              {iv.id === 'monthly' ? 'Pay monthly' : 'Pay annually (default)'}
            </button>
          ))}
        </div>
        <span className="small muted">
          Annual is {ANNUAL_MULTIPLIER}× the monthly price, paid in advance: two months free.{' '}
          {intervalNote && !/Already/.test(intervalNote) ? intervalNote : sub.phase === 'committed' && (b.scheduledInterval
            ? `Switches to ${INTERVALS[b.scheduledInterval.interval].label.toLowerCase()} billing on the renewal date, ${date(b.scheduledInterval.at)}.`
            : 'A change takes effect on the renewal date.')}{' '}
          USDT and USDC payments are annual only.
        </span>
      </div>

      <div className="grid cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const isCurrent = id === current.id;
          const blockers = planBlockers(state, id);
          const yc = yearCost(id);
          const timing = planChangeTiming(b, id, t);
          const scheduled = b.scheduledPlan?.planId === id;
          return (
            <div className="card plan" key={id} style={isCurrent ? { borderColor: 'var(--teal)', boxShadow: '0 0 0 1px var(--teal)' } : undefined}>
              <div className="card__head">
                <h2>{p.name}</h2>
                <span className="spacer" />
                {isCurrent && <span className="badge pos">Current plan</span>}
                {scheduled && <span className="badge warn">From {date(b.scheduledPlan.at)}</span>}
              </div>
              <div className="card__body">
                <div className="stat__value">{short(priceFor(id, shown))}<span className="muted" style={{ fontSize: 14, fontWeight: 500 }}> / {INTERVALS[shown].per}</span></div>
                <p className="muted small" style={{ margin: '4px 0 12px' }}>
                  {shown === 'annual'
                    ? `Paid in advance. You save ${short(yc.saving)} against ${short(yc.monthly)} for 12 monthly payments.`
                    : `Or ${short(yc.annual)} a year paid in advance (save ${short(yc.saving)}).`}{' '}
                  {p.blurb} Billed in US dollars.
                </p>
                <dl className="kv">
                  <dt>Users</dt><dd>{limitLabel(p.maxUsers)}{p.maxUsers === 1 ? ' (owner only)' : p.maxUsers ? ' in total, including the owner' : ''}</dd>
                  <dt>Connections</dt><dd>{limitLabel(p.maxConnections)} <span className="muted small">{p.openBanking ? 'crypto, bank and card combined' : 'crypto only'}</span></dd>
                  <dt>Approval rules</dt><dd>{p.approvals ? 'Yes — M-of-N policies and address whitelist' : <span className="muted">Not included</span>}</dd>
                  <dt>Transactions & invoices</dt><dd>Yes</dd>
                  <dt>Open banking</dt><dd>{p.openBanking ? 'Yes — bank accounts and cards, read-only' : <span className="muted">Not included</span>}</dd>
                </dl>
              </div>
              <span className="spacer" />
              <div className="card__foot">
                {isCurrent ? (
                  <span className="small muted">{seatCount(state.users)} users · {state.connections.length} connections in use</span>
                ) : scheduled ? (
                  <>
                    <span className="small muted">Downgrade starts on the renewal date.</span>
                    {owner && <button className="btn sm" onClick={() => dispatch({ type: 'CANCEL_PLAN_CHANGE' })}>Keep {current.name}</button>}
                  </>
                ) : !owner ? (
                  <span className="small muted">Only the Owner can change plans.</span>
                ) : !live || (b.cancelAt && timing.when === 'renewal') ? (
                  <span className="small muted">{live ? 'The subscription ends at renewal.' : 'No active subscription.'}</span>
                ) : blockers.length ? (
                  <span className="small" style={{ color: 'var(--warn)' }}>{blockers.join(' ')}</span>
                ) : timing.when === 'renewal' ? (
                  <ConfirmButton className="btn sm" prompt={`Confirm: ${p.name} from ${date(timing.at)}`} onConfirm={() => dispatch({ type: 'CHANGE_PLAN', planId: id })}>
                    Downgrade from {date(timing.at)}
                  </ConfirmButton>
                ) : (
                  <>
                    <ConfirmButton className="btn primary sm"
                      prompt={timing.feeUsd ? `Confirm: pay ${usd(timing.feeUsd)} now` : `Confirm switch to ${p.name}`}
                      onConfirm={() => dispatch({ type: 'CHANGE_PLAN', planId: id })}>
                      {isUpgrade(current.id, id) ? 'Upgrade' : 'Downgrade'} to {p.name}
                    </ConfirmButton>
                    {timing.feeUsd > 0 && <span className="small muted">Today: {usd(timing.feeUsd)} pro rata for the rest of this {per}</span>}
                  </>
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
              <thead><tr><th>Invoice</th><th>Date</th><th>For</th><th>Paid with</th><th className="num">Amount</th><th>Status</th></tr></thead>
              <tbody>
                {state.subscriptionInvoices.map((i) => (
                  <tr key={i.id}><td className="mono">{i.id}</td><td>{date(i.date)}</td><td>{i.period || '—'}</td><td>{i.method}</td><td className="num">{usd(i.amountUsd)}</td><td>{i.status === 'failed' ? <span className="badge neg">Failed</span> : <span className="badge pos">Paid</span>}</td></tr>
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

function Subscription({ sub, owner, b, plan, next }) {
  const { dispatch } = useStore();
  const interval = b.interval || DEFAULT_INTERVAL;
  const amount = `${usd(priceFor(plan.id, interval)).replace('.00', '')} per ${INTERVALS[interval].per}`;
  const demo = (to, label) => (
    <button className="btn ghost sm" title="Prototype only: move the billing clock forward" onClick={() => dispatch({ type: 'DEMO_ADVANCE', to })}>{label}</button>
  );
  if (sub.phase === 'trial')
    return (
      <div className="notice" role="status">
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <span className="badge info">Free trial</span>
          <strong>{sub.daysLeft} day{sub.daysLeft === 1 ? '' : 's'} left · ends {date(sub.trialEnds)}</strong>
        </div>
        <p style={{ margin: '0 0 6px' }}>
          Your card ({b.paymentMethod.label}) is authorised, but nothing has been charged. Cancel before {date(sub.trialEnds)} and you pay nothing.
        </p>
        <p style={{ margin: '0 0 10px' }}>
          <strong>If you do not cancel, a 12-month agreement for {plan.name} starts on {date(sub.trialEnds)}</strong>, and your card is charged {amount}
          {interval === 'annual' ? ' in advance' : ' for 12 months'}. The agreement renews automatically every 12 months unless you cancel at least {NOTICE_DAYS} days before a renewal date.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          {owner
            ? <ConfirmButton className="btn sm danger" prompt="Click again: cancel trial, no charge" onConfirm={() => dispatch({ type: 'CANCEL_TRIAL' })}>Cancel trial (no charge)</ConfirmButton>
            : <span className="small muted">Only the Owner can cancel.</span>}
          {demo('trialEnd', 'Demo: jump to day 15')}
          <button className="btn ghost sm" title="Prototype only" onClick={() => dispatch({ type: 'DEMO_FAIL_CHARGE' })}>Demo: day-15 card charge fails</button>
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
    return (
      <div className="notice warn" role="status">
        {sub.reason === 'payment' ? (
          <><strong>The subscription was cancelled automatically on {date(sub.endedAt)}</strong>, because the card payment of {usd(sub.failure.amountUsd)} that
            failed on {date(sub.failure.at)} was not settled within {GRACE_DAYS} days.</>
        ) : (
          <><strong>The subscription ended{sub.endedAt ? ` on ${date(sub.endedAt)}` : ''}.</strong> No further charges will be made.</>
        )}
      </div>
    );
  const t = billingNow(b);
  const notice = cancellationDate(b, t);
  const reminders = renewalReminders(b, t);
  const extended = b.cancelAt && +new Date(b.cancelAt) > +new Date(sub.term.end);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {sub.pastDue && (
        <div className="notice neg" role="alert">
          <strong>Card payment failed on {date(sub.pastDue.at)} ({usd(sub.pastDue.amountUsd)}).</strong> We have notified the Owner by email.
          Update the card or retry by <strong>{date(sub.pastDue.graceEnds)}</strong> ({sub.pastDue.daysLeft} day{sub.pastDue.daysLeft === 1 ? '' : 's'} left),
          or the subscription will be cancelled automatically.
          <div className="row wrap" style={{ gap: 8, marginTop: 8 }}>
            {owner && <button className="btn sm primary" onClick={() => dispatch({ type: 'RETRY_PAYMENT' })}>Retry payment</button>}
            {demo('graceEnd', `Demo: jump ${GRACE_DAYS} days (no fix)`)}
          </div>
        </div>
      )}
      <div className={b.cancelAt ? 'notice warn' : 'notice'} role="status">
        <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
          <span className={b.cancelAt ? 'badge warn' : 'badge pos'}>{b.cancelAt ? 'Cancelled' : '12-month agreement'}</span>
          <strong>Year {sub.term.number}: {date(sub.term.start)} to {date(sub.term.end)}</strong>
        </div>
        {b.cancelAt ? (
          <p style={{ margin: '0 0 10px' }}>
            {extended
              ? <>Notice was given less than {NOTICE_DAYS} days before the renewal date, so the agreement renews on {date(sub.term.end)} for one more 12-month term and <strong>ends on {date(b.cancelAt)}</strong>.</>
              : <>Your cancellation takes effect on the renewal date, <strong>{date(b.cancelAt)}</strong>.</>}{' '}
            Until then you keep full access{next ? ` and the remaining payments are still due (next: ${usd(next.amountUsd)} on ${date(next.at)})` : ' and nothing more is charged'}.
          </p>
        ) : (
          <p style={{ margin: '0 0 10px' }}>
            {plan.name} at {amount}{interval === 'annual' ? ', paid in advance' : ''}.{next ? ` Next charge ${usd(next.amountUsd)} on ${date(next.at)}.` : ''}{' '}
            <strong>Renews automatically on {date(sub.term.end)} for another 12 months.</strong> To stop that renewal, cancel at least {NOTICE_DAYS} days
            before it, by <strong>{date(notice.deadline)}</strong>; later notice ends the agreement at the following renewal date. Upgrades apply straight away
            for a pro-rata fee; downgrades start on the renewal date.
          </p>
        )}
        {reminders.length > 0 && (
          <p className="small" style={{ margin: '0 0 10px' }}>
            Renewal reminders by email:{' '}
            {reminders.map((r, k) => <span key={r.daysBefore}>{k ? ' and ' : ''}{r.label} before ({date(r.at)}){r.sent ? ' ✓ sent' : ''}</span>)}.
          </p>
        )}
        <div className="row wrap" style={{ gap: 8 }}>
          {!owner ? <span className="small muted">Only the Owner can cancel.</span> : b.cancelAt
            ? <button className="btn sm" onClick={() => dispatch({ type: 'UNDO_CANCEL_RENEWAL' })}>Keep subscription (undo cancellation)</button>
            : <ConfirmButton className="btn sm danger" prompt={notice.late ? `Click again: ends ${date(notice.effective)}` : `Click again: end on ${date(notice.effective)}`}
                onConfirm={() => dispatch({ type: 'CANCEL_RENEWAL' })}>Cancel subscription</ConfirmButton>}
          {reminders.some((r) => !r.sent) && demo('reminder', 'Demo: jump to next reminder')}
          {demo('renewal', 'Demo: jump to renewal date')}
          {!sub.pastDue && b.paymentMethod.type === 'card' && next && (
            <button className="btn ghost sm" title="Prototype only" onClick={() => dispatch({ type: 'DEMO_FAIL_CHARGE' })}>Demo: next card charge fails</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PaymentMethod({ onClose, price }) {
  const { state, dispatch } = useStore();
  const coinBlocked = paymentMethodBlocker(state.billing, 'stablecoin', billingNow(state.billing));
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
      <label className="row"><input type="radio" disabled={!!coinBlocked} checked={type === 'stablecoin'} onChange={() => setType('stablecoin')} /> Stablecoin (USDT or USDC), annual billing only</label>
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
