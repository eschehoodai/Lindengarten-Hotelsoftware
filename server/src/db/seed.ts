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
      board_type TEXT DEFAULT 'Frühstück',
      has_breakfast INTEGER DEFAULT 1,
      breakfast_count INTEGER DEFAULT 1,
      ohp_count INTEGER DEFAULT 0,
      two_gang_count INTEGER DEFAULT 0,
      three_gang_count INTEGER DEFAULT 0,
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
      is_flat_rate INTEGER DEFAULT 0,
      breakfast_persons INTEGER DEFAULT 0,
      breakfast_rate REAL DEFAULT 4.80,
      is_online_import INTEGER DEFAULT 0
    );
  `);

  try {
    await client.execute(`ALTER TABLE price_variants ADD COLUMN breakfast_persons INTEGER DEFAULT 0;`);
  } catch {}
  try {
    await client.execute(`ALTER TABLE price_variants ADD COLUMN breakfast_rate REAL DEFAULT 4.80;`);
  } catch {}
  try {
    await client.execute(`ALTER TABLE price_variants ADD COLUMN is_online_import INTEGER DEFAULT 0;`);
  } catch {}
  try {
    await client.execute(`ALTER TABLE reservations ADD COLUMN notes TEXT;`);
  } catch {}

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
    { roomCode: '1', name: 'Zimmer 1', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Hauptgebäude', sortOrder: 1, housekeepingStatus: 'clean' },
    { roomCode: '2', name: 'Zimmer 2', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Hauptgebäude', sortOrder: 2, housekeepingStatus: 'clean' },
    { roomCode: '4', name: 'Zimmer 4', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 90.0, floor: 'Hauptgebäude', sortOrder: 3, housekeepingStatus: 'clean' },
    { roomCode: '5', name: 'Zimmer 5', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 90.0, floor: 'Hauptgebäude', sortOrder: 4, housekeepingStatus: 'clean' },
    { roomCode: 'Tobias', name: 'Zimmer Tobias', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 95.0, floor: 'Hauptgebäude', sortOrder: 5, housekeepingStatus: 'clean' },
    { roomCode: 'Annie', name: 'Zimmer Annie', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 95.0, floor: 'Hauptgebäude', sortOrder: 6, housekeepingStatus: 'dirty' },
    { roomCode: 'Herman', name: 'Zimmer Herman', categoryCode: 'TBZ', categoryName: 'Dreibettzimmer', baseBeds: 3, maxCapacity: 3, basePrice: 110.0, floor: 'Hauptgebäude', sortOrder: 7, housekeepingStatus: 'clean' },
    { roomCode: 'Prinze', name: 'Prinzessin von Sachsen Stube', categoryCode: 'TBZ', categoryName: 'Dreibettzimmer', baseBeds: 2, maxCapacity: 4, basePrice: 130.0, floor: 'Hauptgebäude', sortOrder: 8, housekeepingStatus: 'clean' },
    { roomCode: 'Stall', name: 'Stall Suite', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 3, basePrice: 120.0, floor: 'Nebengebäude', sortOrder: 9, housekeepingStatus: 'clean' },
    { roomCode: 'Scheun', name: 'Scheune', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 4, basePrice: 140.0, floor: 'Nebengebäude', sortOrder: 10, housekeepingStatus: 'clean' },
    { roomCode: 'Schupp', name: 'Schuppen', categoryCode: 'DZ', categoryName: 'Doppelzimmer', baseBeds: 2, maxCapacity: 2, basePrice: 85.0, floor: 'Nebengebäude', sortOrder: 11, housekeepingStatus: 'clean' },
    { roomCode: 'Heubod', name: 'Heuboden', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 4, basePrice: 135.0, floor: 'Nebengebäude', sortOrder: 12, housekeepingStatus: 'clean', specialCleaningNote: 'Keine Wäsche' },
    { roomCode: 'Kammer', name: 'Gesinde Kammer', categoryCode: 'EZ', categoryName: 'Einzelzimmer', baseBeds: 1, maxCapacity: 1, basePrice: 65.0, floor: 'Nebengebäude', sortOrder: 13, housekeepingStatus: 'clean' },
    { roomCode: 'Luisa', name: 'Suite Luisa', categoryCode: 'SUITE', categoryName: 'Suite 120', baseBeds: 2, maxCapacity: 3, basePrice: 125.0, floor: 'Nebengebäude', sortOrder: 14, housekeepingStatus: 'clean' },
  ];

  for (const r of roomData) {
    const existing = await client.execute({
      sql: `SELECT id FROM rooms WHERE room_code = ?`,
      args: [r.roomCode]
    });
    if (existing.rows && existing.rows.length > 0) {
      await client.execute({
        sql: `UPDATE rooms SET name = ?, category_code = ?, category_name = ?, base_beds = ?, max_capacity = ?, base_price = ?, floor = ?, sort_order = ?, housekeeping_status = ?, special_cleaning_note = ? WHERE room_code = ?`,
        args: [r.name, r.categoryCode, r.categoryName, r.baseBeds, r.maxCapacity, r.basePrice, r.floor, r.sortOrder, r.housekeepingStatus, r.specialCleaningNote || null, r.roomCode]
      });
    } else {
      await client.execute({
        sql: `INSERT INTO rooms (room_code, name, category_code, category_name, base_beds, max_capacity, base_price, floor, sort_order, housekeeping_status, special_cleaning_note)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [r.roomCode, r.name, r.categoryCode, r.categoryName, r.baseBeds, r.maxCapacity, r.basePrice, r.floor, r.sortOrder, r.housekeepingStatus, r.specialCleaningNote || null]
      });
    }
  }

  // 2. Preisvarianten (aus Bild 05 & Lindengarten F&B Logik)
  const variants = [
    { nr: 1, name: 'Doppelt belegt', short: 'Doppelt belegt', flat: 0, bfPers: 2, bfRate: 4.80, isOnline: 0 },
    { nr: 2, name: 'Einfach belegt', short: 'Einfach belegt', flat: 0, bfPers: 1, bfRate: 4.80, isOnline: 0 },
    { nr: 3, name: 'Dreifach belegt', short: 'Dreifach belegt', flat: 0, bfPers: 3, bfRate: 4.80, isOnline: 0 },
    { nr: 5, name: 'ohne F&B 1 Person', short: 'ohne F&B 1 Pers', flat: 0, bfPers: 0, bfRate: 4.80, isOnline: 0 },
    { nr: 6, name: 'ohne F&B 2 Personen', short: 'ohne F&B 2 Pers', flat: 0, bfPers: 0, bfRate: 4.80, isOnline: 0 },
    { nr: 7, name: 'Online', short: 'Online', flat: 0, bfPers: 0, bfRate: 4.80, isOnline: 1 },
  ];

  for (const v of variants) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO price_variants (variant_number, name, short_code, is_flat_rate, breakfast_persons, breakfast_rate, is_online_import) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [v.nr, v.name, v.short, v.flat, v.bfPers, v.bfRate, v.isOnline]
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

  // 4. Tabellen vor erneutem Seeding leeren
  await client.execute(`DELETE FROM invoice_items;`);
  await client.execute(`DELETE FROM invoices;`);
  await client.execute(`DELETE FROM reservations;`);
  await client.execute(`DELETE FROM guests;`);

  // 10 Gäste mit Fantasie-Daten anlegen
  const guestsToInsert = [
    {
      guestNumber: '178847', searchName: 'David', titleCode: 1, salutation: 'Sehr geehrter Herr',
      lastName: 'David', firstName: 'Klaus', name2: '', street: 'Marktplatz 4', zipCode: '96264',
      city: 'Altenkunstadt', country: 'Deutschland', phone: '09572-12345', email: 'klaus.david@example.de', isRegularGuest: 1
    },
    {
      guestNumber: '18506', searchName: 'Junghans', titleCode: 3, salutation: 'Sehr geehrte Familie',
      lastName: 'Junghans', firstName: 'Torsten', name2: '', street: 'Lindenallee 12', zipCode: '04109',
      city: 'Leipzig', country: 'Deutschland', phone: '0341-987654', email: 'junghans.familie@example.de', isRegularGuest: 0
    },
    {
      guestNumber: '117799', searchName: 'Hanse Touristik', titleCode: 4, salutation: 'Sehr geehrte Damen und Herren',
      lastName: 'Langerwisch', firstName: 'Marion', name2: 'Hanse Touristik Hamburg GmbH', street: 'Hafenstraße 100', zipCode: '20457',
      city: 'Hamburg', country: 'Deutschland', phone: '040-5551234', email: 'info@hanse-touristik.de', isRegularGuest: 1
    },
    {
      guestNumber: '18531', searchName: 'Bergmann', titleCode: 7, salutation: 'Sehr geehrte Frau Dr.',
      lastName: 'Bergmann', firstName: 'Stefanie', name2: '', street: 'Rosenweg 14', zipCode: '01067',
      city: 'Dresden', country: 'Deutschland', phone: '0351-4458912', email: 'stefanie.bergmann@sachsen-med.de', isRegularGuest: 1
    },
    {
      guestNumber: '18532', searchName: 'Buchenau', titleCode: 1, salutation: 'Sehr geehrter Herr',
      lastName: 'von Buchenau', firstName: 'Maximilian', name2: '', street: 'Schlossallee 7', zipCode: '99084',
      city: 'Erfurt', country: 'Deutschland', phone: '0361-7892341', email: 'm.buchenau@buchenau-forst.de', isRegularGuest: 0
    },
    {
      guestNumber: '18533', searchName: 'Klein', titleCode: 3, salutation: 'Sehr geehrte Familie',
      lastName: 'Klein', firstName: 'Sarah', name2: '', street: 'Birkenhain 22', zipCode: '10437',
      city: 'Berlin', country: 'Deutschland', phone: '030-89127634', email: 'familie.klein.berlin@web-mail.de', isRegularGuest: 0
    },
    {
      guestNumber: '18534', searchName: 'Weber', titleCode: 8, salutation: 'Sehr geehrter Herr Prof.',
      lastName: 'Weber', firstName: 'Heinrich', name2: '', street: 'Universitätsstraße 18', zipCode: '04109',
      city: 'Leipzig', country: 'Deutschland', phone: '0341-3322110', email: 'h.weber@uni-leipzig-forschung.de', isRegularGuest: 1
    },
    {
      guestNumber: '18535', searchName: 'Sonnenschein', titleCode: 2, salutation: 'Sehr geehrte Frau',
      lastName: 'Sonnenschein', firstName: 'Claudia', name2: '', street: 'Am Kurpark 5', zipCode: '02797',
      city: 'Kurort Oybin', country: 'Deutschland', phone: '035844-71239', email: 'c.sonnenschein@oybin-tour.de', isRegularGuest: 0
    },
    {
      guestNumber: '18536', searchName: 'Wunderlich', titleCode: 1, salutation: 'Sehr geehrter Herr',
      lastName: 'Wunderlich', firstName: 'Felix', name2: '', street: 'Bergstraße 88', zipCode: '02763',
      city: 'Zittau', country: 'Deutschland', phone: '03583-667788', email: 'f.wunderlich@oberlausitz-design.de', isRegularGuest: 0
    },
    {
      guestNumber: '18537', searchName: 'Meister', titleCode: 3, salutation: 'Sehr geehrte Familie',
      lastName: 'Meister', firstName: 'Sabine', name2: '', street: 'Sonnenhang 3', zipCode: '09112',
      city: 'Chemnitz', country: 'Deutschland', phone: '0371-5544332', email: 'meister.familie@sachsen-mail.de', isRegularGuest: 1
    }
  ];

  const guestIds: number[] = [];
  for (const g of guestsToInsert) {
    const res = await client.execute({
      sql: `INSERT INTO guests (guest_number, search_name, title_code, salutation, last_name, first_name, name_2, street, zip_code, city, country, phone, email, is_regular_guest, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            RETURNING id;`,
      args: [g.guestNumber, g.searchName, g.titleCode, g.salutation, g.lastName, g.firstName, g.name2, g.street, g.zipCode, g.city, g.country, g.phone, g.email, g.isRegularGuest]
    });
    guestIds.push(Number(res.rows[0].id));
  }

  // Zimmer-IDs ermitteln
  const roomsRes = await client.execute(`SELECT id, room_code FROM rooms;`);
  const roomMap = new Map<string, number>();
  for (const row of roomsRes.rows) {
    roomMap.set(String(row.room_code), Number(row.id));
  }

  // 5. Buchungen anlegen (10 neue Buchungen, 4-7 Tage, alle im Oktober 2026)
  const reservationsToInsert = [
    {
      reservationNumber: '19101', guestId: guestIds[3], roomId: roomMap.get('Annie')!,
      arrivalDate: '2026-10-02', departureDate: '2026-10-06', nights: 4, adultsCount: 2, childrenCount: 0,
      companionNames: 'Dr. Thomas Bergmann', priceVariant: 'Doppelt belegt', pricePerNight: 95.0, totalPrice: 380.0,
      isArrived: 1, isDeparted: 1, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 2, dailyArrangement: 'Frühstücksbuffet',
      billingDebitor: 'Bergmann', notes: 'Wanderurlaub im Zittauer Gebirge. Frühere Abreise am Vormittag erfolgt.'
    },
    {
      reservationNumber: '19102', guestId: guestIds[0], roomId: roomMap.get('Kammer')!,
      arrivalDate: '2026-10-04', departureDate: '2026-10-09', nights: 5, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 65.0, totalPrice: 325.0,
      isArrived: 1, isDeparted: 1, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, dailyArrangement: 'Frühstück',
      billingDebitor: 'David', notes: 'Geschäftsreise Handwerkskammer. Frühes Frühstück ab 06:45 Uhr.'
    },
    {
      reservationNumber: '19103', guestId: guestIds[2], roomId: roomMap.get('Heubod')!,
      arrivalDate: '2026-10-05', departureDate: '2026-10-12', nights: 7, adultsCount: 2, childrenCount: 0,
      companionNames: 'Jan Langerwisch', priceVariant: 'Doppelt belegt', pricePerNight: 135.0, totalPrice: 945.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: '3Gang', hasBreakfast: 1, breakfastCount: 2, threeGangCount: 2, dinnerCount: 2,
      dailyArrangement: 'Gourmet HP 3-Gang', billingDebitor: 'Hanse Touristik Hamburg GmbH',
      notes: 'Kostenübernahme Übernachtung & Halbpension durch Hanse Touristik Hamburg GmbH vorliegend.'
    },
    {
      reservationNumber: '19104', guestId: guestIds[1], roomId: roomMap.get('Scheun')!,
      arrivalDate: '2026-10-08', departureDate: '2026-10-15', nights: 7, adultsCount: 2, childrenCount: 2,
      companionNames: 'Aline, Max und Lea Junghans', priceVariant: 'Dreifach belegt', pricePerNight: 170.0, totalPrice: 1190.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: '2Gang', hasBreakfast: 1, breakfastCount: 4, twoGangCount: 4, dinnerCount: 4,
      dailyArrangement: 'Herbstferien-Familienangebot 2-Gang', billingDebitor: 'Junghans',
      notes: 'Herbsturlaub mit der Familie. Beistellbett für Tochter Lea im Zimmer aufgebaut.'
    },
    {
      reservationNumber: '19105', guestId: guestIds[7], roomId: roomMap.get('5')!,
      arrivalDate: '2026-10-10', departureDate: '2026-10-14', nights: 4, adultsCount: 2, childrenCount: 0,
      companionNames: 'Bernd Sonnenschein', priceVariant: 'Doppelt belegt', pricePerNight: 90.0, totalPrice: 360.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 2, dailyArrangement: 'Frühstück',
      billingDebitor: 'Sonnenschein', notes: 'Hochzeitstag am 12.10. Flasche Lindengarten-Sekt mit Grußkarte auf dem Zimmer vorbereitet.'
    },
    {
      reservationNumber: '19106', guestId: guestIds[4], roomId: roomMap.get('Tobias')!,
      arrivalDate: '2026-10-12', departureDate: '2026-10-17', nights: 5, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 95.0, totalPrice: 475.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, dailyArrangement: 'Frühstücksbuffet',
      billingDebitor: 'von Buchenau', notes: 'Spätanreise ca. 20:30 Uhr angekündigt. Benötigt Stellplatz mit E-Ladesäule am Nebengebäude.'
    },
    {
      reservationNumber: '19107', guestId: guestIds[8], roomId: roomMap.get('Schupp')!,
      arrivalDate: '2026-10-15', departureDate: '2026-10-21', nights: 6, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 85.0, totalPrice: 510.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, dailyArrangement: 'Frühstück',
      billingDebitor: 'Wunderlich', notes: 'Reist mit mittelgroßem Hund (Golden Retriever). Futternapf und Hundedecke aufs Zimmer.'
    },
    {
      reservationNumber: '19108', guestId: guestIds[6], roomId: roomMap.get('Prinze')!,
      arrivalDate: '2026-10-17', departureDate: '2026-10-24', nights: 7, adultsCount: 2, childrenCount: 0,
      companionNames: 'Dr. Gisela Weber', priceVariant: 'Doppelt belegt', pricePerNight: 130.0, totalPrice: 910.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: '3Gang', hasBreakfast: 1, breakfastCount: 2, threeGangCount: 2, dinnerCount: 2,
      dailyArrangement: 'Gourmet HP 3-Gang', billingDebitor: 'Weber',
      notes: 'Stammgäste. Bevorzugen Tisch 4 im Wintergarten. Glutenfreie Kost für Frau Dr. Weber.'
    },
    {
      reservationNumber: '19109', guestId: guestIds[5], roomId: roomMap.get('Stall')!,
      arrivalDate: '2026-10-20', departureDate: '2026-10-26', nights: 6, adultsCount: 2, childrenCount: 1,
      companionNames: 'Michael und Tim Klein', priceVariant: 'Dreifach belegt', pricePerNight: 145.0, totalPrice: 870.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 3, dailyArrangement: 'Frühstücksbuffet Suite',
      billingDebitor: 'Klein', notes: 'Kinderreisebett und Hochstuhl im Zimmer vorbereiten. Allergiker-Bettwäsche.'
    },
    {
      reservationNumber: '19110', guestId: guestIds[9], roomId: roomMap.get('Luisa')!,
      arrivalDate: '2026-10-22', departureDate: '2026-10-29', nights: 7, adultsCount: 2, childrenCount: 1,
      companionNames: 'Sabine, Jörg und Felix Meister', priceVariant: 'Dreifach belegt', pricePerNight: 155.0, totalPrice: 1085.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: '2Gang', hasBreakfast: 1, breakfastCount: 3, twoGangCount: 3, dinnerCount: 3,
      dailyArrangement: 'Halbpension 2-Gang', billingDebitor: 'Meister',
      notes: 'Wanderpaket Lindengarten gebucht. Frühe Abreise am 29.10. geplant.'
    }
  ];

  const reservationIds: number[] = [];
  for (const r of reservationsToInsert) {
    const res = await client.execute({
      sql: `INSERT INTO reservations (
              reservation_number, guest_id, room_id, arrival_date, departure_date, nights,
              adults_count, children_count, companion_names, price_variant, price_per_night, total_price,
              is_arrived, is_departed, is_written_reservation, is_locked_to_room, board_type,
              has_breakfast, breakfast_count, two_gang_count, three_gang_count, dinner_count,
              daily_arrangement, billing_debitor, notes, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            RETURNING id;`,
      args: [
        r.reservationNumber, r.guestId, r.roomId, r.arrivalDate, r.departureDate, r.nights,
        r.adultsCount, r.childrenCount || 0, r.companionNames || '', r.priceVariant, r.pricePerNight, r.totalPrice,
        r.isArrived, r.isDeparted || 0, r.isWrittenReservation, r.isLockedToRoom, r.boardType || 'Frühstück',
        r.hasBreakfast, r.breakfastCount || 1, r.twoGangCount || 0, r.threeGangCount || 0, r.dinnerCount || 0,
        r.dailyArrangement || null, r.billingDebitor || '', r.notes || null,
      ]
    });
    reservationIds.push(Number(res.rows[0].id));
  }

  // 6. Beispiel-Rechnungen anlegen
  // Rechnung 1: Dr. Stefanie Bergmann (Bezahlt)
  const inv1 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117810', ?, ?, '2026-10-06', '2026-10-02', '2026-10-06', 355.14, 24.86, 16.81, 3.19, 0.00, 400.00, 'EC-Karte', 1, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[0], guestIds[3]]
  });
  const inv1Id = Number(inv1.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Dr. Stefanie Bergmann', 'Annie', 4.0, 95.0, 380.0, 0.07, 2, 'LODGING', '2026-10-02', '2026-10-06', 'Doppelt belegt');`,
    args: [inv1Id]
  });

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'B', 2, 'Parkplatz', 'Annie', 4.0, 5.0, 20.0, 0.19, 1, 'SERVICE', '2026-10-06', '2026-10-06', '');`,
    args: [inv1Id]
  });

  // Rechnung 2: Klaus David (Bezahlt)
  const inv2 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117811', ?, ?, '2026-10-09', '2026-10-04', '2026-10-09', 303.74, 21.26, 0.00, 0.00, 0.00, 325.00, 'BAR', 1, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[1], guestIds[0]]
  });
  const inv2Id = Number(inv2.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Klaus David', 'Kammer', 5.0, 65.0, 325.0, 0.07, 2, 'LODGING', '2026-10-04', '2026-10-09', 'Einfach belegt');`,
    args: [inv2Id]
  });

  // Rechnung 3: Hanse Touristik (Offen)
  const inv3 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117812', ?, ?, '2026-10-12', '2026-10-05', '2026-10-12', 883.18, 61.82, 147.06, 27.94, 0.00, 1120.00, 'RECHNUNG', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[2], guestIds[2]]
  });
  const inv3Id = Number(inv3.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Marion Langerwisch (Hanse Touristik)', 'Heubod', 7.0, 135.0, 945.0, 0.07, 2, 'LODGING', '2026-10-05', '2026-10-12', 'Doppelt belegt');`,
    args: [inv3Id]
  });

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'B', 2, 'Halbpension 3-Gang Gourmet', 'Heubod', 7.0, 25.0, 175.0, 0.19, 1, 'SERVICE', '2026-10-12', '2026-10-12', '');`,
    args: [inv3Id]
  });

  // Rechnung 4: Torsten Junghans (Offen)
  const inv4 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19104', ?, ?, '2026-10-15', '2026-10-08', '2026-10-15', 986.54, 69.06, 548.23, 104.17, 0.00, 1708.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[3], guestIds[1]]
  });
  const inv4Id = Number(inv4.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Scheune Suite (Dreifach belegt)', 'Scheune', 7.0, 150.80, 1055.60, 0.07, 2, 'LODGING', '2026-10-08', '2026-10-15', 'Logis 7%');`,
    args: [inv4Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (4 Pers. x 7 Tage)', 'Scheune', 28.0, 4.80, 134.40, 0.19, 1, 'SERVICE', '2026-10-08', '2026-10-15', 'F&B 19%');`,
    args: [inv4Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 3, 'Halbpension 2-Gang Menü', 'Scheune', 28.0, 18.50, 518.00, 0.19, 1, 'SERVICE', '2026-10-08', '2026-10-15', 'Familienmenü');`,
    args: [inv4Id]
  });

  // Rechnung 5: Claudia Sonnenschein (Offen)
  const inv5 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19105', ?, ?, '2026-10-14', '2026-10-10', '2026-10-14', 300.56, 21.04, 32.27, 6.13, 0.00, 360.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[4], guestIds[7]]
  });
  const inv5Id = Number(inv5.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Zimmer 5 (Doppelt belegt)', 'Zimmer 5', 4.0, 80.40, 321.60, 0.07, 2, 'LODGING', '2026-10-10', '2026-10-14', 'Logis 7%');`,
    args: [inv5Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (2 Pers. x 4 Tage)', 'Zimmer 5', 8.0, 4.80, 38.40, 0.19, 1, 'SERVICE', '2026-10-10', '2026-10-14', 'F&B 19%');`,
    args: [inv5Id]
  });

  // Rechnung 6: Maximilian von Buchenau (Offen)
  const inv6 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19106', ?, ?, '2026-10-17', '2026-10-12', '2026-10-17', 421.50, 29.50, 20.17, 3.83, 0.00, 475.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[5], guestIds[4]]
  });
  const inv6Id = Number(inv6.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Zimmer Tobias (Einfach belegt)', 'Zimmer Tobias', 5.0, 90.20, 451.00, 0.07, 2, 'LODGING', '2026-10-12', '2026-10-17', 'Logis 7%');`,
    args: [inv6Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (1 Pers. x 5 Tage)', 'Zimmer Tobias', 5.0, 4.80, 24.00, 0.19, 1, 'SERVICE', '2026-10-12', '2026-10-17', 'F&B 19%');`,
    args: [inv6Id]
  });

  // Rechnung 7: Felix Wunderlich (Offen)
  const inv7 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19107', ?, ?, '2026-10-21', '2026-10-15', '2026-10-21', 449.72, 31.48, 24.20, 4.60, 0.00, 510.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[6], guestIds[8]]
  });
  const inv7Id = Number(inv7.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Schuppen (Einfach belegt)', 'Schuppen', 6.0, 80.20, 481.20, 0.07, 2, 'LODGING', '2026-10-15', '2026-10-21', 'Logis 7%');`,
    args: [inv7Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (1 Pers. x 6 Tage)', 'Schuppen', 6.0, 4.80, 28.80, 0.19, 1, 'SERVICE', '2026-10-15', '2026-10-21', 'F&B 19%');`,
    args: [inv7Id]
  });

  // Rechnung 8: Heinrich Weber (Offen)
  const inv8 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19108', ?, ?, '2026-10-24', '2026-10-17', '2026-10-24', 787.66, 55.14, 56.47, 10.73, 0.00, 910.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[7], guestIds[6]]
  });
  const inv8Id = Number(inv8.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Prinzessin von Sachsen Stube (Doppelt belegt)', 'Prinzessin von Sachsen Stube', 7.0, 120.40, 842.80, 0.07, 2, 'LODGING', '2026-10-17', '2026-10-24', 'Logis 7%');`,
    args: [inv8Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (2 Pers. x 7 Tage)', 'Prinzessin von Sachsen Stube', 14.0, 4.80, 67.20, 0.19, 1, 'SERVICE', '2026-10-17', '2026-10-24', 'F&B 19%');`,
    args: [inv8Id]
  });

  // Rechnung 9: Sarah Klein (Offen)
  const inv9 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19109', ?, ?, '2026-10-26', '2026-10-20', '2026-10-26', 732.34, 51.26, 72.61, 13.79, 0.00, 870.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[8], guestIds[5]]
  });
  const inv9Id = Number(inv9.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Stall Suite (Dreifach belegt)', 'Stall Suite', 6.0, 130.60, 783.60, 0.07, 2, 'LODGING', '2026-10-20', '2026-10-26', 'Logis 7%');`,
    args: [inv9Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (3 Pers. x 6 Tage)', 'Stall Suite', 18.0, 4.80, 86.40, 0.19, 1, 'SERVICE', '2026-10-20', '2026-10-26', 'F&B 19%');`,
    args: [inv9Id]
  });

  // Rechnung 10: Sabine Meister (Offen)
  const inv10 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('RE-19110', ?, ?, '2026-10-29', '2026-10-22', '2026-10-29', 919.81, 64.39, 84.71, 16.09, 0.00, 1085.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[9], guestIds[9]]
  });
  const inv10Id = Number(inv10.rows[0].id);
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Übernachtung Suite Luisa (Dreifach belegt)', 'Suite Luisa', 7.0, 140.60, 984.20, 0.07, 2, 'LODGING', '2026-10-22', '2026-10-29', 'Logis 7%');`,
    args: [inv10Id]
  });
  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 2, 'Frühstücksbuffet (3 Pers. x 7 Tage)', 'Suite Luisa', 21.0, 4.80, 100.80, 0.19, 1, 'SERVICE', '2026-10-22', '2026-10-29', 'F&B 19%');`,
    args: [inv10Id]
  });

  console.log('✅ Seeding erfolgreich abgeschlossen! 10 Gäste und 10 Reservierungen (4-7 Tage, Oktober 2026) wurden angelegt.');
}

async function main() {
  try {
    await initTables();
    await seedData();
    process.exit(0);
  } catch (err: any) {
    console.log('❌ Fehler beim Seeding:', err?.message || err);
    if (err?.stack) console.log(err.stack);
    process.exit(1);
  }
}

main();
