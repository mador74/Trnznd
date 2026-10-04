import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { ASSET_NETWORKS, can, isFiatConn } from '../data/seed.js';
import { balances } from '../lib/ledger.js';
import { amount, dateTime } from '../lib/format.js';
import { canAddConnection } from '../lib/plans.js';
import { mintQuote, onrampQuote, PARTNERS, redeemQuote, redemptionAddressFor } from '../lib/partners.js';
import { Empty, Modal } from '../components/ui.jsx';

const ORDER_STATUS = {
  awaiting_payment: ['warn', 'Waiting for your payment at the on-ramp partner'],
  awaiting_deposit: ['warn', 'Waiting for your bank transfer to TRNZND'],
  processing: ['info', 'Processing'],
  delivered: ['pos', 'Delivered'],
  paid: ['pos', 'Fiat paid to your bank'],
  cancelled: ['', 'Cancelled'],
};
const OrderBadge = ({ s }) => <span className={`badge ${ORDER_STATUS[s]?.[0] || ''}`}>{ORDER_STATUS[s]?.[1] || s}</span>;

export default function Fund() {
  const [tab, setTab] = useState('buy');
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Buy & mint</h1>
          <p>Get stablecoins without already holding any: buy them with fiat through our regulated on-ramp partner, or mint ZEND directly with TRNZND, its issuer. Fiat is paid at the partner, never through TRNZIT.</p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'buy'} className={tab === 'buy' ? 'active' : ''} onClick={() => setTab('buy')}>Buy stablecoins</button>
        <button role="tab" aria-selected={tab === 'zend'} className={tab === 'zend' ? 'active' : ''} onClick={() => setTab('zend')}>Mint & redeem ZEND · TRNZND</button>
      </div>
      {tab === 'buy' ? <BuyStablecoins /> : <Zend />}
      <p className="small muted">Partner terms shown here (fees, currencies, minimums, the on-ramp partner’s supported assets, and ZEND’s valuation) are placeholders for the demo, not the partners’ actual terms. ZEND’s networks (Ethereum, Solana, Tron) are confirmed.</p>
    </div>
  );
}

