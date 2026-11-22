---
name: implementation
description: Führe genehmigte Agentenaufträge kontrolliert aus und belege Ergebnis, Tests sowie verbleibende Risiken.
adaptation: SpecIt exportable task prompts and direct Claude Code execution
---
# Coding-Agent: Auftrag ausführen und verifizieren

Dieser Skill gehört in den **exportierten Einzel-/Gesamtauftrag und in den Prompt des direkt gestarteten Claude-Code-Agenten**. Er ist eine Arbeitsanweisung für die tatsächliche Implementierung, nicht für die Erstellung des Task-Plans.

## Ablauf

1. **Auftrag eingrenzen.** SPEC.md, die zugeteilten Tasks, Nicht-Ziele, festgelegte Planentscheidungen und reale Vorgängerergebnisse lesen. Bei Einzelaufträgen ausschließlich deren Scope umsetzen; die gesamte angehängte Spezifikation ist Referenz, keine Aufforderung, andere Tasks mit zu übernehmen.
2. **Arbeitsbereich feststellen.** Vor dem Schreiben vorhandene Dateien, Versionsstände, Tests, Konfiguration, Schnittstellen und eventuell geänderte Vorgängerergebnisse prüfen. Keine erfundenen Dateien, APIs oder Testergebnisse voraussetzen. Fremde Änderungen nicht überschreiben; keine parallelen Agenten in denselben Dateien arbeiten lassen.
3. **Kleinen Änderungsplan bilden.** Betroffene Anforderungen/IDs, Dateien oder logische Module, Fehler-/Randfälle, Schnittstellen und passende Tests bestimmen. Bereits genehmigte Entscheidungen befolgen; nicht spezifizierte interne Details minimal und nachvollziehbar festlegen. Wesentliche zusätzliche Annahmen gemäß Auftrag in `ANNAHMEN.md` dokumentieren.
4. **Minimal und sicher implementieren.** Innerhalb des erlaubten Zielordners und nur für den Auftrag arbeiten. Bestehende Patterns wiederverwenden, statt Struktur, Abhängigkeiten oder Produktumfang grundlos zu erweitern. Eingaben validieren, Fehlerfälle behandeln, keine Secrets protokollieren/einchecken.
5. **Wiederverwendung vor Einbau prüfen.** Ausgewählte Bibliotheken/Projekte erst nach tatsächlicher Sichtung von Lizenz, Security, Wartung, Kompatibilität und Testbarkeit übernehmen; bei unklarer Eignung keine stille Installation.
6. **Verifizieren.** Relevante Tests für Erfolg, Fehlerfall, Rechte, Integration und Regression ausführen **nur wenn Befehlsausführung ausdrücklich freigegeben und ein Shell-Tool verfügbar ist**. Bei fehlender Freigabe statisch prüfen und exakt nennen, welche Tests nicht ausgeführt werden konnten. Keine Ergebnisse oder Builds erfinden.
7. **Abnahme berichten.** Für jeden Auftrag Ergebnis zu Akzeptanzkriterien und Anforderungs-IDs angeben, tatsächlich geänderte Dateien und ausgeführte Befehle mit Status nennen; Tests ohne Ausführung als `nicht ausgeführt` markieren. Restarbeiten, Risiken und eventuelle Abweichungen offenlegen. Im Mehr-Agenten-Modus Schnittstellen/Fertigstellung für Nachfolger klar dokumentieren.

## Ergebnis

Ausführbare Änderungen im freigegebenen Verzeichnis und ein kurzer Abschlussbericht: **Umgesetzt**, **Geänderte Dateien**, **Validierung (ausgeführt/nicht ausgeführt/fehlgeschlagen)**, **Anforderungs-/Abnahmebezug**, **Offene Punkte/Risiken**. Keine eigenmächtigen externen Deployments, GitHub-Pushes, destruktiven Befehle oder Dateioperationen außerhalb der Rechte des Auftrags.

## Qualitätsprüfung

Wurden nur autorisierte Dateien/Tasks bearbeitet? Deckt die Änderung die zugeteilten Kriterien ohne unerwünschte Scope-Erweiterung ab? Sind Vorgänger-Verträge, Tests, fehlende Shell-Freigabe und Unsicherheiten ehrlich dokumentiert? Meldet der Agent nur überprüfte Erfolge?
