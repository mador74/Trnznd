# TRNZIT Treasury Management, by TRNZND (prototype)

A treasury management workspace for businesses holding crypto and stablecoins. It is laid out like a business banking dashboard (in the spirit of Xero), but its accounts are exchanges, custodians, wallets, banks and cards. It is not an accounting platform.

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
| **Display currency** | Each user picks the currency all totals are shown in from the top bar, grouped by region: global (USD, EUR, GBP, CHF, AED, AUD, JPY), Latin America (BRL, MXN, COP, CLP, PEN, ARS), Africa (NGN, KES, ZAR, GHS, EGP) and South-East Asia (SGD, IDR, PHP, VND, THB, MYR). Display only: values are stored in USD, invoices keep their own currency, and plan prices and policy thresholds stay in USD. The exchange rates are demo values |
| **Send** | Instruct your own custodian, exchange or wallet to pay stablecoins or other crypto to a counterparty's whitelisted address. **TRNZIT never holds private keys or customer funds.** Balance, network and whitelist checks run first, then the approval rules (Premium/Institution). The **final release** is given by an authorised releaser with their own 2-step code: the Owner always, and others as ticked on the Team page. TRNZIT then passes the instruction to the provider by API (or to your wallet to sign), and records the payment when the provider reports it. Fiat payments are not available yet. In the demo, the provider step is simulated |
| **Convert** | Convert holdings inside one connection (fiat ↔ stablecoin, stablecoin ↔ crypto and similar), but only for the pairs that provider's API allows and only once conversions are switched on for that connection. You get a quote with the provider's fee and a 30-second refresh, then an authorised releaser confirms with their own 2-step code. TRNZIT passes the one-off instruction to the provider, which converts at its own rate; the ledger records the amount out, the amount in and the fee. Approval is needed only if an approval policy covers conversions. Self-custody wallets and open-banking accounts cannot convert. TRNZIT never trades on its own |
| **Buy & mint** | **Stablecoin on-ramp:** open an account with the on-ramp partner from inside TRNZIT (the partner runs its own business checks), buy USDC/USDT with fiat at the partner's checkout, and have them delivered into a the on-ramp partner custody account that appears as a connection. **ZEND with TRNZND:** open a minting account, request a mint (fiat goes by bank transfer to TRNZND) and receive ZEND on Ethereum, Solana or Tron in a wallet of your choice. Redeem ZEND back to fiat in your bank: redemption goes through approvals and an authorised releaser, sending to TRNZND's redemption address on the matching network. Partner fees, minimums and onboarding are simulated |
| **Multisig wallets** | Create a new **Safe** (Ethereum, Base, Arbitrum, Polygon) or **Squads** (Solana) multisig from Connections, choosing owners and an M-of-N rule (at least 2 signatures), or connect an existing one. Deployment is signed in the user's own wallet. Payments from a multisig are proposed to it and execute only when enough owners sign in their own wallets |
| **Dashboard** | Aggregated treasury value, 90-day trend, allocation by asset, money in/out, the approval queue, and a "bank feed" card per connection with its balance, share of the total and a *Reconcile N items* button |
| **Open banking** | Bank accounts and credit cards connect with read-only consent and appear alongside crypto. Card balances show as money owed, and each bank's consent-renewal date is shown |
| **Invoices** | Bill customers in USDC/USDT/BTC/ETH or USD/EUR/GBP. Each invoice has line items and tax, and is paid into your wallet (with a network warning) or bank account. You can download the PDF, or send it as a PDF to the customer, with an optional copy to yourself (in the demo, sending is simulated). Mark an invoice paid by matching it to a receipt in the ledger. Overdue invoices are flagged automatically |
| **Connections** | Every exchange, custodian and wallet, shown individually and as an aggregated total. "Add connection" asks for a read-only API key or a public address/xpub, never a private key. Each connection has its own detail page with holdings, its balance history and its own ledger |
| **Transactions** | One ledger across all connections recording what, when, how much and who (counterparty plus address), with the tx hash. Money coming in and going out has separate **In** and **Out** columns (green and red), each with its value at the transaction date, and totals for in, out and net. You can filter by direction. Click a row to categorise, add a memo or reconcile it. Filters, search, bulk reconcile, categories, memos and CSV export |
| **Approvals** | M-of-N policies (e.g. *2 of 3 for payments ≥ $10k*) that can stack (e.g. *Owner co-sign ≥ $250k*), an address whitelist, and a request → sign → execute → record-hash flow. Requesters can't approve their own request, and one rejection rejects |
| **Team** | Seats follow the plan, with roles (Admin, Approver, Accountant, Viewer), a permissions matrix and suspend/remove. Removing a user also removes them from approver lists |
| **Billing** | Compare and switch plans; pay by card or USDT/USDC (network selectable); subscription invoice history |
| **Audit log** | Every state change: who, what and when, exportable to CSV |

Use **"Signed in as"** in the top bar to switch between demo users. That lets you see a 2-of-3 approval collected from several people. **Reset demo** restores the seed data.

## Not an accounting platform

TRNZIT keeps transactions, reconciliation status and the audit log for audit purposes, and exports them to CSV for the customer's own accounting software. It does not keep a general ledger, produce financial statements or apply accounting standards.

## Footer and terms

Every page has a footer stating that TRNZIT is built and operated by TRNZND UAE (TRNZND group), is non-custodial, never holds funds or keys, and only receives the subscription; that third-party providers are licensed or registered as required in their own jurisdictions; and that ZEND is issued by TRNZND S.A. (Panama), a separate group company. It links to a **draft** Terms and conditions page (`/terms`) with the key points, marked for counsel review. Third-party providers are not named in the product.

## Menu

- **Left sidebar.** Every page is visible, grouped under Overview, Accounts, Payments, Records and Company, with icons and counters. The « button collapses it to an icon rail (hover shows the page name), and the choice is remembered. On phones and small tablets it becomes a drawer opened with the ☰ button.

## Code map

```
src/
├─ lib/policy.js      approval engine (pure, unit-tested)
├─ lib/ledger.js      balances, history, cash flow (pure, unit-tested)
├─ lib/plans.js       plan limits and downgrade checks (pure, unit-tested)
├─ lib/invoice.js     invoice totals, status, payment matching (pure, unit-tested)
├─ lib/pdf.js         invoice PDF (jsPDF)
├─ lib/send.js        payment pre-flight checks and signing methods (unit-tested)
├─ lib/prices.js     demo price history (value at a transaction's date)
├─ lib/fx.js          display currencies and demo exchange rates (unit-tested)
├─ data/seed.js       deterministic demo data, roles, permissions, plan limits
├─ state/store.jsx    reducer + localStorage persistence (stand-in for the API)
├─ components/        Layout, Ledger table + drawer, UI primitives
└─ pages/             Dashboard, Connections, ConnectionDetail, Transactions, Approvals, Team, Audit, Settings
```
