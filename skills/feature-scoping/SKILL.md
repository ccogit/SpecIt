---
name: feature-scoping
description: Zerlege Anforderungen in priorisierte Features und passe Umfang und Abhängigkeiten an ein Agenten-Zeitbudget an.
adaptation: SpecIt feature extraction, fit and extend JSON contracts
---
# Feature-Zuschnitt und Zeitbudget

Wird für `features`, `fit` und `extend` geladen. Vor der Spezifikation sind Idee und Entscheidungen die Quelle; nach der Spezifikation ist `spec` einschließlich Nicht-Zielen maßgeblich.

## Ablauf

1. **Quelle festhalten.** Ordne jeden Funktionsvorschlag einer Nutzerhandlung, einer bestätigten Entscheidung, einem Standard oder – nur bei erlaubter Erweiterung – einer KI-Idee zu. Abgewählte Funktionen und Nicht-Ziele nicht erneut aufnehmen.
2. **Kern gegen Ergänzung abgrenzen.** `core=true` nur, wenn ohne das Feature der minimale Ende-zu-Ende-Kernablauf nicht funktioniert. Ein technisches Grundgerüst als eigenes Feature; Komfort, Statistik, Benachrichtigungen und optionale Extras im Regelfall als Erweiterung. Die Einstufung bedeutet keine heimliche Änderung einer Muss-Anforderung.
3. **Sinnvolle Paketgröße wählen.** Überprüfbare, trennbare Ergebnisse mit `name` und `note` benennen. Doppelte Features zusammenführen, nicht fachlich zusammengehörende Arbeiten nur zur Parallelisierung künstlich trennen.
4. **Abhängigkeiten nachweisen.** `dependsOn` nur bei tatsächlichem Vorgängerbedarf, nicht aus kosmetischer Reihenfolge; niemals auf sich selbst, unbekannte IDs oder spätere Erweiterungen vom Kern verweisen. Bestehende `F##`-IDs beim Neuzuschnitt erhalten, soweit dieselbe Funktion bleibt.
5. **Agentenzeit schätzen.** `minutes` schätzt die Laufzeit **eines autonomen Coding-Agenten einschließlich Tests**, nicht menschliche Arbeit; positive Dezimalzahlen, Annahmen abhängig von Umfang und Integration. `lean` benennt exakt, was entfällt oder vereinfacht wird, sowie eine geringere eigene Schätzung.
6. **Aufgabenmodus anwenden.** Bei `features` vollständige priorisierte Liste mit Herkunft `own` und `from`. Bei `fit` zuerst Kernablauf erhalten, dann verschlanken, herabstufen oder realistisch parallelisieren; Maßnahmen müssen mit der neuen Liste übereinstimmen. Bei `extend` nur eigenständigen Mehrwert innerhalb `freeMinutes`; eine leere Liste ist zulässig.
7. **Reuse ehrlich behandeln.** Suchbegriffe dürfen helfen, aber ohne echte Repository-Recherche keine fremde Bibliothek als geprüft, lizenziert, sicher oder tatsächlich geeignet bezeichnen.

## Ergebnis

Ausschließlich das jeweils angeforderte JSON mit exakt den Feldern des aufrufenden Prompt-Schemas. Keine neuen Objekttypen, textlichen Vorbemerkungen oder erfundenen Repository-URLs. Für `fit` gelten zusätzlich die dort verlangten Maßnahmen und `summary`.

## Qualitätsprüfung

Sind F-IDs eindeutig, `dependsOn` gültig und azyklisch, Kern-Features ohne Erweiterungsabhängigkeit? Stimmen `core`, `own`, `rank`, `lean` und Zeitangaben mit dem beschriebenen Umfang überein? Ist bei `extend` die Summe zusätzlicher Minuten höchstens `freeMinutes`? Verschweige unlösbare Zeitkonflikte nicht hinter unbegründeten Nullaufwänden.
