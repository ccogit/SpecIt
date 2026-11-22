---
name: spec-review
description: Prüfe SPEC.md unabhängig auf Widersprüche, Lücken, Nichtprüfbarkeit und Umsetzungsrisiken.
adaptation: SpecIt read-only Claude or Codex review JSON
---
# Unabhängige Spezifikationsprüfung

Gilt ausschließlich für den read-only Review vor der Umsetzung. Unabhängigkeit bedeutet: keine Annahme, dass der Text schon korrekt ist, aber auch keine erfundenen Projektvorgaben. Das Ergebnis dient als Änderungsangebot, nicht als automatische Neuspezifikation.

## Ablauf

1. **Anforderungslandkarte lesen.** Ziel, Nutzer/Rollen, FR-/NFR-IDs, Kernabläufe, Nicht-Ziele, festgelegte Annahmen, offene Entscheidungen und Zielzeit erfassen. Keine externen Werkzeuge oder Repository-Daten unterstellen.
2. **Widersprüche prüfen.** Vergleiche je Feature Verhalten mit Rollenrechten, UI, Datenlebenszyklus, Schnittstellen, Akzeptanz und Nicht-Zielen; suche gegensätzliche Aussagen und doppelte Anforderungen.
3. **Umsetzbarkeit prüfen.** Finde fehlende Vor-/Nachbedingungen, nicht definierte Begriffe, unbehandelte Leer-/Fehlerfälle, unbelegte technische Voraussetzungen sowie Details, die ein Coding-Agent sonst erfinden müsste.
4. **Prüfbarkeit prüfen.** Kennzeichne unmessbare Anforderungen, unklare Akzeptanzkriterien und nicht referenzierte ID-Beziehungen. Unterscheide echte Lücken von bewusst offenen Entscheidungen und festen SpecIt-Standards `NFR-901` ff.
5. **Aufwand gegen Zielzeit abgleichen.** Nenne konkrete Scope-Kollisionen mit `targetDuration`, sofern diese vorliegt. Keine scheinpräzisen Kosten- oder Laufzeitprognosen.
6. **Befunde priorisieren.** `hoch`: blockiert Kernablauf, Sicherheit oder belastbare Umsetzung; `mittel`: relevante Unschärfe/Lücke; `niedrig`: begrenzte Verbesserung. Höchstens zehn unabhängige, belegbare Befunde, schwerwiegendste zuerst.
7. **Einarbeitbare Korrektur anbieten.** Für jeden Befund `section` als wirklich existierenden Abschnitt benennen, `issue` auf die belegte Schwäche begrenzen und `suggestion` als konkrete Änderung des Spezifikationstextes formulieren, nicht als pauschale Aufforderung zu prüfen.

## Ergebnis

Ausschließlich das vorgegebene JSON `{"summary":"...","findings":[{"severity":"hoch","section":"...","issue":"...","suggestion":"..."}]}`. `severity` darf ausschließlich `hoch`, `mittel` oder `niedrig` sein. Bei keinen belastbaren Befunden leere Liste liefern. Kein Code, keine ergänzenden Felder und keine Änderungen am Originaldokument.

## Qualitätsprüfung

Ist jeder Befund am Text verortbar und hat er eine praktikable Korrektur? Werden Nicht-Ziele, gewollte Standards und offene Entscheidungen nicht fälschlich als Fehler gemeldet? Sind Priorität und Anzahl angemessen? Ist die Antwort ohne Fremdbehauptungen und schema-konform?
