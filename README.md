<p align="center">
  <img src="assets/logo-specit.svg" alt="SpecIt logo" width="240">
</p>

# SpecIt.

**From idea to actionable agent tasks.**

Generischer Spec-Driven-Development-Assistent. Pair Pressure ist nur ein auswählbares Beispiel; das Werkzeug ist für beliebige Projekte vorgesehen.

## Start

Node.js 22+; keine npm-Abhängigkeiten.

### Windows (Doppelklick)

1. Repository auschecken (`git clone https://github.com/ccogit/SpecIt.git`) oder ZIP entpacken.
2. Falls noch nicht vorhanden, [Node.js 22 oder neuer](https://nodejs.org/) installieren.
3. Im Projektordner `start-windows.cmd` doppelklicken. Das Skript prüft Node.js, lädt eine vorhandene `.env`, startet den lokalen Server und öffnet nach erfolgreichem Start den Standardbrowser. Ohne `.env` ist der Demo-Modus verfügbar, sofern kein API-Schlüssel in der Umgebung gesetzt ist.
4. Das Konsolenfenster geöffnet lassen. Wird SpecIt im Browser geschlossen (letzter Tab oder der Browser selbst), beendet sich der Server nach wenigen Sekunden von selbst und gibt den Port frei; das Konsolenfenster schließt sich dann. Ein Neuladen der Seite beendet ihn nicht. `Strg+C` beendet ihn ebenfalls; mit `SPECIT_KEEP_RUNNING=1` in `.env` läuft er weiter. Bei einem Startfehler bleibt die Fehlermeldung sichtbar. Der Standardport ist 3000 und kann über `PORT` in `.env` angepasst werden.

Es sind weder Administratorrechte noch `npm install` noch eine Änderung der PowerShell-Ausführungsrichtlinie notwendig.

### Terminal (plattformübergreifend)

```bash
git clone https://github.com/ccogit/SpecIt.git
cd SpecIt
npm start
```

Öffne http://127.0.0.1:3000. Der Demo-Modus verwendet einen allgemeinen Fragenkatalog mit Standards und einen ausdrücklich generischen Implementierungsplan, keine KI-Analyse.

### Claude aktivieren

Der Schalter „Claude aktivieren“ in der Kopfzeile ist immer bedienbar; die Wahl wird gemerkt. SpecIt nutzt einen von zwei Zugängen:

- **Claude Code (ohne API-Schlüssel):** Ist `claude` installiert und angemeldet, ruft der Server es lokal im Print-Modus auf – ohne Werkzeuge, außerhalb des Projektordners, über die bestehende Anmeldung und deren Kontingent. Modell über `CLAUDE_CODE_MODEL` (Standard `sonnet`); mit `SPECIT_NO_CLAUDE_CODE=1` lässt sich dieser Weg abschalten.
- **Anthropic API:** .env.example nach .env kopieren und ANTHROPIC_API_KEY setzen, ggf. ANTHROPIC_MODEL. Ein gesetzter Schlüssel hat Vorrang. Die API wird separat abgerechnet; der Schlüssel verbleibt serverseitig.

Ist keiner der beiden Zugänge vorhanden, erklärt die Oberfläche beim Einschalten, was fehlt, und bleibt im Demo-Modus. Nach Änderungen neu starten. Die App ist kein separat gehosteter Agent.

### Stitch-Layouts aktivieren (optional)

Setze `STITCH_API_KEY` in `.env` (oder in der Umgebung) und starte neu. Bei der Spezifikation (Schritt 3) steht dann in der Gruppe „Name, Layout und Logo“ der Bereich „UI-Layouts“ mit dem Schalter „Entwürfe erstellen“; das Logo liegt in derselben Gruppe und lässt sich dort über die Anzahl der Entwürfe ein- und ausschalten. Dort die Anzahl Varianten (1–5) und das Zielgerät wählen und „Layouts generieren“ starten. SpecIt legt ein Stitch-Projekt an, erzeugt ein Basis-Layout aus der Spezifikation und daraus die weiteren Varianten; das dauert einige Minuten. Der Link zum Stitch-Projekt wird angezeigt und lässt sich kopieren, die Varianten erscheinen als Vorschau (Screenshot öffnen, HTML herunterladen). Der Link wird als unverbindliche Layout-Referenz in die exportierten Agent-Aufträge übernommen. Der Schlüssel verbleibt serverseitig; Projektname und Spezifikation werden dabei an Google Stitch übermittelt.

## Ablauf

Leitidee: so wenig eigener Prompt-Text wie möglich. Ein Satz genügt; alles Weitere wird erfragt und lässt sich per Klick beantworten. Die Oberfläche führt durch vier Schritte, die über die Leiste oben jederzeit erreichbar sind.

**↺ Zurücksetzen** in der Kopfzeile leert mit einem Klick alles Angegebene und Beantwortete (Projektname, Idee, Modus, Dauer, Antworten, Spezifikation, Agent Tasks) – ohne Rückfrage, dafür 20 Sekunden lang über „Rückgängig“ widerrufbar.

Die Kopfzeile zeigt Projektname und die vier Schritte. Eine feste Leiste am unteren Rand trägt „Zurück“ und – auf jeder Ansicht an derselben Stelle – den Knopf zum nächsten Schritt. Solange Claude, Codex oder Stitch arbeitet, zeigt sie dazwischen, woran gearbeitet wird, die Laufzeit und „Abbrechen“. Die Oberfläche hält Text knapp: Unter den Reglern steht nur die gewählte Stufe als kurzer Satz, Erklärungen stehen hinter den Info-Symbolen (ⓘ) und erscheinen beim Überfahren mit der Maus oder bei Tastaturfokus.

1. **Idee** – einen Satz schreiben. Eine vorhandene Spezifikation lässt sich stattdessen direkt einfügen.
   - **Voreinstellungen** stellen mehrere Regler mit einem Klick ein: „Schnellste Umsetzung“, „Ausgewogen“, „Bestes Ergebnis“, „Überraschendes Ergebnis“ und „Volle Kontrolle“. Sie setzen Modus, eigene Ideen der KI, Zielvorgabe und die Zahl der Layout-Entwürfe; Einsatzbereich und Name bleiben unberührt. Nach einer Änderung von Hand steht dort „eigene Einstellung“.
   - Der **Entscheidungsmodus** hat sechs Stufen, jede mit ihrer Bedeutung statt eines Prozentwerts: „fragt bei allem nach“ (keine Annahmen, keine Standards, nichts vorausgewählt), „fragt bei fast allem nach“, „fragt bei allen wichtigen Entscheidungen nach“, „fragt nur bei richtungsweisenden Entscheidungen nach“, „fragt nur bei den wenigen grundlegenden Entscheidungen nach“ und „entscheidet alles selbst“ (Auto-Modus: ohne Rückfragen direkt zur Spezifikation). Was SpecIt selbst entscheidet, ist als Annahme gekennzeichnet. Der Regler wirkt auch nachträglich; eigene Antworten bleiben dabei erhalten.
   - **Kreativität der KI** (fünf Stufen): von „setzt nur um, was du vorgibst“ bis „denkt das Konzept kreativ weiter“. Eigene Ideen stehen in der Spezifikation als „Vorschlag der KI“ und in der Feature-Liste mit dem Kennzeichen „Idee der KI“. Wirkt nur mit Claude.
   - **Einsatzbereich** (fünf Stufen): von „privat und locker“ bis „formell und arbeitsbezogen“. Bestimmt Ansprache und Ton der Oberflächentexte sowie die optische Gestaltung der entstehenden Anwendung – in der Spezifikation und in den Stitch-Layouts.
   - Die **Ziel-Entwicklungsdauer** ist ein Regler mit neun Stufen: keine Vorgabe, 15 und 30 Minuten, 1, 2 und 4 Stunden, 1 und 2 Tage, 1 Woche. Gemeint ist die reine Laufzeit der Coding-Agenten, nicht menschliche Entwicklungszeit; Agenten schreiben und testen Code in Minuten. Zu jeder Stufe steht ein Richtwert, was in dieser Zeit ungefähr entsteht. Sobald die Features der Spezifikation bekannt sind, zeigt der Regler, ob ihr Aufwand in die gewählte Dauer passt. Mit Claude wird der Umfang darauf zugeschnitten.
   - **UI-Layouts mit Stitch**: Ein Schieberegler legt die Anzahl der Entwürfe fest (0 = keine). Erzeugt und ausgewählt werden sie bei der Spezifikation, in der Gruppe „Name, Layout und Logo“.
   - **Name der Anwendung**: entweder selbst eintragen – er wird dann schon in der Spezifikation verwendet – oder per Schieberegler die Anzahl der Namensvorschläge wählen (0 = keine). Die Vorschläge erscheinen über der Spezifikation; ein Klick übernimmt den Namen und zieht ihn in der Spezifikation nach, „Neue Vorschläge“ erzeugt weitere. Mit Claude sind es passende Namen mit kurzer Begründung, im Demo-Modus nur Wortkombinationen aus der Idee.
   - **Kurzfassung der Spezifikation, live:** Unter dem Ideenfeld schreibt Claude nach einer kurzen Tipp-Pause die Kurzfassung – sieben Abschnitte (eine kleine Szene, dann Ziel, Nutzer, Funktionen, UX, Technik, Qualität), rund 300 Wörter. Der Text erscheint als Strom: erstes Wort nach gut einer Sekunde, fertig nach etwa zehn. Es schreibt dasselbe Modell wie die Spezifikation (zum Vergleich lässt sich mit `SPECIT_CONCEPT_MODEL` ein anderes vorgeben). Ohne Claude steht dort nur ein Hinweis.
   - **Entscheidungen stehen im Text:** Wo die Idee etwas offen lässt, trifft Claude eine Annahme und markiert genau diese Stelle (gelb). Ein Klick zeigt die Frage mit zwei, drei Optionen und einem Feld für eine eigene Antwort; die Wahl steht sofort grün im Satz. „Alles akzeptieren“ übernimmt alle Annahmen auf einmal. Weicht eine Festlegung von dem ab, wofür der Text geschrieben wurde, pulsiert „Neu schreiben“ – ein Klick gleicht den ganzen Text an. Festlegungen, die im Text keine eigene Stelle haben, und Änderungswünsche stehen als Marken unter dem Text.
   - **Änderungswunsch:** Im Feld unter der Kurzfassung lässt sich in eigenen Worten sagen, was anders werden soll. Neu geschrieben werden nur die Abschnitte, die der Wunsch betrifft; er gilt bei jedem späteren Neuschreiben weiter, bis er entfernt wird.
   - **Regler wirken auf den Text – und nur auf die betroffenen Abschnitte:** Der Einsatzbereich schreibt Ziel und UX neu, die Zieldauer Funktionen, Technik und Qualität, die Kreativität Funktionen und UX. Der Entscheidungsmodus ändert den Text nicht. Eine geänderte Idee schreibt alles neu.
   - Die frühere **Live-Skizze** (Drahtmodell der Anwendung) ist ausgeblendet; ihr Code steht noch in `public/index.html` (`SKETCH`) und ist für später, nach dem Konzept, vorgesehen.
   - **Regler als Prompt-Modulatoren:** Je Regler gibt es genau einen Eintrag (`modulators` in `interview.mjs`) mit dem Satz, der in den Prompt eingeht. Die Zielzeit bestimmt die Komplexität in acht Stufen (15 Minuten bis 1 Woche): von einer einzigen Ansicht mit einem Kernablauf bis zu sechs Bereichen mit Seitennavigation, Suche, Filtern, Benutzerkonto und Statusleiste.
   - **Stand je Regler:** Ein Zeichen zeigt je Einstellung, wer den Wert gesetzt hat: „?“ (gelb) = voreingestellt und noch nicht bestätigt, „✓“ (grün) = von dir bestätigt oder eingestellt, „!“ (rot) = fehlt. Ein Klick auf die Zeile bestätigt einen voreingestellten Wert. Rot ist nur eine fehlende Ziel-Entwicklungsdauer; solange sie fehlt, geht es nicht weiter.
   - **Marke und Witz** folgen dem Einsatzbereich: Bei „privat und locker“ bekommt die Anwendung ein durchgängiges, augenzwinkerndes Branding – Name mit Wortspiel, Claim und Tagline, dazu eigene Bezeichnungen für alle Funktionen (in der Spezifikation als Tabelle „Funktion → Bezeichnung in der App“; die sachliche Funktion bleibt als Unterzeile erkennbar, Fehlermeldungen und Sicherheitsabfragen bleiben klar). Stufe für Stufe nimmt das ab; bei „formell und arbeitsbezogen“ gibt es einen beschreibenden Namen und keinerlei Humor.
   - **Logo-Entwürfe** (optional, 0–5): Claude zeichnet quadratische Bildmarken als SVG. Sie erscheinen bei der Spezifikation in der Gruppe „Name, Layout und Logo“; dort lässt sich die Anzahl ändern (0 = aus), einer auswählen und als `logo.svg` laden. Das gewählte Logo steht ohne weiteres Zutun neben der Überschrift der Spezifikation (und damit im PDF); bei der direkten Umsetzung liegt es als `design/logo.svg` im Zielordner, und die Aufträge verweisen darauf. Jedes SVG wird auf eine feste Auswahl harmloser Elemente und Attribute zurückgeschnitten, bevor es angezeigt wird.
   - **Review der Spezifikation** (optional): Die fertige Spezifikation wird noch einmal von einem Agenten geprüft – auf Widersprüche, Lücken, nicht prüfbare Anforderungen und unnötige Komplexität gemessen an der Zielzeit. Zur Wahl stehen die Anbieter, die auf dem Rechner eingerichtet sind: Claude (über Claude Code mit Haiku 5.5, Sonnet 5.5, Opus 5.5 oder Fable 5.2; mit API-Schlüssel das dort eingestellte Modell) und Codex, wenn die Codex-CLI installiert und angemeldet ist (Modelle aus deren eigener Liste; läuft nur lesend, außerhalb des Projektordners; abschaltbar mit `SPECIT_NO_CODEX=1`). Als Entscheidungshilfe steht bei jedem Claude-Modell das Verhältnis der Tokenkosten zu Sonnet 5.5 (Listenpreise je Million Token, Stand 03.11.2026: Haiku 5.5 0,05×, Sonnet 5.5 1×, Opus 5.5 2×, Fable 5.2 4×); für Codex-Modelle liefert die CLI keine Preise. Dazu kommt ein grober, nicht gemessener Richtwert für die Laufzeit (Haiku 5.5 0,6×, Sonnet 5.5 1×, Opus 5.5 1,5×, Fable 5.2 2,5×). Dieselbe Auswahl in derselben Form gibt es bei der direkten Umsetzung als „Modell der Agenten“. Die Befunde stehen im Feld „Review“ neben der Spezifikation; „Einarbeiten“ übernimmt den jeweiligen Vorschlag. Bei Codex gehen die Projektdaten an OpenAI.
> **Fragen und Spezifikation in einer Ansicht:** Die Fragen stehen links an der Stelle des Dokuments, solange es noch keine Spezifikation gibt; danach steht dort das Dokument, und die Antworten bleiben rechts unter „Entscheidungen“ änderbar. In der Kopfzeile gibt es deshalb drei Schritte (Idee, Spezifikation, Umsetzung). Der getrennte Ablauf mit eigenem Schritt „Fragen“ lässt sich wiederherstellen, indem in `public/index.html` die Konstante `MERGED` auf `false` gesetzt wird.

2. **Fragen** – SpecIt leitet aus dem Satz Fragen zu Ziel, Nutzern, Funktionen, UX, Technik und Qualität ab. Jede Frage hat 2–5 Antwortoptionen, eine davon als begründeter Standard vorausgewählt. Bestätigen per Klick oder Tastatur (`1`–`5` wählen, `Enter` übernehmen), „Alle Standards übernehmen“ beantwortet alle offenen Fragen auf einmal, „Eigene Antwort“ und „Eigene Anforderung ergänzen“ sind die Ausnahme für Freitext. Gibt es eine Kurzfassung, sind ihre markierten Stellen die ersten Fragen (Thema = Abschnitt, Standard = die Annahme im Text); Claude ergänzt nur, was für eine umsetzbare Spezifikation noch fehlt, bis zu 14 insgesamt, und formuliert Stichwort-Fragen zu ganzen Sätzen aus. Kurzfassung und Fragen bleiben in beide Richtungen synchron: Eine Wahl im Text entscheidet die Frage, eine Antwort auf die Frage färbt die Stelle im Text. Mit Claude sind die Fragen auf die Idee zugeschnitten und lassen sich nachschärfen („Weitere Fragen ableiten“); die Demo nutzt einen allgemeinen Fragenkatalog.
   - Die **Pegelanzeige „Minimal-Konzept“** zeigt nach jeder Antwort, wie viel des implementierungsfähigen Minimal-Konzepts steht: sechs Themen-Segmente, jedes gefüllt nach dem Anteil seiner beantworteten Fragen; 100 % = alle Themen gedeckt.
   - Die **Bilanz** in der Kopfzeile stellt den Input nach Quelle dem Output nach Artefakt gegenüber: Nutzer (getippte Wörter, Klicks, eigene Festlegungen), Standard (übernommene Standardantworten und der feste Kontext von SpecIt in den Anfragen an die KI) und KI (erzeugte Zwischenergebnisse) – gegenüber Spezifikation, Aufträgen und, bei direkter Umsetzung, den Dateien und Zeilen im Zielordner nach Art (Code, Tests, Dokumentation …). Ein Klick öffnet die Übersicht. Wird es neben der Navigation eng, fallen erst die Zusatzzahlen weg, dann die ganze Leiste.
   - Rechts wächst die Spezifikation live mit. Einzeln bestätigte Antworten gelten als entschieden, per Sammelaktion übernommene Standards bleiben als „Annahme (Standard)“ gekennzeichnet, offene Fragen erscheinen als offene Entscheidungen.
3. **Spezifikation** – konsolidierten Entwurf erzeugen und als formatiertes Dokument lesen („Ansicht“); über „Bearbeiten“ auf den Markdown-Editor umschalten, als SPEC.md laden. Die Antwort kommt als Strom und beginnt nach gut einer Sekunde. Jede erzeugte Spezifikation beginnt mit einem **Inhaltsverzeichnis**, dessen Einträge in der Ansicht und auf GitHub zu den Abschnitten springen; nach Änderungen über den Katalog wird es neu gebildet.
   - **Bausteine:** Die Spezifikation besteht aus drei Teilen. Ohne KI stehen sofort da: Titel, Idee, Rahmen, die Feature-Liste, die Entscheidungen und Annahmen, die offenen Entscheidungen sowie übertragbare Abschnitte – nichtfunktionale Standards mit Abnahme (NFR-901 ff., je nach Zieldauer 3 bis 11), Betrieb und Übergabe, Standard-Risiken, Abnahme (`blocks.mjs`). Claude schreibt nur den projektspezifischen Kern dazwischen: Ziel und Nicht-Ziele, Nutzer, Kernabläufe, funktionale Anforderungen, projektspezifische Zusatzanforderungen, UX, Daten und Schnittstellen, Risiken. Die Kurzfassung der Idee-Seite geht als Grundlage ein.
   - **Ansicht in Kapiteln:** Links steht die Kapitelliste (▪ = Baustein von SpecIt), rechts immer ein Kapitel; „Ganzes Dokument“ zeigt alles am Stück. Der „Überblick“ zeigt Kennzahlen als Kacheln und darunter die Kurzfassung mit denselben anklickbaren Entscheidungen wie auf der Idee-Seite. Anforderungen sind aufklappbar: Kennung und Titel stehen da, Einzelheiten und Abnahme auf Klick. Download und PDF enthalten immer das ganze Dokument.
   - **Aktualisieren statt neu schreiben:** Ändert sich nach dem Erstellen eine Entscheidung, eine Zusatzanforderung, die Zieldauer oder die Feature-Auswahl, pulsiert „Spezifikation aktualisieren“. Claude bekommt die bisherige Spezifikation und die Änderungen in Worten und liefert nur, was sich ändern muss: in Kapiteln mit benannten Einträgen (FR-006, A3, „Navigation:“) nur die geänderten und neuen Einträge, sonst das ganze Kapitel. SpecIt setzt sie anhand der Kennung ein (`entries.mjs`); Rahmen und Bausteine kommen frisch, alles Übrige bleibt wörtlich. Die Meldung nennt, was sich geändert hat, und die Kapitel tragen in der Liste die Marke „neu“. Bei geänderter Idee oder verstelltem Ton wird die ganze Spezifikation neu geschrieben. Der Umfang (Features) wird beim Aktualisieren nicht neu ermittelt.
   - **Name, Layout und Logo** stehen als Gruppe in der rechten Spalte; ausgeschaltete Teile sind ausgegraut und lassen sich dort einschalten.
   - **Umfang zuerst:** Bevor die Spezifikation geschrieben wird, legt SpecIt aus Idee und Entscheidungen die Feature-Liste mit Aufwand fest und prüft sie gegen die Zielzeit. Passt der Umfang nicht, steht sofort ein Vorschlag bereit. Erst wenn Auswahl und Zielzeit stimmen, entsteht mit „Spezifikation erstellen“ die Spezifikation – für genau diese Features. So wird kein Konzept geschrieben, das danach gekürzt und neu geschrieben werden müsste. Geschrieben wird die Spezifikation nie von selbst, auch nicht im Auto-Modus: Nach dem Ermitteln des Umfangs pulsiert „Spezifikation erstellen“; wer trotz Überschreitung der Zielzeit schreiben lässt, bestätigt das ausdrücklich.
   - **Freie Zeit nutzen:** Liegt die geschätzte Dauer spürbar unter der Zielvorgabe (mindestens 10 % frei), ergänzt Claude auf Knopfdruck weitere nützliche Features, die zusätzlich hineinpassen. Sie kommen als abwählbare Erweiterungen dazu, gekennzeichnet als Vorschlag der KI; „Spezifikation aktualisieren“ arbeitet sie ein.
   - **Sofort-Vorschlag für die Zielzeit:** Schon beim Ermitteln der Features liefert Claude je Feature eine Schlank-Fassung (was bleibt, was entfällt, wie lange sie dauert) und einen Rang. Daraus entsteht der Vorschlag für die Zielzeit ohne weiteren KI-Aufruf – auch live, wenn die Zielvorgabe im Feld „Features“ verschoben wird. Claude wird nur noch gefragt, wenn auch die Schlank-Fassungen nicht reichen.
   - **Name der Anwendung:** Eine eigene Karte über der Spezifikation zeigt den gewählten Namen und die Vorschläge und nimmt einen eigenen Namen entgegen. Die Vorschläge entstehen schon mit dem Umfang, damit der Name gleich in der Spezifikation steht.
   - Vor dem Erstellen müssen alle Entscheidungen getroffen sein. Sind welche offen, fragt SpecIt nach: Entweder trifft die KI sie (vorgeschlagener Standard, als Annahme gekennzeichnet), oder man bricht ab – dann sind die Stellen, an denen noch etwas fehlt, rot markiert.
   - Mit Claude entsteht die Spezifikation sichtbar: Der Text erscheint, während er geschrieben wird.
   - Die **Feature-Liste** neben der Spezifikation nennt die enthaltenen Features mit ihrem ungefähren Aufwand für einen einzelnen Agenten (mit Claude aus der Spezifikation ermittelt und geschätzt, in der Demo aus den Antworten mit festen Annahmen). Jedes Feature lässt sich an- und abwählen, dazu „Alle aktivieren“ und „Alle deaktivieren“; das Grundgerüst bleibt immer an. Die **geschätzte Entwicklungsdauer** passt sich bei jedem Klick sofort an und wird mit der Ziel-Entwicklungsdauer verglichen. „Auswahl in die Spezifikation übernehmen“ arbeitet die Änderung ein: Abgewähltes wandert zu den Nicht-Zielen. Ohne Übernahme gibt es keine Agent Tasks.
   - Der Feature-Katalog entsteht ohne Knopfdruck: nach dem Erzeugen der Spezifikation und immer dann, wenn die Spezifikationsseite geöffnet wird und zu einer aktuellen Spezifikation noch keiner vorliegt.
   - Die Features sind zugleich die Arbeitspakete einer **Work Breakdown Structure**: Jedes trägt eine Kennung (F01 …) und seine Abhängigkeiten. Daraus ergeben sich Stufen; die breiteste Stufe ist die Zahl unabhängig voneinander entwickelbarer Pakete und damit die Obergrenze der **parallelen Agenten**, die sich für die Dauerschätzung wählen lassen. Die geschätzte Entwicklungsdauer rechnet mit dieser Zahl und den Abhängigkeiten; der reine Arbeitsaufwand steht daneben. „Struktur anzeigen“ blendet die Arbeitspakete mit Stufen und Abhängigkeiten als Schaubild ein.
   - Features sind entweder **Basis-Features** (nötig für die grundsätzliche Funktionsweise, nicht abwählbar) oder **Erweiterungen** (optional, an- und abwählbar). Mit Claude stammt die Einstufung aus der Spezifikation; in der Demo gelten das Grundgerüst und die Antworten zu den Funktionen als Basis. Die Bearbeitungszeit wird aufgeteilt angezeigt: Zeit für die Basis-Features, Zuschlag durch die gewählten Erweiterungen und die Zielmarke. **„Vorschlag für die Zielzeit“** setzt die Basis-Features und wählt der Reihe nach die Erweiterungen dazu, die mit der gewählten Agentenzahl noch in die Ziel-Entwicklungsdauer passen; dabei wird zuerst geprüft, ob mehr parallele Agenten genügen. Passt selbst die Basis nicht, sucht Claude eine Lösung statt nur abzulehnen: Basis-Features verschlanken, nicht Zwingendes zur Erweiterung herabstufen, Eigenentwicklung durch vorhandenen Code ersetzen (mit Suchbegriffen für die GitHub-Recherche) und Pakete so schneiden, dass mehr gleichzeitig geht. Der Vorschlag nennt die Maßnahmen und das Ergebnis; „Vorschlag übernehmen“ ersetzt Feature-Liste und Agentenzahl und arbeitet den neuen Umfang in die Spezifikation ein.
   - Basis ist streng gefasst: nur, was nötig ist, um den Kernablauf einmal von Anfang bis Ende durchzuführen. Benachrichtigungen und E-Mail-Versand, Rollen, Verlauf, Export, Komfort und Ähnliches sind Erweiterungen. Jedes Feature lässt sich von Hand umstufen („zur Erweiterung machen“ / „zur Basis machen“); nur das Grundgerüst bleibt Basis.
   - Überschreitet der Umfang die Zielvorgabe, erscheint der Vorschlag nach dem Erzeugen der Spezifikation von selbst, und der Knopf „Vorschlag für die Zielzeit“ ist aktiv und hervorgehoben. Ohne Claude (oder wenn Claude nicht antwortet) gibt es einen rechnerischen Vorschlag: Spätere Basis-Features werden zu Erweiterungen, bis die Basis in die Zielzeit passt.
   - Die Zielvorgabe lässt sich auch direkt in der Feature-Liste ändern; die Rechnung passt sich sofort an, und „In die Spezifikation übernehmen“ zieht die Rahmenbedingung dort nach.
   - Die Aufwandsangaben sind Schätzungen der Agenten-Laufzeit (Grundgerüst etwa 5–15 Minuten, übliches Feature 3–10, aufwendiges 15–30) und nicht an Messwerten geeicht. Die Parallelisierung wird über einen beschrifteten Schieberegler eingestellt: 1 = ein Agent arbeitet nacheinander, rechts die größtmögliche Zahl gleichzeitig arbeitender Agenten.
   - **Entscheidungen, Spezifikation und Features hängen zusammen:** Jede Antwort auf eine Frage ist eine Entscheidung, offene Fragen sind offene Entscheidungen – beides steht in einem gemeinsamen Feld „Entscheidungen“ (noch offen / getroffen). Aus den Entscheidungen entsteht die Spezifikation, aus ihr der Feature-Katalog; jedes Feature nennt die Entscheidungen, aus denen es folgt, und jede Entscheidung zeigt ihre Features. Der Abgleich läuft in beide Richtungen: Nach einer geänderten Entscheidung werden Spezifikation und Feature-Katalog nachgezogen; wird ein Feature ab- oder angewählt und übernommen, passt Claude neben der Spezifikation auch die betroffenen Entscheidungen an. Ohne Claude werden Entscheidungen nicht umgeschrieben; die betroffene Entscheidung ist dann als „Feature abgewählt“ markiert.
   - **Open-Source-Bausteine** (nur mit Claude, nur auf Knopfdruck): Claude schlägt kurze Suchbegriffe vor, der Server sucht damit tatsächlich auf GitHub, und Claude bewertet ausschließlich die gefundenen Repositories (Lizenz, Aktivität, abgedeckte Funktionen, Risiken, Empfehlung „einbeziehen“, „prüfen“ oder „nicht einbeziehen“). Nur ausdrücklich angehakte Kandidaten gehen in den Plan und die Aufträge ein – als zu prüfende Integrationskandidaten mit vorgelagertem Audit. Die Angaben stammen aus GitHub-Metadaten und ersetzen keine Prüfung von Code, Lizenz und Sicherheit. Dabei gehen aus der Spezifikation abgeleitete Suchbegriffe an GitHub.
   - Über das Feld **„Anpassen, ändern oder erweitern“** lässt sich ein Wunsch in eigenen Worten einarbeiten (Strg+Enter oder „Einarbeiten“). Mit Claude wird er an allen betroffenen Stellen eingearbeitet, ohne KI als zusätzliche Anforderung aufgenommen. Die geänderten Stellen sind wie bei geänderten Antworten hervorgehoben (teiltransparent, anfangs pulsierend) und über „Rückgängig“ zurücknehmbar. Die Markierung bleibt stehen, bis eine weitere Änderung sie ablöst oder „Markierung beenden“ gewählt wird.
   - Daneben stehen zwei gleich aufgebaute, einklappbare Felder – **Fragen-Katalog** (beantwortete Fragen) und darunter **Offene Entscheidungen** –, jeweils mit einklappbaren Unterrubriken je Thema; alles ist zunächst eingeklappt. Bedienung in beiden: Frage anklicken, Antwort wählen (Einfachauswahl wirkt sofort, Mehrfachauswahl und eigene Antwort über „Übernehmen“). Die Spezifikation wird gezielt angepasst statt neu geschrieben; die geänderten Stellen sind einige Sekunden farblich hervorgehoben, eine Leiste nennt die Änderung und bietet „Stellen zeigen“ und „Rückgängig“. Von Hand geschriebene Spezifikationen werden nie automatisch ersetzt – lässt sich eine Änderung nicht gezielt einarbeiten, wird die Spezifikation nur als zu prüfen markiert.
   - **Offene Entscheidungen** sind wie die Fragen aufgebaut: Alternativen mit begründetem Standard, per Klick wählbar. Mit Claude werden auch die offenen Entscheidungen, die erst in der Spezifikation auftauchen, als Fragen mit Alternativen übernommen (automatisch nach dem Erzeugen und nach jeder Anpassung, sonst über „Offene Entscheidungen aus der Spezifikation ableiten“). Zwei Sammelaktionen nehmen sie ab: **„Triff alle selbst“** übernimmt für jede den Standard als Annahme; **„Triff die unwichtigen selbst, frag nur nach den relevanten“** lässt nur die Entscheidungen mit großer Tragweite offen (mit Claude eingeschätzt, in der Demo sind das die zu Ziel, Nutzern und Funktionen).
   - Solange Claude oder Stitch arbeitet, zeigt die Leiste am unteren Rand – zwischen „Zurück“ und „Weiter“ –, woran gerade gearbeitet wird und seit wie vielen Sekunden; auch der Tab-Titel zeigt es, und der Browser fragt nach, bevor die Seite währenddessen geschlossen wird. Über **„Abbrechen“** in dieser Leiste lässt sich jede laufende Verarbeitung beenden: Der Server beendet den Claude-Aufruf sofort, sodass keine weiteren Kosten entstehen (bei Stitch wird nur das Warten beendet, bei einer laufenden Umsetzung werden die Agenten gestoppt).
4. **Umsetzung** – Was zum Abschließen fehlt (aktueller Plan, Zielordner), ist rot markiert, und der Hinweis führt per Klick dorthin; ein veralteter Plan lässt „Plan neu erstellen“ pulsieren. Die Aufträge einer Stufe stehen kompakt nebeneinander, mit den Knöpfen rechts übereinander. (Für die direkte Umsetzung schlägt SpecIt als Zielordner `<Home>/SpecIt-Projekte/<kurzname>` vor; der Basisordner lässt sich mit `SPECIT_PROJECTS_DIR` festlegen, etwa in der `.env`.) (Ein neues, leeres GitHub-Repository lässt sich mit „Neues Repository anlegen“ direkt erzeugen – privat oder öffentlich, über die GitHub-CLI `gh` mit deiner Anmeldung; die Adresse wird eingetragen. Abschaltbar mit `SPECIT_NO_GITHUB=1`.) optional Repository, technische Konventionen und Zielagent angeben, optional UI-Layouts über Stitch erzeugen, dann Arbeitsaufträge erstellen: Claude zerlegt die Spezifikation in konkrete Tasks, die Demo liefert ein generisches Gerüst. Abhängigkeiten, Scope, offene Entscheidungen und Abnahmekriterien prüfen; veraltete Pläne nach Änderungen neu erzeugen. Einzelne Prompts/Markdown-Dateien oder BACKLOG.md und tasks.json exportieren und an Claude Code, Codex, Cursor, Copilot oder andere Coding-Agenten übergeben.
   - **Aufträge eingeklappt:** Stufen und Aufträge sind im Standard zugeklappt (eine Zeile je Stufe mit den Titeln ihrer Aufgaben); ein Klick öffnet Stufe oder Auftrag, „Alles aufklappen“ zeigt die volle Ansicht.
   - **Parallele Umsetzung sichtbar:** Bei mehreren Agenten steht je Agent eine Spalte mit dem laufenden und den erledigten Aufträgen und einem Zeitbalken; darunter die Warteschlange mit dem Grund („nach T09“).
   - **Übergabe:** Nach einer direkten Umsetzung lässt sich das Ergebnis als ZIP laden („↓ Implementierung (ZIP)“, ohne `node_modules`, `.git` und Ähnliches) und der Zielordner im Dateimanager öffnen – auch nach einem Neustart von SpecIt (`zip.mjs`).
   - **Schätzung der Dauer, an echten Läufen ausgerichtet:** Die KI schätzt die Laufzeit je Auftrag und je Feature in Minuten mit Nachkommastellen (unter einer Minute zeigt die Oberfläche Sekunden). Nach jeder direkten Umsetzung vergleicht SpecIt Schätzung und gemessene Agentenlaufzeit und rechnet künftige Schätzungen mit dem Faktor um, getrennt für Plan und Features; neuere Läufe zählen stärker, gestoppte nicht (`calibration.mjs`). Die Messwerte liegen projektübergreifend in `~/.specit/calibration.json` (anderer Ort: `SPECIT_CALIBRATION`).
   - **Nachverfolgung:** Trägt die Spezifikation Anforderungs-IDs (`FR-001`, `NFR-001` …), zeigt der Plan, ob jede einem Auftrag zugeordnet ist, und nennt Lücken. Ein Plan mit Lücken wird nicht verworfen.
   - **Erst ein fertiges Konzept:** Solange Fragen oder Entscheidungen offen sind, die Spezifikation fehlt oder nicht aktuell ist, zeigt der Schritt statt der Aufträge einen Hinweis. Offenes wird selbst entschieden oder ausdrücklich an SpecIt abgegeben („Alle automatisch entscheiden lassen“ bzw. „Nur die unwichtigen automatisch“). Der Plan stellt danach keine Rückfragen: Was die Spezifikation festlegt, gilt als verbindlich – auch Annahmen; was sie für die Umsetzung offen lässt, legt der Plan selbst fest und weist es unter „Vom Plan getroffene Festlegungen“ aus. Blockierte Aufgaben gibt es nicht mehr.
   - **Stitch-Layouts:** Der Bereich steht bei den Agent Tasks hinter der Sperre. Sind Layouts gewünscht, werden sie dort einmal von selbst erzeugt. Ein Klick auf einen Entwurf zeigt ihn groß (Blättern mit den Pfeiltasten, Schließen mit Esc). **„Auswählen“** legt den Entwurf fest, der umgesetzt werden soll: Er geht als maßgebliche Vorlage in die Aufträge ein und wird bei „Direkt umsetzen“ als `design/layout.html` in den Zielordner gelegt; ohne Auswahl sind die Entwürfe nur unverbindliche Referenz. Über „Änderungswunsch für die Layouts“ und „Layouts neu erstellen“ entstehen neue Entwürfe; die bisherigen bleiben im Stitch-Projekt.
   - Für die Layouts lässt sich festlegen, **wofür optimiert** wird (Desktop, Mobil oder beides) und in welchem **Farbmodus** (hell, dunkel oder beides). Je Kombination entsteht die gewählte Zahl an Varianten, höchstens acht Entwürfe je Lauf; je Kombination lässt sich ein Entwurf auswählen. Der Änderungswunsch steht vor dem Knopf „Layouts neu erstellen“.
   - Der Schritt hat drei nummerierte Abschnitte. **1 · Abarbeitung festlegen:** „Nacheinander · ein Agent“ ergibt einen Gesamtauftrag, den eine KI Schritt für Schritt abarbeitet (AUFTRAG.md); „Parallel · mehrere Agenten“ ergibt mehrere Teilaufträge, die gleichzeitig bearbeitet werden, soweit sie nicht voneinander abhängen (BACKLOG.md). Die Agentenzahl wird aus der Feature-Auswahl in Schritt 3 übernommen und gilt in beiden Schritten gemeinsam; der Wechsel braucht keinen neuen Plan. **2 · Weiteres Vorgehen:** „Zum Download bereitstellen“ oder „Direkt umsetzen“. **3 · Prüfen und abschließen:** Eine Übersicht zeigt alle Festlegungen und Ergebnisse (Idee, Vorgaben, Fragen, Spezifikation, Features, UI-Entwurf, Abarbeitung, Plan, weiteres Vorgehen), jeweils mit „Ändern“ als Sprung zur passenden Stelle. Abgeschlossen wird erst mit der Bestätigung in der festen Leiste unten rechts; danach stehen die Dateien bereit bzw. startet die Umsetzung. Ändert sich danach eine Festlegung, ist erneut zu bestätigen.
   - **Direkt umsetzen** startet – nach der Bestätigung – die Umsetzung über das lokal installierte Claude Code in einem Zielordner (vollständiger Pfad, nicht der SpecIt-Ordner): mit einem Agenten als Gesamtauftrag oder mit bis zu sechs Agenten, die die Teilaufträge entlang ihrer Abhängigkeiten parallel abarbeiten. Scheitert ein Auftrag, werden seine Nachfolger nicht begonnen. Der Stand je Auftrag und die Berichte der Agenten erscheinen in der Seite; „Stoppen“ bricht ab. Die Agenten dürfen Dateien im Zielordner lesen und schreiben; Befehle (Tests, Build, Installation) nur, wenn der Schalter dafür gesetzt ist – dann ohne Rückfrage und mit den Rechten des angemeldeten Benutzers. Offene Entscheidungen treffen sie als Annahme und halten sie in ANNAHMEN.md fest. Modell und Zeitgrenze je Agent: `SPECIT_AGENT_MODEL`, `SPECIT_AGENT_TIMEOUT_MIN` (Standard 120).
   - Die **empfohlene Zahl paralleler Agenten** ergibt sich aus dem Plan und der Ziel-Entwicklungsdauer: Jeder Auftrag trägt eine geschätzte Bearbeitungszeit (mit Claude geschätzt, in der Demo feste Annahmen); daraus und aus den Abhängigkeiten wird die Gesamtdauer für 1, 2, 3 … Agenten berechnet. Empfohlen wird die kleinste Zahl, die in die Zielvorgabe passt (ein Tag = 8 Stunden, eine Woche = 5 Tage). Reicht auch die größte sinnvolle Zahl nicht, sagt SpecIt das; mehr Agenten, als je gleichzeitig Aufträge bereitstehen, bringen nichts.

Helles und dunkles Thema sind über die Kopfzeile umschaltbar (Standard: Systemeinstellung).

## Skills

Die Anweisungen an Claude werden um versionierte Richtlinien aus `skills/` ergänzt (`skills.mjs` ordnet sie den Phasen zu; die Liste ist fest, Projekteingaben können keine Skills wählen):

| Skill | Wofür | Grundlage |
|---|---|---|
| `discovery` | Fragen, offene Entscheidungen, Einstufung | angelehnt an `requirements-analysis` aus Emmraan/agent-skills (MIT) |
| `specification` | Spezifikation erzeugen, anpassen, Umfang ändern | angelehnt an GitHub Spec Kit (MIT) |
| `execution` | Plan und Aufträge | angelehnt an GitHub Spec Kit (MIT) |
| `traceability` | durchgängige Begriffe und Anforderungs-IDs, in allen Phasen | angelehnt an urban/agent-skills-spec-pack (CC0-1.0) |
| `reuse-discovery` | Open-Source-Recherche | eigene Erweiterung des Spec-first-Ansatzes |

Die Skills sind an SpecIt angepasst, keine unveränderten Kopien. Abweichend von den Vorlagen gilt: Wie viel bei der Spezifikation offen bleibt, bestimmt der Modus; der Plan stellt keine Rückfragen und blockiert keine Aufgaben, sondern legt Offenes selbst fest und weist es aus.

## Arbeitsauftrag

Jeder Task trägt ID, Ziel, Anforderungsbezug, Abhängigkeiten, Scope und Nicht-Scope, Schnittstellen, Liefergegenstände, Akzeptanzkriterien, Tests und blockierende Entscheidungen. Der Server validiert das JSON und prüft die Abhängigkeiten auf Zyklen, unbekannte IDs und doppelte IDs. Blockierte Entscheidungen propagieren zu abhängigen Tasks. Abhängigkeitsstufen sind nur potenzielle Parallelisierung, keine Garantie für Schreibkonfliktfreiheit. Der Mensch muss gemeinsame Dateibereiche und Verträge bestätigen und tatsächliche Fertigstellung der Vorgänger prüfen. Keine automatische Agent-Ausführung, GitHub-Änderungen oder Deployments. Zielagent ist ein Kontextfeld; alle Aufträge bleiben portabel.

## Qualität und Datenschutz

`npm test` prüft Planner, Fragenmodul (Standards, Pegel, Demo-Spezifikation) und die Stitch-Hilfsfunktionen, ohne Netzwerkzugriff. Ein Live-Test mit Claude benötigt Claude Code oder einen API-Key mit Guthaben. Server bindet an localhost, prüft Origin/Host und begrenzt Eingaben und parallele API-Anfragen. Entwürfe werden im Browser gespeichert; mit aktivierter KI werden Projektdaten an Anthropic übermittelt, mit aktivierter Layout-Erstellung an Google Stitch. Keine vertraulichen Daten nutzen. Keine öffentliche Bereitstellung ohne Authentifizierung, Zugriffskontrolle und Datenschutzkonzept. GitHub Pages kann das Node-Backend nicht ausführen. KI-Ausgaben stets fachlich prüfen.

## Spezifikations-Performance messen (Experiment)

Der bestehende Standard bleibt erhalten. Für einen schnellen Modellvergleich kann in der lokalen `.env`
`SPECIT_FAST_MODE=1` gesetzt werden. Dadurch verwendet SpecIt für die Erstellung der
Spezifikation und für die frühe Feature-Ermittlung `claude-haiku-5-5` mit `effort: low`.
Andere KI-Phasen behalten ihre Modellwahl. Mit `SPECIT_FINAL_MODEL`,
`SPECIT_FEATURE_MODEL` sowie `SPECIT_FINAL_EFFORT` und `SPECIT_FEATURE_EFFORT`
sind abweichende, aufgabenbezogene Konfigurationen möglich; `SPECIT_AI_EFFORT`
gilt als generelle Vorgabe, soweit für die Phase keine speziellere Einstellung gesetzt ist.
Ein API-Schlüssel verwendet die Anthropic Messages API; ohne API-Schlüssel wird Claude Code
weiterhin als lokaler CLI-Prozess aufgerufen. Die `effort`-Einstellung wird nur
bei API-Aufrufen angewendet. Nicht jedes ältere Modell unterstützt jede Einstellung.

Die Antwort der API enthält in `usage.timings` pro KI-Aufruf folgende Diagnosewerte:
`model`, `transport` (`api` oder `cli`), `streaming`, `ok`,
`totalMs`, bei gestreamter Ausgabe `firstTokenMs`, und bei API-Antworten,
soweit verfügbar, `input_tokens`, `output_tokens` sowie Cache-Token-Zähler.
Es werden **keine Eingabe- oder Ausgabetexte** in den Timing-Daten gespeichert.
Die Werte können in den Entwicklertools in der Netzwerkanzeige betrachtet werden;
die Browserkonsole meldet nach dem Erstellen zusätzlich die Gesamtdauer bis zur
fertigen Spezifikation und die angefallenen Modellaufrufe. Für vergleichbare Tests
dieselbe Projektidee, Feature-Auswahl und Zielzeit mehrfach verwenden;
P50/P95 und fachliche Vollständigkeit getrennt auswerten. Ohne API-Zugang lassen
sich keine belastbaren Modell-Benchmarks durchführen.

### Generierungsstrategie auswählen

Auf der Seite **Spezifikation** steht ein Dropdown mit vier Strategien:

| Strategie | Verhalten | Voraussetzung |
|---|---|---|
| **Intelligent** (Voreinstellung) | Bestehender Weg: Bei einer Änderung nur betroffene Kapitel/Einträge aktualisieren; bei einer neuen Spezifikation seriell alles generieren. | Claude Code oder Anthropic API |
| **Klassisch** | Bei jedem Klick den gesamten projektspezifischen Kern neu schreiben, immer sequentiell mit dem konfigurierten Standardmodell (kein Delta, kein schnelleres Modell). | Claude Code oder Anthropic API |
| **Parallel** (experimentell) | Den vollständigen Kern mit drei parallelen Modellaufrufen schreiben, Ergebnis in Kapitelreihenfolge zusammenführen. | Anthropic API |
| **Turbo** (experimentell) | Wie Parallel, aber mit Haiku 5.5 und niedrigem Denkaufwand. | Anthropic API |

Die Wahl wird lokal im Browser gespeichert und bei **jeder Erstellung** an den
Server übermittelt. Die letzte gemessene Erstellung je Strategie (in Sekunden)
erscheint als Vergleichshilfe. Das Umschalten allein verändert die gespeicherte
Spezifikation nicht. Ein vollständiger Neuaufbau verwendet weiterhin die
gewählten Features und bestätigten Entscheidungen.

**Technischer Hinweis:** Ohne einen expliziten Strategieparameter behalten
ältere API-Clients den bisherigen Weg; `SPECIT_PARALLEL_SPEC=1` aktiviert
bei solchen Alt-Clients den Parallelmodus. Eine ausdrücklich gewählte Strategie
hat immer Vorrang. `SPECIT_FAST_MODE=1` bleibt als optionaler Server-Fast-Mode
für sonstige/alte Aufrufe verfügbar; **Klassisch** erzwingt das Basismodell und
**Turbo** das schnelle Modell, auch wenn die Umgebungsvariablen anders gesetzt sind.

**Experimentell:** Parallele Fachkapitel können trotz Prüfung auf vollständige
Überschriften und korrekte Reihenfolge fachlich widersprüchlich sein. Die
Parallelausgabe ist deshalb nicht die Voreinstellung; ein Qualitätsvergleich
gegen die klassische Spezifikation ist vor der Produktivfreigabe erforderlich.
Parallelisierung kann zusätzliche Eingabetokens und API-Rate-Limits verursachen.

### Reproduzierbarer Live-Benchmark

Mit gestartetem SpecIt-Server und eingerichtetem Claude-/Anthropic-Zugang
`npm run bench -- 3 classic` ausführen (3 Wiederholungen pro Testfall: Notizen,
Teamaufgaben, Raumbuchung). Als zweites Argument können die Strategien
`classic`, `incremental`, `parallel` und `turbo` übergeben werden.
Für Parallel und Turbo ist ein API-Schlüssel nötig. Für einen anderen Port `SPECIT_BENCH_URL`
setzen. Das Skript ermittelt Dauer bis zur vollständigen Spezifikation,
Modell-Timing, API-Tokens, Vollständigkeit der acht Kapitel und P50/P95.
Es speichert und protokolliert keine Projektspezifikationstexte. Testläufe
nutzen echte API-Aufrufe und können Kosten verursachen. Die Strategien
werden pro Anfrage gewählt, ein Serverneustart ist zwischen diesen Vergleichen
nicht erforderlich. Für einen fairen Vergleich immer dieselben Eingaben und
die gleiche Anzahl Wiederholungen verwenden.
