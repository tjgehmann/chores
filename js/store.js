/* =========================================================================
   Familien-Dashboard – Datenhaltung & Logik
   Speichert den Zustand in localStorage und stellt alle Funktionen bereit,
   mit denen die Oberfläche arbeitet (Aufgaben erzeugen, erledigen, bewerten,
   Urlaub planen, Statistiken berechnen).
   ========================================================================= */
(function (CHORES) {
  'use strict';

  const STORAGE_KEY = 'familien-dashboard-v1';

  /* ------------------------------- Datum -------------------------------- */
  const D = CHORES.date = {
    iso(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    },
    parse(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    today() { return D.iso(new Date()); },
    addDays(iso, n) {
      const d = D.parse(iso); d.setDate(d.getDate() + n); return D.iso(d);
    },
    // Montag als Wochenstart
    startOfWeek(iso) {
      const d = D.parse(iso);
      const wd = (d.getDay() + 6) % 7; // 0 = Montag
      d.setDate(d.getDate() - wd);
      return D.iso(d);
    },
    weekDays(iso) {
      const start = D.startOfWeek(iso);
      return Array.from({ length: 7 }, (_, i) => D.addDays(start, i));
    },
    weekdayIndex(iso) { return D.parse(iso).getDay(); }, // 0=So..6=Sa
    dayOfMonth(iso) { return D.parse(iso).getDate(); },
    monthKey(iso) { return iso.slice(0, 7); },
    weekLabel(iso) {
      const s = D.parse(D.startOfWeek(iso));
      const e = D.parse(D.addDays(D.startOfWeek(iso), 6));
      const f = (x) => `${x.getDate()}.${x.getMonth() + 1}.`;
      return `${f(s)} – ${f(e)}`;
    },
    WEEKDAY_SHORT: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    WEEKDAY_LONG: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    MONTHS: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
             'August', 'September', 'Oktober', 'November', 'Dezember'],
  };

  /* ------------------------------ Zustand ------------------------------- */
  let state = null;

  function defaultState() {
    return {
      members: JSON.parse(JSON.stringify(CHORES.MEMBERS)),
      tasks: JSON.parse(JSON.stringify(CHORES.DEFAULT_TASKS)),
      // Erledigungen, Schlüssel: `${taskId}|${dateIso}`
      completions: {},
      // Urlaube: [{ id, member, start, end }]
      vacations: [],
      createdAt: D.today(),
    };
  }

  const S = CHORES.store = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        state = raw ? JSON.parse(raw) : defaultState();
      } catch (e) {
        state = defaultState();
      }
      // Sicherstellen, dass Felder existieren
      state.completions = state.completions || {};
      state.vacations = state.vacations || [];
      return state;
    },
    save() {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Speichern fehlgeschlagen', e); }
    },
    reset() { state = defaultState(); S.save(); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) {
      const parsed = JSON.parse(text);
      state = Object.assign(defaultState(), parsed);
      S.save();
    },

    /* ----------------------------- Mitglieder ---------------------------- */
    members() { return state.members; },
    member(id) { return state.members.find(m => m.id === id); },

    /* ----------------------------- Aufgaben ------------------------------ */
    tasks() { return state.tasks; },
    task(id) { return state.tasks.find(t => t.id === id); },
    addTask(task) {
      task.id = 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      state.tasks.push(task);
      S.save();
      return task;
    },
    updateTask(id, patch) {
      const t = S.task(id);
      if (t) { Object.assign(t, patch); S.save(); }
      return t;
    },
    removeTask(id) {
      state.tasks = state.tasks.filter(t => t.id !== id);
      S.save();
    },

    // Gilt eine Aufgabe an diesem Datum?
    taskOccursOn(task, iso) {
      if (task.frequency === 'daily') {
        if (task.days && task.days.length) return task.days.includes(D.weekdayIndex(iso));
        return true;
      }
      if (task.frequency === 'weekly') {
        return (task.days || []).includes(D.weekdayIndex(iso));
      }
      if (task.frequency === 'monthly') {
        return D.dayOfMonth(iso) === (task.dayOfMonth || 1);
      }
      return false;
    },

    // Alle Aufgaben-Instanzen für einen Tag (angereichert mit Status)
    instancesFor(iso) {
      return state.tasks
        .filter(t => S.taskOccursOn(t, iso))
        .map(t => S.instance(t, iso));
    },

    key(taskId, iso) { return `${taskId}|${iso}`; },

    instance(task, iso) {
      const key = S.key(task.id, iso);
      const c = state.completions[key];
      // Wer ist wegen Urlaub verhindert?
      const onVacation = task.assignees.filter(id => S.isOnVacation(id, iso));
      const covered = c && c.coverBy ? c.coverBy : [];
      return {
        key,
        task,
        date: iso,
        done: !!(c && c.done),
        doneBy: (c && c.doneBy) || [],
        doneAt: c && c.doneAt,
        rating: c && c.rating,
        rater: c && c.rater,      // wer soll bewerten (zufällig)
        coverBy: covered,          // Vertretung wegen Urlaub
        onVacation,
        needsCover: onVacation.length > 0 && covered.length === 0 && !(c && c.done),
      };
    },

    /* -------------------------- Erledigen / Rückgängig ------------------- */
    toggleDone(taskId, iso) {
      const key = S.key(taskId, iso);
      const task = S.task(taskId);
      const existing = state.completions[key];
      if (existing && existing.done) {
        delete state.completions[key];
      } else {
        // Wer erledigt? Standard = Zuständige (ohne Urlauber), plus evtl. Vertretung
        const doers = task.assignees.filter(id => !S.isOnVacation(id, iso));
        const cover = existing && existing.coverBy ? existing.coverBy : [];
        const allDoers = Array.from(new Set([...doers, ...cover]));
        state.completions[key] = {
          taskId, date: iso, done: true,
          doneBy: allDoers.length ? allDoers : task.assignees.slice(),
          doneAt: new Date().toISOString(),
          coverBy: cover,
          rater: S.pickRandomRater(allDoers),
          rating: null,
        };
      }
      S.save();
    },

    // Zufälliges Familienmitglied, das die Arbeit bewertet (nach Möglichkeit
    // nicht der Erlediger selbst).
    pickRandomRater(doers) {
      const pool = state.members.map(m => m.id).filter(id => !doers.includes(id));
      const list = pool.length ? pool : state.members.map(m => m.id);
      return list[Math.floor(Math.random() * list.length)];
    },

    reroll(taskId, iso) {
      const c = state.completions[S.key(taskId, iso)];
      if (c && c.done && !c.rating) { c.rater = S.pickRandomRater(c.doneBy); S.save(); }
    },

    /* ------------------------------ Bewerten ----------------------------- */
    rate(taskId, iso, { by, stars, comment, kind }) {
      const c = state.completions[S.key(taskId, iso)];
      if (!c) return;
      c.rating = { by, stars, comment: (comment || '').trim(), kind, at: new Date().toISOString() };
      S.save();
    },

    // Erledigte, aber noch nicht bewertete Aufgaben (neueste zuerst)
    pendingRatings() {
      return Object.values(state.completions)
        .filter(c => c.done && !c.rating)
        .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))
        .map(c => ({ c, task: S.task(c.taskId) }))
        .filter(x => x.task);
    },

    recentRatings(limit = 20) {
      return Object.values(state.completions)
        .filter(c => c.rating)
        .sort((a, b) => (b.rating.at || '').localeCompare(a.rating.at || ''))
        .slice(0, limit)
        .map(c => ({ c, task: S.task(c.taskId) }))
        .filter(x => x.task);
    },

    /* ------------------------------- Urlaub ------------------------------ */
    isOnVacation(memberId, iso) {
      return state.vacations.some(v =>
        v.member === memberId && iso >= v.start && iso <= v.end);
    },
    vacations() { return state.vacations; },
    addVacation(member, start, end) {
      if (end < start) { const x = start; start = end; end = x; }
      const v = { id: 'vac_' + Date.now(), member, start, end };
      state.vacations.push(v);
      S.save();
      return v;
    },
    removeVacation(id) {
      state.vacations = state.vacations.filter(v => v.id !== id);
      S.save();
    },
    // Vertretung für eine Aufgabe an einem Tag festlegen
    setCover(taskId, iso, memberIds) {
      const key = S.key(taskId, iso);
      const c = state.completions[key] || { taskId, date: iso, done: false, doneBy: [] };
      c.coverBy = memberIds;
      state.completions[key] = c;
      S.save();
    },

    /* ----------------------------- Statistik ----------------------------- */
    // Statistik über einen Zeitraum (Liste von ISO-Tagen)
    statsForDays(days) {
      const set = new Set(days);
      const per = {};
      state.members.forEach(m => {
        per[m.id] = { member: m, points: 0, done: 0, stars: 0, ratedCount: 0, fun: 0 };
      });
      Object.values(state.completions).forEach(c => {
        if (!c.done || !set.has(c.date)) return;
        const task = S.task(c.taskId);
        if (!task) return;
        const share = c.doneBy.length || 1;
        c.doneBy.forEach(id => {
          if (!per[id]) return;
          per[id].points += Math.round(task.points / share) || task.points;
          per[id].done += 1;
          if (task.fun) per[id].fun += 1;
          if (c.rating) { per[id].stars += c.rating.stars; per[id].ratedCount += 1; }
        });
      });
      Object.values(per).forEach(p => {
        p.avgStars = p.ratedCount ? (p.stars / p.ratedCount) : 0;
        p.level = 1 + Math.floor(p.points / 100);
        p.progress = (p.points % 100); // 0..99 Fortschritt zum nächsten Level
      });
      return per;
    },

    statsWeek(iso) { return S.statsForDays(D.weekDays(iso)); },

    statsAllTime() {
      const days = new Set();
      Object.values(state.completions).forEach(c => { if (c.done) days.add(c.date); });
      return S.statsForDays(Array.from(days));
    },

    // Aktuelle Serie (Tage in Folge mit mind. einer Erledigung) für ein Mitglied
    streak(memberId) {
      let day = D.today(), n = 0;
      for (let i = 0; i < 400; i++) {
        const any = Object.values(state.completions).some(c =>
          c.done && c.date === day && c.doneBy.includes(memberId));
        if (any) { n++; day = D.addDays(day, -1); }
        else if (i === 0) { day = D.addDays(day, -1); } // heute darf noch leer sein
        else break;
      }
      return n;
    },

    // Abzeichen für ein Mitglied (aus Gesamt-Statistik)
    badges(memberId) {
      const all = S.statsAllTime()[memberId] || { done: 0, fun: 0, stars: 0, avgStars: 0 };
      const streak = S.streak(memberId);
      const list = [];
      const add = (cond, emoji, label) => { if (cond) list.push({ emoji, label }); };
      add(all.done >= 1, '🌱', 'Erster Schritt');
      add(all.done >= 10, '🐝', 'Fleißige Biene');
      add(all.done >= 25, '💪', 'Power-Helfer');
      add(all.done >= 50, '🏆', 'Haushalts-Held');
      add(all.fun >= 5, '🎉', 'Spaß-Meister');
      add(streak >= 3, '🔥', '3-Tage-Serie');
      add(streak >= 7, '⭐', 'Wochen-Serie');
      add(all.avgStars >= 4.5 && all.ratedCount >= 3, '✨', 'Top-Qualität');
      return { list, streak };
    },
  };

})(window.CHORES = window.CHORES || {});
