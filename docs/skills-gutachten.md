# Gutachten zur Skill-Architektur von SpecIt

**Stichtag:** 22. November 2026  
**Prüfgegenstand:** Repository `ccogit/SpecIt`, Ausgangsstand `506204b7ab1a3b08ef277f95e2dbf75933976616` (`main`)  
**Zweck:** Prüfung von Relevanz, Vollständigkeit, Qualität und *tatsächlicher Anwendung* der Skill-Definitionen; Umsetzung aller daraus abgeleiteten Verbesserungen im vorliegenden Pull Request.

## 1. Prüfauftrag und Methode

Untersucht wurden `skills/*/SKILL.md`, `skills.mjs`, die Prompt-Aufrufe in `server.mjs`, die Spezifikationsbausteine `blocks.mjs`, Feature-Aufbereitung in `interview.mjs`, GitHub-Wiederverwendung `reuse.mjs`, Task-Aufbereitung in `planner.mjs`, direkte Agentensteuerung in `runner.mjs`, vorhandene Tests und README. Die Prüfung ist ein **Code- und Vertragsaudit**, keine empirische Messung der Qualität mehrerer LLM-Läufe.

Maßstäbe: (a) wiederkehrende und fehleranfällige Aufgabe mit erkennbarem Mehrwert eines Skills, (b) passende Aufrufphase, (c) klare Eingaben und Vorbedingungen, (d) handlungsfähige Schrittfolge, (e) prüfbarer Ausgabe- und Qualitätsvertrag, (f) Vermeidung von Doppelarbeit, Halluzinationen und Sicherheitsrisiken, (g) Anschluss an die tatsächliche Laufzeit.

Die projektinterne Bezeichnung „Skill“ meint eine in den Prompt **eingebettete Arbeitsmethode**, nicht automatisch eine von Claude Code selbst entdeckte Skill-Datei. Diese Unterscheidung ist für die Bewertung ausschlaggebend.

## 2. Gesamturteil zum Ausgangsstand

**Fachliche Auswahl: überwiegend richtig. Operationalisierung: unzureichend.**

Die fünf bestehenden Skills deckten fachlich wichtige Kernarbeiten ab: Discovery, Spezifikation, Wiederverwendungsrecherche, Task-Planung und durchgehende Rückverfolgbarkeit. Sie waren aber überwiegend kurze Soll-/Nicht-Soll-Listen statt durchführbarer Arbeitsverfahren. Besonders schwer wiegt, dass `skills.mjs` nur Analyse- und Planungsaufrufe anreicherte: `runner.mjs` verwendete `renderTask`/`renderSingle` aus `planner.mjs`, deren Ausführungsregeln **keinen Skill-Text enthielten**. Die eigentlichen Coding-Agenten profitierten folglich nicht von den versionierten Skills.

### Befunde, Priorität und Abhilfe

| Nr. | Gewicht | Feststellung im Ausgangsstand | Umgesetzte Abhilfe |
|---|---|---|---|
| B1 | **kritisch** | Kein Skill beim eigentlichen Claude-Code-Agenten; nur generische Stichpunkte in den Aufträgen. | Neuer `implementation`-Skill; Einbettung in Einzel-/Gesamtauftrag und einmal in den exportierten Backlog. Direkter Runner nutzt dieselben Renderer. |
| B2 | **hoch** | Unabhängiges Review über Claude/Codex benutzt `reviewPrompt` ohne Skill; Konzept-Stream analog. | `spec-review` und `concept` eingeführt und in beide konkreten Aufrufpfade verdrahtet. |
| B3 | **hoch** | Features, Aufwand, Abhängigkeiten, `fit` und `extend` werden faktisch allein durch sehr lange Modus-Prompts geführt; kein eigener Arbeitsstandard. | `feature-scoping` ergänzt, unter Beibehaltung der bestehenden JSON-Verträge. |
| B4 | **mittel** | Fünf Skill-Definitionen enthielten meist Ziele/Verbote, aber kaum Schrittfolgen, Beispiele und eindeutige Abschlussprüfungen. | Alle fünf auf Ablauf, Ergebnis, Qualitätsprüfung, Grenzfälle, Herkunft und Anti-Halluzination erweitert. |
| B5 | **mittel** | `traceability` wurde schon bei frühen Fragen und Features aufgerufen, obwohl noch keine FR-IDs existieren; `reuse-discovery` wurde auch beim Plan eingeblendet, obwohl dort keine erneute Suche stattfindet. | Stage-Mapping präzisiert. Traceability ab Spezifikation; Reuse-Skill nur in echter Recherche; Umsetzung erhält eigenen Skill. |
| B6 | **mittel** | Skills konnten trotz knapper oder leerer methodischer Anweisungen formal durchgehen (Name und nichtleerer Body genügten). | Beim Laden Frontmatter-Beschreibung, Mindestinhalt und drei Pflichtabschnitte validieren; neue Tests für Mapping und Prompt-Integration. |
| B7 | **niedrig** | README erwähnte direkte Umsetzung, später aber „keine automatische Agent-Ausführung“; Skill-Tabelle dokumentierte nur die fünf Alt-Skills. | Dokumentation mit Ausführungspfad, Skill-Matrix und Freigabegrenzen korrigiert. |

