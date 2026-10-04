# TRNZND Treasury: production architecture and open decisions

This document covers what it takes to turn the prototype into a real service. Statements about third-party providers are general. **Verify each provider's current API documentation, rate limits and terms before building against it.**

## 1. Open product decisions (need an answer before build)

1. **What do the approvals actually control?** The platform uses read-only access, so it *cannot* stop anyone from moving funds at the provider. There are three options:
   - **A. Governance record (what the prototype does).** Requests are approved in TRNZND, a person executes them at the provider, and the tx hash is recorded and matched in the ledger. This is cheap and low-risk, but enforcement is procedural, not technical.
   - **B. Enforced at the asset layer.** Use the provider's own policy engine (many MPC custodians support approval quorums) or an on-chain multisig wallet. TRNZND proposes the transaction, and each signer signs with their *own* key. Signature thresholds are then cryptographically enforced. Each integration is more work.
   - **C. TRNZND holds withdrawal-enabled keys and executes the transfer.** This is not recommended. It contradicts the read-only security model, makes TRNZND a high-value target, and likely changes the regulatory position (see §6).
   - *Recommendation:* launch with A, add B for the custodians and multisig wallets your customers use most, and avoid C.
2. **Seat limit.** The brief says "as many sub-users as they like, to a maximum of 5 within USD 50/month". The prototype reads this as *Owner + 5 sub-users, hard cap*. If the intent is "5 included, more at extra cost", a per-seat add-on price is needed.
3. **Reporting currency and pricing source.** The prototype values everything in USD at static prices. Production needs historical prices at transaction time (for accounting) and live prices (for the dashboard), plus a choice of base currency.
4. **Accounting export.** Should the ledger sync to accounting software (journals per connection, with gain/loss on disposals), or is CSV enough for v1?

## 2. System overview

```
Browser (this React app)
   │  HTTPS + session (SSO / passkeys + mandatory 2FA)
   ▼
API service ── Postgres (tenants, users, roles, policies, requests, ledger, audit)
   │      └── Secrets vault / KMS (encrypted provider credentials)
   ├── Connector workers (one adapter per provider type) ─► exchanges / custodians (read-only APIs)
   ├── Chain indexers (address/xpub watchers)             ─► blockchain nodes or indexing APIs
   ├── Pricing service (live + historical)
   ├── Billing (card processor + stablecoin invoice watcher)
   └── Notifications (email / push for "needs your signature")
```

## 3. Connections and data ingestion

- **Adapter interface** (one per provider): `verifyCredentials()` (also confirms the key has *no* trade or withdraw scope), `fetchBalances()` and `fetchTransactions(since)`. Normalise everything into a single `Transaction` shape: type, asset, amount, fee, counterparty, address, hash/ref, timestamp, raw payload.
- **Wallets:** these take only a public address or xpub. Use per-chain indexers to read transfers, including token transfers (USDT/USDC contracts on each chain).
- **Sync:** run an incremental cursor per connection, use webhooks where the provider offers them, and poll on a schedule as a fallback. Make it idempotent by upserting on (connection, provider tx id).
- **Internal transfers:** match an outflow from connection X with the inflow to connection Y (same hash, or same amount within a time window) so they net to zero in reporting. The prototype already excludes these from cash flow.
- **Build vs buy:** writing adapters for every exchange is a large ongoing cost. Data-aggregation vendors exist for this. Evaluate their coverage, cost and data-residency terms against building the top N adapters yourself.

## 4. Security model

- **Credential handling:** encrypt API secrets with envelope encryption (a KMS-managed key). Store them write-only, so they are never returned to the browser. Decrypt them only inside connector workers, and reject keys whose scopes include trading or withdrawals.
- **Authentication:** require 2FA for every user, and require a fresh 2FA step-up for each approval signature. Support SSO for larger customers.
- **Authorisation:** enforce role checks server-side; the prototype's `PERMISSIONS` table is the starting matrix. Re-run the approval engine (`lib/policy.js`) on the server for every signature. Never trust the client's status.
- **Policy edits are sensitive.** Consider requiring approval to change approval policies or the whitelist itself. Whitelisting already goes through the flow in the prototype. Add a time-lock on new addresses.
- **Audit log:** append-only (no UPDATE/DELETE grants), with each row optionally hash-chained so tampering is detectable.
- **Tenant isolation:** add a tenant id on every row, enforced with row-level security.

## 5. Billing

- **Card:** use a PCI-DSS compliant processor's hosted fields or checkout, so card data never reaches TRNZND servers. Run it as a monthly USD 50 subscription.
- **USDT/USDC:** issue a unique deposit address per invoice (or use a crypto payment processor). Watch the chain for the exact amount, then mark the invoice paid after N confirmations. Handle underpayment, overpayment and the wrong network explicitly.
- **Seat cap:** enforce it server-side at invite time. The prototype enforces it in the reducer and UI.

## 6. Compliance (needs legal advice; not settled here)

I am not able to give a definitive regulatory answer. A read-only aggregation and record-keeping service is generally treated differently from a service that holds or moves customer assets, but this varies by jurisdiction. The relevant frameworks may include FATF virtual-asset guidance, the EU's MiCA regime, and local VASP registration rules. Accepting stablecoins for your own subscription fees, and anything resembling option C in §1, should be reviewed by counsel in each market you sell into. Data protection (e.g. GDPR) applies to user and counterparty data either way.

## 7. Suggested build order

1. Auth, tenants, roles, audit log, and the server-side policy engine (port `lib/policy.js` and its tests).
2. The wallet connector (public addresses) for the stablecoin chains your customers use most. This involves no third-party credentials, so it is the fastest way to get real data.
3. Two or three exchange/custodian adapters chosen from customer demand.
4. The ledger, reconciliation and CSV export; then historical pricing.
5. Billing (card first, then stablecoin invoices).
6. Approval enforcement integrations (option B).
