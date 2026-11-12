# Settlement Ledger

A browser-based tool for companies that settle in stablecoins. It is not full accounting software: it keeps track of **payment requests** (what you asked customers to pay, and what suppliers asked you to pay), brings in **on-chain transfers** of USDT and USDC on Ethereum, Solana and Tron, **reconciles** one against the other, and **exports** clean history for your accounting package.

Working name; change it in `index.html` and `src/ui/App.tsx`.

## What it does

| Area | Features |
|---|---|
| Payment requests | Receivables and payables; contact, expected payer/payee wallet, our wallet, due date, reference. Optional *unique amount* (adds 0.0001 to 0.0099) so a payment is identifiable on chains without memos. Printable request / PDF with QR code of the receiving address. CSV import with template. |
| Transactions | Sync from public chain APIs, CSV import with column mapping (explorer, exchange or wallet-app exports), manual entry. Duplicates across sources are ignored. Direction (in, out, internal) is worked out from your own wallets. |
| Reconcile | Suggested matches scored on exact amount, tolerance, memo reference, known counterparty wallet, fingerprinted amount and date window. Handles partial payments, one payment covering 2 or 3 requests, short payments (write-off within tolerance), overpayments (remainder explained as credit) and transfers with no request (refund, fee, exchange, owner, internal). Auto-match applies only unambiguous high-confidence suggestions. Every match can be undone. |
| Export | Transaction history CSV (status, matched requests, explorer links), payment requests CSV, reconciliation audit trail CSV, bank-statement style CSV per wallet and token, full JSON backup and restore, activity log. |

## Run it

```bash
cd reconcile
npm install
npm run dev        # http://localhost:5174
npm test           # unit tests (matching, amounts, CSV, chain parsers)
npm run build      # type-check + production build to dist/
npm run publish:pages   # build and copy to ../docs/reconcile/ for GitHub Pages
```

The build is static (no server). Open **Overview → Explore with demo data** to try it without real wallets.

## Where data lives

Everything is stored in the browser's IndexedDB on the machine where it is used (with a localStorage fallback). There is no server and no login, so:

- two people on two computers see two different ledgers; move data with **Reports & export → Backup / Restore**;
- clearing browser data deletes the ledger, so take regular backups;
- API keys entered in Settings are stored unencrypted in the same browser and left out of backups unless you tick the option.

## Blockchain data sources

Sync runs in the browser and calls these services directly with your wallet addresses:

| Chain | Service | Method | Key |
|---|---|---|---|
| Ethereum | Etherscan API V2 | `module=account&action=tokentx&chainid=1`, filtered by the token contract | Required (free Etherscan account) |
| Tron | TronGrid | `GET /v1/accounts/{address}/transactions/trc20`, `contract_address` filter, `fingerprint` paging | Optional (`TRON-PRO-API-KEY` header) |
| Solana | Any Solana JSON-RPC | `getTokenAccountsByOwner` → `getSignaturesForAddress` per token account → `getTransaction` (`jsonParsed`), balance change from pre/post token balances | Public endpoint by default; a provider URL is recommended |

Token contracts and mints are in `src/lib/chains.ts`. Verify them against Tether's and Circle's own published lists before relying on them.

**Not yet verified against the live services.** The request formats follow the providers' documented endpoints and the parsers are unit-tested against sample responses, but the development sandbox could not reach any of the three APIs, so a first real sync has not been run. Things to check on first use: that each provider still accepts calls from a browser (CORS), the exact response field names (TronGrid `token_info`, `block_timestamp`, `value`; Etherscan `timeStamp`, `tokenDecimal`), and free-tier rate limits. Errors are shown per wallet on **Wallets & contacts**. CSV import works regardless.

USDC on Tron: Circle stopped minting it in February 2024 and announced the end of support in February 2025. The app still reads it but warns when a request uses it.

## Limits worth knowing

- Amounts are held as integer micro-units (6 decimals), which is the precision of USDT and USDC on all three chains.
- USD totals assume a 1:1 peg. Stablecoins can deviate; use your own policy's rates for reporting.
- Network fees (ETH, SOL, TRX gas) are not imported; only token transfers are.
- Solana: each sync reads up to 150 transactions per token on the public endpoint (1,000 with your own RPC URL), oldest first, so a busy wallet's history fills in over several syncs; the sync message says when more remains. Only the latest 10,000 signatures per token account are listed; older history can be added by CSV.
- The bank-statement export uses `Date, Amount, Payee, Description, Reference`. Accounting packages differ in what they accept and change their import formats, so check yours before the first import.
- Single user per browser; no roles or approvals.

## Code map

```
src/lib/      types, amounts, chain rules, store (persistence + actions),
              status derivation, matching engine, CSV import/export, demo data
src/chains/   Etherscan, TronGrid and Solana fetchers + sync orchestration
src/ui/       React screens: Overview, Reconcile, Payment requests,
              Transactions, Wallets & contacts, Reports & export, Settings
```
