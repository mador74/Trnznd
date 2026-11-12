import type { Token } from '../lib/types';
import { CHAINS, TOKENS } from '../lib/types';
import { replaceAll, applySuggestions } from '../lib/store';
import { buildDemo } from '../lib/demo';
import { outstanding, needsReconciliation } from '../lib/status';
import { autoMatchPlan } from '../lib/match';
import { formatDate, todayISO } from '../lib/dates';
import { formatAmount } from '../lib/amount';
import { navigate, toast, useModel } from './hooks';
import { Amount, Empty, Icon, Net, RequestBadge, TokenTotals } from './kit';

export function Dashboard() {
  const { data, d, suggestions } = useModel();
  const isEmpty = !data.wallets.length && !data.requests.length && !data.transactions.length;
  if (isEmpty) return <Welcome />;

  const open = data.requests.filter((r) => ['open', 'overdue', 'partial'].includes(d.requestStatus.get(r.id) ?? ''));
  const totals = (kind: 'receivable' | 'payable') => {
    const t: Partial<Record<Token, number>> = {};
    for (const r of open.filter((x) => x.kind === kind)) t[r.token] = (t[r.token] ?? 0) + outstanding(r, d);
    return t;
  };
  const overdue = data.requests.filter((r) => d.requestStatus.get(r.id) === 'overdue' || (d.requestStatus.get(r.id) === 'partial' && r.dueDate && r.dueDate < todayISO()));
  const pending = data.transactions.filter((t) => needsReconciliation(t, d.txStatus.get(t.id) ?? 'unmatched'));
  const plan = autoMatchPlan(data, d);
  const withSuggestion = pending.filter((t) => suggestions.has(t.id)).length;
  const sumTotals = (t: Partial<Record<Token, number>>) => Object.values(t).reduce((a, b) => a + (b ?? 0), 0);

  const flows = CHAINS.flatMap((c) =>
    TOKENS.map((tok) => {
      const txs = data.transactions.filter((t) => t.chain === c && t.token === tok);
      const inn = txs.filter((t) => t.direction === 'in').reduce((a, t) => a + t.amount, 0);
      const out = txs.filter((t) => t.direction === 'out').reduce((a, t) => a + t.amount, 0);
      const unrec = txs.filter((t) => needsReconciliation(t, d.txStatus.get(t.id) ?? 'unmatched')).length;
      return { c, tok, n: txs.length, inn, out, unrec };
    }),
  ).filter((r) => r.n);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Settlement position across your stablecoin wallets. Amounts are in token units; USD totals assume a 1:1 peg.</p>
        </div>
        <div className="row">
          <a className="btn" href="#/requests?new=1" onClick={(e) => (e.preventDefault(), navigate('requests/new'))}>
            <Icon name="plus" /> New payment request
          </a>
          <a className="btn primary" href="#/reconcile">
            <Icon name="match" /> Reconcile
          </a>
        </div>
      </div>

      <div className="grid4">
        <div className="card">
          <div className="accent-bar" />
          <div className="stat">
            <span className="stat-label">To reconcile</span>
            <span className="stat-value">{pending.length}</span>
            <span className="stat-sub">
              {withSuggestion} with a suggested match · {plan.length} ready to auto-match
            </span>
          </div>
        </div>
        <div className="card stat">
          <span className="stat-label">Receivables outstanding</span>
          <span className="stat-value">${formatAmount(sumTotals(totals('receivable')))}</span>
          <span className="stat-sub">
            <TokenTotals totals={totals('receivable')} />
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Payables outstanding</span>
          <span className="stat-value">${formatAmount(sumTotals(totals('payable')))}</span>
          <span className="stat-sub">
            <TokenTotals totals={totals('payable')} />
          </span>
        </div>
        <div className="card stat">
          <span className="stat-label">Overdue requests</span>
          <span className="stat-value" style={{ color: overdue.length ? 'var(--out)' : undefined }}>{overdue.length}</span>
          <span className="stat-sub">${formatAmount(overdue.reduce((a, r) => a + outstanding(r, d), 0))} past due date</span>
        </div>
      </div>

      {plan.length > 0 && (
        <div className="notice ok row between">
          <span>
            <strong>{plan.length}</strong> transaction{plan.length === 1 ? '' : 's'} can be matched automatically with high confidence (exact amount plus a known wallet, memo reference or fingerprinted amount).
          </span>
          <button
            className="btn sm primary"
            onClick={() => {
              const n = applySuggestions(plan);
              toast(`${n} transaction${n === 1 ? '' : 's'} auto-matched. Review them under Reconcile → Reconciled.`);
            }}
          >
            <Icon name="bolt" /> Auto-match {plan.length}
          </button>
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <h2>Flows by network</h2>
            <span className="small muted">All imported history</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Network</th>
                  <th className="num">Received</th>
                  <th className="num">Sent</th>
                  <th className="num">Unreconciled</th>
                </tr>
              </thead>
              <tbody>
                {flows.map((f) => (
                  <tr key={f.c + f.tok}>
                    <td>
                      <Net chain={f.c} token={f.tok} long />
                    </td>
                    <td className="num">
                      <Amount value={f.inn} dir="in" />
                    </td>
                    <td className="num">
                      <Amount value={f.out} dir="out" />
                    </td>
                    <td className="num">{f.unrec ? <span className="badge tone-amber">{f.unrec}</span> : <span className="faint">0</span>}</td>
                  </tr>
                ))}
                {!flows.length && (
                  <tr>
                    <td colSpan={4} className="muted">
                      No transactions yet. Sync a wallet or import a CSV.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Needs attention</h2>
            <a className="small" href="#/requests">
              All requests →
            </a>
          </div>
          <div className="table-wrap">
            <table>
              <tbody>
                {overdue.slice(0, 6).map((r) => (
                  <tr key={r.id} className="click" onClick={() => navigate(`requests/${r.id}`)}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.number}</div>
                      <div className="small muted">{r.counterparty}</div>
                    </td>
                    <td className="small muted">Due {formatDate(r.dueDate)}</td>
                    <td className="num">
                      <Amount value={outstanding(r, d)} token={r.token} />
                    </td>
                    <td>
                      <RequestBadge status={d.requestStatus.get(r.id)!} />
                    </td>
                  </tr>
                ))}
                {!overdue.length && (
                  <tr>
                    <td className="muted">Nothing overdue.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Recent activity</h2>
          <a className="small" href="#/reports">
            Full log →
          </a>
        </div>
        <div className="table-wrap">
          <table>
            <tbody>
              {data.activity.slice(0, 6).map((a) => (
                <tr key={a.id}>
                  <td className="small muted nowrap">{formatDate(a.at, true)}</td>
                  <td style={{ fontWeight: 550 }}>{a.action}</td>
                  <td className="small muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Welcome() {
  const steps = [
    ['Add your wallets', 'Ethereum, Solana or Tron addresses that send or receive USDT and USDC.', 'wallets'],
    ['Create payment requests', 'Issue requests to customers (receivables) or log suppliers’ requests (payables). Import from CSV if they already exist in your accounting system.', 'requests'],
    ['Bring in transactions', 'Sync on-chain transfers from public APIs, or import a CSV export from a block explorer or exchange.', 'transactions'],
    ['Reconcile and export', 'Match payments to requests (auto-suggested), explain the rest, then export history and statements for your accountant.', 'reconcile'],
  ];
  return (
    <>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="accent-bar" />
        <div className="card-pad stack" style={{ padding: 28 }}>
          <h1>
            Reconcile stablecoin settlements <span className="gradient-text">against payment requests</span>
          </h1>
          <p className="muted" style={{ maxWidth: 760 }}>
            A light ledger for companies that settle in USDT and USDC on Ethereum, Solana and Tron. It is not full accounting software: it tracks what you asked to be paid (or were asked to pay), matches on-chain transfers to those requests, and exports clean history for your books.
          </p>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <a className="btn primary" href="#/wallets">
              <Icon name="wallet" /> Add a wallet
            </a>
            <button
              className="btn"
              onClick={() => {
                replaceAll(buildDemo(), 'Demo data loaded');
                toast('Demo data loaded. Try Reconcile → Auto-match.');
              }}
            >
              Explore with demo data
            </button>
          </div>
        </div>
      </div>
      <div className="grid4">
        {steps.map(([t, s, link], i) => (
          <a key={t} className="card card-pad stack tight" href={`#/${link}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="badge tone-blue plain">Step {i + 1}</span>
            <h3>{t}</h3>
            <p className="small muted">{s}</p>
          </a>
        ))}
      </div>
      <Empty title="Your data stays in this browser">
        There is no server and no account. The only outside calls are the read-only blockchain API requests made when you press “Sync”, which send your wallet addresses to those services. Clearing browser data deletes the ledger, so download a backup from Reports &amp; export regularly.
      </Empty>
    </>
  );
}
