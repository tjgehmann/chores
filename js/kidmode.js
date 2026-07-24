/* =========================================================================
   Familien-Dashboard – Kinder-Modus
   Ein eigener Vollbild-Modus für die Kinder (Toni & Leo):
   - Kanban-Übersicht „Zu tun" → „Geschafft"
   - beim Antippen ein Fokus-Vollbild mit nur EINER Aufgabe
   - Vorlesen (Sprachausgabe), großer „Fertig"-Knopf, Konfetti + Jubel
   - Fortschritt als sich füllendes Belohnungsglas (keine abstrakten Zahlen)

   Bewusst ohne Wochen-/Monats-/Statistik-Komplexität – entwicklungsgerecht
   für Vierjährige (konkret, bildbasiert, eine Sache nach der anderen).
   ========================================================================= */
(function (CHORES) {
  'use strict';

  const S = CHORES.store;
  const D = CHORES.date;
  const CAT = CHORES.CATEGORIES;

  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let overlay = null;
  let state = { child: null };

  /* ------------------------- kleine Hilfsfunktionen -------------------- */

  // Aufgabe vorlesen (Sprachausgabe des Geräts – funktioniert offline)
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 0.95; u.pitch = 1.15;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignorieren */ }
  }

  // Fröhlicher Erfolgs-Klang, ganz ohne Audiodatei (WebAudio)
  function chime() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ac = new AC();
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { // C E G C
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime + i * 0.11;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.start(t); o.stop(t + 0.42);
      });
    } catch (e) { /* ignorieren */ }
  }

  // Konfetti-Regen (reines DOM/CSS, keine Bibliothek)
  function confetti() {
    const box = el('<div class="kc-confetti"></div>');
    const colors = ['#e84393', '#0984e3', '#00b894', '#fdcb6e', '#a29bfe', '#e17055', '#00cec9'];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * 0.6) + 's';
      p.style.animationDuration = (1.6 + Math.random() * 1.2) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      box.appendChild(p);
    }
    (overlay || document.body).appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // Heutige Aufgaben eines Kindes
  function childTasks(childId) {
    const today = D.today();
    return S.instancesFor(today).filter(i =>
      i.assignees.includes(childId) || i.doneBy.includes(childId) || i.coverBy.includes(childId));
  }

  /* ------------------------------ Ein-/Ausstieg ----------------------- */

  CHORES.kid = {
    // childId optional: direkt mit dem Board dieses Kindes starten
    // (z. B. vom Start-Bildschirm aus), sonst erst „Wer bist du?" zeigen.
    open(childId) {
      overlay = el('<div id="kidapp"></div>');
      document.body.appendChild(overlay);
      document.body.classList.add('kidmode-on');
      const m = childId && S.member(childId);
      state.child = m ? m.id : null;
      if (state.child) renderBoard(); else renderPicker();
    },
    close() {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      if (overlay) overlay.remove();
      overlay = null;
      document.body.classList.remove('kidmode-on');
      if (CHORES.ctx) CHORES.ctx.render(); // Eltern-Ansicht auffrischen
      // Zurück zur Start-Auswahl, damit als Nächstes wieder jeder
      // selbst wählt, wer er ist (Kinder landen nicht in der Eltern-Ansicht).
      if (CHORES.start) CHORES.start.show();
    },
  };

  /* --------------------------- Bildschirm: Wer bist du? --------------- */

  function renderPicker() {
    const kids = S.members().filter(m => m.kind === 'child');
    const people = kids.length ? kids : S.members();
    overlay.innerHTML = '';
    const scr = el(`<div class="kid-screen kid-picker">
      <button class="kid-home" title="Zurück">🏠</button>
      <h1 class="kid-h1">Wer bist du? 👋</h1>
      <div class="kid-people"></div>
    </div>`);
    scr.querySelector('.kid-home').addEventListener('click', () => CHORES.kid.close());
    const row = scr.querySelector('.kid-people');
    people.forEach(m => {
      const c = el(`<button class="kid-person" style="--c:${m.color}">
        <span class="kp-avatar">${m.emoji}</span>
        <span class="kp-name">${esc(m.short)}</span>
      </button>`);
      c.addEventListener('click', () => { state.child = m.id; speak('Hallo ' + m.short); renderBoard(); });
      row.appendChild(c);
    });
    overlay.appendChild(scr);
  }

  /* --------------------------- Bildschirm: Kanban-Board --------------- */

  function renderBoard() {
    const m = S.member(state.child);
    const insts = childTasks(state.child);
    const todo = insts.filter(i => i.status === 'open' || i.status === 'rejected');
    const checking = insts.filter(i => i.pending);
    const done = insts.filter(i => i.done);
    const total = insts.length;
    // Das Glas füllt sich schon beim Melden (hellere Füllung), damit das
    // Kind sofort einen Fortschritt sieht – abgenommen wird es „richtig" blau.
    const donePct = total ? Math.round(done.length / total * 100) : 0;
    const pendPct = total ? Math.round(checking.length / total * 100) : 0;
    // Aus Kindersicht zählt: Ich habe alles gemacht (gemeldet oder abgenommen).
    const allDone = total > 0 && todo.length === 0;

    // Tageswahl: Solange beide Tages-Specials offen und ungewählt sind,
    // darf sich das Kind eines aussuchen (wer zuerst wählt, gewinnt).
    const today = D.today();
    const specials = S.daySpecials(today);
    const specialIds = new Set(specials.map(t => t.id));
    const choosable = specials.length === 2 &&
      specials.every(t => !S.specialPick(t.id, today)) &&
      specials.every(t => S.instance(t, today).status === 'open') &&
      specials.some(t => S.rotationPool(t).includes(state.child));
    const todoShown = choosable ? todo.filter(i => !specialIds.has(i.task.id)) : todo;

    // Familienziel: gemeinsames Glas für alle
    const goal = S.goal();
    let goalHTML = '';
    if (goal) {
      const gp = S.goalProgress();
      const gpct = Math.min(100, Math.round(gp / goal.target * 100));
      const reached = gp >= goal.target;
      goalHTML = `<div class="kid-goal ${reached ? 'reached' : ''}" title="Familienziel: ${esc(goal.title)}">
        <span class="kid-goal-emoji">${goal.emoji}</span>
        <div class="kid-goal-bar"><span style="width:${gpct}%"></span></div>
        <span class="kid-goal-txt">${reached ? 'Geschafft! 🎉' : `⭐ ${gp} / ${goal.target}`}</span>
      </div>`;
    }

    overlay.innerHTML = '';
    const scr = el(`<div class="kid-screen kid-board" style="--c:${m.color}">
      <div class="kid-top">
        <button class="kid-home" title="Zurück">🏠</button>
        <div class="kid-me"><span class="kid-me-avatar">${m.emoji}</span><span class="kid-me-name">${esc(m.name)}</span></div>
        <button class="kid-switch" title="anderes Kind">🔄</button>
      </div>

      <div class="kid-progress">
        ${jarHTML(donePct, pendPct)}
        <div class="kid-dots">${insts.map(i =>
          `<span class="kid-dot ${i.done ? 'on' : ''} ${i.pending ? 'wait' : ''}">${i.done ? '⭐' : (i.pending ? '⏳' : '')}</span>`).join('')}</div>
        <div class="kid-progress-text">${allDone ? 'Alles geschafft! 🎉'
          : (total === 0 ? 'Heute frei! 🎈'
          : (new Date().getHours() >= 18 ? 'Bald ist Schlafenszeit – schaffst du noch einen? 🌙' : 'Tipp auf einen Job!'))}</div>
        <div class="kid-btnrow">
          <button class="kid-ask">🔊 Was muss ich heute machen?</button>
          <button class="kid-stickers">🎁 Wünsche & Sticker <span class="kid-stars">⭐ ${S.balance(m.id)}</span></button>
        </div>
        ${goalHTML}
      </div>

      <div class="kid-columns">
        <div class="kid-col todo">
          <div class="kid-col-head">Zu tun</div>
          <div class="kid-col-body todo-body"></div>
        </div>
        <div class="kid-col done">
          <div class="kid-col-head">Geschafft ⭐</div>
          <div class="kid-col-body done-body"></div>
        </div>
      </div>
    </div>`);

    scr.querySelector('.kid-home').addEventListener('click', () => CHORES.kid.close());
    scr.querySelector('.kid-switch').addEventListener('click', () => renderPicker());
    scr.querySelector('.kid-ask').addEventListener('click', () => announce(m, todo, checking, done));
    scr.querySelector('.kid-stickers').addEventListener('click', () => renderStickers());

    const todoBody = scr.querySelector('.todo-body');
    const doneBody = scr.querySelector('.done-body');

    // Tageswahl-Karte: beide Specials zur Auswahl anbieten
    if (choosable) {
      const box = el(`<div class="kid-choice">
        <div class="kid-choice-head">🎁 Such dir deinen Tages-Job aus!</div>
        <div class="kid-choice-row"></div>
      </div>`);
      const row = box.querySelector('.kid-choice-row');
      specials.forEach(t => {
        const cat = CAT[t.category] || { color: '#999' };
        const b = el(`<button class="kid-choice-card" style="--cat:${cat.color}">
          <span class="kid-choice-emoji">${t.emoji}</span>
          <span class="kid-choice-title">${esc(t.title)}</span>
        </button>`);
        b.addEventListener('click', () => {
          S.pickSpecial(t.id, today, state.child);
          chime();
          speak('Gute Wahl! ' + t.title + ' gehört heute dir.');
          renderBoard();
        });
        row.appendChild(b);
      });
      todoBody.appendChild(box);
    }

    if (!total) todoBody.appendChild(el('<div class="kid-empty">Heute hast du frei 🎈</div>'));
    else if (!todoShown.length && !choosable) todoBody.appendChild(el('<div class="kid-empty">Nichts mehr zu tun! 🌟</div>'));
    if (total && !checking.length && !done.length) doneBody.appendChild(el('<div class="kid-empty small">–</div>'));
    todoShown.forEach(i => todoBody.appendChild(boardCard(i, 'todo')));
    // Gemeldete Aufgaben gelten fürs Kind als geschafft – mit 👀, solange
    // noch jemand drüberschaut.
    checking.forEach(i => doneBody.appendChild(boardCard(i, 'checking')));
    done.forEach(i => doneBody.appendChild(boardCard(i, 'done')));

    overlay.appendChild(scr);
    if (allDone) setTimeout(() => celebrateAll(m), 250);
  }

  // Belohnungsglas als Fortschritt (füllt sich mit „Saft" + Sternen);
  // gemeldete Aufgaben füllen es hell, abgenommene kräftig.
  function jarHTML(donePct, pendPct) {
    return `<div class="kid-jar" title="dein Belohnungsglas">
      <div class="jar-lid"></div>
      <div class="jar-body">
        <div class="jar-fill-pending" style="bottom:${donePct}%;height:${pendPct}%"></div>
        <div class="jar-fill" style="height:${donePct}%"></div>
        <div class="jar-shine"></div>
      </div>
    </div>`;
  }

  function boardCard(i, col) {
    const t = i.task;
    const cat = CAT[t.category] || { color: '#999' };
    const badge = col === 'done' ? '<span class="kid-card-check">✔</span>'
      : col === 'checking' ? '<span class="kid-card-wait">👀</span>'
      : (i.rejected ? '<span class="kid-card-again" title="nochmal">🔁</span>' : '<span class="kid-card-go">▶</span>');
    const card = el(`<button class="kid-card col-${col} ${i.rejected ? 'is-rejected' : ''}" style="--cat:${cat.color}">
      <span class="kid-card-icon">${t.emoji}</span>
      <span class="kid-card-main">
        <span class="kid-card-title">${esc(t.title)}</span>
        ${i.rejected && i.rejection ? '<span class="kid-card-again-note">🔁 nochmal – tipp drauf</span>' : ''}
      </span>
      ${badge}
    </button>`);
    if (col === 'done') {
      card.addEventListener('click', () => speak(t.title));
    } else if (col === 'checking') {
      card.addEventListener('click', () => speak(t.title + '. Das wird gerade geprüft.'));
    } else {
      card.addEventListener('click', () => openFocus(i));
    }
    return card;
  }

  /* --------------------------- Bildschirm: Fokus (eine Aufgabe) ------- */

  function openFocus(i) {
    const t = i.task;
    const cat = CAT[t.category] || { color: '#999' };
    const rejBy = i.rejection ? S.member(i.rejection.by) : null;
    const focus = el(`<div class="kid-focus" style="--cat:${cat.color}">
      <button class="kid-focus-back" title="zurück">↩︎</button>
      <div class="kid-focus-inner">
        <div class="kid-focus-icon">${t.emoji}</div>
        <div class="kid-focus-title">${esc(t.title)}</div>
        ${t.description ? `<div class="kid-focus-desc">${esc(t.description)}</div>` : ''}
        ${i.rejected && i.rejection ? `<div class="kid-focus-again">🔁 Nochmal, bitte!${i.rejection.reason ? `<br><b>${esc(i.rejection.reason)}</b>` : ''}${rejBy ? `<br><span class="kf-again-by">${rejBy.emoji} ${esc(rejBy.short)} hat nachgeschaut</span>` : ''}</div>` : ''}
        <div class="kid-focus-btnrow">
          <button class="kid-speak">🔊 Vorlesen</button>
          <button class="kid-timer-btn">⏳ Sanduhr starten</button>
        </div>
        <div class="kid-timer" hidden>
          <span class="kid-timer-face">⏳</span>
          <div class="kid-timer-bar"><span style="width:100%"></span></div>
        </div>
        <button class="kid-done-btn">Fertig! ✓</button>
      </div>
    </div>`);

    // Sanduhr: 5 Minuten Wettlauf gegen den Sand (rein visuell, kein Druck –
    // am Ende gibt es nur einen freundlichen Klang und eine Frage)
    let timerInt = null;
    const TIMER_SECS = 5 * 60;
    const tbtn = focus.querySelector('.kid-timer-btn');
    const tbox = focus.querySelector('.kid-timer');
    const tbar = focus.querySelector('.kid-timer-bar span');
    const stopTimer = () => { if (timerInt) { clearInterval(timerInt); timerInt = null; } };
    tbtn.addEventListener('click', () => {
      if (timerInt) return;
      tbox.hidden = false;
      tbtn.textContent = '⏳ Der Sand läuft!';
      speak('Die Sanduhr läuft! Schaffst du es, bevor der Sand durch ist?');
      const t0 = Date.now();
      timerInt = setInterval(() => {
        const left = Math.max(0, TIMER_SECS - (Date.now() - t0) / 1000);
        tbar.style.width = (left / TIMER_SECS * 100) + '%';
        if (!left) {
          stopTimer();
          tbtn.textContent = '🔔 Sanduhr ist durch!';
          chime();
          speak('Die Sanduhr ist durch! Bist du fertig?');
        }
      }, 1000);
    });

    focus.querySelector('.kid-focus-back').addEventListener('click', () => { stopTimer(); window.speechSynthesis && window.speechSynthesis.cancel(); focus.remove(); });
    focus.querySelector('.kid-speak').addEventListener('click', () =>
      speak(t.title + '. ' + (t.description || '') + (i.rejected && i.rejection && i.rejection.reason ? ' Nochmal: ' + i.rejection.reason : '')));
    focus.querySelector('.kid-done-btn').addEventListener('click', () => {
      stopTimer();
      S.submit(t.id, i.date, i.member);   // als fertig melden -> wartet auf Abnahme
      chime(); confetti();
      const rater = S.member(S.instance(t, i.date, i.member).rater);
      const yay = el(`<div class="kid-yay">
        <div class="kid-yay-avatar">${(S.member(state.child) || {}).emoji || '🎉'}</div>
        <div class="kid-yay-text">Toll gemeldet! 🎉</div>
        <div class="kid-yay-sub">Jetzt schaut ${rater ? rater.emoji + ' ' + esc(rater.name) : 'jemand'} drüber 👀</div>
      </div>`);
      focus.querySelector('.kid-focus-inner').replaceWith(yay);
      speak('Toll gemeldet! Jetzt wird geschaut.');
      setTimeout(() => { focus.remove(); renderBoard(); }, 1900);
    });
    overlay.appendChild(focus);
    // Aufgabe (und ggf. den Grund) direkt vorlesen
    setTimeout(() => speak(t.title + (i.rejected && i.rejection && i.rejection.reason ? '. Nochmal: ' + i.rejection.reason : '')), 350);
  }

  /* --------------------- Bildschirm: Meine Sticker -------------------- */
  // Sticker-Album + Kaufen direkt im Kinder-Modus: Das Kind sieht sein
  // Sterne-Guthaben (erspielte Punkte) und tauscht es gegen Sammel-Sticker.

  const RARITY = {
    common:    { label: 'Sticker',      color: '#b2bec3' },
    rare:      { label: 'Selten ✨',     color: '#a29bfe' },
    legendary: { label: 'Superselten 👑', color: '#fdcb6e' },
  };

  function renderStickers() {
    const m = S.member(state.child);
    const balance = S.balance(m.id);
    const owned = S.stickerCollection(m.id);
    const ownedCount = Object.values(owned).reduce((a, b) => a + b, 0);
    const openWishes = S.rewardPurchases(m.id).filter(p => p.status === 'open');

    overlay.innerHTML = '';
    const scr = el(`<div class="kid-screen kid-stickshop" style="--c:${m.color}">
      <div class="kid-top">
        <button class="kid-back-board" title="zurück">↩︎</button>
        <div class="kid-me"><span class="kid-me-avatar">${m.emoji}</span><span class="kid-me-name">Sticker & Wünsche</span></div>
        <div class="kid-balance" title="deine Sterne">⭐ ${balance}</div>
      </div>
      <div class="kid-shop-scroll">
        <div class="kid-shop-sec-head">🎁 Wünsch dir was</div>
        ${openWishes.length ? `<div class="kid-wish-open">⏳ ${openWishes.length === 1
          ? 'Ein Wunsch wartet' : openWishes.length + ' Wünsche warten'} noch auf Mama & Papa!</div>` : ''}
        <div class="kid-wish-list"></div>
        <div class="kid-shop-sec-head">⭐ Deine Sticker${ownedCount
          ? ` <span class="kid-sec-count">${ownedCount} im Album 🎉</span>` : ''}</div>
        <div class="kid-stick-grid"></div>
      </div>
    </div>`);

    scr.querySelector('.kid-back-board').addEventListener('click', () => renderBoard());

    // Echte Belohnungen: Das Kind „wünscht" sie sich mit seinen Sternen –
    // eingelöst wird der Wunsch von den Eltern (Shop: „gekauft" -> einlösen).
    const wishList = scr.querySelector('.kid-wish-list');
    S.rewards()
      .filter(r => r.group === 'child' || r.group === 'all')
      .sort((a, b) => a.cost - b.cost)
      .forEach(rw => {
        const affordable = balance >= rw.cost;
        const wished = openWishes.some(p => p.refId === rw.id);
        const card = el(`<button class="kid-wish ${affordable ? '' : 'locked'}">
          <span class="kid-wish-emoji">${rw.emoji}</span>
          <span class="kid-wish-main">
            <span class="kid-wish-title">${esc(rw.title)}</span>
            ${wished ? '<span class="kid-wish-flag">⏳ schon gewünscht</span>' : ''}
          </span>
          <span class="kid-stick-cost">⭐ ${rw.cost}</span>
        </button>`);
        card.addEventListener('click', () => {
          if (!affordable) {
            speak(`${rw.title}. Dafür brauchst du noch ${rw.cost - balance} Sterne. Weiter so!`);
            card.classList.remove('shake'); void card.offsetWidth;
            card.classList.add('shake');
            return;
          }
          confirmWish(m, rw);
        });
        wishList.appendChild(card);
      });

    const grid = scr.querySelector('.kid-stick-grid');
    S.stickers().forEach(sk => {
      const n = owned[sk.id] || 0;
      const affordable = balance >= sk.cost;
      const rar = RARITY[sk.rarity] || RARITY.common;
      const card = el(`<button class="kid-stick ${n ? 'owned' : ''} ${affordable ? '' : 'locked'}" style="--r:${rar.color}">
        ${n ? `<span class="kid-stick-count">×${n}</span>` : ''}
        <span class="kid-stick-emoji">${sk.emoji}</span>
        <span class="kid-stick-name">${esc(sk.name)}</span>
        <span class="kid-stick-cost">⭐ ${sk.cost}</span>
      </button>`);
      card.addEventListener('click', () => {
        if (!affordable) {
          speak(`${sk.name}. Dafür brauchst du noch ${sk.cost - balance} Sterne. Weiter so!`);
          card.classList.remove('shake'); void card.offsetWidth;
          card.classList.add('shake');
          return;
        }
        confirmSticker(m, sk);
      });
      grid.appendChild(card);
    });

    overlay.appendChild(scr);
  }

  // Wunsch-Kauf: kaufen -> Übergabe an die Eltern deutlich machen
  function confirmWish(m, rw) {
    const ask = el(`<div class="kid-ask-overlay">
      <div class="kid-ask-card" style="--c:${m.color}">
        <div class="kid-buy-emoji">${rw.emoji}</div>
        <div class="kid-ask-title">${esc(rw.title)}</div>
        ${rw.description ? `<div class="kid-wish-desc">${esc(rw.description)}</div>` : ''}
        <div class="kid-wish-cost">Für ⭐ ${rw.cost} wünschen?</div>
        <div class="kid-buy-btns">
          <button class="kid-buy-yes">Ja! 🎉</button>
          <button class="kid-buy-no">Lieber nicht</button>
        </div>
      </div>
    </div>`);
    ask.querySelector('.kid-buy-no').addEventListener('click', () => ask.remove());
    ask.addEventListener('click', (e) => { if (e.target === ask) ask.remove(); });
    ask.querySelector('.kid-buy-yes').addEventListener('click', () => {
      const res = S.buy(m.id, 'reward', rw.id);
      if (!res.ok) { ask.remove(); speak('Das hat leider nicht geklappt.'); return; }
      chime(); confetti();
      // Die App verspricht nichts, was sie nicht halten kann:
      // Die Einlösung übernehmen die Eltern (Shop -> einlösen).
      ask.querySelector('.kid-ask-card').innerHTML = `
        <div class="kid-buy-emoji">${rw.emoji}</div>
        <div class="kid-ask-title">Juhu! Dein Wunsch ist gekauft! 🎉</div>
        <div class="kid-wish-handoff">👉 Zeig das Mama oder Papa –<br>sie machen es mit dir aus!</div>
        <div class="kid-buy-btns"><button class="kid-buy-yes wish-ok">Mach ich! 👍</button></div>`;
      ask.querySelector('.wish-ok').addEventListener('click', () => { ask.remove(); renderStickers(); });
      speak('Juhu! Dein Wunsch ist gekauft. Zeig das Mama oder Papa, sie machen es mit dir aus!');
    });
    overlay.appendChild(ask);
    speak(`Möchtest du dir ${rw.title} für ${rw.cost} Sterne wünschen?`);
  }

  // Großer Ja/Nein-Dialog vor dem Kauf (mit Vorlesen)
  function confirmSticker(m, sk) {
    const ask = el(`<div class="kid-ask-overlay">
      <div class="kid-ask-card" style="--c:${m.color}">
        <div class="kid-buy-emoji">${sk.emoji}</div>
        <div class="kid-ask-title">${esc(sk.name)} für ⭐ ${sk.cost} kaufen?</div>
        <div class="kid-buy-btns">
          <button class="kid-buy-yes">Ja! 🎉</button>
          <button class="kid-buy-no">Lieber nicht</button>
        </div>
      </div>
    </div>`);
    ask.querySelector('.kid-buy-no').addEventListener('click', () => ask.remove());
    ask.addEventListener('click', (e) => { if (e.target === ask) ask.remove(); });
    ask.querySelector('.kid-buy-yes').addEventListener('click', () => {
      const res = S.buy(m.id, 'sticker', sk.id);
      ask.remove();
      if (!res.ok) { speak('Das hat leider nicht geklappt.'); return; }
      chime(); confetti();
      speak(`Juhu! Der Sticker ${sk.name} gehört jetzt dir!`);
      renderStickers();
    });
    overlay.appendChild(ask);
    speak(`Möchtest du den Sticker ${sk.name} für ${sk.cost} Sterne kaufen?`);
  }

  /* -------------- „Was muss ich heute machen?" – vorlesen ------------- */

  // Baut den gesprochenen Satz aus den offenen Aufgaben.
  function announceText(m, todo) {
    if (!todo.length) return `Hallo ${m.short}! Du hast heute schon alles geschafft. Super gemacht!`;
    const titles = todo.map(i => i.task.title);
    let list;
    if (titles.length === 1) list = titles[0];
    else list = titles.slice(0, -1).join(', ') + ' und ' + titles[titles.length - 1];
    const wort = titles.length === 1 ? 'eine Aufgabe' : titles.length + ' Aufgaben';
    return `Hallo ${m.short}! Heute hast du ${wort}: ${list}.`;
  }

  // Zeigt die Antwort als Sprechblase (Text + große Icons) UND liest sie vor.
  function announce(m, todo, checking, done) {
    const text = announceText(m, todo);
    const bubble = el(`<div class="kid-ask-overlay">
      <div class="kid-ask-card" style="--c:${m.color}">
        <button class="kid-ask-close" title="schließen">✕</button>
        <div class="kid-ask-avatar">${m.emoji}</div>
        <div class="kid-ask-title">${todo.length
          ? `Das ist heute dran, ${esc(m.short)}:`
          : `Alles geschafft, ${esc(m.short)}! 🎉`}</div>
        <div class="kid-ask-list">${todo.map(i => `
          <div class="kid-ask-item">
            <span class="kid-ask-emoji">${i.task.emoji}</span>
            <span class="kid-ask-name">${esc(i.task.title)}</span>
            ${i.rejected ? '<span class="kid-ask-again" title="nochmal">🔁</span>' : ''}
          </div>`).join('') || '<div class="kid-ask-none">Du hast heute frei 🎈</div>'}</div>
        ${checking && checking.length ? `<div class="kid-ask-hint">👀 ${checking.length} ${checking.length === 1 ? 'Aufgabe wird' : 'Aufgaben werden'} noch geprüft.</div>` : ''}
        <button class="kid-ask-repeat">🔊 Nochmal vorlesen</button>
      </div>
    </div>`);
    const close = () => { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} bubble.remove(); };
    bubble.querySelector('.kid-ask-close').addEventListener('click', close);
    bubble.addEventListener('click', (e) => { if (e.target === bubble) close(); });
    bubble.querySelector('.kid-ask-repeat').addEventListener('click', () => speak(text));
    overlay.appendChild(bubble);
    speak(text);
  }

  /* --------------------------- Alles-geschafft-Feier ----------------- */

  function celebrateAll(m) {
    confetti(); chime();
    const done = el(`<div class="kid-alldone">
      <div class="kid-alldone-avatar">${m.emoji}</div>
      <div class="kid-alldone-text">Toll, ${esc(m.short)}!<br>Du hast <b>alles</b> geschafft! 🏆</div>
      <div class="kid-alldone-sub">Du hast heute richtig geholfen. 💚</div>
      <button class="kid-alldone-ok">Juhu! 🎉</button>
    </div>`);
    done.querySelector('.kid-alldone-ok').addEventListener('click', () => done.remove());
    overlay.appendChild(done);
    speak('Toll gemacht! Du hast alles geschafft!');
  }

})(window.CHORES = window.CHORES || {});
