status: teilweise
tests: nicht geprüft
dateien: public/index.html, public/app.mjs, server.mjs, aira-zip.mjs, test/aira-zip.test.mjs, docs/aira-export.md

## Umsetzung und Acceptance
- Separate Aira-Option, aktuelle Planstruktur, sichtbare Aufgaben/Entscheidungen, Zielrepo und Punkte ohne Defaults, ausdrückliche Freigabe. ZIP ausschließlich im Speicher, kein Ordnerzugriff.
- Acceptance 1: test/aira-zip.test.mjs prüft ZIP bytegenau gegen blocked-Fixture, fehlende Punkte, Freigabe, unveränderte Eingabe und statische Trennung von Standalone/Runner/Kalibrierung. Standalone unverändert. Browser-Interaktion noch nicht ausgeführt.
- Acceptance 2: npm test und manueller Demo-Download lokal nicht geprüft (DNS: Could not resolve host: github.com, kein Checkout).
- Abweichung/Risiko: Punkte manuell vergeben, keine separate KI-Punktevorschlagsfunktion. Artefaktbytes unterstützt der Exportkern; UI übergibt nur die zugrunde liegende SPEC.md, keine automatischen Kontextdownloads. Revisionen folgen in SI-4.
