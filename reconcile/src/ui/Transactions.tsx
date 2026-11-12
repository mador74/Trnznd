import { useEffect, useMemo, useState } from 'react';
import type { Chain, Token, Transaction } from '../lib/types';
import { CATEGORY_LABELS, CHAINS, TOKENS } from '../lib/types';
import { addTransactions, deleteTransaction, removeAllocation, updateTransaction } from '../lib/store';
import { CHAIN_NAMES, isValidAddress, explorerTxUrl, sameAddress } from '../lib/chains';
import { formatAmount, parseAmount, toDecimalString } from '../lib/amount';
import { formatDate, type DateOrder } from '../lib/dates';
import { counterpartyOf } from '../lib/match';
import { type TxStatus, TX_STATUS_LABEL, txRemaining } from '../lib/status';
import { buildTransactions, guessTxMapping, parseCSV, TX_FIELD_LABELS, type TxField, type TxMapping } from '../lib/csv';
import { txKey } from '../lib/ids';
import { nameResolver } from '../lib/names';
import { navigate, toast, useModel } from './hooks';
import { Addr, Amount, DirIcon, Empty, Field, Icon, Modal, Net, TxBadge } from './kit';
import { FilePick } from './Requests';
import { ExplainDialog, MatchDialog } from './Reconcile';
import { runSync, useSyncState } from './syncing';

const PAGE = 200;

