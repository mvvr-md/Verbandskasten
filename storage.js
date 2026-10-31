// Datenspeicherung der Verbandskasten-App.
//
// Die Oberfläche (index.html) greift NUR über diese Schnittstelle auf Daten zu.
// Alle Funktionen liefern Promises – heute lokal im Gerät (LocalStorageAdapter),
// später über eine Server-Schnittstelle (ApiAdapter, PHP + MariaDB).
// Welcher Adapter genutzt wird, steht in index.html in CONFIG.storageAdapter.
//
// Schnittstelle (jeder Adapter):
//   loadAll()                      → { data, firstRun, persistent, warning }
//   saveBuilding(building)         → gespeichertes Gebäude (mit updatedAt)
//   deleteBuilding(id)             → löscht Gebäude samt Einrichtungen
//   saveFacility(facility)         → gespeicherte Einrichtung (ohne Protokoll-Änderung)
//   deleteFacility(id)
//   saveSettings(settings)         → gespeicherte Einstellungen
//   addLogEntry(facilityId, entry) → gespeicherter Protokolleintrag
//   exportAll()                    → kompletter Datenstand (für die JSON-Datei)
//   importAll(payload, mode)       → neuer Datenstand; mode = 'merge' | 'replace'
//
// Datenformat (schema 2): siehe README, Abschnitt "Datenspeicherung".
// Jeder Datensatz (Gebäude, Einrichtung, Position, Protokolleintrag,
// Einstellungen) hat ein Feld updatedAt (ISO-Zeitstempel, UTC).
(function () {
'use strict';

const SCHEMA = 2;
const LOG_LIMIT = 50;

const now = () => new Date().toISOString();
const clone = (x) => JSON.parse(JSON.stringify(x));

function uid() {
  if (self.crypto && crypto.getRandomValues) {
    const a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Bereinigung einzelner Datensätze
// ---------------------------------------------------------------------------
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, min, max, def) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def; };
const ym = (v) => (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const iso = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const ts = (v, fallback) => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : fallback);
const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);

function cleanBuilding(b, stamp) {
  return { id: str(b.id, 64) || uid(), name: str(b.name) || 'Ohne Namen', updatedAt: ts(b.updatedAt, stamp) };
}

function cleanItem(it, stamp) {
  return {
    id: str(it.id, 64) || uid(),
    name: str(it.name) || 'Ohne Bezeichnung',
    artNo: str(it.artNo, 60),
    target: int(it.target, 0, 999, 1),
    actual: int(it.actual, 0, 999, 0),
    expiry: ym(it.expiry),
    orderedAt: iso(it.orderedAt),            // bestellt am (offen bis aufgefüllt)
    orderRef: iso(it.orderedAt) ? str(it.orderRef, 40) : '',
    updatedAt: ts(it.updatedAt, stamp)
  };
}

function cleanIssues(list) {
  return (Array.isArray(list) ? list : []).filter(obj)
    .map((x) => ({ name: str(x.name), artNo: str(x.artNo, 60), reason: str(x.reason, 120) }));
}

const LOG_TYPES = ['pruefung', 'bestellung', 'lieferung'];

function cleanLog(e, stamp) {
  return {
    id: str(e.id, 64) || uid(),
    type: LOG_TYPES.includes(e.type) ? e.type : 'pruefung',
    date: iso(e.date) || stamp.slice(0, 10),
    result: e.result === 'maengel' ? 'maengel' : 'ok',
    ref: str(e.ref, 200),
    issues: cleanIssues(e.issues),
    notes: cleanIssues(e.notes),
    updatedAt: ts(e.updatedAt, stamp)
  };
}

function cleanFacility(f, stamp) {
  return {
    id: str(f.id, 64) || uid(),
    buildingId: str(f.buildingId, 64),
    name: str(f.name) || 'Ohne Namen',
    template: str(f.template, 40) || 'leer',
    items: (Array.isArray(f.items) ? f.items : []).filter(obj).map((it) => cleanItem(it, stamp)),
    lastCheck: iso(f.lastCheck),
    nextCheck: ym(f.nextCheck),
    inspectionOpen: f.inspectionOpen === true,
    updatedAt: ts(f.updatedAt, stamp),
    log: (Array.isArray(f.log) ? f.log : []).filter((e) => obj(e) && iso(e.date))
      .map((e) => cleanLog(e, stamp))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, LOG_LIMIT)
  };
}

