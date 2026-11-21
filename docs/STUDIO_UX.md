# SpecIt Studio — UX-Konzept, Architektur und Qualitätsmaßstab

> Stand: November 2026 · Branch: `feat/premium-ai-studio-redesign`

## 1. Produktversprechen

**Aus möglichst wenig Nutzerinput entsteht ein überraschend treffendes, nachvollziehbares und realisierbares App-Konzept.** Nicht mehr Felder, sondern bessere Annahmen, präzise Nutzerreisen, klare Entscheidungspunkte und sofort nutzbare Ergebnisse machen den Unterschied.

Der Produktanspruch „premium“ meint: hohe typografische Qualität, konsistente Komponenten, souveräne Zustände, ehrliche KI-Transparenz, vorausschauende Assistenz und geringe kognitive Last. Er meint **nicht** möglichst viele Animationen oder ungefragte KI-Aktionen.

## 2. Nutzerbedürfnisse (Hypothesen, keine nachgewiesenen Marktfakten)

| Nutzungssituation | Problem | Gestaltungsentscheidung |
| --- | --- | --- |
| Idee nur grob vorhanden | Unklar, wo anfangen | Ein-Satz-Einstieg, inspirierende Vorlagen, eine Hauptaktion |
| Unbekannte Produktentscheidungen | Hohe kognitive Last | Autopilot mit begründeten Standards und sichtbarer Herkunft |
| Nutzer hat konkrete Vorstellungen | Angst vor Kontrollverlust | Jeder Wert, jede Annahme und jedes Feature kann geprüft und geändert werden |
| Stakeholder benötigt eine belastbare Grundlage | Generische KI-Texte sind nicht ausführbar | Nutzerreisen, Anforderungs-IDs, Qualität, Zustände, prüfbare Akzeptanzkriterien |
| Technische Umsetzung steht an | Medienbruch zwischen Konzept und Umsetzung | Automatische Vorbereitung eines Plans; standardisierte Agent-Aufträge |
| Kein KI-Zugang vorhanden | Erwartungsbruch und falsches Vertrauen | Klarer Demo-Modus statt vorgetäuschter Individualanalyse |

## 3. Informationsarchitektur

1. **Idee:** Vision erfassen; Themen heuristisch erkennen, nicht als KI-Ergebnis ausgeben; mit einem Klick Autopilot starten. Seltene Präferenzen sind hinter „Konzept-Steuerung“ erreichbar.
2. **Fragen:** Nur im geführten Modus aktiv; Entscheidungen als Karten mit lesbaren Standards. Fortschritt, Aufwand und Live-Gliederung liefern Orientierung.
3. **Spezifikation:** Wertvoller Standardzustand ist die **lesbare Ansicht**. Änderungswünsche sind natürliche Sprache; konkrete Verbesserungsvorschläge befüllen nur das Eingabefeld. Die rechte Spalte hält Features, Entscheidungen, Review und Reuse.
4. **Umsetzung:** Automatische Planvorbereitung bei vollständigem Konzept. Aufgaben, Abhängigkeiten, Layoutvarianten und Downloads; das tatsächliche Starten von Coding-Agenten bleibt eine bewusste, separate Aktion.

**Primärer Happy Path:**
Ein Satz → Autopilot → nachvollziehbare Annahmen → Konzept sehen → bei Bedarf 1–2 Verbesserungswünsche → Umsetzung → exportierbarer Agent-Plan.

**Expertenpfad:** Konzept-Steuerung öffnen → Autonomie, Kreativität, Zeit, Einsatzbereich, Namen und optionale Integrationen anpassen → geführtes Interview / Konzept → Review → Plan.

## 4. KI-Interaktion und Vertrauensdesign

Die KI soll zuerst das **Nutzerproblem** verstehen, dann geeignete Abläufe und schließlich Anforderungen/Technik vorschlagen. In der Spezifikation werden konsequent getrennt:

- **Bestätigte Vorgabe:** ausdrücklich vom Nutzer genannt oder beantwortet.
- **Annahme (Standard):** aus unvollständigen Eingaben plausibel ergänzt; änderbar und für den Nutzer erkennbar.
- **KI-Vorschlag:** wertsteigernde Idee außerhalb des verbindlichen Kernumfangs, ausdrücklich optional.

Die Themenhinweise auf der Startseite sind **lokale Heuristiken** in `studio.mjs`, keine Modellbehauptungen. Sie sollen zum Einstieg ermutigen, ohne die Idee oder spätere KI-Ausgabe zu verändern.

Der Generator erhält eine Aufgabenstellung für überprüfbare End-to-End-Nutzerreisen, verständliche Informationsarchitektur, Screens, Leer-/Fehlerzustände, Priorisierung, Barrierefreiheit, Datenmodell, Qualitätsmerkmale und Risiken. Erst wenn daraus eine konsistente Spezifikation entstanden ist, wird der Plan generiert. Externe Stitch-Verarbeitung benötigt weiterhin explizite Aktivierung.

**Grenze:** Ohne reale Nutzerstudie kann die KI die Intention nicht „exakt“ wissen. Das Produkt macht gute Hypothesen statt unbegründeter Gewissheit. Für rechtliche, finanzielle und sicherheitskritische Annahmen bleibt eine fachliche Prüfung erforderlich.

