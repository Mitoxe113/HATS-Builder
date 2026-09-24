'use strict';

// Vergleicht, bis zu welcher Switch-Firmware (HOS) Atmosphère reicht, mit der
// Firmware, die Nintendo zuletzt veröffentlicht hat.
//
// Warum das wichtig ist: Atmosphère hinkt einer neuen Firmware immer ein paar
// Tage bis Wochen hinterher. Wer seine Switch vorher aktualisiert, steht ohne
// laufende CFW da, und zurück geht es nicht ohne Weiteres, weil ein Update
// Fuses verbrennt. Die Zahl gehört also vor den Augen des Nutzers, bevor er
// am Gerät etwas aktualisiert.
//
// Woher die beiden Angaben kommen:
//   Atmosphère – aus dem Text des neuesten Releases. Das Projekt schreibt dort
//                seit jeher "Support was added for X.Y.Z." Ein eigenes Feld
//                dafür gibt es nicht, und das README nennt die Version nicht
//                mehr. Deshalb der Griff in den Fließtext.
//   Firmware   – aus dem Release-Tag von THZoria/NX_Firmware. Dort wird jede
//                Firmware kurz nach Erscheinen als Release angelegt. Wir lesen
//                ausschließlich die Versionsnummer über die API, es wird nichts
//                heruntergeladen und nichts mitgeliefert.

const github = require('./github');
const { isNewer } = require('./version');

const ATMOSPHERE_REPO = 'Atmosphere-NX/Atmosphere';
const FIRMWARE_REPO = 'THZoria/NX_Firmware';

// Holt die höchste Firmware-Version aus dem Release-Text heraus.
// Der Text listet auch ältere Abschnitte auf ("And the following was changed
// in 1.11.0"), darin stehen ältere Firmwares. Deshalb das Maximum und nicht
// einfach den ersten Treffer.
function parseSupportedHos(body) {
  const treffer = String(body || '').matchAll(/support\s+was\s+added\s+for\s+(\d+\.\d+(?:\.\d+)?)/gi);
  let hoechste = null;
  for (const t of treffer) {
    if (!hoechste || isNewer(t[1], hoechste)) hoechste = t[1];
  }
  return hoechste;
}

// Liefert den Stand für die Oberfläche. Schlägt eine der beiden Abfragen fehl,
// wird der jeweils andere Teil trotzdem gemeldet, statt gar nichts zu zeigen.
async function check({ force = false } = {}) {
  const ergebnis = {
    atmosphere: null, // Version von Atmosphère selbst
    supported: null,  // höchste HOS-Version, die Atmosphère unterstützt
    latest: null,     // neueste von Nintendo veröffentlichte HOS-Version
    latestDate: null,
    behind: false,    // true, wenn Atmosphère der Firmware hinterherhinkt
  };

  try {
    const atmo = await github.fetchLatestRelease(ATMOSPHERE_REPO, { force });
    ergebnis.atmosphere = atmo.tag || null;
    ergebnis.supported = parseSupportedHos(atmo.body);
  } catch {
    /* ohne Atmosphère-Release bleibt der Abschnitt leer */
  }

  try {
    const fw = await github.fetchLatestRelease(FIRMWARE_REPO, { force });
    // Tags sind dort schlicht "23.0.0", ein führendes v kommt aber vor
    ergebnis.latest = (fw.tag || '').replace(/^v/i, '') || null;
    ergebnis.latestDate = fw.publishedAt || null;
  } catch {
    /* Firmware-Stand unbekannt, dann eben nur die unterstützte Version */
  }

  ergebnis.behind = Boolean(
    ergebnis.supported && ergebnis.latest && isNewer(ergebnis.latest, ergebnis.supported)
  );
  return ergebnis;
}

module.exports = { check, parseSupportedHos, ATMOSPHERE_REPO, FIRMWARE_REPO };