## 3. Relevanz der einzelnen Skills

| Skill | Bewertung | Begründung und Schnittstelle |
|---|---|---|
| `discovery` | **Behalten, ausbauen** | Wiederkehrende Interviews und Triage; keine FR-IDs vorwegnehmen. |
| `specification` | **Behalten, ausbauen** | Zentrale, komplexe Umwandlung in SPEC.md. Feste Server-Bausteine und `NFR-901+` erfordern Sonderregeln, damit die KI nicht dupliziert. |
| `traceability` | **Behalten, gezielt einsetzen** | Wichtig für Spec-Revision und Task-Coverage; als pauschaler Skill für jede frühe Ausgabe ungeeignet. |
| `execution` | **Behalten, präzisieren** | Erzeugt Plan-JSON, keine echte Dateiumsetzung. Darf nicht mit dem Implementierungs-Skill verwechselt werden. |
| `reuse-discovery` | **Behalten, phasenrein einsetzen** | Tatsächliche GitHub-Suche in zwei KI-Phasen; schützt vor erfundenen Projekten. Im Plan redundant und irreführend. |
| `concept` | **Neu** | Wiederkehrende, vom Nutzer editierbare Konzepttexte samt Markersyntax und inkrementellen Updates. |
| `feature-scoping` | **Neu** | Eigenständige Entscheidungen zu Kernumfang, Paketschnitt, Abhängigkeiten, Zeiten und Budget-Reduktion. |
| `spec-review` | **Neu** | Eigenständige Tätigkeit eines unabhängigen, read-only Reviewers mit begründetem Befundformat. |
| `implementation` | **Neu** | Zentrale, bis dahin unversorgte Tätigkeit der wirklich schreibenden Coding-Agenten. |

**Kein vorhandener Skill ist inhaltlich vollständig überflüssig.** Die Überflüssigkeit lag in *falschen Zuordnungen*, nicht in der Existenz der Dokumente. Bewusst **kein** eigener Skill für Namensvorschläge, Logo-SVG, Wireframe oder Stitch-Layouts: Diese optionalen Kurzvorgänge haben bereits eng begrenzte Spezialprompts, Rendering-/Sanitizing-Regeln und keine vergleichbare wiederkehrende mehrstufige Übergabelogik. Ein weiterer generischer Skill würde aktuell vor allem Kontext vervielfachen. Diese Entscheidung kann bei künftig erweitertem UX-Workflow überprüft werden.

## 4. Soll-Architektur und umgesetzter Aufrufpfad

| Verarbeitungsphase | Skills nach der Überarbeitung | Tatsächliche Einbettung |
|---|---|---|
| Konzept-Stream | `concept` | `server.mjs`: `askStream(withSkills('concept', conceptPrompt) + ...)` |
| Interview: Fragen, Entscheidungen, Triage | `discovery` | `server.mjs`: generische `withSkills(mode, ...)`-Aufrufe |
| Feature-Ermittlung / Fit / Extend | `feature-scoping` | `server.mjs`: vorhandenes `withSkills('features', ...)` |
| SPEC.md / Edit / Anpassung / Scope | `specification`, `traceability` | `server.mjs`: vorhandene `withSkills`-Aufrufe |
| Read-only Review Claude oder Codex | `spec-review`, `traceability` | `server.mjs`: beide Review-Provider erhalten `withSkills('review', reviewPrompt)` |
| Reuse-Suchbegriffe und Kandidatenbewertung | `reuse-discovery` | `server.mjs`: beide `withSkills('reuse', ...)`-Aufrufe |
| Plan-JSON | `execution`, `traceability` | `server.mjs`: `withSkills('plan', ...)` |
| Ausführbare Agentenaufträge | `implementation` | `planner.mjs`: `renderTask`, `renderSingle`; `renderBacklog` nur einmal als übergreifender Skill. `runner.mjs` verwendet diese Renderer bereits. |

