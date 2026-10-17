// Apply the persisted theme before React mounts, to avoid a flash.
(function () {
  try {
    var mode = localStorage.getItem('iepg-theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = mode === 'dark' || ((mode === null || mode === 'system') && system);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
