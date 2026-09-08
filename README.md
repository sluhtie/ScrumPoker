# Planning Club

Interaktive Scrum-Poker-App mit Englisch als Standardsprache sowie Deutsch, Spanisch und Französisch: teilbare Räume, verdeckte Fibonacci-Karten, gemeinsame Aufdeckung, Ergebnisverteilung und Story-Liste mit vereinbarten Schätzungen. Reduzierte Oberfläche mit rotem Pokertisch, Sitzplätzen und animierten Karten. Stories und Einstellungen werden bei Bedarf eingeblendet.

## Lokal mit Docker Compose

```sh
docker compose up --build
```

App: http://localhost:3000. PostgreSQL 17 läuft im Container, die Daten liegen dauerhaft im Volume `postgres_data`. Quellcodeänderungen werden automatisch geladen. Falls Port 3000 bereits von einer lokalen Entwicklungssitzung belegt ist, diese vorher beenden.

```sh
docker compose down
```

Beendet die Container und behält die Daten. `docker compose down -v` löscht die lokalen Daten endgültig.

### App lokal, nur PostgreSQL in Docker

Voraussetzung: Node.js 24 und Docker Desktop.

```sh
cp .env.example .env
docker compose up -d db
npm ci
npm run dev
```

## Produktion

Der Produktionscontainer enthält die gebaute Node-App und wird ohne Root-Rechte ausgeführt. PostgreSQL wird als externe Datenbank per Umgebungsvariablen angebunden. Verwende dafür eine separate Env-Datei, z. B. `.env.production`:

```dotenv
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
DATABASE_SSL=true
DATABASE_CA=
APP_ORIGIN=https://poker.example.com
PORT=3000
```

```sh
docker compose --env-file .env.production -f compose.production.yaml up -d --build
```

Ein HTTPS-Reverse-Proxy muss auf den lokal gebundenen Port 3000 zeigen. `APP_ORIGIN` muss exakt der öffentlichen Herkunft ohne abschließenden Slash entsprechen. Bei einem eigenen Datenbankzertifikat kann `DATABASE_CA` das PEM-Zertifikat enthalten (`\n` wird unterstützt). Die TLS-Zertifikatsprüfung bleibt aktiviert. Bei Datenbanken mit TLS bitte SSL-Einstellungen über diese Variablen steuern, keine widersprüchlichen `sslmode`-Parameter in der Verbindungs-URL setzen.

Die Tabelle `poker_rooms` wird bei der ersten Raumanfrage automatisch angelegt. Der Datenbankbenutzer benötigt dafür CREATE-Rechte; danach reichen SELECT, INSERT und UPDATE. Datenbanksicherungen und HTTPS werden durch die Betriebsumgebung bereitgestellt. Der Healthcheck `/api/health` überprüft die Datenbankverbindung.

## Ablauf

1. Namen und Raumnamen eingeben, Raum erstellen.
2. Einladungslink kopieren und mit dem Team teilen.
3. Moderation fügt Stories hinzu; alle wählen ihre Karten.
4. Moderation deckt auf; das Team bespricht die Unterschiede.
5. Vereinbarte Schätzung auswählen und übernehmen. Nächste Story anklicken oder erneut abstimmen.

Die erste Person moderiert. Der persönliche Zugang wird auf diesem Browser in `localStorage` gespeichert; beim erneuten Öffnen bleibt die Rolle erhalten. Der Einladungslink gewährt Zutritt, also nur mit dem vorgesehenen Team teilen. Ohne gespeicherten Moderationszugang kann die Moderation aktuell nicht wiederhergestellt werden. Räume unterstützen bis zu 30 Personen und 100 Stories. Bis zu acht Personen sitzen direkt am Tisch; weitere Teilnehmer erscheinen darunter.

Alle 1,5 Sekunden wird der gemeinsame Raumzustand aktualisiert. Stimmen anderer Personen werden vor dem Aufdecken serverseitig entfernt. Mutationen werden durch PostgreSQL-Zeilensperren serialisiert; eine Rundennummer verhindert veraltete Stimmen beim Storywechsel. Es gibt keine WebSocket-Abhängigkeit oder In-Memory-Datenbank. Teilnehmer bleiben bis zum Ende im Raum gelistet; es gibt noch keine Anwesenheitserkennung oder automatische Raumlöschung. Für öffentlich zugängliche Installationen sollte der Reverse-Proxy Anfrageraten begrenzen.

