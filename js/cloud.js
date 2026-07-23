/* =========================================================================
   Familien-Dashboard – Cloud-Speicherung (Supabase)
   Synchronisiert den kompletten Zustand mit einer Supabase-Tabelle, damit
   alle Geräte der Familie denselben Stand sehen. localStorage bleibt als
   Offline-Cache erhalten: Die App funktioniert ohne Netz weiter und reicht
   Änderungen nach, sobald sie wieder online ist.

   Ablage: eine Zeile in der Tabelle `dashboard` (id = 'familie',
   data = kompletter Zustand als JSON). Bei Konflikten gewinnt der zuletzt
   gespeicherte Stand (Zeitstempel `updatedAt` im Zustand).

   Einrichtung der Tabelle: siehe README („Cloud-Speicherung").
   ========================================================================= */
(function (CHORES) {
  'use strict';

  // --- Zugangsdaten (publishable Key – für den Browser gedacht) ---------
  const SUPABASE_URL = 'https://kwlyjlaqzapfbpkpucab.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_onVPcjNNSp-gTkoioVPqtg_holheRPK';
  const TABLE = 'dashboard';
  const ROW_ID = 'familie';
  const PUSH_DELAY = 1200;      // ms: Änderungen bündeln, dann hochladen
  const SYNC_INTERVAL = 45000;  // ms: regelmäßig nach fremden Änderungen schauen

  const BASE_HEADERS = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
  };

  let pushTimer = null;
  let dirty = false;        // lokale Änderungen, die noch nicht hochgeladen sind
  let status = 'idle';      // 'ok' | 'syncing' | 'offline' | 'error' | 'login'
  let onStatus = null;
  let onRemoteChange = null;

  function setStatus(s) {
    if (status === s) return;
    status = s;
    if (onStatus) onStatus(s);
  }

  /* --------------------- Familien-Anmeldung (Auth) ---------------------
     Die Tabelle ist per RLS auf angemeldete Benutzer beschränkt. Jedes
     Gerät meldet sich EINMAL mit dem Familien-Konto an; die Sitzung wird
     lokal gespeichert (nicht im synchronisierten Zustand!) und Tokens
     werden automatisch aufgefrischt. */
  const AUTH_STORE = 'familien-dashboard-auth-v1';
  let session = null;
  try { session = JSON.parse(localStorage.getItem(AUTH_STORE) || 'null'); } catch (e) { session = null; }

  function storeSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(AUTH_STORE, JSON.stringify(s));
      else localStorage.removeItem(AUTH_STORE);
    } catch (e) { /* ignorieren */ }
  }

  const NO_AUTH = { noAuth: true }; // Marker: nicht (mehr) angemeldet

  async function authRequest(grant, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST', headers: BASE_HEADERS, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, data };
    storeSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      email: (data.user && data.user.email) || (session && session.email) || '',
    });
    return { ok: true };
  }

  // Gültiges Zugriffs-Token liefern (bei Bedarf vorher auffrischen)
  async function ensureToken() {
    if (!session) throw NO_AUTH;
    if (Date.now() / 1000 > (session.expires_at || 0) - 60) {
      const r = await authRequest('refresh_token', { refresh_token: session.refresh_token });
      if (!r.ok) {
        if (r.status >= 500) throw new Error('HTTP ' + r.status); // Serverproblem: Sitzung behalten
        storeSession(null);
        throw NO_AUTH;
      }
    }
    return session.access_token;
  }

  // Daten-Anfrage mit Benutzer-Token; bei 401 einmal auffrischen und wiederholen
  async function dataFetch(url, opts = {}) {
    const withToken = (token) => fetch(url, Object.assign({}, opts, {
      headers: Object.assign({}, BASE_HEADERS, { Authorization: 'Bearer ' + token }, opts.headers || {}),
    }));
    let res = await withToken(await ensureToken());
    if (res.status === 401) {
      const r = await authRequest('refresh_token', { refresh_token: session && session.refresh_token });
      if (!r.ok) { storeSession(null); throw NO_AUTH; }
      res = await withToken(session.access_token);
    }
    return res;
  }

  function failStatus(e) {
    if (e === NO_AUTH) { setStatus('login'); return; }
    setStatus(navigator.onLine === false ? 'offline' : 'error');
    console.warn('Cloud-Sync fehlgeschlagen', e);
  }

  async function remoteGet() {
    const res = await dataFetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    return rows.length ? rows[0].data : null;
  }

  async function remotePut(data) {
    const res = await dataFetch(`${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ id: ROW_ID, data, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
  }

  const cloud = CHORES.cloud = {
    configured: SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20,
    get status() { return status; },
    onStatus(fn) { onStatus = fn; },
    onRemoteChange(fn) { onRemoteChange = fn; },

    // Vom Store nach jedem Speichern aufgerufen: gebündelt hochladen.
    schedulePush() {
      if (!cloud.configured) return;
      dirty = true;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => cloud.flush(), PUSH_DELAY);
    },

    /* --------------------------- Anmeldung ---------------------------- */
    loggedIn() { return !!session; },
    authEmail() { return (session && session.email) || ''; },

    async login(email, password) {
      const r = await authRequest('password', { email, password });
      if (!r.ok) {
        const msg = (r.data && (r.data.error_description || r.data.msg || r.data.message)) || '';
        if (r.status === 400) return { ok: false, msg: 'E-Mail oder Passwort stimmt nicht.' };
        return { ok: false, msg: 'Anmeldung fehlgeschlagen (' + (msg || r.status) + ').' };
      }
      cloud.sync(); // direkt abgleichen (der neuere Stand gewinnt)
      return { ok: true };
    },

    logout() {
      storeSession(null);
      setStatus('login');
    },

    // Ausstehende Änderungen sofort hochladen.
    async flush() {
      if (!cloud.configured || !dirty) return;
      if (!session) { setStatus('login'); return; } // Änderungen bleiben lokal gemerkt
      clearTimeout(pushTimer);
      setStatus('syncing');
      dirty = false;
      try {
        await remotePut(CHORES.store.snapshot());
        setStatus('ok');
      } catch (e) {
        dirty = true; // beim nächsten Sync erneut versuchen
        failStatus(e);
      }
    },

    // Abgleich: neueren Stand übernehmen bzw. eigenen hochladen.
    async sync() {
      if (!cloud.configured) return;
      if (!session) { setStatus('login'); return; }
      setStatus('syncing');
      try {
        const remote = await remoteGet();
        const localAt = CHORES.store.updatedAt() || '';
        const remoteAt = (remote && remote.updatedAt) || '';
        if (remote && remoteAt > localAt && !dirty) {
          CHORES.store.applyRemote(remote);
          setStatus('ok');
          if (onRemoteChange) onRemoteChange();
        } else if (!remote || dirty || localAt > remoteAt) {
          dirty = true;
          await cloud.flush();
        } else {
          setStatus('ok');
        }
      } catch (e) {
        failStatus(e);
      }
    },

    // Verbindungstest für das Einstellungs-Menü: sagt klar, was los ist.
    async test() {
      if (!cloud.configured) return { ok: false, msg: 'Cloud ist nicht konfiguriert (js/cloud.js).' };
      if (!session) return { ok: false, msg: 'Nicht angemeldet – bitte unten bei „Cloud-Anmeldung" mit dem Familien-Konto einloggen.' };
      try {
        const res = await dataFetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`);
        if (res.status === 401 || res.status === 403) return { ok: false, msg: 'Zugriff verweigert – sind die RLS-Richtlinien auf „authenticated" umgestellt (README)?' };
        if (!res.ok) {
          const body = await res.text();
          // Fehlende Tabelle meldet PostgREST je nach Version als 404 oder 400/42P01
          if (res.status === 404 || body.includes('42P01') || body.includes('PGRST205'))
            return { ok: false, msg: 'Tabelle „dashboard" fehlt – bitte das SQL aus der README im Supabase-SQL-Editor ausführen.' };
          return { ok: false, msg: 'Supabase antwortet mit Fehler ' + res.status + '.' };
        }
        const rows = await res.json();
        if (!rows.length) return { ok: true, msg: 'Verbindung OK – Tabelle ist da, noch kein Datenstand. Er wird beim nächsten Speichern hochgeladen.' };
        const at = rows[0].data && rows[0].data.updatedAt;
        return { ok: true, msg: 'Verbindung OK – Datenstand vorhanden' + (at ? ` (zuletzt gespeichert: ${new Date(at).toLocaleString('de-DE')})` : '') + '.' };
      } catch (e) {
        if (e === NO_AUTH) return { ok: false, msg: 'Anmeldung abgelaufen – bitte unten bei „Cloud-Anmeldung" neu einloggen.' };
        return { ok: false, msg: 'Keine Verbindung zu Supabase (offline oder blockiert).' };
      }
    },

    // Einmalig beim App-Start: erster Abgleich + regelmäßige Prüfung.
    start() {
      if (!cloud.configured) return;
      cloud.sync();
      setInterval(() => { if (!document.hidden) cloud.sync(); }, SYNC_INTERVAL);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) cloud.flush();  // beim Verlassen noch schnell sichern
        else cloud.sync();                   // beim Zurückkommen frisch holen
      });
      window.addEventListener('online', () => cloud.sync());
    },
  };

})(window.CHORES = window.CHORES || {});
