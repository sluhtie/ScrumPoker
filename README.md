# Planning Club

Interaktive Scrum-Poker-App mit Englisch als Standardsprache sowie Deutsch, Spanisch und Französisch: teilbare Räume, verdeckte Fibonacci-Karten, gemeinsame Aufdeckung, Ergebnisverteilung und Story-Liste mit vereinbarten Schätzungen. Reduzierte Oberfläche mit rotem Pokertisch, Sitzplätzen und animierten Karten. Stories und Einstellungen werden bei Bedarf eingeblendet.

## Lokal mit Docker Compose

```sh
docker compose -f compose.dev.yaml up -d
# Logs beim ersten Installieren und Starten ansehen:
docker compose -f compose.dev.yaml logs -f app
```

App: http://localhost:3000. Die Entwicklungs-App verwendet das Node-24-Image, installiert beim Start die gesperrten Abhängigkeiten mit `npm ci` und lädt Quellcodeänderungen automatisch. `node_modules` und der npm-Downloadcache liegen in separaten Volumes. PostgreSQL 17 läuft im Container; Daten bleiben im Volume `postgres_data` erhalten. Die bisherigen Volume-Namen bleiben unverändert.

App und PostgreSQL sind lokal an `127.0.0.1` gebunden. Mit `DEV_APP_PORT` und `DEV_DB_PORT` lassen sich belegte Ports umgehen (Standard: 3000 und 5432). Diese Werte können in der lokalen `.env` stehen. Bei geändertem Datenbank-Port muss für eine direkt auf dem Host gestartete App auch `DATABASE_URL` angepasst werden.

```sh
docker compose -f compose.dev.yaml down
```

Beendet die Container und behält die Daten. `down -v` löscht die lokalen Daten und Caches endgültig. Die früheren Dateien `compose.yaml` und `compose.production.yaml` wurden durch `compose.dev.yaml` und `compose.prod.yaml` ersetzt; deshalb den Dateinamen jetzt explizit mit `-f` angeben.

### App lokal, nur PostgreSQL in Docker

Voraussetzung: Node.js 24 und Docker.

```sh
cp .env.example .env
docker compose -f compose.dev.yaml up -d db
npm ci
npm run dev
```

## Produktion auf Dokploy

