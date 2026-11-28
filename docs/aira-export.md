# Aira-Entwurf (V1) herunterladen

1. Aktuelle Spezifikation und Plan erstellen, fachlich prüfen (DEMO ist nur ein generisches Gerüst).
2. „Aira-Entwurf exportieren“ auswählen. Stabile projektweit eindeutige Plan-ID vergeben, Zielrepository als owner/name eintragen, für jeden Task und jede offene Entscheidung den modellunabhängigen Umfang bestätigen (1, 2, 3, 5, 8). Keine Laufzeitumrechnung. Offene Entscheidungen werden als eigene Klärungs-Epics exportiert.
3. Inhalte, Zielrepo und Punkte freigeben; ZIP herunterladen. Kein Runner, keine direkte Kalibrierung, kein Jira-Login. Die bisherige Standalone-Option bleibt getrennt.
4. ZIP in einen neuen leeren Ordner entpacken. Niemals bestehende Dateien überschreiben. SPEC.md ist der exakte Text, auf dem der Plan beruht. Manifest, SPEC.md und optionale Artefakte für Acceptance aufbewahren. Keine automatischen Netzabrufe.
5. Coordinator erhält nur draft/ als Eingabe für Aira (drafts.read, Import-Vorschau und explizite Bestätigung). SPEC.md im Zielrepo bereitstellen und Verfügbarkeit der Referenzen sicherstellen. Status und Vergabe bestimmt Aira, Klärungen erst nach dokumentierter Entscheidung durch Coordinator freigeben.