## 5. Gestaltungssystem

**Visuelles Prinzip:** Editorial Product Studio statt technisches Einstellungsformular. Großzügige Headline, dunkles konzeptionelles Showpiece, präziser Light-Mode-Workspace, starke Primäraktion, zurückhaltende Informationshierarchie.

- **Farbrollen:** neutrale Oberflächen, dunkler Primärton, Violett als fokussierter KI-/Aktionsakzent, sanfte semantische Flächen. Dark Mode über dieselben Rollen.
- **Typografie:** System-Inter-Fallback, enge Überschriften, ruhige Fließtexte, Monospace nur für wirklich technische Informationen.
- **Komponenten:** Buttons mit klarer Hierarchie, 11–18 px Rundungen, Karten mit dezenter Kontur, Chips für Zustände statt Dekoration, saubere Fokusmarkierung.
- **Bewegung:** sparsame Hover- und Feedback-Übergänge; `prefers-reduced-motion` deaktiviert Animationen.
- **Responsive:** große zweispaltige Bühne auf Desktop, unter 800 px gestapelt; Navigation scrollt bei schmalen Viewports; keine Horizontalüberläufe im Haupt-Flow.
- **Komposition:** Blickführung zunächst auf Idee/Eingabe, dann auf Entscheidung, danach Ergebnis. Keine drei konkurrierenden Hauptaktionen.

## 6. Zustände und Fehlerführung

| Zustand | Verhalten |
| --- | --- |
| Leere Idee | Hinweis, Beispielideen, Hauptaktion deaktiviert |
| Knappes Briefing | Ermutigender Hinweis statt Blockierung |
| Ausreichende Idee | Kontextuelle Themenhinweise, ohne Garantien |
| Claude nicht verfügbar / ausgeschaltet | Hauptaktion nennt explizit „Beispielkonzept“; generisches Ergebnis als Demo markiert |
| Laufender Auftrag | Sichtbare Aktivität, Status und Abbruch; doppelte Requests gesperrt |
| Erneuter Start mit derselben Idee | Vorhandenes Konzept wieder öffnen, bei nötigen Änderungen aktualisieren |
| Geänderte Antworten | Spezifikation wird als prüfbedürftig markiert und Änderungen nachvollziehbar präsentiert |
| Unvollständiges Konzept | Keine Implementierungsaufträge, bis Entscheidungen übernommen oder bewusst delegiert sind |
| Kein gültiger Plan | Einmalige automatische Vorbereitung beim Übergang zur Umsetzung; Retry weiterhin manuell möglich |
| Unsicherer Agentenstart | Keine automatische Codeausführung, explizite Zustimmung erforderlich |

## 7. Qualitätsrunden

**Runde 1 — Grundlagen:** bestehende Funktionalität beibehalten, visuelle Token normalisieren, Komponenten über vier Phasen konsolidieren. Keine neuen npm-Produktionsabhängigkeiten.

**Runde 2 — Interaktion:** progressive disclosure, Ein-Satz-Autopilot, transparenter Demo-Modus, idempotenter Neustart, progressive Ergebniskennzahlen, kontextuelle Verfeinerung, automatische Planvorbereitung.

**Runde 3 — technische Qualität:** abgesicherte CSS-/Module-Serverrouten, CSP-Korrektur, Node-Tests, Browser-End-to-End-Test, mobile Overflow-Checks, Dark Mode und Screenshots.

**Abnahmekriterien:**
- Eine Person kann ohne Anleitung aus einer einzigen Idee einen Entwurf erzeugen.
- Kein Schritt stellt KI-spezifische Ergebnisse ohne aktivierte KI in Aussicht.
- Alle bisherigen Funktionen sind weiterhin erreichbar.
- Ungesicherte Annahmen sind sichtbar, Nutzer können sie ersetzen.
- Keine stillen externen Aktionen, keine automatische Codeausführung.
- Kein JavaScript-Laufzeitfehler im getesteten Browserfluss.
- Desktop/Mobil und Hell/Dunkel nutzbar; Tastaturfokus und Reduced Motion.
- `npm test`, Syntaxprüfungen und Browser-Smoke sind grün.

## 8. Validierungsbedarf vor produktivem Rollout

Für eine belastbare Aussage zur **Treffgenauigkeit** braucht es mehrere unterschiedliche reale Briefings und Bewertungen durch ihre Urheber. Empfehlenswert: Nutzertests mit 5–8 Projekttypen, je mindestens ein absichtlich mehrdeutiges Briefing; messen, wie viele Annahmen geändert werden müssen, ob Kern-Workflows stimmen und ob die erste Lösung ohne Hilfe nutzbar wirkt. Diese Kennzahlen sind nicht simuliert oder als bereits erhoben ausgegeben.

Auch bei grünem CI bleiben die folgenden Prüfungen erforderlich: tatsächliche Claude-Ausgaben mit echten Modellzugängen, Stitch-Varianten mit eigenem API-Schlüssel, Verhalten im produktiven Zielsystem sowie Datenschutzprüfung für konkrete Nutzungsfälle.
