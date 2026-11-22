# SpecIt: Audit und priorisierte Optimierungs-Roadmap

Stand: 22.11.2026 · Quelle: `main` in `ccogit/SpecIt` · Arbeitsbranch: `improve/quality-streaming-ui-20261122`

## Ziel und Leitplanken

Die Anwendung soll **robuster, verständlicher und wartbarer** werden, ohne den lokalen Betrieb, das aktuelle Nutzerkonzept oder die Abhängungsfreiheit aufzugeben. Die erste Etappe korrigiert nachweisbare Inkonsistenzen und schützt Arbeitsergebnisse. Größere Umstellungen folgen erst mit Browser-Regressionsprüfungen.

Dieses Audit basiert auf einer detaillierten statischen Prüfung von Server, Browseranwendung, Interview- und Spezifikationslogik, Planer, Agenten-Runner, Streaming, Export, Stitch, GitHub-Reuse sowie Test- und CI-Konfiguration. **Nicht** behauptet wird, dass eine vollständige visuelle Browserprüfung oder eine Ende-zu-Ende-Generierung mit kostenpflichtigen KI-Diensten bereits stattgefunden hat.

## 1. Architektur und durchgehender Nutzerablauf

| Abschnitt | Beteiligte Module | Bestehende Stärken | Prüfschwerpunkt |
| --- | --- | --- | --- |
| Lokaler Start und API | `server.mjs`, `start-windows.cmd` | Node 22, keine npm-Laufzeitabhängigkeiten; Host-/Origin-Prüfung; Request-Größenlimit; CSP | Prozesslebensdauer, Abbrüche, Status, Fehlerkodierung |
| Idee und Festlegungen | `interview.mjs`, `public/index.html` | Stufige Autonomie, Demo-Modus, Fragen, Standards und eigene Anforderungen | Invalidierung alter Daten, robuste Abhängigkeiten |
| Konzept und Spezifikation | `blocks.mjs`, `entries.mjs`, `markdown.mjs`, `spec-parallel.mjs`, `spec-preload.mjs` | Kapitelweise Änderungen, nachvollziehbare Struktur, Teil-Generierung, Rendering ohne `innerHTML` | Unvollständige Antworten, Streaming und Veralterung |
| Anbieter/Strategien | `chat-backends.mjs`, `anthropic-cache.mjs`, `ai-performance.mjs`, `spec-strategies.mjs` | Claude-API, Claude Code, experimentelle GPU-Strategie, Modell-/Laufzeitmessung | Qualitätsgates, Fallbacks, Preload-Kosten |
| Planung | `planner.mjs`, `traceability.mjs` | DAG-Validierung der Tasks, Traceability, geschätzte Laufzeiten und Parallelität | Lücken, blockierte Aufgaben, Schätzunsicherheit |
| Umsetzung | `runner.mjs`, `artifacts.mjs`, `zip.mjs` | Getrennte Zielverzeichnisse, Agentenbegrenzung, Live-Status und ZIP | Pfadgrenzen, sensible Exportdaten, große Spezifikationen |
| Externe Ergänzungen | `stitch.mjs`, `reuse.mjs` | Stitch-Designvarianten und evidenzbasierte GitHub-Kandidaten mit Lizenzprüfung | klare Datenübermittlung, Fehler-/Zeitlimit-Verhalten |
| Browserzustand | `public/index.html` | lokal gespeicherter Arbeitsstand, Dark/Light, Fortschritt und Rückgängig | konsistente Zustandswechsel, Wiederherstellung, UI-Leistung |

**Zentrale Architekturbeobachtung:** Der Browser verwaltet nahezu alle Screens, Ereignisse, UI-Details und Datenmutationen in einer großen HTML-Datei. Sie enthält mehrere Generationen der Layoutregeln. Das funktioniert ohne Build-Kette, erhöht aber das Risiko, dass eine lokale CSS- oder State-Änderung unbemerkt andere Bereiche beeinflusst.

## 2. Funktionale Befunde

### P0 – Direkte Umsetzung blockiert gültige Spezifikationen

