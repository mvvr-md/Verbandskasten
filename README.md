# Verbandskasten

Web-App (PWA) zur Prüfung und Nachbestellung von Verbandkästen.
Läuft komplett offline auf dem iPhone, Daten bleiben auf dem Gerät.

Testphase: <https://mvvr-md.github.io/Verbandskasten/>

## Auf dem iPhone installieren

1. Adresse in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. App über das neue Symbol starten (Vollbild, funktioniert offline).

## Bedienung

- **Startseite:** Kacheln je Gebäude mit Status. Suche springt direkt zur Einrichtung.
- **Gebäude:** Einrichtungen mit Status und Prüfplakette. Filter ab 5 Einrichtungen.
  „Bestellung für dieses Gebäude“.
- **Einrichtung:** Prüfansicht des Verbandkastens. Istmenge mit großen Plus/Minus-Knöpfen,
  Haltbarkeit (Monat/Jahr), „Aufgefüllt“ je Position, „Alles aufgefüllt“ für alle Fehlpositionen,
  „Prüfung abschließen“ (Protokolleintrag und nächste Prüfung).
- **Status:** grün ✓ vollständig · gelb ! läuft in den nächsten 3 Monaten ab ·
  rot ✕ Fehlmenge oder abgelaufen (bzw. Prüfung überfällig).
- **Bestellung** auf drei Ebenen (Einrichtung, Gebäude, gesamt):
  Fehlmenge = Soll − Ist, abgelaufene Position = komplette Sollmenge.
  Bei Gebäude und gesamt enthält die E-Mail nur die Summe je Artikel und die Lieferadresse.
  Die **Verteilliste** (welche Einrichtung bekommt was) wird nur in der App angezeigt.
  „E-Mail schreiben“ öffnet einen Entwurf in der Mail-App, gesendet wird erst dort.
- **Einstellungen:** Bestelladresse, Lieferadresse, Prüfintervall (Standard 12 Monate),
  JSON-Export/-Import, Version.

## Wichtig: Datensicherung

Die Daten liegen nur im Speicher der App auf diesem Gerät (localStorage).
**Regelmäßig exportieren.** Die App nicht vom Home-Bildschirm löschen, ohne vorher zu
exportieren – sonst sind die Daten weg.

Export-Dateien (`verbandskasten-JJJJ-MM-TT.json`) enthalten echte Standortdaten und
gehören **nicht** in dieses öffentliche Repository (siehe `.gitignore`).

## Vorlagen

DIN 13157 (Betrieb klein), DIN 13169 (Betrieb groß), DIN 13164 (Kfz) und „leer“.
Die Inhalte sind Beispiele mit Platzhalter-Artikelnummern (`ART-0001` …).
Vor dem Einsatz mit dem aktuellen Normblatt und der Lieferantenliste abgleichen.

## Datenschutz

- Keine personenbezogenen Daten (keine Prüfernamen).
- Keine externen Dienste, Schriften oder CDNs. Nichts wird übertragen –
  außer der Bestell-E-Mail, die der Nutzer selbst in der Mail-App absendet.
- Im Code stehen nur neutrale Beispieldaten („Gebäude A“, „Gebäude B“) und
  Platzhalter-Adressen (`example.invalid`). Echte Adressen werden nur in der App
  in den Einstellungen eingetragen.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | gesamte App (HTML, CSS, JavaScript) |
| `version.js` | einzige Versionsnummer |
| `storage.js` | Datenspeicherung (Schnittstelle + Adapter) |
| `sw.js` | Service Worker (Offline-Cache, Updates) |
| `manifest.webmanifest` | App-Name, Symbole, Startadresse |
| `icons/` | App-Symbole (erzeugt mit `tools/make-icons.js`) |
| `tools/serve.js` | lokaler Testserver |

## Entwicklung

