# TRNZND Treasury (prototype)

A treasury management workspace for businesses holding crypto and stablecoins. It is laid out like a fiat accounting ledger (in the spirit of Xero), but its accounts are exchanges, custodians and wallets.

**This is a clickable prototype running on demo data.** No real provider is connected, prices are static, and state lives in the browser's localStorage. `ARCHITECTURE.md` covers what a production build needs.

## Run it

```bash
cd platform
npm install
npm run dev        # http://localhost:5174
npm test           # policy-engine + ledger unit tests (node:test)
npm run build      # static build in platform/dist (relative base, hash routing)
```

## What's in it

| Area | What it does |
|---|---|
| **Dashboard** | Aggregated treasury value, 90-day trend, allocation by asset, money in/out, the approval queue, and a "bank feed" card per connection with its balance, share of the total and a *Reconcile N items* button |
| **Connections** | Every exchange, custodian and wallet, shown individually and as an aggregated total. "Add connection" asks for a read-only API key or a public address/xpub, never a private key. Each connection has its own detail page with holdings, its balance history and its own ledger |
| **Transactions** | One ledger across all connections recording what, when, how much and who (counterparty plus address), with the tx hash. Filters, search, bulk reconcile, categories, memos and CSV export |
| **Approvals** | M-of-N policies (e.g. *2 of 3 for payments ≥ $10k*) that can stack (e.g. *Owner co-sign ≥ $250k*), an address whitelist, and a request → sign → execute → record-hash flow. Requesters can't approve their own request, and one rejection rejects |
| **Team** | The Owner plus up to 5 sub-users, with roles (Admin, Approver, Accountant, Viewer), a permissions matrix and suspend/remove. Removing a user also removes them from approver lists |
| **Billing** | Premium at $50/month, paid by card or USDT/USDC (network selectable), plus invoice history |
| **Audit log** | Every state change: who, what and when, exportable to CSV |

Use **"Signed in as"** in the top bar to switch between demo users. That lets you see a 2-of-3 approval collected from several people. **Reset demo** restores the seed data.

## Code map

```
src/
├─ lib/policy.js      approval engine (pure, unit-tested)
├─ lib/ledger.js      balances, history, cash flow (pure, unit-tested)
├─ data/seed.js       deterministic demo data, roles, permissions, plan limits
├─ state/store.jsx    reducer + localStorage persistence (stand-in for the API)
├─ components/        Layout, Ledger table + drawer, UI primitives
└─ pages/             Dashboard, Connections, ConnectionDetail, Transactions, Approvals, Team, Audit, Settings
```
