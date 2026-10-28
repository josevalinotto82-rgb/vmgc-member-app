(() => {
  const native = window.Capacitor?.isNativePlatform?.() ||
    location.protocol === 'capacitor:' ||
    (location.hostname === 'localhost' && !!window.Capacitor);
  if (native || !/Android/i.test(navigator.userAgent)) return;
  const base = new URL('.', document.currentScript.src);
  const start = () => {
    if (document.getElementById('vmgc-google-play')) return;
    const style = document.createElement('style');
    style.textContent = `
      html,body{margin:0!important;overflow:hidden!important}
      body>:not(#vmgc-google-play){display:none!important}
      #vmgc-google-play{position:fixed;inset:0;z-index:2147483647;overflow:auto;background:#0b241c;color:#fff;font-family:Arial,sans-serif;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom);box-sizing:border-box}
      #vmgc-google-play *{box-sizing:border-box}
      #vmgc-google-play a{display:flex;flex-direction:column;min-height:100%;color:inherit;text-decoration:none;text-align:center;background:linear-gradient(160deg,#173d2c,#081b15)}
      #vmgc-google-play .club-photo{height:32vh;min-height:170px;max-height:290px;width:100%;object-fit:cover;object-position:center;display:block}
      #vmgc-google-play .flyer-content{padding:0 25px 30px;width:100%;max-width:480px;margin:auto}
      #vmgc-google-play .crest{display:block;width:83px;height:100px;object-fit:contain;margin:-52px auto 17px;position:relative;filter:drop-shadow(0 5px 12px #0008)}
      #vmgc-google-play .eyebrow{font-size:11px;letter-spacing:3px;color:#e8c777;text-transform:uppercase;margin:0 0 14px}
      #vmgc-google-play h1{font-size:36px;line-height:1.08;letter-spacing:-1px;margin:0 0 15px;color:#fff}
      #vmgc-google-play .intro{font-size:18px;line-height:1.4;margin:0 0 21px;color:#f4e8ce}
      #vmgc-google-play .download{display:flex;align-items:center;justify-content:center;gap:13px;border:1px solid #ad9768;border-radius:14px;padding:13px 17px;background:#050b08;max-width:290px;margin:0 auto 22px;box-shadow:0 8px 25px #0003}
      #vmgc-google-play .store-logo{width:49px;height:49px;border-radius:12px;object-fit:cover}
      #vmgc-google-play .download-text{text-align:left;font-size:12px;line-height:1.3}
      #vmgc-google-play .download-text strong{display:block;font-size:26px;font-weight:600;letter-spacing:-.5px}
      #vmgc-google-play .credentials{font-size:15px;line-height:1.5;margin:0;color:#d4dfd7}
      #vmgc-google-play .credentials strong{color:#fff}
      #vmgc-google-play .hint{margin:20px 0 0;color:#d6b86e;font-size:12px}
      #vmgc-google-play a:focus-visible{outline:3px solid #f1cc72;outline-offset:-4px}
      @media(max-height:650px){#vmgc-google-play .club-photo{height:24vh;min-height:120px}#vmgc-google-play h1{font-size:29px}#vmgc-google-play .intro{font-size:16px;margin-bottom:15px}#vmgc-google-play .crest{height:82px;width:69px;margin-top:-42px}#vmgc-google-play .flyer-content{padding-bottom:20px}}
    `;
    document.head.appendChild(style);
    const flyer = document.createElement('main');
    flyer.id = 'vmgc-google-play';
    flyer.innerHTML = `<a href="https://play.google.com/store/apps/details?id=ar.com.villamariagolf.members" aria-label="Descargar Villa María Golf en Google Play">
      <img class="club-photo" src="${new URL('app-store-assets/club.jpg', base)}" alt="Vista de Villa María Golf Club">
      <div class="flyer-content">
        <img class="crest" src="${new URL('app-store-assets/escudo.png', base)}" alt="Escudo de Villa María Golf Club">
        <p class="eyebrow">Villa María Golf Club</p>
        <h1>Tu club.<br>Ahora en tu Android.</h1>
        <p class="intro">Para continuar, descargá<br>Villa María Golf desde Google Play.</p>
        <span class="download"><svg class="store-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#32bbff" d="M8 5L27 24 8 43Z"/><path fill="#32d480" d="M8 5L33 19 27 24Z"/><path fill="#ffcd40" d="M33 19L41 24 33 29 27 24Z"/><path fill="#ff5b64" d="M8 43L27 24 33 29Z"/></svg><span class="download-text">Descargá en<strong>Google Play</strong></span></span>
        <p class="credentials">Ingresá con <strong>el mismo email y contraseña</strong> que usás en la web.<br>No necesitás crear otra cuenta.</p>
        <p class="hint">Tocá el anuncio para descargar la app</p>
      </div>
    </a>`;
    document.body.appendChild(flyer);
    flyer.querySelector('a').focus({preventScroll:true});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