export function Transactions({ openId }: { openId?: string }) {
  const { data, d } = useModel();
  const sync = useSyncState();
  const [q, setQ] = useState('');
  const [wallet, setWallet] = useState('');
  const [chain, setChain] = useState('');
  const [token, setToken] = useState('');
  const [dir, setDir] = useState('');
  const [status, setStatus] = useState<'' | TxStatus | 'internal'>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const names = useMemo(() => nameResolver(data), [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.transactions
      .filter((t) => (!wallet || t.walletId === wallet) && (!chain || t.chain === chain) && (!token || t.token === token) && (!dir || t.direction === dir))
      .filter((t) => (status === 'internal' ? t.direction === 'internal' : !status || (t.direction !== 'internal' && d.txStatus.get(t.id) === status)))
      .filter((t) => (!from || t.timestamp.slice(0, 10) >= from) && (!to || t.timestamp.slice(0, 10) <= to))
      .filter((t) => !needle || [t.hash, t.from, t.to, t.memo ?? '', t.note ?? '', names(t.chain, counterpartyOf(t)) ?? '', toDecimalString(t.amount)].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [data.transactions, d, q, wallet, chain, token, dir, status, from, to, names]);

  const sums: Partial<Record<Token, number>> = {};
  for (const t of rows) if (t.direction !== 'internal') sums[t.token] = (sums[t.token] ?? 0) + (t.direction === 'in' ? t.amount : -t.amount);
  const detail = openId ? data.transactions.find((t) => t.id === openId) : undefined;
  const walletLabel = (id?: string) => data.wallets.find((w) => w.id === id)?.label ?? '—';

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Every USDT and USDC transfer in or out of your wallets, from chain sync, CSV import or manual entry. Duplicates are ignored automatically.</p>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setAdding(true)} disabled={!data.wallets.length}>
            <Icon name="plus" /> Add manually
          </button>
          <button className="btn" onClick={() => setImporting(true)} disabled={!data.wallets.length} title={data.wallets.length ? '' : 'Add a wallet first'}>
            <Icon name="upload" /> Import CSV
          </button>
          <button className="btn primary" onClick={() => runSync()} disabled={sync.running || !data.wallets.some((w) => !w.demo)}>
            <Icon name="sync" /> {sync.running ? 'Syncing…' : 'Sync wallets'}
          </button>
        </div>
      </div>
      {!data.wallets.length && (
        <div className="notice warn">
          Add your wallets first (<a href="#/wallets">Wallets &amp; contacts</a>) — transactions are attached to your wallets so the app knows what was received and what was sent.
        </div>
      )}
      <div className="toolbar">
        <input type="search" placeholder="Search hash, address, memo, name, amount…" value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} aria-label="Search transactions" />
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
        <select value={dir} onChange={(e) => setDir(e.target.value)} aria-label="Direction">
          <option value="">In, out, internal</option>
          <option value="in">Received</option>
          <option value="out">Sent</option>
          <option value="internal">Internal</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status">
          <option value="">Any status</option>
          {(Object.keys(TX_STATUS_LABEL) as TxStatus[]).map((s) => (
            <option key={s} value={s}>
              {TX_STATUS_LABEL[s]}
            </option>
          ))}
          <option value="internal">Internal</option>
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To" />
      </div>
      <div className="card table-wrap">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th>Date (local)</th>
                <th></th>
                <th>Network</th>
                <th className="num">Amount</th>
                <th>Counterparty</th>
                <th>Wallet</th>
                <th>Memo / note</th>
                <th>Status</th>
                <th>Matched to</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((t) => {
                const cp = counterpartyOf(t);
                const allocs = d.allocByTx.get(t.id) ?? [];
                return (
                  <tr key={t.id} className="click" onClick={() => navigate(`transactions/${encodeURIComponent(t.id)}`)}>
                    <td className="small nowrap">{formatDate(t.timestamp, true)}</td>
                    <td>
                      <DirIcon dir={t.direction} />
                    </td>
                    <td>
                      <Net chain={t.chain} token={t.token} />
                    </td>
                    <td className="num">
                      <Amount value={t.amount} dir={t.direction === 'internal' ? undefined : t.direction} />
                    </td>
                    <td className="small">{t.direction === 'internal' ? <span className="muted">Own wallets</span> : names(t.chain, cp) ?? <span className="mono">{cp ? `${cp.slice(0, 6)}…${cp.slice(-4)}` : '—'}</span>}</td>
                    <td className="small muted">{walletLabel(t.walletId)}</td>
                    <td className="small muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.memo ?? t.note ?? ''}
                    </td>
                    <td>
                      <TxBadge status={d.txStatus.get(t.id)!} internal={t.direction === 'internal'} />
                    </td>
                    <td className="small">
                      {allocs.map((a) => d.requestById.get(a.requestId)?.number).join(', ')}
                      {t.category && <span className="muted">{allocs.length ? ' + ' : ''}{CATEGORY_LABELS[t.category]}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(Object.entries(sums) as [Token, number][]).map(([tok, v]) => (
                <tr key={tok}>
                  <td colSpan={3} className="small muted">
                    Net {tok} for {rows.length} shown (received − sent)
                  </td>
                  <td className="num">
                    <Amount value={v} token={tok} sign />
                  </td>
                  <td colSpan={5}></td>
                </tr>
              ))}
            </tfoot>
          </table>
        ) : (
          <Empty title={data.transactions.length ? 'No transactions match these filters' : 'No transactions yet'}>
            {data.transactions.length ? 'Clear a filter to see more.' : 'Sync a wallet to fetch its USDT/USDC transfers, or import a CSV export from Etherscan, Solscan, Tronscan or an exchange.'}
          </Empty>
        )}
        {rows.length > limit && (
          <div className="row" style={{ padding: 12, justifyContent: 'center' }}>
            <button className="btn sm" onClick={() => setLimit((l) => l + PAGE)}>
              Show {Math.min(PAGE, rows.length - limit)} more of {rows.length - limit}
            </button>
          </div>
        )}
      </div>
      {detail && <TxDetail tx={detail} onClose={() => navigate('transactions')} />}
      {importing && <ImportTxDialog onClose={() => setImporting(false)} />}
      {adding && <ManualTxDialog onClose={() => setAdding(false)} />}
    </>
  );
}