- **Nachweis:** `server.mjs` akzeptierte Spezifikationen mit bis zu **150.000 Zeichen**. `runner.mjs:validateRun` akzeptierte nur **50.000**.
- **Folge:** Ein fertig erstelltes Dokument konnte im anschließenden Agenten-Schritt allein aufgrund seiner Länge abgelehnt werden.
- **Maßnahme:** Gemeinsame Konstante `MAX_SPEC_CHARS` für die API und den Runner, Regression an beiden Grenzwerten.
- **Status:** **Implementiert** (erste Etappe).

### P1 – Nicht einheitliche Datenstromverarbeitung

- **Nachweis:** `public/index.html` enthielt drei eigene NDJSON-Leseschleifen für Spezifikation, Konzept und Skizze.
- **Risiko:** Eine letzte Antwortzeile ohne Zeilenumbruch fiel weg; Fehler- und Abbruchverhalten können auseinanderlaufen.
- **Maßnahme:** Gemeinsames `ndjson.mjs` mit korrektem `TextDecoder`-Flush, Unterstützung für fragmentierte UTF-8-Zeichen, letzter Zeile ohne Newline, kontrollierter Größenbegrenzung und Stream-Abbruch bei Fehlern.
- **Status:** **Implementiert**, Browser-Integration der drei Aufrufstellen erfolgt; mit Node-Tests abgesichert.

### P1 – Feature-DAG nicht konsistent

- **Nachweis:** `interview.mjs:cleanFeatures` entfernte ungültige oder eigene Referenzen, aber keine mehrstufigen Zyklen. `workPackages` löste den Zyklus erst bei der Terminplanung stillschweigend auf.
- **Folge:** Sichtbarer Feature-Katalog und tatsächlich geschätzte Abhängigkeitsstruktur konnten auseinanderfallen. Zudem wurden Abhängigkeiten von Kernfunktionen zu Erweiterungen nicht ausgeschlossen.
- **Maßnahme:** Deterministische, azyklische Normalisierung bereits beim Einlesen der Feature-Liste; Kernfunktionen hängen nur von Kernfunktionen ab.
- **Status:** **Implementiert**, Tests für mehrgliedrige Zyklen ergänzt.

### P1 – Zielordner bei symbolischen Links nur lexikalisch geprüft

- **Nachweis:** `runner.mjs:targetDir` überprüfte den geschriebenen Pfad, nicht den durch symbolische Links tatsächlich referenzierten Ordner.
- **Risiko:** Ein als Projektordner gewählter Link könnte auf den SpecIt-Quellordner verweisen, obwohl die Textprüfung greift.
- **Maßnahme:** Realpath-Prüfung direkt vor Agenten-Schreibzugriff, Ordneröffnung und ZIP-Export.
- **Status:** **Implementiert**, Symlink-Test ergänzt.

### P1 – ZIP-Export enthielt potenziell Zugangsdaten

- **Nachweis:** `zip.mjs:collect` ignorierte `.git` und `node_modules`, nicht aber `.env` und entsprechende Laufzeitvarianten.
- **Risiko:** Beim Teilen eines Ergebnis-ZIPs könnten lokale Geheimnisse versehentlich weitergegeben werden.
- **Maßnahme:** `.env` und nicht als Vorlage gekennzeichnete `.env.*`-Dateien ausschließen. `.env.example`, `.env.sample` und `.env.template` bleiben erhalten. Build-/Cache-Ordner ebenfalls ausschließen.
- **Status:** **Implementiert** mit Archivtest.
- **Restrisiko:** Weitere frei benannte Geheimdateien können nicht allein durch Dateinamen sicher erkannt werden. Vor externer Weitergabe bleibt eine ZIP-Inhaltsprüfung sinnvoll.

### P1 – Rückgängig-Zeitraum widersprach der Dokumentation

- **Nachweis:** README nennt 20 Sekunden, der Reset-Handler verwendete 5.000 ms.
- **Maßnahme:** Frist auf 20.000 ms angepasst.
- **Status:** **Implementiert**.

