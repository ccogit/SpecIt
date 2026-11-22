---
name: concept
description: Forme eine knappe Produktidee zu einem konsistenten, interaktiv entscheidbaren Sieben-Abschnitt-Konzept.
adaptation: SpecIt streaming concept and inline decision markers
---
# Konzeptentwicklung

Dieser Skill steuert die erste lesbare Kurzfassung **vor** Fragen und SPEC.md. Er gilt sowohl beim vollständigen Neuschreiben als auch bei partiellen Aktualisierungen und Änderungswünschen.

## Ablauf

1. **Idee und Festlegungen auswerten.** Extrahiere Zielgruppe, Nutzenversprechen, Kernhandlung und ausdrücklich gesetzte Grenzen. Berücksichtige vorhandene Antworten und Änderungswünsche als verbindlich; ergänze nur fehlende, plausible Details.
2. **Konkreten Nutzungsfall skizzieren.** Die Szene zeigt eine Person, eine realistische Situation, eine konkrete Handlung und den erzielten Nutzen. Keine erfundenen Markt-, Rechts- oder Leistungsversprechen.
3. **Sieben Abschnitte konsistent füllen.** Reihenfolge und exakte Überschriften bestimmt der aufrufende Prompt (`Szene`, `Ziel`, `Nutzer`, `Funktionen`, `UX`, `Technik`, `Qualität`). Stelle sicher, dass jede Funktion ein Nutzerziel stützt; die Zielzeit begrenzt den Umfang.
4. **Unbekanntes gezielt markieren.** Nur richtungsweisende Annahmen als `{{Frage?|Annahme|Alternative|Alternative}}` schreiben. Die Frage muss allein verständlich sein und mit „?“ enden. Prüfe gedanklich den Satz nach Einsetzen jeder ersten Option. Verwende keine weiteren geschweiften Klammern.
5. **Bestehende Entscheidungen erhalten.** Aus `answers` übergebene Fragen mitsamt exaktem Wortlaut und Antwort wieder aufnehmen. Bei Teilupdates nur die verlangten Abschnitte liefern; Marker und Fachbegriffe aus unveränderten Abschnitten nicht duplizieren.
6. **Kreativität kontrollieren.** Nur im gewährten Kreativitätsspielraum zusätzliche Ideen entwickeln; klar als Vorschlag erkennbar halten. Ton, Zielzeit und Einsatzbereich modulieren den Text, nicht die Herkunft von Entscheidungen.

## Ergebnis

Nur den Text in der vom konkreten Prompt angeordneten Abschnittsauswahl; keine Einleitung, kein Markdown-Codeblock und kein JSON. Wortlimit und Anzahl der Markierungen stammen aus dem aufrufenden Prompt und gehen diesem Skill vor. Beginne unmittelbar mit `##`.

## Qualitätsprüfung

Ist der Kernablauf aus Ziel, Funktionen und UX nachvollziehbar? Stimmen Rollen und Begriffe überein? Kommt jede vorgegebene Entscheidung genau einmal vor? Sind offene Stellen als Annahmen markiert, die nach Einsetzen grammatisch funktionieren? Wurde bei Teilupdates keine nicht betroffene Aussage verändert?
