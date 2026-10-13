import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getLastSeen, setLastSeen, watchLastSeen } from '@/lib/settings';
import { type LastSeen, shouldShowGate } from '@/lib/update';

/**
 * Whether the update gate is pending. The popup passes seed=true, so a user with
 * no record gets one written (first run); the page panel only reads.
 */
export function useUpdateGate(seed: boolean) {
  const version = browser.runtime.getManifest().version;
  // undefined: still reading.
  const [lastSeen, setSeen] = useState<LastSeen | null | undefined>(undefined);

  useEffect(() => {
    getLastSeen().then((value) => {
      if (value === null && seed) {
        const record = { version, at: Date.now() };
        void setLastSeen(record);
        setSeen(record);
      } else {
        setSeen(value);
      }
    });
    return watchLastSeen(setSeen);
  }, [seed, version]);

  return {
    version,
    previousVersion: lastSeen?.version ?? null,
    show: lastSeen !== undefined && shouldShowGate(Date.now(), lastSeen, version),
    acknowledge: () => setLastSeen({ version, at: Date.now() }),
  };
}
