/* One website entry point: downloads go through the official stores. */
(() => {
  window.addEventListener('beforeinstallprompt', event => event.preventDefault());
  // Retire the old installable web manifest; existing shortcuts can still open the site.
  for (const link of document.querySelectorAll('link[rel="manifest"]')) link.remove();
})();
