/* =========================================================================
   Familien-Dashboard – Grunddaten
   Enthält die Familienmitglieder und den Aufgaben-Katalog (Vorlagen).
   Diese Daten werden beim ersten Start in den Speicher geladen und können
   danach in der App bearbeitet werden.
   ========================================================================= */
(function (CHORES) {
  'use strict';

  // --- Familienmitglieder ------------------------------------------------
  CHORES.MEMBERS = [
    { id: 'mama',  name: 'Mama',     short: 'Mama', emoji: '👩', color: '#e84393', kind: 'adult' },
    { id: 'papa',  name: 'Papa',     short: 'Papa', emoji: '🧔', color: '#0984e3', kind: 'adult' },
    { id: 'toni',  name: 'Antonia',  short: 'Toni', emoji: '🦄', color: '#e17055', kind: 'child' },
    { id: 'leo',   name: 'Leonard',  short: 'Leo',  emoji: '🚀', color: '#00b894', kind: 'child' },
  ];

  // --- Kategorien (für Farben / Filter) ---------------------------------
  CHORES.CATEGORIES = {
    kueche:   { label: 'Küche',       emoji: '🍽️', color: '#f39c12' },
    wohnen:   { label: 'Wohnen',      emoji: '🛋️', color: '#6c5ce7' },
    ordnung:  { label: 'Ordnung',     emoji: '🧸', color: '#00cec9' },
    draussen: { label: 'Draußen',     emoji: '🌳', color: '#27ae60' },
    tiere:    { label: 'Tiere & Pflanzen', emoji: '🪴', color: '#16a085' },
    baby:     { label: 'Wäsche & Bad', emoji: '🧺', color: '#2980b9' },
    einkauf:  { label: 'Einkauf & Orga', emoji: '🛒', color: '#8e44ad' },
    spass:    { label: 'Spaß-Job',    emoji: '🎉', color: '#e84393' },
    selbst:   { label: 'Ich selbst',  emoji: '🪥', color: '#ff7675' },
  };

  // Wochentage: 0 = Sonntag … 6 = Samstag
  // frequency: 'daily' | 'weekly' | 'monthly'
  //   daily   -> days optional (Standard: alle Tage)
  //   weekly  -> days = Liste von Wochentagen
  //   monthly -> dayOfMonth = Tag im Monat
  // assignees: Standard-Zuständige (mehrere = gemeinsame Aufgabe)
  // group: 'child' | 'adult' | 'family'
  // fun: true  -> ausgefallener Spaß-Job

  let _id = 0;
  const t = (o) => Object.assign({ id: 'task_' + (++_id) }, o);

  CHORES.DEFAULT_TASKS = [
    // ===================== KINDER – täglich ============================
    t({ title: 'Spielzeug aufräumen', emoji: '🧩', category: 'ordnung', frequency: 'daily',
        assignees: ['toni', 'leo'], points: 10, group: 'child',
        description: 'Alle Spielsachen zurück in die Kisten – Toni & Leo gemeinsam.' }),
    t({ title: 'Kuscheltiere ins Bett setzen', emoji: '🧸', category: 'ordnung', frequency: 'daily',
        assignees: ['toni'], points: 5, group: 'child', rotate: true, rotationOffset: 1,
        description: 'Die Kuscheltiere ordentlich aufs Bett setzen.' }),
    t({ title: 'Bücher ins Regal', emoji: '📚', category: 'ordnung', frequency: 'daily',
        assignees: ['leo'], points: 5, group: 'child', rotate: true, rotationOffset: 0,
        description: 'Alle Bücher zurück ins Bücherregal stellen.' }),
    t({ title: 'Servietten verteilen', emoji: '🍽️', category: 'kueche', frequency: 'daily',
        assignees: ['toni'], points: 5, group: 'child', rotate: true, rotationOffset: 0,
        description: 'Für jeden am Tisch eine Serviette hinlegen.' }),
    t({ title: 'Schuhe ordnen', emoji: '👟', category: 'ordnung', frequency: 'daily',
        assignees: ['leo'], points: 5, group: 'child', rotate: true, rotationOffset: 1,
        description: 'Alle Schuhe im Flur schön nebeneinander stellen.' }),

    // ===================== KINDER – wöchentlich =========================
    t({ title: 'Eigenes Zimmer aufräumen', emoji: '🛏️', category: 'ordnung', frequency: 'weekly',
        days: [6], assignees: ['toni', 'leo'], points: 20, group: 'child',
        description: 'Am Samstag das Kinderzimmer gemeinsam auf Vordermann bringen.' }),
    t({ title: 'Blumen gießen', emoji: '🪴', category: 'tiere', frequency: 'weekly',
        days: [1, 4], assignees: ['toni'], points: 10, group: 'child',
        description: 'Die Zimmerpflanzen mit der kleinen Gießkanne gießen.' }),
    t({ title: 'Post aus dem Briefkasten holen', emoji: '📬', category: 'draussen', frequency: 'weekly',
        days: [1, 2, 3, 4, 5], assignees: ['leo'], points: 8, group: 'child',
        description: 'Nachschauen, ob Post da ist, und sie hereinbringen.' }),
    t({ title: 'Wäsche in den Korb werfen', emoji: '🧺', category: 'baby', frequency: 'weekly',
        days: [3], assignees: ['toni', 'leo'], points: 10, group: 'child',
        description: 'Alle schmutzigen Sachen aus dem Zimmer in den Wäschekorb.' }),

    // ===================== KINDER – Spaß-Jobs (ausgefallen) =============
    t({ title: 'Krümel-Detektiv 🔍', emoji: '🔍', category: 'spass', frequency: 'daily',
        assignees: ['leo'], points: 8, group: 'child', fun: true, rotate: true, rotationOffset: 0,
        description: 'Finde alle Krümel unter dem Esstisch und melde sie!' }),
    t({ title: 'Licht-Wächter', emoji: '💡', category: 'spass', frequency: 'daily',
        assignees: ['toni'], points: 8, group: 'child', fun: true, rotate: true, rotationOffset: 1,
        description: 'Alle Lichter ausschalten, die niemand braucht – Energie sparen!' }),
    t({ title: 'Kissen-Aufschüttler', emoji: '🛋️', category: 'spass', frequency: 'weekly',
        days: [0], assignees: ['toni', 'leo'], points: 10, group: 'child', fun: true,
        description: 'Alle Sofakissen kräftig aufschütteln, bis sie kuschelig aussehen.' }),
    t({ title: 'Wetter-Reporter', emoji: '🌤️', category: 'spass', frequency: 'daily',
        assignees: ['leo'], points: 8, group: 'child', fun: true,
        description: 'Aus dem Fenster schauen und der Familie das Wetter ansagen.' }),
    t({ title: 'Familien-DJ 🎵', emoji: '🎵', category: 'spass', frequency: 'weekly',
        days: [5], assignees: ['toni'], points: 10, group: 'child', fun: true,
        description: 'Ein Lied für den Familienabend aussuchen und abspielen.' }),
    t({ title: 'Pflanzen-Doktor', emoji: '🩺', category: 'spass', frequency: 'weekly',
        days: [2], assignees: ['toni'], points: 8, group: 'child', fun: true,
        description: 'Welke Blätter vorsichtig abzupfen – Dr. Toni untersucht die Pflanzen.' }),

    // ===================== ERWACHSENE – täglich =========================
    t({ title: 'Spülmaschine ausräumen', emoji: '🥣', category: 'kueche', frequency: 'daily',
        assignees: ['papa'], points: 12, group: 'adult', rotate: true, rotationOffset: 0,
        description: 'Sauberes Geschirr ausräumen und einräumen.' }),
    t({ title: 'Spülmaschine einräumen & starten', emoji: '🫧', category: 'kueche', frequency: 'daily',
        assignees: ['mama'], points: 12, group: 'adult', rotate: true, rotationOffset: 1,
        description: 'Schmutziges Geschirr einräumen und abends starten.' }),
    t({ title: 'Küche wischen & Tisch abwischen', emoji: '🧽', category: 'kueche', frequency: 'daily',
        assignees: ['mama', 'papa'], points: 12, group: 'adult',
        description: 'Arbeitsflächen und Esstisch nach dem Abendessen abwischen.' }),
    t({ title: 'Abendessen kochen', emoji: '🍳', category: 'kueche', frequency: 'daily',
        assignees: ['mama'], points: 20, group: 'adult',
        description: 'Warme Mahlzeit für die Familie zubereiten.' }),

    // ===================== ERWACHSENE – wöchentlich =====================
    t({ title: 'Müll & Gelber Sack rausbringen', emoji: '🗑️', category: 'draussen', frequency: 'weekly',
        days: [2], assignees: ['papa'], points: 12, group: 'adult', rotate: true, rotationOffset: 0,
        description: 'Mülltonnen und Gelben Sack an die Straße stellen.' }),
    t({ title: 'Staubsaugen (ganze Wohnung)', emoji: '🧹', category: 'wohnen', frequency: 'weekly',
        days: [6], assignees: ['papa'], points: 18, group: 'adult', rotate: true, rotationOffset: 1,
        description: 'Alle Räume durchsaugen.' }),
    t({ title: 'Bad putzen', emoji: '🚿', category: 'wohnen', frequency: 'weekly',
        days: [6], assignees: ['mama'], points: 18, group: 'adult', rotate: true, rotationOffset: 0,
        description: 'Waschbecken, WC, Dusche und Spiegel reinigen.' }),
    t({ title: 'Wäsche waschen & aufhängen', emoji: '👕', category: 'baby', frequency: 'weekly',
        days: [1, 4], assignees: ['mama', 'papa'], points: 15, group: 'adult',
        description: 'Eine Ladung waschen, aufhängen bzw. in den Trockner.' }),
    t({ title: 'Wocheneinkauf', emoji: '🛒', category: 'einkauf', frequency: 'weekly',
        days: [5], assignees: ['papa', 'mama'], points: 20, group: 'adult',
        description: 'Großeinkauf für die kommende Woche.' }),
    t({ title: 'Wochenplan & Essensplan machen', emoji: '📝', category: 'einkauf', frequency: 'weekly',
        days: [0], assignees: ['mama'], points: 12, group: 'adult',
        description: 'Termine und Essensplan für die neue Woche festlegen.' }),
    t({ title: 'Boden wischen', emoji: '🪣', category: 'wohnen', frequency: 'weekly',
        days: [6], assignees: ['mama'], points: 15, group: 'adult',
        description: 'Küche und Flur feucht wischen.' }),

    // ===================== ERWACHSENE – Spaß / monatlich ================
    t({ title: 'Chef-Tester des Abendessens', emoji: '😋', category: 'spass', frequency: 'daily',
        assignees: ['papa'], points: 6, group: 'family', fun: true,
        description: 'Das Essen probieren und mit Sternen bewerten – guten Appetit!' }),
    t({ title: 'Vorräte & Kühlschrank checken', emoji: '🧊', category: 'einkauf', frequency: 'weekly',
        days: [4], assignees: ['papa'], points: 10, group: 'adult',
        description: 'Abgelaufenes aussortieren und Einkaufsliste ergänzen.' }),
    t({ title: 'Fenster putzen', emoji: '🪟', category: 'wohnen', frequency: 'monthly',
        dayOfMonth: 1, assignees: ['papa', 'mama'], points: 25, group: 'adult',
        description: 'Fenster in einem Raum reihum putzen.' }),
    t({ title: 'Auto tanken & sauber halten', emoji: '🚗', category: 'draussen', frequency: 'monthly',
        dayOfMonth: 15, assignees: ['papa'], points: 15, group: 'adult',
        description: 'Tanken und den Innenraum kurz aufräumen.' }),
    t({ title: 'Kinderzimmer aussortieren', emoji: '📦', category: 'ordnung', frequency: 'monthly',
        dayOfMonth: 5, assignees: ['mama', 'toni', 'leo'], points: 20, group: 'family',
        description: 'Kaputtes Spielzeug aussortieren und Kleidung durchsehen – gemeinsam.' }),

    // ===================== FAMILIE – gemeinsam ==========================
    t({ title: 'Tisch decken', emoji: '🍴', category: 'kueche', frequency: 'daily',
        assignees: ['toni', 'leo'], points: 8, group: 'family',
        description: 'Teller, Besteck und Gläser gemeinsam auf den Tisch stellen.' }),
    t({ title: 'Tisch abräumen', emoji: '🧾', category: 'kueche', frequency: 'daily',
        assignees: ['toni', 'leo', 'mama'], points: 8, group: 'family',
        description: 'Nach dem Essen gemeinsam den Tisch abräumen.' }),
    t({ title: 'Großer Familien-Aufräum-Sprint', emoji: '⏱️', category: 'spass', frequency: 'weekly',
        days: [0], assignees: ['mama', 'papa', 'toni', 'leo'], points: 25, group: 'family', fun: true,
        description: '10-Minuten-Sprint: Alle räumen gemeinsam so viel auf wie möglich!' }),
  ];

  /* =======================================================================
     NACHTRAG (Juli 2026) – weitere entwicklungsgerechte Kinder-Aufgaben
     und die neue Kategorie „Ich selbst" (Morgen-/Abend-Routinen).
     WICHTIG: Diese Liste muss NACH den Aufgaben oben stehen, damit die
     fortlaufenden IDs stabil bleiben – bestehende Speicherstände bekommen
     sie über eine Migration (store.js) dazu.
     ======================================================================= */
  CHORES.TASKS_UPDATE_1 = [
    // --- Ich selbst: Routinen, die Vierjährige stolz machen -------------
    t({ title: 'Zähne putzen', emoji: '🪥', category: 'selbst', frequency: 'daily',
        assignees: ['toni', 'leo'], points: 5, group: 'child',
        description: 'Morgens und abends Zähne putzen – blitzeblank wie ein Profi!' }),
    t({ title: 'Selbst anziehen', emoji: '👖', category: 'selbst', frequency: 'daily',
        assignees: ['toni', 'leo'], points: 5, group: 'child',
        description: 'Morgens ganz alleine anziehen – du schaffst das!' }),
    t({ title: 'Schlafanzug-Zeit', emoji: '🌙', category: 'selbst', frequency: 'daily',
        assignees: ['toni', 'leo'], points: 5, group: 'child',
        description: 'Abends Schlafanzug anziehen und die Kleider weglegen.' }),

    // --- Sortieren, Zuordnen, echte kleine Verantwortungen --------------
    t({ title: 'Socken-Detektiv', emoji: '🧦', category: 'baby', frequency: 'weekly',
        days: [1, 4], assignees: ['toni'], points: 10, group: 'child', rotate: true, rotationOffset: 0,
        description: 'Finde alle Sockenpaare aus der frischen Wäsche und lege sie zusammen!' }),
    t({ title: 'Handtuch-Falter', emoji: '🛀', category: 'baby', frequency: 'weekly',
        days: [2], assignees: ['leo'], points: 8, group: 'child', rotate: true, rotationOffset: 1,
        description: 'Die kleinen Handtücher schön zusammenlegen und stapeln.' }),
    t({ title: 'Besteck-Sortierer', emoji: '🥄', category: 'kueche', frequency: 'weekly',
        days: [1, 3, 5], assignees: ['toni'], points: 8, group: 'child', rotate: true, rotationOffset: 0,
        description: 'Löffel und Gabeln aus der Spülmaschine ins richtige Fach sortieren – ohne Messer!' }),
    t({ title: 'Kita-Auspacker', emoji: '🎒', category: 'ordnung', frequency: 'daily',
        days: [1, 2, 3, 4, 5], assignees: ['toni', 'leo'], points: 8, group: 'child',
        description: 'Nach der Kita: Brotdose und Flasche in die Küche bringen, Jacke aufhängen.' }),
    t({ title: 'Back- und Kochhelfer', emoji: '🥕', category: 'kueche', frequency: 'weekly',
        days: [6], assignees: ['leo'], points: 12, group: 'child', rotate: true, rotationOffset: 1,
        description: 'Beim Kochen oder Backen helfen: Gemüse waschen, rühren, abmessen.' }),
    t({ title: 'Müll-Sortierer', emoji: '♻️', category: 'draussen', frequency: 'weekly',
        days: [2], assignees: ['toni'], points: 8, group: 'child', rotate: true, rotationOffset: 0,
        description: 'Papier in die Papiertonne bringen – alles am richtigen Platz!' }),

    // --- Neue Spaß-Jobs -------------------------------------------------
    t({ title: 'Hausschuh-Bote', emoji: '🥿', category: 'spass', frequency: 'weekly',
        days: [0, 3], assignees: ['leo'], points: 6, group: 'child', fun: true, rotate: true, rotationOffset: 1,
        description: 'Bring allen in der Familie ihre Hausschuhe – Express-Lieferung!' }),
    t({ title: 'Spielzeug-Tierarzt', emoji: '🩹', category: 'spass', frequency: 'weekly',
        days: [3], assignees: ['toni'], points: 8, group: 'child', fun: true, rotate: true, rotationOffset: 0,
        description: 'Untersuche dein Spielzeug: Ist etwas kaputt? Melde es in der Spielzeug-Klinik!' }),
  ];
  CHORES.DEFAULT_TASKS = CHORES.DEFAULT_TASKS.concat(CHORES.TASKS_UPDATE_1);

  /* =======================================================================
     BELOHNUNGEN – gegen erspielte Punkte einlösbar (echte Belohnungen).
     group: 'child' | 'adult' | 'all'
     ======================================================================= */
  let _rid = 0;
  const r = (o) => Object.assign({ id: 'reward_' + (++_rid) }, o);

  CHORES.DEFAULT_REWARDS = [
    // --- Kinder ---
    r({ title: 'Extra Gute-Nacht-Geschichte', emoji: '📖', cost: 50, group: 'child',
        description: 'Heute Abend gibt es eine Geschichte mehr.' }),
    r({ title: 'Lieblingsessen aussuchen', emoji: '🍝', cost: 80, group: 'child',
        description: 'Du darfst bestimmen, was es zum Abendessen gibt.' }),
    r({ title: '30 Min extra Spielzeit', emoji: '🧩', cost: 90, group: 'child',
        description: '30 Minuten länger spielen oder aufbleiben.' }),
    r({ title: 'Ein Eis 🍦', emoji: '🍦', cost: 70, group: 'child',
        description: 'Ein leckeres Eis als Belohnung.' }),
    r({ title: 'Film-Abend aussuchen', emoji: '🎬', cost: 120, group: 'child',
        description: 'Du wählst den Film für den Familien-Filmabend.' }),
    r({ title: 'Ausflug zum Spielplatz', emoji: '🛝', cost: 150, group: 'child',
        description: 'Extra-Runde auf dem Lieblingsspielplatz.' }),
    r({ title: 'Freund/in einladen', emoji: '🧑‍🤝‍🧑', cost: 180, group: 'child',
        description: 'Ein Kind zum Spielen einladen.' }),
    r({ title: 'Überraschungstüte', emoji: '🎁', cost: 250, group: 'child',
        description: 'Eine kleine Überraschung zum Auspacken.' }),

    // --- Erwachsene ---
    r({ title: 'Ein Abend aufgabenfrei', emoji: '🛋️', cost: 120, group: 'adult',
        description: 'Heute übernimmt der/die andere alle Aufgaben.' }),
    r({ title: 'Ausschlafen am Wochenende', emoji: '😴', cost: 140, group: 'adult',
        description: 'Einmal richtig ausschlafen – der/die andere steht auf.' }),
    r({ title: 'Wunsch-Abendessen gekocht', emoji: '🍽️', cost: 160, group: 'adult',
        description: 'Dein Lieblingsgericht wird für dich gekocht.' }),
    r({ title: 'Ungestörte Wellness-Stunde', emoji: '🛁', cost: 200, group: 'adult',
        description: 'Eine Stunde nur für dich – Bad, Buch oder Ruhe.' }),

    // --- Für alle ---
    r({ title: 'Familien-Kinoabend', emoji: '🍿', cost: 220, group: 'all',
        description: 'Popcorn, Decke, Lieblingsfilm – die ganze Familie.' }),
    r({ title: 'Ausflug am Wochenende', emoji: '🚗', cost: 300, group: 'all',
        description: 'Ein gemeinsamer Ausflug nach Wahl.' }),
  ];

  /* =======================================================================
     STICKER – digitale Sammel-Sticker fürs Album.
     rarity: 'common' | 'rare' | 'legendary'
     ======================================================================= */
  let _sid = 0;
  const st = (emoji, name, cost, rarity) =>
    ({ id: 'sticker_' + (++_sid), emoji, name, cost, rarity });

  CHORES.DEFAULT_STICKERS = [
    // common
    st('⭐', 'Stern', 15, 'common'),
    st('🌈', 'Regenbogen', 15, 'common'),
    st('🐶', 'Hund', 20, 'common'),
    st('🐱', 'Katze', 20, 'common'),
    st('🍦', 'Eis', 20, 'common'),
    st('🎈', 'Luftballon', 15, 'common'),
    st('🌻', 'Blume', 15, 'common'),
    st('🦋', 'Schmetterling', 20, 'common'),
    // rare
    st('🦄', 'Einhorn', 45, 'rare'),
    st('🚀', 'Rakete', 45, 'rare'),
    st('🐉', 'Drache', 50, 'rare'),
    st('🦖', 'Dino', 50, 'rare'),
    st('🏰', 'Schloss', 45, 'rare'),
    st('🐬', 'Delfin', 45, 'rare'),
    // legendary
    st('👑', 'Krone', 100, 'legendary'),
    st('💎', 'Diamant', 120, 'legendary'),
    st('🏆', 'Pokal', 110, 'legendary'),
    st('🌟', 'Goldstern', 100, 'legendary'),
  ];

})(window.CHORES = window.CHORES || {});
