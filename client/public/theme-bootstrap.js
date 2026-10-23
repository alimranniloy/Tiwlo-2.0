(function() {
  try {
    var saved = localStorage.getItem('tiwlo_theme') || localStorage.getItem('theme');
    var isDark = saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.getElementById('theme-color-meta');
    var appleMeta = document.getElementById('apple-status-bar-meta');
    var msMeta = document.getElementById('ms-navbutton-meta');
    if (isDark) {
      document.documentElement.classList.add('dark');
      if (meta) meta.setAttribute('content', '#0B0F17');
      if (appleMeta) appleMeta.setAttribute('content', 'black-translucent');
      if (msMeta) msMeta.setAttribute('content', '#0B0F17');
    } else {
      document.documentElement.classList.remove('dark');
      if (meta) meta.setAttribute('content', '#FFFFFF');
      if (appleMeta) appleMeta.setAttribute('content', 'default');
      if (msMeta) msMeta.setAttribute('content', '#FFFFFF');
    }
  } catch (error) {
    console.error('Unable to initialize theme preference:', error);
  }
})();
