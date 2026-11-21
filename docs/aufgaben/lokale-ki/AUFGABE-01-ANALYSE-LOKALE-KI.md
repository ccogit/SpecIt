# Aufgabe 01: Analyse – lokale, vorgewärmte Modelle für die Live-Skizze

Gemeinsame Bedingungen, Begriffe und Regeln: `docs/aufgaben/lokale-ki/README.md`. Setzt nichts voraus.

## Ziel

Nach dieser Aufgabe liegt eine Analyse vor, die beantwortet: Kann ein lokal laufendes, vorgewärmtes Modell die
KI-Skizze von SpecIt in Echtzeit liefern (erst grob, dann schnell immer feiner), welche Modelle und welche
Laufzeitumgebung eignen sich dafür auf dem Zielrechner, und wie wäre das in SpecIt einzubauen? Die Analyse endet
mit einer klaren Empfehlung und einem Vorschlag für die Folgeaufgaben.

## Ausgangslage

- `docs/aufgaben/lokale-ki/README.md`, Abschnitt 1: Aufbau der Live-Skizze, heutige Messwerte mit Claude in der
  Cloud, Zielrechner.
- `server.mjs`: Der Server ruft Claude über die Funktion `ask` auf (Kommandozeile `claude -p` oder Anthropic-API)
  und kennt mit `askStream` bereits eine Variante, die die Antwort als Strom liefert. Der Aufruf für die Skizze
  bekommt eine Anweisung (rund 1.500 Tokens, bei jeder Anfrage gleich bis auf die Sätze der Regler) und als Daten
  nur Name und Idee. Erwartet wird ein eigenständiges SVG mit viewBox `0 0 480 300`, 4.500 bis 7.000 Zeichen.
- `interview.mjs`, Funktion `cleanSvg`: lässt nur eine feste Auswahl an SVG-Elementen und Attributen durch (svg, g,
  path, circle, rect, ellipse, line, polygon, polyline, defs, linearGradient, radialGradient, stop, text, tspan;
  keine Stile, Klassen, Skripte, Bilder, Verweise). Was ein Modell liefert, muss diese Prüfung bestehen.
- Auf `main` gibt es bereits einen ähnlichen Fall zum Nachlesen: die Logo-Entwürfe (`logoPrompt` in
  `interview.mjs`, Modus `logos` in `server.mjs`), bei denen Claude SVG zeichnet.

## Umfang

Ergebnis ist die Datei `docs/analyse/lokale-ki-skizze.md` mit diesen Abschnitten:

1. **Anforderungen in Zahlen.** Leite aus der Ausgangslage ab, was „Echtzeit“ hier heißt: Zielwerte für Zeit bis
   zum ersten Zeichen, Zeichen bzw. Tokens je Sekunde und Gesamtdauer eines Drahtmodells, damit die Skizze beim
   Tippen mitwächst. Rechne aus, wie viele Tokens ein SVG von 4.500 bis 7.000 Zeichen etwa hat und welche
   Erzeugungsgeschwindigkeit für eine Gesamtdauer von 2, 5 und 10 Sekunden nötig wäre.
2. **Modelle.** Vergleiche mindestens acht Kandidaten in einer Tabelle, darunter
   a) kleine allgemeine Sprachmodelle, die Code und SVG schreiben können (Größenordnung 1 bis 14 Milliarden
   Parameter, etwa aus den Familien Qwen Coder, Gemma, Phi, Llama, Mistral, DeepSeek Coder oder deren Nachfolger),
   b) auf SVG oder Vektorgrafik spezialisierte Modelle (zum Beispiel StarVector, OmniSVG, LLM4SVG und was es
   seither gibt),
   c) auf Oberflächen, Drahtmodelle oder HTML/UI-Code spezialisierte Modelle oder Feinabstimmungen, falls vorhanden.
   Je Kandidat: Größe, Speicherbedarf in gängiger Quantisierung, Lizenz (kommerziell nutzbar?), verfügbar für
   welche Laufzeitumgebung, belegte oder aus Quellen abgeleitete Geschwindigkeit auf einer Grafikkarte der Klasse
   RTX 5080 mit 16 GB, Eignung für deutsche Beschriftungen, bekannte Schwächen bei SVG (ungültige Syntax,
   Koordinaten außerhalb der Fläche, überlappender Text). Prüfe den Stand mit einer aktuellen Web-Recherche und
   nenne das Abrufdatum; verlasse dich nicht auf Vorwissen.
