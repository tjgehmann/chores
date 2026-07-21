# 🏡 Familien-Dashboard

Ein spielerisches Aufgaben-Dashboard für die ganze Familie – gedacht als
digitale Tafel auf dem iPad. Es zeigt die täglichen, wöchentlichen und
monatlichen Aufgaben im Haushalt und motiviert Groß und Klein, ihren Beitrag
zum Familienleben zu leisten.

Gebaut für **Mama, Papa, Antonia (Toni, 4)** und **Leonard (Leo, 4)** – lässt
sich aber jederzeit anpassen.

## ✨ Funktionen

- **Heute** – alle Aufgaben des Tages, nach Person sortiert, mit Fortschrittsbalken. Antippen = erledigt.
- **Wochenansicht** – die ganze Woche auf einen Blick (Mo–So).
- **Monatsansicht** – Kalender mit Fortschritt pro Tag und Monats-Punktestand.
- **Aufgaben für alle** – Kinderaufgaben (altersgerecht), Erwachsenen-Aufgaben und gemeinsame Aufgaben.
- **Klassisch & ausgefallen** – von „Spülmaschine ausräumen" bis „Krümel-Detektiv", „Familien-DJ" und „Licht-Wächter".
- **Gemeinsame Aufgaben** – mehrere Personen erledigen etwas zusammen.
- **Urlaub & Vertretung** – freie Tage/Wochen eintragen; die App zeigt, welche
  Aufgaben jemand anderes übernehmen muss, und man kann eine Vertretung wählen.
- **Zufällige Bewertung** – jede erledigte Aufgabe wird von einem *zufällig
  ausgelosten* Familienmitglied mit Sternen und einem Kommentar bewertet
  (Lob 💚 oder ein Tipp 💡 zum Bessermachen).
- **Spielerische Statistiken** – Punkte, Level, Serien (🔥 Streaks), Abzeichen
  und eine Wochen-Rangliste, die zum Mitmachen anspornt.

## 📱 Auf dem iPad einrichten

Die App ist eine reine Webapp – **kein Server, kein Login, keine Installation
nötig**. Alle Daten bleiben lokal auf dem Gerät (Browser-Speicher).

**Empfohlen (mit Offline-Betrieb & App-Symbol):**

1. Dateien auf einen Webspace/Server legen, oder z. B. über **GitHub Pages**
   veröffentlichen (Repo-Einstellungen → Pages → Branch auswählen).
2. Die Adresse in **Safari** auf dem iPad öffnen.
3. Auf **Teilen → „Zum Home-Bildschirm"** tippen.
4. Fertig – die App startet dann im Vollbild wie eine echte App und funktioniert
   auch offline.

**Schnell mal ausprobieren (lokal):**

```bash
# im Projektordner einen kleinen Webserver starten
python3 -m http.server 8000
# dann im Browser öffnen:  http://localhost:8000
```

> Ein lokaler Server wird empfohlen, weil Offline-Modus (Service Worker) nur
> über `http(s)` funktioniert. Zum reinen Ausprobieren genügt aber auch das
> direkte Öffnen der `index.html`.

## 🛠️ Anpassen

- **Aufgaben** ändern, hinzufügen oder löschen: Reiter **Aufgaben** in der App.
- **Familienmitglieder** (Namen, Emojis, Farben): in `js/data.js` unter `MEMBERS`.
- **Standard-Aufgabenkatalog**: in `js/data.js` unter `DEFAULT_TASKS`.
- **Daten sichern / übertragen**: Zahnrad ⚙️ oben rechts → Sichern / Einlesen
  (JSON-Datei). So lassen sich die Daten z. B. auf ein anderes Gerät bringen.

## 🗂️ Projektaufbau

```
index.html              Grundgerüst
manifest.webmanifest    PWA-Einstellungen (Home-Bildschirm)
sw.js                   Service Worker (Offline)
css/styles.css          Design (hell & dunkel, iPad-optimiert)
js/data.js              Familie & Standard-Aufgaben
js/store.js             Datenhaltung, Logik, Statistik (localStorage)
js/ui.js                Ansichten / Oberfläche
js/app.js               Navigation & Start
icons/                  App-Symbole
```

Keine Abhängigkeiten, kein Build-Schritt – reines HTML/CSS/JavaScript.
