// Settings you fill in by hand. Everything else on the site reads from here.
window.CAPITOL = {
  // Store listing URLs. Paste the real ones after the listings go live; until then the buttons scroll to #get.
  INSTALL_URLS: {
    chrome: '',  // e.g. https://chromewebstore.google.com/detail/capitol-tape/<item-id>
    firefox: '', // e.g. https://addons.mozilla.org/firefox/addon/capitol-tape/
  },
  // Address of the deployed Worker that handles sign-in, with no trailing slash.
  // Leave empty until the Worker is live; the sign-in buttons then say sign-in is not switched on yet.
  AUTH_BASE: '', // e.g. https://capitol-tape-api.<your-name>.workers.dev
};
