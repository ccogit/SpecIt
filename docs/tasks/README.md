# SpecIt: Arbeit in Epics und Regeln für Contractors

Die Arbeit an diesem Projekt wird in **Jira** geführt (Projekt `SI`): ein **Epic** ist ein Arbeitspaket für
genau einen Bearbeiter, mit einem Branch und einem PR; seine **Work items** sind die Schritte in fester
Reihenfolge; ein Link „blocks“ zwischen zwei Epics heißt, dass das eine auf das andere wartet. Den Status pflegt
nur der Coordinator. Contractors brauchen keinen Jira-Zugang: Der Brief eines Epics enthält die Texte seiner
Work items. Diese Datei beschreibt, was für **alle** Epics gilt.

## 1. Ausgangslage

<Was gibt es heute? Welche Dateien, Klassen, Abläufe sind betroffen?>

## 2. Ziel

<Was soll am Ende gelten? In zwei bis fünf Sätzen.>

## 3. Feste Bedingungen (nicht ändern)

- <Projektverbote>
- Keine Secrets, keine echten Kundendaten in Code, Tests oder Dokumentation.
- <Was sonst nie angefasst wird.>

## 4. Regeln für Contractors

1. **Ein Branch, ein PR.** Branch und PR-Titel nennt der Brief: `extern/<Epic-Schlüssel>-<kurzer-name>` vom
   aktuellen `origin/main`, PR-Titel `<Epic-Schlüssel>: <Epic-Titel>`. Sofort nach dem ersten Commit pushen
   und genau einen Draft-PR → `main` öffnen. Keine weiteren Branches oder PRs.
2. **Reihenfolge.** Die Work items in der Reihenfolge des Briefs. Commits beginnen mit dem Schlüssel des Work
   items (`AIRA-12: …`). Umfang und Acceptance stehen verbindlich im Brief.
3. **Ergebnis je Work item.** Eine Datei `docs/tasks/ergebnisse/<Schlüssel>.md`: was umgesetzt wurde, je
   Acceptance-Punkt der Beleg (Test, Befehl, Ausgabe), was nicht geprüft werden konnte, Abweichungen mit Grund,
   offene Risiken.
4. **Früh pushen, keine CI.** Es gibt keine CI (GitHub Actions werden nicht verwendet): nicht auf Checks
   warten, keinen Workflow unter `.github/workflows` anlegen oder ändern. Den Qualitätsbefehl `npm test` lokal
   ausführen, soweit die eigene Umgebung es erlaubt; geht das nicht, trotzdem pushen und im PR und in der
   Ergebnisdatei „lokal nicht geprüft“ vermerken. Maßgeblich ist der Qualitätsbefehl, den der Coordinator lokal
   ausführt; Fehler meldet er im Chat. Tests zu jeder Änderung.
5. **Aktuell bleiben.** Regelmäßig `origin/main` in den Branch mergen (kein Force-Push, kein Rebase nach dem
   ersten Push), Konflikte selbst lösen.
6. **Grenzen.** <Projektverbote>. Keine Secrets, keine echten Kundendaten. Nichts außerhalb des Umfangs ändern;
   gemeinsame Dateien (diese Datei, Changelog, zentrale Konfiguration) pflegt der Coordinator. Auffälliges
   außerhalb des Umfangs steht in der Ergebnisdatei unter „Beobachtungen“.
7. **Durcharbeiten.** Ohne Rückfrage ein Work item nach dem anderen. Bei einer echten Blockade die Annahme in
   der Ergebnisdatei festhalten und mit der sinnvollsten Auslegung weiterarbeiten.
8. **Nie ohne PR enden (Handoff).** Geht es nicht weiter: Stand pushen, in der Ergebnisdatei einen Abschnitt
   „Handoff“ schreiben (fertig, offen, nächster Schritt, Fehlerausgabe), den PR-Titel mit „HANDOFF“ beginnen
   und den PR **trotzdem auf „Ready for review“** setzen. Der Coordinator übernimmt dann den Branch.
9. **Abschluss.** Sind alle Work items fertig: PR auf „Ready for review“, im PR-Text je Work item Ergebnis und
   Prüfbelege. Der Coordinator prüft (Acceptance), merged den PR als Ganzes und setzt den Status in Jira.

## 5. Begriffe

| Begriff | Bedeutung |
|---|---|
| Epic | Arbeitspaket in Jira mit sprechendem Titel: Work items in fester Reihenfolge, ein Bearbeiter, ein Branch, ein PR |
| Work item | Schritt eines Epics in Jira: Ziel, Umfang, Acceptance |
| blocked by | das Epic wartet auf ein anderes (Link „blocks“ in Jira) |
| Contractor | externe KI, die ein Epic umsetzt |
| Coordinator | schneidet, vergibt, prüft, merged und pflegt Jira |
| <Begriff> | <Bedeutung> |

## 6. Acceptance über alle Epics

1. <Prüfbarer Zustand nach allen Epics.>
