(function () {
  // window.__OPM_LR optional config:
  // { host, port, path, forcePath, secure, healthPath, maxWaitMs }
  const CFG = window.__OPM_LR || {};
  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);

  const PORT  = Number(CFG.port ?? 8765);
  const PATH  = String(CFG.path ?? '/__opm__/ws');
  const FORCE_PATH = Boolean(CFG.forcePath ?? !isLocalHost);
  const SECURE = (CFG.secure === undefined || CFG.secure === null)
    ? (location.protocol === 'https:')
    : Boolean(CFG.secure);

  // Odoo’nun “hazır” olduğunu anlamak için hafif bir uç nokta.
  // /web genelde yeterli. İstersen /web/login veya /web/assets/manifest.json yapabilirsin.
  const HEALTH_PATH = String(CFG.healthPath ?? '/web');
  const MAX_WAIT_MS = Number(CFG.maxWaitMs ?? 30000); // 30s tavan

  const makeWsUrl = () => {
    const proto = SECURE ? 'wss://' : 'ws://';
    if (!FORCE_PATH && isLocalHost) {
      const host  = String(CFG.host ?? '127.0.0.1');
      return `${proto}${host}:${PORT}`;
    }
    return `${proto}${location.host}${PATH}`;
  };

  // Basit bir overlay (isteğe bağlı). İstersen kaldır.
  let overlay;
  function showOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.25);'+
      'display:flex;align-items:center;justify-content:center;'+
      'z-index:999999;font:14px/1.2 system-ui,Arial';
    const card = document.createElement('div');
    card.style.cssText='background:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15)';
    card.textContent = 'Waiting for Odoo to restart…';
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  }
  function hideOverlay() { if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay); overlay = null; }

  async function waitUntilHealthy() {
    const start = Date.now();
    let attempt = 0;
    while (Date.now() - start < MAX_WAIT_MS) {
      try {
        // cache’i by-pass et
        const url = new URL(HEALTH_PATH, location.origin);
        url.searchParams.set('_', String(Date.now()));
        const res = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        if (res.ok) return true;            // 200–299 → Odoo hazır
        // 502/504/5xx → biraz bekle, tekrar dene
      } catch (_) {
        // Network error → tekrar dene
      }
      // Üstel backoff (tavana kadar)
      const backoff = Math.min(100 * Math.pow(1.5, attempt++), 1000);
      await new Promise(r => setTimeout(r, backoff));
    }
    return false; // süre dolduysa yine de reload deneyelim
  }

  let ws, tries = 0, timer = null;
  const MAX_BACKOFF = 8000, JITTER_MAX = 300;
  let lastReloadAt = 0;

  function scheduleReconnect() {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', () => scheduleReconnect(), { once: true });
      return;
    }
    const backoff = Math.min(1000 * Math.pow(1.6, tries++), MAX_BACKOFF);
    const jitter  = Math.floor(Math.random() * JITTER_MAX);
    clearTimeout(timer);
    timer = setTimeout(connect, backoff + jitter);
  }

  async function handleReloadMessage(msg) {
    // Birden fazla WS mesajını 500ms içinde tekle
    const now = Date.now();
    if (now - lastReloadAt <= 500) return;
    lastReloadAt = now;

    showOverlay();
    const ok = await waitUntilHealthy();
    hideOverlay();
    // Sağlıklıysa da değilse de dene; ama genelde ok olduğunda 502 görmezsin
    location.reload();
  }

  function connect() {
    clearTimeout(timer);
    try { ws = new WebSocket(makeWsUrl()); }
    catch { scheduleReconnect(); return; }

    ws.onopen = () => { tries = 0; console.log('[opm] live-reload: connected'); };

    ws.onmessage = (ev) => {
      const msg = String(ev.data || '');
      if (msg === 'reload' || msg.startsWith('reload:')) {
        // Eski davranış: window.location.reload();
        // Yeni davranış: önce Odoo sağlıklı mı diye bekle
        handleReloadMessage(msg);
      }
    };

    ws.onerror = () => scheduleReconnect();
    ws.onclose = () => { console.warn('[opm] live-reload: socket closed'); scheduleReconnect(); };

    // keepalive
    const ka = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) { try { ws.send('ping'); } catch {} }
    }, 30000);
    ws.addEventListener('close', () => clearInterval(ka), { once: true });
    ws.addEventListener('error', () => clearInterval(ka), { once: true });
  }

  window.addEventListener('online', scheduleReconnect);
  connect();
})();