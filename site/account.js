// Account page: shows who is signed in, and signs them out.
(function () {
  const base = ((window.CAPITOL || {}).AUTH_BASE || '').replace(/\/+$/, '');
  const message = document.getElementById('auth-msg');
  const list = document.getElementById('acct-list');
  const signout = document.getElementById('signout');
  const providers = { google: 'Google', github: 'GitHub' };

  if (!base) {
    message.textContent = 'Sign-in isn’t switched on yet.';
    return;
  }

  signout.addEventListener('click', async () => {
    signout.disabled = true;
    try {
      await fetch(base + '/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      location.assign('login.html');
    }
  });

  fetch(base + '/auth/me', { credentials: 'include' })
    .then((response) => {
      if (response.status === 401) { location.replace('login.html'); return null; }
      if (!response.ok) throw new Error('bad status');
      return response.json();
    })
    .then((user) => {
      if (!user) return;
      document.getElementById('acct-name').textContent = user.name || '—';
      document.getElementById('acct-email').textContent = user.email || '—';
      document.getElementById('acct-provider').textContent = providers[user.provider] || user.provider;
      message.hidden = true;
      list.hidden = false;
      signout.hidden = false;
    })
    .catch(() => {
      message.textContent = 'We couldn’t load your account. Please try again in a moment.';
      message.classList.add('err');
    });
})();