// null = Standardwert aus CONFIG der Oberfläche
function cleanSettings(s, stamp) {
  s = obj(s) ? s : {};
  return {
    supplierName: str(s.supplierName, 100) || null,
    orderEmail: str(s.orderEmail, 254) || null,
    internalEmail: str(s.internalEmail, 254) || null,
    customerNumber: str(s.customerNumber, 60) || null,
    deliveryAddress: str(s.deliveryAddress, 1000) || null,
    confirmEmail: str(s.confirmEmail, 254) || null,
    senderPhone: str(s.senderPhone, 60) || null,
    intervalMonths: s.intervalMonths == null ? null : int(s.intervalMonths, 1, 60, null),
    lastExport: iso(s.lastExport),
    updatedAt: ts(s.updatedAt, stamp)
  };
}

// Prüft, migriert und bereinigt einen kompletten Datenstand.
// Wirft einen Error mit verständlicher Meldung, wenn die Daten unbrauchbar sind.
function normalize(d) {
  if (!obj(d)) throw new Error('Die Datei enthält keine Verbandskasten-Daten.');
  if (typeof d.schema !== 'number') throw new Error('Die Schemaversion fehlt. Ist das eine Export-Datei dieser App?');
  if (d.schema > SCHEMA) throw new Error('Die Datei stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.');
  if (!Array.isArray(d.buildings) || !Array.isArray(d.facilities)) throw new Error('Gebäude oder Einrichtungen fehlen in der Datei.');

  // Migrationen:
  // schema 1 → 2: Felder updatedAt und Protokoll-IDs ergänzt. Fehlende Werte
  //               setzt die Bereinigung unten (Zeitstempel = jetzt).

  const stamp = now();
  const ids = new Set();
  const unique = (rec) => { if (ids.has(rec.id)) rec.id = uid(); ids.add(rec.id); return rec; };

  const buildings = d.buildings.filter(obj).map((b) => unique(cleanBuilding(b, stamp)));
  const known = new Set(buildings.map((b) => b.id));
  const facilities = d.facilities.filter(obj).map((f) => cleanFacility(f, stamp))
    .filter((f) => known.has(f.buildingId))
    .map((f) => {
      unique(f);
      f.items.forEach(unique);
      f.log.forEach(unique);
      return f;
    });
  return { schema: SCHEMA, settings: cleanSettings(d.settings, stamp), buildings, facilities };
}

// Zusammenführen: gleiche ID → neuerer Stand (updatedAt) gewinnt, bei
// Gleichstand die Datei. Protokolle werden vereinigt. Einstellungen bleiben.
// Hinweis: Löschungen werden (noch) nicht übertragen – siehe README.
function merge(current, incoming) {
  const pick = (a, b) => (!a ? b : !b ? a : b.updatedAt >= a.updatedAt ? b : a);
  const byId = (list) => new Map(list.map((x) => [x.id, x]));

  const bm = byId(current.buildings);
  incoming.buildings.forEach((b) => bm.set(b.id, pick(bm.get(b.id), b)));

  const fm = byId(current.facilities);
  incoming.facilities.forEach((f) => {
    const old = fm.get(f.id);
    const win = clone(pick(old, f));
    if (old) {
      const logs = byId(old.log);
      f.log.forEach((e) => logs.set(e.id, pick(logs.get(e.id), e)));
      win.log = [...logs.values()];
    }
    fm.set(f.id, win);
  });

  return normalize({ schema: SCHEMA, settings: current.settings, buildings: [...bm.values()], facilities: [...fm.values()] });
}

const sameItem = (a, b) => a.name === b.name && a.artNo === b.artNo && a.target === b.target &&
  a.actual === b.actual && a.expiry === b.expiry && a.orderedAt === b.orderedAt && a.orderRef === b.orderRef;

