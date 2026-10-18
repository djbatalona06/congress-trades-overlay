// Shared by every page: header, grid menu, Add to Chrome buttons, footer year.
(function () {
  const config = window.CAPITOL || { INSTALL_URLS: {} };

  document.body.classList.remove('no-js');

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  // Header gets a bottom border once the page scrolls.
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mark the header link for the page you are on.
  const here = location.pathname.split('/').pop() || 'index.html';
  for (const link of document.querySelectorAll('.nav-links a, .nav-login')) {
    if (link.getAttribute('href') === here) link.setAttribute('aria-current', 'page');
  }

  // Grid menu: opens from the button, closes on Esc, outside click or choosing a link.
  const button = document.querySelector('.menu-btn');
  const panel = document.getElementById('menu-panel');
  if (button && panel) {
    const setOpen = (open, returnFocus) => {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      button.setAttribute('aria-label', open ? 'Close site menu' : 'Open site menu');
      if (!open && returnFocus) button.focus();
    };
    button.addEventListener('click', () => setOpen(panel.hidden));
    panel.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('click', (event) => {
      if (!panel.hidden && !event.target.closest('.menu')) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) setOpen(false, true);
    });
  }

  // Add to Chrome / Firefox: use the store address once it is set.
  const installLinks = document.querySelectorAll('[data-install]');
  for (const link of installLinks) {
    const url = config.INSTALL_URLS[link.dataset.install];
    if (url) { link.href = url; link.rel = 'noopener'; }
  }

  // Phones and tablets cannot install the extension, so say so instead of sending them to the store.
  // Checks the device, not the window width, so a narrow desktop window still installs normally.
  function isMobileDevice() {
    if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
    if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent || '')) return true;
    // iPads ask for the desktop site and call themselves a Mac, but they have a touch screen.
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  let note = null;
  function buildNote() {
    const dialog = document.createElement('dialog');
    dialog.className = 'note';
    dialog.setAttribute('aria-labelledby', 'note-title');

    const title = document.createElement('h2');
    title.id = 'note-title';
    title.textContent = 'Desktop only';

    const why = document.createElement('p');
    why.textContent = 'Capitol Tape is a browser extension for Chrome and Firefox on a computer. Phone and tablet browsers can’t install it, so it doesn’t work on mobile.';
    const what = document.createElement('p');
    what.textContent = 'Open this page on your Windows, Mac or Linux computer to add it.';
    const later = document.createElement('p');
    const join = document.createElement('a');
    join.href = '/index.html?list=mobile#waitlist';
    join.textContent = 'Join the mobile waitlist';
    join.addEventListener('click', () => dialog.close());
    later.append('Want it on your phone one day? ', join, '.');

    const actions = document.createElement('div');
    actions.className = 'note-actions';
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-primary';
    copy.textContent = 'Copy link';
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(location.origin + '/');
        copy.textContent = 'Link copied';
      } catch {
        copy.textContent = 'Copy failed';
      }
    });
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn btn-ghost';
    close.textContent = 'Close';
    close.addEventListener('click', () => dialog.close());

    actions.append(copy, close);
    dialog.append(title, why, what, later, actions);
    // A click on the dark backdrop lands on the dialog itself.
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    document.body.append(dialog);
    return dialog;
  }

  for (const link of installLinks) {
    link.addEventListener('click', (event) => {
      if (!isMobileDevice()) return;
      event.preventDefault();
      note = note || buildNote();
      note.showModal();
    });
  }
})();
