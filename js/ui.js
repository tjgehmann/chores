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
    const pct = insts.length ? Math.round(doneCount / insts.length * 100) : 0;
    wrap.appendChild(el(`<div class="dayprogress">
      <div class="bar"><span style="width:${pct}%"></span></div>
      <div class="subtle">${doneCount} / ${insts.length} Aufgaben erledigt · ${pct}%</div>
    </div>`));

    // Nach Mitglied gruppieren – jede Person bekommt ihre Spalte
    const lanes = el('<div class="lanes"></div>');
    S.members().forEach(m => {
      const mine = insts.filter(i => i.task.assignees.includes(m.id) || i.doneBy.includes(m.id));
      const laneDone = mine.filter(i => i.done).length;
      const lane = el(`<div class="lane" style="--c:${m.color}">
        <div class="lane-head">
          <div class="avatar">${m.emoji}</div>
          <div>
            <div class="lane-name">${esc(m.name)}</div>
            <div class="subtle">${laneDone}/${mine.length} erledigt${S.isOnVacation(m.id, iso) ? ' · 🏖️ Urlaub' : ''}</div>
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
    const shared = t.assignees.length > 1;
    const card = el(`<div class="task ${i.done ? 'done' : ''} ${i.needsCover ? 'cover' : ''}" style="--cat:${cat.color}">
      <button class="check" title="Erledigt">${i.done ? '✔' : ''}</button>
      <div class="task-body">
        <div class="task-title">${t.fun ? '<span class="funtag">Spaß</span>' : ''}${t.emoji} ${esc(t.title)}</div>
        <div class="task-meta">
          <span class="cat" style="--c:${cat.color}">${cat.emoji} ${cat.label}</span>
          ${shared ? '<span class="cat shared">👥 gemeinsam</span>' : ''}
          <span class="pts">+${t.points}</span>
        </div>
        ${t.description ? `<div class="task-desc">${esc(t.description)}</div>` : ''}
        <div class="task-people">${t.assignees.map(id => memberChip(id)).join('')}
          ${i.coverBy.map(id => `<span class="chip cover" style="--c:${S.member(id) ? S.member(id).color : '#999'}">🤝 ${esc(S.member(id) ? S.member(id).short : '')}</span>`).join('')}
        </div>
        ${i.needsCover ? `<div class="cover-note">🏖️ ${i.onVacation.map(id => esc(S.member(id).short)).join(', ')} im Urlaub – Vertretung nötig <button class="btn tiny cover-btn">Übernehmen</button></div>` : ''}
        ${i.done && i.rating ? ratingSummary(i) : (i.done ? `<div class="await">🎲 ${esc(S.member(i.rater) ? S.member(i.rater).name : 'Jemand')} bewertet noch</div>` : '')}
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
        const pill = el(`<button class="wpill ${i.done ? 'done' : ''}" style="--cat:${cat.color}" title="${esc(i.task.title)}">
          <span class="wpill-emoji">${i.task.emoji}</span>
          <span class="wpill-title">${esc(i.task.title)}</span>
          <span class="wpill-who">${i.task.assignees.map(id => (S.member(id) || {}).emoji || '').join('')}</span>
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
     BEWERTUNGEN (offen)
     ===================================================================== */
  UI.ratings = function (root, ctx) {
    const pending = S.pendingRatings();
    const wrap = el(`<div class="view">
      <div class="view-head"><div><h2>Bewertungen</h2>
        <div class="subtle">${pending.length} Aufgabe(n) warten auf eine Bewertung</div></div></div>
    </div>`);

    wrap.appendChild(el(`<div class="hint">🎲 Jede erledigte Aufgabe wird von einem <b>zufällig ausgelosten</b> Familienmitglied bewertet. Gib Sterne und einen kurzen Kommentar – Lob oder ein Tipp zum Bessermachen.</div>`));

    if (!pending.length) {
      wrap.appendChild(el('<div class="empty big">Alles bewertet! 🎉<br><span class="subtle">Super gemacht.</span></div>'));
      root.appendChild(wrap); return;
    }

    const list = el('<div class="ratelist"></div>');
    pending.forEach(({ c, task }) => {
      const rater = S.member(c.rater);
      const item = el(`<div class="rateitem" style="--cat:${(CAT[task.category] || {}).color || '#999'}">
        <div class="ri-head">
          <span class="ri-emoji">${task.emoji}</span>
          <div>
            <div class="ri-title">${esc(task.title)}</div>
            <div class="subtle small">Erledigt von ${c.doneBy.map(id => `${(S.member(id) || {}).emoji || ''} ${(S.member(id) || {}).short || ''}`).join(', ')} · ${esc(c.date)}</div>
          </div>
        </div>
        <div class="ri-rater">🎲 Bewertet von: <b style="color:${rater ? rater.color : '#333'}">${rater ? rater.emoji + ' ' + rater.name : 'jemand'}</b>
          <button class="btn tiny reroll">🎲 neu losen</button></div>
        <div class="ri-stars">${[1,2,3,4,5].map(n => `<button class="ri-star" data-n="${n}">★</button>`).join('')}</div>
        <div class="ri-kind">
          <label class="pick"><input type="radio" name="kind_${c.taskId}_${c.date}" value="praise" checked> 💚 Lob</label>
          <label class="pick"><input type="radio" name="kind_${c.taskId}_${c.date}" value="tip"> 💡 Tipp zum Besser­machen</label>
        </div>
        <textarea class="ri-comment" rows="2" placeholder="Kommentar (optional) – z. B. „Toll gemacht!“ oder „Nächstes Mal auch die Ecken.“"></textarea>
        <button class="btn primary ri-save" disabled>Bewertung speichern</button>
      </div>`);

      let picked = 0;
      const starBtns = item.querySelectorAll('.ri-star');
      const paint = () => starBtns.forEach((b, idx) => b.classList.toggle('on', idx < picked));
      starBtns.forEach((b, idx) => b.addEventListener('click', () => {
        picked = idx + 1; paint();
        item.querySelector('.ri-save').disabled = false;
      }));
      item.querySelector('.reroll').addEventListener('click', () => { S.reroll(c.taskId, c.date); ctx.render(); });
      item.querySelector('.ri-save').addEventListener('click', () => {
        if (!picked) return;
        const kind = item.querySelector(`input[name="kind_${c.taskId}_${c.date}"]:checked`).value;
        S.rate(c.taskId, c.date, {
          by: c.rater, stars: picked,
          comment: item.querySelector('.ri-comment').value, kind,
        });
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
      !i.task.assignees.includes(m.id) && !S.isOnVacation(m.id, i.date));
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
        const row = el(`<div class="manage-row" style="--cat:${cat.color || '#999'}">
          <span class="mr-emoji">${t.emoji}</span>
          <div class="mr-main">
            <div class="mr-title">${t.fun ? '<span class="funtag">Spaß</span>' : ''}${esc(t.title)}</div>
            <div class="subtle small">${freq} · +${t.points} · ${t.assignees.map(id => (S.member(id) || {}).short).join(', ')}</div>
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

  UI.taskDialog = function (task, ctx) {
    const isNew = !task;
    task = task || { title: '', emoji: '⭐', category: 'ordnung', frequency: 'daily',
      days: null, dayOfMonth: 1, assignees: [], points: 10, group: 'family', description: '', fun: false };
    const catOpts = Object.entries(CAT).map(([k, v]) =>
      `<option value="${k}" ${k === task.category ? 'selected' : ''}>${v.emoji} ${v.label}</option>`).join('');
    const dayBtns = D.WEEKDAY_SHORT.map((n, idx) =>
      `<button type="button" class="daybtn ${(task.days || []).includes(idx) ? 'on' : ''}" data-d="${idx}">${n}</button>`).join('');

    UI.modal(isNew ? 'Neue Aufgabe' : 'Aufgabe bearbeiten', `
      <div class="tf">
        <label>Titel<input class="t-title" value="${esc(task.title)}" placeholder="z. B. Wäsche zusammenlegen"></label>
        <div class="tf-row">
          <label class="tf-emoji">Emoji<input class="t-emoji" value="${esc(task.emoji)}" maxlength="4"></label>
          <label>Kategorie<select class="t-cat">${catOpts}</select></label>
          <label class="tf-pts">Punkte<input type="number" class="t-points" value="${task.points}" min="1" max="100"></label>
        </div>
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
        <div class="t-people">Zuständig (mehrere möglich = gemeinsam)
          <div class="pickers">${S.members().map(m =>
            `<button type="button" class="picker ${task.assignees.includes(m.id) ? 'on' : ''}" data-id="${m.id}" style="--c:${m.color}">${m.emoji} ${esc(m.short)}</button>`).join('')}</div>
        </div>
      </div>`,
      (box, close) => {
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

        box.querySelector('.modal-save').addEventListener('click', () => {
          const title = box.querySelector('.t-title').value.trim();
          if (!title) { box.querySelector('.t-title').focus(); return; }
          const freq = freqSel.value;
          const patch = {
            title, emoji: box.querySelector('.t-emoji').value.trim() || '⭐',
            category: box.querySelector('.t-cat').value,
            description: box.querySelector('.t-desc').value.trim(),
            group: box.querySelector('.t-group').value,
            frequency: freq,
            points: Math.max(1, Number(box.querySelector('.t-points').value) || 10),
            fun: box.querySelector('.t-fun').checked,
            assignees: Array.from(assignees),
            days: freq === 'monthly' ? null : Array.from(days).sort(),
            dayOfMonth: freq === 'monthly' ? Number(box.querySelector('.t-mday').value) || 1 : (task.dayOfMonth || 1),
          };
          if (!patch.assignees.length) patch.assignees = S.members().map(m => m.id);
          if (isNew) S.addTask(patch); else S.updateTask(task.id, patch);
          close(); ctx.render();
        });
      }, { save: 'Speichern' });
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

  UI.confirm = function (msg, onYes) {
    UI.modal('Bestätigen', `<p class="confirm-msg">${esc(msg)}</p>`, (box, close) => {
      box.querySelector('.modal-save').addEventListener('click', () => { close(); onYes(); });
    }, { save: 'Ja, löschen' });
  };

})(window.CHORES = window.CHORES || {});
