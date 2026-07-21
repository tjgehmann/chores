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
        if (n) { const s = document.createElement('span'); s.className = 'navbadge'; s.textContent = n; b.appendChild(s); }
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

    document.getElementById('menu-btn').addEventListener('click', openMenu);
  }

  function openMenu() {
    UI.modal('Einstellungen', `
      <div class="settings">
        <p class="subtle">Die Daten werden nur auf diesem Gerät gespeichert (Browser-Speicher). Zum Übertragen kannst du sie sichern und wieder einlesen.</p>
        <div class="settings-row">
          <button class="btn" id="set-export">💾 Daten sichern (Download)</button>
          <button class="btn" id="set-import">📥 Daten einlesen</button>
        </div>
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
    buildChrome();
    render();
    // Service Worker (PWA / Offline) registrieren, falls über http(s) geladen
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})(window.CHORES = window.CHORES || {});
