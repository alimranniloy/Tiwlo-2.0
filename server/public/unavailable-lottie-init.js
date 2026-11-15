(function initTiwloLottie() {
  var container = document.getElementById('tiwlo-lottie');
  if (!container) return;

  var blockEvent = function (e) {
    e.preventDefault();
    return false;
  };

  var wrap = document.getElementById('tiwlo-art-wrap') || container;
  wrap.addEventListener('contextmenu', blockEvent);
  wrap.addEventListener('dragstart', blockEvent);
  wrap.addEventListener('selectstart', blockEvent);

  if (window.lottie && typeof window.lottie.loadAnimation === 'function') {
    window.lottie.loadAnimation({
      container: container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      path: '/empty-state-lottie.json',
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true,
      },
    });
  }
})();

