---
name: traceability
description: Erhalte Herkunft, Begriffe, Anforderungs-IDs und Abnahmebezug über SPEC.md und Aufgaben hinweg.
source: https://github.com/urban/agent-skills-spec-pack
upstream-license: CC0-1.0
adaptation: SpecIt single SPEC.md and task JSON
---
# Rückverfolgbarkeit und Konsistenz

Angelehnt an **urban/agent-skills-spec-pack** (CC0-1.0); SpecIt nutzt eine SPEC.md und Task-JSON. Dieser Skill beginnt dort, wo Anforderungsbezüge vorhanden sind. **Vor** einer Spezifikation dürfen fehlende FR-/NFR-IDs nicht als Fehler behandelt oder künstlich erfunden werden.

## Ablauf

1. **Begriffe vereinheitlichen.** Namen für Rollen, Objekte, Status und fachliche Handlungen aus der bestätigten Idee bzw. SPEC.md übernehmen. Synonyme vermeiden, wenn sie neue Entitäten vortäuschen.
2. **Provenienz zuordnen.** Aussagen als Nutzerentscheidung, angenommener Standard, KI-Vorschlag oder offen unterscheiden. Änderungen an dieser Einordnung dürfen nicht stillschweigend erfolgen.
3. **IDs stabil halten.** Funktionale `FR-###`, projektspezifische `NFR-001` ff. und feste Standard-`NFR-901` ff. voneinander unterscheiden. Keine nicht existierenden Referenzen erzeugen; gelöschte Anforderungen nicht unter einer alten ID mit neuer Bedeutung wiederverwenden.
4. **Ketten schrittweise prüfen.** Bei SPEC.md: Feature → Anforderung → Akzeptanzkriterium. Beim Plan: Anforderung → mindestens ein Task → Task-Akzeptanz/Test. Bei partiellen Änderungen betroffene Verweise nachführen, nicht blind alle Anforderungen neu schreiben.
5. **Planabweichungen auflisten.** Unbekannte IDs, ungedeckte Anforderungen, Tasks ohne Referenz, widersprechende Nicht-Ziele, Abhängigkeits- oder Schnittstellenkonflikte benennen. Fehlende Information ist ein Befund, keine Erlaubnis zu Tatsachenerfindung.
6. **Phasengrenzen wahren.** Der Plan stellt laut SpecIt keine Rückfragen: verbliebene Implementierungsdetails als eigene `decisions` mit Begründung dokumentieren, `blockedBy` leer lassen. Bei der Spezifikation bestimmt dagegen der Entscheidungsmodus den Umgang mit Unklarheit.

## Ergebnis

Nur die im aufrufenden Prompt vorgesehenen Markdown-Abschnitte oder JSON-Felder. Keine eigenmächtige zusätzliche Traceability-Tabelle in einem Format, das sie nicht erlaubt. Beispiel einer Kette: `FR-007 → T03 → Test: ungültige Eingabe wird abgewiesen` (illustrativ, kein realer Projektbezug).

## Qualitätsprüfung

Existiert jede referenzierte ID tatsächlich? Ist im Plan jede spezifizierte Anforderung mindestens einmal abgedeckt? Stimmen Begriffe und Provenienz überein? Sind Abnahme und Tests beobachtbar, und haben Scope-Änderungen keine verwaisten Verweise erzeugt? Bei importierten Spezifikationen ohne IDs nur fachliche Rückverfolgbarkeit verlangen, keine fiktiven Kennungen.
