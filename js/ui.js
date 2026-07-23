/* =========================================================================
   Familien-Dashboard – Oberfläche (Rendering)
   Baut aus dem Zustand die HTML-Ansichten: Heute, Woche, Monat,
   Statistik, Bewertungen, Urlaub und Aufgaben-Verwaltung.
   ========================================================================= */
(function (CHORES) {
  'use strict';

  const S = CHORES.store;
  const D = CHORES.date;
  const CAT = CHORES.CATEGORIES;

  /* --------------------------- kleine Helfer ---------------------------- */
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function memberChip(id, extra = '') {
    const m = S.member(id); if (!m) return '';
    return `<span class="chip" style="--c:${m.color}" ${extra}>${m.emoji} ${esc(m.short)}</span>`;
  }
  function stars(n, max = 5) {
    let s = '';
    for (let i = 1; i <= max; i++) s += `<span class="star ${i <= n ? 'on' : ''}">★</span>`;
    return `<span class="stars">${s}</span>`;
  }

  const UI = CHORES.ui = {};

  /* =====================================================================
     HEUTE
     ===================================================================== */
  UI.today = function (root, ctx) {
    const iso = ctx.date;
    const dt = D.parse(iso);
    const title = `${D.WEEKDAY_LONG[dt.getDay()]}, ${dt.getDate()}. ${D.MONTHS[dt.getMonth()]}`;

    const wrap = el(`<div class="view">
      <div class="view-head">
        <div>
          <h2>Heute</h2>
          <div class="subtle">${esc(title)}</div>
        </div>
        <div class="daynav">
          <button class="btn ghost" data-nav="-1">◀</button>
          <button class="btn ghost" data-nav="today">Heute</button>
          <button class="btn ghost" data-nav="1">▶</button>
        </div>
      </div>
    </div>`);
    wrap.querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.nav;
      ctx.setDate(v === 'today' ? D.today() : D.addDays(iso, Number(v)));
    }));

    // Fortschrittsbalken des Tages
    const insts = S.instancesFor(iso);
    const doneCount = insts.filter(i => i.done).length;
    const pendingCount = insts.filter(i => i.pending).length;
    const pct = insts.length ? Math.round(doneCount / insts.length * 100) : 0;
    wrap.appendChild(el(`<div class="dayprogress">
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="subtle">${doneCount} / ${insts.length} abgenommen · ${pct}%${pendingCount ? ` · <b style="color:var(--warn)">${pendingCount} wartet auf Abnahme</b>` : ''}</div>
    </div>`));

    // Abend-Check: ab 18 Uhr sanft auf offene Aufgaben des Tages hinweisen
    const openCount = insts.filter(i => !i.done && !i.pending).length;
    if (iso === D.today() && new Date().getHours() >= 18 && openCount > 0) {
      wrap.appendChild(el(`<div class="evening-hint">🌙 Abend-Check: ${openCount === 1
        ? 'Eine Aufgabe ist' : openCount + ' Aufgaben sind'} heute noch offen – kurzer End-Spurt?</div>`));
    }

    // Wochen-Bilanz: sonntags eine kleine Auswertung für die Eltern
    if (D.weekdayIndex(iso) === 0) {
      const r = S.weekReview(iso);
      if (r.total) {
        const lag = r.laggards.length
          ? `<div class="weekcard-lag">Mehrfach liegen geblieben:</div>
             ${r.laggards.map(x => `<div class="weekcard-item">${x.task.emoji} ${esc(x.task.title)} <b>(${x.n}×)</b></div>`).join('')}
             <div class="subtle small">Tipp: Tag ändern oder Aufgabe pausieren → Reiter „Aufgaben".</div>`
          : '<div class="weekcard-ok">Nichts mehrfach liegen geblieben – läuft! 💪</div>';
        wrap.appendChild(el(`<div class="weekcard">
          <div class="weekcard-head">📒 Wochen-Bilanz (${D.weekLabel(iso)})</div>
          <div>${r.done} von ${r.total} Aufgaben abgenommen (<b>${r.pct} %</b>)${r.pending ? ` · ⏳ ${r.pending} warten noch auf Abnahme` : ''}.</div>
          ${lag}
        </div>`));
      }
    }

    // Familien-Gemeinschaftsziel: gemeinsam sammeln statt gegeneinander
    const goal = S.goal();
    if (goal) {
      const gp = S.goalProgress();
      const gpct = Math.min(100, Math.round(gp / goal.target * 100));
      const reached = gp >= goal.target;
      const gcard = el(`<div class="goalcard ${reached ? 'reached' : ''}">
        <div class="goalcard-head">🎯 Familienziel: ${goal.emoji} ${esc(goal.title)}
          <button class="btn tiny g-edit" title="Ziel bearbeiten">✏️</button></div>
        <div class="goal-bar"><span style="width:${gpct}%"></span></div>
        <div class="subtle">${gp} / ${goal.target} ⭐ gemeinsam gesammelt${reached ? ' – <b>Geschafft! 🎉</b>' : ''}</div>
        ${reached ? '<div class="goal-actions"><button class="btn primary g-done">🎉 Einlösen & neues Ziel</button></div>' : ''}
      </div>`);
      gcard.querySelector('.g-edit').addEventListener('click', () => UI.goalDialog(goal, ctx));
      const doneBtn = gcard.querySelector('.g-done');
      if (doneBtn) doneBtn.addEventListener('click', () =>
        UI.confirm(`„${goal.title}" jetzt einlösen und das Ziel abschließen?`, () => {
          S.clearGoal(); UI.goalDialog(null, ctx);
        }, 'Ja, einlösen 🎉'));
      wrap.appendChild(gcard);
    } else {
      const gnew = el('<div class="goalcard empty"><button class="btn" id="g-new">🎯 Familienziel festlegen</button><span class="subtle small">Gemeinsam auf etwas Schönes hinsparen – alle Punkte zählen zusammen.</span></div>');
      gnew.querySelector('#g-new').addEventListener('click', () => UI.goalDialog(null, ctx));
      wrap.appendChild(gnew);
    }

    // Nach Mitglied gruppieren – jede Person bekommt ihre Spalte
    const lanes = el('<div class="lanes"></div>');
    S.members().forEach(m => {
      const mine = insts.filter(i => i.assignees.includes(m.id) || i.doneBy.includes(m.id) || i.coverBy.includes(m.id));
      const laneDone = mine.filter(i => i.done).length;
      const lanePending = mine.filter(i => i.pending).length;
      const lane = el(`<div class="lane" style="--c:${m.color}">
        <div class="lane-head">
          <div class="avatar">${m.emoji}</div>
          <div>
            <div class="lane-name">${esc(m.name)}</div>
            <div class="subtle">${laneDone}/${mine.length} abgenommen${lanePending ? ` · ⏳ ${lanePending}` : ''}${S.isOnVacation(m.id, iso) ? ' · 🏖️ Urlaub' : ''}</div>
          </div>
        </div>
        <div class="lane-tasks"></div>
      </div>`);
      const list = lane.querySelector('.lane-tasks');
      if (!mine.length) list.appendChild(el('<div class="empty">Heute frei 🎈</div>'));
      mine.forEach(i => list.appendChild(taskCard(i, ctx)));
      lanes.appendChild(lane);
    });
    wrap.appendChild(lanes);
    root.appendChild(wrap);
  };

  function taskCard(i, ctx) {
    const t = i.task;
    const cat = CAT[t.category] || { color: '#999', emoji: '•', label: '' };
    const shared = i.assignees.length > 1;
    const isKid = i.assignees.some(id => (S.member(id) || {}).kind === 'child');
    const owner = S.member(i.assignees[0]);
    const rater = S.member(i.rater);
    // Statusabhängige Anzeige
    let statusNote = '';
    if (i.pending) {
      statusNote = `<div class="await">⏳ Zur Abnahme – ${rater ? rater.emoji + ' ' + esc(rater.name) : 'jemand'} prüft noch</div>`;
    } else if (i.done && i.rating) {
      statusNote = ratingSummary(i);
    } else if (i.rejected && i.rejection) {
      const by = S.member(i.rejection.by);
      statusNote = `<div class="reject-note">↩︎ Zurückgegeben von ${by ? by.emoji + ' ' + esc(by.short) : 'der Abnahme'}${i.rejection.reason ? `: „${esc(i.rejection.reason)}“` : ''}<br><span class="small">Bitte nochmal machen und wieder auf „fertig" tippen.</span></div>`;
    }
    const checkIcon = i.done ? '✔' : (i.pending ? '⏳' : '');
    const card = el(`<div class="task status-${i.status} ${i.needsCover ? 'cover' : ''} ${isKid ? 'kidtask' : ''}" style="--cat:${cat.color}${owner ? ';--own:' + owner.color : ''}">
      <button class="check" title="${i.pending ? 'Zurückziehen' : (i.done ? 'Rückgängig' : 'Als fertig melden')}">${checkIcon}</button>
      <div class="task-icon">${t.emoji}${owner && !shared ? `<span class="owner-badge" title="${esc(owner.name)}">${owner.emoji}</span>` : ''}</div>
      <div class="task-body">
        <div class="task-title">${t.fun ? '<span class="funtag">Spaß</span>' : ''}${i.rotates ? '<span class="rottag" title="Wechselaufgabe – rotiert wöchentlich">🔄</span>' : ''}${esc(t.title)}</div>
        <div class="task-meta">
          <span class="cat" style="--c:${cat.color}">${cat.emoji} ${cat.label}</span>
          ${shared ? '<span class="cat shared">👥 gemeinsam</span>' : ''}
          ${i.pending ? '<span class="cat pendingtag">⏳ zur Abnahme</span>' : ''}
          ${i.rejected ? '<span class="cat rejecttag">↩︎ zurück</span>' : ''}
          <span class="pts">+${t.points}</span>
        </div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
        <div class="task-people">${i.assignees.map(id => memberChip(id)).join('')}
          ${i.rotates ? '<span class="chip rot" style="--c:var(--accent)">🔄 diese Woche</span>' : ''}
          ${i.coverBy.map(id => `<span class="chip cover" style="--c:${S.member(id) ? S.member(id).color : '#999'}">🤝 ${esc(S.member(id) ? S.member(id).short : '')}</span>`).join('')}
        </div>
        ${i.needsCover ? `<div class="cover-note">🏖️ ${i.onVacation.map(id => esc(S.member(id).short)).join(', ')} im Urlaub – Vertretung nötig <button class="btn tiny cover-btn">Übernehmen</button></div>` : ''}
        ${statusNote}
      </div>
    </div>`);

    card.querySelector('.check').addEventListener('click', () => {
      S.toggleDone(t.id, i.date); ctx.render();
    });
    const cb = card.querySelector('.cover-btn');
    if (cb) cb.addEventListener('click', () => UI.coverDialog(i, ctx));
    return card;
  }

  function ratingSummary(i) {
    const r = i.rating;
    const by = S.member(r.by);
    return `<div class="rating ${r.kind}">
      ${stars(r.stars)}
      <span class="rating-by">${by ? by.emoji : ''} ${esc(by ? by.short : '')}</span>
      ${r.comment ? `<div class="rating-comment">${r.kind === 'praise' ? '💚' : '💡'} „${esc(r.comment)}“</div>` : ''}
    </div>`;
  }

  /* =====================================================================
     WOCHE
     ===================================================================== */
  UI.week = function (root, ctx) {
    const days = D.weekDays(ctx.date);
    const wrap = el(`<div class="view">
      <div class="view-head">
        <div><h2>Wochenansicht</h2><div class="subtle">${esc(D.weekLabel(ctx.date))}</div></div>
        <div class="daynav">
          <button class="btn ghost" data-w="-7">◀ Woche</button>
          <button class="btn ghost" data-w="today">Diese Woche</button>
          <button class="btn ghost" data-w="7">Woche ▶</button>
        </div>
      </div>
    </div>`);
    wrap.querySelectorAll('[data-w]').forEach(b => b.addEventListener('click', () => {
      const v = b.dataset.w;
      ctx.setDate(v === 'today' ? D.today() : D.addDays(ctx.date, Number(v)));
    }));

    const grid = el('<div class="weekgrid"></div>');
    days.forEach(iso => {
      const dt = D.parse(iso);
      const insts = S.instancesFor(iso);
      const isToday = iso === D.today();
      const doneCount = insts.filter(x => x.done).length;
      const col = el(`<div class="wday ${isToday ? 'today' : ''}">
        <div class="wday-head">
          <div class="wday-name">${D.WEEKDAY_SHORT[dt.getDay()]}</div>
          <div class="wday-num">${dt.getDate()}.</div>
          <div class="wday-count">${doneCount}/${insts.length}</div>
        </div>
        <div class="wday-tasks"></div>
      </div>`);
      const list = col.querySelector('.wday-tasks');
      if (!insts.length) list.appendChild(el('<div class="empty small">–</div>'));
      insts.forEach(i => {
        const cat = CAT[i.task.category] || { color: '#999' };
        const pill = el(`<button class="wpill status-${i.status}" style="--cat:${cat.color}" title="${esc(i.task.title)}${i.rotates ? ' (rotiert)' : ''}${i.pending ? ' – wartet auf Abnahme' : ''}">
          <span class="wpill-emoji">${i.pending ? '⏳' : (i.rejected ? '↩︎' : i.task.emoji)}</span>
          <span class="wpill-title">${esc(i.task.title)}</span>
          <span class="wpill-who">${i.rotates ? '🔄' : ''}${i.assignees.map(id => (S.member(id) || {}).emoji || '').join('')}</span>
        </button>`);
        pill.addEventListener('click', () => { S.toggleDone(i.task.id, iso); ctx.render(); });
        list.appendChild(pill);
      });
      col.querySelector('.wday-head').addEventListener('click', () => { ctx.setDate(iso); ctx.go('today'); });
      grid.appendChild(col);
    });
    wrap.appendChild(grid);
    root.appendChild(wrap);
  };

  /* =====================================================================
     MONAT
     ===================================================================== */
  UI.month = function (root, ctx) {
    const base = D.parse(ctx.date);
    const year = base.getFullYear(), month = base.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Montag-Start
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const wrap = el(`<div class="view">
      <div class="view-head">
        <div><h2>Monatsansicht</h2><div class="subtle">${D.MONTHS[month]} ${year}</div></div>
        <div class="daynav">
          <button class="btn ghost" data-m="-1">◀</button>
          <button class="btn ghost" data-m="today">Aktueller Monat</button>
          <button class="btn ghost" data-m="1">▶</button>
        </div>
      </div>
    </div>`);
    wrap.querySelector('[data-m="-1"]').addEventListener('click', () => ctx.setDate(D.iso(new Date(year, month - 1, 1))));
    wrap.querySelector('[data-m="1"]').addEventListener('click', () => ctx.setDate(D.iso(new Date(year, month + 1, 1))));
    wrap.querySelector('[data-m="today"]').addEventListener('click', () => ctx.setDate(D.today()));

    const cal = el('<div class="calendar"></div>');
    D.WEEKDAY_SHORT.slice(1).concat(D.WEEKDAY_SHORT[0]).forEach(n =>
      cal.appendChild(el(`<div class="cal-dow">${n}</div>`)));

    for (let i = 0; i < startOffset; i++) cal.appendChild(el('<div class="cal-cell empty"></div>'));

    for (let day = 1; day <= daysInMonth; day++) {
      const iso = D.iso(new Date(year, month, day));
      const insts = S.instancesFor(iso);
      const done = insts.filter(x => x.done).length;
      const pct = insts.length ? Math.round(done / insts.length * 100) : 0;
      const vac = S.members().filter(m => S.isOnVacation(m.id, iso));
      const isToday = iso === D.today();
      const cell = el(`<div class="cal-cell ${isToday ? 'today' : ''}">
        <div class="cal-day">${day}</div>
        <div class="cal-dots">${insts.slice(0, 6).map(x =>
          `<span class="dot ${x.done ? 'done' : ''}" style="--cat:${(CAT[x.task.category] || {}).color || '#999'}"></span>`).join('')}
          ${insts.length > 6 ? `<span class="more">+${insts.length - 6}</span>` : ''}</div>
        <div class="cal-foot">
          ${insts.length ? `<span class="cal-pct" style="--p:${pct}">${done}/${insts.length}</span>` : ''}
          ${vac.map(m => `<span class="cal-vac" title="${esc(m.name)} Urlaub">🏖️${m.emoji}</span>`).join('')}
        </div>
      </div>`);
      cell.addEventListener('click', () => { ctx.setDate(iso); ctx.go('today'); });
      cal.appendChild(cell);
    }
    wrap.appendChild(cal);

    // Monats-Statistik kompakt
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) days.push(D.iso(new Date(year, month, d)));
    const stats = S.statsForDays(days);
    const board = el('<div class="mini-board"><h3>🏅 Monats-Punkte</h3><div class="mini-rows"></div></div>');
    const rows = board.querySelector('.mini-rows');
    const max = Math.max(1, ...Object.values(stats).map(s => s.points));
    Object.values(stats).sort((a, b) => b.points - a.points).forEach(s => {
      rows.appendChild(el(`<div class="mini-row">
        <span class="mini-name">${s.member.emoji} ${esc(s.member.short)}</span>
        <span class="mini-bar"><span style="width:${Math.round(s.points / max * 100)}%;background:${s.member.color}"></span></span>
        <span class="mini-pts">${s.points}</span>
      </div>`));
    });
    wrap.appendChild(board);
    root.appendChild(wrap);
  };

  /* =====================================================================
     STATISTIK / GAMIFICATION
     ===================================================================== */
  UI.stats = function (root, ctx) {
    const week = S.statsWeek(ctx.date);
    const all = S.statsAllTime();
    const wrap = el(`<div class="view">
      <div class="view-head"><div><h2>Statistik & Belohnungen</h2>
        <div class="subtle">Diese Woche: ${esc(D.weekLabel(ctx.date))}</div></div></div>
    </div>`);

    // Wochen-Rangliste
    const ranked = Object.values(week).sort((a, b) => b.points - a.points);
    const podium = el('<div class="podium"></div>');
    const medals = ['🥇', '🥈', '🥉', '🎖️'];
    ranked.forEach((s, idx) => {
      podium.appendChild(el(`<div class="podium-card" style="--c:${s.member.color}">
        <div class="medal">${medals[idx] || ''}</div>
        <div class="podium-avatar">${s.member.emoji}</div>
        <div class="podium-name">${esc(s.member.name)}</div>
        <div class="podium-pts">${s.points} <small>Punkte</small></div>
        <div class="podium-line">✅ ${s.done} · ${s.avgStars ? '⭐ ' + s.avgStars.toFixed(1) : '– ⭐'}</div>
      </div>`));
    });
    wrap.appendChild(el('<h3 class="section">🏆 Wochen-Rangliste</h3>'));
    wrap.appendChild(podium);

    // Level & Fortschritt (gesamt) + Abzeichen
    wrap.appendChild(el('<h3 class="section">🎮 Level & Abzeichen</h3>'));
    const cards = el('<div class="levelcards"></div>');
    S.members().forEach(m => {
      const a = all[m.id];
      const b = S.badges(m.id);
      const card = el(`<div class="levelcard" style="--c:${m.color}">
        <div class="lc-head">
          <div class="avatar big">${m.emoji}</div>
          <div>
            <div class="lc-name">${esc(m.name)}</div>
            <div class="lc-level">Level ${a.level} · ${a.points} Punkte gesamt</div>
          </div>
          <div class="lc-streak">${b.streak > 0 ? '🔥 ' + b.streak : ''}</div>
        </div>
        <div class="lc-progress"><span style="width:${a.progress}%"></span></div>
        <div class="subtle small">Noch ${100 - a.progress} Punkte bis Level ${a.level + 1}</div>
        <div class="badges">${b.list.length
          ? b.list.map(x => `<span class="badge" title="${esc(x.label)}">${x.emoji}<span>${esc(x.label)}</span></span>`).join('')
          : '<span class="subtle small">Noch keine Abzeichen – leg los! 💪</span>'}</div>
      </div>`);
      cards.appendChild(card);
    });
    wrap.appendChild(cards);

    // Letzte Bewertungen
    const recent = S.recentRatings(8);
    if (recent.length) {
      wrap.appendChild(el('<h3 class="section">💬 Letzte Bewertungen</h3>'));
      const feed = el('<div class="feed"></div>');
      recent.forEach(({ c, task }) => {
        const by = S.member(c.rating.by);
        feed.appendChild(el(`<div class="feed-item ${c.rating.kind}">
          <div class="feed-emoji">${task.emoji}</div>
          <div class="feed-body">
            <div class="feed-title">${esc(task.title)} ${stars(c.rating.stars)}</div>
            <div class="subtle small">Erledigt: ${c.doneBy.map(id => (S.member(id) || {}).short).join(', ')} · Bewertet von ${by ? by.name : '?'}</div>
            ${c.rating.comment ? `<div class="feed-comment">${c.rating.kind === 'praise' ? '💚' : '💡'} „${esc(c.rating.comment)}“</div>` : ''}
          </div>
        </div>`));
      });
      wrap.appendChild(feed);
    }
    root.appendChild(wrap);
  };

  /* =====================================================================
     ABNAHME (Aufgaben prüfen: annehmen oder zurückgeben)
     ===================================================================== */
  UI.ratings = function (root, ctx) {
    const pending = S.pendingApprovals();
    const wrap = el(`<div class="view">
      <div class="view-head"><div><h2>Abnahme</h2>
        <div class="subtle">${pending.length} Aufgabe(n) warten auf Abnahme</div></div></div>
    </div>`);

    wrap.appendChild(el(`<div class="hint">🎲 Jede gemeldete Aufgabe wird von einem <b>zufällig ausgelosten</b> Familienmitglied <b>abgenommen</b>. Passt alles → <b>Annehmen</b> mit Sternen und Lob. Passt es noch nicht → <b>Zurückgeben</b> mit einem Grund; dann landet die Aufgabe wieder bei „Zu tun".</div>`));

    if (!pending.length) {
      wrap.appendChild(el('<div class="empty big">Alles abgenommen! 🎉<br><span class="subtle">Nichts offen.</span></div>'));
      root.appendChild(wrap); return;
    }

    const list = el('<div class="ratelist"></div>');
    pending.forEach(({ c, task }) => {
      const rater = S.member(c.rater);
      // Abnahme-Stau: über 24 h alte Meldungen deutlich markieren
      const waitMs = c.doneAt ? Date.now() - new Date(c.doneAt).getTime() : 0;
      const waitDays = Math.floor(waitMs / 86400000);
      const overdue = waitMs > 24 * 3600 * 1000;
      const waitTxt = waitDays >= 1
        ? (waitDays === 1 ? 'seit gestern' : `seit ${waitDays} Tagen`)
        : `seit ${Math.floor(waitMs / 3600000)} Std.`;
      // Kinder-Arbeit wird nicht mit Sternen benotet – konkretes Lob
      // auf die Anstrengung wirkt entwicklungspsychologisch besser.
      const isKidWork = c.doneBy.length > 0 &&
        c.doneBy.every(id => (S.member(id) || {}).kind === 'child');
      const PRAISE = ['Ganz allein geschafft! 💪', 'Du hast an alles gedacht! 🌟',
        'Richtig gründlich gemacht! 🔍', 'Das ging ja schnell! ⚡'];
      const item = el(`<div class="rateitem ${overdue ? 'overdue' : ''}" style="--cat:${(CAT[task.category] || {}).color || '#999'}">
        <div class="ri-head">
          <span class="ri-emoji">${task.emoji}</span>
          <div>
            <div class="ri-title">${esc(task.title)}</div>
            <div class="subtle small">Gemeldet von ${c.doneBy.map(id => `${(S.member(id) || {}).emoji || ''} ${(S.member(id) || {}).short || ''}`).join(', ')} · ${esc(c.date)}</div>
            ${overdue ? `<div class="ri-overdue">⏰ Wartet schon ${waitTxt} – die Kinder warten auf ihr Lob!</div>` : ''}
          </div>
        </div>
        <div class="ri-rater">🎲 Abnahme durch: <b style="color:${rater ? rater.color : '#333'}">${rater ? rater.emoji + ' ' + rater.name : 'jemand'}</b>
          <button class="btn tiny reroll">🎲 neu losen</button></div>
        ${isKidWork
          ? `<div class="ri-kidlob">💚 Kinder-Abnahme: keine Sterne-Note – lobe konkret, was gut war!</div>
             <div class="ri-chips">${PRAISE.map(p => `<button type="button" class="ri-chip">${esc(p)}</button>`).join('')}</div>`
          : `<div class="ri-stars">${[1,2,3,4,5].map(n => `<button class="ri-star" data-n="${n}">★</button>`).join('')}</div>`}
        <div class="ri-kind">
          <label class="pick"><input type="radio" name="kind_${c.taskId}_${c.date}" value="praise" checked> 💚 Lob</label>
          <label class="pick"><input type="radio" name="kind_${c.taskId}_${c.date}" value="tip"> 💡 Tipp zum Besser­machen</label>
        </div>
        <textarea class="ri-comment" rows="2" placeholder="Feedback – beim Annehmen ein Lob, beim Zurückgeben der Grund (z. B. „Unter dem Bett liegt noch Spielzeug.“)"></textarea>
        <div class="ri-actions">
          <button class="btn danger ri-reject">↩︎ Zurückgeben</button>
          <button class="btn primary ri-approve" disabled>✅ Annehmen</button>
        </div>
      </div>`);

      // Kinder-Arbeit: intern volle Sterne (für Statistik), Knopf sofort aktiv
      let picked = isKidWork ? 5 : 0;
      if (isKidWork) item.querySelector('.ri-approve').disabled = false;
      const starBtns = item.querySelectorAll('.ri-star');
      const paint = () => starBtns.forEach((b, idx) => b.classList.toggle('on', idx < picked));
      starBtns.forEach((b, idx) => b.addEventListener('click', () => {
        picked = idx + 1; paint();
        item.querySelector('.ri-approve').disabled = false;
      }));
      // Lob-Bausteine: antippen füllt das Kommentarfeld
      item.querySelectorAll('.ri-chip').forEach(chip => chip.addEventListener('click', () => {
        const box = item.querySelector('.ri-comment');
        box.value = (box.value ? box.value.trim() + ' ' : '') + chip.textContent;
      }));
      item.querySelector('.reroll').addEventListener('click', () => { S.reroll(c.taskId, c.date); ctx.render(); });
      item.querySelector('.ri-approve').addEventListener('click', () => {
        if (!picked) return;
        const kind = item.querySelector(`input[name="kind_${c.taskId}_${c.date}"]:checked`).value;
        S.approve(c.taskId, c.date, {
          by: c.rater, stars: picked,
          comment: item.querySelector('.ri-comment').value, kind,
        });
        ctx.render();
      });
      item.querySelector('.ri-reject').addEventListener('click', () => {
        const reason = item.querySelector('.ri-comment').value.trim();
        if (!reason) {
          item.querySelector('.ri-comment').classList.add('needed');
          item.querySelector('.ri-comment').placeholder = 'Bitte kurz sagen, WARUM es noch nicht passt.';
          item.querySelector('.ri-comment').focus();
          return;
        }
        S.reject(c.taskId, c.date, { by: c.rater, reason });
        ctx.render();
      });
      list.appendChild(item);
    });
    wrap.appendChild(list);
    root.appendChild(wrap);
  };

  /* =====================================================================
     URLAUB
     ===================================================================== */
  UI.vacation = function (root, ctx) {
    const wrap = el(`<div class="view">
      <div class="view-head"><div><h2>Urlaub & Vertretung</h2>
        <div class="subtle">Freie Tage planen – Aufgaben übernimmt dann jemand anderes.</div></div></div>
    </div>`);

    // Neues Urlaub-Formular
    const form = el(`<div class="card form">
      <h3>🏖️ Urlaub eintragen</h3>
      <div class="form-row">
        <label>Wer<select class="v-member">${S.members().map(m => `<option value="${m.id}">${m.emoji} ${esc(m.name)}</option>`).join('')}</select></label>
        <label>Von<input type="date" class="v-start" value="${D.today()}"></label>
        <label>Bis<input type="date" class="v-end" value="${D.today()}"></label>
        <button class="btn primary v-add">Hinzufügen</button>
      </div>
    </div>`);
    form.querySelector('.v-add').addEventListener('click', () => {
      const m = form.querySelector('.v-member').value;
      const s = form.querySelector('.v-start').value;
      const e = form.querySelector('.v-end').value;
      if (s && e) { S.addVacation(m, s, e); ctx.render(); }
    });
    wrap.appendChild(form);

    // Bestehende Urlaube
    const vacs = S.vacations().slice().sort((a, b) => a.start.localeCompare(b.start));
    const listCard = el('<div class="card"><h3>Geplante Urlaube</h3><div class="vaclist"></div></div>');
    const list = listCard.querySelector('.vaclist');
    if (!vacs.length) list.appendChild(el('<div class="empty">Noch keine Urlaube geplant.</div>'));
    vacs.forEach(v => {
      const m = S.member(v.member);
      const fmt = (iso) => { const d = D.parse(iso); return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`; };
      const row = el(`<div class="vacrow" style="--c:${m.color}">
        <span class="vac-who">${m.emoji} ${esc(m.name)}</span>
        <span class="vac-range">${fmt(v.start)} – ${fmt(v.end)}</span>
        <button class="btn tiny danger vac-del">Löschen</button>
      </div>`);
      row.querySelector('.vac-del').addEventListener('click', () => { S.removeVacation(v.id); ctx.render(); });
      list.appendChild(row);
    });
    wrap.appendChild(listCard);

    // Aufgaben, die wegen Urlaub heute/diese Woche Vertretung brauchen
    const week = D.weekDays(ctx.date);
    const need = [];
    week.forEach(iso => S.instancesFor(iso).forEach(i => { if (i.needsCover) need.push(i); }));
    const coverCard = el(`<div class="card"><h3>🤝 Vertretung nötig (diese Woche)</h3><div class="coverlist"></div></div>`);
    const cl = coverCard.querySelector('.coverlist');
    if (!need.length) cl.appendChild(el('<div class="empty">Alles abgedeckt. 👍</div>'));
    need.forEach(i => {
      const dt = D.parse(i.date);
      const row = el(`<div class="coverrow">
        <span>${i.task.emoji} ${esc(i.task.title)} <span class="subtle small">(${D.WEEKDAY_SHORT[dt.getDay()]} ${dt.getDate()}.)</span></span>
        <span class="subtle small">🏖️ ${i.onVacation.map(id => esc(S.member(id).short)).join(', ')}</span>
        <button class="btn tiny cover-btn">Vertretung wählen</button>
      </div>`);
      row.querySelector('.cover-btn').addEventListener('click', () => UI.coverDialog(i, ctx));
      cl.appendChild(row);
    });
    wrap.appendChild(coverCard);
    root.appendChild(wrap);
  };

  // Dialog: Vertretung für eine Aufgabe wählen
  UI.coverDialog = function (i, ctx) {
    const available = S.members().filter(m =>
      !i.assignees.includes(m.id) && !S.isOnVacation(m.id, i.date));
    const pool = available.length ? available : S.members().filter(m => !S.isOnVacation(m.id, i.date));
    UI.modal(`Wer übernimmt „${esc(i.task.title)}“?`, `
      <div class="pickers">${pool.map(m =>
        `<button class="picker" data-id="${m.id}" style="--c:${m.color}">${m.emoji} ${esc(m.name)}</button>`).join('')}</div>`,
      (box, close) => {
        box.querySelectorAll('.picker').forEach(b => b.addEventListener('click', () => {
          S.setCover(i.task.id, i.date, [b.dataset.id]);
          close(); ctx.render();
        }));
      });
  };

  /* =====================================================================
     AUFGABEN VERWALTEN
     ===================================================================== */
  UI.manage = function (root, ctx) {
    const wrap = el(`<div class="view">
      <div class="view-head"><div><h2>Aufgaben verwalten</h2>
        <div class="subtle">Aufgaben hinzufügen, ändern oder entfernen.</div></div>
        <button class="btn primary add-task">+ Neue Aufgabe</button></div>
    </div>`);
    wrap.querySelector('.add-task').addEventListener('click', () => UI.taskDialog(null, ctx));

    const groups = { child: 'Kinder', adult: 'Erwachsene', family: 'Familie / gemeinsam' };
    Object.keys(groups).forEach(g => {
      const items = S.tasks().filter(t => t.group === g);
      if (!items.length) return;
      const sec = el(`<div class="manage-group"><h3 class="section">${groups[g]} (${items.length})</h3><div class="manage-list"></div></div>`);
      const list = sec.querySelector('.manage-list');
      items.forEach(t => {
        const cat = CAT[t.category] || {};
        const freq = t.frequency === 'daily' ? (t.days ? 'an bestimmten Tagen' : 'täglich')
          : t.frequency === 'weekly' ? 'wöchentlich' : 'monatlich';
        const who = t.rotate
          ? '🔄 rotiert: ' + S.rotationPool(t).map(id => (S.member(id) || {}).short).join(' ↔ ')
          : t.assignees.map(id => (S.member(id) || {}).short).join(', ');
        const row = el(`<div class="manage-row" style="--cat:${cat.color || '#999'}">
          <span class="mr-emoji">${t.emoji}</span>
          <div class="mr-main">
            <div class="mr-title">${t.fun ? '<span class="funtag">Spaß</span>' : ''}${t.rotate ? '<span class="rottag">🔄</span>' : ''}${esc(t.title)}</div>
            <div class="subtle small">${freq} · +${t.points} · ${who}</div>
          </div>
          <button class="btn tiny mr-edit">Bearbeiten</button>
          <button class="btn tiny danger mr-del">✕</button>
        </div>`);
        row.querySelector('.mr-edit').addEventListener('click', () => UI.taskDialog(t, ctx));
        row.querySelector('.mr-del').addEventListener('click', () => {
          UI.confirm(`„${t.title}“ wirklich löschen?`, () => { S.removeTask(t.id); ctx.render(); });
        });
        list.appendChild(row);
      });
      wrap.appendChild(sec);
    });
    root.appendChild(wrap);
  };

  // Emoji-Auswahl für Aufgaben-Icons (damit Kinder sie leicht erkennen)
  const EMOJI_PALETTE = ['🧸','📚','🧹','🧽','🪣','🚿','🛁','🚽','🧺','🧦','👕','👟',
    '🛏️','🍽️','🍴','🥄','🧊','🍳','🥗','🛒','🗑️','♻️','🪴','🌻','🐟','🐶','🐱','📬',
    '🚗','🪟','💡','🔌','📝','📅','🎵','🎬','🍦','🎨','✏️','🧩','⚽','🪥','🌙','⭐','🎉','🔍'];

  UI.taskDialog = function (task, ctx) {
    const isNew = !task;
    task = task || { title: '', emoji: '⭐', category: 'ordnung', frequency: 'daily',
      days: null, dayOfMonth: 1, assignees: [], points: 10, group: 'family', description: '', fun: false, rotate: false };
    const catOpts = Object.entries(CAT).map(([k, v]) =>
      `<option value="${k}" ${k === task.category ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('');
    const dayBtns = D.WEEKDAY_SHORT.map((n, idx) =>
      `<button type="button" class="daybtn ${(task.days || []).includes(idx) ? 'on' : ''}" data-d="${idx}">${n}</button>`).join('');
    const palette = EMOJI_PALETTE.map(e =>
      `<button type="button" class="emoji-opt ${e === task.emoji ? 'on' : ''}" data-e="${e}">${e}</button>`).join('');

    UI.modal(isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten', `
      <div class="tf">
        <label>Titel<input class="t-title" value="${esc(task.title)}" placeholder="z. B. Wäsche zusammenlegen"></label>
        <div class="tf-row">
          <label class="tf-emoji">Icon<input class="t-emoji" value="${esc(task.emoji)}" maxlength="4"></label>
          <label>Kategorie<select class="t-cat">${catOpts}</select></label>
          <label class="tf-pts">Punkte<input type="number" class="t-points" value="${task.points}" min="1" max="100"></label>
        </div>
        <div class="emoji-palette">${palette}</div>
        <label>Beschreibung<input class="t-desc" value="${esc(task.description || '')}" placeholder="Kurz erklären"></label>
        <div class="tf-row">
          <label>Gruppe<select class="t-group">
            <option value="child" ${task.group === 'child' ? 'selected' : ''}>Kinder</option>
            <option value="adult" ${task.group === 'adult' ? 'selected' : ''}>Erwachsene</option>
            <option value="family" ${task.group === 'family' ? 'selected' : ''}>Familie</option>
          </select></label>
          <label>Häufigkeit<select class="t-freq">
            <option value="daily" ${task.frequency === 'daily' ? 'selected' : ''}>Täglich</option>
            <option value="weekly" ${task.frequency === 'weekly' ? 'selected' : ''}>Wöchentlich</option>
            <option value="monthly" ${task.frequency === 'monthly' ? 'selected' : ''}>Monatlich</option>
          </select></label>
          <label class="t-funwrap"><input type="checkbox" class="t-fun" ${task.fun ? 'checked' : ''}> 🎉 Spaß-Job</label>
        </div>
        <div class="t-days-wrap">Wochentage <span class="subtle small">(bei „täglich“ leer = jeden Tag)</span><div class="daybtns">${dayBtns}</div></div>
        <div class="t-mday-wrap" style="display:none">Tag im Monat <input type="number" class="t-mday" value="${task.dayOfMonth || 1}" min="1" max="28"></div>
        <label class="t-rotwrap"><input type="checkbox" class="t-rotate" ${task.rotate ? 'checked' : ''}> 🔄 Wöchentlich rotieren (reihum abwechseln)</label>
        <div class="t-rothint subtle small"></div>
        <div class="t-people">Zuständig (mehrere möglich = gemeinsam)
          <div class="pickers">${S.members().map(m =>
            `<button type="button" class="picker ${task.assignees.includes(m.id) ? 'on' : ''}" data-id="${m.id}" style="--c:${m.color}">${m.emoji} ${esc(m.short)}</button>`).join('')}</div>
        </div>
      </div>`,
      (box, close) => {
        // Emoji-Palette
        box.querySelectorAll('.emoji-opt').forEach(b => b.addEventListener('click', () => {
          box.querySelector('.t-emoji').value = b.dataset.e;
          box.querySelectorAll('.emoji-opt').forEach(x => x.classList.remove('on'));
          b.classList.add('on');
        }));
        const days = new Set(task.days || []);
        box.querySelectorAll('.daybtn').forEach(b => b.addEventListener('click', () => {
          const d = Number(b.dataset.d);
          if (days.has(d)) days.delete(d); else days.add(d);
          b.classList.toggle('on');
        }));
        const assignees = new Set(task.assignees);
        box.querySelectorAll('.picker').forEach(b => b.addEventListener('click', () => {
          const id = b.dataset.id;
          if (assignees.has(id)) assignees.delete(id); else assignees.add(id);
          b.classList.toggle('on');
        }));
        const freqSel = box.querySelector('.t-freq');
        const syncFreq = () => {
          box.querySelector('.t-days-wrap').style.display = freqSel.value === 'monthly' ? 'none' : '';
          box.querySelector('.t-mday-wrap').style.display = freqSel.value === 'monthly' ? '' : 'none';
        };
        freqSel.addEventListener('change', syncFreq); syncFreq();

        // Rotations-Hinweis: zeigt, zwischen wem gewechselt wird (aus Gruppe abgeleitet)
        const rotChk = box.querySelector('.t-rotate');
        const grpSel = box.querySelector('.t-group');
        const peopleWrap = box.querySelector('.t-people');
        const syncRot = () => {
          const on = rotChk.checked;
          const pool = S.rotationPool({ group: grpSel.value });
          const names = pool.map(id => { const m = S.member(id); return m ? m.emoji + ' ' + m.short : ''; }).join(' ↔ ');
          box.querySelector('.t-rothint').textContent = on
            ? `Wechselt wöchentlich reihum zwischen: ${names}`
            : '';
          peopleWrap.style.display = on ? 'none' : '';
        };
        rotChk.addEventListener('change', syncRot);
        grpSel.addEventListener('change', syncRot);
        syncRot();

        box.querySelector('.modal-save').addEventListener('click', () => {
          const title = box.querySelector('.t-title').value.trim();
          if (!title) { box.querySelector('.t-title').focus(); return; }
          const freq = freqSel.value;
          const rotate = rotChk.checked;
          const patch = {
            title, emoji: box.querySelector('.t-emoji').value.trim() || '⭐',
            category: box.querySelector('.t-cat').value,
            description: box.querySelector('.t-desc').value.trim(),
            group: grpSel.value,
            frequency: freq,
            points: Math.max(1, Number(box.querySelector('.t-points').value) || 10),
            fun: box.querySelector('.t-fun').checked,
            rotate,
            rotationOffset: task.rotationOffset || 0,
            assignees: Array.from(assignees),
            days: freq === 'monthly' ? null : Array.from(days).sort(),
            dayOfMonth: freq === 'monthly' ? Number(box.querySelector('.t-mday').value) || 1 : (task.dayOfMonth || 1),
          };
          // Bei Rotation ohne feste Auswahl: Pool aus der Gruppe verwenden
          if (rotate && !patch.assignees.length) patch.assignees = [S.rotationPool(patch)[0]];
          if (!patch.assignees.length) patch.assignees = S.members().map(m => m.id);
          if (isNew) S.addTask(patch); else S.updateTask(task.id, patch);
          close(); ctx.render();
        });
      }, { save: 'Speichern' });
  };

  /* =====================================================================
     SHOP – Belohnungen & Sticker
     ===================================================================== */
  let shopMember = null;   // aktuell ausgewähltes Mitglied (wer kauft ein)
  let shopManage = false;  // Verwaltungsmodus (Artikel bearbeiten/löschen)
  const RARITY = {
    common:    { label: 'Häufig',    color: '#74b9ff' },
    rare:      { label: 'Selten',    color: '#a29bfe' },
    legendary: { label: 'Legendär',  color: '#fdcb6e' },
  };

  UI.shop = function (root, ctx) {
    if (!shopMember || !S.member(shopMember)) shopMember = S.members()[0].id;
    const me = S.member(shopMember);
    const bal = S.balance(shopMember);

    const wrap = el(`<div class="view">
      <div class="view-head">
        <div><h2>Belohnungs-Shop</h2>
          <div class="subtle">Erspielte Punkte gegen Belohnungen und Sticker eintauschen.</div></div>
        <button class="btn ghost shop-manage">${shopManage ? '✓ Fertig' : '✏️ Verwalten'}</button>
      </div>
    </div>`);
    wrap.querySelector('.shop-manage').addEventListener('click', () => { shopManage = !shopManage; ctx.render(); });

    // Mitglied-Auswahl mit Guthaben
    const tabs = el('<div class="shop-tabs"></div>');
    S.members().forEach(m => {
      const tab = el(`<button class="shop-tab ${m.id === shopMember ? 'on' : ''}" style="--c:${m.color}">
        <span class="st-emoji">${m.emoji}</span>
        <span class="st-name">${esc(m.short)}</span>
        <span class="st-bal">${S.balance(m.id)} ⭐</span>
      </button>`);
      tab.addEventListener('click', () => { shopMember = m.id; ctx.render(); });
      tabs.appendChild(tab);
    });
    wrap.appendChild(tabs);

    // Guthaben-Banner
    wrap.appendChild(el(`<div class="wallet" style="--c:${me.color}">
      <div class="wallet-avatar">${me.emoji}</div>
      <div class="wallet-info">
        <div class="wallet-name">${esc(me.name)}</div>
        <div class="wallet-bal">${bal} <small>Punkte verfügbar</small></div>
      </div>
      <div class="wallet-sub subtle small">Gesamt erspielt: ${S.earned(shopMember)} · ausgegeben: ${S.spent(shopMember)}</div>
    </div>`));

    /* ---------- Belohnungen ---------- */
    wrap.appendChild(el(`<div class="shop-sectionhead"><h3 class="section">🎁 Belohnungen</h3>
      ${shopManage ? '<button class="btn tiny primary add-reward">+ Belohnung</button>' : ''}</div>`));
    const rAdd = wrap.querySelector('.add-reward');
    if (rAdd) rAdd.addEventListener('click', () => UI.rewardDialog(null, ctx));

    const rewards = S.rewards().filter(x => !x.group || x.group === 'all' || x.group === me.kind);
    const rgrid = el('<div class="shopgrid"></div>');
    if (!rewards.length) rgrid.appendChild(el('<div class="empty">Keine Belohnungen für diese Person.</div>'));
    rewards.forEach(rw => {
      const can = bal >= rw.cost;
      const card = el(`<div class="shopcard reward ${can ? '' : 'locked'}">
        <div class="sc-emoji">${rw.emoji}</div>
        <div class="sc-title">${esc(rw.title)}</div>
        ${rw.description ? `<div class="sc-desc subtle small">${esc(rw.description)}</div>` : ''}
        <div class="sc-cost">${rw.cost} ⭐</div>
        <button class="btn primary sc-buy" ${can ? '' : 'disabled'}>${can ? 'Einlösen' : 'Zu wenig'}</button>
        ${shopManage ? `<div class="sc-admin"><button class="btn tiny sc-edit">Bearbeiten</button><button class="btn tiny danger sc-del">✕</button></div>` : ''}
      </div>`);
      card.querySelector('.sc-buy').addEventListener('click', () => {
        UI.confirmBuy(me, rw, 'reward', ctx);
      });
      if (shopManage) {
        card.querySelector('.sc-edit').addEventListener('click', () => UI.rewardDialog(rw, ctx));
        card.querySelector('.sc-del').addEventListener('click', () =>
          UI.confirm(`„${rw.title}“ wirklich löschen?`, () => { S.removeReward(rw.id); ctx.render(); }));
      }
      rgrid.appendChild(card);
    });
    wrap.appendChild(rgrid);

    /* ---------- Eingelöste Belohnungen ---------- */
    const myRewards = S.rewardPurchases(shopMember);
    if (myRewards.length) {
      wrap.appendChild(el('<h3 class="section">🎟️ Eingelöste Belohnungen</h3>'));
      const list = el('<div class="redeemed"></div>');
      myRewards.forEach(p => {
        const dt = D.parse(p.at.slice(0, 10));
        const row = el(`<div class="redeem-row ${p.status}">
          <span class="rr-emoji">${p.emoji}</span>
          <div class="rr-main">
            <div class="rr-title">${esc(p.title)}</div>
            <div class="subtle small">${p.cost} ⭐ · ${dt.getDate()}.${dt.getMonth() + 1}. · ${p.status === 'open' ? '⏳ offen' : '✅ eingelöst'}</div>
          </div>
          ${p.status === 'open' ? '<button class="btn tiny primary rr-done">Eingelöst</button>' : ''}
          <button class="btn tiny danger rr-cancel" title="Stornieren – Punkte zurück">↩︎</button>
        </div>`);
        const done = row.querySelector('.rr-done');
        if (done) done.addEventListener('click', () => { S.markRewardDone(p.id); ctx.render(); });
        row.querySelector('.rr-cancel').addEventListener('click', () =>
          UI.confirm(`„${p.title}“ stornieren und ${p.cost} Punkte zurückbuchen?`,
            () => { S.cancelPurchase(p.id); ctx.render(); }, 'Ja, stornieren'));
        list.appendChild(row);
      });
      wrap.appendChild(list);
    }

    /* ---------- Sticker-Album ---------- */
    wrap.appendChild(el(`<div class="shop-sectionhead"><h3 class="section">🌟 Sticker-Album</h3>
      ${shopManage ? '<button class="btn tiny primary add-sticker">+ Sticker</button>' : ''}</div>`));
    const sAdd = wrap.querySelector('.add-sticker');
    if (sAdd) sAdd.addEventListener('click', () => UI.stickerDialog(null, ctx));

    const owned = S.stickerCollection(shopMember);
    const total = S.stickers().length;
    const have = Object.keys(owned).length;
    wrap.appendChild(el(`<div class="subtle small album-progress">Gesammelt: ${have} / ${total} verschiedene Sticker</div>`));

    const sgrid = el('<div class="stickergrid"></div>');
    S.stickers().forEach(sk => {
      const count = owned[sk.id] || 0;
      const rar = RARITY[sk.rarity] || RARITY.common;
      const can = bal >= sk.cost;
      const card = el(`<div class="stickercard ${count ? 'owned' : 'missing'}" style="--r:${rar.color}">
        <div class="sk-emoji">${sk.emoji}</div>
        ${count > 1 ? `<span class="sk-count">×${count}</span>` : ''}
        <div class="sk-name">${esc(sk.name)}</div>
        <div class="sk-rarity" style="color:${rar.color}">${rar.label}</div>
        <button class="btn tiny sk-buy ${can ? 'primary' : ''}" ${can ? '' : 'disabled'}>${sk.cost} ⭐</button>
        ${shopManage ? `<div class="sc-admin"><button class="btn tiny sk-edit">✎</button><button class="btn tiny danger sk-del">✕</button></div>` : ''}
      </div>`);
      card.querySelector('.sk-buy').addEventListener('click', () => UI.confirmBuy(me, sk, 'sticker', ctx));
      if (shopManage) {
        card.querySelector('.sk-edit').addEventListener('click', () => UI.stickerDialog(sk, ctx));
        card.querySelector('.sk-del').addEventListener('click', () =>
          UI.confirm(`Sticker „${sk.name}“ wirklich löschen?`, () => { S.removeSticker(sk.id); ctx.render(); }));
      }
      sgrid.appendChild(card);
    });
    wrap.appendChild(sgrid);
    root.appendChild(wrap);
  };

  // Kauf bestätigen (mit kleiner Erfolgs-Rückmeldung)
  UI.confirmBuy = function (member, item, type, ctx) {
    const name = item.title || item.name;
    UI.modal(`${item.emoji} ${esc(name)}`, `
      <p class="buy-msg">Möchte <b style="color:${member.color}">${esc(member.name)}</b> das für
        <b>${item.cost} Punkte</b> ${type === 'reward' ? 'einlösen' : 'kaufen'}?</p>
      <p class="subtle small">Guthaben danach: ${S.balance(member.id) - item.cost} Punkte</p>`,
      (box, close) => {
        box.querySelector('.modal-save').addEventListener('click', () => {
          const res = S.buy(member.id, type, item.id);
          close();
          if (res.ok) UI.toast(`${item.emoji} ${type === 'reward' ? 'Belohnung eingelöst!' : 'Sticker gesammelt!'}`);
          ctx.render();
        });
      }, { save: type === 'reward' ? 'Einlösen' : 'Kaufen' });
  };

  // Belohnung anlegen/bearbeiten
  UI.rewardDialog = function (rw, ctx) {
    const isNew = !rw;
    rw = rw || { title: '', emoji: '🎁', cost: 80, description: '', group: 'all' };
    UI.modal(isNew ? 'Neue Belohnung' : 'Belohnung bearbeiten', `
      <div class="tf">
        <label>Titel<input class="r-title" value="${esc(rw.title)}" placeholder="z. B. Film-Abend aussuchen"></label>
        <div class="tf-row">
          <label class="tf-emoji">Emoji<input class="r-emoji" value="${esc(rw.emoji)}" maxlength="4"></label>
          <label class="tf-pts">Punkte<input type="number" class="r-cost" value="${rw.cost}" min="1" max="999"></label>
          <label>Für<select class="r-group">
            <option value="all" ${rw.group === 'all' ? 'selected' : ''}>Alle</option>
            <option value="child" ${rw.group === 'child' ? 'selected' : ''}>Kinder</option>
            <option value="adult" ${rw.group === 'adult' ? 'selected' : ''}>Erwachsene</option>
          </select></label>
        </div>
        <label>Beschreibung<input class="r-desc" value="${esc(rw.description || '')}" placeholder="Kurz erklären"></label>
      </div>`,
      (box, close) => {
        box.querySelector('.modal-save').addEventListener('click', () => {
          const title = box.querySelector('.r-title').value.trim();
          if (!title) { box.querySelector('.r-title').focus(); return; }
          const patch = {
            title, emoji: box.querySelector('.r-emoji').value.trim() || '🎁',
            cost: Math.max(1, Number(box.querySelector('.r-cost').value) || 1),
            group: box.querySelector('.r-group').value,
            description: box.querySelector('.r-desc').value.trim(),
          };
          if (isNew) S.addReward(patch); else S.updateReward(rw.id, patch);
          close(); ctx.render();
        });
      }, { save: 'Speichern' });
  };

  // Sticker anlegen/bearbeiten
  UI.stickerDialog = function (sk, ctx) {
    const isNew = !sk;
    sk = sk || { emoji: '⭐', name: '', cost: 20, rarity: 'common' };
    UI.modal(isNew ? 'Neuer Sticker' : 'Sticker bearbeiten', `
      <div class="tf">
        <div class="tf-row">
          <label class="tf-emoji">Emoji<input class="s-emoji" value="${esc(sk.emoji)}" maxlength="4"></label>
          <label>Name<input class="s-name" value="${esc(sk.name)}" placeholder="z. B. Einhorn"></label>
        </div>
        <div class="tf-row">
          <label class="tf-pts">Punkte<input type="number" class="s-cost" value="${sk.cost}" min="1" max="999"></label>
          <label>Seltenheit<select class="s-rarity">
            <option value="common" ${sk.rarity === 'common' ? 'selected' : ''}>Häufig</option>
            <option value="rare" ${sk.rarity === 'rare' ? 'selected' : ''}>Selten</option>
            <option value="legendary" ${sk.rarity === 'legendary' ? 'selected' : ''}>Legendär</option>
          </select></label>
        </div>
      </div>`,
      (box, close) => {
        box.querySelector('.modal-save').addEventListener('click', () => {
          const name = box.querySelector('.s-name').value.trim();
          if (!name) { box.querySelector('.s-name').focus(); return; }
          const patch = {
            emoji: box.querySelector('.s-emoji').value.trim() || '⭐', name,
            cost: Math.max(1, Number(box.querySelector('.s-cost').value) || 1),
            rarity: box.querySelector('.s-rarity').value,
          };
          if (isNew) S.addSticker(patch); else S.updateSticker(sk.id, patch);
          close(); ctx.render();
        });
      }, { save: 'Speichern' });
  };

  /* =====================================================================
     FAMILIENZIEL (gemeinsames Sparziel)
     ===================================================================== */
  UI.goalDialog = function (goal, ctx) {
    const isNew = !goal;
    goal = goal || { title: '', emoji: '🎡', target: 300 };
    UI.modal(isNew ? 'Neues Familienziel' : 'Familienziel bearbeiten', `
      <div class="tf">
        <label>Worauf spart ihr?<input class="g-title" value="${esc(goal.title)}" placeholder="z. B. Zoo-Ausflug"></label>
        <div class="tf-row">
          <label class="tf-emoji">Zeichen<input class="g-emoji" value="${esc(goal.emoji)}" maxlength="4"></label>
          <label>Ziel-Punkte<input type="number" class="g-target" value="${goal.target}" min="10" max="9999"></label>
        </div>
        <p class="subtle small">Alle abgenommenen Aufgaben der ganzen Familie zählen zusammen. Richtwert: Die Familie sammelt grob 150–250 Punkte pro Woche – ein Ziel von 300 dauert also etwa 1–2 Wochen.</p>
      </div>`,
      (box, close) => {
        box.querySelector('.modal-save').addEventListener('click', () => {
          const title = box.querySelector('.g-title').value.trim();
          if (!title) { box.querySelector('.g-title').focus(); return; }
          S.setGoal({
            title,
            emoji: box.querySelector('.g-emoji').value.trim() || '🎯',
            target: box.querySelector('.g-target').value,
          });
          close(); ctx.render();
        });
      }, { save: 'Speichern' });
  };

  /* =====================================================================
     FAMILIE VERWALTEN (im Einstellungs-Menü)
     ===================================================================== */
  UI.memberDialog = function (m, onDone) {
    const isNew = !m;
    m = m || { name: '', short: '', emoji: '🙂', color: '#6c5ce7', kind: 'child' };
    UI.modal(isNew ? 'Neues Familienmitglied' : 'Mitglied bearbeiten', `
      <div class="tf">
        <label>Name<input class="m-name" value="${esc(m.name)}" placeholder="z. B. Oma Karin"></label>
        <div class="tf-row">
          <label>Kurzname<input class="m-short" value="${esc(m.short)}" placeholder="z. B. Oma"></label>
          <label class="tf-emoji">Zeichen<input class="m-emoji" value="${esc(m.emoji)}" maxlength="4"></label>
        </div>
        <div class="tf-row">
          <label>Farbe<input type="color" class="m-color" value="${esc(m.color)}"></label>
          <label>Rolle<select class="m-kind">
            <option value="child" ${m.kind === 'child' ? 'selected' : ''}>🧒 Kind</option>
            <option value="adult" ${m.kind === 'adult' ? 'selected' : ''}>🧑 Erwachsene/r</option>
          </select></label>
        </div>
        <p class="subtle small">Kinder erscheinen als eigene Kachel auf dem Start-Bildschirm und im Kinder-Modus. Aufgaben bekommt die Person über den Reiter „Aufgaben" (Zuständig antippen).</p>
      </div>`,
      (box, close) => {
        box.querySelector('.modal-save').addEventListener('click', () => {
          const name = box.querySelector('.m-name').value.trim();
          if (!name) { box.querySelector('.m-name').focus(); return; }
          const patch = {
            name,
            short: box.querySelector('.m-short').value.trim() || name.split(' ')[0],
            emoji: box.querySelector('.m-emoji').value.trim() || '🙂',
            color: box.querySelector('.m-color').value,
            kind: box.querySelector('.m-kind').value,
          };
          if (isNew) S.addMember(patch); else S.updateMember(m.id, patch);
          close();
          if (onDone) onDone();
        });
      }, { save: 'Speichern' });
  };

  UI.renderFamilyManager = function (container, onChanged) {
    const changed = () => { paint(); if (onChanged) onChanged(); };
    const paint = () => {
      container.innerHTML = '';
      S.members().forEach(m => {
        const row = el(`<div class="fam-row" style="--c:${m.color}">
          <span class="fam-row-emoji">${m.emoji}</span>
          <span class="fam-row-name">${esc(m.name)}
            <span class="subtle small">${esc(m.short)} · ${m.kind === 'child' ? 'Kind' : 'Erwachsene/r'}</span></span>
          <button class="btn tiny fam-edit" title="Bearbeiten">✏️</button>
          <button class="btn tiny danger fam-del" title="Löschen">🗑</button>
        </div>`);
        row.querySelector('.fam-edit').addEventListener('click', () => UI.memberDialog(m, changed));
        row.querySelector('.fam-del').addEventListener('click', () => {
          if (S.members().length <= 1) { UI.toast('Die letzte Person kann nicht gelöscht werden.'); return; }
          UI.confirm(`${m.emoji} ${m.name} wirklich entfernen? Punkte und Verlauf bleiben gespeichert; Aufgaben, die nur ${esc(m.short)} gehörten, werden pausiert.`, () => {
            S.removeMember(m.id);
            changed();
          }, 'Ja, entfernen');
        });
        container.appendChild(row);
      });
      const add = el('<button class="btn fam-add">➕ Mitglied hinzufügen</button>');
      add.addEventListener('click', () => UI.memberDialog(null, changed));
      container.appendChild(add);
    };
    paint();
  };

  // Kleine, kurz eingeblendete Rückmeldung
  UI.toast = function (msg) {
    const t = el(`<div class="toast">${esc(msg)}</div>`);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1600);
  };

  /* =====================================================================
     Modal-Helfer
     ===================================================================== */
  UI.modal = function (title, bodyHtml, setup, opts = {}) {
    const back = el(`<div class="modal-back">
      <div class="modal">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="modal-x">✕</button></div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-foot">
          <button class="btn ghost modal-cancel">Abbrechen</button>
          ${opts.save ? `<button class="btn primary modal-save">${esc(opts.save)}</button>` : ''}
        </div>
      </div>
    </div>`);
    const close = () => back.remove();
    back.querySelector('.modal-x').addEventListener('click', close);
    back.querySelector('.modal-cancel').addEventListener('click', close);
    back.addEventListener('click', (e) => { if (e.target === back) close(); });
    document.body.appendChild(back);
    if (setup) setup(back, close);
    return { close };
  };

  UI.confirm = function (msg, onYes, saveLabel) {
    UI.modal('Bestätigen', `<p class="confirm-msg">${esc(msg)}</p>`, (box, close) => {
      box.querySelector('.modal-save').addEventListener('click', () => { close(); onYes(); });
    }, { save: saveLabel || 'Ja, löschen' });
  };

})(window.CHORES = window.CHORES || {});
