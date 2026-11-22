---
name: discovery
description: Leite entscheidungsrelevante Produktfragen und belastbare Annahmen aus Idee und bisherigen Antworten ab.
source: https://github.com/Emmraan/agent-skills/blob/main/skills/agent-meta/requirements-analysis/SKILL.md
upstream-license: MIT
adaptation: SpecIt multiple-choice interview and decision triage
---
# Discovery – Anforderungen erheben

Angelehnt an **requirements-analysis** (Emmraan, MIT); für den SpecIt-Fragebogen angepasst. Dieser Skill gilt beim Ableiten, Ergänzen und Priorisieren von Fragen, nicht beim Erstellen von Code oder endgültigen Spezifikationsabschnitten.

## Ablauf

1. **Bestand aufnehmen.** Trenne ausdrücklich gegebene Ziele, bekannte Antworten (`decided`), übernommene Standards (`default`) und offene Fragen (`open`). Übernimm Begriffe aus der Idee; erfinde weder Kunden, Branchenregeln noch technische Randbedingungen.
2. **Abdeckung prüfen.** Untersuche Ziel/Nicht-Ziel, Nutzer und Befugnisse, Funktionen und Kernablauf, UX/Barrierefreiheit, Technik/Daten/Schnittstellen sowie Qualität/Betrieb. Prüfe insbesondere Eingabefehler, leere Datenbestände, Rollenwechsel und Datenverlust – aber nur, soweit die Idee diese Situationen nahelegt.
3. **Entscheidungsbedarf priorisieren.** Frage zuerst nach Alternativen, die Umfang, Nutzbarkeit, Rechte, Daten oder Architektur spürbar verändern. Untergeordnete Geschmacksfragen zurückstellen. Für `triage` ausschließlich vorhandene offene Frage-IDs bewerten, keine neuen erfinden.
4. **Fragen formulieren.** Eine Frage behandelt genau eine Entscheidung und ist ohne Kontext verständlich. Zwei bis fünf unterscheidbare Optionen anbieten; keine überlappenden Alternativen, Suggestivfragen oder vorgeschobenen Technologiepräferenzen. Eigene Antwort ermöglichen, sofern das aufrufende Schema dies vorsieht.
5. **Standard begründen.** Einen risikoarmen, realistisch umsetzbaren Vorschlag nennen, sofern der Modus Standards erlaubt. „Standard“ ist nicht „vom Nutzer bestätigt“. Bereits entschiedene Fragen nicht wiederholen und beim Nachfragen neue Antworten berücksichtigen.
6. **Konflikte offenlegen.** Wenn zwei bestätigte Angaben unvereinbar sind, gezielt die entscheidende Auflösung erfragen; keine unbemerkte Umdeutung.

## Ergebnis

Liefere ausschließlich das vom aufrufenden Prompt geforderte Fragen-, Entscheidungs- oder Triage-JSON. Nutze dessen Felder, Wertebereiche, Mengenbegrenzungen und bereits vorhandene Nummerierung. Beispiel für eine sinnvolle Fachfrage: „Wer darf bestehende Einträge löschen?“ mit den abgrenzbaren Optionen „Nur Ersteller“, „Ersteller und Administratoren“, „Niemand“. Die Rollen sind ein **Beispiel**, keine Tatsachen über das aktuelle Projekt.

## Qualitätsprüfung

Sind alle sechs Themen je nach Relevanz abgedeckt? Verändert jede neue Frage eine echte Produktentscheidung? Sind `decided`, `default` und `open` getrennt? Wurde keine vertrauliche Information verlangt, kein beantworteter Punkt wiederholt und keine ungeprüfte Annahme als Fakt ausgegeben?
