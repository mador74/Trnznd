// DRAFT key terms for discussion. Not legal advice; every section must be written and reviewed by
// qualified counsel for each jurisdiction where TRNZIT is offered.

const SECTIONS = [
  ['1. Who we are', [
    'TRNZIT Treasury Management is a software platform operated by TRNZND [legal entity name, registration number and registered address to be inserted].',
  ]],
  ['2. TRNZIT is not a custodial platform', [
    'TRNZIT never holds, controls or takes custody of your funds, digital assets or private keys.',
    'Balances and transactions shown in TRNZIT are read from the providers you connect.',
    'When an authorised user of your business releases a payment or conversion, TRNZIT passes that instruction to the provider holding the assets. That provider executes it. For your own wallets, you sign in your own wallet app.',
  ]],
  ['3. Third-party providers', [
    'Services such as fiat on-ramps, custody, exchange, conversion, open banking and ZEND minting and redemption are provided by third-party providers that are fully compliant in their respective jurisdictions.',
    'Each provider contracts with you directly under its own terms, and is responsible for its own checks, licences and execution.',
    'ZEND minting and redemption are provided by TRNZND in its role as issuer of ZEND, under separate terms. [Counsel to confirm the entity structure and wording.]',
  ]],
  ['4. Payments to TRNZIT', [
    'TRNZIT never receives payments from you, except your monthly subscription for the plan you choose (Basic, Premium or Institution).',
    'Subscriptions can be paid by card, or in USDT or USDC.',
  ]],
  ['5. Your responsibilities', [
    'You choose who can use your account, their roles, your approval rules and who may release payments.',
    'You are responsible for checking recipient addresses and networks. Blockchain payments cannot be reversed once confirmed.',
  ]],
  ['6. Accounting and reports', [
    'Ledgers, journals and reports are tools to support your bookkeeping under the framework you select (for example IFRS or US GAAP).',
    'They are not accounting, tax or legal advice. Your accountant decides your accounting policies.',
  ]],
  ['7. Data protection', ['[To be drafted for each jurisdiction, e.g. Brazil (LGPD), Nigeria (NDPA), South Africa (POPIA), Indonesia (PDP Law).]']],
  ['8. Liability, governing law and disputes', ['[To be drafted by counsel.]']],
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
