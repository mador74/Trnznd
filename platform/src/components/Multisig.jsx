import { useState } from 'react';
import { useStore } from '../state/store.jsx';
import { MULTISIG_PROVIDERS, validateMultisig } from '../lib/partners.js';
import { shortAddr } from '../lib/format.js';
import { Modal } from './ui.jsx';

const fakeAddress = (network) =>
  network === 'Solana'
    ? Array.from({ length: 44 }, () => '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[Math.floor(Math.random() * 58)]).join('')
    : '0x' + Array.from({ length: 40 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');

/** Create a new Safe / Squads multisig (deployed from the user's own wallet) or connect an existing one. */
export default function MultisigWizard({ onClose }) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState('create');
  const [provider, setProvider] = useState('safe');
  const p = MULTISIG_PROVIDERS[provider];
  const [network, setNetwork] = useState(p.networks[0]);
  const net = p.networks.includes(network) ? network : p.networks[0];
  const [name, setName] = useState('');
  const team = state.users.filter((u) => u.status === 'active');
  // Each team member would connect their own signing wallet; the demo invents a public address per person.
  const [signers] = useState(() => Object.fromEntries(team.map((u) => [u.id, { solana: fakeAddress('Solana'), evm: fakeAddress('Ethereum') }])));
  const [picked, setPicked] = useState(team.slice(0, 3).map((u) => u.id));
  const [external, setExternal] = useState('');
  const [threshold, setThreshold] = useState(2);
  const [existing, setExisting] = useState('');
  const [step, setStep] = useState('form');

  const owners = [
    ...picked.map((id) => ({ label: team.find((u) => u.id === id)?.name, address: net === 'Solana' ? signers[id].solana : signers[id].evm })),
    ...external.split(',').map((s) => s.trim()).filter(Boolean).map((address, i) => ({ label: `External signer ${i + 1}`, address })),
  ];
  const errors = mode === 'create' ? validateMultisig({ name, owners, threshold }) : (!name.trim() ? ['Give the wallet a name.'] : existing.trim().length < 20 ? ['Enter the wallet’s full address.'] : []);
  const finish = () => {
    dispatch({
      type: 'CREATE_MULTISIG',
      connection: {
        name: name.trim(), provider: p.name, network: net, address: mode === 'create' ? fakeAddress(net) : existing.trim(),
        assets: p.assets[net], owners: mode === 'create' ? owners : [{ label: 'Read from chain', address: '—' }], threshold: mode === 'create' ? threshold : 2,
        created: mode === 'create',
      },
    });
    onClose();
  };

  if (step === 'sign')
    return (
      <Modal title={`Deploy your ${p.name}`} onClose={onClose} footer={<>
        <button className="btn" onClick={() => setStep('form')}>Back</button>
        <button className="btn primary" onClick={finish}>Simulate signing in my wallet (demo)</button>
      </>}>
        <p className="small">TRNZIT has prepared the setup transaction. You sign it in <strong>your own wallet</strong>. TRNZIT never sees a private key, and the network fee is paid from that wallet.</p>
        <dl className="kv small">
          <dt>Wallet</dt><dd>{p.name} on {net}</dd>
          <dt>Owners</dt><dd>{owners.map((o) => `${o.label} (${shortAddr(o.address)})`).join(', ')}</dd>
          <dt>Rule</dt><dd>{threshold} of {owners.length} owners must sign every transaction</dd>
        </dl>
        <div className="notice small">Once deployed, the {threshold}-of-{owners.length} rule is enforced on-chain by the wallet itself. Your TRNZIT approval rules apply on top, before a payment is even proposed.</div>
      </Modal>
    );

  return (
    <Modal title="Self-custody multisig wallet" onClose={onClose} wide footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={errors.length > 0} onClick={() => (mode === 'create' ? setStep('sign') : finish())}>{mode === 'create' ? 'Review and deploy' : 'Connect'}</button>
    </>}>
      <div className="row wrap">
        {Object.entries(MULTISIG_PROVIDERS).map(([k, v]) => (
          <label key={k} className={`choice${provider === k ? ' on' : ''}`}>
            <input type="radio" name="ms-provider" checked={provider === k} onChange={() => setProvider(k)} />
            <span><strong>{v.name}</strong><span className="small muted"> · {v.blurb}</span></span>
          </label>
        ))}
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={mode === 'create'} className={mode === 'create' ? 'active' : ''} onClick={() => setMode('create')}>Create a new one</button>
        <button role="tab" aria-selected={mode === 'connect'} className={mode === 'connect' ? 'active' : ''} onClick={() => setMode('connect')}>Connect an existing one</button>
      </div>
      <div className="grid cols-2">
        <label className="field"><span>Name</span><input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Treasury multisig" /></label>
        <label className="field"><span>Network</span>
          <select id="ms-net" value={net} onChange={(e) => setNetwork(e.target.value)}>{p.networks.map((n) => <option key={n}>{n}</option>)}</select>
        </label>
      </div>
      {mode === 'connect' ? (
        <>
          <label className="field"><span>{p.name} address</span><input id="ms-addr" className="mono" value={existing} onChange={(e) => setExisting(e.target.value)} /></label>
          <div className="small muted">TRNZIT reads the owners and signing rule from the chain. Nothing to sign.</div>
        </>
      ) : (
        <>
          <div>
            <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Owners from your team (each signs with their own wallet)</div>
            {team.map((u) => (
              <label key={u.id} className="row small">
                <input type="checkbox" checked={picked.includes(u.id)} onChange={() => setPicked((x) => (x.includes(u.id) ? x.filter((i) => i !== u.id) : [...x, u.id]))} />
                {u.name} <span className="mono muted">{shortAddr(net === 'Solana' ? signers[u.id].solana : signers[u.id].evm)}</span>
              </label>
            ))}
          </div>
          <label className="field"><span>Other owner addresses (optional, comma-separated). For example, a hardware wallet kept offline</span><input id="ms-ext" className="mono" value={external} onChange={(e) => setExternal(e.target.value)} /></label>
          <label className="field"><span>Signatures required — {threshold} of {owners.length}</span>
            <input id="ms-threshold" type="number" min="1" max={Math.max(owners.length, 1)} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value, 10) || 0)} style={{ maxWidth: 120 }} />
          </label>
        </>
      )}
      {errors.length > 0 && <div className="notice warn small">{errors.join(' ')}</div>}
    </Modal>
  );
}