/** Shared onboarding card: open an account with the partner, then (demo) simulate their approval. */
function Onboarding({ partner, extra }) {
  const { state, dispatch, me } = useStore();
  const p = PARTNERS[partner];
  const st = state.partners[partner]?.status || 'none';
  const owner = can(me, 'manageConnections');
  const full = partner === 'onramp' && !canAddConnection(state);
  return (
    <div className="card">
      <div className="card__head"><h2>{p.name}</h2><span className="muted small">{p.role}</span><span className="spacer" />
        <span className={`badge ${st === 'active' ? 'pos' : st === 'pending' ? 'warn' : ''}`}>{st === 'active' ? 'Account open' : st === 'pending' ? 'Checks in progress' : 'No account yet'}</span>
      </div>
      <div className="card__body stack">
        <p className="small" style={{ margin: 0 }}>{p.blurb}</p>
        {extra}
        {st === 'none' && (
          owner ? (
            <div className="row wrap">
              <button className="btn primary" disabled={full} onClick={() => dispatch({ type: 'PARTNER_APPLY', partner })}>Open an account with {p.ref}</button>
              <span className="small muted">You’ll complete {p.ref}’s own business checks on their site. TRNZIT only passes your company details if you choose to pre-fill them.</span>
            </div>
          ) : <div className="small muted">Ask an Owner or Admin to open the account.</div>
        )}
        {full && st === 'none' && <div className="notice warn small">Your plan’s connection limit is reached, and the on-ramp custody account needs a connection slot. <Link to="/settings">Upgrade</Link> or disconnect an account first.</div>}
        {st === 'pending' && (
          <div className="row wrap">
            <span className="small">Waiting for {p.ref} to finish its checks. This happens on the partner’s side and can take time.</span>
            <span className="spacer" />
            {owner && <button className="btn sm" onClick={() => dispatch({ type: 'PARTNER_APPROVE', partner })}>Simulate approval (demo)</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function BuyStablecoins() {
  const { state, dispatch, me } = useStore();
  const mp = state.partners.onramp;
  const custody = state.connections.find((c) => c.id === mp?.connectionId);
  const [fiat, setFiat] = useState('USD');
  const [fiatAmount, setFiatAmount] = useState('');
  const [asset, setAsset] = useState('USDC');
  const [payFrom, setPayFrom] = useState('');
  const n = Number(fiatAmount);
  const q = n > 0 ? onrampQuote(fiat, n, asset) : null;
  const payAccounts = state.connections.filter((c) => isFiatConn(c) && c.assets.includes(fiat));
  const orders = state.onrampOrders;
  const allowed = can(me, 'createRequest');

  return (
    <div className="stack">
      <Onboarding partner="onramp" extra={custody && <div className="small">Coins are delivered to <Link to={`/connections/${custody.id}`}>{custody.name}</Link>, held by the on-ramp partner in your business’s name.</div>} />
      {mp?.status === 'active' && custody && (
        <div className="card">
          <div className="card__head"><h2>Buy stablecoins</h2></div>
          <div className="card__body stack">
            <div className="grid cols-3">
              <label className="field"><span>You pay</span>
                <select id="on-fiat" value={fiat} onChange={(e) => { setFiat(e.target.value); setPayFrom(''); }}>{PARTNERS.onramp.fiat.map((f) => <option key={f}>{f}</option>)}</select>
              </label>
              <label className="field"><span>Amount</span><input id="on-amount" type="number" min="0" step="any" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} /></label>
              <label className="field"><span>You buy</span>
                <select id="on-asset" value={asset} onChange={(e) => setAsset(e.target.value)}>{PARTNERS.onramp.assets.map((a) => <option key={a}>{a}</option>)}</select>
              </label>
            </div>
            <label className="field"><span>Paying from (for your records)</span>
              <select id="on-from" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
                <option value="">A card or bank account not connected to TRNZIT</option>
                {payAccounts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.accountMask})</option>)}
              </select>
            </label>
            {q && (
              <div className="quote">
                <div className="row"><span className="muted">Partner fee (placeholder {(PARTNERS.onramp.feeRate * 100).toFixed(1)}%)</span><span className="spacer" /><span className="mono">{amount(q.fee, fiat)}</span></div>
                <div className="row"><strong>You receive about</strong><span className="spacer" /><strong className="mono">{amount(q.receive, asset)}</strong></div>
                <div className="small muted">The partner shows the binding price and fees at its checkout.</div>
              </div>
            )}
            <div className="row wrap">
              <span className="small muted" style={{ flex: 1, minWidth: 220 }}>You’ll pay on the partner’s own checkout page. TRNZIT never handles your card or bank details.</span>
              <button className="btn primary" disabled={!q || !allowed} onClick={() => {
                dispatch({ type: 'ONRAMP_CREATE', order: { fiat, fiatAmount: n, asset, receive: q.receive, fee: q.fee, connectionId: custody.id, payFromConnectionId: payFrom || null } });
                setFiatAmount('');
              }}>Continue to partner checkout</button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card__head"><h2>Purchases</h2></div>
        {orders.length === 0 ? <Empty>No purchases yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Started</th><th className="num">Paid</th><th className="num">Receive</th><th>Status</th><th /></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>{dateTime(o.createdAt)}</td>
                    <td className="num mono">{amount(o.fiatAmount, o.fiat)}</td>
                    <td className="num mono">{amount(o.receive, o.asset)}</td>
                    <td><OrderBadge s={o.status} /></td>
                    <td className="num">
                      {o.status === 'awaiting_payment' && (
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn sm ghost" onClick={() => dispatch({ type: 'CANCEL_ORDER', kind: 'onramp', id: o.id })}>Cancel</button>
                          <button className="btn sm primary" onClick={() => dispatch({ type: 'ONRAMP_PAID', id: o.id })}>Simulate paying at the partner (demo)</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Zend() {
  const { state, dispatch, me } = useStore();
  const [redeeming, setRedeeming] = useState(false);
  const active = state.partners.trnznd?.status === 'active';
  const t = PARTNERS.trnznd;
  const [fiat, setFiat] = useState('USD');
  const [fiatAmount, setFiatAmount] = useState('');
  const destinations = state.connections.filter((c) => !isFiatConn(c) && c.type !== 'exchange' && (c.network === 'Multi-chain' || (ASSET_NETWORKS.ZEND || []).includes(c.network)));
  const [dest, setDest] = useState('');
  const destOk = destinations.some((c) => c.id === dest) ? dest : destinations[0]?.id || '';
  const [payFrom, setPayFrom] = useState('');
  const n = Number(fiatAmount);
  const q = n > 0 ? mintQuote(fiat, n) : null;
  const error = !q ? '' : n < t.minimum ? `The minimum mint is ${t.minimum.toLocaleString('en-US')} ${fiat} (placeholder).` : !destOk ? 'Add a wallet on a ZEND network to receive it.' : '';
  const allowed = can(me, 'createRequest');
  const holders = state.connections.filter((c) => ((balances(state)[c.id] || {}).ZEND || 0) > 0);

  return (
    <div className="stack">
      <Onboarding partner="trnznd" extra={<div className="small muted">ZEND networks: {t.networks.join(', ')} · minimum {t.minimum.toLocaleString('en-US')} (placeholder) · fees to be confirmed by TRNZND.</div>} />
      {active && (
        <div className="grid cols-2">
          <div className="card">
            <div className="card__head"><h2>Mint ZEND</h2></div>
            <div className="card__body stack">
              <div className="grid cols-2">
                <label className="field"><span>Deposit currency</span>
                  <select id="mint-fiat" value={fiat} onChange={(e) => { setFiat(e.target.value); setPayFrom(''); }}>{t.fiat.map((f) => <option key={f}>{f}</option>)}</select>
                </label>
                <label className="field"><span>Amount</span><input id="mint-amount" type="number" min="0" step="any" value={fiatAmount} onChange={(e) => setFiatAmount(e.target.value)} /></label>
              </div>
              <label className="field"><span>Deliver ZEND to</span>
                <select id="mint-dest" value={destOk} onChange={(e) => setDest(e.target.value)}>
                  {destinations.length === 0 && <option value="">No wallet on a ZEND network</option>}
                  {destinations.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.network})</option>)}
                </select>
              </label>
              <label className="field"><span>Paying from (for your records)</span>
                <select id="mint-from" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
                  <option value="">A bank account not connected to TRNZIT</option>
                  {state.connections.filter((c) => c.type === 'bank' && c.assets.includes(fiat)).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.accountMask})</option>)}
                </select>
              </label>
              {q && !error && (
                <div className="quote">
                  <div className="row"><span className="muted">TRNZND fee</span><span className="spacer" /><span className="mono">To be confirmed</span></div>
                  <div className="row"><strong>You receive about</strong><span className="spacer" /><strong className="mono">{amount(q.zend, 'ZEND')}</strong></div>
                  <div className="small muted">Delivered on {state.connections.find((c) => c.id === destOk)?.network === 'Multi-chain' ? 'the network your custodian chooses' : state.connections.find((c) => c.id === destOk)?.network}. Demo valuation 1 ZEND = $1.00 (placeholder). TRNZND sets the actual mint rate.</div>
                </div>
              )}
              {error && <div className="notice warn small">{error}</div>}
              <button className="btn primary" disabled={!q || !!error || !allowed} onClick={() => {
                dispatch({ type: 'ZEND_MINT_CREATE', order: { fiat, fiatAmount: n, zend: q.zend, connectionId: destOk, payFromConnectionId: payFrom || null } });
                setFiatAmount('');
              }}>Request mint</button>
            </div>
          </div>
          <div className="card">
            <div className="card__head"><h2>Redeem ZEND</h2></div>
            <div className="card__body stack">
              <p className="small" style={{ margin: 0 }}>Send ZEND back to TRNZND and receive fiat in your bank account. Redemption moves funds out of your wallet, so it follows your approval rules and needs an authorised releaser, like any payment.</p>
              <div className="small muted">ZEND held: {holders.length ? holders.map((c) => `${c.name}: ${amount(balances(state)[c.id].ZEND, 'ZEND')}`).join(' · ') : 'none yet. Mint some first.'}</div>
              <button className="btn" disabled={!holders.length || !allowed} onClick={() => setRedeeming(true)}>Redeem ZEND</button>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card__head"><h2>ZEND activity</h2></div>
        {state.zendOrders.length === 0 ? <Empty>No mints or redemptions yet.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Started</th><th>Type</th><th className="num">Fiat</th><th className="num">ZEND</th><th>Account</th><th>Status</th><th /></tr></thead>
              <tbody>
                {state.zendOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{dateTime(o.createdAt)}</td>
                    <td>{o.kind === 'mint' ? 'Mint' : 'Redeem'}</td>
                    <td className="num mono">{amount(o.fiatAmount, o.fiat)}</td>
                    <td className="num mono">{amount(o.zend, 'ZEND')}</td>
                    <td>{state.connections.find((c) => c.id === (o.kind === 'mint' ? o.connectionId : o.bankConnectionId))?.name || '—'}</td>
                    <td><OrderBadge s={o.status} /></td>
                    <td className="num">
                      {o.status === 'awaiting_deposit' && (
                        <div className="row" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn sm ghost" onClick={() => dispatch({ type: 'CANCEL_ORDER', kind: 'zend', id: o.id })}>Cancel</button>
                          <button className="btn sm primary" onClick={() => dispatch({ type: 'ZEND_DEPOSIT_SENT', id: o.id })}>Simulate bank transfer (demo)</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {state.zendOrders.some((o) => o.status === 'awaiting_deposit') && (
          <div className="card__foot small muted">TRNZND gives you its bank details and a unique payment reference for each mint. Those details are not shown in this demo.</div>
        )}
      </div>
      {redeeming && <Redeem onClose={() => setRedeeming(false)} />}
    </div>
  );
}

function Redeem({ onClose }) {
  const { state, dispatch } = useStore();
  const bal = balances(state);
  const holders = state.connections.filter((c) => ((bal[c.id] || {}).ZEND || 0) > 0);
  const [from, setFrom] = useState(holders[0]?.id || '');
  const conn = state.connections.find((c) => c.id === from);
  const banks = state.connections.filter((c) => c.type === 'bank');
  const [bank, setBank] = useState(banks[0]?.id || '');
  const [fiat, setFiat] = useState(banks[0]?.assets[0] || 'USD');
  const [qty, setQty] = useState('');
  const n = Number(qty);
  const available = (bal[from] || {}).ZEND || 0;
  const w = redemptionAddressFor(conn, state.whitelist, state.partners.trnznd?.redemptionWhitelistIds);
  const q = n > 0 ? redeemQuote(n, fiat) : null;
  const error = !(n > 0) ? 'Enter an amount.' : n > available ? `More than ${conn?.name} holds (${amount(available, 'ZEND')}).`
    : !conn?.sendEnabled ? `Sending is not switched on for ${conn?.name}.` : !bank ? 'Connect the bank account to be paid into.' : !w ? 'TRNZND redemption address missing.' : '';
  return (
    <Modal title="Redeem ZEND" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!!error} onClick={() => {
        dispatch({ type: 'CREATE_REQUEST', request: {
          type: 'withdrawal', connectionId: from, asset: 'ZEND', amount: n, usdValue: n, to: w.label, toAddress: w.address, network: w.network,
          reference: `ZEND redemption to ${fiat}`, zendRedeem: { fiat, bankConnectionId: bank },
        } });
        onClose();
      }}>Create redemption</button>
    </>}>
      <label className="field"><span>Redeem from</span>
        <select id="rd-from" value={from} onChange={(e) => setFrom(e.target.value)}>{holders.map((c) => <option key={c.id} value={c.id}>{c.name} · {amount(bal[c.id].ZEND, 'ZEND')}</option>)}</select>
      </label>
      <label className="field"><span>Amount of ZEND</span><input id="rd-amount" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} /></label>
      <div className="grid cols-2">
        <label className="field"><span>Pay fiat into</span>
          <select id="rd-bank" value={bank} onChange={(e) => setBank(e.target.value)}>{banks.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.accountMask})</option>)}</select>
        </label>
        <label className="field"><span>Currency</span>
          <select id="rd-fiat" value={fiat} onChange={(e) => setFiat(e.target.value)}>{PARTNERS.trnznd.fiat.map((f) => <option key={f}>{f}</option>)}</select>
        </label>
      </div>
      {error && qty !== '' ? <div className="notice warn small">{error}</div> : q && (
        <div className="notice small">Sent on {w?.network} to TRNZND’s redemption address. You receive about <strong>{amount(q.fiat, fiat)}</strong> (placeholder rate, fees to be confirmed). It then goes through your approval rules and an authorised releaser on the <Link to="/send">Send</Link> page.</div>
      )}
    </Modal>
  );
}