### P1 – Asynchroner Zustand und Abbruch

- **Nachweis:** Mehrere asynchrone Flows ändern `s`, während Revisionen, `busy`, `aborter`, `conceptJob`, `preloadTask` und `sketchAuto` verschiedene Sperren nutzen. `generate()` prüft eine `revision`; andere Abläufe prüfen zum Teil nur Input-Schlüssel.
- **Risiko:** Seltene Zustandsrennen nach Reset, Wechseln von KI-Modi oder raschen Änderungen; einige Fehler werden beim Konzept lediglich über eine Pause abgefedert.
- **Empfehlung:** Einheitliche Operations-ID je Dokumentversion; beim Reset alle Hintergrundoperationen explizit abbrechen; Antworten nur auf den passenden Input-Hash anwenden. Alle Änderungen durch automatisierte Race-Tests prüfen.
- **Status:** **Offen, Etappe 2**; nicht ohne Browser-Regression isoliert ändern.

### P1 – Fehlertransparenz bei Fremddiensten

- **Nachweis:** API/CLI, GitHub-Reuse und Stitch haben unterschiedliche Fehler- und Timeoutpfade; einige UI-Funktionen zeigen Fehler nur als generischen Status oder verzögern erneute Versuche.
- **Empfehlung:** Einheitliches Fehlerformat mit verständlichem Handlungsangebot (Netzwerk / Kontingent / ungültiges Modell / Abbruch / unvollständige Antwort); vorhandene Statuszeile nutzen, kein neues komplexes Meldesystem.
- **Status:** **Offen, Etappe 2**.

### P2 – Konsistenz und Qualität von generierten Inhalten

- **Nachweis:** Der GPU-Backend-Validator prüft Kapitelstruktur und FR-Kennungen, aber ausdrücklich keine semantische Qualität; mehrere experimentelle Generierungsstrategien sind wählbar.
- **Empfehlung:** Nach Generierung unabhängig vom Modell einen günstigen, deterministischen Check für doppelte FR-IDs, fehlende Akzeptanzkriterien, unaufgelöste Entscheidungen und fehlende Task-Zuordnung anzeigen. Ein bestehendes Review soll nicht doppelt implementiert werden.
- **Status:** **Offen, Etappe 4**.

## 3. UI/UX- und Gestaltungsbefunde

### P1 – Konkurrierende Layoutregeln

- **Nachweis:** `public/index.html` definiert das Spaltenlayout mehrfach: zunächst Dokument links / Einstellungen rechts, später eine andere Desktop-Aufteilung mit umgekehrter Reihenfolge; `.specwrap` wechselt von Flex zu `display:grid!important` und verwendet `display:contents!important`. Spätere Regeln ordnen die Gliederung erneut um.
- **Folge:** Änderungen an einer frühen Regel können durch spätere Overrides wirkungslos werden; die Darstellung unterhalb des Desktop-Breakpoints ist schwierig zu warten.
- **Maßnahme:** Erste responsive Korrektur unter 1181 px: Dokument und Gliederung in einen einfachen Flex-Flow überführen; Kapitel als horizontal scrollbare Navigation; kompakter Header und einspaltige Review-Aktionen auf Smartphones.
- **Status:** **Erste Korrektur implementiert**, visuelle Prüfung bei 360/390/768/1024/1440 px offen.
- **Folgearbeit:** Nach Screenshots verwaiste Desktop-Regeln und frühere Layoutvarianten entfernen, `!important`-Einsatz reduzieren.

### P1 – Informationsarchitektur und progressive Offenlegung

- **Beobachtung:** Sehr viele Parameter sind relevant, aber nicht alle in jeder Projektphase. Bereits vorhanden ist ein Schalter zum Einblenden der Einstellungen; dies ist eine gute Grundlage.
- **Empfehlung:** Nur eine Hauptaktion pro Phase sichtbar betonen; den aktuellen Dokumentstatus (Entwurf, vollständig, veraltet, umgesetzt) nahe der Hauptaktion bündeln. Expertenstrategien (`parallel`, `turbo`, `gpu`) als erweiterte Optionen kenntlich machen.
- **Nutzen:** Weniger kognitive Last, ohne Funktionen zu entfernen.
- **Status:** **Offen, Etappe 2**.

