status: teilweise
tests: nicht geprüft
dateien: aira-export.mjs, test/aira-export.test.mjs, test/aira-fixtures.test.mjs, test/fixtures/specit_v1/*.json

## Umsetzung und Acceptance
- Reiner Export auf normalisiertem Plan, deterministisches Manifest/Markdown und Bytequellen, keine Ausgabe aus renderTask. Referenzfixtures aus Aira 3b1d27a unverändert übernommen.
- Acceptance 1: test/aira-export.test.mjs vergleicht sämtliche Dateien bytegenau, Wiederholung und isolierte Negativmutationen (Export bzw. Paketprüfung). Anforderungen und Tests bleiben im Manifest und Markdown.
- Acceptance 2: keine npm-Abhängigkeit. npm test lokal nicht geprüft: git ls-remote scheitert mit Could not resolve host: github.com. Node v22.16.0 vorhanden, kein vollständiger Checkout.
- Risiken: Tests noch nicht ausgeführt; Revisionshistorie folgt in SI-4. Artefakte sind bereits geladene Bytequellen, kein Dateisystemzugriff.
- Beobachtungen: main enthält .github/workflows; unverändert gelassen.
