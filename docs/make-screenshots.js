/* =========================================================================
   Screenshots für die README neu aufnehmen

   Voraussetzungen (die App selbst braucht weiterhin keinen Build-Schritt –
   das hier ist reines Werkzeug):
     npm i -g playwright        # oder: npx playwright
     python3 -m http.server 8123    # im Wurzelverzeichnis des Projekts

   Aufruf:
     node docs/make-screenshots.js

   Es wird ein realistischer, aber vollständig erzeugter Datenstand in einem
   frischen Browser-Profil aufgebaut (laufende Woche mit Lücken, Familienziel
   gut zur Hälfte, heute eine Abnahme erledigt und zwei offen). Der Seed ist
   fest verdrahtet, die Aufnahmen sind damit reproduzierbar.

   Umgebungsvariablen: URL, OUT, CHROME (Pfad zur Chromium-Binärdatei).
   ========================================================================= */
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.URL || 'http://localhost:8123/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'screenshots');
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Läuft IM BROWSER: baut den Datenstand über die normale Store-API auf.
function seedFn() {
  const S = CHORES.store, D = CHORES.date, today = D.today();
  let r = 987654321;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const LOB = ['Ganz allein geschafft!', 'Richtig sorgfältig gemacht.', 'Danke, das hat uns geholfen!', ''];

  // Die sechs zurückliegenden Tage dieser Woche, ~21 % bleiben liegen
  for (let k = 6; k >= 1; k--) {
    const iso = D.addDays(today, -k);
    S.instancesFor(iso).forEach(i => {
      if (rand() > 0.79) return;
      S.submit(i.task.id, iso, i.member);
      const inst = S.instance(i.task, iso, i.member);
      if (!inst.pending) return; // Aufgabe ohne Abnahme: mit dem Melden fertig
      S.approve(i.task.id, iso, {
        by: inst.rater, stars: rand() < 0.55 ? 5 : 4,
        comment: LOB[Math.floor(rand() * LOB.length)], kind: 'praise', member: i.member,
      });
    });
  }

  // Heute: eine Aufgabe abgenommen, je eine Abnahme offen pro Kind.
  // Gemeinsame Aufgaben (z. B. „Spielzeug aufräumen") erscheinen bei beiden
  // Kindern – dieselbe Instanz zweimal anzufassen würde die Abnahme wieder
  // zurücksetzen, daher überschneidungsfrei auswählen. Nur Aufgaben MIT
  // Abnahme, sonst gibt es nichts zu zeigen.
  const used = new Set();
  const pick = id => S.instancesFor(today)
    .find(i => i.assignees.includes(id) && i.needsApproval &&
      !used.has(i.key) && (used.add(i.key), true));
  const done = pick('toni'), p1 = pick('toni'), p2 = pick('leo');
  S.submit(done.task.id, today, done.member);
  S.approve(done.task.id, today, { by: 'mama', stars: 5, comment: 'Ganz allein geschafft!', kind: 'praise', member: done.member });
  [p1, p2].forEach(i => i && S.submit(i.task.id, today, i.member));

  // Zwei Sticker gekauft und ein Wunsch offen, damit der Shop belebt wirkt
  const sk = S.stickers();
  S.buy('toni', 'sticker', sk[0].id);
  S.buy('toni', 'sticker', sk[2].id);
  const rw = S.rewards().filter(x => x.group === 'child' || x.group === 'all');
  if (rw.length) S.buy('toni', 'reward', rw[0].id);
  S.save();
}

const wait = (p, sel) => p.waitForSelector(sel, { timeout: 8000 });

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));

  await page.goto(URL); await wait(page, '.start-people');
  await page.evaluate(seedFn);

  // Familienziel: Start zurückdatieren, Zielmarke auf ~60 % Füllung runden
  await page.evaluate(() => {
    const S = CHORES.store, D = CHORES.date;
    S.setGoal({ title: 'Zoo-Ausflug', emoji: '🦁', target: 1 });
    const st = JSON.parse(localStorage.getItem('familien-dashboard-v1'));
    st.goal.startAt = D.addDays(D.today(), -6);
    localStorage.setItem('familien-dashboard-v1', JSON.stringify(st));
  });
  await page.reload(); await wait(page, '.start-people');
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('familien-dashboard-v1'));
    st.goal.target = Math.round(CHORES.store.goalProgress() / 0.6 / 50) * 50;
    localStorage.setItem('familien-dashboard-v1', JSON.stringify(st));
  });
  await page.reload(); await wait(page, '.start-people');

  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });

  await shot('01-start');

  // Eltern-Sperre – die Einblend-Animation (fade .15s) erst auslaufen lassen
  await page.click('.start-parent'); await wait(page, '.gate-card');
  await page.waitForTimeout(400);
  await shot('05-eltern-sperre');

  // Rechenaufgabe lösen -> Eltern-Ansicht
  const q = await page.textContent('.gate-q');
  const [, a, b] = q.match(/(\d+)\s*\+\s*(\d+)/);
  for (const c of String(+a + +b)) await page.click(`.gate-key:text-is("${c}")`);
  await page.click('.gate-key.ok'); await wait(page, '#nav .nav-btn');
  await shot('06-heute');

  await page.click('.nav-btn[data-view="ratings"]'); await wait(page, '.rateitem');
  await shot('07-abnahme');

  // Kinder-Modus (Toni)
  await page.click('#user-btn'); await wait(page, '.start-person');
  await page.click('.start-people .start-person:first-child'); await wait(page, '.kid-board');
  await page.waitForTimeout(900); // Glas-Füllung zu Ende animieren
  await shot('02-kinder-board');

  await page.click('.kid-col.todo .kid-card'); await wait(page, '.kid-focus');
  await page.click('.kid-timer-btn'); await page.waitForTimeout(1400);
  await shot('03-fokus-sanduhr');
  await page.click('.kid-focus-back');

  // Wünsche & Sticker: so weit scrollen, dass beide Bereiche im Bild sind
  await wait(page, '.kid-stickers');
  await page.click('.kid-stickers'); await wait(page, '.kid-stick');
  await page.evaluate(() => {
    document.querySelector('.kid-shop-scroll').scrollTop =
      document.querySelector('.kid-stick-grid').offsetTop - 240;
  });
  await page.waitForTimeout(300);
  await shot('04-wuensche-sticker');

  const info = await page.evaluate(() => ({
    ziel: `${CHORES.store.goalProgress()} / ${CHORES.store.goal().target}`,
    sterneToni: CHORES.store.balance('toni'),
    offeneAbnahmen: CHORES.store.pendingRatings().length,
  }));
  console.log('Datenstand:', info);
  if (errs.length) { console.error('Fehler auf der Seite:', errs); process.exitCode = 1; }
  await browser.close();
})().catch(e => { console.error('Fehlgeschlagen:', e); process.exit(1); });
