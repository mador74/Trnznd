# Placeholders, open questions and assumptions

On the site, every placeholder is shown with a dashed blue outline (`.ph`, `.ph-block`, `.photo-ph`) so it can't be mistaken for final copy. To list them, run `grep -rn 'class="ph' src/`.

## Answers received (applied to the site)

- **Letter "i":** round dot approved and now used in every logo file. The square-dot option has been removed.
- **Card pre-authorisation hold:** $15.
- **Credentials:** Trnzit stores the API details used to connect accounts. Multi-sig signing keys are held by users, never by Trnzit. The copy now says "private keys" wherever it promises Trnzit holds none, and says plainly that Trnzit stores API details.
- **Basic plan:** transaction history only, with no reconciliation and no invoicing.
- **Design changes requested:** "Purpose Beyond Payment" removed from the footer (note: Brand Guide p.22 rule 04 asks for it on external communications); large hero Enso removed; header now reads "Treasury Management, by Trnznd" after the wordmark.

- **Multi-sig wallets:** Safe (formerly Gnosis Safe) for EVM-compatible assets, and Squads for Solana-based assets. Named on Platform §06, the new Providers page, FAQ and the Home trust strip (names only, no logos; check each brand's logo/trademark guidelines before adding logos).
- **Providers page added** (`providers.html`, in the main menu) with placeholder slots for the exchanges and on/off-ramp providers to be listed, plus a placeholder to disclose any referral or commercial arrangements. Listing providers that users open accounts with may count as a financial promotion or introduction in some jurisdictions; include this in the legal review.
- **Security practices:** a typical draft (encryption in transit and at rest, key management, MFA, staff access, testing, incidents) is on the Security page inside a dashed "Draft · to be confirmed by Trnzit's technical team" box. It must be checked before launch.
- **Approval examples:** every demonstration now uses 2 of 3 or 3 of 5.

- **Named providers:** exchanges Kraken, Binance, Coinbase, KuCoin and MEXC; on/off-ramp MoonPay; TRNZND S.A. for minting and burning ZEND only (labelled as a Trnznd Group company). Names and website links only, no logos. Links use `rel="nofollow"` and open in a new tab.
- **Disclosure:** Trnzit and its affiliates have no commercial or referral arrangements with listed providers and receive no payment from them; links are for information only. Note for legal review: TRNZND S.A. is itself an affiliate, so the page says so next to its listing.

- **Plan changes:** upgrades any time, with a new plan and contract starting immediately; downgrades at next renewal. Annual upgrades: a new 12-month plan starts at the higher price, and the unused part of the current plan is credited against it. Monthly upgrades: the new plan starts immediately at the higher fee; unused fee is credited against the first new monthly fee, then the new terms apply.
- **Set-up:** takes minutes; providers and team members can be added as soon as payment is confirmed.

- **Hosting:** slugs confirmed as www.trnznd.io/trnzit and www.trnznd.io/zend.
- **Payment methods:** Visa, Mastercard, Google Pay, Apple Pay, PayPal (USD), USDT, USDC, shown as a horizontal logo row on Pricing and Home. Logo artwork comes from open-source icon sets (simple-icons, payment-icons, cryptocurrency-icons). **Before launch, replace with official artwork from each brand's media kit and follow their acceptance-mark rules** (Apple and Google in particular require their official marks). Free trial extended to **30 days** for card, Google Pay, Apple Pay and PayPal payments. Assumed: the USDT/USDC limited trial (one connection) is also 30 days, and the $15 pre-authorisation applies to Google Pay, Apple Pay and PayPal as well as cards.

- **Prices:** normal prices $29 / $99 / $249 a month shown struck through; new users pay $14.99 / $49.99 / $124.99 a month for their first 12 months. **Assumed** annual prices keep "2 months free" (10 × monthly): normal $290 / $990 / $2,490, new-user first year $149 / $499 / $1,249 (cents dropped). New user = never had a Trnzit account; returning if a new email connects a provider that is/was connected to another account, or if a plan was previously cancelled. Upgrades during the discount period get the discounted higher plan on the standard upgrade terms. The discount still ends 12 months after the user first joined.

- **Free plan and trials (latest):** a Free plan with no end date replaces the old limited trial (one user, one exchange or wallet connection, balances and history; assumed same feature set as Basic otherwise). Paid plans: 30-day free trial for card, Google Pay, Apple Pay and PayPal; payment details authorised at sign-up, no payment taken, first payment on day 31 unless cancelled. The $15 pre-authorisation hold has been removed. USDT/USDC: paid in advance, full refund if cancelled within 30 days. Annual prices are now shown first, with monthly as an option.

- **Teams replaces Basic** (same prices for now, pending confirmation): 5 users, payment-threshold approvals, audit trails, standard roles, up to 5 exchange and custody connections, white-glove onboarding, 1-working-day email.
- **Standing rule:** every plan card shows greyed-out "No …" lines for anything it doesn't include.

Items 1, 2, 6, 9 and 15 below are answered. Still open: technical sign-off of the draft security text, and the names of the exchanges and on/off-ramp providers. Still open: how API details are encrypted and protected, and which multi-sig wallets are supported.

## A. Open questions (these block launch or change the copy)

Ordered by how much the answer changes the site.

1. **Exchange and bank credentials vs "never hold keys".** Trading, conversion and read-only bank connections normally need API keys or OAuth tokens that Trnzit would store. The site says Trnzit never holds *private keys or seed phrases* and that connections use *scoped, revocable access*. How are connection credentials stored and protected? That answer goes on the Security page.
2. **Multi-signature signing.** Who holds the signing keys in a Trnzit multi-sig wallet? If Trnzit, or a Trnznd entity, holds even one key share, the "never hold keys" claim is wrong. Which multi-sig wallets or custodians are supported?
3. **Signing flow for self-custody wallets.** When an approved instruction goes to a self-custody wallet, where is it signed (the member's own wallet or device)? The FAQ currently says "signing happens in your own wallet" with a confirm flag.
4. **Fiat settlement.** Bank connections are read-only on every plan, so invoicing and direct settlement can only be executed by crypto custodians and wallets. Is that right? The copy currently implies settlement via "your own custodian or wallet", as the brief worded it.
5. **Regulatory position.** The site states that Trnzit is a technology platform only. Please get legal confirmation, per jurisdiction, that the trade and convert features and their marketing don't fall within a regulated activity or a financial-promotion regime. For example, the UK's cryptoasset financial promotions rules have applied since October 2023. I'm not certain how they apply to Trnzit, so this needs counsel. A `[Legal review]` flag sits on Platform §07.
6. **Basic plan reconciliation** (as flagged in your brief).
7. **Plan availability for multi-sig wallets and trading.** The brief doesn't assign these to tiers, so the table shows "To confirm".
8. **Premium connection limit.** Premium is "up to 5 connections", the same as Basic. Is that intentional, given Premium adds banks and cards?
9. **Card pre-authorisation `[AMOUNT]`**, its purpose, and when it's released.
10. **Cancellation mechanics.** How is 30 days' notice given, and what happens if notice falls inside 30 days of renewal? What is the refund position? UK and EU consumer cancellation rights may apply to individuals.
11. **USD payment methods.** Is it card only, or bank transfer as well? Which networks are accepted for USDT and USDC?
12. **Taxes.** Are prices exclusive of VAT or sales tax?
13. **Is the Basic plan individual-only?** The site assumes it is ("1 individual user").
14. **Role model.** The site shows Viewer, Initiator, Approver and Admin as illustrative roles. Are these the real names?
15. **Upgrade and downgrade rules,** and proration.
16. **Login URL.** The header has no "Log in" link because no app URL was supplied.
17. **Legal entity name and registered address** (footer, Terms, Privacy).
18. **Contact details:** sales email, phone, security email and disclosure policy.
19. **Production domain.** Set the `SITE_URL` environment variable at build time; it defaults to `https://www.example.com` for canonical, OG and sitemap URLs.
20. **Form back end.** The trial form validates in the browser but sends nothing. It needs an endpoint, plus spam protection and confirmation copy.

## B. Placeholders on the site

| Where | Placeholder |
|---|---|
| Home › trust strip | Supported-provider logos (no partners invented) |
| Home, Pricing, FAQ, Contact, Terms | `[AMOUNT]` card pre-authorisation hold |
| Platform §01–§08 | Plan availability, role model, export formats, per-provider scopes, multi-sig signing keys, financial-promotion review |
| Security › Security practices | Credential storage, encryption, hosting region, member authentication, audits and certifications (only once real), incident response, regulatory status |
| Security, FAQ | `[security contact email]`, disclosure policy |
| Pricing › comparison | Reconciliation (Basic), multi-sig wallets, trade and convert: "To confirm" |
| Pricing › terms | Hold release, notice mechanics, accepted networks, tax treatment |
| FAQ | Signing flow, supported providers, USD methods and networks, hold purpose, notice, set-up time, plan changes |
| About | Leadership, company details, registered address; photography |
| Organisations | Photography (treasury team) |
| Contact | `[contact email]`, `[phone]`, authentication options, form endpoint |
| Footer (every page) | `[Legal entity name]` |
| Legal: Terms, Privacy, Cookies | Structure only. **Not legal text.** All wording to be drafted by counsel. |
| Mock-ups | Every figure, name and reference is fictional and labelled "Illustrative data". Halden &amp; Co. and Arden Logistics are invented names. |

## C. Assumptions I made

- **Enso colour:** solid Electric Blue for Trnzit, per the brief (see conflict C4 in the guide reading).
- **The new "i"** (two options on `brand/logo.html`). Option A, a square dot, is in use. The stem is 58 units, the same as "r" and "n". The dot's top aligns with the "t" ascender, with a 33-unit gap to the stem. Spacing to "z" is 28 units, matching the original z→n gap. **This needs your approval.**
- **Wordmark letters** were traced from the supplied 2000px PNG, not from master vector artwork. A type designer should compare them with the original AI/SVG before final release.
- **Clear space** equals the wordmark x-height (the guide gives no value).
- **Stacked lockup** keeps the horizontal lockup's Enso-to-wordmark scale.
- **Light-first** per guide p.18 and the brief (conflicts with p.10).
- **Helvetica** is served via the system font stack, with no web licence assumed. **Inter** is self-hosted (SIL OFL 1.1), Latin subset, 48 KB.
- **"Payable in USD"** is shown as card in USD. USDT and USDC are shown as stablecoin payments.
- **"No single user has unilateral control"** is described as something business accounts *can enforce* through policies, not as a default that applies whatever the configuration. Please confirm whether policies are mandatory for business accounts.
- **The current site's design language.** I could not load trnznd.io from the build environment (the network proxy blocked it). I followed the guide's own layouts (overline numbering, teal rules, gradient top bar, Midnight footer), which appear to mirror the site, but **I have not visually compared the result with trnznd.io**.
- **No cookies, analytics or third-party scripts** are included, so no consent banner is needed as built. That changes if analytics are added.
- **Annual savings** are shown as $30, $100 and $200 (12 × monthly minus the annual price).

## D. Things I deliberately did not do

- I didn't invent statistics, customer logos, testimonials, licences, certifications, audits or integration partners.
- I didn't name real exchanges, banks or custodians. Mock-ups use generic labels ("Exchange account A", "Custodian B").
- I didn't describe Trnzit as a bank, wallet provider, custodian, exchange or investment platform. The copy states the opposite wherever it's relevant.
- I didn't use Violet or Cyan as standalone accents (two-accent rule).
