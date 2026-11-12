import { useEffect, useMemo, useState } from 'react';
import type { Chain, PaymentRequest, RequestKind, Token, Transaction } from '../lib/types';
import { CHAINS, TOKENS } from '../lib/types';
import { addAdjustment, createRequest, deleteRequest, importRequests, nextRequestNumber, removeAdjustment, removeAllocation, saveContact, updateRequest, getState } from '../lib/store';
import { CHAIN_NAMES, CHAIN_STANDARD, isValidAddress, tokenWarning } from '../lib/chains';
import { formatAmount, parseAmount, toDecimalString } from '../lib/amount';
import { addDays, formatDate, todayISO, type DateOrder } from '../lib/dates';
import { outstanding, type RequestStatus, REQUEST_STATUS_LABEL } from '../lib/status';
import { counterpartyOf, uniqueAmount } from '../lib/match';
import { buildRequests, parseCSV, requestTemplateCSV, type RequestImportRow } from '../lib/csv';
import { saveFile } from './save';
import { navigate, toast, useModel } from './hooks';
import { HOSTED } from '../lib/env';
import { Addr, Amount, copyText, Empty, Field, Icon, Modal, Net, QR, RequestBadge, Seg, TxLink } from './kit';
import { askConfirm, askText } from './dialogs';

