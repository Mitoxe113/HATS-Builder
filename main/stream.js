'use strict';

const fs = require('fs');
const { pipeline } = require('stream/promises');

// Schreibt einen Download-Strom (fetch-Body) in eine Datei.
//
// Warum nicht einfach file.write() in einer Schleife: Ein WriteStream meldet
// Fehler (volle Platte, vom Virenscanner gesperrte Datei, fehlende Rechte) als
// 'error'-Ereignis. Hört niemand zu, reißt Node damit den ganzen
// Hauptprozess um, und das Warten auf 'drain' käme ohnehin nie zurück.
// pipeline() hängt sich an beide Enden, achtet auf Backpressure und macht aus
// jedem Fehler ein abgelehntes Promise, das der Aufrufer normal behandeln kann.
async function schreibeInDatei(body, ziel, beiStueck) {
  let schreibFehler = false;
  const datei = fs.createWriteStream(ziel);
  // Merkt sich, ob der Fehler von der Platte kam und nicht aus dem Netz. Ein
  // Netzaussetzer ist einen zweiten Versuch wert, eine volle Platte nicht.
  datei.once('error', () => {
    schreibFehler = true;
  });
  try {
    await pipeline(async function* () {
      for await (const stueck of body) {
        if (beiStueck) beiStueck(stueck.length);
        yield stueck;
      }
    }, datei);
  } catch (err) {
    if (schreibFehler && err && typeof err === 'object') err.dauerhaft = true;
    throw err;
  }
}

module.exports = { schreibeInDatei };
