import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { ASSETS, can } from '../data/seed.js';
import { amount, date, dateTime, displayCurrency, money } from '../lib/format.js';
import { usdOf } from '../lib/ledger.js';
import { invoiceStatus, invoiceSubtotal, invoiceTax, invoiceTotal, lineTotal, matchCandidates, validateInvoice } from '../lib/invoice.js';
import { payToDetails, payToOptions } from '../lib/payto.js';
import { downloadInvoicePdf } from '../lib/pdf.js';
import { ConfirmButton, Empty, Modal, StatusBadge } from '../components/ui.jsx';

const TABS = [
  ['all', 'All'],
  ['draft', 'Draft'],
  ['sent', 'Awaiting payment'],
  ['overdue', 'Overdue'],
  ['paid', 'Paid'],
];

export default function Invoices() {
  const { state, me } = useStore();
  const [tab, setTab] = useState('all');
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const edit = can(me, 'invoices');
  const contact = (id) => state.contacts.find((k) => k.id === id);
  const rows = state.invoices.map((i) => ({ ...i, s: invoiceStatus(i) }));
  const shown = rows.filter((i) => tab === 'all' || i.s === tab);
  const sum = (st) => rows.filter((i) => i.s === st).reduce((t, i) => t + usdOf(i.currency, invoiceTotal(i)), 0);
  const inv = viewing && state.invoices.find((i) => i.id === viewing);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Invoices</h1>
          <p>Bill customers in stablecoins, crypto or fiat. Send each invoice as a PDF, and match payments to the ledger when they arrive.</p>
        </div>
        <span className="spacer" />
        {edit && <button className="btn primary" onClick={() => setEditing({})}>+ New invoice</button>}
      </div>

      <div className="grid cols-3">
        <div className="card card__body"><div className="stat__label">Draft</div><div className="stat__value">{money(sum('draft'))}</div></div>
        <div className="card card__body"><div className="stat__label">Awaiting payment</div><div className="stat__value">{money(sum('sent'))}</div></div>
        <div className="card card__body"><div className="stat__label">Overdue</div><div className="stat__value neg">{money(sum('overdue'))}</div></div>
      </div>

      <div>
        <div className="tabs" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {l} ({k === 'all' ? rows.length : rows.filter((i) => i.s === k).length})
            </button>
          ))}
        </div>
        <div className="card">
          {shown.length === 0 ? <Empty>No invoices here.</Empty> : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Number</th><th>To</th><th>Issued</th><th>Due</th><th className="num">Amount</th><th className="num">{displayCurrency()}</th><th>Status</th></tr></thead>
                <tbody>
                  {shown.map((i) => (
                    <tr key={i.id} className="clickable" onClick={() => setViewing(i.id)}>
                      <td className="mono">{i.number}</td>
                      <td>{contact(i.contactId)?.name}</td>
                      <td>{date(i.issueDate)}</td>
                      <td>{date(i.dueDate)}</td>
                      <td className="num mono">{amount(invoiceTotal(i), i.currency)}</td>
                      <td className="num">{money(usdOf(i.currency, invoiceTotal(i)))}</td>
                      <td><StatusBadge status={i.s} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && <InvoiceEditor initial={editing} onClose={() => setEditing(null)} onSaved={(id) => { setEditing(null); if (id) setViewing(id); }} />}
      {inv && !editing && <InvoiceView inv={inv} onClose={() => setViewing(null)} onEdit={() => setEditing(inv)} canEdit={edit} />}
    </div>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

function InvoiceEditor({ initial, onClose, onSaved }) {
  const { state, dispatch } = useStore();
  const [inv, setInv] = useState(() =>
    initial.id ? structuredClone(initial) : {
      contactId: state.contacts[0]?.id || '', currency: 'USDC', payToConnectionId: '', issueDate: today(), dueDate: plusDays(30),
      taxRate: 0, notes: '', lines: [{ desc: '', qty: 1, unitPrice: '' }],
    },
  );
  const [newContact, setNewContact] = useState(null);
  const set = (k, v) => setInv((x) => ({ ...x, [k]: v }));
  const setLine = (i, k, v) => setInv((x) => ({ ...x, lines: x.lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)) }));
  const options = payToOptions(state.connections, inv.currency);
  const payTo = options.some((c) => c.id === inv.payToConnectionId) ? inv.payToConnectionId : options[0]?.id || '';
  const draft = { ...inv, payToConnectionId: payTo, lines: inv.lines.map((l) => ({ ...l, qty: Number(l.qty), unitPrice: l.unitPrice === '' ? '' : Number(l.unitPrice) })) };
  const errors = validateInvoice(draft);

  const save = () => {
    dispatch({ type: 'SAVE_INVOICE', invoice: draft });
    onSaved(initial.id || null);
  };
  const addContact = () => {
    const id = 'k-' + Math.random().toString(36).slice(2, 8);
    dispatch({ type: 'ADD_CONTACT', contact: { id, name: newContact.name.trim(), email: newContact.email.trim(), kind: 'customer' } });
    set('contactId', id);
    setNewContact(null);
  };

  return (
    <Modal title={initial.id ? `Edit ${initial.number}` : 'New invoice'} onClose={onClose} wide footer={<>
      <span className="small muted">Total {amount(invoiceTotal(draft), inv.currency)}</span>
      <span className="spacer" />
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={errors.length > 0} onClick={save}>Save draft</button>
    </>}>
      <div className="grid cols-2">
        <label className="field"><span>To (customer)</span>
          {newContact ? (
            <div className="stack" style={{ marginTop: 0 }}>
              <input id="nc-name" placeholder="Company name" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
              <input id="nc-email" type="email" placeholder="accounts@customer.com" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
              <div className="row">
                <button className="btn sm primary" type="button" disabled={!newContact.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newContact.email)} onClick={addContact}>Add contact</button>
                <button className="btn sm ghost" type="button" onClick={() => setNewContact(null)}>Cancel</button>
              </div>
            </div>
          ) : (
            <select id="inv-contact" value={inv.contactId} onChange={(e) => (e.target.value === '__new' ? setNewContact({ name: '', email: '' }) : set('contactId', e.target.value))}>
              {state.contacts.map((k) => <option key={k.id} value={k.id}>{k.name} · {k.email}</option>)}
              <option value="__new">+ New contact…</option>
            </select>
          )}
        </label>
        <div className="grid cols-2">
          <label className="field"><span>Issue date</span><input id="inv-issue" type="date" value={inv.issueDate} onChange={(e) => set('issueDate', e.target.value)} /></label>
          <label className="field"><span>Due date</span><input id="inv-due" type="date" value={inv.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></label>
        </div>
      </div>
      <div className="grid cols-2">
        <label className="field"><span>Currency</span>
          <select id="inv-cur" value={inv.currency} onChange={(e) => set('currency', e.target.value)}>
            {['USDC', 'USDT', 'BTC', 'ETH', 'USD', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c} — {ASSETS[c].name}</option>)}
          </select>
        </label>
        <label className="field"><span>Get paid into</span>
          <select id="inv-payto" value={payTo} onChange={(e) => set('payToConnectionId', e.target.value)} disabled={!options.length}>
            {options.length === 0 && <option value="">No account can receive {inv.currency}</option>}
            {options.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.network})</option>)}
          </select>
        </label>
      </div>
      {options.length === 0 && (
        <div className="notice warn small">Connect a bank account in {inv.currency} or a self-custody wallet that holds {inv.currency} to invoice in it. Exchange deposit addresses are not supported yet.</div>
      )}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Description</th><th className="num" style={{ width: 90 }}>Qty</th><th className="num" style={{ width: 140 }}>Unit price</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>
            {inv.lines.map((l, i) => (
              <tr key={i}>
                <td><input id={`line-desc-${i}`} value={l.desc} onChange={(e) => setLine(i, 'desc', e.target.value)} placeholder="What you supplied" /></td>
                <td><input id={`line-qty-${i}`} type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} /></td>
                <td><input id={`line-price-${i}`} type="number" min="0" step="any" value={l.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} /></td>
                <td className="num mono">{lineTotal({ qty: Number(l.qty), unitPrice: Number(l.unitPrice) }).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td>{inv.lines.length > 1 && <button className="btn ghost sm" aria-label="Remove line" onClick={() => set('lines', inv.lines.filter((_, j) => j !== i))}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row">
        <button className="btn sm" onClick={() => set('lines', [...inv.lines, { desc: '', qty: 1, unitPrice: '' }])}>+ Add line</button>
        <span className="spacer" />
        <label className="row small">Tax %<input id="inv-tax" type="number" min="0" step="any" style={{ width: 80 }} value={inv.taxRate} onChange={(e) => set('taxRate', e.target.value)} /></label>
      </div>
      <label className="field"><span>Notes to customer (optional)</span><textarea id="inv-notes" rows={2} value={inv.notes} onChange={(e) => set('notes', e.target.value)} /></label>
      {errors.length > 0 && <div className="notice warn small">{errors.join(' ')}</div>}
    </Modal>
  );
}

function InvoiceView({ inv, onClose, onEdit, canEdit }) {
  const { state, dispatch, me } = useStore();
  const [sending, setSending] = useState(false);
  const [matching, setMatching] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const contact = state.contacts.find((k) => k.id === inv.contactId);
  const payTo = state.connections.find((c) => c.id === inv.payToConnectionId);
  const s = invoiceStatus(inv);
  const paidTx = inv.paidTxId && state.transactions.find((t) => t.id === inv.paidTxId);

  const pdf = () => {
    try {
      downloadInvoicePdf({ inv, org: state.org, contact, payTo });
      setPdfError('');
    } catch (e) {
      setPdfError(`The PDF could not be created: ${e.message}`);
    }
  };

  return (
    <Modal title={`${inv.number} · ${contact?.name}`} onClose={onClose} wide footer={canEdit && <>
      {s === 'draft' && <button className="btn" onClick={onEdit}>Edit</button>}
      {['draft', 'sent', 'overdue'].includes(s) && <ConfirmButton className="btn danger" prompt="Click again to void" onConfirm={() => dispatch({ type: 'VOID_INVOICE', id: inv.id })}>Void</ConfirmButton>}
      <span className="spacer" />
      <button className="btn" onClick={pdf}>Download PDF</button>
      {['sent', 'overdue'].includes(s) && <button className="btn" onClick={() => setMatching(true)}>Mark as paid</button>}
      {s !== 'void' && <button className="btn primary" onClick={() => setSending(true)}>{inv.sentLog.length ? 'Resend' : 'Send'} as PDF</button>}
    </>}>
      <div className="row"><StatusBadge status={s} />{paidTx && <span className="small muted">Matched to ledger receipt of {amount(paidTx.amount, paidTx.asset)} on {date(paidTx.date)}</span>}</div>
      {pdfError && <div className="notice neg small">{pdfError}</div>}

      <div className="invoice-paper">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div><div className="invoice-paper__title">INVOICE</div><div className="mono">{inv.number}</div></div>
          <span className="spacer" />
          <div className="right small"><strong>{state.org.name}</strong><div className="muted">{state.org.address}</div><div className="muted">{state.org.email}</div></div>
        </div>
        <div className="grid cols-3">
          <div><div className="stat__label">Bill to</div><strong>{contact?.name}</strong><div className="muted small">{contact?.email}</div></div>
          <div><div className="stat__label">Issued</div>{date(inv.issueDate)}</div>
          <div><div className="stat__label">Due</div>{date(inv.dueDate)}</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Amount ({inv.currency})</th></tr></thead>
            <tbody>
              {inv.lines.map((l, i) => (
                <tr key={i}><td>{l.desc}</td><td className="num">{l.qty}</td><td className="num">{Number(l.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td><td className="num">{lineTotal(l).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td></tr>
              ))}
              <tr><td colSpan={3} className="num muted">Subtotal</td><td className="num">{amount(invoiceSubtotal(inv), inv.currency)}</td></tr>
              {Number(inv.taxRate) > 0 && <tr><td colSpan={3} className="num muted">Tax {inv.taxRate}%</td><td className="num">{amount(invoiceTax(inv), inv.currency)}</td></tr>}
              <tr><td colSpan={3} className="num"><strong>Total due</strong></td><td className="num"><strong>{amount(invoiceTotal(inv), inv.currency)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        <div className="invoice-paper__pay">
          <strong>How to pay</strong>
          {payToDetails(payTo, inv).map((l) => <div key={l} className="small" style={{ overflowWrap: 'anywhere' }}>{l}</div>)}
        </div>
        {inv.notes && <p className="muted small">{inv.notes}</p>}
      </div>

      {inv.sentLog.length > 0 && (
        <div className="small">
          <strong>Sent</strong>
          {inv.sentLog.map((l) => <div key={l.at} className="muted">{dateTime(l.at)} to {l.to.join(', ')}</div>)}
        </div>
      )}
      {sending && <SendInvoice inv={inv} contact={contact} me={me} onClose={() => setSending(false)} />}
      {matching && <MatchPayment inv={inv} onClose={() => setMatching(false)} />}
    </Modal>
  );
}

function SendInvoice({ inv, contact, me, onClose }) {
  const { dispatch } = useStore();
  const [to, setTo] = useState(contact?.email || '');
  const [copyMe, setCopyMe] = useState(true);
  const [message, setMessage] = useState(`Hello,\n\nPlease find attached invoice ${inv.number} for ${amount(invoiceTotal(inv), inv.currency)}, due ${date(inv.dueDate)}.\n\nThank you.`);
  const [done, setDone] = useState(false);
  const list = to.split(',').map((x) => x.trim()).filter(Boolean);
  const valid = list.length > 0 && list.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  const recipients = copyMe ? [...list, me.email] : list;

  if (done)
    return (
      <Modal title="Invoice sent" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Done</button>}>
        <p>{inv.number} is recorded as sent to {recipients.join(', ')}.</p>
        <div className="notice warn small">Demo: no email actually left this page. In production TRNZND emails each recipient the message with the invoice PDF attached, and tracks delivery.</div>
      </Modal>
    );

  return (
    <Modal title={`Send ${inv.number}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!valid} onClick={() => { dispatch({ type: 'SEND_INVOICE', id: inv.id, to: recipients }); setDone(true); }}>Send with PDF attached</button>
    </>}>
      <label className="field"><span>To (separate several addresses with commas)</span><input id="send-to" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      {!valid && to && <div className="notice warn small">Check the email address format.</div>}
      <label className="row small"><input id="send-copy" type="checkbox" checked={copyMe} onChange={(e) => setCopyMe(e.target.checked)} />Send me a copy ({me.email})</label>
      <label className="field"><span>Message</span><textarea id="send-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <div className="small muted">Attachment: {inv.number}.pdf</div>
    </Modal>
  );
}

function MatchPayment({ inv, onClose }) {
  const { state, dispatch } = useStore();
  const candidates = matchCandidates(inv, state.transactions);
  const [pick, setPick] = useState(candidates.find((c) => c.exact)?.id || '');
  const conn = state.connections.find((c) => c.id === inv.payToConnectionId);
  return (
    <Modal title={`Mark ${inv.number} as paid`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={() => { dispatch({ type: 'MARK_INVOICE_PAID', id: inv.id, txId: pick || null }); onClose(); }}>
        {pick ? 'Match and mark paid' : 'Mark paid without a match'}
      </button>
    </>}>
      <p className="small">Pick the receipt in <strong>{conn?.name}</strong> that settles {amount(invoiceTotal(inv), inv.currency)}. Matching marks it reconciled and links it to this invoice.</p>
      {candidates.length === 0 && <div className="notice small">No unmatched {inv.currency} receipts found in that account yet.</div>}
      {candidates.map((t) => (
        <label key={t.id} className="list-row" style={{ cursor: 'pointer', padding: '8px 0' }}>
          <input type="radio" name="match" checked={pick === t.id} onChange={() => setPick(t.id)} />
          <span>{date(t.date)} · {t.counterparty}</span>
          <span className="spacer" />
          <span className="mono">{amount(t.amount, t.asset)}</span>
          {t.exact && <span className="badge pos">Exact amount</span>}
        </label>
      ))}
      <label className="list-row" style={{ cursor: 'pointer', padding: '8px 0' }}>
        <input type="radio" name="match" checked={pick === ''} onChange={() => setPick('')} />
        <span>Paid elsewhere — don’t link a ledger entry</span>
      </label>
    </Modal>
  );
}
