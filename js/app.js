/* =========================================================================
   Familien-Dashboard – App-Steuerung
   Initialisiert den Zustand, baut die Navigation und rendert die aktive
   Ansicht. Verbindet die einzelnen UI-Module.
   ========================================================================= */
(function (CHORES) {
  'use strict';

  const S = CHORES.store;
  const UI = CHORES.ui;
  const D = CHORES.date;

  const NAV = [
    { id: 'kids',     label: 'Kinder',       icon: '🧒', kid: true },
    { id: 'today',    label: 'Heute',        icon: '📅' },
    { id: 'week',     label: 'Woche',        icon: '🗓️' },
    { id: 'month',    label: 'Monat',        icon: '📆' },
    { id: 'stats',    label: 'Statistik',    icon: '🏆' },
    { id: 'shop',     label: 'Shop',         icon: '🎁' },
    { id: 'ratings',  label: 'Abnahme',      icon: '✅' },
    { id: 'vacation', label: 'Urlaub',       icon: '🏖️' },
    { id: 'manage',   label: 'Aufgaben',     icon: '⚙️' },
  ];

  const app = {
    view: 'today',
    date: D.today(),
  };

  const ctx = {
    get date() { return app.date; },
    setDate(iso) { app.date = iso; ctx.render(); },
    go(view) { app.view = view; ctx.render(); },
    render,
  };

  function pendingBadge() {
    const n = S.pendingRatings().length;
    return n ? `<span class="navbadge">${n}</span>` : '';
  }

  function render() {
    const rootMain = document.getElementById('main');
    rootMain.innerHTML = '';
    // Aktiven Nav-Button markieren + Bewerten-Badge aktualisieren
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === app.view);
      const badge = b.querySelector('.navbadge');
      if (badge) badge.remove();
      if (b.dataset.view === 'ratings') {
        const n = CHORES.store.pendingRatings().length;
        if (n) {
          const s = document.createElement('span');
          // rot & pulsierend, wenn etwas schon über 24 h auf Abnahme wartet
          s.className = 'navbadge' + (CHORES.store.overduePending().length ? ' urgent' : '');
          s.textContent = n; b.appendChild(s);
        }
      }
    });
    (UI[app.view] || UI.today)(rootMain, ctx);
    rootMain.scrollTop = 0;
  }

  function buildChrome() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(n =>
      `<button class="nav-btn ${n.kid ? 'kidbtn' : ''}" data-view="${n.id}"><span class="nav-icon">${n.icon}</span><span class="nav-label">${n.label}</span></button>`
    ).join('');
    nav.querySelectorAll('.nav-btn').forEach(b =>
      b.addEventListener('click', () => {
        if (b.dataset.view === 'kids') { CHORES.kid.open(); return; }
        ctx.go(b.dataset.view);
      }));

    // Kopfzeile: Titel + Familienleiste + Menü
    const family = document.getElementById('familybar');
    family.innerHTML = S.members().map(m =>
      `<span class="fam" style="--c:${m.color}">${m.emoji} ${m.short}</span>`).join('');

    updateBackupDot();
  }

  // Cloud-Status in der Kopfzeile (Supabase-Sync)
  const CLOUD_STATES = {
    ok:      ['☁️', 'Mit der Cloud synchronisiert'],
    syncing: ['🔄', 'Synchronisiert …'],
    offline: ['📴', 'Offline – Änderungen werden nachgereicht, sobald wieder Netz da ist'],
    error:   ['⚠️', 'Cloud nicht erreichbar – Daten sind lokal gesichert (Tabelle eingerichtet? Siehe README)'],
    login:   ['🔑', 'Cloud-Anmeldung nötig – hier tippen: Einstellungen → Cloud-Anmeldung'],
  };
  function updateCloudInd(s) {
    const ind = document.getElementById('cloud-ind');
    if (!ind) return;
    const [icon, title] = CLOUD_STATES[s] || CLOUD_STATES.ok;
    ind.textContent = icon;
    ind.title = title;
    ind.className = 'cloud-ind ' + s;
  }

  // Roter Punkt am Zahnrad, wenn eine Sicherung überfällig ist
  function updateBackupDot() {
    const btn = document.getElementById('menu-btn');
    if (btn) btn.classList.toggle('attention', S.backupInfo().due);
  }

  function backupLine() {
    const b = S.backupInfo();
    if (!b.last) return b.due
      ? '<b style="color:var(--warn)">⚠️ Noch keine Sicherung erstellt – jetzt wäre ein guter Zeitpunkt!</b>'
      : 'Noch keine Sicherung erstellt.';
    const when = b.days === 0 ? 'heute' : (b.days === 1 ? 'gestern' : `vor ${b.days} Tagen`);
    return b.due
      ? `<b style="color:var(--warn)">⚠️ Letzte Sicherung ${when} – bitte wieder sichern!</b>`
      : `Letzte Sicherung: ${when}.`;
  }

  function openMenu() {
    UI.modal('Einstellungen', `
      <div class="settings">
        <p class="subtle">Die Daten werden in der Cloud (Supabase) gespeichert und auf allen Geräten abgeglichen; auf dem Gerät bleibt ein Offline-Cache. Mit Sichern/Einlesen kannst du zusätzlich eine Datei-Kopie anlegen.</p>
        <p class="subtle" id="backup-info">${backupLine()}</p>
        <div class="settings-row">
          <button class="btn" id="set-export">💾 Daten sichern (Download)</button>
          <button class="btn" id="set-import">📥 Daten einlesen</button>
        </div>
        <div class="settings-row">
          <button class="btn" id="set-cloudtest">☁️ Cloud-Verbindung testen</button>
        </div>
        <p class="subtle small" id="cloudtest-result"></p>
        <hr>
        <div class="fam-manage-head">🔑 Cloud-Anmeldung</div>
        <div id="auth-box"></div>
        <hr>
        <div class="fam-manage-head">👨‍👩‍👧‍👦 Familie</div>
        <p class="subtle small">Mitglieder hinzufügen, bearbeiten oder entfernen.</p>
        <div id="fam-list"></div>
        <hr>
        <button class="btn danger" id="set-reset">♻️ Auf Standard zurücksetzen</button>
        <p class="subtle small">Setzt Aufgaben, Erledigungen, Bewertungen und Urlaube zurück.</p>
        <input type="file" id="import-file" accept="application/json" style="display:none">
      </div>`,
      (box, close) => {
        box.querySelector('#set-export').addEventListener('click', () => {
          const blob = new Blob([S.exportJSON()], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `familien-dashboard-${D.today()}.json`;
          a.click();
          S.markBackup();
          box.querySelector('#backup-info').innerHTML = backupLine();
          updateBackupDot();
        });
        UI.renderFamilyManager(box.querySelector('#fam-list'), () => { buildChrome(); render(); });

        // Cloud-Anmeldung: einmal pro Gerät mit dem Familien-Konto einloggen
        const authBox = box.querySelector('#auth-box');
        const paintAuth = () => {
          if (!CHORES.cloud || !CHORES.cloud.configured) {
            authBox.innerHTML = '<p class="subtle small">Cloud ist nicht konfiguriert (js/cloud.js).</p>';
            return;
          }
          if (CHORES.cloud.loggedIn()) {
            authBox.innerHTML = `
              <p class="subtle small">✅ Dieses Gerät ist angemeldet${CHORES.cloud.authEmail() ? ` als <b>${CHORES.cloud.authEmail()}</b>` : ''} und synchronisiert mit eurer Cloud.</p>
              <button class="btn" id="auth-logout">Abmelden</button>`;
            authBox.querySelector('#auth-logout').addEventListener('click', () => { CHORES.cloud.logout(); paintAuth(); });
          } else {
            authBox.innerHTML = `
              <p class="subtle small">Einmal pro Gerät mit dem Familien-Konto anmelden – erst dann kann dieses Gerät die Cloud-Daten lesen und schreiben. Bis dahin arbeitet die App lokal weiter.</p>
              <div class="auth-form">
                <input type="email" id="auth-email" placeholder="E-Mail" autocomplete="username">
                <input type="password" id="auth-pass" placeholder="Passwort" autocomplete="current-password">
                <button class="btn primary" id="auth-login">Anmelden</button>
              </div>
              <p class="subtle small" id="auth-msg"></p>`;
            authBox.querySelector('#auth-login').addEventListener('click', async () => {
              const msgEl = authBox.querySelector('#auth-msg');
              msgEl.textContent = 'Melde an …';
              const r = await CHORES.cloud.login(
                authBox.querySelector('#auth-email').value.trim(),
                authBox.querySelector('#auth-pass').value);
              if (r.ok) paintAuth();
              else msgEl.innerHTML = '❌ ' + r.msg;
            });
          }
        };
        paintAuth();
        box.querySelector('#set-cloudtest').addEventListener('click', async () => {
          const out = box.querySelector('#cloudtest-result');
          out.textContent = 'Prüfe Verbindung …';
          const r = await CHORES.cloud.test();
          out.innerHTML = (r.ok ? '✅ ' : '❌ ') + r.msg;
          if (r.ok) CHORES.cloud.sync(); // wenn alles gut ist, gleich abgleichen
        });
        const file = box.querySelector('#import-file');
        box.querySelector('#set-import').addEventListener('click', () => file.click());
        file.addEventListener('change', () => {
          const f = file.files[0]; if (!f) return;
          const reader = new FileReader();
          reader.onload = () => {
            try { S.importJSON(reader.result); close(); render(); }
            catch (e) { alert('Datei konnte nicht gelesen werden.'); }
          };
          reader.readAsText(f);
        });
        box.querySelector('#set-reset').addEventListener('click', () => {
          UI.confirm('Wirklich alles auf Standard zurücksetzen?', () => { S.reset(); close(); buildChrome(); render(); });
        });
      });
  }

  function init() {
    S.load();
    CHORES.ctx = ctx;   // für den Kinder-Modus, um danach aufzufrischen
    // Statische Kopfzeilen-Knöpfe nur EINMAL binden (buildChrome läuft
    // auch bei Cloud-Updates erneut und würde Handler verdoppeln)
    document.getElementById('menu-btn').addEventListener('click', openMenu);
    document.getElementById('user-btn').addEventListener('click', () => CHORES.start.show());
    document.getElementById('cloud-ind').addEventListener('click', openMenu); // z. B. bei 🔑 direkt zur Anmeldung
    buildChrome();
    render();
    CHORES.start.show(); // Erst auswählen, wer man ist (Toni, Leo oder Eltern)
    // Browser bitten, den Speicher dauerhaft zu behalten (Schutz davor,
    // dass Safari/der Browser die Daten bei Platzmangel aufräumt).
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().catch(() => {});
    }
    // Cloud-Sync (Supabase): Stand abgleichen und aktuell halten
    if (CHORES.cloud && CHORES.cloud.configured) {
      CHORES.cloud.onStatus(updateCloudInd);
      CHORES.cloud.onRemoteChange(() => {
        // Ein anderes Gerät hat gespeichert: Oberfläche auffrischen.
        buildChrome();
        render();
        updateBackupDot();
        if (CHORES.start.visible()) CHORES.start.show(); // Kachel-Zähler aktualisieren
      });
      CHORES.cloud.start();
    }
    // Service Worker (PWA / Offline) registrieren, falls über http(s) geladen
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})(window.CHORES = window.CHORES || {});