**Wesentliche Leitentscheidung:** Fachregeln und Prozesswissen in `SKILL.md`; konkrete Ausgabeformate weiterhin in den spezialisierten Aufruf-Prompts und Server-Validatoren. Dies vermeidet das doppelte Pflegen umfangreicher JSON-Schemas. Jeder Skill legt nun Vorgehen, typische Fehler und eine Abschlusskontrolle fest; er behauptet nicht, externe Werkzeuge zu besitzen.

## 5. Ausführung, Rechte und Qualität

- Die Coding-Agenten sollen zuerst Scope, reale Dateien und Vorgängerergebnisse prüfen; keine fremden Änderungen überschreiben und keine nicht freigegebenen Produktfunktionen bauen.
- Tests gehören zur Abnahme, aber ihre **Ausführung** bleibt von der expliziten Shell-Freigabe im Runner abhängig. Ohne Freigabe wird „nicht ausgeführt“ berichtet, nie ein Erfolg fingiert.
- Open-Source-Kandidaten dürfen erst nach Nutzerwahl, tatsächlicher Code-/Lizenz-/Sicherheitsprüfung eingebaut werden. Die GitHub-Suchergebnisse sind Metadaten, keine Funktionsgarantie.
- Die zentralen FR-/NFR-Verträge bleiben erhalten; `NFR-901` ff. stammen aus `blocks.mjs`. Für importierte Spezifikationen ohne IDs gilt eine fachliche, keine erfundene ID-Rückverfolgbarkeit.
- Bestehende Ausgabe-Schemas, die `blockedBy: []`-Planregel, Maximalzahlen für Fragen/Tasks/Befunde und die Abbruch-/Berechtigungslogik des Runners werden nicht geändert.

## 6. Prüffälle und Abnahme

Die ergänzten Tests in `test/skills.test.mjs` prüfen:

1. Vollständige Stage-Allowlist, richtige Zuordnung und Nicht-Zuordnung (`traceability` nicht in Discovery; `reuse-discovery` nicht im Plan).
2. Die verbindlichen Skill-Abschnitte `Ablauf`, `Ergebnis` und `Qualitätsprüfung`, nichtleere Beschreibung und Mindestinhalt.
3. Einbettung des Coding-Skills im Einzelauftrag, Gesamtauftrag und **nur einmal** im exportierten Backlog.
4. Tatsächliche Verknüpfung des Konzept- und beider Review-Aufrufe.
5. Bestehende Traceability-Tests auf bekannte, unbekannte und fehlende IDs.

Ein zusätzlicher GitHub-Actions-Workflow führt `npm test` unter Node.js 22 bei Pull Requests und Pushes aus. **Grenze:** Ein statischer Test und eine erfolgreiche CI beweisen die Verdrahtung und Struktur, aber nicht automatisch bessere LLM-Resultate. Für den betrieblichen Wirksamkeitsnachweis sind anschließend reale Probeprojekte mit identischer Eingabe vor/nach der Änderung sinnvoll: Interview-Duplikate, Spezifikationslücken, unzugeordnete Anforderungen, valide Plan-JSONs, fehlerfreie Task-Ausführung und ehrliche Testberichte vergleichen. Diese Live-Evaluierung benötigt Claude/Codex und gegebenenfalls Gebühren und ist kein Bestandteil des automatisierten Tests.

## 7. Schlussfolgerung

Der Ausgangsbestand war fachlich plausibel, aber zu knapp und – an der wichtigsten Stelle, der Coding-Agent-Ausführung – wirkungslos. Mit der vorliegenden Änderung sind alle identifizierten **strukturellen und dokumentarischen** Mängel adressiert: vollständige Abdeckung der relevanten Kernphasen, klare Phasentrennung, ausführbare Verfahrensanleitungen, nachweisbare Prompt-Verbindung und automatisierbare Vertragsprüfungen. Die Wirkung auf Modellqualität bleibt methodisch von der technischen Korrektheit zu unterscheiden und muss mit echten Durchläufen gemessen werden.