### P1 – Mobile Bedienbarkeit und Scrollmodell

- **Beobachtung:** Die App setzt `body.fitview` mit `overflow:hidden` und verschachtelten Scrollcontainern ein. Auf kleinen Displays sind bei breiten Tabellen, offenen Panels und Toolbars Überläufe möglich.
- **Empfehlung:** Aktive Scrollfläche je Gerätegröße klar definieren; konsistente Mindest-Tap-Ziele, Fokusreihenfolge und keine horizontalen Überläufe mit Ausnahme bewusst scrollbarer Tabellen/Gliederung. Änderungen manuell und mit automatisierten Viewport-Tests prüfen.
- **Status:** **Teilweise implementiert** (Spalten/Toolbar), Rest offen.

### P1 – Barrierefreiheit und Feedback

- **Stärken:** Sichtbare Fokusmarkierungen, Textalternativen, `aria-live`-Status, `prefers-reduced-motion`, beschriftete Eingaben und reale `button`-Elemente sind vielfach vorhanden.
- **Prüfpunkte:** Kontrast besonders bei `.meta`, `.eyebrow` und Warnfarben; Tastaturbedienung modaler Overlays; Fokus-Rückkehr nach Schließen; Screenreader-Meldungen beim Streaming nicht zu häufig ausgeben.
- **Status:** **Offen, Etappe 2**. WCAG-Konformität wird ohne Browser-/AT-Test nicht behauptet.

### P2 – Visuelle Konsistenz und Performance

- **Beobachtung:** Sehr kleine Labels und zahlreiche Chip-/Puls-/Farbstufen konkurrieren mit dem eigentlichen Dokument. Beim Streaming wird der wachsende Markdown-Text wiederholt komplett gerendert; `renderAll()` und `save()` sind häufig miteinander gekoppelt.
- **Empfehlung:** Ein Token-Set für Typografie, Abstände, Touch-Ziele und Statusfarben; Animationen nur für echte laufende Aktionen. Markdown-Rendering bei langen Dokumenten messbar drosseln, ohne die Live-Wirkung zu verlieren. Speicherzugriffe debouncen, aber vor `pagehide` zuverlässig sichern.
- **Status:** **Offen, Etappe 3**.

## 4. Architektur-Empfehlung ohne Frameworkwechsel

1. **CSS entkoppeln:** Aktuelles Stylesheet aufteilen in Tokens/Basis, Layout, Komponenten, responsive Regeln und Print; erst nach visuellen Vergleichstests verwaiste Selektoren löschen.
2. **JavaScript schrittweise modularisieren:** Zuerst Netzwerk/Streaming (bereits geschehen), danach persistierten Zustand, Generation/Abbruch und jeweils einen UI-Bereich (z. B. Spezifikationseditor).
3. **Zustandsänderungen explizit machen:** Selektoren für `stale`, `ready`, `dirty`, Feature-Auswahl und aktuelle Phase als reine Funktionen testen. Nicht mehrere unabhängige Bedingungen an unterschiedlichen UI-Stellen nachbauen.
4. **Serverrouten vorsichtig abtrennen:** Validierung, API-Handler und laufende Hintergrundjobs trennen, ohne die lokalen Sicherheitsgrenzen und die Null-Abhängigkeiten-Strategie aufzugeben.
5. **CI fokussieren:** Doppelte Node-Test-Workflows konsolidieren; Syntaxprüfungen auf alle neu extrahierten Module ausweiten; später Browser-Smoke-Tests separat aufnehmen.

**Nicht empfohlen:** Unmittelbarer Wechsel auf React/Vue, vollständige Neugestaltung, umfangreiche neue Persistenzschicht oder ein komplexes Plugin-System. Dies würde die Wartungskosten zunächst erhöhen, ohne aktuelle Nutzerprobleme sicher zu lösen.

