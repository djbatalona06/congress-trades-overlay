import { defineConfig } from 'wxt';

const BARGO = 'https://www.bargo.ai/*';
const EXTPAY = 'https://extensionpay.com/*';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // WXT defaults Firefox to MV2; both stores get MV3 from this codebase.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Congress Trades Overlay',
    description:
      'See recent STOCK Act congressional trade disclosures overlaid on stock charts. Read-only. Not financial advice.',
    permissions: ['storage', 'alarms', 'notifications'],
    // ExtPay's README requires its origin as a host permission on Firefox only.
    host_permissions: browser === 'firefox' ? [BARGO, EXTPAY] : [BARGO],
    action: { default_title: 'Congress Trades Overlay' },
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
