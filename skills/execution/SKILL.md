---
name: execution
description: Zerlege eine freigegebene SPEC.md in abhängige, eigenständig überprüfbare Coding-Agent-Tasks.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt task JSON and no-blocking planning
---
# Implementierungsplanung

Angelehnt an den Plan-/Task-Gedanken von **GitHub Spec Kit** (MIT); hier wird **ausschließlich** das SpecIt-Task-JSON erzeugt. Dieser Skill plant, er führt keine Befehle aus. Die Anleitung für echte Coding-Agenten steht getrennt unter `implementation`.

## Ablauf

1. **Anforderungen inventarisieren.** SPEC.md inklusive Annahmen, festen NFR-Standards, Akzeptanzkriterien, Nicht-Zielen und ausgewählter Wiederverwendung lesen. In einer internen Zuordnung jede vorhandene FR-/NFR-ID einem geplanten Task zuordnen; bei Specs ohne IDs deren konkrete Aussagen.
2. **Architekturentscheidungen vorziehen.** Sofern notwendig, ein frühes Arbeitspaket für Repository-Prüfung, Schnittstellen, Daten-/API-Verträge oder Projektgrundgerüst planen. Unbekannte vorhandene Dateien, Frameworks oder Endpunkte nicht als Tatsachen voraussetzen.
3. **Tasks schneiden.** Jeder Task hat klares `goal`, `scope`, `outOfScope`, `deliverables`, messbare `acceptance` und ausführbare bzw. prüfbare `tests`. Umsetzung und Tests zusammen planen; Integration, Regression und Übergabe ausdrücklich abdecken.
4. **Abhängigkeiten minimal halten.** `dependsOn` nur für benötigte Vorgänger, keine Zyklen oder Scheinketten. Parallel mögliche Tasks mit separaten Schreibbereichen und geklärten Verträgen planen; gemeinsame Dateien als Integrationspunkt kennzeichnen.
5. **Wiederverwendung absichern.** Nur im Eingabefeld `reuse` ausgewählte Projekte als mögliche Abhängigkeiten einplanen; einen vorgelagerten Lizenz-, Code-, Sicherheits- und Wartungs-Audit/PoC vorsehen. Bei negativem Befund einen spezifikationskonformen Alternativweg ermöglichen. Nicht ausgewählte Treffer nie ungefragt einbauen.
6. **Offene Umsetzung festlegen.** Die Spezifikation ist für die Planung verbindlich, auch ihre als Annahme markierten Standards. Noch offene Implementierungsdetails selbst vernünftig entscheiden, in `decisions` **mit Grund** auflisten und in betroffenen Task-`requirements` verankern. Keine Rückfragen und immer `blockedBy: []`.
7. **Agentenzeit plausibilisieren.** `minutes` als geschätzte Laufzeit eines Coding-Agenten **inklusive** Tests in Dezimalminuten; unabhängig von vorgegebener Zielzeit schätzen. Keine menschlichen Stunden oder automatischen Erfolgsgarantien ableiten.

## Ergebnis

Nur das im Planungs-Prompt verlangte JSON mit `summary`, `decisions` und 1–20 `tasks`; vorgegebenes Task-Schema unverändert. Beispiel-Abnahme: „T02 ist akzeptiert, wenn FR-003 im Erfolgs- und Fehlerfall automatisiert geprüft wird“; die IDs sind illustrativ.

## Qualitätsprüfung

Jede vorhandene Anforderung abgedeckt, jede Task-ID eindeutig, jede Referenz real, DAG zyklenfrei? Jedes Paket hat Liefergegenstand, Abnahme und Tests? Gibt es einen Integrations-/Regressionstest und keine verdeckte Scope-Erweiterung? Sind `blockedBy` leer, alle eigenen Entscheidungen dokumentiert und die Zeitwerte nachvollziehbar?
