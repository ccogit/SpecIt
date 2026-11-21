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

Öffne http://127.0.0.1:3000. Der Demo-Modus verwendet feste Beispiel-Rückfragen und einen ausdrücklich generischen Implementierungsplan, keine KI-Analyse.

### Claude aktivieren

Kopiere .env.example nach .env und setze ANTHROPIC_API_KEY, ggf. ANTHROPIC_MODEL. Starte neu, aktiviere Claude explizit in der Oberfläche. Die Anthropic API wird separat abgerechnet; kostenloser Chat-Zugang allein reicht nicht. Der Schlüssel verbleibt serverseitig. Die App ruft die Messages API auf; sie ist kein separat gehosteter Agent.

## Ablauf

1. Sechs Spec-Schritte erfassen; Claude prüft nach 2,2 Sekunden Eingabepause oder manuell und ergänzt Rückfragen.
2. Spezifikation erzeugen und bearbeiten oder bestehende Spezifikation direkt einfügen.
3. Optional Repository, technische Konventionen und Zielagent angeben.
4. Arbeitsaufträge erstellen: Claude zerlegt den bestätigten Kontext in konkrete Tasks, Demo liefert ein generisches Gerüst.
5. Abhängigkeiten, Scope, offene Entscheidungen und Abnahmekriterien prüfen. Veraltete Pläne nach Änderungen neu erzeugen.
6. Einzelne Prompts/Markdown-Dateien oder BACKLOG.md und tasks.json exportieren und an Claude Code, Codex, Cursor, Copilot oder andere Coding-Agenten übergeben.

## Arbeitsauftrag

Jeder Task trägt ID, Ziel, Anforderungsbezug, Abhängigkeiten, Scope und Nicht-Scope, Schnittstellen, Liefergegenstände, Akzeptanzkriterien, Tests und blockierende Entscheidungen. Der Server validiert das JSON und prüft die Abhängigkeiten auf Zyklen, unbekannte IDs und doppelte IDs. Blockierte Entscheidungen propagieren zu abhängigen Tasks. Abhängigkeitsstufen sind nur potenzielle Parallelisierung, keine Garantie für Schreibkonfliktfreiheit. Der Mensch muss gemeinsame Dateibereiche und Verträge bestätigen und tatsächliche Fertigstellung der Vorgänger prüfen. Keine automatische Agent-Ausführung, GitHub-Änderungen oder Deployments. Zielagent ist ein Kontextfeld; alle Aufträge bleiben portabel.

## Qualität und Datenschutz

`npm test` prüft das Planner-Modul. Ein Live-Test mit Claude benötigt API-Key und Guthaben. Server bindet an localhost, prüft Origin/Host und begrenzt Eingaben und parallele API-Anfragen. Entwürfe werden im Browser gespeichert; mit aktivierter KI werden Projektdaten an Anthropic übermittelt. Keine vertraulichen Daten nutzen. Keine öffentliche Bereitstellung ohne Authentifizierung, Zugriffskontrolle und Datenschutzkonzept. GitHub Pages kann das Node-Backend nicht ausführen. KI-Ausgaben stets fachlich prüfen.
