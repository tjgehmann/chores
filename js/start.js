/* =========================================================================
   Familien-Dashboard – Start-Bildschirm („Wer bist du?")
   Wird beim Öffnen der App als Erstes angezeigt: Jedes Familienmitglied
   wählt sich selbst aus und landet direkt bei seinen Aufgaben.
   - Kinder (Toni & Leo) -> Kinder-Modus mit dem eigenen Board
   - Eltern              -> normales Dashboard (Ansicht „Heute")
   Auf jeder Kachel steht, wie viele Aufgaben heute noch offen sind.
   ========================================================================= */
(function (CHORES) {
  'use strict';

  const S = CHORES.store;
  const D = CHORES.date;

  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let overlay = null;

  // Eltern-Sperre: kleine Rechenaufgabe mit Zahlenfeld. Für Erwachsene
  // trivial, für Vierjährige (noch) nicht lösbar – schützt Editor,
  // Abnahme und „Zurücksetzen" vor neugierigen Kinderfingern.
  function parentGate(onOk) {
    const a = 11 + Math.floor(Math.random() * 8); // 11–18
    const b = 3 + Math.floor(Math.random() * 6);  // 3–8
    const answer = String(a + b);
    let entered = '';

    const gate = el(`<div class="gate-back">
      <div class="gate-card">
        <button class="gate-close" title="abbrechen">✕</button>
        <div class="gate-title">🔒 Eltern-Check</div>
        <div class="gate-q">Wie viel ist <b>${a} + ${b}</b>?</div>
        <div class="gate-display">&nbsp;</div>
        <div class="gate-pad"></div>
      </div>
    </div>`);
    const display = gate.querySelector('.gate-display');
    const card = gate.querySelector('.gate-card');
    const pad = gate.querySelector('.gate-pad');

    const show = () => { display.textContent = entered || ' '; };
    const wrong = () => {
      entered = ''; show();
      card.classList.remove('shake'); void card.offsetWidth; // Animation neu starten
      card.classList.add('shake');
    };

    ['1','2','3','4','5','6','7','8','9','⌫','0','OK'].forEach(key => {
      const btn = el(`<button class="gate-key ${key === 'OK' ? 'ok' : ''}">${key}</button>`);
      btn.addEventListener('click', () => {
        if (key === '⌫') { entered = entered.slice(0, -1); show(); return; }
        if (key === 'OK') {
          if (entered === answer) { gate.remove(); onOk(); }
          else wrong();
          return;
        }
        if (entered.length < 3) { entered += key; show(); }
      });
      pad.appendChild(btn);
    });

    gate.querySelector('.gate-close').addEventListener('click', () => gate.remove());
    gate.addEventListener('click', (e) => { if (e.target === gate) gate.remove(); });
    (overlay || document.body).appendChild(gate);
  }

  // Offene (noch zu erledigende) Aufgaben von heute für eine Personengruppe
  function openTasks(memberIds) {
    return S.instancesFor(D.today()).filter(i =>
      !i.done && !i.pending && i.assignees.some(id => memberIds.includes(id)));
  }

  function hintHTML(open, total) {
    if (!total) return '<span class="start-hint free">Heute frei 🎈</span>';
    if (!open) return '<span class="start-hint done">Alles geschafft! 🎉</span>';
    return `<span class="start-hint todo">${open === 1 ? 'noch 1 Aufgabe' : `noch ${open} Aufgaben`}</span>`;
  }

  function totalTasks(memberIds) {
    return S.instancesFor(D.today()).filter(i =>
      i.assignees.some(id => memberIds.includes(id))).length;
  }

  CHORES.start = {
    show() {
      CHORES.start.hide();
      const dt = D.parse(D.today());
      const kids = S.members().filter(m => m.kind === 'child');
      const adults = S.members().filter(m => m.kind === 'adult');

      overlay = el(`<div id="startapp">
        <div class="start-inner">
          <div class="start-brand">🏡 Familien-Dashboard</div>
          <h1 class="start-h1">Wer bist du? 👋</h1>
          <div class="start-sub">${esc(D.WEEKDAY_LONG[dt.getDay()])}, ${dt.getDate()}. ${esc(D.MONTHS[dt.getMonth()])} – tipp auf dich und sieh, was heute zu tun ist.</div>
          <div class="start-people"></div>
        </div>
      </div>`);

      const row = overlay.querySelector('.start-people');

      // Kinder: direkt in den Kinder-Modus mit dem eigenen Board
      kids.forEach(m => {
        const open = openTasks([m.id]).length;
        const total = totalTasks([m.id]);
        const c = el(`<button class="start-person" style="--c:${m.color}">
          <span class="sp-avatar">${m.emoji}</span>
          <span class="sp-name">${esc(m.short)}</span>
          ${hintHTML(open, total)}
        </button>`);
        c.addEventListener('click', () => { CHORES.start.hide(); CHORES.kid.open(m.id); });
        row.appendChild(c);
      });

      // Eltern: eine gemeinsame Kachel -> Dashboard mit der Heute-Ansicht
      const adultIds = adults.map(m => m.id);
      const open = openTasks(adultIds).length;
      const total = totalTasks(adultIds);
      const p = el(`<button class="start-person start-parent" style="--c:#6c5ce7">
        <span class="sp-avatar">${adults.map(m => m.emoji).join('') || '👨‍👩‍👧'}</span>
        <span class="sp-name">Eltern</span>
        ${hintHTML(open, total)}
      </button>`);
      p.addEventListener('click', () => parentGate(() => {
        CHORES.start.hide();
        if (CHORES.ctx) CHORES.ctx.go('today');
      }));
      row.appendChild(p);

      document.body.appendChild(overlay);
      document.body.classList.add('startmode-on');
    },

    hide() {
      if (overlay) overlay.remove();
      overlay = null;
      document.body.classList.remove('startmode-on');
    },
  };

})(window.CHORES = window.CHORES || {});
