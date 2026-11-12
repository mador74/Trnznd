import { useState } from 'react';
import { updateSettings, replaceAll, resetAll } from '../lib/store';
import { buildDemo } from '../lib/demo';
import { formatAmount, parseAmount, toDecimalString } from '../lib/amount';
import { SOLANA_PUBLIC_RPC } from '../chains/solana';
import { toast, useModel } from './hooks';
import { Field } from './kit';

export function SettingsPage() {
  const { data } = useModel();
  const s = data.settings;
  const [tolAbs, setTolAbs] = useState(toDecimalString(s.toleranceAbs));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Saved automatically in this browser.</p>
        </div>
      </div>
      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <h2>Company &amp; numbering</h2>
          </div>
          <div className="card-body stack">
            <Field label="Company name" hint="Shown on payment requests and export file names.">
              <input value={s.companyName} onChange={(e) => updateSettings({ companyName: e.target.value })} />
            </Field>
            <div className="grid2">
              <Field label="Request number prefix">
                <input value={s.requestPrefix} onChange={(e) => updateSettings({ requestPrefix: e.target.value })} />
              </Field>
              <Field label="Next number">
                <input type="number" min={1} value={s.nextRequestNumber} onChange={(e) => updateSettings({ nextRequestNumber: Math.max(1, Number(e.target.value) || 1) })} />
              </Field>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Matching rules</h2>
          </div>
          <div className="card-body stack">
            <div className="grid2">
              <Field label="Tolerance (tokens)" hint={`Currently ${formatAmount(s.toleranceAbs)}`}>
                <input
                  value={tolAbs}
                  inputMode="decimal"
                  onChange={(e) => setTolAbs(e.target.value)}
                  onBlur={() => {
                    const v = parseAmount(tolAbs);
                    if (v !== null && v >= 0) updateSettings({ toleranceAbs: v });
                    else setTolAbs(toDecimalString(s.toleranceAbs));
                  }}
                />
              </Field>
              <Field label="Tolerance (% of amount)">
                <input type="number" min={0} step={0.1} value={s.tolerancePct} onChange={(e) => updateSettings({ tolerancePct: Math.max(0, Number(e.target.value) || 0) })} />
              </Field>
            </div>
            <Field label="Late-payment window (days after due date)">
              <input type="number" min={0} value={s.dateWindowDays} onChange={(e) => updateSettings({ dateWindowDays: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <p className="small muted">
              A payment within the larger of the two tolerances is suggested as a match and you are offered to write off the difference (for example a fee deducted by the payer’s exchange). Payments after the window still match, just with lower confidence.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Blockchain data sources</h2>
        </div>
        <div className="card-body stack">
          <p className="small muted">
            Sync runs in your browser and calls these services directly, read-only, with your wallet addresses. Keys are stored only in this browser (not encrypted) and are left out of backups unless you choose otherwise. Free tiers, rate limits and browser access rules are set by each provider and can change; if a sync fails, the error shown on the wallet says which service refused.
          </p>
          <div className="grid3">
            <Field label="Etherscan API key (Ethereum)" hint="Required for Ethereum sync. Free keys are issued from an Etherscan account.">
              <input type="password" autoComplete="off" value={s.etherscanApiKey ?? ''} onChange={(e) => updateSettings({ etherscanApiKey: e.target.value.trim() || undefined })} />
            </Field>
            <Field label="TronGrid API key (Tron)" hint="Optional. Without it TronGrid applies lower rate limits.">
              <input type="password" autoComplete="off" value={s.trongridApiKey ?? ''} onChange={(e) => updateSettings({ trongridApiKey: e.target.value.trim() || undefined })} />
            </Field>
            <Field label="Solana RPC URL" hint="The public endpoint is heavily rate-limited; a provider URL (with its key) is recommended.">
              <input value={s.solanaRpcUrl ?? ''} placeholder={SOLANA_PUBLIC_RPC} onChange={(e) => updateSettings({ solanaRpcUrl: e.target.value.trim() || undefined })} />
            </Field>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-head">
            <h2>Demo data</h2>
          </div>
          <div className="card-body stack">
            <p className="small muted">Replaces everything with a sample company: 4 wallets, 10 payment requests and 10 transactions covering exact, partial, combined, short and unknown payments.</p>
            <div>
              <button
                className="btn"
                onClick={() => {
                  if (data.requests.length + data.transactions.length && !window.confirm('Replace all current data with the demo data set?')) return;
                  replaceAll(buildDemo(), 'Demo data loaded');
                  toast('Demo data loaded.');
                }}
              >
                Load demo data
              </button>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Danger zone</h2>
          </div>
          <div className="card-body stack">
            <p className="small muted">Deletes every wallet, request, transaction, match and setting in this browser. Download a backup first.</p>
            <div>
              <button
                className="btn danger"
                onClick={() => {
                  if (!window.confirm('Delete ALL data in this browser? This cannot be undone.')) return;
                  resetAll();
                  toast('All data cleared.');
                }}
              >
                Clear all data
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="small faint">
        USD figures assume USDT and USDC trade at exactly 1 USD. Stablecoins can deviate from their peg; use your accounting policy’s rates for reporting.
      </p>
    </>
  );
}