`compose.prod.yaml` ist eine eigenständige Deployment-Konfiguration. Sie baut aus dem Repository ein mehrstufiges Image mit einem kleinen Node-Runtime-Container. Das Build-Rezept steht direkt unter `dockerfile_inline`; eine separate Dockerfile entfällt. Das benötigt Docker Compose ab 2.17 und BuildKit. [Docker-Build-Spezifikation](https://docs.docker.com/reference/compose-file/build/#dockerfile_inline)

Die laufende App installiert keine Abhängigkeiten und baut nicht erneut. Sie startet als Benutzer `node`, bekommt ihre Konfiguration zur Laufzeit und benötigt keine Quellcode-Mounts. Der Container verwendet einen Init-Prozess, einen Datenbank-Healthcheck, begrenzte Logs und eine Restart-Policy. PostgreSQL wird separat in Dokploy oder extern betrieben; die Verbindung erfolgt weiterhin über `DATABASE_URL`.

### Einrichtung in Dokploy

1. Ein **Docker-Compose-Service** mit dem Git-Repository anlegen. Als Compose-Datei **`compose.prod.yaml`** und als Build-Kontext das Repository-Wurzelverzeichnis verwenden.
2. Den Modus **Docker Compose** wählen. Docker Stack unterstützt den hier verwendeten Image-Build nicht. [Dokploy Compose](https://docs.dokploy.com/docs/core/docker-compose)
3. Unter **Environment** die folgenden Werte hinterlegen. Die Compose-Datei reicht nur die benötigten Variablen an den Container weiter:

   ```dotenv
   DATABASE_URL=postgres://USER:PASSWORD@DATABASE_HOST:5432/DATABASE
   DATABASE_SSL=false
   APP_ORIGIN=https://poker.example.com
   # Optional: PEM-Zertifikat bei eigener TLS-Zertifizierungsstelle
   DATABASE_CA=
   ```

   `DATABASE_URL` und `APP_ORIGIN` sind Pflichtwerte. Die Zugangsdaten gehören in Dokploy, nicht ins Repository. Sonderzeichen im Passwort müssen in der URL korrekt URL-kodiert sein. `APP_ORIGIN` ist die öffentliche HTTPS-Adresse ohne abschließenden Slash oder Pfad.

4. Unter **Domains** die Domain hinzufügen, **Service `app`**, **Container-Port `3000`**, Pfad `/`, HTTPS/Let's Encrypt aktivieren. Dokploy erzeugt die Traefik-Routingregeln. Es werden keine Host-Ports belegt; Port 3000 ist nur innerhalb der Container-Netzwerke erreichbar. Domainänderungen erfordern ein erneutes Deployment. [Dokploy Domains](https://docs.dokploy.com/docs/core/docker-compose/domains)
5. **Deploy** starten. Nach dem Start sollten `/` und `/api/health` über die konfigurierte Domain erreichbar sein.

### Datenbank und Netzwerk

Die App hängt ausdrücklich im vorhandenen externen `dokploy-network`. Für diese Konfiguration **Isolated Deployments ausgeschaltet lassen**. Bei einer Dokploy-PostgreSQL-Datenbank ihre interne Verbindungsadresse nutzen und sicherstellen, dass sie ebenfalls über dieses Netzwerk erreichbar ist. Eine interne Datenbank benötigt keinen öffentlich freigegebenen Port. Für eine externe Datenbank muss ihr Host vom Dokploy-Server aus erreichbar sein.

Bei einer internen PostgreSQL-Instanz ohne TLS `DATABASE_SSL=false` setzen, wie im Beispiel. Für eine TLS-fähige externe Datenbank `DATABASE_SSL=true` verwenden; dies ist auch der Standard, falls die Variable fehlt. Ein eigenes CA-Zertifikat kann über `DATABASE_CA` als PEM angegeben werden (`\n` wird unterstützt). Die Zertifikatsprüfung bleibt aktiv. Keine widersprüchlichen `sslmode`-Parameter in die Verbindungs-URL aufnehmen.

Die Tabelle `poker_rooms` wird bei der ersten Raumanfrage automatisch angelegt. Der Datenbankbenutzer benötigt CREATE-Rechte für diese Initialisierung sowie SELECT, INSERT und UPDATE. Der Healthcheck `/api/health` prüft die Datenbankverbindung und liefert bei Problemen HTTP 503. Datenbanksicherungen werden separat in der Datenbank-Betriebsumgebung eingerichtet.

### Konfiguration vorab prüfen

```sh
# Lokal eine eigene .env.production mit den Deployment-Werten anlegen:
docker compose --env-file .env.production -f compose.prod.yaml config --quiet
docker compose --env-file .env.production -f compose.prod.yaml build app
```

Zum Starten der Produktionsdatei ist das externe `dokploy-network` erforderlich; auf dem Dokploy-Server existiert es bereits. Die Dev-Datei wird beim Produktionsdeployment nicht zusätzlich geladen.

## Link-Vorschauen

Startseite und Raum-Einladungen liefern Titel, Beschreibung, Open-Graph- und X-Metadaten bereits im serverseitigen HTML. Englisch ist wie in der App die Standardsprache. Die lokale Sprachauswahl ändert die öffentliche Link-Vorschau nicht.

- Startseite: `public/og.png` mit „Everyone at the table.“
- Einladungen: `public/og-invite.png` mit „Your seat is ready.“ und dem aktuellen Raumnamen im Vorschautitel.
- Bilder: PNG, 1734 × 907 Pixel; öffentlich ohne Anmeldung abrufbar.
- Nur der Raumname wird für Link-Vorschauen gelesen. Teilnehmer, Stories, Stimmen und Zugangstoken erscheinen nicht darin. Raumlinks haben `noindex, nofollow`; ungültige oder unbekannte Räume erhalten eine allgemeine Einladungsvorschau.

In Dokploy muss **`APP_ORIGIN` der öffentlichen HTTPS-Domain entsprechen**, damit Bild- und Linkadressen stimmen. Dieser Wert wird zur Laufzeit gelesen; beim Domainwechsel den Container mit der neuen Variable neu starten. Die fertigen Bilder werden automatisch in das Produktionsimage übernommen. Externe Dienste können bereits geteilte Vorschauen zwischenspeichern.

Prüfen bei laufender App und PostgreSQL: `npm run test:sharing`. Der Test kontrolliert Startseite, zwei Räume, Sonderzeichen, Datenabgrenzung und Bildabruf und entfernt anschließend seine Testräume. Umsetzung über die [Metadata API](https://nextjs.org/docs/app/api-reference/functions/generate-metadata). Bildprompts und Herkunft stehen in [docs/social-images.md](docs/social-images.md).

## Ablauf

### Raum-Moderation

Der Raum-Ersteller klickt am Pokertisch auf den Namen oder Avatar eines anderen Teilnehmers, um dessen Aktionsmenü zu öffnen. Das funktioniert auch bei zusätzlichen Sitzplätzen unter dem Tisch. Dort lassen sich andere Teilnehmer auf **nur zuschauen** setzen, wieder zum Abstimmen freigeben oder nach Bestätigung entfernen. Ein erzwungener Observer kann die Sperre nicht selbst aufheben; sie bleibt über Rundenwechsel und Neuladen hinweg gespeichert. Der Leader kann sich über diese Aktionen nicht selbst entfernen oder sperren.

Beim Sperren oder Entfernen entfällt die aktuelle Stimme; die automatische Aufdeckung berücksichtigt nur die verbleibenden stimmberechtigten Teilnehmer. Entfernte Sitzungen verlieren ihren Lese- und Schreibzugriff, und die Oberfläche blendet den Raum beim nächsten Abgleich aus. Dies ist eine Sperre der bisherigen Raumsitzung, kein dauerhafter Account-Bann: Die App hat keine registrierten Accounts, und ein neuer Browser ohne die bisherigen Sitzungsdaten kann über den Einladungslink neu beitreten. Rechte und Mitgliedschaften werden im bestehenden PostgreSQL-JSONB gespeichert; keine Migration erforderlich.

Prüfung mit laufender App und lokaler Datenbank: `npm run test:moderation`.

### Mitspielen

Bei der Namenseingabe lässt sich über das Profilbild einer von sechs Cartoon-Avataren auswählen. Der Browser merkt sich die Auswahl für neue Räume; im Raum wird sie in PostgreSQL gespeichert und für alle Teilnehmer angezeigt. Ein Klick auf den eigenen Namen/Avatar am Tisch öffnet die Auswahl erneut. Das funktioniert auch während einer Runde, ohne Stimmen zu verändern. Bestehende Räume erhalten automatisch den Fuchs als Standardavatar. Bilder und Auswahltexte sind lokal eingebunden, die Oberfläche ist in allen vier Sprachen verfügbar. [Bilddateien und Prompts](docs/avatar-artwork.md)

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
