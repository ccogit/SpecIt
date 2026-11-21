# Ketten: Vergabe und Zusammenarbeit

Die Aufgaben dieses Verzeichnisses werden als **Ketten** an externe Bearbeiter vergeben. Eine Kette ist eine
feste Folge von Aufgaben, die ein Bearbeiter in **einem** Branch und **einem** PR liefert. Der Koordinator
vergibt, prüft und merged.

## Register

| Kette | Titel | Aufgaben | Voraussetzung | Stand |
|---|---|---|---|---|
| KETTE-01 | Analyse: lokale, vorgewärmte Modelle für die Live-Skizze | 01 | – | offen |

Den Stand ändert nur der Koordinator (`offen`, `vergeben (TT.MM.JJJJ)`, `gemergt`, `gesperrt`). Bearbeiter
reservieren nichts und ändern diese Datei nicht.

## Regeln für Bearbeiter

1. **Ein Branch, ein PR.** Branch `extern/KETTE-nn` vom aktuellen `origin/main`. Früh genau einen Draft-PR
   `extern/KETTE-nn` → `main` öffnen. Keine Einzel-Branches oder Einzel-PRs je Aufgabe.
2. **Reihenfolge.** Die Aufgaben der Kette in der Reihenfolge des Registers. Commits je Aufgabe mit Präfix
   `AUFGABE-nn: …`. Umfang und Abnahme stehen verbindlich in `AUFGABE-nn-….md`; gemeinsame Bedingungen in
   `README.md` dieses Verzeichnisses.
3. **Ergebnis je Aufgabe.** Eine Datei `docs/aufgaben/lokale-ki/ergebnisse/AUFGABE-nn.md`: was umgesetzt wurde, je
   Abnahmepunkt der Beleg (Test, Befehl, Ausgabe), was nicht geprüft werden konnte, Abweichungen von der Aufgabe
   mit Grund, offene Risiken.
4. **Qualität.** `npm test` ist vor jedem Push grün. Die CI des PR ist grün. Tests zu jeder Änderung.
5. **Aktuell bleiben.** Regelmäßig `origin/main` in den Branch mergen (kein Force-Push, kein Rebase nach dem
   ersten Push), Konflikte selbst lösen.
6. **Grenzen.** Keine neuen npm-Abhängigkeiten, keine Änderungen an Produktcode in dieser Analyse. Keine Secrets, keine echten Kundendaten. Nichts außerhalb des Umfangs der Aufgaben
   ändern; Auffälliges außerhalb des Umfangs steht in der Ergebnisdatei unter „Beobachtungen“.
7. **Durcharbeiten.** Ohne Rückfrage Aufgabe für Aufgabe weiter. Bei einer echten Blockade die Annahme in der
   Ergebnisdatei festhalten und mit der sinnvollsten Auslegung weiterarbeiten.
8. **Abschluss.** Sind alle Aufgaben der Kette fertig und die CI grün: PR auf „Ready for review“ setzen, im
   PR-Text je Aufgabe Ergebnis und Prüfbelege. Der Koordinator prüft und merged den Ketten-PR als Ganzes.
   Nacharbeit kommt als Nachricht im Chat der Kette; der PR ist dann nicht abgeschlossen.
