import { defineConfig } from 'wxt';

const BARGO = 'https://www.bargo.ai/*';
const EXTPAY = 'https://extensionpay.com/*';

// The Worker is opt-in at build time (see lib/worker.ts). Its origin becomes a
// host permission only when the flag is on, so default builds ask for nothing new.
const workerUrl = process.env.WXT_USE_WORKER === 'true' ? process.env.WXT_WORKER_URL?.trim() : undefined;
const WORKER = workerUrl?.startsWith('https://') ? `${new URL(workerUrl).origin}/*` : null;

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // WXT defaults Firefox to MV2; both stores get MV3 from this codebase.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Capitol Tape — Congress Trades on Your Charts',
    description:
      'See recent STOCK Act congressional trade disclosures overlaid on stock charts. Read-only. Not financial advice.',
    permissions: ['storage', 'alarms', 'notifications'],
    // ExtPay's README requires its origin as a host permission on Firefox only.
    host_permissions: [BARGO, ...(browser === 'firefox' ? [EXTPAY] : []), ...(WORKER ? [WORKER] : [])],
    action: { default_title: 'Capitol Tape' },
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'congress-trades-overlay@djbatalona',
          data_collection_permissions: { required: ['websiteContent'] },
        },
      },
    }),
  }),
});