export function Requests({ openId }: { openId?: string }) {
  const { data, d } = useModel();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | RequestKind>('');
  const [status, setStatus] = useState<'' | 'unpaid' | RequestStatus>('unpaid');
  const [chain, setChain] = useState('');
  const [token, setToken] = useState('');
  const [editing, setEditing] = useState<PaymentRequest | null | 'new'>(openId === 'new' ? 'new' : null);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    if (openId === 'new') setEditing('new');
  }, [openId]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.requests
      .filter((r) => !kind || r.kind === kind)
      .filter((r) => {
        const s = d.requestStatus.get(r.id)!;
        if (!status) return true;
        if (status === 'unpaid') return s === 'open' || s === 'overdue' || s === 'partial';
        return s === status;
      })
      .filter((r) => (!chain || r.chain === chain) && (!token || r.token === token))
      .filter((r) => !needle || [r.number, r.counterparty, r.reference, r.description ?? '', toDecimalString(r.amount)].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number));
  }, [data.requests, d, q, kind, status, chain, token]);

  const totals: Partial<Record<Token, { amount: number; out: number }>> = {};
  for (const r of rows) {
    const t = (totals[r.token] ??= { amount: 0, out: 0 });
    const sign = r.kind === 'payable' && !kind ? -1 : 1;
    t.amount += sign * r.amount;
    t.out += sign * Math.max(0, outstanding(r, d));
  }
  const detail = openId && openId !== 'new' ? data.requests.find((r) => r.id === openId) : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Payment requests</h1>
          <p>Receivables are requests you sent to customers; payables are requests suppliers sent you. Each is settled by one or more on-chain transfers.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setImporting(true)}>
            <Icon name="upload" /> Import CSV
          </button>
          <button className="btn primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> New payment request
          </button>
        </div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search number, counterparty, reference…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search requests" />
        <Seg value={kind} onChange={setKind} options={[{ value: '', label: 'All' }, { value: 'receivable', label: 'Receivables' }, { value: 'payable', label: 'Payables' }]} />
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="unpaid">Unpaid (open, overdue, part paid)</option>
          <option value="">All statuses</option>
          {(Object.keys(REQUEST_STATUS_LABEL) as RequestStatus[]).map((s) => (
            <option key={s} value={s}>
              {REQUEST_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Chain">
          <option value="">All chains</option>
          {CHAINS.map((c) => (
            <option key={c} value={c}>
              {CHAIN_NAMES[c]}
            </option>
          ))}
        </select>
        <select value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token">
          <option value="">USDT + USDC</option>
          {TOKENS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="card table-wrap">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Counterparty</th>
                <th>Type</th>
                <th>Network</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="num">Amount</th>
                <th className="num">Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="click" onClick={() => navigate(`requests/${r.id}`)}>
                  <td style={{ fontWeight: 600 }}>{r.number}</td>
                  <td>
                    {r.counterparty}
                    {r.description && <div className="small faint">{r.description}</div>}
                  </td>
                  <td className="small">{r.kind === 'receivable' ? 'Receivable' : 'Payable'}</td>
                  <td>
                    <Net chain={r.chain} token={r.token} />
                  </td>
                  <td className="small nowrap">{formatDate(r.issueDate)}</td>
                  <td className="small nowrap">{formatDate(r.dueDate)}</td>
                  <td className="num">
                    <Amount value={r.amount} />
                  </td>
                  <td className="num">
                    <Amount value={Math.max(0, outstanding(r, d))} />
                  </td>
                  <td>
                    <RequestBadge status={d.requestStatus.get(r.id)!} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {(Object.entries(totals) as [Token, { amount: number; out: number }][]).map(([t, v]) => (
                <tr key={t}>
                  <td colSpan={6} className="small muted">
                    Total {t} {!kind ? '(receivables minus payables)' : ''}
                  </td>
                  <td className="num">
                    <Amount value={v.amount} token={t} />
                  </td>
                  <td className="num">
                    <Amount value={v.out} token={t} />
                  </td>
                  <td></td>
                </tr>
              ))}
            </tfoot>
          </table>
        ) : (
          <Empty title={data.requests.length ? 'No requests match these filters' : 'No payment requests yet'} action={!data.requests.length && <button className="btn primary" onClick={() => setEditing('new')}>New payment request</button>}>
            {data.requests.length ? 'Try “All statuses”.' : 'Create a request for each invoice you expect to be paid in stablecoins, or import them from your accounting system as CSV.'}
          </Empty>
        )}
      </div>
      {editing && (
        <RequestForm
          existing={editing === 'new' ? undefined : editing}
          onClose={() => {
            setEditing(null);
            if (openId === 'new') navigate('requests');
          }}
          onSaved={(r) => {
            setEditing(null);
            navigate(`requests/${r.id}`);
          }}
        />
      )}
      {detail && <RequestDetail req={detail} onClose={() => navigate('requests')} onEdit={() => setEditing(detail)} />}
      {importing && <ImportRequestsDialog onClose={() => setImporting(false)} />}
    </>
  );
}

// ---------------- create / edit ----------------
export function RequestForm({ existing, prefillFromTx, onClose, onSaved }: { existing?: PaymentRequest; prefillFromTx?: Transaction; onClose: () => void; onSaved?: (r: PaymentRequest) => void }) {
  const { data, d } = useModel();
  const tx = prefillFromTx;
  const locked = !!existing && (d.allocByRequest.get(existing.id)?.length ?? 0) > 0;
  const firstWallet = data.wallets[0];
  const [kind, setKind] = useState<RequestKind>(existing?.kind ?? (tx?.direction === 'out' ? 'payable' : 'receivable'));
  const [contactId, setContactId] = useState(existing?.contactId ?? '');
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '');
  const [saveContactToo, setSaveContactToo] = useState(!existing);
  const [cpAddress, setCpAddress] = useState(existing?.counterpartyAddress ?? (tx ? counterpartyOf(tx) : ''));
  const [chain, setChain] = useState<Chain>(existing?.chain ?? tx?.chain ?? firstWallet?.chain ?? 'TRX');
  const [token, setToken] = useState<Token>(existing?.token ?? tx?.token ?? 'USDT');
  const [walletId, setWalletId] = useState(existing?.walletId ?? tx?.walletId ?? data.wallets.find((w) => w.chain === chain)?.id ?? '');
  const [amount, setAmount] = useState(existing ? toDecimalString(existing.amount) : tx ? toDecimalString(tx.amount) : '');
  const [unique, setUnique] = useState(false);
  const [issueDate, setIssueDate] = useState(existing?.issueDate ?? (tx ? tx.timestamp.slice(0, 10) : todayISO()));
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? (tx ? tx.timestamp.slice(0, 10) : addDays(todayISO(), 14)));
  const [number, setNumber] = useState(existing?.number ?? '');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [touched, setTouched] = useState(false);

  const walletsOnChain = data.wallets.filter((w) => w.chain === chain);
  useEffect(() => {
    if (walletId && !walletsOnChain.some((w) => w.id === walletId)) setWalletId(walletsOnChain[0]?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain]);

  const contact = data.contacts.find((c) => c.id === contactId);
  useEffect(() => {
    if (contact) {
      setCounterparty(contact.name);
      const a = contact.addresses.find((x) => x.chain === chain);
      if (a && !cpAddress) setCpAddress(a.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, chain]);

  const baseAmount = parseAmount(amount);
  const [fingerprint, setFingerprint] = useState<number | null>(null);
  useEffect(() => {
    if (!unique || !baseAmount || baseAmount <= 0) return setFingerprint(null);
    const taken = data.requests.filter((r) => r.chain === chain && r.token === token && !r.voided && outstanding(r, d) > 0).map((r) => r.amount);
    setFingerprint(uniqueAmount(baseAmount, taken));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unique, baseAmount, chain, token]);
  const finalAmount = unique && fingerprint ? fingerprint : baseAmount;

  const numberTaken = number.trim() && data.requests.some((r) => r.id !== existing?.id && r.number.toLowerCase() === number.trim().toLowerCase());
  const errors = {
    counterparty: !counterparty.trim() ? 'Required' : null,
    amount: !finalAmount || finalAmount <= 0 ? 'Enter an amount greater than zero' : null,
    address: cpAddress.trim() && !isValidAddress(chain, cpAddress) ? `Not a valid ${CHAIN_NAMES[chain]} address` : null,
    due: dueDate && dueDate < issueDate ? 'Due date is before the issue date' : null,
    number: numberTaken ? 'This number is already used' : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const warning = tokenWarning(chain, token);

  const save = () => {
    setTouched(true);
    if (hasErrors) return;
    let cid = contactId || undefined;
    if (!cid && saveContactToo && counterparty.trim()) {
      const existingContact = data.contacts.find((c) => c.name.toLowerCase() === counterparty.trim().toLowerCase());
      cid = existingContact?.id ?? saveContact({ name: counterparty.trim(), addresses: cpAddress.trim() ? [{ chain, address: cpAddress.trim() }] : [] }).id;
    } else if (cid && cpAddress.trim() && contact && !contact.addresses.some((a) => a.chain === chain && a.address === cpAddress.trim())) {
      saveContact({ ...contact, addresses: [...contact.addresses, { chain, address: cpAddress.trim() }] });
    }
    const input = {
      kind,
      contactId: cid,
      counterparty: counterparty.trim(),
      counterpartyAddress: cpAddress.trim() || undefined,
      walletId: walletId || undefined,
      chain,
      token,
      amount: finalAmount!,
      issueDate,
      dueDate: dueDate || undefined,
      reference: reference.trim(),
      description: description.trim() || undefined,
    };
    if (existing) {
      updateRequest(existing.id, { ...input, number: number.trim() || existing.number, reference: input.reference || existing.number });
      onSaved?.(getState().requests.find((r) => r.id === existing.id)!);
    } else {
      const r = createRequest({ ...input, number: number.trim() || undefined });
      onSaved?.(r);
    }
    toast(existing ? 'Request updated.' : 'Payment request created.');
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] : null);

  return (
    <Modal
      title={existing ? `Edit ${existing.number}` : tx ? 'New request from transaction' : 'New payment request'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            {existing ? 'Save changes' : tx ? 'Create and match' : 'Create request'}
          </button>
        </>
      }
    >
      {locked && <div className="notice">This request already has payments matched, so its type, chain and token are locked. Unmatch them first to change those.</div>}
      <div className="row between wrap">
        <Seg
          value={kind}
          onChange={(v) => !locked && setKind(v)}
          options={[
            { value: 'receivable', label: 'Receivable (we get paid)' },
            { value: 'payable', label: 'Payable (we pay)' },
          ]}
        />
      </div>
      <div className="grid2">
        <Field label="Contact" hint="Pick a saved contact or type a new name.">
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— New / no contact —</option>
            {data.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={kind === 'receivable' ? 'Customer name' : 'Supplier name'} error={err('counterparty')}>
          <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} disabled={!!contact} placeholder="e.g. Northwind Imports" />
        </Field>
      </div>
      {!contactId && (
        <label className="check small">
          <input type="checkbox" checked={saveContactToo} onChange={(e) => setSaveContactToo(e.target.checked)} /> Save as a contact (remembers their wallet for future matching)
        </label>
      )}
      <div className="grid3">
        <Field label="Chain">
          <select value={chain} onChange={(e) => setChain(e.target.value as Chain)} disabled={locked}>
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {CHAIN_NAMES[c]} ({CHAIN_STANDARD[c]})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Token">
          <select value={token} onChange={(e) => setToken(e.target.value as Token)} disabled={locked}>
            {TOKENS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label={kind === 'receivable' ? 'Receive into' : 'Pay from'} hint={!walletsOnChain.length ? `No ${CHAIN_NAMES[chain]} wallet yet` : undefined}>
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            <option value="">Any of our {CHAIN_NAMES[chain]} wallets</option>
            {walletsOnChain.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {warning && <div className="notice warn small">{warning}</div>}
      <div className="grid2">
        <Field label={`Amount (${token})`} error={err('amount')} hint={unique && fingerprint ? <>Request will be issued for <strong className="mono">{formatAmount(fingerprint)}</strong></> : undefined}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" style={{ fontFamily: 'var(--mono)' }} />
        </Field>
        <Field label={kind === 'receivable' ? 'Customer’s paying wallet (optional)' : 'Supplier’s receiving wallet'} error={err('address')} hint={kind === 'receivable' ? 'Improves automatic matching.' : 'Where the payment must be sent.'}>
          <input value={cpAddress} onChange={(e) => setCpAddress(e.target.value)} placeholder={chain === 'ETH' ? '0x…' : chain === 'TRX' ? 'T…' : 'Base58 address'} style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} />
        </Field>
      </div>
      {!existing && kind === 'receivable' && (
        <label className="check small">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
          Make the amount unique (adds 0.0001–0.0099 so the payment can be identified even without a memo — useful on Ethereum and Tron)
        </label>
      )}
      <div className="grid3">
        <Field label="Issue date">
          <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </Field>
        <Field label="Due date" error={err('due')}>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
        <Field label="Number" error={err('number')} hint={existing ? undefined : 'Leave blank for automatic'}>
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder={existing ? existing.number : nextRequestNumber()} />
        </Field>
      </div>
      <div className="grid2">
        <Field label="Reference" hint="Your invoice number, if different. Matched against memos.">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={number || (existing?.number ?? nextRequestNumber())} />
        </Field>
        <Field label="Description">
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is being paid for" />
        </Field>
      </div>
    </Modal>
  );
}

// ---------------- detail drawer ----------------
function paymentText(r: PaymentRequest, company: string, address: string | undefined, due: number): string {
  return [
    `Payment request ${r.number} from ${company}`,
    `Amount: ${formatAmount(due)} ${r.token}`,
    `Network: ${CHAIN_NAMES[r.chain]} (${CHAIN_STANDARD[r.chain]}). Send ${r.token} on ${CHAIN_NAMES[r.chain]} only.`,
    address ? `Address: ${address}` : 'Address: (to be confirmed)',
    `Reference: ${r.reference}${r.chain === 'SOL' ? ' (add as memo)' : ''}`,
    r.dueDate ? `Due: ${r.dueDate}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function RequestDetail({ req, onClose, onEdit }: { req: PaymentRequest; onClose: () => void; onEdit: () => void }) {
  const { data, d } = useModel();
  const status = d.requestStatus.get(req.id)!;
  const allocs = d.allocByRequest.get(req.id) ?? [];
  const adjs = d.adjByRequest.get(req.id) ?? [];
  const out = outstanding(req, d);
  const wallet = data.wallets.find((w) => w.id === req.walletId) ?? data.wallets.find((w) => w.chain === req.chain);
  const payTo = req.kind === 'receivable' ? wallet?.address : req.counterpartyAddress;
  const warning = tokenWarning(req.chain, req.token);
  const contactAddrs = (data.contacts.find((c) => c.id === req.contactId)?.addresses ?? []).filter((a) => a.chain === req.chain).map((a) => a.address);
  const pct = req.amount ? Math.min(100, Math.round(((d.settled.get(req.id) ?? 0) / req.amount) * 100)) : 0;
  return (
    <Modal
      drawer
      title={
        <span className="row">
          {req.number} <RequestBadge status={status} />
        </span>
      }
      onClose={onClose}
      footer={
        <>
          {!allocs.length && (
            <button
              className="btn danger sm"
              onClick={async () => {
                if (!(await askConfirm(`Delete ${req.number}? This cannot be undone.`, { title: 'Delete request', confirmLabel: 'Delete', danger: true }))) return;
                deleteRequest(req.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <button className="btn sm" onClick={() => updateRequest(req.id, { voided: !req.voided })}>
            {req.voided ? 'Reinstate' : 'Void'}
          </button>
          <span className="grow" />
          <a className="btn sm" href={`#/requests/${req.id}/print`}>
            <Icon name="print" /> Print / PDF
          </a>
          <button className="btn sm primary" onClick={onEdit}>
            Edit
          </button>
        </>
      }
    >
      <div className="stack tight">
        <div className="row between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 650 }}>{req.counterparty}</div>
            <div className="small muted">
              {req.kind === 'receivable' ? 'Receivable' : 'Payable'} · issued {formatDate(req.issueDate)}
              {req.dueDate ? ` · due ${formatDate(req.dueDate)}` : ''}
            </div>
          </div>
          <Net chain={req.chain} token={req.token} long />
        </div>
        {req.description && <p className="muted">{req.description}</p>}
      </div>
      <div className="grid3">
        <div className="card stat">
          <span className="stat-label">Amount</span>
          <Amount value={req.amount} token={req.token} />
        </div>
        <div className="card stat">
          <span className="stat-label">Settled</span>
          <Amount value={d.settled.get(req.id) ?? 0} token={req.token} />
        </div>
        <div className="card stat">
          <span className="stat-label">{out < 0 ? 'Overpaid' : 'Outstanding'}</span>
          <Amount value={Math.abs(out)} token={req.token} />
        </div>
      </div>
      <div className="progress" aria-label={`${pct}% settled`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {warning && <div className="notice warn small">{warning}</div>}

      {out > 0 && !req.voided && (
        <div className="stack tight">
          <h3>{req.kind === 'receivable' ? 'Payment instructions' : 'Pay this request'}</h3>
          {payTo ? (
            <div className="pay-box">
              <div className="stack tight" style={{ minWidth: 0 }}>
                <span className="small muted">
                  Send exactly <strong className="mono">{formatAmount(out)} {req.token}</strong> on {CHAIN_NAMES[req.chain]} ({CHAIN_STANDARD[req.chain]}) to
                </span>
                <span className="mono" style={{ overflowWrap: 'anywhere' }}>
                  {payTo}
                </span>
                <span className="small muted">
                  {req.chain === 'SOL'
                    ? `Ask the payer to add “${req.reference}” as the memo.`
                    : 'ERC-20 and TRC-20 transfers usually carry no memo, so the exact amount and the payer’s wallet identify this payment.'}
                </span>
                <div className="row" style={{ marginTop: 6 }}>
                  <button
                    className="btn xs"
                    onClick={() => {
                      copyText(paymentText(req, data.settings.companyName, payTo, out));
                      toast('Payment instructions copied.');
                    }}
                  >
                    <Icon name="copy" /> Copy instructions
                  </button>
                </div>
              </div>
              <QR text={payTo} size={120} />
            </div>
          ) : (
            <div className="notice small">{req.kind === 'receivable' ? 'Add a wallet on this chain to show where the customer should pay.' : 'Add the supplier’s receiving wallet (Edit) to show where to pay.'}</div>
          )}
        </div>
      )}

      <div className="stack tight">
        <div className="row between">
          <h3>Settlement history</h3>
          {out > 0 && !req.voided && (
            <button
              className="btn xs"
              onClick={async () => {
                const reason = await askText(`Write off the remaining ${formatAmount(out)} ${req.token} on ${req.number}. The reason is kept in the audit trail.`, { title: 'Write off balance', label: 'Reason', defaultValue: 'Short payment / bank or exchange fee', confirmLabel: 'Write off' });
                if (reason) addAdjustment(req.id, out, reason);
              }}
            >
              Write off balance
            </button>
          )}
        </div>
        <div className="card table-wrap">
          <table>
            <tbody>
              {allocs.map((a) => {
                const t = d.txById.get(a.txId);
                return (
                  <tr key={a.id}>
                    <td className="small nowrap">{t ? formatDate(t.timestamp, true) : '—'}</td>
                    <td className="small">{t && <TxLink chain={t.chain} hash={t.hash} demo={t.source === 'demo'} />}</td>
                    <td className="small muted">{a.method}</td>
                    <td className="num">
                      <Amount value={a.amount} />
                    </td>
                    <td className="right">
                      <button className="btn xs ghost" onClick={() => removeAllocation(a.id)}>
                        Unmatch
                      </button>
                    </td>
                  </tr>
                );
              })}
              {adjs.map((a) => (
                <tr key={a.id}>
                  <td className="small nowrap">{formatDate(a.createdAt, true)}</td>
                  <td className="small" colSpan={2}>
                    Write-off · <span className="muted">{a.reason}</span>
                  </td>
                  <td className="num">
                    <Amount value={a.amount} />
                  </td>
                  <td className="right">
                    <button className="btn xs ghost" onClick={() => removeAdjustment(a.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!allocs.length && !adjs.length && (
                <tr>
                  <td className="muted small">No payments matched yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <dl className="kv">
        <dt>Reference</dt>
        <dd className="mono">{req.reference}</dd>
        <dt>Our wallet</dt>
        <dd>{wallet ? <Addr chain={wallet.chain} address={wallet.address} label={wallet.label} link={!wallet.demo} /> : '—'}</dd>
        <dt>{req.kind === 'receivable' ? 'Payer wallet' : 'Supplier wallet'}</dt>
        <dd>
          {req.counterpartyAddress ? (
            <Addr chain={req.chain} address={req.counterpartyAddress} link={!wallet?.demo} />
          ) : contactAddrs.length ? (
            <span className="stack tight">
              {contactAddrs.map((a) => (
                <span key={a}>
                  <Addr chain={req.chain} address={a} link={!wallet?.demo} /> <span className="small faint">from contact</span>
                </span>
              ))}
            </span>
          ) : (
            <span className="faint">Not set</span>
          )}
        </dd>
        <dt>Created</dt>
        <dd className="small">{formatDate(req.createdAt, true)}</dd>
      </dl>
    </Modal>
  );
}

// ---------------- printable request ----------------
export function PrintRequest({ id }: { id: string }) {
  const { data, d } = useModel();
  const req = data.requests.find((r) => r.id === id);
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    return () => {
      document.documentElement.dataset.theme = getState().settings.theme;
    };
  }, []);
  if (!req) return <Empty title="Request not found" action={<a href="#/requests">Back to requests</a>} />;
  const wallet = data.wallets.find((w) => w.id === req.walletId) ?? data.wallets.find((w) => w.chain === req.chain);
  const payTo = req.kind === 'receivable' ? wallet?.address : req.counterpartyAddress;
  const out = Math.max(0, outstanding(req, d));
  const warning = tokenWarning(req.chain, req.token);
  return (
    <div className="print-page">
      <div className="print-actions">
        <button
          className="btn primary"
          onClick={() => {
            try {
              window.print();
            } catch {
              toast('Printing is not available in this view.', 'error');
            }
          }}
        >
          <Icon name="print" /> Print or save as PDF
        </button>
        {HOSTED && <span className="small" style={{ color: '#4b5563', alignSelf: 'center' }}>Printing may be blocked in this hosted preview; it works when the app runs on its own.</span>}
        <a className="btn" href={`#/requests/${req.id}`}>
          Back
        </a>
      </div>
      <div className="print-sheet">
        <div className="bar" />
        <div className="row between top">
          <div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{req.kind === 'receivable' ? 'Payment request' : 'Payment record'}</div>
            <div style={{ color: '#4b5563' }}>{data.settings.companyName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{req.number}</div>
            <div style={{ color: '#4b5563' }}>Issued {formatDate(req.issueDate)}</div>
            {req.dueDate && <div style={{ color: '#4b5563' }}>Due {formatDate(req.dueDate)}</div>}
          </div>
        </div>
        <div>
          <div style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>{req.kind === 'receivable' ? 'Billed to' : 'Payee'}</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{req.counterparty}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{req.description || `Reference ${req.reference}`}</td>
              <td className="num mono">
                {formatAmount(req.amount)} {req.token}
              </td>
            </tr>
            {req.amount !== out && (
              <tr>
                <td>Already received</td>
                <td className="num mono">
                  −{formatAmount(req.amount - out)} {req.token}
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td>Amount due</td>
              <td className="num mono" style={{ fontSize: 16 }}>
                {formatAmount(out)} {req.token}
              </td>
            </tr>
          </tfoot>
        </table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
          <div className="stack tight">
            <div style={{ fontWeight: 650 }}>
              Pay in {req.token} on {CHAIN_NAMES[req.chain]} ({CHAIN_STANDARD[req.chain]}) only
            </div>
            <div className="mono">{payTo ?? 'Receiving address to be confirmed'}</div>
            <div style={{ color: '#4b5563', fontSize: 13 }}>
              Sending a different token, or using a different network, may result in permanent loss of funds. Send the exact amount shown{req.chain === 'SOL' ? ` and include “${req.reference}” as the memo` : ''}. Quote reference <strong>{req.reference}</strong> in any correspondence.
            </div>
            {warning && <div style={{ color: '#9a5b00', fontSize: 13 }}>{warning}</div>}
          </div>
          {payTo && <QR text={payTo} size={140} />}
        </div>
        <div style={{ color: '#9ca3af', fontSize: 12 }}>Generated by Settlement Ledger on {formatDate(new Date().toISOString(), true)}.</div>
      </div>
    </div>
  );
}

// ---------------- CSV import ----------------
function ImportRequestsDialog({ onClose }: { onClose: () => void }) {
  const { data } = useModel();
  const [rows, setRows] = useState<RequestImportRow[] | null>(null);
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');
  const [raw, setRaw] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState('');
  useEffect(() => {
    if (raw) setRows(buildRequests(raw, data.wallets, dateOrder));
  }, [raw, dateOrder, data.wallets]);
  const valid = rows?.filter((r) => r.input) ?? [];
  const bad = rows?.filter((r) => r.error) ?? [];
  const onFile = async (f: File) => {
    setFileName(f.name);
    const parsed = parseCSV(await f.text());
    setRaw(parsed.rows);
  };
  return (
    <Modal
      title="Import payment requests"
      wide
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => void saveFile('payment-requests-template.csv', requestTemplateCSV())}>
            <Icon name="download" /> Template
          </button>
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!valid.length}
            onClick={() => {
              const res = importRequests(valid.map((r) => r.input!));
              toast(`${res.added} request${res.added === 1 ? '' : 's'} imported${res.duplicates.length ? `, ${res.duplicates.length} skipped (number already exists)` : ''}.`);
              onClose();
            }}
          >
            Import {valid.length || ''}
          </button>
        </>
      }
    >
      <p className="small muted">
        Columns (header row, any order): <span className="mono">number, kind, counterparty, counterparty_address, chain, token, amount, issue_date, due_date, reference, description</span>. Kind is <em>receivable</em> or <em>payable</em>; chain is ETH, SOL or TRX (or Ethereum / Solana / Tron); amounts are in tokens, e.g. 1250.00.
      </p>
      <div className="row wrap">
        <FilePick onFile={onFile} label={fileName || 'Choose a CSV file'} />
        <Field label="Dates like 03/04/2026 are" style={{ width: 220 }}>
          <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
            <option value="auto">Unambiguous only</option>
            <option value="dmy">Day / month / year</option>
            <option value="mdy">Month / day / year</option>
          </select>
        </Field>
      </div>
      {rows && (
        <>
          <div className={`notice ${bad.length ? 'warn' : 'ok'} small`}>
            {valid.length} ready to import{bad.length ? `, ${bad.length} with problems (not imported)` : ''}.
          </div>
          <div className="card table-wrap" style={{ maxHeight: 320 }}>
            <table>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Number</th>
                  <th>Counterparty</th>
                  <th>Network</th>
                  <th className="num">Amount</th>
                  <th>Problem</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.line}>
                    <td className="small faint">{r.line}</td>
                    <td>{r.input?.number ?? ''}</td>
                    <td>{r.input?.counterparty ?? ''}</td>
                    <td>{r.input && <Net chain={r.input.chain} token={r.input.token} />}</td>
                    <td className="num">{r.input && <Amount value={r.input.amount} />}</td>
                    <td className="small" style={{ color: 'var(--out)' }}>
                      {r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

export function FilePick({ onFile, label, accept = '.csv,text/csv' }: { onFile: (f: File) => void; label: string; accept?: string }) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`dropzone grow ${over ? 'over' : ''}`}
      onDragOver={(e) => (e.preventDefault(), setOver(true))}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
    >
      <input type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      <Icon name="upload" size={18} /> {label}
      <div className="small faint">Drop a file here or click to choose</div>
    </label>
  );
}