// ---------------------------------------------------------------------------
// LocalStorageAdapter – Daten im Browser-Speicher dieses Geräts
// ---------------------------------------------------------------------------
function LocalStorageAdapter() {
  const KEY = 'verbandskasten.data';
  let mem = null;          // aktueller Stand
  let persistent = true;   // false: nur im Arbeitsspeicher (z. B. privater Modus)

  function write() {
    if (!persistent) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) {
      throw new Error('Speichern nicht möglich! Bitte Daten exportieren.');
    }
  }

  function facility(id) {
    const f = mem.facilities.find((x) => x.id === id);
    if (!f) throw new Error('Einrichtung nicht gefunden.');
    return f;
  }

  function upsert(list, rec) {
    const i = list.findIndex((x) => x.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
  }

  return {
    name: 'local',

    async loadAll() {
      let raw = null, warning = '';
      try {
        raw = localStorage.getItem(KEY);
        localStorage.setItem(KEY + '.test', '1');
        localStorage.removeItem(KEY + '.test');
      } catch (e) {
        persistent = false;
        warning = 'Speichern ist auf diesem Gerät nicht möglich (z. B. privater Modus). Änderungen gehen beim Schließen verloren.';
      }
      mem = null;
      if (raw) {
        try {
          mem = normalize(JSON.parse(raw));
          write(); // ggf. migrierten Stand zurückschreiben
        } catch (e) {
          try { localStorage.setItem(KEY + '.defekt-' + Date.now(), raw); } catch (e2) { /* egal */ }
          warning = 'Gespeicherte Daten waren beschädigt. Eine Sicherung wurde angelegt, Beispieldaten geladen.';
          mem = null;
        }
      }
      const firstRun = !mem;
      if (firstRun) mem = normalize({ schema: SCHEMA, settings: {}, buildings: [], facilities: [] });
      return { data: clone(mem), firstRun, persistent, warning };
    },

    async saveBuilding(building) {
      const rec = cleanBuilding(building, now());
      rec.updatedAt = now();
      upsert(mem.buildings, rec);
      write();
      return clone(rec);
    },

    async deleteBuilding(id) {
      mem.buildings = mem.buildings.filter((b) => b.id !== id);
      mem.facilities = mem.facilities.filter((f) => f.buildingId !== id);
      write();
    },

    async saveFacility(fac) {
      const t = now();
      const rec = cleanFacility(fac, t);
      if (!mem.buildings.some((b) => b.id === rec.buildingId)) throw new Error('Gebäude nicht gefunden.');
      const old = mem.facilities.find((x) => x.id === rec.id);
      const oldItems = new Map((old ? old.items : []).map((it) => [it.id, it]));
      rec.items.forEach((it) => {
        const prev = oldItems.get(it.id);
        it.updatedAt = prev && sameItem(prev, it) ? prev.updatedAt : t;
      });
      rec.updatedAt = t;
      rec.log = old ? old.log : []; // Protokoll ändert sich nur über addLogEntry
      upsert(mem.facilities, rec);
      write();
      return clone(rec);
    },

    async deleteFacility(id) {
      mem.facilities = mem.facilities.filter((f) => f.id !== id);
      write();
    },

    async saveSettings(settings) {
      const rec = cleanSettings(settings, now());
      rec.updatedAt = now();
      mem.settings = rec;
      write();
      return clone(rec);
    },

    async addLogEntry(facilityId, entry) {
      const f = facility(facilityId);
      const rec = cleanLog(Object.assign({}, entry, { id: uid() }), now());
      rec.updatedAt = now();
      f.log.unshift(rec);
      f.log = f.log.slice(0, LOG_LIMIT);
      write();
      return clone(rec);
    },

    async exportAll() {
      return Object.assign({ app: 'verbandskasten', exportedAt: now() }, clone(mem));
    },

    async importAll(payload, mode) {
      const incoming = normalize(payload);
      mem = mode === 'replace' ? incoming : merge(mem, incoming);
      write();
      return clone(mem);
    }
  };
}

