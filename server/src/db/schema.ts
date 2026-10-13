import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// 1. Gäste / Adressstamm
export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestNumber: text('guest_number').unique(),      // Gastnr. (z. B. "178847")
  searchName: text('search_name'),                 // Suchname für Schnellsuche
  titleCode: integer('title_code').default(1),     // AnredeNr (1=Herr, 2=Frau, 3=Familie, 4=Firma)
  salutation: text('salutation'),                  // Briefanrede (z. B. "Sehr geehrter Herr")
  lastName: text('last_name').notNull(),           // Name
  firstName: text('first_name').notNull(),         // Vorname
  name2: text('name_2'),                           // Name 2 / Firma (z. B. "Hanse Touristik Hamburg GmbH")
  firstName2: text('first_name_2'),                // Vorname 2
  careOf: text('care_of'),                         // zu Händen
  street: text('street'),                          // Straße
  houseNumber: text('house_number'),               // Hausnummer
  zipCode: text('zip_code'),                       // PLZ
  city: text('city'),                              // Ort
  country: text('country').default('Deutschland'), // Land
  phone: text('phone'),
  email: text('email'),
  fax: text('fax'),
  birthDate: text('birth_date'),                   // Geburtsdatum (ISO)
  nationality: text('nationality').default('deutsch'), // Staatsangehörigkeit (Meldeschein)
  idCardNumber: text('id_card_number'),            // Pass-/Ausweisnummer (für Ausländer)
  paymentMethod: text('payment_method').default('BAR'), // Zahlungsart (BAR, EC, KREDIT, RECHNUNG)
  isRegularGuest: integer('is_regular_guest', { mode: 'boolean' }).default(false), // Stammgast
  isTaxExempt: integer('is_tax_exempt', { mode: 'boolean' }).default(false),       // Befreiung City Tax
  taxExemptReason: text('tax_exempt_reason'),      // Befreiungsgrund
  remarks: text('remarks'),                        // Bemerkung
  guestInfo: text('guest_info'),                   // Gastinfo
  createdAt: text('created_at').notNull(),
});

// 2. Zimmer & Kategorien (Original Lindengarten Zimmer)
export const rooms = sqliteTable('rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roomCode: text('room_code').notNull().unique(),  // z.B. "1", "2", "Tobias", "Prinze", "Stall"
  name: text('name').notNull(),                    // z.B. "Prinzessin von Sachsen Stube"
  categoryCode: text('category_code').notNull(),   // z.B. EZ, DZ, TBZ, SUITE
  categoryName: text('category_name').notNull(),   // z.B. Dreibettzimmer, Suite 120
  baseBeds: integer('base_beds').notNull().default(2),
  maxCapacity: integer('max_capacity').notNull().default(4),
  basePrice: real('base_price').notNull(),         // Basispreis pro Nacht
  floor: text('floor'),                            // Gebäudeabschnitt / Etage
  sortOrder: integer('sort_order').default(0),     // Sortierung für Timeline Y-Achse
  housekeepingStatus: text('housekeeping_status').default('clean'), // clean, dirty, maintenance
  specialCleaningNote: text('special_cleaning_note'), // z. B. "Keine Wäsche"
});

