import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { ACTION_TYPES, cannotSignReason, deriveStatus, governingPolicies, progress, validatePolicy } from '../lib/policy.js';
import { balances, priceOf } from '../lib/ledger.js';
import { amount, dateTime, relative, shortAddr, money, usd } from '../lib/format.js';
import { Link } from 'react-router-dom';
import { can, isFiatConn } from '../data/seed.js';
import { planOf } from '../lib/plans.js';
import { cannotReleaseReason, checkPayment, NETWORK_FEE_USD, SEND_METHODS, sourceBlockReason } from '../lib/send.js';
import { Avatar, Empty, Modal, RoleBadge, StatusBadge } from '../components/ui.jsx';

export default function Approvals() {
  const { state, me } = useStore();
  const [tab, setTab] = useState('mine');
  const [creating, setCreating] = useState(false);
  if (!planOf(state).approvals)
    return (
      <div className="card card__body stack" style={{ maxWidth: 640 }}>
        <h1>Approvals</h1>
        <p className="muted">Approval rules (for example “2 of 3 people must sign off payments over $10k”), the address whitelist and the sign-off queue are part of the Premium and Institution plans.</p>
        <p className="muted">Your Basic plan has one user, so there is nobody else to approve with.</p>
        {can(me, 'manageBilling') ? <Link className="btn primary" to="/settings">Compare plans</Link> : <p className="small">Ask the account owner to upgrade.</p>}
      </div>
    );
  const withStatus = state.requests.map((r) => ({ ...r, status: deriveStatus(r, state.policies, state.users) }));
  const mine = withStatus.filter((r) => r.status === 'pending' && !cannotSignReason(r, me.id, state.policies, state.users));
  const ready = withStatus.filter((r) => r.status === 'approved');
  const lists = {
    mine,
    pending: withStatus.filter((r) => r.status === 'pending'),
    ready,
    history: withStatus.filter((r) => ['broadcast', 'executed', 'rejected', 'cancelled'].includes(r.status)),
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p>Outgoing payments, transfers and new addresses need sign-off under your policies (e.g. 2 of 3). Once approved, a payment can be signed and sent from the <Link to="/send">Send</Link> page.</p>
        </div>
        <span className="spacer" />
        {can(me, 'createRequest') && <button className="btn primary" onClick={() => setCreating(true)}>+ New request</button>}
      </div>
      <div className="tabs" role="tablist">
        {[
          ['mine', `Needs my signature (${mine.length})`],
          ['pending', `All pending (${lists.pending.length})`],
          ['ready', `Ready to send (${ready.length})`],
          ['history', 'History'],
          ['policies', `Policies (${state.policies.length})`],
          ['whitelist', `Whitelisted addresses (${state.whitelist.length})`],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'policies' ? <Policies /> : tab === 'whitelist' ? <Whitelist /> : (
        <div className="stack">
          {lists[tab].length === 0 && <div className="card"><Empty>Nothing here.</Empty></div>}
          {lists[tab].map((r) => <RequestCard key={r.id} r={r} />)}
        </div>
      )}
      {creating && <NewRequest onClose={() => setCreating(false)} />}
    </div>
  );
}

export function RequestCard({ r }) {
  const { state, dispatch, me } = useStore();
  const [note, setNote] = useState('');
  const [hash, setHash] = useState('');
  const user = (id) => state.users.find((u) => u.id === id);
  const conn = state.connections.find((c) => c.id === r.connectionId);
  const prog = progress(r, state.policies, state.users);
  const reason = cannotSignReason(r, me.id, state.policies, state.users);
  const title = r.type === 'address_whitelist' ? `Whitelist address for ${r.to}` : `${amount(r.amount, r.asset)} → ${r.to}`;

  return (
    <div className="card">
      <div className="card__head">
        <div style={{ minWidth: 0 }}>
          <h2>{title}</h2>
          <div className="muted small">{ACTION_TYPES[r.type]} · requested by {user(r.requestedBy)?.name} · {relative(r.createdAt)}</div>
        </div>
        <span className="spacer" />
        <StatusBadge status={r.status} />
      </div>
      <div className="card__body grid cols-2">
        <dl className="kv">
          <dt>From</dt><dd>{conn?.name || 'Removed connection'}</dd>
          <dt>To</dt><dd>{r.to}<div className="mono muted">{r.toAddress}</div></dd>
          {r.type !== 'address_whitelist' && (<><dt>Value</dt><dd>{money(r.usdValue)} <span className="muted small">(at request time)</span></dd></>)}
          <dt>Reference</dt><dd>{r.reference || '—'}</dd>
          {r.executedTxHash && (<><dt>Executed</dt><dd>{dateTime(r.executedAt)}<div className="mono muted">{shortAddr(r.executedTxHash)}</div></dd></>)}
        </dl>
        <div className="stack">
          {prog.map(({ policy, have, need, satisfied }) => (
            <div key={policy.id}>
              <div className="row small">
                <strong>{policy.name}</strong>
                <span className="spacer" />
                <span className={satisfied ? 'pos' : ''}>{have} of {need} required</span>
              </div>
              <div className="progress" style={{ marginTop: 6 }}><div style={{ width: `${Math.min(100, (have / need) * 100)}%` }} /></div>
              <div className="muted small" style={{ marginTop: 4 }}>
                Eligible: {policy.approverIds.map((id) => user(id)?.name).filter(Boolean).join(', ') || 'nobody — fix this policy'}
              </div>
            </div>
          ))}
          {[...r.approvals.map((s) => ({ ...s, ok: true })), ...r.rejections.map((s) => ({ ...s, ok: false }))].map((s) => (
            <div className="row small" key={s.userId + s.at}>
              <Avatar user={user(s.userId)} />
              <span><strong>{user(s.userId)?.name}</strong> {s.ok ? 'approved' : 'rejected'} · {relative(s.at)}{s.note && <> — “{s.note}”</>}</span>
            </div>
          ))}
        </div>
      </div>
      {r.status === 'pending' && (
        <div className="card__foot row wrap">
          {reason ? (
            <span className="muted small">{reason}</span>
          ) : (
            <>
              <input style={{ maxWidth: 320 }} placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn primary" onClick={() => dispatch({ type: 'SIGN_REQUEST', id: r.id, decision: 'approve', note })}>Approve</button>
              <button className="btn danger" onClick={() => dispatch({ type: 'SIGN_REQUEST', id: r.id, decision: 'reject', note })}>Reject</button>
            </>
          )}
          <span className="spacer" />
          {r.requestedBy === me.id && <button className="btn sm ghost" onClick={() => dispatch({ type: 'CANCEL_REQUEST', id: r.id })}>Cancel request</button>}
        </div>
      )}
      {r.status === 'approved' && r.type !== 'address_whitelist' && <SendFooter r={r} conn={conn} />}
      {r.status === 'broadcast' && (
        <div className="card__foot row wrap">
          <span className="badge info">Released by {state.users.find((u) => u.id === r.sentBy)?.name}</span>
          <span className="small muted">Instruction passed to {conn?.name}. Waiting for the provider to execute and report the transaction.</span>
        </div>
      )}
    </div>
  );
}

export function NewRequest({ onClose, initialType = 'withdrawal', types = Object.keys(ACTION_TYPES) }) {
  const { state, dispatch, me } = useStore();
  const single = !planOf(state).approvals;
  const [type, setType] = useState(initialType);
  const sendable = state.connections.filter((c) => !sourceBlockReason(c));
  const [connectionId, setConn] = useState(sendable[0]?.id || '');
  const conn = state.connections.find((c) => c.id === connectionId);
  const [asset, setAsset] = useState(conn?.assets[0] || 'USDT');
  const [qty, setQty] = useState('');
  const [dest, setDest] = useState('');
  const [toConn, setToConn] = useState('');
  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');
  const [network, setNetwork] = useState('Ethereum');
  const [reference, setReference] = useState('');

  const available = (balances(state)[connectionId] || {})[asset] || 0;
  const n = Number(qty);
  const usdValue = type === 'address_whitelist' ? 0 : n * priceOf(asset);
  // Only offer addresses this account can actually pay on this network.
  const destinations = state.whitelist.filter((w) => !checkPayment({ conn, asset, amount: 1, available: 1, dest: w }));
  const w = destinations.find((x) => x.id === dest) || destinations[0];
  const target = state.connections.find((c) => c.id === toConn);
  let request = null;
  let error = '';
  if (type === 'address_whitelist') {
    if (!label.trim() || addr.trim().length < 10) error = 'Enter a label and a full address.';
    else request = { type, connectionId, asset: '—', amount: 0, usdValue: 0, to: label.trim(), toAddress: addr.trim(), network, reference };
  } else if (type === 'withdrawal') {
    error = checkPayment({ conn, asset, amount: n, available, dest: w })
      || (destinations.length === 0 ? `No whitelisted address can receive ${asset} from this account.` : '');
    if (!error) request = { type, connectionId, asset, amount: n, usdValue, reference, to: w.label, toAddress: w.address, network: w.network };
  } else {
    error = sourceBlockReason(conn) || (!(n > 0) ? 'Enter an amount.' : n > available ? `Exceeds available balance (${amount(available, asset)}).` : !target ? 'Choose the destination connection.' : '');
    if (!error) request = { type, connectionId, asset, amount: n, usdValue, reference, to: target.name, toAddress: target.address || 'Internal' };
  }
  const gov = request && !single ? governingPolicies({ ...request, requestedBy: me.id }, state.policies, state.users) : [];
  const netForFee = type === 'withdrawal' ? w?.network : conn?.network;
  const fee = NETWORK_FEE_USD[netForFee];
  const isPayment = type !== 'address_whitelist';

  return (
    <Modal title={isPayment ? 'New payment' : 'Add whitelisted address'} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!request} onClick={() => { dispatch({ type: 'CREATE_REQUEST', request }); onClose(); }}>
        {single ? (isPayment ? 'Create payment' : 'Add address') : 'Submit for approval'}
      </button>
    </>}>
      {types.length > 1 && (
        <label className="field"><span>What do you want to do?</span>
          <select id="nr-type" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((k) => <option key={k} value={k}>{ACTION_TYPES[k]}</option>)}
          </select>
        </label>
      )}
      {type === 'address_whitelist' ? (
        <>
          <label className="field"><span>Label (counterparty)</span><input id="nr-label" value={label} onChange={(e) => setLabel(e.target.value)} /></label>
          <div className="grid cols-2">
            <label className="field"><span>Network</span>
              <select id="nr-network" value={network} onChange={(e) => setNetwork(e.target.value)}>{['Ethereum', 'Tron', 'Solana', 'Bitcoin', 'Polygon', 'Base', 'Arbitrum'].map((x) => <option key={x}>{x}</option>)}</select>
            </label>
            <label className="field"><span>Address</span><input id="nr-addr" className="mono" value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
          </div>
          {single && <div className="notice small">Your Basic plan has one user, so the address is added straight away and recorded in the audit log.</div>}
        </>
      ) : (
        <>
          <div className="grid cols-2">
            <label className="field"><span>Pay from</span>
              <select id="nr-from" value={connectionId} onChange={(e) => { setConn(e.target.value); const c = state.connections.find((x) => x.id === e.target.value); setAsset(c?.assets[0]); setDest(''); }}>
                {state.connections.map((c) => {
                  const why = sourceBlockReason(c);
                  return <option key={c.id} value={c.id} disabled={!!why}>{c.name}{why ? (isFiatConn(c) ? ' — fiat payments coming soon' : ' — sending not switched on') : ''}</option>;
                })}
              </select>
            </label>
            <label className="field"><span>Coin</span>
              <select id="nr-asset" value={asset} onChange={(e) => { setAsset(e.target.value); setDest(''); }}>{conn?.assets.map((a) => <option key={a}>{a}</option>)}</select>
            </label>
          </div>
          <label className="field"><span>Amount <span className="muted">— available {amount(available, asset)}</span></span>
            <input id="nr-amount" type="number" min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          {type === 'withdrawal' ? (
            <label className="field"><span>Pay to (whitelisted address)</span>
              <select id="nr-dest" value={w?.id || ''} onChange={(e) => setDest(e.target.value)} disabled={!destinations.length}>
                {destinations.length === 0 && <option value="">No compatible whitelisted address</option>}
                {destinations.map((x) => <option key={x.id} value={x.id}>{x.label} · {x.network} · {shortAddr(x.address)}</option>)}
              </select>
            </label>
          ) : (
            <label className="field"><span>To connection</span>
              <select id="nr-to" value={toConn} onChange={(e) => setToConn(e.target.value)}>
                <option value="">Choose…</option>
                {state.connections.filter((c) => !isFiatConn(c) && c.id !== connectionId && c.assets.includes(asset)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
        </>
      )}
      <label className="field"><span>Reference</span><input id="nr-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice / PO number, purpose" /></label>
      {error ? <div className="notice warn small">{error}</div> : isPayment && (
        <div className="notice small">
          <div><strong>{money(usdValue)}</strong> at demo price{fee != null && <> · network fee about {money(fee)} (estimate, paid by the sending account)</>}.</div>
          <div>How it is paid: {SEND_METHODS[conn?.type]?.label}.</div>
          {single ? <div>You will confirm with your 2-step code when you send.</div> : <div>Needs: {gov.map((p) => `${p.name} (${p.required} of ${p.approverIds.length})`).join(' + ')}</div>}
        </div>
      )}
    </Modal>
  );
}

const emptyPolicy = { name: '', enabled: true, actionTypes: ['withdrawal'], connectionIds: [], minUsd: 0, approverIds: [], required: 2, allowSelfApproval: false };

function Policies() {
  const { state, dispatch, me } = useStore();
  const [editing, setEditing] = useState(null);
  const edit = can(me, 'managePolicies');
  const name = (id) => state.users.find((u) => u.id === id)?.name;
  return (
    <div className="stack">
      <div className="row">
        <p className="muted" style={{ margin: 0 }}>A request must satisfy <strong>every</strong> policy that matches it. If none match, one Owner/Admin approval is required. Requesters can never approve their own request.</p>
        <span className="spacer" />
        {edit && <button className="btn primary" onClick={() => setEditing(emptyPolicy)}>+ New policy</button>}
      </div>
      {state.policies.map((p) => {
        const errs = validatePolicy(p);
        return (
          <div className="card" key={p.id}>
            <div className="card__head">
              <h2>{p.name}</h2>
              {!p.enabled && <span className="badge">Disabled</span>}
              <span className="spacer" />
              <span className="badge info">{p.required} of {p.approverIds.length}</span>
              {edit && <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>}
            </div>
            <div className="card__body">
              <dl className="kv">
                <dt>Applies to</dt><dd>{p.actionTypes.map((t) => ACTION_TYPES[t]).join(', ')}</dd>
                <dt>Threshold</dt><dd>{Number(p.minUsd) > 0 ? `${usd(p.minUsd)} and above (USD)` : 'Any amount'}</dd>
                <dt>Connections</dt><dd>{p.connectionIds.length ? p.connectionIds.map((id) => state.connections.find((c) => c.id === id)?.name).join(', ') : 'All'}</dd>
                <dt>Approvers</dt><dd>{p.approverIds.map(name).join(', ') || '—'}</dd>
              </dl>
              {errs.length > 0 && <div className="notice neg small" style={{ marginTop: 12 }}>This policy can’t be satisfied: {errs.join(' ')}</div>}
            </div>
          </div>
        );
      })}
      {editing && (
        <PolicyEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={editing.id ? () => { dispatch({ type: 'DELETE_POLICY', id: editing.id }); setEditing(null); } : null}
          onSave={(p) => { dispatch({ type: 'SAVE_POLICY', policy: p }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function PolicyEditor({ initial, onClose, onSave, onDelete }) {
  const { state } = useStore();
  const [p, setP] = useState(initial);
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const flip = (k, v) => set(k, p[k].includes(v) ? p[k].filter((x) => x !== v) : [...p[k], v]);
  const errs = validatePolicy(p);
  const eligible = state.users.filter((u) => u.status === 'active' && ['owner', 'admin', 'approver'].includes(u.role));
  return (
    <Modal title={initial.id ? 'Edit policy' : 'New policy'} onClose={onClose} wide footer={<>
      {onDelete && <button className="btn danger" onClick={onDelete}>Delete</button>}
      <span className="spacer" />
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={errs.length > 0} onClick={() => onSave({ ...p, minUsd: Number(p.minUsd) || 0 })}>Save policy</button>
    </>}>
      <label className="field"><span>Name</span><input value={p.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Payments over $50k — 2 of 3" /></label>
      <div>
        <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Applies to</div>
        {Object.entries(ACTION_TYPES).map(([k, v]) => (
          <label key={k} className="row small"><input type="checkbox" checked={p.actionTypes.includes(k)} onChange={() => flip('actionTypes', k)} />{v}</label>
        ))}
      </div>
      <div className="grid cols-2">
        <label className="field"><span>Minimum USD value</span><input type="number" min="0" value={p.minUsd} onChange={(e) => set('minUsd', e.target.value)} /></label>
        <label className="field"><span>Approvals required (M)</span><input type="number" min="1" value={p.required} onChange={(e) => set('required', parseInt(e.target.value, 10) || 0)} /></label>
      </div>
      <div>
        <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Approvers (N) — {p.required} of {p.approverIds.length}</div>
        {eligible.map((u) => (
          <label key={u.id} className="row small"><input type="checkbox" checked={p.approverIds.includes(u.id)} onChange={() => flip('approverIds', u.id)} />{u.name} <RoleBadge role={u.role} /></label>
        ))}
      </div>
      <div>
        <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Limit to connections (none ticked = all)</div>
        {state.connections.map((c) => (
          <label key={c.id} className="row small"><input type="checkbox" checked={p.connectionIds.includes(c.id)} onChange={() => flip('connectionIds', c.id)} />{c.name}</label>
        ))}
      </div>
      <label className="row small"><input type="checkbox" checked={p.enabled} onChange={(e) => set('enabled', e.target.checked)} />Enabled</label>
      {errs.length > 0 && <div className="notice warn small">{errs.join(' ')}</div>}
    </Modal>
  );
}

function Whitelist() {
  const { state } = useStore();
  return (
    <div className="card">
      <div className="card__head"><span className="muted small">Outgoing payments can only be requested to these addresses. New addresses go through the approval flow (“+ New request” → Add whitelisted address).</span></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Label</th><th>Network</th><th>Address</th><th>Added</th></tr></thead>
          <tbody>
            {state.whitelist.map((w) => (
              <tr key={w.id}><td>{w.label}</td><td>{w.network}</td><td className="mono">{w.address}</td><td>{dateTime(w.addedAt)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Footer for an approved payment: sign & send through the source connection, or record one made elsewhere. */
function SendFooter({ r, conn }) {
  const { state, dispatch, me } = useStore();
  const [stepUp, setStepUp] = useState(false);
  const [manual, setManual] = useState(false);
  const [hash, setHash] = useState('');
  const block = sourceBlockReason(conn);
  const available = (balances(state)[r.connectionId] || {})[r.asset] || 0;
  const short = r.amount > available;
  const allowed = can(me, 'createRequest');
  const releaseBlock = cannotReleaseReason(me);
  const releasers = state.users.filter((u) => !cannotReleaseReason(u)).map((u) => u.name);
  const method = conn && SEND_METHODS[conn.type];
  return (
    <div className="card__foot stack" style={{ display: 'block' }}>
      <div className="row wrap">
        <div style={{ minWidth: 0 }}>
          <strong className="small">{method ? method.label : 'Ready to send'}</strong>
          <div className="muted small">{block || (short ? `Not enough ${r.asset} available (${amount(available, r.asset)}).` : method?.detail)}</div>
          <div className="muted small">Final release by: {releasers.join(', ') || 'nobody yet. An Owner or Admin can authorise releasers on the Team page.'}</div>
        </div>
        <span className="spacer" />
        {allowed && <button className="btn sm ghost" onClick={() => setManual((m) => !m)}>Paid outside TRNZND?</button>}
        <button className="btn primary" disabled={!!block || short || !!releaseBlock} title={releaseBlock || ''} onClick={() => setStepUp(true)}>Release payment</button>
      </div>
      {releaseBlock && <div className="small" style={{ color: 'var(--warn)' }}>{releaseBlock}</div>}
      {manual && (
        <div className="row wrap">
          <input className="mono" style={{ maxWidth: 360 }} placeholder="Transaction hash" value={hash} onChange={(e) => setHash(e.target.value)} />
          <button className="btn sm" disabled={hash.trim().length < 8} onClick={() => dispatch({ type: 'MARK_EXECUTED', id: r.id, txHash: hash.trim() })}>Record payment</button>
        </div>
      )}
      {stepUp && (
        <StepUp
          title={`Release ${amount(r.amount, r.asset)}`}
          provider={conn?.name}
          summary={<>From <strong>{conn?.name}</strong> to <strong>{r.to}</strong>{r.network && <> on <strong>{r.network}</strong></>}<div className="mono small muted" style={{ overflowWrap: 'anywhere' }}>{r.toAddress}</div></>}
          onClose={() => setStepUp(false)}
          onConfirm={() => { dispatch({ type: 'SEND_REQUEST', id: r.id }); setStepUp(false); }}
        />
      )}
    </div>
  );
}

/** Second-factor confirmation before money moves. Demo accepts any 6 digits. */
export function StepUp({ title, summary, provider, onClose, onConfirm }) {
  const [code, setCode] = useState('');
  const valid = /^\d{6}$/.test(code);
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!valid} onClick={onConfirm}>Release to {provider || 'provider'}</button>
    </>}>
      <div>{summary}</div>
      <div className="small">
        This is your personal authorisation. TRNZND passes the instruction to <strong>{provider}</strong> by API; {provider} holds the
        assets and makes the payment. TRNZND never holds private keys or your funds.
      </div>
      <div className="notice warn small">Crypto payments cannot be reversed once confirmed. Check the address and network.</div>
      <label className="field">
        <span>6-digit code from your authenticator app</span>
        <input id="stepup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
      </label>
      <div className="small muted">Demo: any 6 digits work.</div>
    </Modal>
  );
}
