import { client, db, schema } from './index.js';

async function initTables() {
  console.log('📦 Erstelle Tabellen falls nicht vorhanden...');
  
  await client.execute(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_number TEXT UNIQUE,
      search_name TEXT,
      title_code INTEGER DEFAULT 1,
      salutation TEXT,
      last_name TEXT NOT NULL,
      first_name TEXT NOT NULL,
      name_2 TEXT,
      first_name_2 TEXT,
      care_of TEXT,
      street TEXT,
      house_number TEXT,
      zip_code TEXT,
      city TEXT,
      country TEXT DEFAULT 'Deutschland',
      phone TEXT,
      email TEXT,
      fax TEXT,
      birth_date TEXT,
      nationality TEXT DEFAULT 'deutsch',
      id_card_number TEXT,
      payment_method TEXT DEFAULT 'BAR',
      is_regular_guest INTEGER DEFAULT 0,
      is_tax_exempt INTEGER DEFAULT 0,
      tax_exempt_reason TEXT,
      remarks TEXT,
      guest_info TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_code TEXT NOT NULL,
      category_name TEXT NOT NULL,
      base_beds INTEGER NOT NULL DEFAULT 2,
      max_capacity INTEGER NOT NULL DEFAULT 4,
      base_price REAL NOT NULL,
      floor TEXT,
      sort_order INTEGER DEFAULT 0,
      housekeeping_status TEXT DEFAULT 'clean',
      special_cleaning_note TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reservation_number TEXT NOT NULL UNIQUE,
      guest_id INTEGER NOT NULL REFERENCES guests(id),
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      arrival_date TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      nights INTEGER NOT NULL,
      adults_count INTEGER DEFAULT 1,
      children_count INTEGER DEFAULT 0,
      companion_names TEXT,
      is_arrived INTEGER DEFAULT 0,
      is_departed INTEGER DEFAULT 0,
      is_written_reservation INTEGER DEFAULT 1,
      is_locked_to_room INTEGER DEFAULT 0,
      price_variant TEXT DEFAULT 'Doppelt belegt',
      price_per_night REAL NOT NULL,
      total_price REAL NOT NULL,
      is_flat_rate INTEGER DEFAULT 0,
      has_breakfast INTEGER DEFAULT 1,
      breakfast_count INTEGER DEFAULT 1,
      lunch_count INTEGER DEFAULT 0,
      coffee_tea_count INTEGER DEFAULT 0,
      dinner_count INTEGER DEFAULT 0,
      daily_arrangement TEXT,
      billing_debitor TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      reservation_id INTEGER REFERENCES reservations(id),
      guest_id INTEGER NOT NULL REFERENCES guests(id),
      invoice_date TEXT NOT NULL,
      service_period_start TEXT NOT NULL,
      service_period_end TEXT NOT NULL,
      net_lodging REAL NOT NULL,
      tax_lodging REAL NOT NULL,
      net_service REAL NOT NULL,
      tax_service REAL NOT NULL,
      city_tax_amount REAL NOT NULL,
      total_gross REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'BAR',
      is_paid INTEGER DEFAULT 0,
      tse_transaction_id TEXT,
      tse_signature TEXT,
      tse_signature_counter INTEGER,
      tse_serial_number TEXT,
      tse_timestamp TEXT,
      tse_qr_code_data TEXT,
      tse_offline_fallback INTEGER DEFAULT 0,
      is_zugferd_generated INTEGER DEFAULT 0,
      zugferd_xml_content TEXT,
      status TEXT DEFAULT 'final',
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      folio_bucket TEXT DEFAULT 'A',
      position_number INTEGER NOT NULL,
      description TEXT NOT NULL,
      room_code TEXT,
      quantity REAL NOT NULL DEFAULT 1,
      unit_price_gross REAL NOT NULL,
      total_gross REAL NOT NULL,
      tax_rate REAL NOT NULL,
      tax_code INTEGER NOT NULL,
      tax_type TEXT NOT NULL,
      date_from TEXT,
      date_to TEXT,
      info_note TEXT
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS price_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variant_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_code TEXT NOT NULL,
      is_flat_rate INTEGER DEFAULT 0
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS salutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      salutation_number INTEGER NOT NULL UNIQUE,
      address_text TEXT,
      letter_greeting TEXT NOT NULL,
      code TEXT
    );
  `);
}

async function seedData() {
  console.log('🌱 Starte Seeding der Lindengarten Stammdaten...');
  
  // 1. Zimmer des Hotels Lindengarten einpflegen
  const roomData = [
    { roomCode: '1', name: 'Zimmer 1', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Haupthaus', sortOrder: 1, housekeepingStatus: 'clean' },
    { roomCode: '2', name: 'Zimmer 2', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Haupthaus', sortOrder: 2, housekeepingStatus: 'clean' },
    { roomCode: '4', name: 'Zimmer 4', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 90.0, floor: 'Haupthaus', sortOrder: 3, housekeepingStatus: 'clean' },
    { roomCode: '5', name: 'Zimmer 5', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 90.0, floor: 'Haupthaus', sortOrder: 4, housekeepingStatus: 'clean' },
    { roomCode: 'Tobias', name: 'Zimmer Tobias', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 95.0, floor: 'Nebengebäude', sortOrder: 5, housekeepingStatus: 'clean' },
    { roomCode: 'Annie', name: 'Zimmer Annie', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 95.0, floor: 'Nebengebäude', sortOrder: 6, housekeepingStatus: 'dirty' },
    { roomCode: 'Herman', name: 'Zimmer Herman', categoryCode: 'TBZ', categoryName: 'Dreibettzimmer', baseBeds: 3, maxCapacity: 3, basePrice: 110.0, floor: 'Nebengebäude', sortOrder: 7, housekeepingStatus: 'clean' },
    { roomCode: 'Prinze', name: 'Prinzessin von Sachsen Stube', categoryCode: 'TBZ', categoryName: 'Dreibettzimmer', baseBeds: 2, maxCapacity: 4, basePrice: 130.0, floor: 'Stuben', sortOrder: 8, housekeepingStatus: 'clean' },
    { roomCode: 'Stall', name: 'Stall Suite', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 3, basePrice: 120.0, floor: 'Hof', sortOrder: 9, housekeepingStatus: 'clean' },
    { roomCode: 'Scheun', name: 'Scheune', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 4, basePrice: 140.0, floor: 'Hof', sortOrder: 10, housekeepingStatus: 'clean' },
    { roomCode: 'Schupp', name: 'Schuppen', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Hof', sortOrder: 11, housekeepingStatus: 'clean' },
    { roomCode: 'Heubod', name: 'Heuboden', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 4, basePrice: 135.0, floor: 'Hof', sortOrder: 12, housekeepingStatus: 'clean', specialCleaningNote: 'Keine Wäsche' },
    { roomCode: 'Kammer', name: 'Gesinde Kammer', categoryCode: 'EZ', categoryName: 'Einzelzimmer', baseBeds: 1, maxCapacity: 1, basePrice: 65.0, floor: 'Hof', sortOrder: 13, housekeepingStatus: 'clean' },
    { roomCode: 'Luisa', name: 'Suite Luisa', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 3, basePrice: 125.0, floor: 'Haupthaus', sortOrder: 14, housekeepingStatus: 'clean' },
  ];

  for (const r of roomData) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO rooms (room_code, name, category_code, category_name, base_beds, max_capacity, base_price, floor, sort_order, housekeeping_status, special_cleaning_note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [r.roomCode, r.name, r.categoryCode, r.categoryName, r.baseBeds, r.maxCapacity, r.basePrice, r.floor, r.sortOrder, r.housekeepingStatus, r.specialCleaningNote || null]
    });
  }

  // 2. Preisvarianten (aus Bild 05)
  const variants = [
    { nr: 1, name: 'Doppelt belegt', short: 'Doppelt belegt', flat: 0 },
    { nr: 2, name: 'Einfach belegt', short: 'Einfach belegt', flat: 0 },
    { nr: 3, name: 'Dreifach belegt', short: 'Dreifach belegt', flat: 0 },
    { nr: 5, name: 'ohne F&B 1 Person', short: 'ohne F&B 1 Pers', flat: 0 },
    { nr: 6, name: 'ohne F&B 2 Personen', short: 'ohne F&B 2 Pers', flat: 0 },
    { nr: 7, name: 'Online', short: 'Online', flat: 0 },
  ];

  for (const v of variants) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO price_variants (variant_number, name, short_code, is_flat_rate) VALUES (?, ?, ?, ?)`,
      args: [v.nr, v.name, v.short, v.flat]
    });
  }

  // 3. Anreden (aus Bild 06)
  const salutationList = [
    { nr: 1, address: 'Herr', letter: 'Sehr geehrter Herr', code: '1100' },
    { nr: 2, address: 'Frau', letter: 'Sehr geehrte Frau', code: '1100' },
    { nr: 3, address: 'Familie', letter: 'Sehr geehrte Familie', code: '1100' },
    { nr: 4, address: 'Firma', letter: 'Sehr geehrte Damen und Herren', code: '1000' },
    { nr: 6, address: 'Herr Dr.', letter: 'Sehr geehrter Herr Dr.', code: '1100' },
    { nr: 7, address: 'Frau Dr.', letter: 'Sehr geehrte Frau Dr.', code: '1100' },
    { nr: 8, address: 'Herr Prof.', letter: 'Sehr geehrter Herr Prof.', code: '1100' },
    { nr: 9, address: 'Frau Prof.', letter: 'Sehr geehrte Frau Prof.', code: '1100' },
    { nr: 10, address: 'Herr Prof. Dr.', letter: 'Sehr geehrter Herr Prof. Dr.', code: '1100' },
    { nr: 13, address: 'Sir', letter: 'Dear Sir', code: '1100' },
  ];

  for (const s of salutationList) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO salutations (salutation_number, address_text, letter_greeting, code) VALUES (?, ?, ?, ?)`,
      args: [s.nr, s.address, s.letter, s.code]
    });
  }

  // 4. Beispiel-Gäste anlegen
  const guest1 = await client.execute({
    sql: `INSERT INTO guests (guest_number, search_name, title_code, salutation, last_name, first_name, name_2, street, zip_code, city, country, phone, email, is_regular_guest, created_at)
          VALUES ('178847', 'David', 1, 'Sehr geehrter Herr', 'David', 'Klaus', '', 'Marktplatz 4', '96264', 'Altenkunstadt', 'Deutschland', '09572-12345', 'klaus.david@example.de', 1, datetime('now'))
          RETURNING id;`,
    args: []
  });
  const guest1Id = Number(guest1.rows[0].id);

  const guest2 = await client.execute({
    sql: `INSERT INTO guests (guest_number, search_name, title_code, salutation, last_name, first_name, name_2, street, zip_code, city, country, phone, email, is_regular_guest, created_at)
          VALUES ('18506', 'Junghans', 3, 'Sehr geehrte Familie', 'Junghans', 'Torsten', '', 'Lindenallee 12', '04109', 'Leipzig', 'Deutschland', '0341-987654', 'junghans.familie@example.de', 0, datetime('now'))
          RETURNING id;`,
    args: []
  });
  const guest2Id = Number(guest2.rows[0].id);

  const guest3 = await client.execute({
    sql: `INSERT INTO guests (guest_number, search_name, title_code, salutation, last_name, first_name, name_2, street, zip_code, city, country, phone, email, is_regular_guest, created_at)
          VALUES ('117799', 'Hanse Touristik', 4, 'Sehr geehrte Damen und Herren', 'Langerwisch', 'Marion', 'Hanse Touristik Hamburg GmbH', 'Hafenstraße 100', '20457', 'Hamburg', 'Deutschland', '040-5551234', 'info@hanse-touristik.de', 1, datetime('now'))
          RETURNING id;`,
    args: []
  });
  const guest3Id = Number(guest3.rows[0].id);

  // Zimmer-IDs ermitteln
  const roomsRes = await client.execute(`SELECT id, room_code FROM rooms;`);
  const roomMap = new Map<string, number>();
  for (const row of roomsRes.rows) {
    roomMap.set(String(row.room_code), Number(row.id));
  }

  // 5. Buchungen anlegen (entsprechend der Screenshots für Oktober 2026)
  // Buchung 1: Hanse Touristik in Zimmer 4
  const res1 = await client.execute({
    sql: `INSERT INTO reservations (reservation_number, guest_id, room_id, arrival_date, departure_date, nights, adults_count, price_variant, price_per_night, total_price, is_arrived, has_breakfast, breakfast_count, billing_debitor, created_at)
          VALUES ('178840', ?, ?, '2026-10-05', '2026-10-10', 5, 2, 'Doppelt belegt', 90.0, 450.0, 1, 1, 2, 'Hanse Touristik Hamburg GmbH', datetime('now'))
          RETURNING id;`,
    args: [guest3Id, roomMap.get('4')!]
  });
  const res1Id = Number(res1.rows[0].id);

  // Buchung 2: Junghans in Zimmer Herman (5 Ü, 3 P, 830 €)
  await client.execute({
    sql: `INSERT INTO reservations (reservation_number, guest_id, room_id, arrival_date, departure_date, nights, adults_count, children_count, companion_names, price_variant, price_per_night, total_price, is_arrived, daily_arrangement, billing_debitor, created_at)
          VALUES ('18506', ?, ?, '2026-10-10', '2026-10-15', 5, 2, 1, 'Aline, Torsten und Lea', 'Dreifach belegt', 166.0, 830.0, 1, 'Angebot F/ 2 Gang', 'Junghans', datetime('now'));`,
    args: [guest2Id, roomMap.get('Herman')!]
  });

  // Buchung 3: David in Prinze (12.10.2026 - 13.10.2026)
  await client.execute({
    sql: `INSERT INTO reservations (reservation_number, guest_id, room_id, arrival_date, departure_date, nights, adults_count, price_variant, price_per_night, total_price, is_arrived, is_locked_to_room, has_breakfast, breakfast_count, billing_debitor, created_at)
          VALUES ('18520', ?, ?, '2026-10-12', '2026-10-13', 1, 1, 'Einfach belegt', 130.0, 130.0, 0, 1, 1, 1, 'David', datetime('now'));`,
    args: [guest1Id, roomMap.get('Prinze')!]
  });

  // 6. Rechnung mit Folio-Split anlegen (aus Bild 04!)
  // Folio A: Übernachtung 450 € (Hanse Touristik)
  // Folio B: Parkplatz 25 €
  const inv = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117799', ?, ?, '2026-10-09', '2026-10-05', '2026-10-10', 420.56, 29.44, 21.01, 3.99, 22.50, 497.50, 'BAR', 1, datetime('now'))
          RETURNING id;`,
    args: [res1Id, guest3Id]
  });
  const invId = Number(inv.rows[0].id);

  // Position A: Marion Langerwisch Übernachtung 5 Nächte à 90 = 450 € (7 % MwSt)
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Marion Langerwisch 178847', '4', 5.0, 90.0, 450.0, 0.07, 2, 'LODGING', '2026-10-05', '2026-10-10', 'Doppelt belegt FuB-Gr.: 2');`,
    args: [invId]
  });

  // Position B: Parkplatz 5 Tage à 5 = 25 € (19 % MwSt)
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'B', 2, 'Parkplatz', '4', 5.0, 5.0, 25.0, 0.19, 1, 'SERVICE', '2026-10-09', '2026-10-09', '');`,
    args: [invId]
  });

  console.log('✅ Seeding erfolgreich abgeschlossen! Alle Lindengarten-Zimmer, Preisvarianten, Anreden, Reservierungen und Rechnungen wurden angelegt.');
}

async function main() {
  try {
    await initTables();
    await seedData();
    process.exit(0);
  } catch (err) {
    console.error('❌ Fehler beim Seeding:', err);
    process.exit(1);
  }
}

main();
