status: fertig
tests: nicht geprüft
dateien: public/index.html, public/app.mjs, server.mjs, aira-zip.mjs, test/aira-zip.test.mjs, docs/aira-export.md

## Umsetzung und Acceptance
- Separate Aira-Option, aktuelle Planstruktur, sichtbare Aufgaben/Entscheidungen, Zielrepo und Punkte ohne Defaults, ausdrückliche Freigabe. KI schlägt pro Task modellunabhängige Punkte beim normalen KI-Planen vor, Vorschläge sind separate unverbindliche Metadaten. Demo und ältere Pläne ohne Vorschläge: Punkte manuell bestätigen. ZIP ausschließlich im Speicher, kein Ordnerzugriff.
- Acceptance 1: test/aira-zip.test.mjs prüft ZIP bytegenau gegen blocked-Fixture, fehlende Punkte, Freigabe, unveränderte Eingabe und statische Trennung von Standalone/Runner/Kalibrierung. Standalone-Startpfad unverändert. Statische UI-/API-Trennungsprüfung im isolierten JS-Prüfstand erfolgreich; echter ZIP-Test und Browser-Interaktion noch nicht ausgeführt.
- Acceptance 2: npm test und manueller Demo-Download lokal nicht geprüft (DNS: Could not resolve host: github.com, kein Checkout).
- Abweichung/Risiko: aktuelle Planerzeugung löst Entscheidungen bereits fachlich auf; bei älteren Plänen mit Blockern und ohne KI-Punktevorschläge werden die Klärungspunkte explizit manuell vergeben. Artefaktbytes unterstützt der Exportkern; UI übergibt nur die zugrunde liegende SPEC.md, keine automatischen Kontextdownloads.
