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
| **Plans** | **Basic** $15/month: 1 user, 5 connections, no approval rules. **Premium** $50/month: 5 users in total (including the owner), 5 connections, approval rules. **Institution** $100/month: everything in Premium, with unlimited users and connections. Bank and card connections count toward the limit. Downgrades are blocked until usage fits the lower plan |
| **Dashboard** | Aggregated treasury value, 90-day trend, allocation by asset, money in/out, the approval queue, and a "bank feed" card per connection with its balance, share of the total and a *Reconcile N items* button |
| **Open banking** | Bank accounts and credit cards connect with read-only consent and appear alongside crypto. Card balances show as money owed, and each bank's consent-renewal date is shown |
| **Invoices** | Bill customers in USDC/USDT/BTC/ETH or USD/EUR/GBP. Each invoice has line items and tax, and is paid into your wallet (with a network warning) or bank account. You can download the PDF, or send it as a PDF to the customer, with an optional copy to yourself (in the demo, sending is simulated). Mark an invoice paid by matching it to a receipt in the ledger. Overdue invoices are flagged automatically |
| **Connections** | Every exchange, custodian and wallet, shown individually and as an aggregated total. "Add connection" asks for a read-only API key or a public address/xpub, never a private key. Each connection has its own detail page with holdings, its balance history and its own ledger |
| **Transactions** | One ledger across all connections recording what, when, how much and who (counterparty plus address), with the tx hash. Filters, search, bulk reconcile, categories, memos and CSV export |
| **Approvals** | M-of-N policies (e.g. *2 of 3 for payments ≥ $10k*) that can stack (e.g. *Owner co-sign ≥ $250k*), an address whitelist, and a request → sign → execute → record-hash flow. Requesters can't approve their own request, and one rejection rejects |
| **Team** | Seats follow the plan, with roles (Admin, Approver, Accountant, Viewer), a permissions matrix and suspend/remove. Removing a user also removes them from approver lists |
| **Billing** | Compare and switch plans; pay by card or USDT/USDC (network selectable); subscription invoice history |
| **Audit log** | Every state change: who, what and when, exportable to CSV |

Use **"Signed in as"** in the top bar to switch between demo users. That lets you see a 2-of-3 approval collected from several people. **Reset demo** restores the seed data.

## Code map

```
src/
├─ lib/policy.js      approval engine (pure, unit-tested)
├─ lib/ledger.js      balances, history, cash flow (pure, unit-tested)
├─ lib/plans.js       plan limits and downgrade checks (pure, unit-tested)
├─ lib/invoice.js     invoice totals, status, payment matching (pure, unit-tested)
├─ lib/pdf.js         invoice PDF (jsPDF)
├─ data/seed.js       deterministic demo data, roles, permissions, plan limits
├─ state/store.jsx    reducer + localStorage persistence (stand-in for the API)
├─ components/        Layout, Ledger table + drawer, UI primitives
└─ pages/             Dashboard, Connections, ConnectionDetail, Transactions, Approvals, Team, Audit, Settings
```