## Sprache

Über das Dropdown im Kopfbereich lässt sich zwischen English, Deutsch, Español und Français wechseln. Englisch ist die Voreinstellung; die Auswahl wird pro Browser gespeichert. Bedienelemente, Fehlermeldungen und Zugänglichkeitsbeschriftungen werden übersetzt, Raum- und Story-Titel bleiben unverändert.

## Einstellungen

Schon beim Erstellen öffnet „Settings“ / „Einstellungen“ ein Modal für Kartenset, automatisches Aufdecken und Durchschnittsanzeige. Speichern übernimmt die Auswahl; Abbrechen verwirft die Änderungen. Die Auswahl wird zusammen mit dem Raum gespeichert. Ohne Anpassung gelten die bisherigen Standardwerte.

Über den Regler-Button ändert die Moderation den Raumnamen, das Kartenset (Fibonacci, modifiziertes Fibonacci, Zweierpotenzen, 0–10, T-Shirt-Größen oder ein eigenes Deck), automatisches Aufdecken und die Durchschnittsanzeige. Einstellungen werden in PostgreSQL gespeichert und gelten für alle Teilnehmer. Die bestehenden Räume erhalten beim Lesen automatisch die bisherigen Standardwerte.

Ein anderes Kartenset kann vor der ersten Stimme oder nach dem Aufdecken gewählt werden und startet eine neue Abstimmung. Vereinbarte Story-Schätzungen bleiben erhalten. Im Beobachtermodus gibt man keine Stimme ab und zählt nicht für das automatische Aufdecken; der Modus lässt sich während einer offenen Runde wechseln. Nach dem Aufdecken bleibt die Teilnehmerrolle für diese Runde unverändert.

### Eigene Decks

„Custom deck“ / „Eigenes Deck“ öffnet den Karteneditor im Einstellungsdialog. Werte mit Kommas, Semikolons oder Zeilenumbrüchen trennen; Dezimalzahlen verwenden einen Punkt. Erlaubt sind 2–16 unterschiedliche Karten mit jeweils 1–8 Zeichen. `?` und `☕` sind optional und werden nicht als Schätzwerte übernommen. Mindestens ein normaler Schätzwert ist erforderlich. Die Vorschau zeigt das fertige Deck. Decks mit Textwerten zeigen keinen Durchschnitt.

Eigene Karten werden in PostgreSQL mit dem Raum gespeichert und gelten für alle Teilnehmer. Änderungen an den Karten eines aktiven eigenen Decks sind wie ein Deckwechsel geschützt: Verdeckte Stimmen werden nicht gelöscht. Nach dem Aufdecken startet eine Änderung eine neue Runde; bereits übernommene Schätzungen bleiben erhalten.

## Entwicklung und Tests

React 19, TypeScript, Vinext/Vite (Next-kompatibler App Router), Node.js und `pg`. Oberfläche: `app/page.tsx`, Spiellogik: `server/game.ts`, PostgreSQL: `server/db.ts`.

```sh
npm test
npm run typecheck
npm run build
# Bei laufender App und Datenbank:
node --env-file=.env tests/integration.mjs
```

Die Integrationstests verwenden zwei Teilnehmer und prüfen gleichzeitige Stimmen, Geheimhaltung, Moderationsrechte, Aufdeckung, Schätzungen, Rundenwechsel, Validierung und Herkunftsschutz. Der Test löscht ausschließlich seinen eigenen Raum, sofern `DATABASE_URL` gesetzt ist.

Optional registriert die Oberfläche in unterstützten Browsern ein rein lesendes WebMCP-Werkzeug `read_planning_room`. Es verwendet dieselben gefilterten Raumdaten wie die Oberfläche. Eine WebMCP-Laufzeitprüfung war in der Entwicklungsumgebung nicht verfügbar.
