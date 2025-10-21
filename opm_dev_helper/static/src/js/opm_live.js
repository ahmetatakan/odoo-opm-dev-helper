(function () {
  // Optional override:
  // window.__OPM_LR = { host: '127.0.0.1', port: 8765, path: '/__opm__/ws', forcePath: false, secure: null }

  const CFG = window.__OPM_LR || {};
  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);

  // --- URL generation ---
  const PORT = Number(CFG.port ?? 8765);
  const PATH = String(CFG.path ?? '/__opm__/ws');
  const FORCE_PATH = Boolean(CFG.forcePath ?? !isLocalHost);
  const SECURE = (CFG.secure === null || CFG.secure === undefined)
    ? (location.protocol === 'https:')
    : Boolean(CFG.secure);

  const makeUrl = () => {
    if (!FORCE_PATH && isLocalHost) {
      const proto = SECURE ? 'wss://' : 'ws://';
      const host = String(CFG.host ?? '127.0.0.1');
      return `${proto}${host}:${PORT}`;
    }
    const proto = SECURE ? 'wss://' : 'ws://';
    return `${proto}${location.host}${PATH}`;
  };

  // --- Odoo soft reload helper ---
  function softReload() {
    try {
      // OWL 2 / Odoo 17+
      if (window.odoo?.__DEBUG__?.webclient?.reload) {
        console.log('[opm] soft reload via Odoo 17+ webclient.reload()');
        window.odoo.__DEBUG__.webclient.reload();
        return;
      }
      // OWL 1 / Odoo 15–16
      if (window.odoo?.__DEBUG__?.webclient?.do_action) {
        console.log('[opm] soft reload via Odoo 15–16 do_action("reload_context")');
        window.odoo.__DEBUG__.webclient.do_action('reload_context', { clear_cache: true });
        return;
      }
      // fallback
      console.log('[opm] fallback hard reload');
      window.location.reload();
    } catch (e) {
      console.warn('[opm] reload fallback (error):', e);
      window.location.reload();
    }
  }

  // --- Auto-reconnect + keepalive ---
  let ws = null, tries = 0, timer = null;
  const MAX_BACKOFF = 8000, JITTER_MAX = 300;
  let lastReloadAt = 0;

  function scheduleReconnect() {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', () => scheduleReconnect(), { once: true });
      return;
    }
    const backoff = Math.min(1000 * Math.pow(1.6, tries++), MAX_BACKOFF);
    const jitter = Math.floor(Math.random() * JITTER_MAX);
    clearTimeout(timer);
    timer = setTimeout(connect, backoff + jitter);
  }

  function connect() {
    clearTimeout(timer);
    let url = makeUrl();
    console.log(`[opm] connecting to ${url}`);
    try { ws = new WebSocket(url); }
    catch { scheduleReconnect(); return; }

    ws.onopen = () => {
      tries = 0;
      console.log('[opm] live-reload: connected');
    };

    ws.onmessage = (ev) => {
      const msg = String(ev.data || '');
      if (msg === 'reload' || msg.startsWith('reload:')) {
        const now = Date.now();
        if (now - lastReloadAt > 500) {
          lastReloadAt = now;
          softReload();
        }
      }
    };

    ws.onerror = () => scheduleReconnect();
    ws.onclose = () => {
      console.warn('[opm] live-reload: socket closed');
      scheduleReconnect();
    };

    const ka = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send('ping'); } catch { /* ignore */ }
      }
    }, 30000);

    ws.addEventListener('close', () => clearInterval(ka), { once: true });
    ws.addEventListener('error', () => clearInterval(ka), { once: true });
  }

  window.addEventListener('online', scheduleReconnect);
  connect();
})();