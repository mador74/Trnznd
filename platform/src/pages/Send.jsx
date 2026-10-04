import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../state/store.jsx';
import { can } from '../data/seed.js';
import { deriveStatus } from '../lib/policy.js';
import { planOf } from '../lib/plans.js';
import { sourceBlockReason } from '../lib/send.js';
import { dateTime } from '../lib/format.js';
import { Empty } from '../components/ui.jsx';
import { NewRequest, RequestCard } from './Approvals.jsx';

const PAYMENT_TYPES = ['withdrawal', 'internal_transfer'];

export default function Send() {
  const { state, me } = useStore();
  const [tab, setTab] = useState('ready');
  const [creating, setCreating] = useState(null);
  const plan = planOf(state);
  const payments = state.requests
    .filter((r) => PAYMENT_TYPES.includes(r.type))
    .map((r) => ({ ...r, status: deriveStatus(r, state.policies, state.users) }));
  const lists = {
    ready: payments.filter((r) => r.status === 'approved'),
    pending: payments.filter((r) => r.status === 'pending'),
    sending: payments.filter((r) => r.status === 'broadcast'),
    done: payments.filter((r) => ['executed', 'rejected', 'cancelled'].includes(r.status)),
  };
  const canSendFrom = state.connections.filter((c) => !sourceBlockReason(c));
  const off = state.connections.filter((c) => sourceBlockReason(c));
  const allowed = can(me, 'createRequest');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Send</h1>
          <p>
            Instruct your own custodian, exchange or wallet to pay stablecoins or other crypto to a counterparty’s whitelisted address. TRNZIT never holds keys or funds.
            {plan.approvals ? ' Each payment follows your approval rules, then an authorised releaser gives the final release.' : ' On Basic you release each payment yourself with your 2-step code.'}
          </p>
        </div>
        <span className="spacer" />
        {allowed && (
          <>
            <button className="btn" onClick={() => setCreating('address_whitelist')}>+ Add address</button>
            <button className="btn primary" disabled={!canSendFrom.length} onClick={() => setCreating('withdrawal')}>+ New payment</button>
          </>
        )}
      </div>

      <div className="notice small">
        Sending is available from {canSendFrom.length ? canSendFrom.map((c) => c.name).join(', ') : 'no accounts yet'}.
        {off.length > 0 && <> Not available from {off.map((c) => c.name).join(', ')}: bank and card payments are coming later, and exchanges need sending switched on from their <Link to="/connections">connection page</Link>.</>}
      </div>

      <div>
        <div className="tabs" role="tablist">
          {[
            ['ready', `Ready to send (${lists.ready.length})`],
            ['pending', `Awaiting approval (${lists.pending.length})`],
            ['sending', `With provider (${lists.sending.length})`],
            ['done', 'Completed'],
            ['addresses', `Whitelisted addresses (${state.whitelist.length})`],
          ].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        {tab === 'addresses' ? (
          <div className="card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Counterparty</th><th>Network</th><th>Address</th><th>Added</th></tr></thead>
                <tbody>
                  {state.whitelist.map((w) => (
                    <tr key={w.id}><td>{w.label}</td><td>{w.network}</td><td className="mono" style={{ overflowWrap: 'anywhere' }}>{w.address}</td><td>{dateTime(w.addedAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="stack">
            {lists[tab].length === 0 && <div className="card"><Empty>Nothing here.</Empty></div>}
            {lists[tab].map((r) => <RequestCard key={r.id} r={r} />)}
          </div>
        )}
      </div>

      {creating && (
        <NewRequest
          onClose={() => setCreating(null)}
          initialType={creating}
          types={creating === 'address_whitelist' ? ['address_whitelist'] : PAYMENT_TYPES}
        />
      )}
    </div>
  );
}
