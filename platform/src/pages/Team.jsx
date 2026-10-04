import { useState } from 'react';
import { subUserCount, useStore } from '../state/store.jsx';
import { MAX_SUB_USERS, PERMISSIONS, ROLES, can } from '../data/seed.js';
import { Avatar, Modal, RoleBadge, StatusBadge } from '../components/ui.jsx';

const PERM_LABELS = {
  manageBilling: 'Manage plan & billing',
  manageTeam: 'Invite and manage users',
  manageConnections: 'Add / remove connections',
  managePolicies: 'Edit approval policies',
  createRequest: 'Create approval requests',
  reconcile: 'Reconcile & categorise',
  export: 'Export ledger',
};

export default function Team() {
  const { state, dispatch, me } = useStore();
  const [inviting, setInviting] = useState(false);
  const used = subUserCount(state.users);
  const manage = can(me, 'manageTeam');
  const visible = state.users.filter((u) => u.status !== 'removed');

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p>The business owner plus up to {MAX_SUB_USERS} sub-users on the Premium plan. Every change is written to the audit log.</p>
        </div>
        <span className="spacer" />
        {manage && <button className="btn primary" disabled={used >= MAX_SUB_USERS} onClick={() => setInviting(true)}>+ Invite user</button>}
      </div>

      <div className="card card__body">
        <div className="row small"><strong>Sub-user seats</strong><span className="spacer" />{used} of {MAX_SUB_USERS} used</div>
        <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${(used / MAX_SUB_USERS) * 100}%` }} /></div>
        {used >= MAX_SUB_USERS && <div className="notice warn small" style={{ marginTop: 10 }}>All seats are in use. Remove a user to free a seat.</div>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Role</th><th>2FA</th><th>Status</th><th /></tr></thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td><div className="row"><Avatar user={u} /><div><strong>{u.name}</strong><div className="muted small">{u.email}</div></div></div></td>
                  <td>
                    {manage && u.role !== 'owner' && u.id !== me.id ? (
                      <select style={{ width: 'auto' }} value={u.role} onChange={(e) => dispatch({ type: 'UPDATE_USER', id: u.id, patch: { role: e.target.value } })}>
                        {Object.entries(ROLES).filter(([k]) => k !== 'owner' && (me.role === 'owner' || k !== 'admin')).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    ) : <RoleBadge role={u.role} />}
                  </td>
                  <td>{u.mfa ? <span className="badge pos">On</span> : <span className="badge warn">Not set up</span>}</td>
                  <td><StatusBadge status={u.status} /></td>
                  <td className="num">
                    {manage && u.role !== 'owner' && u.id !== me.id && (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {u.status === 'invited' && <button className="btn sm" onClick={() => dispatch({ type: 'UPDATE_USER', id: u.id, patch: { status: 'active' } })} title="Prototype shortcut">Simulate accept</button>}
                        {u.status === 'active' && <button className="btn sm" onClick={() => dispatch({ type: 'UPDATE_USER', id: u.id, patch: { status: 'suspended' } })}>Suspend</button>}
                        {u.status === 'suspended' && <button className="btn sm" onClick={() => dispatch({ type: 'UPDATE_USER', id: u.id, patch: { status: 'active' } })}>Reactivate</button>}
                        <button className="btn sm danger" onClick={() => confirm(`Remove ${u.name}? They will also be removed from every approval policy.`) && dispatch({ type: 'REMOVE_USER', id: u.id })}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card__head"><h2>What each role can do</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Permission</th>{Object.values(ROLES).map((r) => <th key={r.label} style={{ textAlign: 'center' }}>{r.label}</th>)}</tr></thead>
            <tbody>
              {Object.entries(PERMISSIONS).map(([k, roles]) => (
                <tr key={k}><td>{PERM_LABELS[k]}</td>{Object.keys(ROLES).map((r) => <td key={r} style={{ textAlign: 'center' }}>{roles.includes(r) ? <span className="pos">✓</span> : <span className="muted">—</span>}</td>)}</tr>
              ))}
              <tr><td>Sign approval requests</td><td colSpan={5} className="muted small">Owner, Admin or Approver — only when named on the matching policy</td></tr>
              <tr><td>View balances & ledger</td>{Object.keys(ROLES).map((r) => <td key={r} style={{ textAlign: 'center' }}><span className="pos">✓</span></td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
      {inviting && <Invite onClose={() => setInviting(false)} />}
    </div>
  );
}

function Invite({ onClose }) {
  const { state, dispatch, me } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const dup = state.users.some((u) => u.status !== 'removed' && u.email.toLowerCase() === email.toLowerCase());
  return (
    <Modal title="Invite user" onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!name.trim() || !emailOk || dup} onClick={() => { dispatch({ type: 'INVITE_USER', user: { name: name.trim(), email, role } }); onClose(); }}>Send invite</button>
    </>}>
      <label className="field"><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Work email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      {dup && <div className="notice warn small">That email is already on the team.</div>}
      <label className="field"><span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(ROLES).filter(([k]) => k !== 'owner' && (me.role === 'owner' || k !== 'admin')).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.desc}</option>)}
        </select>
      </label>
      <div className="notice small">Invitees must set up two-factor authentication before they can sign approval requests (production requirement).</div>
    </Modal>
  );
}
