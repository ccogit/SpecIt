status: fertig
tests: nicht geprüft
dateien: aira-export.mjs, aira-identities.mjs, test/aira-export.test.mjs, test/aira-fixtures.test.mjs, test/fixtures/specit_v1/*.json

## Umsetzung und Acceptance
- Reiner Export auf exakt normalisiertem Plan, deterministisches Manifest/Markdown und Bytequellen, keine Ausgabe aus renderTask. Referenzfixtures aus Aira 3b1d27a unverändert übernommen. Typ-, Punkte-, ID-, DAG-, Titel-, Pfad- und Hashprüfung, strikte JSON-Prüfung. KI-Punktevorschläge getrennt vom Plan; keine implizite Bestätigung.
- Acceptance 1: test/aira-export.test.mjs vergleicht sämtliche Dateien bytegenau, Wiederholung und isolierte Negativmutationen (Export bzw. Paketprüfung). Anforderungen und Tests bleiben im Manifest und Markdown. Eingeschränkter JS-Abgleich ohne Node-Module: 3 positive Dateibäume ohne Abweichung bei vorgegebenen Referenzhashes, 22/22 negative Fälle abgelehnt; kein Nachweis für echte Node-Hash-/ZIP-Implementierung.
- Acceptance 2: keine npm-Abhängigkeit. npm test lokal nicht geprüft: git ls-remote scheitert mit Could not resolve host: github.com. Node v22.16.0 vorhanden, kein vollständiger Checkout.
- Risiken: vollständiger Node-Testlauf durch Coordinator erforderlich. Artefakte sind bereits geladene Bytequellen, kein Dateisystemzugriff.
- Beobachtungen: main enthält .github/workflows; unverändert gelassen.
