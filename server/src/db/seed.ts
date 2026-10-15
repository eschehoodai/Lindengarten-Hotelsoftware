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

  // 5. Buchungen anlegen (10 Buchungen, 4-8 Tage, alle im Oktober 2026)
  const reservationsToInsert = [
    {
      reservationNumber: '178840', guestId: guestIds[2], roomId: roomMap.get('4')!,
      arrivalDate: '2026-10-02', departureDate: '2026-10-07', nights: 5, adultsCount: 2, childrenCount: 0,
      companionNames: '', priceVariant: 'Doppelt belegt', pricePerNight: 90.0, totalPrice: 450.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 2, billingDebitor: 'Hanse Touristik Hamburg GmbH'
    },
    {
      reservationNumber: '18506', guestId: guestIds[1], roomId: roomMap.get('Herman')!,
      arrivalDate: '2026-10-09', departureDate: '2026-10-15', nights: 6, adultsCount: 2, childrenCount: 1,
      companionNames: 'Aline, Torsten und Lea', priceVariant: 'Dreifach belegt', pricePerNight: 166.0, totalPrice: 996.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: '2Gang', hasBreakfast: 1, breakfastCount: 3, twoGangCount: 3, dinnerCount: 3,
      dailyArrangement: 'Angebot F/ 2 Gang', billingDebitor: 'Junghans'
    },
    {
      reservationNumber: '18520', guestId: guestIds[0], roomId: roomMap.get('Prinze')!,
      arrivalDate: '2026-10-14', departureDate: '2026-10-18', nights: 4, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 130.0, totalPrice: 520.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, billingDebitor: 'David'
    },
    {
      reservationNumber: '18521', guestId: guestIds[3], roomId: roomMap.get('1')!,
      arrivalDate: '2026-10-03', departureDate: '2026-10-10', nights: 7, adultsCount: 2, childrenCount: 0,
      companionNames: 'Dr. Stefanie & Thomas Bergmann', priceVariant: 'Doppelt belegt', pricePerNight: 85.0, totalPrice: 595.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 2, dailyArrangement: 'Frühstücksbuffet', billingDebitor: 'Bergmann'
    },
    {
      reservationNumber: '18522', guestId: guestIds[4], roomId: roomMap.get('2')!,
      arrivalDate: '2026-10-12', departureDate: '2026-10-17', nights: 5, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 85.0, totalPrice: 425.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, billingDebitor: 'von Buchenau'
    },
    {
      reservationNumber: '18523', guestId: guestIds[5], roomId: roomMap.get('Stall')!,
      arrivalDate: '2026-10-01', departureDate: '2026-10-09', nights: 8, adultsCount: 2, childrenCount: 1,
      companionNames: 'Sarah, Michael und Tim Klein', priceVariant: 'Dreifach belegt', pricePerNight: 145.0, totalPrice: 1160.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 3, dailyArrangement: 'Frühstücksbuffet Suite', billingDebitor: 'Klein'
    },
    {
      reservationNumber: '18524', guestId: guestIds[6], roomId: roomMap.get('Scheun')!,
      arrivalDate: '2026-10-18', departureDate: '2026-10-24', nights: 6, adultsCount: 2, childrenCount: 0,
      companionNames: 'Prof. Dr. Heinrich & Dr. Gisela Weber', priceVariant: 'Doppelt belegt', pricePerNight: 140.0, totalPrice: 840.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: '3Gang', hasBreakfast: 1, breakfastCount: 2, threeGangCount: 2, dinnerCount: 2, dailyArrangement: 'Gourmet HP 3-Gang', billingDebitor: 'Weber'
    },
    {
      reservationNumber: '18525', guestId: guestIds[7], roomId: roomMap.get('Tobias')!,
      arrivalDate: '2026-10-06', departureDate: '2026-10-13', nights: 7, adultsCount: 2, childrenCount: 0,
      companionNames: 'Claudia & Bernd Sonnenschein', priceVariant: 'Doppelt belegt', pricePerNight: 95.0, totalPrice: 665.0,
      isArrived: 1, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 2, billingDebitor: 'Sonnenschein'
    },
    {
      reservationNumber: '18526', guestId: guestIds[8], roomId: roomMap.get('Kammer')!,
      arrivalDate: '2026-10-21', departureDate: '2026-10-26', nights: 5, adultsCount: 1, childrenCount: 0,
      companionNames: '', priceVariant: 'Einfach belegt', pricePerNight: 65.0, totalPrice: 325.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 0,
      boardType: 'Frühstück', hasBreakfast: 1, breakfastCount: 1, billingDebitor: 'Wunderlich'
    },
    {
      reservationNumber: '18527', guestId: guestIds[9], roomId: roomMap.get('Luisa')!,
      arrivalDate: '2026-10-23', departureDate: '2026-10-29', nights: 6, adultsCount: 2, childrenCount: 1,
      companionNames: 'Sabine, Jörg und Felix Meister', priceVariant: 'Dreifach belegt', pricePerNight: 155.0, totalPrice: 930.0,
      isArrived: 0, isDeparted: 0, isWrittenReservation: 1, isLockedToRoom: 1,
      boardType: '2Gang', hasBreakfast: 1, breakfastCount: 3, twoGangCount: 3, dinnerCount: 3, dailyArrangement: 'Halbpension 2-Gang', billingDebitor: 'Meister'
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
              daily_arrangement, billing_debitor, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            RETURNING id;`,
      args: [
        r.reservationNumber, r.guestId, r.roomId, r.arrivalDate, r.departureDate, r.nights,
        r.adultsCount, r.childrenCount || 0, r.companionNames || '', r.priceVariant, r.pricePerNight, r.totalPrice,
        r.isArrived, r.isDeparted || 0, r.isWrittenReservation, r.isLockedToRoom, r.boardType || 'Frühstück',
        r.hasBreakfast, r.breakfastCount || 1, r.twoGangCount || 0, r.threeGangCount || 0, r.dinnerCount || 0,
        r.dailyArrangement || null, r.billingDebitor || '',
      ]
    });
    reservationIds.push(Number(res.rows[0].id));
  }

  // 6. Beispiel-Rechnungen anlegen
  // Rechnung 1: Hanse Touristik (Bezahlt)
  const inv1 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117799', ?, ?, '2026-10-06', '2026-10-02', '2026-10-07', 420.56, 29.44, 21.01, 3.99, 22.50, 497.50, 'BAR', 1, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[0], guestIds[2]]
  });
  const inv1Id = Number(inv1.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Marion Langerwisch 178847', '4', 5.0, 90.0, 450.0, 0.07, 2, 'LODGING', '2026-10-02', '2026-10-07', 'Doppelt belegt');`,
    args: [inv1Id]
  });

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'B', 2, 'Parkplatz', '4', 5.0, 5.0, 25.0, 0.19, 1, 'SERVICE', '2026-10-06', '2026-10-06', '');`,
    args: [inv1Id]
  });

  // Rechnung 2: Junghans (Offen)
  const inv2 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117800', ?, ?, '2026-10-14', '2026-10-09', '2026-10-15', 800.00, 56.00, 117.65, 22.35, 45.00, 1041.00, 'BAR', 0, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[1], guestIds[1]]
  });
  const inv2Id = Number(inv2.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Familie Torsten Junghans', 'Herman', 6.0, 166.0, 996.0, 0.07, 2, 'LODGING', '2026-10-09', '2026-10-15', 'Dreifach belegt');`,
    args: [inv2Id]
  });

  // Rechnung 3: Dr. Stefanie Bergmann (Bezahlt)
  const inv3 = await client.execute({
    sql: `INSERT INTO invoices (invoice_number, reservation_id, guest_id, invoice_date, service_period_start, service_period_end, net_lodging, tax_lodging, net_service, tax_service, city_tax_amount, total_gross, payment_method, is_paid, created_at)
          VALUES ('117801', ?, ?, '2026-10-09', '2026-10-03', '2026-10-10', 556.07, 38.93, 23.53, 4.47, 31.50, 654.50, 'EC-Karte', 1, datetime('now'))
          RETURNING id;`,
    args: [reservationIds[3], guestIds[3]]
  });
  const inv3Id = Number(inv3.rows[0].id);

  await client.execute({
    sql: `INSERT INTO invoice_items (invoice_id, folio_bucket, position_number, description, room_code, quantity, unit_price_gross, total_gross, tax_rate, tax_code, tax_type, date_from, date_to, info_note)
          VALUES (?, 'A', 1, 'Dr. Stefanie Bergmann', '1', 7.0, 85.0, 595.0, 0.07, 2, 'LODGING', '2026-10-03', '2026-10-10', 'Doppelt belegt');`,
    args: [inv3Id]
  });

  console.log('✅ Seeding erfolgreich abgeschlossen! 10 Gäste und 10 Reservierungen (4-8 Tage, Oktober 2026) wurden angelegt.');
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
