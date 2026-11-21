<p align="center">
  <img src="assets/logo-specit.svg" alt="SpecIt logo" width="240">
</p>

# SpecIt.

**From idea to actionable agent tasks.**

Generischer Spec-Driven-Development-Assistent. Pair Pressure ist nur ein auswählbares Beispiel; das Werkzeug ist für beliebige Projekte vorgesehen.

## Start

Node.js 22+; keine npm-Abhängigkeiten.

### Windows (Doppelklick)

1. Repository auschecken (`git clone https://github.com/ccogit/SpecIt.git`) oder ZIP entpacken.
2. Falls noch nicht vorhanden, [Node.js 22 oder neuer](https://nodejs.org/) installieren.
3. Im Projektordner `start-windows.cmd` doppelklicken. Das Skript prüft Node.js, lädt eine vorhandene `.env`, startet den lokalen Server und öffnet nach erfolgreichem Start den Standardbrowser. Ohne `.env` ist der Demo-Modus verfügbar, sofern kein API-Schlüssel in der Umgebung gesetzt ist.
4. Das Konsolenfenster geöffnet lassen; mit `Strg+C` wird der Server beendet. Bei einem Startfehler bleibt die Fehlermeldung sichtbar. Der Standardport ist 3000 und kann über `PORT` in `.env` angepasst werden.

Es sind weder Administratorrechte noch `npm install` noch eine Änderung der PowerShell-Ausführungsrichtlinie notwendig.

### Terminal (plattformübergreifend)

```bash
git clone https://github.com/ccogit/SpecIt.git
cd SpecIt
npm start
```

Öffne http://127.0.0.1:3000. Der Demo-Modus verwendet einen allgemeinen Fragenkatalog mit Standards und einen ausdrücklich generischen Implementierungsplan, keine KI-Analyse.

### Claude aktivieren

Der Schalter „Claude aktivieren“ in der Kopfzeile ist immer bedienbar; die Wahl wird gemerkt. SpecIt nutzt einen von zwei Zugängen:

- **Claude Code (ohne API-Schlüssel):** Ist `claude` installiert und angemeldet, ruft der Server es lokal im Print-Modus auf – ohne Werkzeuge, außerhalb des Projektordners, über die bestehende Anmeldung und deren Kontingent. Modell über `CLAUDE_CODE_MODEL` (Standard `sonnet`); mit `SPECIT_NO_CLAUDE_CODE=1` lässt sich dieser Weg abschalten.
- **Anthropic API:** .env.example nach .env kopieren und ANTHROPIC_API_KEY setzen, ggf. ANTHROPIC_MODEL. Ein gesetzter Schlüssel hat Vorrang. Die API wird separat abgerechnet; der Schlüssel verbleibt serverseitig.

Ist keiner der beiden Zugänge vorhanden, erklärt die Oberfläche beim Einschalten, was fehlt, und bleibt im Demo-Modus. Nach Änderungen neu starten. Die App ist kein separat gehosteter Agent.

### Stitch-Layouts aktivieren (optional)

Setze `STITCH_API_KEY` in `.env` (oder in der Umgebung) und starte neu. In Schritt 4 erscheint dann der Schalter „Layout-Erstellung über Stitch aktivieren“. Dort die Anzahl Varianten (1–5) und das Zielgerät wählen und „Layouts generieren“ starten. SpecIt legt ein Stitch-Projekt an, erzeugt ein Basis-Layout aus der Spezifikation und daraus die weiteren Varianten; das dauert einige Minuten. Der Link zum Stitch-Projekt wird angezeigt und lässt sich kopieren, die Varianten erscheinen als Vorschau (Screenshot öffnen, HTML herunterladen). Der Link wird als unverbindliche Layout-Referenz in die exportierten Agent-Aufträge übernommen. Der Schlüssel verbleibt serverseitig; Projektname und Spezifikation werden dabei an Google Stitch übermittelt.

## Ablauf

Leitidee: so wenig eigener Prompt-Text wie möglich. Ein Satz genügt; alles Weitere wird erfragt und lässt sich per Klick beantworten. Die Oberfläche führt durch vier Schritte, die über die Leiste oben jederzeit erreichbar sind.

1. **Idee** – einen Satz schreiben oder ein Beispiel wählen. Eine vorhandene Spezifikation lässt sich stattdessen direkt einfügen.
2. **Fragen** – SpecIt leitet aus dem Satz Fragen zu Ziel, Nutzern, Funktionen, UX, Technik und Qualität ab. Jede Frage hat 2–5 Antwortoptionen, eine davon als begründeter Standard vorausgewählt. Bestätigen per Klick oder Tastatur (`1`–`5` wählen, `Enter` übernehmen), „Alle Standards übernehmen“ beantwortet alle offenen Fragen auf einmal, „Eigene Antwort“ und „Eigene Anforderung ergänzen“ sind die Ausnahme für Freitext. Mit Claude sind die Fragen auf die Idee zugeschnitten und lassen sich nachschärfen („Weitere Fragen ableiten“); die Demo nutzt einen allgemeinen Fragenkatalog.
   - Die **Pegelanzeige „Minimal-Konzept“** zeigt nach jeder Antwort, wie viel des implementierungsfähigen Minimal-Konzepts steht: sechs Themen-Segmente, jedes gefüllt nach dem Anteil seiner beantworteten Fragen; 100 % = alle Themen gedeckt.
   - Der **Aufwandszähler** stellt die eigene Eingabe (getippte Wörter, Klicks) dem Ergebnis gegenüber (Festlegungen, Themen, Wörter der Spezifikation).
   - Rechts wächst die Spezifikation live mit. Einzeln bestätigte Antworten gelten als entschieden, per Sammelaktion übernommene Standards bleiben als „Annahme (Standard)“ gekennzeichnet, offene Fragen erscheinen als offene Entscheidungen.
3. **Spezifikation** – konsolidierten Entwurf erzeugen, bearbeiten, als SPEC.md laden.
4. **Agent Tasks** – optional Repository, technische Konventionen und Zielagent angeben, optional UI-Layouts über Stitch erzeugen, dann Arbeitsaufträge erstellen: Claude zerlegt die Spezifikation in konkrete Tasks, die Demo liefert ein generisches Gerüst. Abhängigkeiten, Scope, offene Entscheidungen und Abnahmekriterien prüfen; veraltete Pläne nach Änderungen neu erzeugen. Einzelne Prompts/Markdown-Dateien oder BACKLOG.md und tasks.json exportieren und an Claude Code, Codex, Cursor, Copilot oder andere Coding-Agenten übergeben.

Helles und dunkles Thema sind über die Kopfzeile umschaltbar (Standard: Systemeinstellung).

## Arbeitsauftrag

Jeder Task trägt ID, Ziel, Anforderungsbezug, Abhängigkeiten, Scope und Nicht-Scope, Schnittstellen, Liefergegenstände, Akzeptanzkriterien, Tests und blockierende Entscheidungen. Der Server validiert das JSON und prüft die Abhängigkeiten auf Zyklen, unbekannte IDs und doppelte IDs. Blockierte Entscheidungen propagieren zu abhängigen Tasks. Abhängigkeitsstufen sind nur potenzielle Parallelisierung, keine Garantie für Schreibkonfliktfreiheit. Der Mensch muss gemeinsame Dateibereiche und Verträge bestätigen und tatsächliche Fertigstellung der Vorgänger prüfen. Keine automatische Agent-Ausführung, GitHub-Änderungen oder Deployments. Zielagent ist ein Kontextfeld; alle Aufträge bleiben portabel.

## Qualität und Datenschutz

`npm test` prüft Planner, Fragenmodul (Standards, Pegel, Demo-Spezifikation) und die Stitch-Hilfsfunktionen, ohne Netzwerkzugriff. Ein Live-Test mit Claude benötigt Claude Code oder einen API-Key mit Guthaben. Server bindet an localhost, prüft Origin/Host und begrenzt Eingaben und parallele API-Anfragen. Entwürfe werden im Browser gespeichert; mit aktivierter KI werden Projektdaten an Anthropic übermittelt, mit aktivierter Layout-Erstellung an Google Stitch. Keine vertraulichen Daten nutzen. Keine öffentliche Bereitstellung ohne Authentifizierung, Zugriffskontrolle und Datenschutzkonzept. GitHub Pages kann das Node-Backend nicht ausführen. KI-Ausgaben stets fachlich prüfen.
