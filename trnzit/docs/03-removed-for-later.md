# Content removed for now, to add back later

Removed on request because Trnzit cannot yet connect to banks or other fiat institutions. The full previous wording is in git history: see the commit "Remove bank and card connections; crypto-only on EVM, Solana and Tron" and its parent.

## What was removed

- **Bank accounts (read-only)** and **credit cards (read-only)** as connection types, everywhere:
  - Home: hero text, capability card 01, connection section, "Who it's for" card
  - Platform: page intro, §01 Unified balances (incl. "bank and card connections are read-only"), §02, §04, §08 and the "Scoped access" card
  - Pricing: Premium "connections across crypto, banks (read-only) and credit cards (read-only)", Basic "Crypto connections only", comparison rows "Bank accounts (read-only)" and "Credit cards (read-only)"
  - FAQ: "Can Trnzit move money from my bank account?" (whole question), "What can I connect?", "What is Trnzit?", "Is Trnzit a bank…"
  - Security, Organisations, Individuals, About, Providers ("Banks, cards and custodians" section)
  - New-user definition: "connect a bank account, wallet…" now reads "connect a wallet, exchange account, custodian account…"
- **Mock-ups:** bank "Operating account (GBP)" and "Corporate card ····4821" rows (balances), "Payroll batch (£)" and card "Software licence" rows (reconciliation), and all BTC amounts (balances, reconciliation, trade, approvals). They're replaced with Solana, Tron and Ethereum assets.
- **Diagram:** "Bank account · read-only balances & history" node, replaced by "Hardware wallet".

## What was added

- Supported connections: crypto exchanges, crypto custodians, self-hosted software wallets, hardware wallets.
- Supported chains: **EVM-compatible chains, Solana and Tron only**. Added to Platform §01, Home capability card, FAQ ("Which blockchains are supported?"), comparison table and Providers page.
- Unchanged: paying for Trnzit by Visa, Mastercard, Google Pay, Apple Pay or PayPal (these are subscription payment methods, not connections).

## Also removed later: reconciliation and invoicing

- Platform §04 "Transaction history & reconciliation" became "Transaction history"; §05 "Invoicing & direct settlement" (with the invoice mock-up) was replaced by "Address whitelisting".
- Home capability cards, Organisations "Reporting & reconciliation", Security wording, comparison rows "Reconciliation" and "Invoicing & direct settlement", and the greyed "No reconciliation"/"No invoicing" lines.
- Mock-ups: invoice references (INV-2026-0147) became payment references (PAY-2026-0147); "Matched/Unmatched" statuses became "Confirmed/Pending".
- The invoice mock-up file `src/partials/mock-invoice.html` is kept, unused, for later.
