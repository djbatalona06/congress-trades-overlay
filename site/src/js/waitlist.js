// Waitlist form (home page and extension page): sends email + list to the Worker, then shows the person's share link.
// ?ref=CODE in the address is passed along so the person who shared gets counted.
// ?list=desk (or mobile, beta) picks that option, so other pages can link straight to it.
(function () {
  const base = ((window.CAPITOL || {}).AUTH_BASE || '').replace(/\/+$/, '');
  const form = document.getElementById('waitlist-form');
  if (!form || !base) return; // No Worker yet: the email fallback stays.

  const message = document.getElementById('waitlist-msg');
  const share = document.getElementById('waitlist-share');
  const params = new URLSearchParams(location.search);
  const ref = params.get('ref') || '';
  const preset = form.querySelector('input[name="list"][value="' + params.get('list') + '"]');
  if (preset) preset.checked = true;

  document.getElementById('waitlist-fallback').hidden = true;
  form.hidden = false;

  const show = (text, isError) => {
    message.textContent = text;
    message.classList.toggle('err', Boolean(isError));
    message.hidden = false;
  };
  const errors = {
    bad_email: 'That email address doesn’t look right. Please check it.',
    bad_list: 'Please pick one of the options.',
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    if (!form.elements.email.checkValidity() || !email) {
      show(errors.bad_email, true);
      form.elements.email.focus();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch(base + '/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, list: form.elements.list.value, ref, website: form.elements.website.value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.ok) throw new Error(body.error || 'failed');
      form.hidden = true;
      message.hidden = true;
      const link = location.origin + location.pathname + '?ref=' + encodeURIComponent(body.refCode) + '#waitlist';
      document.getElementById('waitlist-link').value = link;
      document.getElementById('waitlist-count').textContent =
        body.referrals > 0 ? body.referrals + (body.referrals === 1 ? ' person has' : ' people have') + ' joined with your link.' : '';
      share.hidden = false;
      document.getElementById('waitlist-link').focus();
    } catch (error) {
      show(errors[error.message] || 'Something went wrong. Please try again in a minute.', true);
    } finally {
      button.disabled = false;
    }
  });

  const copy = document.getElementById('waitlist-copy');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById('waitlist-link').value);
      copy.textContent = 'Link copied';
    } catch {
      document.getElementById('waitlist-link').select();
      copy.textContent = 'Press Ctrl+C to copy';
    }
  });
})();
