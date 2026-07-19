# HATS Builder

Windows-App (Electron), die ein komplettes Nintendo-Switch-CFW-Pack für die SD-Karte baut –
**ausschließlich aus offiziellen Releases**, direkt von den GitHub-Repos der Entwickler.
Oberfläche auf **Deutsch & Englisch** (umschaltbar in den Einstellungen).

A Windows app that builds a complete Nintendo Switch CFW pack for your SD card —
**only from official releases**, straight from the developers' GitHub repos.
UI in **German & English** (toggle in Settings).

**[English](#english) · [Deutsch](#deutsch)**

---

## English

Three tabs:

- **Components** — pick what goes into the pack; versions are pulled live from GitHub.
  Dependencies auto-enable (e.g. FPSLocker → SaltyNX). `sys-patch` (sigpatch) and
  `HATS-Tools` (sthetix third-party pack) are clearly flagged.
- **Hekate Config** — boot-menu settings (autoboot, wait time, brightness, Auto-NoGC)
  and boot entries with a live `hekate_ipl.ini` preview.
- **Build & SD** — downloads the latest versions, builds the SD folder and copies it to
  the card (merge — saves, the Nintendo folder and emuMMC stay untouched).

**Run:** `dist\HATS Builder.exe` (portable) or the installer `HATS Builder Setup.exe`.
The `Switch-SD-Pack` folder is created next to the EXE.

**Dev / build:**

```
npm install
npm start        # run in dev mode
npm run dist     # build the EXE
```

**Notes:** The SD card should be **FAT32** (the app warns on exFAT). An optional free
**GitHub token** (Settings) raises the API limit from 60 to 5,000 requests/hour. Made for an
already-modded Switch (modchip or RCM); `payload.bin` is placed in the SD root automatically.

---

## Deutsch

Drei Tabs:

- **Komponenten** — auswählen, was ins Pack kommt; Versionen kommen live von GitHub.
  Abhängigkeiten werden automatisch mit aktiviert (z. B. FPSLocker → SaltyNX). `sys-patch`
  (Sigpatch) und `HATS-Tools` (Drittanbieter-Pack von sthetix) sind klar markiert.
- **Hekate-Config** — Boot-Menü-Einstellungen (Autoboot, Wartezeit, Helligkeit, Auto-NoGC)
  und Boot-Einträge mit Live-Vorschau der `hekate_ipl.ini`.
- **Erstellen & SD** — lädt die neuesten Versionen, baut den SD-Ordner und kopiert ihn auf
  die Karte (Merge — Saves, Nintendo-Ordner und emuMMC bleiben unberührt).

**Starten:** `dist\HATS Builder.exe` (portable) oder den Installer `HATS Builder Setup.exe`.
Der Ordner `Switch-SD-Pack` wird neben der EXE angelegt.

**Entwicklung / Build:**

```
npm install
npm start        # Entwicklungsmodus
npm run dist     # EXE bauen
```

**Hinweise:** Die SD-Karte sollte **FAT32** sein (die App warnt bei exFAT). Ein optionales,
kostenloses **GitHub-Token** (Einstellungen) hebt das API-Limit von 60 auf 5.000 Abfragen/Stunde.
Gedacht für eine bereits gemoddete Switch (Modchip oder RCM); `payload.bin` liegt automatisch im SD-Root.
