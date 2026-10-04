// DRAFT key terms for discussion. Not legal advice; every section must be written and reviewed by
// qualified counsel for each jurisdiction where TRNZIT is offered.

const SECTIONS = [
  ['1. Who we are', [
    'TRNZIT Treasury Management is software built and operated by TRNZND UAE [full legal name, licence or registration number and registered address to be inserted], part of the TRNZND group of companies.',
  ]],
  ['2. TRNZIT is not a custodial platform', [
    'TRNZIT never holds, controls or takes custody of your funds, digital assets or private keys.',
    'Balances and transactions shown in TRNZIT are read from the providers you connect.',
    'When an authorised user of your business releases a payment or conversion, TRNZIT passes that instruction to the provider holding the assets. That provider executes it. For your own wallets, you sign in your own wallet app.',
  ]],
  ['3. Third-party providers', [
    'Services such as fiat on-ramps, custody, exchange, conversion and open banking are provided by independent third-party providers, licensed or registered as required in their own jurisdictions.',
    'Each provider contracts with you directly under its own terms, and is responsible for its own checks, licences and execution.',
    'ZEND is issued by TRNZND S.A., a company incorporated in Panama and a separate legal entity from TRNZND UAE. Minting and redemption are agreements between your business and TRNZND S.A., under TRNZND S.A.’s own terms. Funds for minting are paid to TRNZND S.A., never to TRNZND UAE or through TRNZIT.',
    'Related-party disclosure: TRNZND UAE and TRNZND S.A. have the same ultimate beneficial owners. They are distinct legal entities and are run as separate businesses. Using ZEND is optional: TRNZIT works with any supported stablecoin. [Counsel to confirm whether any referral arrangement between the two companies must also be disclosed.]',
  ]],
  ['4. Payments to TRNZIT', [
    'TRNZND UAE never receives payments from you through TRNZIT, except your subscription for the plan you choose (Basic, Premium or Institution).',
    'Subscriptions can be paid by card, or in USDT or USDC. Billing is annual by default, at 10 times the monthly price paid in advance. Card payers can choose monthly billing instead; USDT and USDC payments are annual only.',
    'If a card payment fails, we will notify you. You have 14 days to update your card or settle the payment; if you do not, your subscription is cancelled automatically at the end of those 14 days. [Counsel to confirm whether any unpaid amount remains owed after automatic cancellation.]',
    'The Basic plan supports crypto connections only. Bank account and card connections (open banking) need the Premium or Institution plan.',
  ]],
  ['5. Free trial, 12-month agreement and renewal', [
    'New customers who authorise a credit or debit card in advance get a 14-day free trial. Nothing is charged during the trial.',
    'You can cancel at any time during the 14 days, at no cost. The card authorisation is then released.',
    'If you do not cancel within the 14 days, your subscription becomes a 12-month agreement starting on the day the trial ends. Your card is charged on that day: either the full annual price in advance, or the first of 12 monthly payments.',
    'The agreement renews automatically for a further 12 months on each renewal date, unless you cancel at least 30 days before that date.',
    'After the free trial, a cancellation given at least 30 days before the next renewal date takes effect on that date. A cancellation given later takes effect on the following renewal date, so the agreement renews once more. Until the cancellation takes effect you keep access, and the payments due before then are still payable.',
    'We will email a reminder 6 weeks before each renewal date and again 14 days before it.',
    'You can upgrade at any time. The upgrade applies immediately, and you pay the price difference for the rest of the current billing period (pro rata). Downgrades and changes between monthly and annual billing take effect on the next renewal date.',
    '[Counsel to confirm whether refunds apply in any case.]',
    '[Counsel to confirm that this trial-to-commitment and automatic-renewal model, the pre-authorisation and the reminders meet consumer-protection, automatic-renewal and card-scheme rules in each country where TRNZIT is offered.]',
  ]],
  ['6. Your responsibilities', [
    'You choose who can use your account, their roles, your approval rules and who may release payments.',
    'You are responsible for checking recipient addresses and networks. Blockchain payments cannot be reversed once confirmed.',
  ]],
  ['7. Transaction records', [
    'TRNZIT keeps a record of your transactions, reconciliations and user actions for your audit trail, and lets you export them.',
    'TRNZIT is not an accounting system and does not provide accounting, tax or legal advice. Use your own accounting software and advisers for your books.',
  ]],
  ['8. Data protection', ['[To be drafted for each jurisdiction, e.g. Brazil (LGPD), Nigeria (NDPA), South Africa (POPIA), Indonesia (PDP Law).]']],
  ['9. Liability, governing law and disputes', ['[To be drafted by counsel.]']],
];

export default function Terms() {
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <div className="page-head">
        <div>
          <h1>Terms and conditions</h1>
          <p>Key points, in plain language.</p>
        </div>
      </div>
      <div className="notice warn small">Draft for discussion only, not legal advice. Each section must be written and reviewed by qualified counsel in every jurisdiction where TRNZIT is offered.</div>
      {SECTIONS.map(([h, paras]) => (
        <section key={h} className="card card__body stack small">
          <h2>{h}</h2>
          {paras.map((t) => <p key={t} style={{ margin: 0 }}>{t}</p>)}
        </section>
      ))}
    </div>
  );
}
