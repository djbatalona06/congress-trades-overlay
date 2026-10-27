// Home page only: shows the hero's background video once it is actually playing.
// Some browsers refuse autoplay (Safari on iPhone in Low Power Mode, for one) and then draw their own play button over the video. If the video never starts, it is removed, so that button never reaches the page.
(function () {
  const video = document.querySelector('.hero-video');
  if (!video) return;

  const remove = () => video.remove();
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.querySelectorAll('source').forEach((source) => source.addEventListener('error', remove));

  const started = video.play();
  if (started) started.catch(remove);
})();
