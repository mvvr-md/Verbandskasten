# Verbandskasten

Web-App (PWA) zur Prüfung und Nachbestellung von Verbandkästen.
Läuft komplett offline auf dem iPhone, Daten bleiben auf dem Gerät.

Testphase: <https://mvvr-md.github.io/Verbandskasten/>

## Auf dem iPhone installieren

1. Adresse in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.
3. App über das neue Symbol starten (Vollbild, funktioniert offline).

## Ablauf: Prüfen → Bestellen → Lieferung eingeräumt

1. **Prüfen:** Kasten öffnen, Istmengen mit − / + erfassen, „Prüfung abschließen“
   (Protokolleintrag, nächste Prüfung nach dem Prüfintervall).
2. **Bestellen:** Reiter „Bestellung“ (gesamt oder je Gebäude) bzw. im Kasten
   „Nur diesen Kasten bestellen“. „Bestell-E-Mail erstellen“ öffnet die Mail-App.
   Danach fragt die App „Bestellung abgeschickt?“ – bei **Ja** werden die Positionen
   mit Datum und Bestellreferenz als *bestellt* markiert (blau) und erscheinen nicht
   erneut in der Bestellung. Eintrag im Protokoll.
3. **Lieferung eingeräumt:** Im Kasten zeigt eine Karte „N Positionen bestellt“.
   „Lieferung eingeräumt“ → Sicherheitsabfrage → Ist = Soll für genau diese Positionen,
   neues Ablaufdatum je Position, Bestellmarke wird gelöscht, Eintrag im Protokoll.
   Einzelne Positionen lassen sich auch direkt mit „Aufgefüllt“ erledigen.

## Bedienung

Unten schwebt eine Leiste mit zwei Reitern: **Übersicht** und **Bestellung**.
Die Einstellungen öffnet nur das Zahnrad oben rechts in der Übersicht.
Auf Unterseiten führt der blaue Zurück-Link oben links eine Ebene hoch.

- **Übersicht:** Statuskarte „einsatzbereit / gesamt“ (einsatzbereit = in Ordnung + fällig,
  ohne Mängel), Balken und Legende. „Zu erledigen“ (Kästen mit Mangel oder fälliger
  Prüfung, „Alle N“ zeigt alle). Suche über alle Kästen. Liste der Gebäude.
- **Gebäude:** Segment *Alle / Offen / In Ordnung*, Kästen sortiert nach Mängel > fällig >
  in Ordnung, Filter-Suche ab 5 Kästen. Unten: „Bestellen für <Gebäude>“ mit Artikelzahl.
- **Prüfung (Kasten):** „X von Y vollständig“, ggf. Bestellkarte, Liste „Inhalt“ mit
  Regler je Position, Link „Protokoll“, Verwalten (umbenennen, Vorlage, löschen).
- **Bestellung:** Segment *Gesamt / Gebäude …* (ab 4 Gebäuden Auswahlliste),
  Artikel-Summen, „Verteilliste nach Standort“ zum Auffüllen. Adressen werden hier
  bewusst nicht angezeigt (stehen in den Einstellungen).
- **Zustände** (immer Symbol oder Punkt + Text):

  | Zustand | Farbe | Beispiel |
  |---|---|---|
  | Mangel | rot, ✕ | „Fehlt 2“, „Abgelaufen 08/26“, „2 Positionen fehlen“ |
  | fällig | orange, Uhr | „Prüfung fällig 11/26“, „Läuft ab 01/27“ (< 3 Monate) |
  | in Ordnung | grün, Haken | „Vollständig“ |
  | bestellt | blau, Punkt | „Fehlt 2 · bestellt am 28.10.“ |

## Einstellungen

Alle Werte stehen als Standard (Platzhalter) genau einmal in `CONFIG` in `index.html`
und werden in der App unter Einstellungen überschrieben. **Keine echten Daten in den Code.**

| Schlüssel | Bedeutung | Standard |
|---|---|---|
| `supplierName` | Lieferant | `WERO` |
| `orderEmail` | Bestelladresse (An) | `bestellung@example.invalid` |
| `internalEmail` | interne Kopie (CC) | `info@test.de` |
| `customerNumber` | Kundennummer (Betreff) | `[KUNDENNUMMER]` |
| `deliveryAddress` | Lieferadresse (mehrzeilig) | `MVVR GmbH` / `[Lieferadresse]` |
| `confirmEmail` | Adresse für die Auftragsbestätigung | `[Bestätigungsadresse]` |
| `senderPhone` | Telefon Büro (Signatur) | `[Telefon Büro]` |
| `intervalMonths` | Prüfintervall in Monaten | `12` |

## Bestell-E-Mail

Aufbau in `order.js`, Funktion `buildOrderMail({ rooms, settings, ref })` – reine Funktion
ohne Oberfläche, im Browser und in Node testbar; in Phase 2 Vorlage für den Server-Versand.

- An `orderEmail`, CC `internalEmail`, per `mailto` (gesendet wird in der Mail-App).
- Betreff: `Bestellung MVVR GmbH – Kd.-Nr. <customerNumber> – Ref. <ref>`
- Bestellreferenz `VK-JJJJMMTT-NN` (NN = laufende Nummer pro Tag, aus den gespeicherten
  Referenzen ermittelt); wird bei „Bestellung abgeschickt? – Ja“ gespeichert.
