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
    // Fortlaufende Wochennummer ab einem festen Montag (für die Rotation).
    weekIndex(iso) {
      const anchor = new Date(2024, 0, 1); // Montag, 1.1.2024
      const start = D.parse(D.startOfWeek(iso));
      return Math.round((start - anchor) / (7 * 24 * 3600 * 1000));
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
      // Shop: einlösbare Belohnungen & Sammel-Sticker
      shop: {
        rewards: JSON.parse(JSON.stringify(CHORES.DEFAULT_REWARDS)),
        stickers: JSON.parse(JSON.stringify(CHORES.DEFAULT_STICKERS)),
      },
      // Käufe/Einlösungen: [{ id, member, type, refId, title, emoji, cost, at, status }]
      purchases: [],
      migrations: { uniqueIconsV1: true, workflowV1: true, kidTasksV1: true, rebalanceV1: true, rewardsV1: true }, // frische Installation: alles aktuell
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
      // Sicherstellen, dass Felder existieren (auch bei älteren Speicherständen)
      state.completions = state.completions || {};
      state.vacations = state.vacations || [];
      state.shop = state.shop || {};
      if (!state.shop.rewards) state.shop.rewards = JSON.parse(JSON.stringify(CHORES.DEFAULT_REWARDS));
      if (!state.shop.stickers) state.shop.stickers = JSON.parse(JSON.stringify(CHORES.DEFAULT_STICKERS));
      state.purchases = state.purchases || [];

      // Einmalige Migrationen (ändern nur, was nötig ist – Daten bleiben erhalten)
      state.migrations = state.migrations || {};
      if (!state.migrations.uniqueIconsV1) {
        // Doppelte Standard-Icons eindeutig machen (nur wenn noch das alte Icon gesetzt ist)
        const fixes = {
          'Spielzeug aufräumen': ['🧸', '🧩'],
          'Spülmaschine ausräumen': ['🍽️', '🥣'],
          'Wäsche waschen & aufhängen': ['🧺', '👕'],
        };
        state.tasks.forEach(t => {
          const f = fixes[t.title];
          if (f && t.emoji === f[0]) t.emoji = f[1];
        });
        state.migrations.uniqueIconsV1 = true;
        S.save();
      }
      if (!state.migrations.kidTasksV1) {
        // Nachtrag Juli 2026: neue Kinder-Aufgaben + „Ich selbst"-Routinen
        // in bestehende Speicherstände übernehmen (ohne Duplikate).
        const have = new Set(state.tasks.map(t => t.title));
        (CHORES.TASKS_UPDATE_1 || []).forEach(t => {
          if (!have.has(t.title)) state.tasks.push(JSON.parse(JSON.stringify(t)));
        });
        state.migrations.kidTasksV1 = true;
        S.save();
      }
      if (!state.migrations.rebalanceV1) {
        // Umbau auf das 4–6-Karten-Schema (je Kind, pro Tag):
        // fester Tagesrahmen + genau ein Tages-Special.
        const byTitle = {};
        state.tasks.forEach(t => { byTitle[t.title] = t; });

        // 1. Ruhende Aufgaben: bleiben (samt Punkten/Historie) erhalten,
        //    stehen aber ohne Wochentage nicht mehr im Plan. Im Reiter
        //    „Aufgaben" jederzeit reaktivierbar.
        ['Kuscheltiere ins Bett setzen', 'Bücher ins Regal', 'Servietten verteilen',
         'Schuhe ordnen', 'Wäsche in den Korb werfen', 'Wetter-Reporter',
         'Kissen-Aufschüttler', 'Pflanzen-Doktor',
         'Zähne putzen', 'Selbst anziehen', 'Schlafanzug-Zeit'].forEach(title => {
          const t = byTitle[title];
          if (t) { t.frequency = 'weekly'; t.days = []; }
        });

        // 2. Neue Rhythmen: Specials auf feste Tage, rotierend je Kind
        const edits = {
          'Blumen gießen':                  { frequency: 'weekly', days: [4], rotate: true, rotationOffset: 0 },
          'Post aus dem Briefkasten holen': { frequency: 'weekly', days: [3], rotate: true, rotationOffset: 1 },
          'Krümel-Detektiv 🔍':             { frequency: 'weekly', days: [4], rotate: true, rotationOffset: 1 },
          'Licht-Wächter':                  { frequency: 'weekly', days: [5], rotate: true, rotationOffset: 1 },
          'Familien-DJ 🎵':                 { rotate: true, rotationOffset: 0 },
          'Socken-Detektiv':                { days: [1] },
          'Besteck-Sortierer':              { days: [1], rotationOffset: 1 },
          'Hausschuh-Bote':                 { days: [0], rotationOffset: 0 },
          'Tisch decken':                   { rotate: true, rotationOffset: 0, rotationPool: ['toni', 'leo'] },
          'Tisch abräumen':                 { rotate: true, rotationOffset: 1, rotationPool: ['toni', 'leo'] },
        };
        Object.keys(edits).forEach(title => {
          const t = byTitle[title];
          if (t) Object.assign(t, edits[title]);
        });

        // 3. Neue Aufgaben (Morgen-/Abend-Held, Eltern-Kreisläufe) ergänzen
        (CHORES.TASKS_UPDATE_2 || []).forEach(t => {
          if (!byTitle[t.title]) state.tasks.push(JSON.parse(JSON.stringify(t)));
        });

        state.migrations.rebalanceV1 = true;
        S.save();
      }
      if (!state.migrations.rewardsV1) {
        // Erlebnis-Belohnungen (gemeinsame Zeit) in bestehende Stände übernehmen
        const have = new Set(state.shop.rewards.map(r => r.title));
        (CHORES.REWARDS_UPDATE_1 || []).forEach(r => {
          if (!have.has(r.title)) state.shop.rewards.push(JSON.parse(JSON.stringify(r)));
        });
        state.migrations.rewardsV1 = true;
        S.save();
      }
      if (!state.migrations.workflowV1) {
        // Frühere „erledigt"-Einträge in den neuen Abnahme-Workflow überführen:
        // bereits als erledigt markierte Aufgaben gelten als abgenommen.
        Object.values(state.completions).forEach(c => {
          if (!c.status) c.status = c.done ? 'approved' : 'open';
        });
        state.migrations.workflowV1 = true;
        S.save();
      }
      return state;
    },
    save() {
      state.updatedAt = new Date().toISOString();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Speichern fehlgeschlagen', e); }
      // Änderung (gebündelt) in die Cloud hochladen
      if (CHORES.cloud) CHORES.cloud.schedulePush();
    },

    /* ------------------------- Cloud-Anbindung --------------------------- */
    snapshot() { return JSON.parse(JSON.stringify(state)); },
    updatedAt() { return state.updatedAt || null; },
    // Neueren Stand aus der Cloud übernehmen – nur lokal sichern,
    // NICHT wieder hochladen (sonst entstünde eine Schleife).
    applyRemote(data) {
      state = Object.assign(defaultState(), data);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
      catch (e) { console.warn('Speichern fehlgeschlagen', e); }
    },
    reset() { state = defaultState(); S.save(); },
    exportJSON() { return JSON.stringify(state, null, 2); },

    /* ------------------------- Sicherung (Backup) ------------------------ */
    // Merkt sich, wann zuletzt gesichert wurde (beim Daten-Export gesetzt).
    markBackup() { state.lastBackupAt = new Date().toISOString(); S.save(); },
    backupInfo() {
      const DAY = 24 * 3600 * 1000;
      const last = state.lastBackupAt || null;
      const days = last ? Math.floor((Date.now() - new Date(last).getTime()) / DAY) : null;
      const used = Math.floor((Date.now() - D.parse(state.createdAt || D.today()).getTime()) / DAY);
      // Fällig: noch nie gesichert (und App schon über eine Woche in Benutzung)
      // oder die letzte Sicherung ist über 30 Tage her.
      const due = last ? days > 30 : used > 7;
      return { last, days, due };
    },
    importJSON(text) {
      const parsed = JSON.parse(text);
      state = Object.assign(defaultState(), parsed);
      S.save();
    },

    /* ----------------------------- Mitglieder ---------------------------- */
    members() { return state.members; },
    member(id) { return state.members.find(m => m.id === id); },

    addMember({ name, short, emoji, color, kind }) {
      const m = {
        id: 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        name: (name || '').trim(),
        short: (short || name || '').trim(),
        emoji: emoji || '🙂',
        color: color || '#6c5ce7',
        kind: kind === 'adult' ? 'adult' : 'child',
      };
      state.members.push(m);
      S.save();
      return m;
    },

    updateMember(id, patch) {
      const m = S.member(id);
      if (m) { Object.assign(m, patch); S.save(); }
      return m;
    },

    // Mitglied entfernen. Punkte/Verlauf bleiben gespeichert; aufgeräumt
    // werden Zuständigkeiten, Rotations-Pools, offene Abnahmen und Urlaube.
    // Aufgaben, für die danach niemand mehr zuständig ist, werden pausiert
    // (wöchentlich ohne Tage) statt gelöscht.
    removeMember(id) {
      if (state.members.length <= 1) return false; // die letzte Person bleibt
      state.members = state.members.filter(m => m.id !== id);
      state.tasks.forEach(t => {
        if (t.assignees) t.assignees = t.assignees.filter(a => a !== id);
        if (t.rotationPool) {
          t.rotationPool = t.rotationPool.filter(a => a !== id);
          if (!t.rotationPool.length) delete t.rotationPool; // zurück auf Gruppen-Pool
        }
        const pool = t.rotate ? S.rotationPool(t) : [];
        if (t.assignees && !t.assignees.length && !pool.length) {
          t.frequency = 'weekly'; t.days = [];
        }
      });
      // Offene Abnahmen, die diese Person prüfen sollte, neu auslosen
      Object.values(state.completions).forEach(c => {
        if (c.status === 'pending' && c.rater === id) c.rater = S.pickRandomRater(c.doneBy || []);
      });
      state.vacations = (state.vacations || []).filter(v => v.member !== id);
      S.save();
      return true;
    },

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

    // Rotations-Pool einer Aufgabe: Eltern-Aufgaben rotieren nur unter
    // Erwachsenen, Kinder-Aufgaben nur unter Kindern.
    rotationPool(task) {
      if (task.rotationPool && task.rotationPool.length) {
        return task.rotationPool.filter(id => S.member(id));
      }
      const kind = task.group === 'adult' ? 'adult' : task.group === 'child' ? 'child' : null;
      if (kind) return state.members.filter(m => m.kind === kind).map(m => m.id);
      return state.members.map(m => m.id); // Familie: alle
    },

    // Tatsächlich zuständige Person(en) an einem Datum – bei rotierenden
    // Aufgaben wechselt das wöchentlich reihum durch den Pool.
    assigneesFor(task, iso) {
      if (!task.rotate) return task.assignees;
      const pool = S.rotationPool(task);
      if (!pool.length) return task.assignees;
      const i = (D.weekIndex(iso) + (task.rotationOffset || 0)) % pool.length;
      return [pool[(i + pool.length) % pool.length]];
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
      // Effektiv zuständig an diesem Tag (berücksichtigt Rotation)
      const assignees = S.assigneesFor(task, iso);
      // Status: 'open' | 'pending' (zur Abnahme) | 'approved' (abgenommen) | 'rejected' (zurückgegeben)
      const status = c ? (c.status || 'open') : 'open';
      const active = status === 'open' || status === 'rejected'; // muss (noch) getan werden
      // Wer ist wegen Urlaub verhindert?
      const onVacation = assignees.filter(id => S.isOnVacation(id, iso));
      const covered = c && c.coverBy ? c.coverBy : [];
      return {
        key,
        task,
        assignees,                 // effektiv zuständige Person(en) heute
        rotates: !!task.rotate,
        date: iso,
        status,
        done: status === 'approved',
        pending: status === 'pending',
        rejected: status === 'rejected',
        rejection: c && c.rejection,   // { by, reason, at } – Grund der Zurückgabe
        doneBy: (c && c.doneBy) || [],
        doneAt: c && c.doneAt,
        rating: c && c.rating,
        rater: c && c.rater,      // wer soll abnehmen/bewerten (zufällig)
        coverBy: covered,          // Vertretung wegen Urlaub
        onVacation,
        needsCover: onVacation.length > 0 && covered.length === 0 && active,
      };
    },

    /* --------------------- Workflow: melden / zurückziehen --------------- */
    // Klick auf das Häkchen: offen/zurückgegeben -> zur Abnahme melden;
    // wartend/abgenommen -> wieder zurückziehen (rückgängig).
    toggleDone(taskId, iso) {
      const key = S.key(taskId, iso);
      const c = state.completions[key];
      const status = c ? (c.status || 'open') : 'open';
      if (status === 'open' || status === 'rejected') S.submit(taskId, iso);
      else S.withdraw(taskId, iso);
    },

    // Aufgabe als erledigt melden -> Status „zur Abnahme" (pending)
    submit(taskId, iso) {
      const key = S.key(taskId, iso);
      const task = S.task(taskId);
      const existing = state.completions[key];
      const assignees = S.assigneesFor(task, iso);
      const doers = assignees.filter(id => !S.isOnVacation(id, iso));
      const cover = existing && existing.coverBy ? existing.coverBy : [];
      const allDoers = Array.from(new Set([...doers, ...cover]));
      state.completions[key] = {
        taskId, date: iso,
        status: 'pending', done: false,
        doneBy: allDoers.length ? allDoers : assignees.slice(),
        doneAt: new Date().toISOString(),
        coverBy: cover,
        rater: S.pickRandomRater(allDoers),  // wer nimmt ab (zufällig)
        rating: null,
        rejection: null,
      };
      S.save();
    },

    // Zurück auf „Zu tun" (Meldung/Abnahme rückgängig)
    withdraw(taskId, iso) {
      delete state.completions[S.key(taskId, iso)];
      S.save();
    },

    // Zufälliges Familienmitglied, das abnimmt (nach Möglichkeit nicht der
    // Erlediger selbst).
    pickRandomRater(doers) {
      const pool = state.members.map(m => m.id).filter(id => !doers.includes(id));
      const list = pool.length ? pool : state.members.map(m => m.id);
      return list[Math.floor(Math.random() * list.length)];
    },

    reroll(taskId, iso) {
      const c = state.completions[S.key(taskId, iso)];
      if (c && c.status === 'pending') { c.rater = S.pickRandomRater(c.doneBy); S.save(); }
    },

    /* ----------------------- Abnahme: annehmen / zurückgeben ------------- */
    // Abnehmen: Aufgabe gilt als erledigt, mit Bewertung/Feedback.
    approve(taskId, iso, { by, stars, comment, kind }) {
      const c = state.completions[S.key(taskId, iso)];
      if (!c) return;
      c.status = 'approved';
      c.done = true;
      c.rejection = null;
      c.rating = { by, stars, comment: (comment || '').trim(), kind, at: new Date().toISOString() };
      S.save();
    },

    // Zurückgeben: Aufgabe fällt zurück auf „Zu tun", mit Begründung.
    reject(taskId, iso, { by, reason }) {
      const c = state.completions[S.key(taskId, iso)];
      if (!c) return;
      c.status = 'rejected';
      c.done = false;
      c.rating = null;
      c.rejection = { by, reason: (reason || '').trim(), at: new Date().toISOString() };
      S.save();
    },

    // Rückwärtskompatibel: alte Bewertung = Abnahme
    rate(taskId, iso, args) { S.approve(taskId, iso, args); },

    // Aufgaben, die auf Abnahme warten (neueste zuerst)
    pendingApprovals() {
      return Object.values(state.completions)
        .filter(c => (c.status || (c.done ? 'approved' : 'open')) === 'pending')
        .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''))
        .map(c => ({ c, task: S.task(c.taskId) }))
        .filter(x => x.task);
    },
    // Alias für bestehenden Code
    pendingRatings() { return S.pendingApprovals(); },

    // Abnahme-Stau: wartet schon länger als `hours` Stunden auf Abnahme
    overduePending(hours = 24) {
      const cut = Date.now() - hours * 3600 * 1000;
      return S.pendingApprovals().filter(x =>
        x.c.doneAt && new Date(x.c.doneAt).getTime() < cut);
    },

    // Wochen-Bilanz bis einschließlich `iso`: Quote + liegen Gebliebenes
    weekReview(iso) {
      const today = D.today();
      const days = D.weekDays(iso).filter(d => d <= iso);
      let total = 0, done = 0, pending = 0;
      const missed = {};
      days.forEach(d => S.instancesFor(d).forEach(i => {
        total++;
        if (i.done) done++;
        else if (i.pending) pending++;
        else if (d < today) { // vergangene Tage: wirklich liegen geblieben
          const m = missed[i.task.id] || (missed[i.task.id] = { task: i.task, n: 0 });
          m.n++;
        }
      }));
      return {
        total, done, pending,
        pct: total ? Math.round(done / total * 100) : 0,
        laggards: Object.values(missed).filter(x => x.n >= 2)
          .sort((a, b) => b.n - a.n).slice(0, 4),
      };
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

    /* ------------------------------- Shop -------------------------------- */
    rewards() { return state.shop.rewards; },
    stickers() { return state.shop.stickers; },
    reward(id) { return state.shop.rewards.find(x => x.id === id); },
    sticker(id) { return state.shop.stickers.find(x => x.id === id); },

    // Gesamt erspielte Punkte (aller Zeiten) eines Mitglieds
    earned(memberId) {
      const s = S.statsAllTime()[memberId];
      return s ? s.points : 0;
    },
    // Bereits ausgegebene Punkte
    spent(memberId) {
      return state.purchases
        .filter(p => p.member === memberId)
        .reduce((sum, p) => sum + (p.cost || 0), 0);
    },
    // Verfügbares Guthaben = erspielt − ausgegeben
    balance(memberId) { return S.earned(memberId) - S.spent(memberId); },

    // Kauf/Einlösung. type: 'reward' | 'sticker'. Gibt true bei Erfolg.
    buy(memberId, type, refId) {
      const item = type === 'reward' ? S.reward(refId) : S.sticker(refId);
      if (!item) return { ok: false, reason: 'not_found' };
      if (S.balance(memberId) < item.cost) return { ok: false, reason: 'too_expensive' };
      state.purchases.push({
        id: 'buy_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        member: memberId, type, refId,
        title: item.title || item.name, emoji: item.emoji, cost: item.cost,
        at: new Date().toISOString(),
        status: type === 'reward' ? 'open' : 'done', // Belohnung: erst offen, bis eingelöst
      });
      S.save();
      return { ok: true };
    },

    // Sticker-Sammlung eines Mitglieds: { stickerId: anzahl }
    stickerCollection(memberId) {
      const map = {};
      state.purchases
        .filter(p => p.member === memberId && p.type === 'sticker')
        .forEach(p => { map[p.refId] = (map[p.refId] || 0) + 1; });
      return map;
    },

    // Eingelöste Belohnungen (neueste zuerst), optional gefiltert
    rewardPurchases(memberId) {
      return state.purchases
        .filter(p => p.type === 'reward' && (!memberId || p.member === memberId))
        .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    },
    // Belohnung als eingelöst/erledigt markieren (Erwachsene)
    markRewardDone(purchaseId) {
      const p = state.purchases.find(x => x.id === purchaseId);
      if (p) { p.status = 'done'; S.save(); }
    },
    // Kauf stornieren -> Punkte werden automatisch wieder gutgeschrieben
    cancelPurchase(purchaseId) {
      state.purchases = state.purchases.filter(x => x.id !== purchaseId);
      S.save();
    },

    // Verwaltung der Shop-Artikel
    addReward(reward) {
      reward.id = 'reward_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      state.shop.rewards.push(reward); S.save(); return reward;
    },
    updateReward(id, patch) { const x = S.reward(id); if (x) { Object.assign(x, patch); S.save(); } return x; },
    removeReward(id) { state.shop.rewards = state.shop.rewards.filter(x => x.id !== id); S.save(); },
    addSticker(sticker) {
      sticker.id = 'sticker_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
      state.shop.stickers.push(sticker); S.save(); return sticker;
    },
    updateSticker(id, patch) { const x = S.sticker(id); if (x) { Object.assign(x, patch); S.save(); } return x; },
    removeSticker(id) { state.shop.stickers = state.shop.stickers.filter(x => x.id !== id); S.save(); },
  };

})(window.CHORES = window.CHORES || {});
