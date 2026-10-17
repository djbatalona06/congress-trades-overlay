// Scroll reveal and number counters. Used by the home and pricing pages.
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function countUp(el) {
    const target = Number(el.dataset.count);
    const text = el.firstChild;
    if (reduced || target === 0) return;
    const start = performance.now(), dur = 1400;
    const ease = (t) => 1 - Math.pow(1 - t, 4);
    (function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      text.nodeValue = String(Math.round(target * ease(t)));
      if (t < 1) requestAnimationFrame(tick);
    })(start);
    text.nodeValue = '0';
  }

  // Reveal on scroll; counters start when visible.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      const num = e.target.querySelector('[data-count]');
      if (num) countUp(num);
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();
