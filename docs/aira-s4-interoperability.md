# S4 – Interoperabilität, Regression und sicherer Rückfall

Q11 / T01–T05, T14, T15. Grundlage: [Integrationsablauf (7adfd00)](https://github.com/ccogit/Aira/blob/7adfd00/docs/plan/specit-aira-v1.2/ABLAUF.md), V1.2 Kapitel 14 und [A1-Merge 79cf37f](https://github.com/ccogit/Aira/commit/79cf37f41450e3fe420f261fe1090cebcaa98bd5). Die gemeinsamen JSON-Fixtures liegen unverändert unter `test/fixtures/specit_v1/` bzw. `test/fixtures/aira-v2/`. Die SHA-256-Pins in `test/aira-s4-interoperability.test.mjs` stammen aus den Originalbytes der gepinnten Aira-Version, nicht aus dem lokalen Manifest. Eine gleichzeitige Veränderung von Fixture und Manifest darf den Nachweis nicht umgehen.

## Betriebsmodi und sichere Übergabe

- Standalone: wie bisher lokal in SpecIt arbeiten; V1-Export bleibt bytekompatibel. Keine Aira-Bindung voraussetzen, keine Aira-Rückmeldung als lokale Freigabe interpretieren.
- Aira-Modus: Zielprojekt, Repo, Plan und bestätigte IDs/Punkte fachlich prüfen. V2-Vorschau vor Export bestätigen; Änderungen an Eingaben oder Vorgänger machen die Bestätigung ungültig. Für Folgeexporte die Originalhistorie einschließlich Vorgänger-Manifest erhalten, keine neue Baseline über eine bestehende Bindung legen. Keine parallele lokale Runner-Ausführung für den gebundenen Plan.
- Paket nur an die unabhängig geprüfte Zielbindung übergeben. Originaldateien und Hashes erhalten; keine manuelle JSON-Normalisierung oder Neuverpackung als Ersatz für eine gültige Freigabe. Die produktive Übernahme und Jira-Mutation gehören zu Aira, nicht zu diesem Nachweis.
- Im integrierten Projektdialog den fachlichen Feedbackimport öffnen. Bindungs-ID und Jira-Projekt unabhängig mit dem geprüften Aira-Projekt abgleichen. Original-Feedbackdatei und ggf. separat erhaltenen SHA-256 übergeben, Herkunft bestätigen. Die Hashprüfung allein authentifiziert keinen Absender.
- Rückmeldung bleibt Evidenz: keine automatische Änderung an SPEC, Punkten oder Kalibrierung. Fachliche Entscheidung nur mit unabhängig geprüftem Beleg, konfiguriertem Fachowner und expliziter Bestätigung übernehmen; anschließend neue Vorschau und gesonderte Exportfreigabe. Die technische Freigabe des Interoperabilitätsnachweises liegt beim Coordinator.

## Fehler und Recovery

| Befund | Sichere Reaktion |
| --- | --- |
| Abweichendes Repo/Projekt/Plan, ungültige IDs, Coverage, Hash oder Schema | Stoppen; Originale sichern, Bindung und Paket separat prüfen. Nicht durch Ändern von Hashes oder IDs reparieren. |
| APPROVAL_STALE oder konkurrierende Änderung | Neue Vorschau des tatsächlich aktuellen Stands erstellen und erneut bestätigen; alte Freigabe nicht wiederverwenden. |
| Feedback identisch wiederholt | No-op; keine zweite fachliche Entscheidung auslösen. |
| Feedback fremd, Reihenfolgelücke, Konflikt oder falscher Vorgänger | Import ablehnen; fehlende Originalbelege in Reihenfolge beschaffen, Konflikt nicht durch Überschreiben beheben. |
| Historisches oder nicht zum aktuellen Manifest passendes Feedback | Als historisch/unklar anzeigen; keine Erfüllung daraus ableiten. |
| Abbruch, Neustart oder Browserwechsel | Paket-/Projekthistorie und separat gesicherten Feedbackstand wiederherstellen; Bindung, Manifest und Belegkette prüfen, dann aktuelle Vorschau neu erzeugen. |
| Unvollständiger Nachweis oder unerwartete Remote-Mutation | Technischen Nachweis sperren. Coordinator untersucht; kein Live-Pilot. |

## Rückfall

Bei unauflösbarem Fehler den Aira-Übergabeprozess stoppen; unveränderte Originalpakete, Rückmeldungen, Protokoll und lokale Sicherungen behalten. Keine Remote-Rückabwicklung automatisch auslösen. Standalone in einem ausdrücklich getrennten lokalen Projekt bzw. unabhängigen Plan verwenden, nicht den bestehenden gebundenen Plan umetikettieren oder doppelt starten. Vor Wiederaufnahme die Historie und Bindung durch den Coordinator prüfen, danach neu bestätigen. V1-Export ist Kompatibilitätsweg für Standalone, kein Ersatz für die V2-Bindungs- und Freigabekette.

## Reproduzierbares Smoke-Protokoll für den Coordinator

Voraussetzung: vollständiger Checkout des PR-Head, Node 22+, `npm test`, lokaler Server gemäß README (`npm start` sofern im Checkout verfügbar), isolierte Testdaten und Browserprofile, keine produktiven Jira-/GitHub-Zugangsdaten oder echten Kundendaten. Nur Loopback; keine Live-Übernahme und keinen echten Runner/Agent starten. Für Browserwechsel ein zweites frisches Profil verwenden. Pro Durchlauf Datum, Head-SHA, Browser/Version, Schritte, Ist-Ergebnis, ggf. Screenshot und Netzwerkprotokoll ohne sensible Daten erfassen.

| Fall | Schritte / Soll | Ist (Contractor) |
| --- | --- | --- |
| B1 / T01–T03 | Synthetischen Plan im Aira-Modus prüfen; linear/branched/blocked inklusive mehrzeiliger Inhalte und Unicode als V2 exportieren; entpackte Dateien und SHA-256 mit A1 vergleichen, Abhängigkeiten prüfen. | Nicht geprüft (Browser/Server). |
| B2 / T04–T05 | Nach Vorschau SPEC/Bindung ändern; alte Bestätigung darf nicht exportieren. Ungültige Fixture/Hash/Bindung ablehnen; keine Remote-Anfrage. | Nicht geprüft (Browser/Server). |
| B3 / T14 | A1 linear/revised Historie bereitstellen; gepinnte Feedbackbelege in Reihenfolge importieren; Replay No-op, Lücke/Konflikt/Fremdbindung ablehnen; Erfüllung nur beim aktuellen Manifest. SPEC und Kalibrierung unverändert. | Kern und View-Modell lokal geprüft; Browser/Server nicht geprüft. |
| B4 / T15 | Export abbrechen, Seite neu laden, Neustart und zweites Browserprofil: Sicherung wiederherstellen, Head/Bindung und Feedback erneut prüfen; keine doppelte Ausführung im integrierten Modus. | Feedback-Store lokal geprüft; Browser/Server nicht geprüft. |
| B5 / T15 | Getrenntes Standalone-Projekt öffnen, V1-Export vergleichen; bisherige Runner-/Kalibrierungsbedienung verfügbar, aber keinen echten Agent auslösen. Desktop und mobile Darstellung prüfen. | Nicht geprüft (Browser/Server). |

Automatisierte Prüfungen ersetzen nicht die Browser-Smokes. Aira-seitige Import-/ADF-Darstellung, ZIP-Extraktionssicherheit, Vergabe und echte AIRA-192-Integration sind durch die jeweiligen Aira-Nachweise abzudecken. Bis alle relevanten Prüfungen und offenen Befunde geklärt sind, ist Q11 nicht technisch freigegeben. Siehe [SI-16 Ergebnis](tasks/ergebnisse/SI-16.md).
