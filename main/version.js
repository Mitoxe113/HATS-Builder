'use strict';

// Versionsvergleich für Zeichenketten wie "1.11.2", "v1.0.10" oder "22.5.0".
// Wird sowohl für das Selbst-Update der App als auch für den Abgleich zwischen
// Atmosphère und der Switch-Firmware gebraucht.

// "v1.2.3" oder "1.2.3" wird zu [1, 2, 3]
function parseVersion(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

// Zahlenweiser Vergleich, damit 1.0.10 korrekt neuer ist als 1.0.9.
// Ein reiner Textvergleich würde hier das Falsche liefern.
function isNewer(candidate, current) {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

module.exports = { parseVersion, isNewer };