Voraussetzung: [Node.js](https://nodejs.org/) (keine weiteren Pakete nötig).

```sh
node tools/serve.js          # → http://localhost:8080/Verbandskasten/
node tools/make-icons.js     # Symbole neu erzeugen
```

### Neue Version veröffentlichen

1. Änderungen machen und lokal testen.
2. In `version.js` die Version erhöhen (z. B. `1.0.0` → `1.0.1`).
   **Ohne diesen Schritt bekommen installierte Apps die Änderung nicht.**
3. Committen und pushen. Beim nächsten Öffnen erscheint in der App unten
   „Neue Version verfügbar – Tippen zum Aktualisieren“.

## Datenspeicherung / spätere Umstellung auf Server

Die Oberfläche (`index.html`) greift **nur** über die Schnittstelle in `storage.js` auf Daten
zu – nirgends direkt auf `localStorage`. Alle Funktionen sind asynchron (Promises), damit
später eine Server-Schnittstelle ohne Änderung der Oberfläche eingesetzt werden kann.

| Funktion | Zweck |
|---|---|
| `loadAll()` | kompletten Stand laden → `{ data, firstRun, persistent, warning }` |
| `saveBuilding(b)` / `deleteBuilding(id)` | Gebäude speichern / samt Einrichtungen löschen |
| `saveFacility(f)` / `deleteFacility(id)` | Einrichtung mit Positionen speichern / löschen |
| `saveSettings(s)` | Einstellungen speichern |
| `addLogEntry(facilityId, entry)` | Prüfprotokoll-Eintrag anfügen (wird nie geändert) |
| `exportAll()` | kompletter Stand für die JSON-Sicherung |
| `importAll(payload, mode)` | Import, `mode` = `merge` oder `replace` |

**Adapter:** Welcher Adapter genutzt wird, steht an genau einer Stelle:
`CONFIG.storageAdapter` in `index.html`.

- `local` – **LocalStorageAdapter** (aktiv): Daten im Browser-Speicher des Geräts,
  Schlüssel `verbandskasten.data`.
- `api` – **ApiAdapter** (nur Vorlage, ohne Logik): gleiche Funktionen; die Kommentare
  beschreiben, welche Anfrage jede Funktion später an den Server (PHP + MariaDB) schickt.
  Basisadresse: `CONFIG.apiBaseUrl`.

**Datenformat (schema 2):** Jeder Datensatz – Gebäude, Einrichtung, Position,
Protokolleintrag, Einstellungen – hat eine feste `id` (vom Gerät erzeugt) und
`updatedAt` (ISO-Zeitstempel der letzten Änderung, UTC). Positionen bekommen nur dann
einen neuen Zeitstempel, wenn sie sich wirklich geändert haben. Daten aus schema 1
(Version vor dieser Umstellung) werden beim Laden bzw. Import automatisch umgewandelt.
Bei Formatänderungen `SCHEMA` in `storage.js` erhöhen und in `normalize()` eine
Migration ergänzen.

**Import „Zusammenführen“:** Bei gleicher `id` gewinnt der neuere Stand (`updatedAt`),
Prüfprotokolle werden vereinigt, Einstellungen bleiben.

**Für die Server-Umstellung noch zu klären:**
1. Tabellen z. B. `buildings`, `facilities`, `items`, `log_entries`, `settings` –
   jeweils mit `id` und `updated_at`; der Server setzt `updated_at` selbst.
2. Konflikte: Client schickt den bekannten `updatedAt` mit; ist der Server-Stand neuer,
   antwortet er mit HTTP 409 und dem aktuellen Datensatz.
3. Löschungen an andere Geräte weitergeben (z. B. `deletedAt` statt echtem Löschen) –
   heute überträgt „Zusammenführen“ keine Löschungen.
4. Offline-Betrieb: Änderungen zwischenspeichern und nachsenden.
5. Anmeldung und Rechte (wer darf „Ersetzen“); keine Zugangsdaten im Code.
6. Mit Server-Daten liegen echte Standortdaten zentral vor → Datenschutz/Zugriff klären.

## Umzug zu IONOS (eigene Domain)

Alle Pfade sind relativ. Es reicht, alle Dateien (ohne `tools/`, `.git/`) in einen Ordner
auf dem Webspace zu kopieren. Voraussetzung: **HTTPS** (sonst kein Service Worker).
Hinweis: Daten im Gerätespeicher sind an die Adresse gebunden – vor dem Umzug in der alten
App exportieren und in der neuen App importieren.