- Oben die Summe je Art.-Nr. (sortiert nach Art.-Nr.), darunter „Aufteilung nach Objekt
  und Raum“ (Gebäude alphabetisch, Räume wie in der App, Artikel nach Art.-Nr.).
  Summe und Aufteilung stimmen immer überein (automatisch getestet).
- Nur ein Raum: statt Aufteilung „Für: <Gebäude> – <Raum>“.
- Keine Gründe (abgelaufen/fehlt) in der Mail. Bestellmenge: Fehlmenge = Soll − Ist,
  abgelaufen = komplette Sollmenge.
- mailto-Link länger als 1800 Zeichen: Hinweis „Bestellung zu lang – bitte pro Gebäude
  bestellen“, der Knopf ist dann gesperrt.

## Design

- **Grundsatz:** ruhig, hell, hochwertig. Blau nur als Akzent; Ampelfarben nur für Zustände.
- **Design-Tokens** als CSS-Variablen an einer Stelle (`:root` in `index.html`):

  | Token | Wert | Token | Wert |
  |---|---|---|---|
  | `--brand` | `#0050E6` | `--bg` | `#F5F6F8` |
  | `--brand-tint` | `#E8EFFF` | `--surface` | `#FFFFFF` |
  | `--ink` | `#0B1B3F` | `--hairline` | `#ECEEF2` |
  | `--muted` | `#5E6878` | `--chevron` | `#A0A8B6` |
  | `--segment` | `#E9EBF0` | `--stepper` | `#F2F4F7` |

  | Zustand | Text | Punkt | Fläche |
  |---|---|---|---|
  | kritisch | `#B42318` | `#F04438` | `#FEF3F2` |
  | Warnung | `#93370D` | `#F79009` | `#FFFAEB` |
  | OK | `#067647` | `#17B26A` | `#ECFDF3` |
  | bestellt | `#0045C8` | `#2E6BFF` | `#EEF4FF` |

- **Schrift:** *Saira* (SIL Open Font License, `fonts/OFL.txt`) lokal als woff2 in `fonts/`
  (500, 600, 700, 800 kursiv) – kein Google-Fonts-Link, offline im Service-Worker-Cache.
  Saira für Titel (34/600), Abschnitte (20/600), große Zahlen (tabular-nums) und die
  Wortmarke „MVVR“ (800 kursiv, `--brand`). Fließtext Systemschrift 17 px.
- **Bausteine:** gruppierte Listen (Radius 18, Trennlinien `--hairline`), Segment-Steuerung
  (40 px, Trefferfläche 44 px), Hauptknopf 56 px über weichem Verlauf, schwebende
  Tab-Leiste, Icons als Inline-SVG, Touch-Ziele ≥ 44 px, Kontraste WCAG 2.2 AA.

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
- Keine externen Dienste oder CDNs; die Schrift liegt lokal im Repo. Nichts wird übertragen –
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
| `order.js` | Bestell-E-Mail (`buildOrderMail`, Bestellreferenz) |
| `sw.js` | Service Worker (Offline-Cache, Updates) |
| `manifest.webmanifest` | App-Name, Symbole, Startadresse |
| `fonts/` | Schrift Saira (woff2) und Lizenz `OFL.txt` |
| `icons/` | App-Symbole, weißes Kreuz auf `#0050E6` (erzeugt mit `tools/make-icons.js`) |
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
| `saveBuilding(b)` / `deleteBuilding(id)` | Gebäude speichern / samt Kästen löschen |
| `saveFacility(f)` / `deleteFacility(id)` | Kasten mit Positionen speichern / löschen |
| `saveSettings(s)` | Einstellungen speichern |
| `addLogEntry(facilityId, entry)` | Protokolleintrag anfügen (`type`: `pruefung`, `bestellung`, `lieferung`; wird nie geändert) |
| `exportAll()` | kompletter Stand für die JSON-Sicherung |
| `importAll(payload, mode)` | Import, `mode` = `merge` oder `replace` |

**Adapter:** Welcher Adapter genutzt wird, steht an genau einer Stelle:
`CONFIG.storageAdapter` in `index.html`.

- `local` – **LocalStorageAdapter** (aktiv): Daten im Browser-Speicher des Geräts,
  Schlüssel `verbandskasten.data`.
- `api` – **ApiAdapter** (nur Vorlage, ohne Logik): gleiche Funktionen; die Kommentare
  beschreiben, welche Anfrage jede Funktion später an den Server (PHP + MariaDB) schickt.
  Basisadresse: `CONFIG.apiBaseUrl`.

**Datenformat (schema 2):** Jeder Datensatz – Gebäude, Kasten, Position,
Protokolleintrag, Einstellungen – hat eine feste `id` (vom Gerät erzeugt) und
`updatedAt` (ISO-Zeitstempel der letzten Änderung, UTC). Positionen bekommen nur dann
einen neuen Zeitstempel, wenn sie sich wirklich geändert haben. Daten aus schema 1
(Version vor dieser Umstellung) werden beim Laden bzw. Import automatisch umgewandelt.
Bei Formatänderungen `SCHEMA` in `storage.js` erhöhen und in `normalize()` eine
Migration ergänzen.
Offene Bestellungen stehen an der Position: `orderedAt` (Datum) und `orderRef`
(Bestellreferenz); beide werden beim Auffüllen gelöscht.

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
