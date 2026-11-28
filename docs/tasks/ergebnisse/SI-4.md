status: teilweise
tests: nicht geprüft
dateien: aira-export.mjs, aira-identities.mjs, public/app.mjs, public/index.html, server.mjs, test/aira-revisions.test.mjs, docs/aira-export.md

## Umsetzung und Acceptance
- Revisionshistorie je Plan-ID, unveränderte Wiederholung, SHA-256, stabile Task-/Klärungs-IDs, Änderungen als explizite Vorschau; Löschung/Umbenennung/Entfernung von Klärungen blockieren. Kein automatisches Löschen. Lokale Sperre gegen konkurrierende Browser-Exporte.
- Acceptance 1: test/aira-revisions.test.mjs prüft reproduzierbare Bytes, geänderte SPEC, neue Freigabe und Revision, Historienlücken, stabile Identitäten, Konflikte, Unicode/Markdown, fehlende Anforderungen/Artefakte und sichere Pfade. Browser-Vorschau bindet die Freigabe an exakten Input einschließlich Historie.
- Acceptance 2: npm test lokal nicht geprüft, Git-Checkout scheitert an DNS. Keine Abhängigkeiten oder CI ergänzt.
- Abweichung/Risiken: Historie ist lokaler Browserzustand (nicht signiert); über Browser/Rechner hinweg muss der Coordinator Manifeste abgleichen. Keine automatische Wiederherstellung verlorener Historie. Kein Importer, keine Jira-Synchronisation. Web Locks erforderlich. Browserintegration und Tests nicht ausgeführt.

## Handoff
Fertig: Implementierung und Tests im Branch, Änderungen und Risiken dokumentiert.
Offen: lokaler Qualitätsbefehl, Browser-Demo, KI-Punktevorschlag (SI-3), vollständige Vertragsprüfung und gegebenenfalls Konfliktbehebung. Historienimport bei Browserwechsel nicht umgesetzt.
Nächster Schritt: Coordinator führt npm test und Demo-Export/-Revision aus; prüft Referenzpakete mit Aira. Keine Änderungen an Aira oder CI. Bei Bedarf restlichen Umfang auf diesem Branch ergänzen.
Fehlerausgabe: fatal: unable to access 'https://github.com/ccogit/SpecIt.git/': Could not resolve host: github.com
