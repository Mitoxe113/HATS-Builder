# HATS Builder

[Deutsch](README.md) · **English**

HATS Builder is a Windows app that builds a complete CFW pack for your modded Nintendo Switch. Every component comes straight from its developer's official GitHub releases, always in the newest version. The interface comes in German and English, and you can switch it in the settings.

## What the app does

There are three tabs.

**Components.** Here you pick what goes into your pack. There's a search box, and clicking a version shows you what changed in that release. The app checks GitHub live, so you always get the latest version of each item. When something needs another component, the app simply enables that one for you. FPSLocker needs SaltyNX, for example. One entry is marked so you know what it is: sys-patch is a sigpatch, which means it bypasses signature checks.

**Hekate Config.** This is where you set up the boot menu. You decide which entry boots automatically, how long the boot logo stays on screen, whether Auto-NoGC is on, and a few more things. You also get a live preview of the hekate_ipl.ini that ends up in your pack. There is a separate section for blocking Nintendo's servers via DNS. It is on for emuMMC and off for sysMMC by default, and you can flip both.

**Build and SD.** The app downloads the latest versions, builds the finished SD folder and, if you want, copies it straight onto your card. It merges everything, so your saves, the Nintendo folder and your emuMMC stay untouched. Before copying it checks that the pack actually fits and tells you which of your own config files would be overwritten. Both the build and the copy can be cancelled at any time.

## Running it

Grab `HATS Builder.exe` (it's portable, just double click it) or run the installer `HATS Builder Setup.exe`. The `Switch-SD-Pack` folder is created right next to the app.

The app checks for its own updates on startup. If a newer version exists, a bar appears at the top and one click downloads the right file for you, so you don't have to go hunting on GitHub. You can also trigger the check yourself in the settings.

## Building it yourself

```
npm install
npm start        (run in dev mode)
npm run dist     (build the EXE)
```

## Notes

Your SD card should be FAT32, and the app warns you if it's exFAT. If you add a free GitHub token in the settings, the API limit jumps from 60 to 5,000 requests per hour. HATS Builder is meant for a Switch that's already modded, whether by modchip or RCM, and the `payload.bin` lands in the SD root on its own.
