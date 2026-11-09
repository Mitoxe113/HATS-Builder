## Deutsch

**Das Update der portablen Fassung klappt jetzt auch mit Umlauten im Benutzernamen.** Heißt dein Windows-Konto zum Beispiel Jürgen oder Björn, hat sich die portable EXE bisher nicht selbst aktualisieren können und nur gemeldet, dass das Update nicht gestartet werden konnte. Schuld war das kleine Hilfsskript, das die EXE austauscht: Windows PowerShell hat es mit der falschen Zeichenkodierung gelesen und den Umlaut im Pfad zerstückelt. Jetzt trägt das Skript eine eindeutige Kennung, und der Pfad kommt unverändert an. Weil die laufende Version das neue Skript noch nicht kennt, musst du dieses eine Update eventuell noch von Hand herunterladen.

**Sphaira und Themezer-NX kommen von ihrem neuen Zuhause.** Beide Projekte wurden von ihren Entwicklern in ein anderes Konto übertragen, Sphaira zu NaGaa95 und Themezer-NX in die Themezer-Organisation. GitHub leitet die alten Adressen zwar noch weiter, aber nur so lange, bis dort jemand ein neues Repository mit demselben Namen anlegt. Deshalb lädt die App jetzt direkt von den neuen Adressen. Alle anderen Komponenten habe ich gegen ihr aktuelles Release geprüft, sie passen.

## English

**Updating the portable version now works with special characters in your user name.** If your Windows account is called something like Jürgen or Björn, the portable EXE could not update itself and only reported that the update could not be started. The culprit was the small helper script that swaps the EXE: Windows PowerShell read it with the wrong character encoding and mangled the umlaut in the path. The script now carries a clear marker, and the path arrives intact. Because your current version does not know the new script yet, you may have to download this one update by hand.

**Sphaira and Themezer-NX now come from their new home.** Their developers moved both projects to a different account, Sphaira to NaGaa95 and Themezer-NX to the Themezer organisation. GitHub still redirects the old addresses, but only until someone creates a new repository under the same name. That is why the app now downloads straight from the new addresses. I checked every other component against its current release, they all match.

---

**Portable** braucht keine Installation, einfach starten. **Setup** installiert die App. / **Portable** needs no installation, just run it. **Setup** installs the app.
