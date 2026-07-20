# HATS Builder

HATS Builder ist eine Windows-App, die dir ein komplettes CFW-Paket für deine gemoddete Nintendo Switch zusammenstellt. Alle Komponenten kommen direkt aus den offiziellen GitHub-Releases der jeweiligen Entwickler, immer in der aktuellsten Version. Die Oberfläche gibt es auf Deutsch und Englisch, umschalten kannst du sie in den Einstellungen.

HATS Builder is a Windows app that builds a complete CFW pack for your modded Nintendo Switch. Every component comes straight from its developer's official GitHub releases, always in the newest version. The interface comes in German and English, and you can switch it in the settings.

[English](#english) · [Deutsch](#deutsch)

## English

There are three tabs.

**Components.** Here you pick what goes into your pack. The app checks GitHub live, so you always get the latest version of each item. When something needs another component, the app simply enables that one for you. FPSLocker needs SaltyNX, for example. One entry is marked so you know what it is: sys-patch is a sigpatch, which means it bypasses signature checks.

**Hekate Config.** This is where you set up the boot menu. You decide which entry boots automatically, how long the boot logo stays on screen, whether Auto-NoGC is on, and a few more things. You also get a live preview of the hekate_ipl.ini that ends up in your pack. There is a separate section for blocking Nintendo's servers via DNS. It is on for emuMMC and off for sysMMC by default, and you can flip both.

**Build and SD.** The app downloads the latest versions, builds the finished SD folder and, if you want, copies it straight onto your card. It merges everything, so your saves, the Nintendo folder and your emuMMC stay untouched.

### Running it

Grab `HATS Builder.exe` (it's portable, just double click it) or run the installer `HATS Builder Setup.exe`. The `Switch-SD-Pack` folder is created right next to the app.

### Building it yourself

```
npm install
npm start        (run in dev mode)
npm run dist     (build the EXE)
```

A couple of notes. Your SD card should be FAT32, and the app warns you if it's exFAT. If you add a free GitHub token in the settings, the API limit jumps from 60 to 5,000 requests per hour. HATS Builder is meant for a Switch that's already modded, whether by modchip or RCM, and the `payload.bin` lands in the SD root on its own.

## Deutsch

Es gibt drei Tabs.

**Komponenten.** Hier wählst du aus, was in dein Pack kommt. Die App fragt GitHub live ab, du bekommst also immer die neueste Version. Wenn eine Komponente eine andere braucht, aktiviert die App diese einfach mit. FPSLocker braucht zum Beispiel SaltyNX. Ein Eintrag ist gekennzeichnet, damit du weißt, was er ist: sys-patch ist ein Sigpatch, umgeht also Signaturprüfungen.

**Hekate-Config.** Hier richtest du das Boot-Menü ein. Du legst fest, welcher Eintrag automatisch startet, wie lange das Boot-Logo zu sehen ist, ob Auto-NoGC an ist und noch ein paar Dinge mehr. Dazu siehst du eine Live-Vorschau der hekate_ipl.ini, die in dein Pack kommt. In einem eigenen Bereich kannst du Nintendos Server per DNS blocken. Für emuMMC ist das standardmäßig an, für sysMMC aus, und du kannst beides umstellen.

**Erstellen und SD.** Die App lädt die neuesten Versionen, baut den fertigen SD-Ordner und kopiert ihn auf Wunsch direkt auf deine Karte. Dabei führt sie alles zusammen, deine Spielstände, der Nintendo-Ordner und die emuMMC bleiben also unangetastet.

### Starten

Nimm `HATS Builder.exe` (die ist portabel, einfach doppelklicken) oder führe den Installer `HATS Builder Setup.exe` aus. Der Ordner `Switch-SD-Pack` wird direkt neben der App angelegt.

### Selbst bauen

```
npm install
npm start        (Entwicklungsmodus)
npm run dist     (EXE bauen)
```

Noch ein paar Hinweise. Deine SD-Karte sollte FAT32 sein, bei exFAT warnt dich die App. Wenn du in den Einstellungen ein kostenloses GitHub-Token hinterlegst, steigt das API-Limit von 60 auf 5.000 Abfragen pro Stunde. HATS Builder ist für eine bereits gemoddete Switch gedacht, egal ob per Modchip oder RCM, und die `payload.bin` landet von allein im SD-Root.
