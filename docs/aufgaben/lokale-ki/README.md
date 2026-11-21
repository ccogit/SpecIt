# SpecIt: Aufgaben

Dieses Verzeichnis enthält Aufgaben, die als Ketten vergeben werden (Register und Regeln für Bearbeiter:
`KETTEN.md`). Diese Datei beschreibt, was für **alle** Aufgaben gilt. Jede Aufgabendatei verweist hierher.

## 1. Ausgangslage

SpecIt ist eine lokale Web-Anwendung (Node.js-Server `server.mjs`, Oberfläche `public/index.html`, Prompts und
Fachlogik in `interview.mjs`). Der Nutzer tippt eine Idee in einem Satz und stellt Regler ein (Zielzeit,
Kreativität, Einsatzbereich und weitere). Daraus entstehen Fragen, eine Spezifikation und Aufträge für
Coding-Agenten.

Auf der ersten Seite gibt es eine **Live-Skizze**: ein SVG-Bild (viewBox `0 0 480 300`) der Hauptansicht der
geplanten Anwendung, das sich beim Tippen und bei jeder Reglerbewegung ändert. Sie hat zwei Schichten:

1. **Sofort-Skizze ohne KI:** Der Browser setzt sie aus Stichwörtern der Idee zusammen. Sie steht ohne
   Verzögerung, kennt aber nur neun feste Arten von Bereichen (Liste, Formular, Kalender, Auswertung und so weiter).
2. **KI-Skizze:** Ein Sprachmodell zeichnet das SVG. Die Antwort wird als Strom Stück für Stück an den Browser
   gereicht und dort schon unvollständig angezeigt, erst grobe Flächen, dann Beschriftungen und Inhalte. In einem
   zweiten Zug wird aus dem Drahtmodell ein farbig gestalteter Entwurf.

Die KI-Skizze läuft heute über Claude in der Cloud (aufgerufen über die Kommandozeile `claude -p` oder die
Anthropic-API). Gemessen auf dem Rechner des Nutzers mit dem Modell `claude-haiku-4-5`:

| Messgröße | Wert |
|---|---|
| Zeit bis zum ersten Zeichen | rund 1 Sekunde |
| Drahtmodell fertig (4.500 bis 7.000 Zeichen SVG) | 10 bis 16 Sekunden |
| Eingabe | rund 1.500 Tokens Anweisung plus die Idee |
| Neuere Modelle mit vorgeschaltetem Nachdenken | 10 bis 25 Sekunden bis zum ersten Zeichen, deshalb verworfen |

Jede Änderung an Idee oder Reglern bricht die laufende Zeichnung ab und beginnt neu. Beim Tippen entstehen so viele
kurze, abgebrochene Anfragen; das kostet Cloud-Kontingent und fühlt sich trotz Strom nicht wie Echtzeit an.

Hinweis zum Stand im Repository: Die Live-Skizze ist zum Zeitpunkt dieser Aufgaben noch nicht auf `main`. Die
Aufgaben sind deshalb so geschrieben, dass sie ohne diesen Code bearbeitbar sind; alles Nötige steht hier und in der
Aufgabendatei.

## 2. Ziel

Geklärt werden soll, ob und wie ein **lokal laufendes, vorgewärmtes Modell** die KI-Skizze schneller und
unmittelbarer macht als die Cloud, und ob es dafür spezialisierte Modelle gibt. Ergebnis ist eine belastbare
Empfehlung mit Zahlen, auf deren Grundlage die Umsetzung als eigene Aufgaben geschnitten werden kann.

## 3. Aufgaben und Reihenfolge

| Nr | Datei | Inhalt | Setzt voraus |
|---|---|---|---|
| 01 | `AUFGABE-01-ANALYSE-LOKALE-KI.md` | Analyse: lokale, vorgewärmte Modelle für die Live-Skizze | – |

## 4. Feste Bedingungen (nicht ändern)

- Reine Analyse: keine Änderungen an Produktcode (`server.mjs`, `interview.mjs`, `public/`, `test/` und die
  übrigen `.mjs`-Dateien im Wurzelverzeichnis), keine neuen npm-Abhängigkeiten, keine Änderung an `package.json`.
- Keine Secrets, keine echten Kundendaten in Code, Tests oder Dokumentation.
- SpecIt bleibt ohne Abhängigkeiten startbar (`npm start`); eine lokale KI ist immer eine zusätzliche Möglichkeit,
  nie eine Voraussetzung.
- Aussagen über Modelle, Lizenzen, Geschwindigkeiten und Speicherbedarf brauchen eine Quelle (Link) und das Datum
  des Abrufs. Was nicht belegt werden konnte, wird als Annahme gekennzeichnet. Keine erfundenen Messwerte.

## 5. Regeln für die Umsetzung

- Qualitätsprüfung vor jedem Push: `npm test` (muss unverändert grün bleiben).
- Sprache der Dokumente: Deutsch, sachlich, ohne Werbesprache. Fachbegriffe beim ersten Auftreten kurz erklären.
- Neue Dateien nur unter `docs/analyse/` und `docs/aufgaben/lokale-ki/ergebnisse/`.

## 6. Begriffe

| Begriff | Bedeutung |
|---|---|
| Live-Skizze | Das SVG-Bild der geplanten Anwendung auf der ersten Seite von SpecIt, das sich beim Tippen ändert. |
| Sofort-Skizze | Die Schicht der Live-Skizze, die der Browser ohne KI aus Stichwörtern zusammensetzt. |
| KI-Skizze | Die Schicht der Live-Skizze, die ein Sprachmodell als SVG zeichnet. |
| Vorgewärmt | Das Modell ist bereits in den Speicher geladen und antwortet ohne Ladezeit; idealerweise ist auch der gleichbleibende Anfang des Prompts schon verarbeitet (Prompt-Cache). |
| Zeit bis zum ersten Zeichen | Dauer vom Absenden der Anfrage bis zum ersten Stück der Antwort. |
| Zielrechner | Der Rechner des Nutzers: Windows 11, AMD Ryzen 7 9800X3D, 32 GB RAM, NVIDIA GeForce RTX 5080 mit 16 GB Grafikspeicher. Ollama 0.40 ist installiert, läuft aber nicht dauerhaft. |
| Regler | Einstellungen auf der ersten Seite (Zielzeit in acht Stufen, Kreativität, Einsatzbereich, Logo, Layout, Name), die als Sätze in den Prompt eingehen. |

## 7. Abnahme über alle Aufgaben

1. `docs/analyse/lokale-ki-skizze.md` liegt vor und erfüllt die Abnahme von Aufgabe 01.
2. Kein Produktcode ist geändert; `npm test` läuft durch.
