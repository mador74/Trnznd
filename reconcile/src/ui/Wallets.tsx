import { useState } from 'react';
import type { Chain, Contact, Wallet } from '../lib/types';
import { CHAINS } from '../lib/types';
import { addWallet, removeContact, removeWallet, saveContact, updateWallet } from '../lib/store';
import { CHAIN_NAMES, CHAIN_STANDARD, isValidAddress, guessChainFromAddress, sameAddress } from '../lib/chains';
import { formatDate } from '../lib/dates';
import { toast, useModel } from './hooks';
import { Addr, Empty, Field, Icon, Modal, Net } from './kit';
import { runSync, useSyncState } from './syncing';

export function Wallets() {
  const { data } = useModel();
  const sync = useSyncState();
  const [label, setLabel] = useState('');
  const [chain, setChain] = useState<Chain>('TRX');
  const [address, setAddress] = useState('');
  const [tried, setTried] = useState(false);
  const [contact, setContact] = useState<Contact | 'new' | null>(null);
  const [renaming, setRenaming] = useState<Wallet | null>(null);

  const addrErr = !address.trim() ? 'Required' : !isValidAddress(chain, address) ? `Not a valid ${CHAIN_NAMES[chain]} address` : data.wallets.some((w) => w.chain === chain && sameAddress(chain, w.address, address)) ? 'Already added' : null;
  const txCount = (id: string) => data.transactions.filter((t) => t.walletId === id).length;

  const settings = data.settings;
  const missing: string[] = [];
  if (data.wallets.some((w) => w.chain === 'ETH' && !w.demo) && !settings.etherscanApiKey) missing.push('an Etherscan API key (required for Ethereum sync)');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Wallets &amp; contacts</h1>
          <p>Your own wallets define what counts as received, sent or internal. Contacts’ wallets help match payments to the right customer or supplier.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Our wallets</h2>
          <button className="btn sm" onClick={() => runSync()} disabled={sync.running || !data.wallets.some((w) => !w.demo)}>
            <Icon name="sync" /> {sync.running ? sync.message || 'Syncing…' : 'Sync all'}
          </button>
        </div>
        {missing.length > 0 && (
          <div className="card-body" style={{ paddingBottom: 0 }}>
            <div className="notice warn small">
              Add {missing.join(' and ')} in <a href="#/settings">Settings</a>.
            </div>
          </div>
        )}
        <div className="table-wrap">
          {data.wallets.length ? (
            <table>
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Network</th>
                  <th>Address</th>
                  <th className="num">Transactions</th>
                  <th>Last sync</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.wallets.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontWeight: 600 }}>
                      {w.label} {w.demo && <span className="badge tone-gray plain">demo</span>}
                    </td>
                    <td>
                      <Net chain={w.chain} long />
                    </td>
                    <td>
                      <Addr chain={w.chain} address={w.address} link={!w.demo} />
                    </td>
                    <td className="num">{txCount(w.id)}</td>
                    <td className="small">
                      {w.lastSyncAt ? formatDate(w.lastSyncAt, true) : <span className="faint">{w.demo ? 'n/a' : 'Never'}</span>}
                      {w.lastSyncError && (
                        <div className="small" style={{ color: 'var(--out)', maxWidth: 320 }}>
                          {w.lastSyncError}
                        </div>
                      )}
                    </td>
                    <td className="right nowrap">
                      <button className="btn xs" disabled={sync.running || w.demo} onClick={() => runSync([w.id])}>
                        Sync
                      </button>{' '}
                      <button className="btn xs ghost" onClick={() => setRenaming(w)}>
                        Rename
                      </button>{' '}
                      <button
                        className="btn xs ghost"
                        onClick={() => {
                          const n = txCount(w.id);
                          if (!window.confirm(`Remove wallet “${w.label}”?`)) return;
                          const drop = n > 0 && window.confirm(`Also delete its ${n} transaction(s) and their matches? Press Cancel to keep them.`);
                          removeWallet(w.id, drop);
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No wallets yet">Add each address your company uses to receive or send USDT/USDC. One address can hold both tokens.</Empty>
          )}
        </div>
        <div className="card-body" style={{ borderTop: '1px solid var(--line)' }}>
          <form
            className="row wrap top"
            onSubmit={(e) => {
              e.preventDefault();
              setTried(true);
              if (addrErr) return;
              addWallet({ label: label.trim() || `${CHAIN_NAMES[chain]} wallet`, chain, address: address.trim() });
              toast('Wallet added. Use “Sync” to fetch its transfers.');
              setLabel('');
              setAddress('');
              setTried(false);
            }}
          >
            <Field label="Label" style={{ width: 200 }}>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Collections" />
            </Field>
            <Field label="Chain" style={{ width: 190 }}>
              <select value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
                {CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {CHAIN_NAMES[c]} ({CHAIN_STANDARD[c]})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address" error={tried ? addrErr : null} style={{ flex: 1, minWidth: 280 }}>
              <input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  const g = guessChainFromAddress(e.target.value.trim());
                  if (g) setChain(g);
                }}
                placeholder="0x…, T… or a Solana address"
                style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}
              />
            </Field>
            <div className="field">
              <span>&nbsp;</span>
              <button className="btn primary" type="submit">
                <Icon name="plus" /> Add wallet
              </button>
            </div>
          </form>
          <p className="small faint" style={{ marginTop: 10 }}>
            Read-only: the app only needs public addresses, never private keys or seed phrases. Address format is checked; checksums are not.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Contacts</h2>
          <button className="btn sm" onClick={() => setContact('new')}>
            <Icon name="plus" /> New contact
          </button>
        </div>
        <div className="table-wrap">
          {data.contacts.length ? (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Known wallets</th>
                  <th className="num">Requests</th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((c) => (
                  <tr key={c.id} className="click" onClick={() => setContact(c)}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="small muted">{c.email}</td>
                    <td>
                      <div className="stack tight">
                        {c.addresses.map((a) => (
                          <span key={a.chain + a.address} className="row">
                            <Net chain={a.chain} /> <Addr chain={a.chain} address={a.address} link={false} />
                          </span>
                        ))}
                        {!c.addresses.length && <span className="faint small">None</span>}
                      </div>
                    </td>
                    <td className="num">{data.requests.filter((r) => r.contactId === c.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No contacts yet">Contacts are created automatically when you save a payment request, or add them here with their wallet addresses.</Empty>
          )}
        </div>
      </div>
      {contact && <ContactDialog contact={contact === 'new' ? undefined : contact} onClose={() => setContact(null)} />}
      {renaming && <RenameDialog wallet={renaming} onClose={() => setRenaming(null)} />}
    </>
  );
}

function RenameDialog({ wallet, onClose }: { wallet: Wallet; onClose: () => void }) {
  const [label, setLabel] = useState(wallet.label);
  return (
    <Modal
      title="Rename wallet"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!label.trim()}
            onClick={() => {
              updateWallet(wallet.id, { label: label.trim() });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <Field label="Label">
        <input value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

function ContactDialog({ contact, onClose }: { contact?: Contact; onClose: () => void }) {
  const [name, setName] = useState(contact?.name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [addrs, setAddrs] = useState(contact?.addresses ?? []);
  const [chain, setChain] = useState<Chain>('TRX');
  const [addr, setAddr] = useState('');
  const addrErr = addr.trim() && !isValidAddress(chain, addr) ? `Not a valid ${CHAIN_NAMES[chain]} address` : null;
  return (
    <Modal
      title={contact ? contact.name : 'New contact'}
      onClose={onClose}
      footer={
        <>
          {contact && (
            <button
              className="btn danger sm"
              onClick={() => {
                if (!window.confirm(`Delete contact “${contact.name}”? Requests keep the name but lose the link.`)) return;
                removeContact(contact.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <span className="grow" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              saveContact({ id: contact?.id, name: name.trim(), email: email.trim() || undefined, notes: notes.trim() || undefined, addresses: addrs });
              toast('Contact saved.');
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid2">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </Field>
      </div>
      <div className="stack tight">
        <span className="small muted" style={{ fontWeight: 600 }}>
          Wallets this contact pays from or is paid to
        </span>
        {addrs.map((a, i) => (
          <div key={a.chain + a.address} className="row">
            <Net chain={a.chain} />
            <span className="mono small grow" style={{ overflowWrap: 'anywhere' }}>
              {a.address}
            </span>
            <button className="btn xs ghost" onClick={() => setAddrs(addrs.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <div className="row top">
          <select value={chain} onChange={(e) => setChain(e.target.value as Chain)} style={{ width: 130 }}>
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {CHAIN_NAMES[c]}
              </option>
            ))}
          </select>
          <Field label="" error={addrErr} style={{ flex: 1 }}>
            <input
              value={addr}
              onChange={(e) => {
                setAddr(e.target.value);
                const g = guessChainFromAddress(e.target.value.trim());
                if (g) setChain(g);
              }}
              placeholder="Address"
              style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}
            />
          </Field>
          <button
            className="btn"
            disabled={!addr.trim() || !!addrErr}
            onClick={() => {
              setAddrs([...addrs, { chain, address: addr.trim() }]);
              setAddr('');
            }}
          >
            Add
          </button>
        </div>
      </div>
      <Field label="Notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
    </Modal>
  );
}