function TxDetail({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { data, d } = useModel();
  const [match, setMatch] = useState(false);
  const [explain, setExplain] = useState(false);
  const [note, setNote] = useState(tx.note ?? '');
  const names = nameResolver(data);
  const allocs = d.allocByTx.get(tx.id) ?? [];
  const status = d.txStatus.get(tx.id)!;
  const rem = txRemaining(tx, d);
  const wallet = data.wallets.find((w) => w.id === tx.walletId);
  const demo = tx.source === 'demo';
  useEffect(() => setNote(tx.note ?? ''), [tx.note]);
  return (
    <>
      <Modal
        drawer
        title={
          <span className="row">
            Transaction <TxBadge status={status} internal={tx.direction === 'internal'} />
          </span>
        }
        onClose={onClose}
        footer={
          <>
            <button
              className="btn danger sm"
              onClick={() => {
                if (!window.confirm('Delete this transaction from the ledger? Its matches are removed too. A later sync or import may add it again.')) return;
                deleteTransaction(tx.id);
                onClose();
              }}
            >
              Delete
            </button>
            <span className="grow" />
            {tx.direction !== 'internal' && (
              <>
                <button className="btn sm" onClick={() => setExplain(true)}>
                  {tx.category ? 'Change explanation' : 'Explain…'}
                </button>
                <button className="btn sm primary" disabled={rem <= 0} onClick={() => setMatch(true)}>
                  Match to request
                </button>
              </>
            )}
          </>
        }
      >
        <div className="row">
          <DirIcon dir={tx.direction} />
          <span style={{ fontSize: 22, fontWeight: 650 }}>
            <Amount value={tx.amount} token={tx.token} dir={tx.direction === 'internal' ? undefined : tx.direction} />
          </span>
          <span className="grow" />
          <Net chain={tx.chain} long />
        </div>
        <dl className="kv">
          <dt>Date</dt>
          <dd>
            {formatDate(tx.timestamp, true)} <span className="faint small">({tx.timestamp.replace('T', ' ').slice(0, 19)} UTC)</span>
          </dd>
          <dt>Wallet</dt>
          <dd>{wallet?.label ?? '—'}</dd>
          <dt>From</dt>
          <dd>
            <Addr chain={tx.chain} address={tx.from} label={names(tx.chain, tx.from)} link={!demo} full />
          </dd>
          <dt>To</dt>
          <dd>
            <Addr chain={tx.chain} address={tx.to} label={names(tx.chain, tx.to)} link={!demo} full />
          </dd>
          <dt>Hash / signature</dt>
          <dd className="mono small" style={{ overflowWrap: 'anywhere' }}>
            {tx.hash}{' '}
            {!demo && (
              <a href={explorerTxUrl(tx.chain, tx.hash)} target="_blank" rel="noreferrer">
                Explorer ↗
              </a>
            )}
          </dd>
          {tx.block !== undefined && (
            <>
              <dt>{tx.chain === 'SOL' ? 'Slot' : 'Block'}</dt>
              <dd className="mono small">{tx.block}</dd>
            </>
          )}
          <dt>Memo</dt>
          <dd className="mono small">{tx.memo ?? <span className="faint">None</span>}</dd>
          <dt>Source</dt>
          <dd className="small">
            {tx.source === 'api' ? 'Chain sync' : tx.source === 'csv' ? 'CSV import' : tx.source === 'manual' ? 'Manual entry' : 'Demo data'} · added {formatDate(tx.importedAt, true)}
          </dd>
          {tx.category && (
            <>
              <dt>Explanation</dt>
              <dd>{CATEGORY_LABELS[tx.category]}</dd>
            </>
          )}
        </dl>
        <div className="stack tight">
          <h3>Matched to</h3>
          <div className="card table-wrap">
            <table>
              <tbody>
                {allocs.map((a) => {
                  const r = d.requestById.get(a.requestId);
                  return (
                    <tr key={a.id}>
                      <td>
                        <a href={`#/requests/${a.requestId}`}>{r?.number}</a> <span className="muted small">{r?.counterparty}</span>
                      </td>
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
                {!allocs.length && (
                  <tr>
                    <td className="small muted">{tx.direction === 'internal' ? 'Internal transfers need no payment request.' : 'Not matched to any request.'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {rem > 0 && allocs.length > 0 && <span className="small muted">{formatAmount(rem)} {tx.token} not allocated.</span>}
        </div>
        <Field label="Internal note" hint="Included in the transaction history export.">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (tx.note ?? '') && updateTransaction(tx.id, { note: note.trim() || undefined })} />
        </Field>
      </Modal>
      {match && <MatchDialog tx={tx} onClose={() => setMatch(false)} />}
      {explain && <ExplainDialog tx={tx} onClose={() => setExplain(false)} />}
    </>
  );
}

const FIELDS: TxField[] = ['date', 'hash', 'amount', 'token', 'chain', 'from', 'to', 'memo', 'direction'];

function ImportTxDialog({ onClose }: { onClose: () => void }) {
  const { data } = useModel();
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [mapping, setMapping] = useState<TxMapping>({});
  const [walletId, setWalletId] = useState('');
  const [defaultChain, setDefaultChain] = useState<Chain | ''>('');
  const [defaultToken, setDefaultToken] = useState<Token | ''>('');
  const [dateOrder, setDateOrder] = useState<DateOrder>('auto');
  const [baseUnits, setBaseUnits] = useState(false);

  const onFile = async (f: File) => {
    setFileName(f.name);
    const p = parseCSV(await f.text());
    setHeaders(p.headers);
    setRows(p.rows);
    setParseErrors(p.errors);
    setMapping(guessTxMapping(p.headers));
  };
  const result = useMemo(
    () =>
      rows.length
        ? buildTransactions(rows, { mapping, walletId: walletId || undefined, defaultChain: defaultChain || undefined, defaultToken: defaultToken || undefined, dateOrder, baseUnits }, data.wallets)
        : null,
    [rows, mapping, walletId, defaultChain, defaultToken, dateOrder, baseUnits, data.wallets],
  );
  const existing = useMemo(() => new Set(data.transactions.map((t) => t.id)), [data.transactions]);
  const fresh = result?.transactions.filter((t) => !existing.has(t.id)).length ?? 0;
  const needsWallet = !mapping.from && !mapping.to;

  return (
    <Modal
      title="Import transactions from CSV"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="grow small muted">
            {result ? `${result.transactions.length} readable · ${fresh} new · ${result.skippedForeign} not involving your wallets · ${result.errors.length} with errors` : ''}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!result || !result.transactions.length}
            onClick={() => {
              const r = addTransactions(result!.transactions, fileName || 'CSV');
              toast(`${r.added} transaction${r.added === 1 ? '' : 's'} imported${r.duplicates ? `, ${r.duplicates} already in the ledger` : ''}.`);
              onClose();
            }}
          >
            Import {fresh || ''}
          </button>
        </>
      }
    >
      <p className="small muted">
        Works with token-transfer exports from block explorers (Etherscan, Solscan, Tronscan), exchanges and wallet apps. Map the columns below; rows that touch none of your wallets are skipped. Amounts are read as tokens (e.g. 1,250.50) unless you tick “base units”.
      </p>
      <FilePick onFile={onFile} label={fileName || 'Choose a CSV file'} />
      {parseErrors.length > 0 && <div className="notice warn small">{parseErrors.join(' · ')}</div>}
      {headers.length > 0 && (
        <>
          <div className="grid3">
            {FIELDS.map((f) => (
              <Field key={f} label={TX_FIELD_LABELS[f]} hint={f === 'hash' || f === 'date' || f === 'amount' ? 'Required' : undefined}>
                <select value={mapping[f] ?? ''} onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}>
                  <option value="">— not in file —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="grid4">
            <Field label="File belongs to wallet" hint={needsWallet ? 'Required: the file has no from/to columns' : 'Optional'}>
              <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
                <option value="">— detect from addresses —</option>
                {data.wallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default chain" hint="When there is no chain column">
              <select value={defaultChain} onChange={(e) => setDefaultChain(e.target.value as Chain | '')}>
                <option value="">Detect</option>
                {CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_NAMES[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default token" hint="When there is no token column">
              <select value={defaultToken} onChange={(e) => setDefaultToken(e.target.value as Token | '')}>
                <option value="">Detect</option>
                {TOKENS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Dates like 03/04/2026 are">
              <select value={dateOrder} onChange={(e) => setDateOrder(e.target.value as DateOrder)}>
                <option value="auto">Unambiguous only</option>
                <option value="dmy">Day / month / year</option>
                <option value="mdy">Month / day / year</option>
              </select>
            </Field>
          </div>
          <label className="check small">
            <input type="checkbox" checked={baseUnits} onChange={(e) => setBaseUnits(e.target.checked)} /> Amount column is in base units (1000000 = 1 USDT/USDC)
          </label>
          {result && (
            <>
              {result.errors.length > 0 && (
                <div className="notice warn small" style={{ maxHeight: 110, overflow: 'auto' }}>
                  {result.errors.slice(0, 50).map((e) => (
                    <div key={e}>{e}</div>
                  ))}
                  {result.errors.length > 50 && <div>…and {result.errors.length - 50} more</div>}
                </div>
              )}
              <div className="card table-wrap" style={{ maxHeight: 260 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th></th>
                      <th>Network</th>
                      <th className="num">Amount</th>
                      <th>Counterparty</th>
                      <th>Hash</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.slice(0, 8).map((t) => (
                      <tr key={t.id}>
                        <td className="small nowrap">{formatDate(t.timestamp, true)}</td>
                        <td>
                          <DirIcon dir={t.direction} />
                        </td>
                        <td>
                          <Net chain={t.chain} token={t.token} />
                        </td>
                        <td className="num">
                          <Amount value={t.amount} dir={t.direction === 'internal' ? undefined : t.direction} />
                        </td>
                        <td className="small mono">{counterpartyOf(t).slice(0, 10)}…</td>
                        <td className="small mono">{t.hash.slice(0, 12)}…</td>
                        <td className="small">{existing.has(t.id) ? <span className="badge tone-gray">exists</span> : <span className="badge tone-green">new</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function ManualTxDialog({ onClose }: { onClose: () => void }) {
  const { data } = useModel();
  const [walletId, setWalletId] = useState(data.wallets[0]?.id ?? '');
  const wallet = data.wallets.find((w) => w.id === walletId);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [token, setToken] = useState<Token>('USDT');
  const [amount, setAmount] = useState('');
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));
  const [other, setOther] = useState('');
  const [hash, setHash] = useState('');
  const [memo, setMemo] = useState('');
  const amt = parseAmount(amount);
  const chain = wallet?.chain;
  const errors = {
    amount: !amt || amt <= 0 ? 'Enter an amount' : null,
    other: chain && other.trim() && !isValidAddress(chain, other) ? `Not a valid ${CHAIN_NAMES[chain]} address` : !other.trim() ? 'Required' : null,
    hash: !hash.trim() ? 'Required — the transaction hash or signature' : null,
  };
  const ok = wallet && !Object.values(errors).some(Boolean);
  return (
    <Modal
      title="Add transaction manually"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!ok}
            onClick={() => {
              const from = direction === 'in' ? other.trim() : wallet!.address;
              const to = direction === 'in' ? wallet!.address : other.trim();
              const t: Transaction = {
                id: txKey(wallet!.chain, hash, token, from, to, amt!),
                chain: wallet!.chain,
                token,
                hash: hash.trim(),
                timestamp: new Date(when).toISOString(),
                from,
                to,
                amount: amt!,
                walletId: wallet!.id,
                direction,
                memo: memo.trim() || undefined,
                source: 'manual',
                importedAt: new Date().toISOString(),
              };
              const internal = data.wallets.some((w) => w.chain === t.chain && w.id !== wallet!.id && sameAddress(w.chain, w.address, other));
              if (internal) t.direction = 'internal';
              const r = addTransactions([t], 'manual entry');
              toast(r.added ? 'Transaction added.' : 'That transaction is already in the ledger.', r.added ? 'ok' : 'error');
              if (r.added) onClose();
            }}
          >
            Add transaction
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label="Wallet">
          <select value={walletId} onChange={(e) => setWalletId(e.target.value)}>
            {data.wallets.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label} ({w.chain})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Direction">
          <select value={direction} onChange={(e) => setDirection(e.target.value as 'in' | 'out')}>
            <option value="in">Received into this wallet</option>
            <option value="out">Sent from this wallet</option>
          </select>
        </Field>
        <Field label="Token">
          <select value={token} onChange={(e) => setToken(e.target.value as Token)}>
            {TOKENS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount" error={amount ? errors.amount : null}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ fontFamily: 'var(--mono)' }} />
        </Field>
        <Field label="Date and time (local)">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
        <Field label={direction === 'in' ? 'Sender address' : 'Recipient address'} error={other ? errors.other : null}>
          <input value={other} onChange={(e) => setOther(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} />
        </Field>
      </div>
      <Field label="Transaction hash / signature" hint="Used to detect duplicates when you later sync or import.">
        <input value={hash} onChange={(e) => setHash(e.target.value)} style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }} />
      </Field>
      <Field label="Memo (optional)">
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </Field>
    </Modal>
  );
}
