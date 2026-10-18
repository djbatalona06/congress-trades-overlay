// Sign-in page: points the Google and GitHub buttons at the Worker.
(function () {
  const base = ((window.CAPITOL || {}).AUTH_BASE || '').replace(/\/+$/, '');
  const message = document.getElementById('auth-msg');

  const show = (text, isError) => {
    message.textContent = text;
    message.classList.toggle('err', Boolean(isError));
    message.hidden = false;
  };

  const buttons = document.querySelectorAll('[data-provider]');
  if (!base) {
    for (const button of buttons) {
      button.removeAttribute('href');
      button.setAttribute('aria-disabled', 'true');
    }
    show('Sign-in isn’t switched on yet. Please check back soon.');
    return;
  }
  // The buttons start disabled in the HTML, so they do nothing until the Worker address is known.
  for (const button of buttons) {
    button.href = base + '/auth/' + button.dataset.provider + '/start';
    button.removeAttribute('aria-disabled');
  }

  // The Worker sends people back here with ?error=... when a sign-in does not finish.
  const errors = {
    denied: 'Sign-in was cancelled, so nothing was changed.',
    state: 'That sign-in link expired. Please try again.',
    email: 'That account has no verified email address. Verify one with the service and try again.',
    failed: 'Something went wrong while signing in. Please try again.',
  };
  const code = new URLSearchParams(location.search).get('error');
  if (code) show(errors[code] || errors.failed, true);
})();
