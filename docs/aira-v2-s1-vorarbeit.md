# SpecIt S1 – Vorarbeit für persistente Identitäten und V2-Export

Stand: Arbeitsgrundlage für SI-5. Der normative A1-Vertrag und die gemeinsamen Referenzpakete bestimmen die endgültigen Feldnamen, Bytes und Fehlercodes.

## Persistente Identitäten

Ein reines Requirements-Modul kann unabhängig vom Transport entwickelt werden. Es verwaltet pro Plan persistente Höchststände für FR, NFR, T und B sowie AC und TC pro zugehöriger T- oder B-ID. Es behält bestehende IDs und Stilllegungen über einen Speicher- und Ladezyklus bei. Neue Einträge bekommen die nächste ID ihres Namensraums. Bei erschöpftem Namensraum meldet es einen Fehler.

- Reihenfolge und Umbenennung ändern bestehende IDs nicht. Eine fachlich bestätigte Textänderung kann dieselbe ID behalten. Ein semantischer Ersatz erhält eine neue ID und legt die alte still.
- V1-Klärungen in `aira-identities.mjs` sind über Entscheidungstext zugeordnet. Für V2 braucht die Benutzeroberfläche eine explizite Zuordnung zur persistierten B-ID. Bei der Migration übernimmt eine bestätigte Zuordnung bestehende IDs und Stilllegungen.
- `planner.mjs` und `interview.mjs` liefern Entwürfe. Validierte und bestätigte Plan- und Requirements-Daten sind die Eingabe für den Export.

Offline-Testfälle für die Identität können sofort entstehen. Eine Folge aus Umordnen, Umbenennen, Speichern und erneutem Laden muss dieselben IDs ergeben. Stillegung, danach Einfügen und erneutes Laden dürfen keine ID wiederverwenden. Doppelte, unbekannte und stillgelegte Referenzen sowie nicht abgedeckte Pflichtanforderungen müssen den Export verhindern. Eine Entscheidung mit geändertem Text behält bei bestätigter Zuordnung ihre B-ID und ihre Task-Referenzen.

## Deterministischer Export

`aira-export.mjs` enthält bereits kanonische JSON-Serialisierung und SHA-256. `aira-zip.mjs` stellt die Archivierung bereit. Die vorhandenen Tests in `test/aira-export.test.mjs`, `test/aira-revisions.test.mjs`, `test/aira-fixtures.test.mjs` und `test/aira-zip.test.mjs` sichern den V1-Pfad ab.

Ein eigener Offline-Testpfad kann jetzt die wiederholte Verpackung derselben Eingabe, Byte-Gleichheit, veränderte Unicode- und Mehrzeilenwerte sowie abweichende Vorgänger-Hashes abdecken. Die konkreten V2-Manifeste, Fehlercodes und positiven wie negativen Golden-Fixtures folgen aus A1. SpecIt und Aira nutzen anschließend dieselben geprüften Fixtures. Die V2-Projektion verwendet bestätigte Story Points ohne Laufzeitumrechnung und benötigt weder Jira-Verbindung noch Runner.
