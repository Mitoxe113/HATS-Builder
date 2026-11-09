## Deutsch

**sys-patch lässt sich wieder bauen.** Wer sys-patch ausgewählt hatte, bekam beim Erstellen die Meldung *Kein passendes Release-Asset gefunden*. Der Grund: Das bisherige Repository hat seine Releases eingestellt und verweist jetzt selbst auf [impeeza/sys-patch](https://github.com/impeeza/sys-patch). Von dort kommt sys-patch ab sofort, aktuell in Version 1.6.3.0. Alle anderen Komponenten habe ich gegen ihr aktuelles Release geprüft, sie passen.

**Dein vorhandenes Pack bleibt jetzt stehen, wenn etwas nicht passt.** Bisher hat die App so ein Problem erst mittendrin bemerkt, bei sys-patch an Stelle 15 von 28. Bis dahin war der Zielordner schon ausgeräumt und dein vorher funktionierendes Pack weg. Jetzt wird vorher geprüft, ob jedes Release noch die erwartete Datei enthält. Fehlt etwas, bricht der Build sofort ab, sagt dir welche Komponente betroffen ist und fasst den Zielordner gar nicht erst an.

**Und du siehst es schon vorher.** Ändert ein Entwickler sein Release, steht auf der Karte *Release passt nicht*, und oben in der Komponenten-Ansicht erscheint ein Hinweis. Dann weißt du Bescheid, bevor du auf Erstellen drückst.

## English

**sys-patch builds again.** If you had sys-patch selected, creating a pack failed with *No matching release asset found*. The reason: the old repository stopped publishing releases and now points to [impeeza/sys-patch](https://github.com/impeeza/sys-patch) itself. That is where sys-patch comes from from now on, currently version 1.6.3.0. I checked every other component against its current release, they all match.

**Your existing pack now stays put when something does not match.** Until now the app only noticed this kind of problem halfway through, with sys-patch at step 15 of 28. By then the target folder had already been cleared and your previously working pack was gone. Now it checks up front whether every release still contains the expected file. If something is missing, the build stops right away, tells you which component is affected and does not touch the target folder at all.

**And you see it coming.** If a developer changes their release, the card says *Release mismatch* and a notice shows up at the top of the components view. So you know before you hit Create.

---

**Portable** braucht keine Installation, einfach starten. **Setup** installiert die App. / **Portable** needs no installation, just run it. **Setup** installs the app.

