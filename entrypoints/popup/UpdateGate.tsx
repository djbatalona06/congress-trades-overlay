import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { useUpdateGate } from '@/components/useUpdateGate';
import { readBudget } from '@/lib/budget';
import { lookupsLeft, lookupsPerDay } from '@/lib/format';
import { getApiKey } from '@/lib/settings';
import type { BudgetState } from '@/lib/types';
import { releaseNote } from '@/lib/update';

// Chrome has an update check; Firefox does not, so the button is hidden there.
const canCheckForUpdates = () => typeof browser.runtime.requestUpdateCheck === 'function';

async function checkForUpdates(): Promise<string> {
  try {
    const result = (await browser.runtime.requestUpdateCheck()) as unknown;
    const status = Array.isArray(result) ? result[0] : (result as { status?: string } | undefined)?.status;
    if (status === 'no_update') return 'You have the latest version.';
    if (status === 'update_available') return 'An update is ready. Restart Chrome to finish.';
    if (status === 'throttled') return 'Checked a moment ago. Try again later.';
  } catch {
    // fall through
  }
  return "Couldn't check for updates. Try again later.";
}

/** A card shown before first use after an update or a long gap. Never shown on the chart. */
export function UpdateGate() {
  const gate = useUpdateGate(true);
  const [budget, setBudget] = useState<BudgetState | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void (async () => setBudget(await readBudget((await getApiKey()) !== null)))();
  }, []);

  if (!gate.show) return null;
  const updated = gate.previousVersion !== gate.version;

  return (
    <aside className="gate" aria-labelledby="gate-title">
      <h2 id="gate-title">{updated ? `Updated to version ${gate.version}` : 'Welcome back'}</h2>
      <p>
        <strong>What changed:</strong> {releaseNote(gate.version)}
      </p>
      <p className="muted">
        Data: public STOCK Act filings, up to 45 days after each trade.
        {budget && ` ${lookupsLeft(budget)} of ${lookupsPerDay(budget)} free lookups left today.`}
      </p>
      <div className="row">
        <button type="button" className="primary" onClick={() => void gate.acknowledge()}>
          Continue
        </button>
        {canCheckForUpdates() && (
          <button type="button" onClick={async () => setMessage(await checkForUpdates())}>
            Check for updates
          </button>
        )}
      </div>
      <div role="status">{message && <p className="muted">{message}</p>}</div>
    </aside>
  );
}
