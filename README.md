# HATS Builder

**Deutsch** · [English](README.en.md)

HATS Builder ist eine Windows-App, die dir ein komplettes CFW-Paket für deine gemoddete Nintendo Switch zusammenstellt. Alle Komponenten kommen direkt aus den offiziellen GitHub-Releases der jeweiligen Entwickler, immer in der aktuellsten Version. Die Oberfläche gibt es auf Deutsch und Englisch, umschalten kannst du sie in den Einstellungen.

## Was die App kann

Es gibt drei Tabs.

**Komponenten.** Hier wählst du aus, was in dein Pack kommt. Es gibt ein Suchfeld, und ein Klick auf die Version zeigt dir, was sich in dem Release geändert hat. Die App fragt GitHub live ab, du bekommst also immer die neueste Version. Wenn eine Komponente eine andere braucht, aktiviert die App diese einfach mit. FPSLocker braucht zum Beispiel SaltyNX. Ein Eintrag ist gekennzeichnet, damit du weißt, was er ist: sys-patch ist ein Sigpatch, umgeht also Signaturprüfungen.

**Hekate-Config.** Hier richtest du das Boot-Menü ein. Du legst fest, welcher Eintrag automatisch startet, wie lange das Boot-Logo zu sehen ist, ob Auto-NoGC an ist und noch ein paar Dinge mehr. Dazu siehst du eine Live-Vorschau der hekate_ipl.ini, die in dein Pack kommt. In einem eigenen Bereich kannst du Nintendos Server per DNS blocken. Für emuMMC ist das standardmäßig an, für sysMMC aus, und du kannst beides umstellen.

**Erstellen und SD.** Die App lädt die neuesten Versionen, baut den fertigen SD-Ordner und kopiert ihn auf Wunsch direkt auf deine Karte. Dabei führt sie alles zusammen, deine Spielstände, der Nintendo-Ordner und die emuMMC bleiben also unangetastet. Vor dem Kopieren prüft sie, ob das Pack überhaupt draufpasst, und sagt dir, welche deiner eigenen Konfigurationsdateien überschrieben würden. Sowohl das Erstellen als auch das Kopieren lässt sich jederzeit abbrechen.

## Starten

Nimm `HATS Builder.exe` (die ist portabel, einfach doppelklicken) oder führe den Installer `HATS Builder Setup.exe` aus. Der Ordner `Switch-SD-Pack` wird direkt neben der App angelegt.

Die App sucht beim Start selbst nach Updates. Gibt es eine neuere Version, erscheint oben ein Balken und ein Klick lädt dir die passende Datei herunter, du musst also nicht mehr auf GitHub nachschauen. Die Prüfung kannst du auch jederzeit in den Einstellungen anstoßen.

## Selbst bauen

```
npm install
npm start        (Entwicklungsmodus)
npm run dist     (EXE bauen)
```

## Hinweise

Deine SD-Karte sollte FAT32 sein, bei exFAT warnt dich die App. Wenn du in den Einstellungen ein kostenloses GitHub-Token hinterlegst, steigt das API-Limit von 60 auf 5.000 Abfragen pro Stunde. HATS Builder ist für eine bereits gemoddete Switch gedacht, egal ob per Modchip oder RCM, und die `payload.bin` landet von allein im SD-Root.