## 5. Nützliche kleine Ergänzungen

| Vorschlag | Wirkung | Aufwand/Priorität |
| --- | --- | --- |
| Arbeitssitzung als JSON exportieren/importieren | Schutz vor versehentlichem Datenverlust; erleichtert Gerätewechsel | P1, nach Datenvalidierung |
| Bestätigter Zustand vor Agentenlauf | Zielordner, Agentenzahl, Shell-Berechtigung und erwartete Dateien an einer Stelle prüfen | P1, wenig UI |
| Klarere Ergebnisübersicht | „Spezifikation aktuell“, „Plan aktuell“, „Umsetzung vollständig/teilweise/fehlgeschlagen“ | P1, bestehende Statusdaten |
| Prüfliste für FR-/NFR-Abdeckung | Nachvollziehbarere Qualität ohne teuren zusätzlichen KI-Aufruf | P2 |
| Kompakte Änderungsübersicht | Zeigt zwischen Spezifikationsversionen nur tatsächlich geänderte Kapitel/Einträge | P2, bestehende Diff-Logik nutzen |
| ZIP-Inhaltsliste vor dem Download | Erleichtert Prüfung auf Dateien, die nicht geteilt werden sollen | P2 |

## 6. Realistischer Umsetzungsplan

| Etappe | Arbeitspaket | Abnahmekriterium | Stand |
| --- | --- | --- | --- |
| 1 | Einheitliche Spezifikationsgrenze | Runner akzeptiert 150.000, verwirft 150.001 Zeichen | Implementiert + Unit-Test |
| 1 | Gemeinsamer NDJSON-Reader | Gesplittete Unicode-Zeichen, unvollständige Schlusszeile und Fehler korrekt verarbeitet | Implementiert + Unit-Tests |
| 1 | Azyklische Feature-Abhängigkeiten | Jeder normalisierte Featuregraph ist DAG; Kern hängt nicht von Extra ab | Implementiert + Unit-Test |
| 1 | Sichere Projektpfade und Archive | Symlink ins Repo zurückgewiesen; `.env` nicht im ZIP | Implementiert + Tests |
| 1 | Undo-Frist und mobile Grundstruktur | Undo 20 s; schmale Viewports verwenden einspaltigen Dokumentfluss | Implementiert, Browserprüfung offen |
| 2 | Automatisierte Browser-Smoke-Tests | Idee → Demo → Spezifikation → Plan; Reset/Undo; Dark/Light; Desktop/Mobil | Offen |
| 2 | Race- und Abbruchbehandlung | Reset/Abbruch führen nicht zu späteren unerwünschten Zustandsänderungen | Offen |
| 2 | Klare UX und Barrierefreiheit | Fokus, Dialoge, Lesbarkeit, Statusfeedback nach Prüfkatalog | Offen |
| 3 | CSS-/JS-Modularisierung | Verhalten unverändert, gleiche Screenshots an Referenzbreiten | Offen |
| 3 | Performance & Persistenz | Lange Dokumente ohne spürbare Tipp-/Scroll-Verzögerung; keine Datenverluste | Offen |
| 4 | Kleine Ergänzungen nach Nutzungstest | Ergänzungen sparen nachweislich Arbeit, ohne neue Pflichtschritte zu schaffen | Offen |

## 7. Verifikation und verbleibende Risiken

- **Automatisierte Tests:** `npm test` (Node.js 22), `node --check server.mjs`. Die erste Etappe hat zusätzlich Fälle für Runner-Grenzen, symbolische Links, NDJSON, ZIP-Datenschutz und Feature-DAGs.
- **UI-Smoke-Matrix:** 360, 390, 768, 1024, 1440 px; Light/Dark; Tastatur; reduzierter Bewegungsmodus; Print/PDF. Hauptabläufe mindestens einmal im Demo-Modus.
- **Externe Integrationen:** Claude-API/Claude Code, Stitch, lokale GPU und GitHub-Recherche jeweils mit Erfolg, Abbruch, Timeout, ungültigem Schlüssel und nicht verfügbarem Dienst testen.
- **Operatives Risiko:** Ohne vollständige Browser-/Integrationstests sind die CSS-Änderungen nur strukturell geprüft. Ein separater Review-Schritt vor dem Merge ist daher sinnvoll.
- **Sicherheitsgrenze:** SpecIt bleibt ein lokaler Prozess. Die vorhandenen Host-/Origin-Prüfungen, CSP-Regeln und die serverseitige Verwaltung externer API-Schlüssel bleiben unverändert.

