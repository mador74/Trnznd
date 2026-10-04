import Ledger from '../components/Ledger.jsx';

export default function Transactions() {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Transactions</h1>
          <p>Every movement from every connection in one ledger — what, when, how much and who. Click a row to categorise or reconcile it.</p>
        </div>
      </div>
      <Ledger />
    </div>
  );
}