// 3. Reservierungen & Belegungen
export const reservations = sqliteTable('reservations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reservationNumber: text('reservation_number').notNull().unique(), // z. B. "18506"
  guestId: integer('guest_id').notNull().references(() => guests.id),
  roomId: integer('room_id').notNull().references(() => rooms.id),
  arrivalDate: text('arrival_date').notNull(),     // YYYY-MM-DD
  departureDate: text('departure_date').notNull(), // YYYY-MM-DD
  nights: integer('nights').notNull(),
  
  // Personen & Mitreisende
  adultsCount: integer('adults_count').default(1),
  childrenCount: integer('children_count').default(0),
  companionNames: text('companion_names'),         // z. B. "Aline, Torsten und Lea"
  
  // Status-Flags (aus Bild 03)
  isArrived: integer('is_arrived', { mode: 'boolean' }).default(false),     // Eingecheckt
  isDeparted: integer('is_departed', { mode: 'boolean' }).default(false),   // Ausgecheckt
  isWrittenReservation: integer('is_written_reservation', { mode: 'boolean' }).default(true), // Schriftlich reserviert
  isLockedToRoom: integer('is_locked_to_room', { mode: 'boolean' }).default(false), // Fest gebucht (nicht verlegbar per DnD!)
  
  // Preisfindung & Variante
  priceVariant: text('price_variant').default('Doppelt belegt'),
  pricePerNight: real('price_per_night').notNull(),
  totalPrice: real('total_price').notNull(),
  isFlatRate: integer('is_flat_rate', { mode: 'boolean' }).default(false),
  
  // Verpflegungsmatrix (F&B)
  hasBreakfast: integer('has_breakfast', { mode: 'boolean' }).default(true),
  breakfastCount: integer('breakfast_count').default(1),
  lunchCount: integer('lunch_count').default(0),
  coffeeTeaCount: integer('coffee_tea_count').default(0),
  dinnerCount: integer('dinner_count').default(0),
  dailyArrangement: text('daily_arrangement'),     // z. B. "Angebot F/ 2 Gang"
  
  billingDebitor: text('billing_debitor'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// 4. Rechnungen & Folio-Konten
export const invoices = sqliteTable('invoices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceNumber: text('invoice_number').notNull().unique(), // z. B. "117799"
  reservationId: integer('reservation_id').references(() => reservations.id),
  guestId: integer('guest_id').notNull().references(() => guests.id),
  invoiceDate: text('invoice_date').notNull(),
  servicePeriodStart: text('service_period_start').notNull(),
  servicePeriodEnd: text('service_period_end').notNull(),
  
  // Betragsaufschlüsselung
  netLodging: real('net_lodging').notNull(),        // Netto 7%
  taxLodging: real('tax_lodging').notNull(),        // USt 7%
  netService: real('net_service').notNull(),        // Netto 19% (F&B, Parkplatz)
  taxService: real('tax_service').notNull(),        // USt 19%
  cityTaxAmount: real('city_tax_amount').notNull(), // Beherbergungssteuer Leipzig (0% USt)
  totalGross: real('total_gross').notNull(),        // Bruttogesamtbetrag
  
  paymentMethod: text('payment_method').notNull().default('BAR'), // BAR, EC, KREDIT, RECHNUNG
  isPaid: integer('is_paid', { mode: 'boolean' }).default(false),
  
  // Fiskalisierung (Fiskaly V2 / KassenSichV)
  tseTransactionId: text('tse_transaction_id'),
  tseSignature: text('tse_signature'),
  tseSignatureCounter: integer('tse_signature_counter'),
  tseSerialNumber: text('tse_serial_number'),
  tseTimestamp: text('tse_timestamp'),
  tseQrCodeData: text('tse_qr_code_data'),
  tseOfflineFallback: integer('tse_offline_fallback', { mode: 'boolean' }).default(false),
  
  // E-Rechnung / ZUGFeRD
  isZugferdGenerated: integer('is_zugferd_generated', { mode: 'boolean' }).default(false),
  zugferdXmlContent: text('zugferd_xml_content'),
  
  status: text('status').default('final'),          // draft, final, cancelled
  createdAt: text('created_at').notNull(),
});

// 5. Rechnungspositionen mit Folio-Zuordnung (A, B, C)
export const invoiceItems = sqliteTable('invoice_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  folioBucket: text('folio_bucket').default('A'),   // 'A', 'B', 'C' (Folio-Splitting!)
  positionNumber: integer('position_number').notNull(),
  description: text('description').notNull(),       // z. B. "Übernachtung Marion Langerwisch", "Parkplatz"
  roomCode: text('room_code'),                      // Zim-Nr (z. B. "4")
  quantity: real('quantity').notNull().default(1),
  unitPriceGross: real('unit_price_gross').notNull(),
  totalGross: real('total_gross').notNull(),
  taxRate: real('tax_rate').notNull(),              // 0.07, 0.19, 0.00
  taxCode: integer('tax_code').notNull(),           // 2 = 7%, 1 = 19%
  taxType: text('tax_type').notNull(),              // LODGING, SERVICE, CITY_TAX
  dateFrom: text('date_from'),
  dateTo: text('date_to'),
  infoNote: text('info_note'),                      // z. B. "Doppelt belegt FuB-Gr.: 2"
});

// 6. Preisvarianten-Stamm
export const priceVariants = sqliteTable('price_variants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  variantNumber: integer('variant_number').notNull().unique(),
  name: text('name').notNull(),
  shortCode: text('short_code').notNull(),
  isFlatRate: integer('is_flat_rate', { mode: 'boolean' }).default(false),
});

// 7. Anreden-Stamm
export const salutations = sqliteTable('salutations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  salutationNumber: integer('salutation_number').notNull().unique(),
  addressText: text('address_text'),
  letterGreeting: text('letter_greeting').notNull(),
  code: text('code'),
});

// 8. Relationen
export const guestsRelations = relations(guests, ({ many }) => ({
  reservations: many(reservations),
  invoices: many(invoices),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  reservations: many(reservations),
}));

export const reservationsRelations = relations(reservations, ({ one, many }) => ({
  guest: one(guests, {
    fields: [reservations.guestId],
    references: [guests.id],
  }),
  room: one(rooms, {
    fields: [reservations.roomId],
    references: [rooms.id],
  }),
  invoices: many(invoices),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  guest: one(guests, {
    fields: [invoices.guestId],
    references: [guests.id],
  }),
  reservation: one(reservations, {
    fields: [invoices.reservationId],
    references: [reservations.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
}));
