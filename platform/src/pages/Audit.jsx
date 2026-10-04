import { useStore } from '../state/store.jsx';
import { dateTime, download, toCsv } from '../lib/format.js';
import { Avatar } from '../components/ui.jsx';

export default function Audit() {
  const { state } = useStore();
  const user = (id) => (id === 'system' ? { name: 'TRNZIT (automatic)' } : state.users.find((u) => u.id === id));
  const exportCsv = () =>
    download('trnznd-audit-log.csv', toCsv([['Time (UTC)', 'User', 'Action', 'Detail'], ...state.audit.map((a) => [a.at, user(a.userId)?.name, a.action, a.detail])]));
  return (
    <div>
      <div className="page-head">
        <div><h1>Audit log</h1><p>Who did what, and when. Append-only in production.</p></div>
        <span className="spacer" />
        <button className="btn" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
            <tbody>
              {state.audit.map((a) => (
                <tr key={a.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dateTime(a.at)}</td>
                  <td><div className="row"><Avatar user={user(a.userId)} />{user(a.userId)?.name}</div></td>
                  <td>{a.action}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
