# TRNZIT Treasury Management, by TRNZND: production architecture and open decisions

This document covers what it takes to turn the prototype into a real service. Statements about third-party providers are general. **Verify each provider's current API documentation, rate limits and terms before building against it.**

## 1. Open product decisions (need an answer before build)

1. **Non-custodial principle (decided).** TRNZIT never holds private keys and never has custody of customer funds. Payments work like this:
   - **Instructions, not custody.** A released payment is an *instruction* that TRNZIT passes, by API, to the provider that already holds the assets: the customer's custodian, exchange or broker. The provider executes it under its own controls. For a self-custody wallet, TRNZIT prepares the transaction and hands it to the customer's own wallet to sign; the key never leaves their device.
   - **Final release by an authorised person.** After the approval rules are met (e.g. 2 of 3), the final step must be done by a user the business has authorised to release payments, confirmed with their own second factor. The Owner is always a releaser. Other users are authorised individually on the Team page, and Viewers never can.
   - **Credentials TRNZIT does keep.** These are API credentials only, never wallet keys: a read-only key for data, plus, only where the customer switches sending on, a credential that can *submit* withdrawal instructions. The server only uses the second credential after the approval rules and the releaser's confirmation. Prefer providers that also require approval on their side for API-submitted payments (many institutional custodians support approval workflows), and require the customer to whitelist destinations at the provider as well.
   - **Every release re-checks:** releaser authorisation, approval status, balance, whitelist and network match. The ledger entry is written only when the provider reports the on-chain transaction.
   - **Verify with each provider:** whether its API supports submitting withdrawals, whether API-submitted payments can require approval in the provider's own app, and what its terms say about third-party platforms submitting instructions. This varies by provider, and I have not checked specific providers.
   - **Not simulated in the demo:** fee estimates are fixed numbers. Production needs live fee quotes, plus handling for provider rejections, stuck transactions and partial failures.
   - **Regulation:** passing payment instructions without custody is generally treated differently from holding funds, but that is not guaranteed everywhere, and "travel rule" requirements may still apply to the providers involved. Confirm with counsel per market (see §6).
1a. **Conversions (decided).** Users can convert holdings inside a single connection wherever the provider's API allows it: fiat ↔ stablecoin, stablecoin ↔ crypto, and so on. Same non-custodial model as payments: TRNZIT passes a one-off instruction, released by an authorised user with their own second factor, and the provider executes at its own rate.
   - **No automated or programmable trading.** Every conversion is a single, user-released instruction. There are no strategies, schedules or bots.
   - **Capabilities come from the provider.** In production, read the supported pairs, limits and minimum sizes from each provider's API (or a maintained capability table) rather than assuming. The prototype stores them per connection as examples.
   - **Quotes.** Show the provider's own quote and fee where its API offers firm quotes, with expiry. Otherwise label the quote as indicative and show the executed rate afterwards. The demo's 0.10% fee is a placeholder.
   - **Credentials.** Converting needs an API permission to place spot trades. Keep it separate from the read-only data key and from any withdrawal-instruction key, so a conversion key can never move funds out.
   - **Accounting.** Each conversion is a disposal of one asset and an acquisition of another. That can be a taxable event in many jurisdictions, so record the executed rate and fee for cost-basis reporting.
   - **Regulation.** Facilitating conversions may itself be a regulated activity in some markets even without custody. Raise it with counsel alongside payments (§6).
1b. **Partner integrations (decided in principle; terms to confirm).** None of these changes the non-custodial model: the partner or the customer's own wallet holds the assets.
   - **MoonPay (fiat on-ramp).** TRNZIT hands the business to MoonPay's own onboarding and checkout, then connects the resulting account read-only. **To verify with MoonPay:** whether it offers business accounts, and MPC custody accounts in the business's name (the prototype assumes both); which fiat currencies and payment methods are available in each market; whether it has an API for balances; partner/referral terms; and whether checkout can be embedded or must redirect. The prototype's 1% fee is a placeholder.
   - **Safe and Squads (self-custody multisig).** TRNZIT prepares wallet setup and payment proposals; owners sign in their own wallets, and the M-of-N rule is enforced on-chain. Safe offers SDKs and a transaction service for proposing and collecting signatures; Squads offers similar tooling on Solana. Confirm current APIs, supported networks and any fees with each. TRNZIT approval rules run before a proposal is created, so the business gets both layers.
   - **TRNZND (ZEND issuer).** Minting: the business completes TRNZND's onboarding, sends fiat by bank transfer with a unique reference, and receives ZEND on Ethereum, Solana or Tron in its chosen wallet. Redemption: ZEND is sent to TRNZND's redemption address on the same network (one whitelisted address per network), and TRNZND pays fiat to the business's bank. **To confirm:** accepted currencies, minimums, fees, settlement times, and how the mint and redemption rate relates to the reserve basket. The prototype values ZEND at $1.00 purely as a placeholder.
