---
name: reuse-discovery
description: Ermittle und bewerte wiederverwendbare Open-Source-Repositories ausschließlich anhand realer GitHub-Treffer.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt two-stage GitHub repository search and ranking
---
# Open-Source-Wiederverwendung recherchieren

SpecIt-spezifische Erweiterung des Spec-first-Gedankens von GitHub Spec Kit. **Zwei getrennte KI-Aufrufe**: zuerst Suchbegriffe ohne Rechercheergebnis, dann Ranking ausschließlich aus serverseitig gefundenen GitHub-Repositories. In der Planungsphase gilt dieser Skill nicht; dort ist bereits durch den Nutzer ausgewählte Wiederverwendung Kontext.

## Ablauf

1. **Kernfunktionen identifizieren.** Aus `spec` Produktart, Nutzerabläufe, Plattform, echte Integrationspunkte, Nicht-Ziele und relevante FR-/NFR-IDs entnehmen.
2. **Suchbegriffe vorschlagen (Aufruf 1).** Zwei bis drei kurze, englische Suchanfragen mit höchstens drei aussagekräftigen Wörtern; einmal vollständige Anwendung, einmal wesentliche technische Komponente. Noch **keine** Treffer, URLs oder Bewertungen erfinden. Das Ergebnis entspricht `{"queries":[...]}`.
3. **Belege lesen (Aufruf 2).** Nur die unter `candidates` gelieferten Metadaten bewerten. Exakte `url`, Lizenzkennzeichen, letzte Aktivität und Beschreibung verwenden; eine Beschreibung ist noch kein Code- oder Funktionsnachweis.
4. **Abdeckung und Optionen unterscheiden.** Für jeden Kandidaten konkrete Kernfunktion oder bestehende Anforderungs-ID nennen. Trenne Ersatz der Gesamtanwendung, Bibliotheksintegration und bloße Architektur-Referenz.
5. **Eignung abwägen.** Lizenz einschließlich möglicher Pflichten, Wartungs-/Sicherheitsrisiken, Plattformpassung, Integrationskosten, Abhängigkeiten und Scope-Mismatch benennen. Unbekannte, restriktive oder unpassende Lizenz nicht sofort zur Integration empfehlen.
6. **Kleine Shortlist priorisieren.** Höchstens sechs unterschiedliche Kandidaten; `einbeziehen` nur bei plausibler Eignung, `prüfen` bei offenen technischen oder rechtlichen Fragen, sonst `nicht einbeziehen`. Zu jedem realen Kandidaten offenlegen, was vor Übernahme noch im Code, in Tests und in Lizenzhinweisen geprüft werden muss.
7. **Auswahlgrenze respektieren.** Eine Empfehlung ist keine Genehmigung. Erst die ausdrücklich vom Nutzer ausgewählten Kandidaten dürfen bei der späteren Planung als zu auditierende Integrationsoptionen eingehen. Bei fehlenden Treffern oder Netzfehlern nie behaupten, eine Neuentwicklung sei nachweislich erforderlich.

## Ergebnis

Beim ersten Aufruf ausschließlich Such-JSON; beim zweiten das vorgegebene `projects`-JSON mit `url`, `decision`, `functions`, `reason` und `risks`. Keine Links außerhalb der Kandidatenliste, keine zusätzlichen JSON-Felder.

## Qualitätsprüfung

Sind alle URLs exakt aus `candidates` und alle ID-Bezüge real? Werden Metadaten nicht als verifizierte Implementierung verkauft? Ist Lizenz-/Sicherheitsprüfung von der finalen Nutzerentscheidung getrennt? Sind Scheinrecherche und Halluzination bei Ausfällen ausgeschlossen?