3. **Laufzeitumgebungen und Vorwärmen.** Vergleiche Ollama, llama.cpp (`llama-server`), LM Studio und eine
   Möglichkeit im Browser (WebGPU, etwa WebLLM oder transformers.js): Start- und Ladezeit, Modell im Speicher
   halten (bei Ollama `keep_alive`), Prompt-Cache für den gleichbleibenden Anfang, Abbruch laufender Anfragen,
   Strom-Ausgabe, erzwungenes Ausgabeformat (Grammatik bzw. strukturierte Ausgabe: lässt sich gültiges SVG aus der
   erlaubten Elementliste erzwingen?), Schnittstelle (OpenAI-kompatibel?), Aufwand für den Nutzer bei der
   Einrichtung unter Windows.
4. **Wege zu „erst grob, dann fein“.** Bewerte mindestens diese Ansätze mit Vor- und Nachteilen und geschätzter
   Latenz:
   a) das Modell schreibt das ganze SVG als Strom (wie heute),
   b) das Modell liefert nur eine kompakte Beschreibung des Aufbaus (zum Beispiel JSON mit Bereichen, Titeln und
   Beispieldaten, wenige hundert Tokens), und der Browser zeichnet daraus das SVG,
   c) zweistufig: lokales Modell für den sofortigen groben Stand, Cloud-Modell für die Gestaltung,
   d) Fortschreiben statt Neuzeichnen: bei einer kleinen Änderung der Idee nur die Unterschiede anfordern,
   e) Vorhersage während des Tippens (Anfrage schon bei Teilsätzen, Ergebnis verwerfen oder weiterverwenden).
5. **Einbau in SpecIt.** Skizziere, ohne Code zu ändern, wie eine lokale KI als zusätzlicher Anbieter in
   `server.mjs` neben `ask` und `askStream` passt: Erkennung, ob ein lokaler Dienst läuft, Vorwärmen beim Start
   oder beim Öffnen der ersten Seite, Rückfall auf Cloud oder Sofort-Skizze, Einstellungen über
   Umgebungsvariablen, was am Prompt für ein kleines Modell anders sein muss. Nenne die betroffenen Funktionen.
6. **Messplan.** Beschreibe ein Messverfahren, das der Koordinator auf dem Zielrechner ausführen kann: je
   Kandidat der genaue Befehl zum Laden, eine Beispielanfrage (mit der Idee „Eine App, die Teammitglieder
   wöchentlich zu 20-minütigen Kennenlerngesprächen auslost“) und was gemessen wird (Zeit bis zum ersten Zeichen,
   Tokens je Sekunde, Gesamtdauer, besteht `cleanSvg`, Qualität nach einem kurzen Kriterienkatalog). Lege dazu
   ein eigenständiges Skript `docs/analyse/messung-lokale-ki.mjs` bei (nur Node.js ohne Abhängigkeiten, spricht
   eine OpenAI-kompatible Schnittstelle unter einstellbarer Adresse an, gibt die Messwerte als Tabelle aus). Das
   Skript ist Teil der Analyse, kein Produktcode.
7. **Empfehlung.** Eine Rangfolge der drei besten Kombinationen aus Modell, Laufzeitumgebung und Ansatz, mit
   erwarteter Latenz, Risiken und dem, was vor einer Entscheidung noch gemessen werden muss. Dazu ein Vorschlag
   für zwei bis fünf Folgeaufgaben (Titel, Ziel in einem Satz, Abhängigkeiten).

## Nicht im Umfang

- Kein Einbau in SpecIt, keine Änderung an Produktcode oder Tests.
- Kein Training und keine Feinabstimmung eigener Modelle; ob sich eine Feinabstimmung lohnen würde, darf als
  Einschätzung in der Empfehlung stehen.
- Keine Bewertung von Cloud-Anbietern außer als Vergleichswert zu den Messwerten in der README.

## Abnahme

1. `docs/analyse/lokale-ki-skizze.md` enthält alle sieben Abschnitte; die Modelltabelle hat mindestens acht
   Kandidaten, davon mindestens zwei auf SVG oder Oberflächen spezialisierte.
2. Jede Aussage zu Lizenz, Speicherbedarf und Geschwindigkeit hat einen Link und ein Abrufdatum oder ist als
   Annahme gekennzeichnet. Stichprobe des Koordinators: fünf Links führen zur genannten Aussage.
3. Abschnitt 1 enthält die Rechnung von Zeichen zu Tokens zu nötiger Geschwindigkeit nachvollziehbar.
4. Die Empfehlung nennt genau eine bevorzugte Kombination und sagt, unter welchem Messergebnis sie zu verwerfen
   wäre (negativer Fall).
5. `node docs/analyse/messung-lokale-ki.mjs --help` gibt eine Bedienungsanleitung aus; ohne erreichbaren Dienst
   endet das Skript mit einer verständlichen Meldung und einem Exit-Code ungleich 0, statt abzustürzen.
6. Außerhalb von `docs/analyse/` und `docs/aufgaben/lokale-ki/ergebnisse/` ist nichts geändert.
7. `npm test` läuft durch.
