import { useMemo, useState } from 'react';
import type { PaymentRequest, Transaction, TxCategory } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import { allocate, applySuggestions, categorize, unmatchTransaction } from '../lib/store';
import { autoMatchPlan, counterpartyOf, eligible, toleranceFor, type Suggestion } from '../lib/match';
import { outstanding, txRemaining, needsReconciliation } from '../lib/status';
import { formatAmount, parseAmount, toDecimalString } from '../lib/amount';
import { formatDate } from '../lib/dates';
import { nameResolver } from '../lib/names';
import { navigate, toast, useModel, type Model } from './hooks';
import { Addr, Amount, ConfidenceBadge, DirIcon, Empty, Field, Icon, Modal, Net, TxLink } from './kit';
import { RequestForm } from './Requests';
import { askConfirm } from './dialogs';

type Tab = 'todo' | 'done' | 'internal';

export function Reconcile() {
  const model = useModel();
  const { data, d, suggestions } = model;
  const [tab, setTab] = useState<Tab>('todo');
  const [wallet, setWallet] = useState('');
  const [chain, setChain] = useState('');
  const [token, setToken] = useState('');
  const [dir, setDir] = useState('');
  const [q, setQ] = useState('');
  const [matchTx, setMatchTx] = useState<{ tx: Transaction; initial?: Suggestion } | null>(null);
  const [explainTx, setExplainTx] = useState<Transaction | null>(null);
  const [createFor, setCreateFor] = useState<Transaction | null>(null);
  const names = useMemo(() => nameResolver(data), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.transactions
      .filter((t) => (!wallet || t.walletId === wallet) && (!chain || t.chain === chain) && (!token || t.token === token) && (!dir || t.direction === dir))
      .filter((t) => {
        if (!needle) return true;
        const cp = names(t.chain, counterpartyOf(t)) ?? '';
        return [t.hash, t.from, t.to, t.memo ?? '', cp, toDecimalString(t.amount)].some((s) => s.toLowerCase().includes(needle));
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [data.transactions, wallet, chain, token, dir, q, names]);

  const todo = filtered.filter((t) => needsReconciliation(t, d.txStatus.get(t.id) ?? 'unmatched'));
  const done = filtered.filter((t) => t.direction !== 'internal' && !needsReconciliation(t, d.txStatus.get(t.id) ?? 'unmatched'));
  const internal = filtered.filter((t) => t.direction === 'internal');
  const plan = autoMatchPlan(data, d);

  const quickMatch = (tx: Transaction, s: Suggestion) => {
    // Shortfall or overpayment: review in the match dialog so the difference is handled explicitly.
    const needsReview = s.allocations.some((a) => {
      const r = d.requestById.get(a.requestId)!;
      return a.amount !== outstanding(r, d);
    });
    if (needsReview) return setMatchTx({ tx, initial: s });
    try {
      allocate(tx.id, s.allocations, 'manual');
      toast(`Matched to ${s.allocations.map((a) => d.requestById.get(a.requestId)?.number).join(', ')}`);
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reconcile</h1>
          <p>Match each on-chain transfer to the payment request(s) it settles, or explain it. Suggestions use amount, wallet, memo reference and dates.</p>
        </div>
        <button
          className="btn primary"
          disabled={!plan.length}
          onClick={async () => {
            if (!(await askConfirm(`Apply ${plan.length} high-confidence match${plan.length === 1 ? '' : 'es'}? You can undo any of them from the Reconciled tab.`, { title: 'Auto-match', confirmLabel: 'Apply matches' }))) return;
            const n = applySuggestions(plan);
            toast(`${n} transaction${n === 1 ? '' : 's'} auto-matched.`);
          }}
          title="Applies only unambiguous high-confidence suggestions"
        >
          <Icon name="bolt" /> Auto-match {plan.length || ''}
        </button>
      </div>

      <div className="toolbar">
        <input type="search" placeholder="Search hash, address, memo, amount…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select value={wallet} onChange={(e) => setWallet(e.target.value)} aria-label="Wallet">
          <option value="">All wallets</option>
          {data.wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
        <select value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Chain">
          <option value="">All chains</option>
          <option value="ETH">Ethereum</option>
          <option value="SOL">Solana</option>
          <option value="TRX">Tron</option>
        </select>
        <select value={token} onChange={(e) => setToken(e.target.value)} aria-label="Token">
          <option value="">USDT + USDC</option>
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
        </select>
        <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Direction">
          <option value="">In and out</option>
          <option value="in">Received</option>
          <option value="out">Sent</option>
        </select>
      </div>

      <div className="tabs" role="tablist">
        <button className={`tab ${tab === 'todo' ? 'on' : ''}`} onClick={() => setTab('todo')} role="tab">
          To reconcile <span className="nav-count">{todo.length}</span>
        </button>
        <button className={`tab ${tab === 'done' ? 'on' : ''}`} onClick={() => setTab('done')} role="tab">
          Reconciled <span className="nav-count">{done.length}</span>
        </button>
        <button className={`tab ${tab === 'internal' ? 'on' : ''}`} onClick={() => setTab('internal')} role="tab">
          Internal transfers <span className="nav-count">{internal.length}</span>
        </button>
      </div>

      {tab === 'todo' && (
        <div>
          {!todo.length && (
            <div className="card">
              <Empty title={data.transactions.length ? 'All caught up' : 'No transactions yet'} action={!data.transactions.length && <a className="btn" href="#/transactions">Import or sync transactions</a>}>
                {data.transactions.length ? 'Every transaction in this view is matched or explained.' : 'Sync your wallets or import a CSV, then come back to match them.'}
              </Empty>
            </div>
          )}
          {todo.map((t) => (
            <RecRow
              key={t.id}
              tx={t}
              model={model}
              names={names}
              suggestion={suggestions.get(t.id)?.[0]}
              alternatives={(suggestions.get(t.id)?.length ?? 1) - 1}
              onMatch={(s) => quickMatch(t, s)}
              onFind={() => setMatchTx({ tx: t })}
              onExplain={() => setExplainTx(t)}
              onCreate={() => setCreateFor(t)}
            />
          ))}
        </div>
      )}

      {tab === 'done' && <DoneTable txs={done} model={model} names={names} />}
      {tab === 'internal' && <DoneTable txs={internal} model={model} names={names} internal />}

      {matchTx && <MatchDialog tx={matchTx.tx} initial={matchTx.initial} onClose={() => setMatchTx(null)} />}
      {explainTx && <ExplainDialog tx={explainTx} onClose={() => setExplainTx(null)} />}
      {createFor && (
        <RequestForm
          prefillFromTx={createFor}
          onClose={() => setCreateFor(null)}
          onSaved={(req) => {
            try {
              allocate(createFor.id, [{ requestId: req.id, amount: Math.min(createFor.amount, req.amount) }], 'manual');
              toast(`${req.number} created and matched.`);
            } catch (e) {
              toast((e as Error).message, 'error');
            }
            setCreateFor(null);
          }}
        />
      )}
    </>
  );
}

function RecRow({ tx, model, names, suggestion, alternatives, onMatch, onFind, onExplain, onCreate }: {
  tx: Transaction;
  model: Model;
  names: ReturnType<typeof nameResolver>;
  suggestion?: Suggestion;
  alternatives: number;
  onMatch: (s: Suggestion) => void;
  onFind: () => void;
  onExplain: () => void;
  onCreate: () => void;
}) {
  const { data, d } = model;
  const cp = counterpartyOf(tx);
  const wallet = data.wallets.find((w) => w.id === tx.walletId);
  const rem = txRemaining(tx, d);
  return (
    <div className="rec-row" data-testid="rec-row">
      <div className="rec-side">
        <div className="row between">
          <div className="row">
            <DirIcon dir={tx.direction} />
            <span className="rec-amount">
              <Amount value={tx.amount} token={tx.token} dir={tx.direction} />
            </span>
          </div>
          <Net chain={tx.chain} />
        </div>
        <div className="small muted">
          {formatDate(tx.timestamp, true)} · {wallet?.label ?? 'Unknown wallet'}
        </div>
        <div className="small">
          {tx.direction === 'in' ? 'From ' : 'To '}
          <Addr chain={tx.chain} address={cp} label={names(tx.chain, cp)} link={tx.source !== 'demo'} />
        </div>
        {tx.memo && (
          <div className="small">
            Memo: <span className="mono">{tx.memo}</span>
          </div>
        )}
        <div className="row small faint">
          <TxLink chain={tx.chain} hash={tx.hash} demo={tx.source === 'demo'} />
          {rem !== tx.amount && <span className="badge tone-violet">{formatAmount(rem)} left to allocate</span>}
        </div>
      </div>
      <div className="rec-mid">
        <Icon name="arrow" size={20} />
      </div>
      <div className={`rec-side ${suggestion ? `suggest ${suggestion.confidence}` : 'none'}`}>
        {suggestion ? (
          <>
            <div className="row between">
              <div className="stack tight">
                {suggestion.allocations.map((a) => {
                  const r = d.requestById.get(a.requestId)!;
                  return (
                    <div key={a.requestId}>
                      <a href={`#/requests/${r.id}`} style={{ fontWeight: 650 }}>
                        {r.number}
                      </a>{' '}
                      <span className="muted">· {r.counterparty}</span>
                      <div className="small muted">
                        Due <Amount value={outstanding(r, d)} token={r.token} /> {r.dueDate ? `by ${formatDate(r.dueDate)}` : ''} · issued {formatDate(r.issueDate)}
                      </div>
                    </div>
                  );
                })}
              </div>
              <ConfidenceBadge c={suggestion.confidence} />
            </div>
            <div className="reasons">
              {suggestion.reasons.map((r) => (
                <span key={r} className={`chip ${/before|Different|after|exceeds|Short|Over/i.test(r) ? 'bad' : /Exact|Reference|Known|Unique|All from/i.test(r) ? 'good' : ''}`}>
                  {r}
                </span>
              ))}
            </div>
            <div className="row wrap" style={{ marginTop: 'auto' }}>
              <button className="btn sm primary" onClick={() => onMatch(suggestion)}>
                Match
              </button>
              <button className="btn sm" onClick={onFind}>
                Find request{alternatives > 0 ? ` (${alternatives} other)` : ''}
              </button>
              <button className="btn sm ghost" onClick={onExplain}>
                Explain…
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600 }}>No matching payment request found</div>
            <p className="small muted">
              {tx.direction === 'in' ? 'If this is a customer payment, create the request now or find one manually.' : 'If this pays a supplier, log their request or find it manually.'} Otherwise explain it (refund, fee, exchange movement…).
            </p>
            <div className="row wrap" style={{ marginTop: 'auto' }}>
              <button className="btn sm" onClick={onFind}>
                Find request
              </button>
              <button className="btn sm" onClick={onCreate}>
                <Icon name="plus" /> Create request
              </button>
              <button className="btn sm ghost" onClick={onExplain}>
                Explain…
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DoneTable({ txs, model, names, internal }: { txs: Transaction[]; model: Model; names: ReturnType<typeof nameResolver>; internal?: boolean }) {
  const { data, d } = model;
  if (!txs.length)
    return (
      <div className="card">
        <Empty title={internal ? 'No internal transfers' : 'Nothing reconciled yet'}>{internal ? 'Transfers between two of your own wallets appear here and need no request.' : 'Matched and explained transactions appear here.'}</Empty>
      </div>
    );
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Network</th>
            <th className="num">Amount</th>
            <th>{internal ? 'From → To' : 'Counterparty'}</th>
            <th>{internal ? 'Hash' : 'Matched to'}</th>
            {!internal && <th></th>}
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => {
            const allocs = d.allocByTx.get(t.id) ?? [];
            const cp = counterpartyOf(t);
            return (
              <tr key={t.id} className="click" onClick={() => navigate(`transactions/${encodeURIComponent(t.id)}`)}>
                <td className="nowrap small">{formatDate(t.timestamp, true)}</td>
                <td>
                  <Net chain={t.chain} token={t.token} />
                </td>
                <td className="num">
                  <Amount value={t.amount} dir={internal ? undefined : t.direction} />
                </td>
                <td className="small">
                  {internal ? (
                    <>
                      {names(t.chain, t.from) ?? shortTxt(t.from)} → {names(t.chain, t.to) ?? shortTxt(t.to)}
                    </>
                  ) : (
                    names(t.chain, cp) ?? <span className="mono">{shortTxt(cp)}</span>
                  )}
                </td>
                <td className="small">
                  {internal ? (
                    <TxLink chain={t.chain} hash={t.hash} demo={t.source === 'demo'} />
                  ) : (
                    <div className="stack tight">
                      {allocs.map((a) => {
                        const r = d.requestById.get(a.requestId);
                        return (
                          <span key={a.id}>
                            <a href={`#/requests/${a.requestId}`} onClick={(e) => e.stopPropagation()}>
                              {r?.number}
                            </a>{' '}
                            <span className="muted">
                              {formatAmount(a.amount)} · {a.method}
                            </span>
                          </span>
                        );
                      })}
                      {t.category && <span className="chip">{CATEGORY_LABELS[t.category]}{t.note ? ` — ${t.note}` : ''}</span>}
                    </div>
                  )}
                </td>
                {!internal && (
                  <td className="right">
                    <button
                      className="btn xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (allocs.length) unmatchTransaction(t.id);
                        if (t.category) categorize(t.id, undefined);
                        toast('Moved back to “To reconcile”.');
                      }}
                    >
                      Undo
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="small faint" style={{ padding: '8px 12px' }}>
        {data.transactions.length} transactions in total.
      </div>
    </div>
  );
}

const shortTxt = (a: string) => (a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

// ---------------- manual match ----------------
export function MatchDialog({ tx, initial, onClose }: { tx: Transaction; initial?: Suggestion; onClose: () => void }) {
  const { data, d } = useModel();
  const rem = txRemaining(tx, d);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.allocations ?? []).map((a) => [a.requestId, toDecimalString(a.amount)])),
  );
  // Pre-tick the write-off for suggested allocations that leave only a within-tolerance shortfall.
  const [writeOff, setWriteOff] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const a of initial?.allocations ?? []) {
      const r = d.requestById.get(a.requestId);
      if (!r) continue;
      const short = outstanding(r, d) - a.amount;
      if (short > 0 && short <= toleranceFor(r.amount, data)) init[a.requestId] = true;
    }
    return init;
  });
  const [remainderCat, setRemainderCat] = useState<TxCategory | ''>('');
  const [q, setQ] = useState('');
  const [anyWallet, setAnyWallet] = useState(false);

  const candidates = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.requests
      .filter((r) => r.id in amounts || eligible(tx, r, d) || (anyWallet && eligible(tx, { ...r, walletId: undefined }, d)))
      .filter((r) => !needle || [r.number, r.counterparty, r.reference, r.description ?? '', toDecimalString(r.amount)].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  }, [data.requests, tx, d, q, anyWallet, amounts]);

  const parsed = Object.entries(amounts).map(([id, s]) => ({ requestId: id, amount: parseAmount(s) ?? NaN }));
  const total = parsed.reduce((a, x) => a + (Number.isFinite(x.amount) ? x.amount : 0), 0);
  const left = rem - total;
  const invalid = parsed.some((p) => !Number.isFinite(p.amount) || p.amount <= 0) || left < 0 || !parsed.length;

  const toggle = (r: PaymentRequest) => {
    setAmounts((prev) => {
      const next = { ...prev };
      if (r.id in next) delete next[r.id];
      else {
        const used = Object.values(prev).reduce((a, s) => a + (parseAmount(s) ?? 0), 0);
        const fill = Math.max(0, Math.min(rem - used, outstanding(r, d)));
        next[r.id] = toDecimalString(fill);
        const short = outstanding(r, d) - fill;
        if (short > 0 && short <= toleranceFor(r.amount, data)) setWriteOff((w) => ({ ...w, [r.id]: true }));
      }
      return next;
    });
  };

  const save = () => {
    try {
      const writeOffs = parsed
        .map((p) => {
          const r = d.requestById.get(p.requestId)!;
          const short = outstanding(r, d) - p.amount;
          return writeOff[p.requestId] && short > 0 ? { requestId: p.requestId, amount: short, reason: 'Short payment written off at reconciliation' } : null;
        })
        .filter(Boolean) as { requestId: string; amount: number; reason: string }[];
      allocate(tx.id, parsed, 'manual', writeOffs);
      if (left > 0 && remainderCat) categorize(tx.id, remainderCat);
      toast('Transaction matched.');
      onClose();
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <Modal
      title="Match to payment requests"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="grow small muted">
            Allocating <strong>{formatAmount(total)}</strong> of {formatAmount(rem)} {tx.token}
            {left > 0 ? ` · ${formatAmount(left)} left` : left < 0 ? ` · over by ${formatAmount(-left)}` : ''}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={invalid} onClick={save}>
            Confirm match
          </button>
        </>
      }
    >
      <div className="pay-box" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="stack tight">
          <div className="row">
            <DirIcon dir={tx.direction} />
            <strong>
              <Amount value={tx.amount} token={tx.token} dir={tx.direction} />
            </strong>
            <Net chain={tx.chain} />
          </div>
          <span className="small muted">
            {formatDate(tx.timestamp, true)} · {tx.direction === 'in' ? 'from' : 'to'} <span className="mono">{counterpartyOf(tx)}</span>
            {tx.memo ? ` · memo “${tx.memo}”` : ''}
          </span>
        </div>
        <span className="small muted">{rem !== tx.amount ? `${formatAmount(rem)} unallocated` : ''}</span>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search number, counterparty, amount…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 300 }} />
        <label className="check">
          <input type="checkbox" checked={anyWallet} onChange={(e) => setAnyWallet(e.target.checked)} /> Include requests assigned to other wallets
        </label>
      </div>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Request</th>
              <th>Issued / due</th>
              <th className="num">Outstanding</th>
              <th className="num" style={{ width: 170 }}>
                Allocate
              </th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((r) => {
              const on = r.id in amounts;
              const amt = parseAmount(amounts[r.id] ?? '');
              const out = outstanding(r, d);
              const short = on && amt !== null ? out - amt : 0;
              return (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" checked={on} onChange={() => toggle(r)} aria-label={`Select ${r.number}`} />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.number}</div>
                    <div className="small muted">
                      {r.counterparty}
                      {r.description ? ` · ${r.description}` : ''}
                    </div>
                    {on && short > 0 && (
                      <label className="check small" style={{ marginTop: 4 }}>
                        <input type="checkbox" checked={!!writeOff[r.id]} onChange={(e) => setWriteOff((w) => ({ ...w, [r.id]: e.target.checked }))} />
                        Write off remaining {formatAmount(short)} {short <= toleranceFor(r.amount, data) ? '(within tolerance)' : ''}
                      </label>
                    )}
                    {on && short < 0 && <div className="small" style={{ color: 'var(--out)' }}>Overpays this request by {formatAmount(-short)}</div>}
                  </td>
                  <td className="small muted nowrap">
                    {formatDate(r.issueDate)}
                    <br />
                    {r.dueDate ? `due ${formatDate(r.dueDate)}` : ''}
                  </td>
                  <td className="num">
                    <Amount value={out} token={r.token} />
                  </td>
                  <td className="num">
                    <input
                      value={amounts[r.id] ?? ''}
                      disabled={!on}
                      inputMode="decimal"
                      onChange={(e) => setAmounts((p) => ({ ...p, [r.id]: e.target.value }))}
                      style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}
                      aria-label={`Amount for ${r.number}`}
                    />
                  </td>
                </tr>
              );
            })}
            {!candidates.length && (
              <tr>
                <td colSpan={5} className="muted">
                  No open {tx.direction === 'in' ? 'receivable' : 'payable'} requests in {tx.token} on this chain. Create one from the Reconcile screen, or explain the transaction instead.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {left > 0 && total > 0 && (
        <Field label={`Explain the unallocated ${formatAmount(left)} ${tx.token} (optional)`} hint="Without an explanation the transaction stays “Part allocated” in To reconcile.">
          <select value={remainderCat} onChange={(e) => setRemainderCat(e.target.value as TxCategory | '')}>
            <option value="">Leave unexplained</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
      )}
    </Modal>
  );
}

export function ExplainDialog({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const [cat, setCat] = useState<TxCategory | ''>(tx.category ?? (tx.direction === 'internal' ? 'internal' : ''));
  const [note, setNote] = useState(tx.note ?? '');
  return (
    <Modal
      title="Explain transaction"
      onClose={onClose}
      footer={
        <>
          {tx.category && (
            <button
              className="btn danger"
              onClick={() => {
                categorize(tx.id, undefined);
                onClose();
              }}
            >
              Remove explanation
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!cat || (cat === 'other' && !note.trim())}
            onClick={() => {
              categorize(tx.id, cat || undefined, note.trim() || undefined);
              toast('Transaction explained.');
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <p className="muted small">
        Use this for transfers that will never have a payment request: refunds, fees, exchange top-ups, owner capital, or an overpayment you hold as customer credit. Explained transactions count as reconciled and appear in exports with this label.
      </p>
      <div className="stack tight">
        {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
          <label key={k} className="check">
            <input type="radio" name="cat" checked={cat === k} onChange={() => setCat(k as TxCategory)} /> {v}
          </label>
        ))}
      </div>
      <Field label="Note" hint={cat === 'other' ? 'Required for “Other”.' : 'Optional; included in exports.'}>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  );
}
