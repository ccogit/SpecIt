---
name: specification
description: Erstelle und ändere eine prüfbare SPEC.md mit sauberer Herkunft, stabilen Anforderungen und Akzeptanzkriterien.
source: https://github.com/github/spec-kit
upstream-license: MIT
adaptation: SpecIt single-document SPEC.md and fixed document blocks
---
# Spezifikation erstellen und pflegen

Angelehnt an **GitHub Spec Kit** (GitHub, MIT), nicht dessen CLI- oder Dateibaum-Workflow. Ziel ist die tragfähige **eine** SPEC.md. Die vom Server generierten Bausteine und die explizite Ausgabeanweisung sind maßgeblich.

## Ablauf

1. **Eingaben konsolidieren.** Idee, bearbeitetes Konzept, bestätigte Entscheidungen, angenommene Standards, offene Fragen, ausgewählte Features und ausgeschlossene Features aufeinander abgleichen. Nutzerentscheidungen haben Vorrang vor Standardannahmen und früheren KI-Vorschlägen.
2. **Scope fixieren.** Ziel und Nicht-Ziele beschreiben. Nur ausgewählte Features spezifizieren; abgewählte oder ausgeschlossene Funktionen ausschließlich bei den Nicht-Zielen nennen. Auswirkungen auf Daten, Rollen, UX und Abnahme berücksichtigen.
3. **Verhalten vor Technik.** Kernabläufe aus Nutzersicht mit Vorbedingungen, Erfolg, Fehler-, Leer-, Rechte- und Grenzfällen formulieren. Externe Systeme, Technologien, Datenmodelle oder gesetzliche Pflichten nur als Tatsache behaupten, wenn sie belegt bzw. vorgegeben sind.
4. **Anforderungen eindeutig schreiben.** Funktionale `FR-001` ff. und projektspezifische nichtfunktionale `NFR-001` ff. verwenden; Nummern bestehender Anforderungen bei Revisionen erhalten. `NFR-901` ff. gehören ausschließlich den festen SpecIt-Standards – nicht duplizieren oder umnummerieren. Zu jeder Anforderung Priorität und Herkunft (entschieden/Annahme/KI-Vorschlag) nachvollziehbar halten.
5. **Abnahme konkretisieren.** Für jede Anforderung mindestens ein messbares Akzeptanzkriterium in Form „Gegeben [Ausgangslage], wenn [Aktion], dann [beobachtbares Ergebnis]“. Fehler- und Berechtigungsfälle einbeziehen; „schnell“, „modern“ und „sicher“ ohne Nachweisbedingung reichen nicht.
6. **Feste Kapitel respektieren.** Wenn `fixedSections`/ein `corePrompt` übergeben werden, **nur** die verlangten projektspezifischen Kapitel ausgeben. Keine zweite Einleitung, Gliederung, Standard-NFR, Abnahme, Entscheidungen oder feste Risiken erzeugen. Bei partiellen Edits nur exakt betroffene Textstellen bearbeiten und IDs bzw. Querverweise nachführen.
7. **Offene Punkte korrekt behandeln.** Der vom Prompt vorgegebene Entscheidungsmodus regelt, was offenbleibt; selbst getroffene Festlegungen als Annahmen kenntlich machen. Im Auto-Modus keine offenen Entscheidungen stehen lassen, aber die Annahmen sichtbar halten.

## Ergebnis

Gültiges Markdown bzw. **genau** das angeforderte Edit-JSON. Verwende die vorgegebenen Abschnittsnamen und Ausgabegrenzen. Beispiel für ein prüfbares Kriterium: „FR-003: Bei fehlendem Pflichtfeld verhindert die Eingabemaske das Speichern und zeigt die betroffene Eingabe an.“ Beispiel und ID sind keine Vorgabe für das aktuelle Projekt.

## Qualitätsprüfung

Passen Ziele, Funktionen, Rollen, Daten und Risiken zusammen? Hat jede FR/NFR ein überprüfbares Kriterium? Sind bereits bestehende IDs stabil, feste Standard-NFR unberührt, Nicht-Ziele nicht heimlich als Funktionen zurückgekehrt und Annahmen von bestätigten Entscheidungen getrennt? Sind die verlangten Kapitel vollständig, aber ohne redundante Server-Bausteine?
