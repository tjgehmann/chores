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

  const HEADERS = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
  };

  let pushTimer = null;
  let dirty = false;        // lokale Änderungen, die noch nicht hochgeladen sind
  let status = 'idle';      // 'ok' | 'syncing' | 'offline' | 'error'
  let onStatus = null;
  let onRemoteChange = null;

  function setStatus(s) {
    if (status === s) return;
    status = s;
    if (onStatus) onStatus(s);
  }
  function failStatus(e) {
    setStatus(navigator.onLine === false ? 'offline' : 'error');
    console.warn('Cloud-Sync fehlgeschlagen', e);
  }

  async function remoteGet() {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`,
      { headers: HEADERS });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    return rows.length ? rows[0].data : null;
  }

  async function remotePut(data) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`,
      {
        method: 'POST',
        headers: Object.assign({ Prefer: 'resolution=merge-duplicates' }, HEADERS),
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

    // Ausstehende Änderungen sofort hochladen.
    async flush() {
      if (!cloud.configured || !dirty) return;
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
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${ROW_ID}&select=data`,
          { headers: HEADERS });
        if (res.status === 401 || res.status === 403) return { ok: false, msg: 'Zugriff verweigert – stimmen Key und RLS-Richtlinien (README)?' };
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
