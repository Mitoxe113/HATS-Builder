# HATS Builder

Windows-App zum Erstellen eines kompletten Nintendo-Switch-CFW-Packs für die SD-Karte –
**ausschließlich aus offiziellen Releases**, direkt von den GitHub-Repos der Entwickler.

![Ansichten: Komponenten · Hekate-Config · Erstellen & SD](.)

## Was die App macht

1. **Komponenten** – Auswählen, was ins Pack kommt. Versionen werden live von GitHub
   abgefragt, gruppiert in fünf Kategorien:
   - **Basis:** Atmosphère, Hekate + Nyx
   - **Homebrew-Apps:** Homebrew App Store, JKSV, ftpd, NX-Shell, EdiZon, Goldleaf,
     DBI (English), Sphaira, CyberFoil, Switch 90DNS Tester, Battery Desync Fix
   - **System-Module:** nx-ovlloader, sys-clk (Basis), sys-patch, emuiibo, SaltyNX, MissionControl
   - **Tesla-Overlays:** Ultrahand, EdiZon Overlay, FPSLocker, QuickNTP,
     Status Monitor Deux, Sysmodules Overlay, sys-clk Overlay
   - **Tools & Extras:** Lockpick_RCM, HATS-Tools, Theme-Patches

   Abhängigkeiten (z. B. Ultrahand → nx-ovlloader, FPSLocker → SaltyNX) werden automatisch
   mit aktiviert. Zwei Komponenten sind bewusst markiert: **sys-patch** (Sigpatch –
   umgeht Signaturprüfungen) und **HATS-Tools** (Drittanbieter-Pack von sthetix).

   **Versions-Abfragen & Rate-Limit:** GitHub erlaubt ohne Anmeldung nur 60 API-Abfragen pro
   Stunde – deshalb konnte früher „nicht erreichbar“ / „Rate-Limit“ erscheinen. Die App
   minimiert den Verbrauch jetzt über einen Platten-Cache (15 min TTL) und ETag-Abfragen
   (unveränderte Releases antworten mit `304` und zählen **nicht** gegen das Limit). Wer
   ganz sicher gehen will, hinterlegt unten im Komponenten-Tab ein kostenloses
   **GitHub-Token** (keine Berechtigungen nötig) → 5.000 Abfragen/Stunde. Der Token wird
   nur lokal gespeichert. Bei erschöpftem Limit zeigt die App die zuletzt bekannten
   Versionen aus dem Cache und nennt die Reset-Uhrzeit.

2. **Hekate-Config** – Boot-Menü-Einstellungen (Autoboot, Boot-Wartezeit, Helligkeit,
   Auto-NoGC …) und Boot-Einträge mit Live-Vorschau der `hekate_ipl.ini`.
3. **Erstellen & SD** – Lädt die neuesten offiziellen Versionen, baut den fertigen
   SD-Ordner und kopiert ihn auf Wunsch direkt auf die SD-Karte (Merge – Saves,
   Nintendo-Ordner und emuMMC bleiben unberührt).

**Sprache & Einstellungen:** Über den Button unten links öffnet sich ein
Einstellungen-Fenster. Die komplette Oberfläche (inkl. Komponenten-Beschreibungen
und Fehlermeldungen) ist auf **Deutsch und Englisch** umschaltbar; die Auswahl
wird gespeichert.

## Starten

**Fertige App:** `dist\HATS Builder.exe` (portable, einfach doppelklicken)
oder den Installer `dist\HATS Builder Setup.exe` ausführen.

Der Ordner `Switch-SD-Pack` wird standardmäßig **neben der EXE** angelegt
(bzw. im Projektordner im Dev-Modus) – änderbar über „Ändern“ im Erstellen-Tab.

**Entwicklungsmodus:**

```
npm install
npm start
```

**EXE neu bauen:**

```
npm run dist
```

## Hinweise

- Alle Komponenten kommen direkt aus dem **offiziellen GitHub-Repo des jeweiligen
  Entwicklers** – kein Umpacken über Dritte. Ausnahmen sind klar markiert:
  **sys-patch** (Sigpatch) und **HATS-Tools** (Pack von sthetix).
- Downloads werden gecacht (`%APPDATA%\hats-builder\download-cache`),
  erneutes Bauen ist daher schnell und offline möglich.
- Die SD-Karte sollte mit **FAT32** formatiert sein – die App warnt bei exFAT.
- Erstellt für den Einsatz auf einer bereits gemoddeten Switch (Modchip oder RCM).
  `payload.bin` liegt für Modchips automatisch im SD-Root.

## Aufbau

```
main/            Electron-Hauptprozess
  components.js  Komponenten-Registry (Repos + Installationsregeln)
  github.js      GitHub-Release-Abfrage (Cache, ETag, Token)
  builder.js     Download, Entpacken, Abhängigkeits-Auflösung, Pack-Aufbau
  hekate.js      Generator für bootloader/hekate_ipl.ini
  sd.js          SD-Karten-Erkennung + Kopieren
  devtest.js     Smoke-/UI-Tests (nur mit HATS_SMOKE=1 aktiv)
renderer/        UI (HTML/CSS/JS, dunkles Theme) + icon.png
tools/           make-icon.js – erzeugt build/icon.ico + renderer/icon.png
build/           icon.ico (Windows-App-Icon)
```