// ---------------------------------------------------------------------------
// ApiAdapter – VORLAGE für die spätere Server-Schnittstelle (PHP + MariaDB)
// Noch ohne Logik. Gedachte Regeln für die Umsetzung:
//  - Alle Anfragen gehen an options.baseUrl (CONFIG.apiBaseUrl, gleiche Domain,
//    HTTPS), Daten als JSON (Content-Type: application/json; charset=utf-8).
//  - Anmeldung z. B. per Sitzungs-Cookie (credentials: 'same-origin');
//    keine Zugangsdaten im Code.
//  - Der Server setzt updatedAt selbst (Serverzeit) und gibt den gespeicherten
//    Datensatz zurück. Der Client schickt den zuletzt bekannten updatedAt mit;
//    ist der Stand auf dem Server neuer → HTTP 409 (Konflikt) mit dem
//    aktuellen Datensatz, die App fragt dann nach.
//  - Anfragen der Reihe nach senden (Warteschlange), damit schnelle
//    Plus/Minus-Tipps in der richtigen Reihenfolge ankommen.
//  - Offline: Änderungen zwischenspeichern und später senden (eigener Schritt).
//  - Fehler als Error mit verständlicher deutscher Meldung weiterreichen.
// ---------------------------------------------------------------------------
function ApiAdapter(options) {
  const base = (options && options.baseUrl) || 'api/';
  const todo = (name) => Promise.reject(new Error(`ApiAdapter.${name} ist noch nicht umgesetzt (${base}).`));

  return {
    name: 'api',

    // GET {base}data → { schema, settings, buildings, facilities (inkl. items, log) }
    // Rückgabe wie LocalStorageAdapter: { data: normalize(antwort), firstRun: false,
    // persistent: true, warning: '' }. Keine Beispieldaten auf dem Server anlegen.
    loadAll() { return todo('loadAll'); },

    // PUT {base}buildings/{id}  Body: { id, name, updatedAt }
    // Neues Gebäude: gleiche Anfrage (ID erzeugt der Client). Antwort: Datensatz.
    saveBuilding(building) { return todo('saveBuilding'); },

    // DELETE {base}buildings/{id}
    // Server löscht Gebäude samt Einrichtungen, Positionen und Protokoll
    // (oder markiert sie mit deletedAt, damit andere Geräte es erfahren).
    deleteBuilding(id) { return todo('deleteBuilding'); },

    // PUT {base}facilities/{id}  Body: Einrichtung mit items[] (ohne log)
    // Server speichert Kopfdaten und Positionen (eigene Tabelle) in einer
    // Transaktion; updatedAt je Position nur bei Änderung neu setzen.
    saveFacility(facility) { return todo('saveFacility'); },

    // DELETE {base}facilities/{id}
    deleteFacility(id) { return todo('deleteFacility'); },

    // PUT {base}settings  Body: { supplierName, orderEmail, internalEmail, customerNumber,
    //   deliveryAddress, confirmEmail, senderPhone, intervalMonths, lastExport, updatedAt }
    saveSettings(settings) { return todo('saveSettings'); },

    // POST {base}facilities/{facilityId}/log  Body: { type, date, result, ref, issues[], notes[] }
    // type: 'pruefung' | 'bestellung' | 'lieferung'
    // Protokolleinträge werden nur angefügt, nie geändert. Antwort: Eintrag mit id, updatedAt.
    addLogEntry(facilityId, entry) { return todo('addLogEntry'); },

    // GET {base}export → kompletter Datenstand wie loadAll (für die Sicherungsdatei).
    exportAll() { return todo('exportAll'); },

    // POST {base}import?mode=merge|replace  Body: Datenstand (vorher mit normalize geprüft)
    // replace nur mit Admin-Recht. Antwort: neuer kompletter Datenstand.
    importAll(payload, mode) { return todo('importAll'); }
  };
}

const ADAPTERS = { local: LocalStorageAdapter, api: ApiAdapter };

self.VKStorage = {
  SCHEMA,
  LOG_LIMIT,
  uid,
  validate: (payload) => normalize(payload), // für die Import-Vorschau
  create(name, options) {
    const make = ADAPTERS[name];
    if (!make) throw new Error('Unbekannter Speicher-Adapter: ' + name);
    return make(options);
  }
};
})();
