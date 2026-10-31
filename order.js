// Bestell-E-Mail der Verbandskasten-App.
//
// Reine Funktionen ohne Zugriff auf Oberfläche oder Speicher – im Browser
// als self.VKOrder, in Node per require('./order.js'). In Phase 2 dient
// dieselbe Logik dem Server als Vorlage für den Versand.
(function (root) {
'use strict';

const MAX_MAILTO = 1800; // längere mailto-Links schneiden manche Mail-Apps ab
const UNIT = 'Stk.';

const cmp = (a, b) => String(a).localeCompare(String(b), 'de', { numeric: true, sensitivity: 'base' });
const keyOf = (it) => (it.artNo ? 'art:' + it.artNo.trim().toUpperCase() : 'name:' + it.name.trim().toLowerCase());

// Gleiche Art.-Nr. zusammenfassen (ohne Art.-Nr.: gleiche Bezeichnung), sortiert nach Art.-Nr.
function sumItems(items) {
  const map = new Map();
  for (const it of items) {
    const k = keyOf(it);
    const hit = map.get(k);
    if (hit) hit.qty += it.qty;
    else map.set(k, { artNo: it.artNo || '', name: it.name, qty: it.qty });
  }
  return [...map.values()].sort((a, b) => cmp(a.artNo || '~', b.artNo || '~') || cmp(a.name, b.name));
}

// Nächste Bestellreferenz "VK-JJJJMMTT-NN" (NN = laufende Nummer pro Tag)
function nextOrderRef(existingRefs, date) {
  const d = date || new Date();
  const day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const prefix = 'VK-' + day + '-';
  let max = 0;
  for (const r of existingRefs || []) {
    if (typeof r === 'string' && r.startsWith(prefix)) max = Math.max(max, Number(r.slice(prefix.length)) || 0);
  }
  return prefix + String(max + 1).padStart(2, '0');
}

// rooms:    [{ building, room, items: [{ artNo, name, qty }] }] in App-Reihenfolge
// settings: { orderEmail, internalEmail, customerNumber, deliveryAddress, confirmEmail, senderPhone }
// ref:      Bestellreferenz
// Liefert { to, cc, subject, body, href, tooLong, totals, split }
function buildOrderMail({ rooms, settings, ref }) {
  const s = settings;
  const used = rooms
    .map((r) => ({ building: r.building, room: r.room, items: sumItems(r.items.filter((it) => it.qty > 0)) }))
    .filter((r) => r.items.length);
  const totals = sumItems(used.flatMap((r) => r.items));

  // Aufteilung: Gebäude alphabetisch, Räume in App-Reihenfolge, Artikel nach Art.-Nr.
  const order = [];
  for (const r of used) if (!order.includes(r.building)) order.push(r.building);
  const split = order.sort(cmp).map((building) => ({ building, rooms: used.filter((r) => r.building === building) }));

  const all = used.flatMap((r) => r.items).concat(totals);
  const qtyW = Math.max(1, ...all.map((it) => String(it.qty).length));
  const artW = Math.max(1, ...all.map((it) => (it.artNo || '–').length));
  const line = (indent, it) => indent + String(it.qty).padStart(qtyW) + ' ' + UNIT + '   ' + (it.artNo || '–').padEnd(artW) + '   ' + it.name;

  const lines = [
    'Sehr geehrte Damen und Herren,',
    '',
    'wir bestellen folgende Artikel:',
    '',
    ...totals.map((it) => line('  ', it)),
    ''
  ];
  if (used.length === 1) {
    lines.push('Für: ' + used[0].building + ' – ' + used[0].room, '');
  } else if (used.length > 1) {
    lines.push('Aufteilung nach Objekt und Raum:', '');
    for (const b of split) {
      lines.push(b.building);
      for (const r of b.rooms) {
        lines.push('  ' + r.room);
        r.items.forEach((it) => lines.push(line('    ', it)));
      }
      lines.push('');
    }
  }
  lines.push(
    'Bitte liefern an:',
    ...String(s.deliveryAddress).split(/\r?\n/),
    '',
    'Bestellreferenz: ' + ref,
    'Bitte bestätigen Sie den Auftrag kurz per E-Mail an ' + s.confirmEmail + '.',
    '',
    'Mit freundlichen Grüßen',
    'MVVR GmbH',
    s.senderPhone
  );

  const body = lines.join('\n');
  const subject = 'Bestellung MVVR GmbH – Kd.-Nr. ' + s.customerNumber + ' – Ref. ' + ref;
  const enc = (v) => encodeURIComponent(v);
  const href = 'mailto:' + enc(s.orderEmail).replace(/%40/g, '@') +
    '?cc=' + enc(s.internalEmail).replace(/%40/g, '@') +
    '&subject=' + enc(subject) +
    '&body=' + enc(body.replace(/\n/g, '\r\n'));
  return { to: s.orderEmail, cc: s.internalEmail, subject, body, href, tooLong: href.length > MAX_MAILTO, totals, split };
}

const api = { buildOrderMail, nextOrderRef, sumItems, MAX_MAILTO };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.VKOrder = api;
})(typeof self !== 'undefined' ? self : this);