2. **Plan limits.** Basic is $15 for 1 user and 5 connections, with no approval rules. Premium is $50 for 5 users in total (including the owner) and 5 connections. Institution is $100 with no limits. The prototype assumes that bank and card connections count toward the connection limit, and that invoices and open banking are on every plan. Confirm both.
3. **Reporting currency and pricing source.** The prototype stores values in USD and converts them for display into each user's chosen currency, using static demo rates. Production needs live FX and crypto prices for the dashboard, from a named data provider with timestamps shown. It also needs historical prices at transaction time for accounting. Decide whether the organisation's *reporting* currency (used for books and exports) is separate from each user's *display* currency; the prototype treats them as different things.
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

## 3a. Open banking (bank accounts and cards)

- **How it connects:** use a licensed open-banking aggregator for read-only *account information* access. The customer approves access on their own bank's page, and TRNZIT never sees their bank login.
- **Read-only by design:** reading balances and transactions is a different regulated activity from *initiating payments*. The prototype only reads. Adding payments from the platform would need its own licence or a partner, plus approval enforcement.
- **Consent renewal:** banks require the customer to re-confirm access periodically. The interval depends on the country and the rules change, so check current local requirements. The prototype shows a renewal countdown and flags it 14 days ahead.
- **Coverage:** aggregator coverage varies by country and bank, and credit-card coverage is patchier than current accounts. Check coverage in your target markets before committing to a vendor.

## 3b. Invoicing

- **PDF:** generated server-side in production, so the emailed attachment and the archived copy are identical and can't be altered by the browser. The prototype builds the same layout in the browser with jsPDF.
- **Email:** send through a transactional email service, from a verified sending domain. Keep a delivery log (sent, bounced) per recipient. The prototype records the send but does not email anyone.
- **Getting paid in crypto:** print the receiving network clearly; a payment on the wrong network can be unrecoverable. Use a fresh deposit address per invoice where the wallet or custodian supports it, so receipts match invoices automatically. The prototype only invoices into self-custody wallets with a known address, or into bank accounts.
- **Tax:** a single tax rate per invoice is a placeholder. Real VAT/GST rules (reverse charge, multiple rates, tax IDs on the invoice) depend on the jurisdiction and should be confirmed with an accountant.

## 4. Security model

- **Credential handling:** encrypt API secrets with envelope encryption (a KMS-managed key). Store them write-only, so they are never returned to the browser. Decrypt them only inside connector workers. Reject data keys whose scopes include trading or withdrawals. Keep any conversion (spot-trade) credential and any withdrawal-instruction credential separate from each other, each used only by its own service after an authorised release.
- **Authentication:** require 2FA for every user, and require a fresh step-up (preferably a passkey) for each approval and for every payment release. Support SSO for larger customers.
- **Authorisation:** enforce role checks server-side; the prototype's `PERMISSIONS` table is the starting matrix. Re-run the approval engine (`lib/policy.js`) on the server for every signature. Never trust the client's status.
- **Policy edits are sensitive.** Consider requiring approval to change approval policies or the whitelist itself. Whitelisting already goes through the flow in the prototype. Add a time-lock on new addresses.
- **Audit log:** append-only (no UPDATE/DELETE grants), with each row optionally hash-chained so tampering is detectable.
- **Tenant isolation:** add a tenant id on every row, enforced with row-level security.

## 5. Billing

- **Card:** use a PCI-DSS compliant processor's hosted fields or checkout, so card data never reaches TRNZIT servers. Run it as a monthly USD 50 subscription.
- **USDT/USDC:** issue a unique deposit address per invoice (or use a crypto payment processor). Watch the chain for the exact amount, then mark the invoice paid after N confirmations. Handle underpayment, overpayment and the wrong network explicitly.
- **Plan limits:** enforce user and connection caps server-side, at invite or connect time and on downgrade. The prototype enforces them in the reducer and UI.

## 6. Compliance (needs legal advice; not settled here)

I am not able to give a definitive regulatory answer. A read-only aggregation and record-keeping service is generally treated differently from a service that holds or moves customer assets, but this varies by jurisdiction. The relevant frameworks may include FATF virtual-asset guidance, the EU's MiCA regime, and local VASP registration rules. Accepting stablecoins for your own subscription fees, and the payment-instruction feature in §1, should be reviewed by counsel in each market you sell into. The non-custodial design (no keys, no customer funds) is the main fact counsel will need. Data protection (e.g. GDPR) applies to user and counterparty data either way.

## 7. Suggested build order

1. Auth, tenants, roles, audit log, and the server-side policy engine (port `lib/policy.js` and its tests).
2. The wallet connector (public addresses) for the stablecoin chains your customers use most. This involves no third-party credentials, so it is the fastest way to get real data.
3. Two or three exchange/custodian adapters chosen from customer demand.
4. The ledger, reconciliation and CSV export; then historical pricing.
5. Billing (card first, then stablecoin invoices).
6. Approval enforcement integrations (option B).