**Merge-Empfehlung:** Erst nach erfolgreichen CI-Tests und einem kurzen visuellen Smoke-Test, insbesondere für die neu definierte Dokumenten-Gliederung auf Mobilgeräten. Weitere größere Refactorings sollten in getrennten Pull Requests erfolgen.

## 8. Umsetzung Etappe 2 – robuste Zustände und modulare Oberfläche

**Erweiterung des Draft-PR #11 (22.11.2026).** Der erste Satz von Regressionstests und die nachfolgenden Browser-/Server-Änderungen sind implementiert.

- **Sitzungsgültigkeit:** `work-session.mjs` stellt einen Abbruchcontroller und eine inkrementelle Sitzungs-ID bereit. Beim Zurücksetzen werden laufende Anfragecontroller, Concept-/Skizzen-Aufgaben, Preloading, Diagramme, Hintergrund-Feature-Suche, Layouts und deren Wiederholungswartezeiten abgebrochen. Späte Ergebnisse werden über Sitzungs-ID und Lock-ID verworfen.
- **Foreground-Locks:** Für aktive KI-Arbeiten gibt `lock(true)` eine eindeutige ID zurück. Ein veraltetes `finally` darf einen später gestarteten Vorgang nicht entsperren. Rückmeldungen aus alten Sitzungen werden nicht in den neuen Arbeitsstand geschrieben.
- **Agenten-Sicherheit:** Ein Reset während eines gestarteten oder laufenden Agentenlaufs wird nicht stillschweigend ausgeführt. Die Umsetzung muss zunächst beendet werden, damit keine weiterlaufenden Schreiboperationen unbeobachtet bleiben.
- **Stitch-Anfragen:** Browser-Verbindungsabbrüche brechen den Serveraufruf, HTTP-Anfragen und Polling-Wartezeiten ab. Die Serverseitige Konkurrenzsperre wird erst freigegeben, wenn die laufende Funktion tatsächlich endet. Eine leere Stitch-Bildschirmliste liefert eine nachvollziehbare Fehlermeldung.
- **Frontend-Modularisierung:** `public/index.html` enthält die Semantik; `public/app.mjs` die Browserlogik; `public/base.css` die Hauptstyles und `public/responsive.css` die Mobil-/Tablet-Regeln. Bestehende ES-Modulimporte bleiben erhalten. Kein Bundler und kein neues npm-Paket erforderlich.
- **Mobile Bedienung:** Inputs erscheinen in der mobilen Lesereihenfolge vor der Dokumentenansicht, die Kapitel werden horizontal navigierbar und „Abbrechen“ wird auch bei schmaler Kopfzeile angezeigt. Kompakte Icons besitzen zugängliche Beschriftungen.
- **Qualitätssicherung:** Zusätzliche Node-Tests für Sitzungsabbruch, ausstehende Wiederholungsversuche, Stitch-Abbruch und statische Frontend-Verträge; ein HTTP-Integrationstest prüft die tatsächliche Auslieferung der ausgelagerten CSS- und JavaScript-Dateien.

**Noch nicht abgeschlossen:** Eine visuelle Prüfung mit echtem Browser bei definierten Viewportgrößen (360/390/768/1024/1440 px), Screenreader-/Tastaturtest der Dialoge sowie reale Ende-zu-Ende-Läufe von Claude Code, Google Stitch und lokaler GPU sind weiterhin Voraussetzung vor einem produktiven Merge. Die anschließende Feinkonsolidierung der bisherigen CSS-Regeln kann dann anhand tatsächlicher visueller Referenzen erfolgen.
