import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultLocalDbPath = path.resolve(__dirname, '../../../lindengarten.db');

let resolvedUrl = process.env.DATABASE_URL;
if (!resolvedUrl && fs.existsSync(defaultLocalDbPath)) {
  resolvedUrl = `file:${defaultLocalDbPath}`;
} else if (resolvedUrl && resolvedUrl.startsWith('file:') && !path.isAbsolute(resolvedUrl.slice(5))) {
  const relPath = resolvedUrl.slice(5);
  const absPath = path.resolve(__dirname, '../../', relPath);
  resolvedUrl = `file:${absPath}`;
}

let client: any = null;
let db: any = null;

export async function ensureInvoiceSchema(cli: any) {
  if (!cli) return;
  const cols = [
    "recipient_salutation TEXT",
    "recipient_name TEXT",
    "recipient_company TEXT",
    "recipient_street TEXT",
    "recipient_zip TEXT",
    "recipient_city TEXT",
    "recipient_country TEXT DEFAULT 'Deutschland'",
    "room_code TEXT",
    "room_name TEXT",
    "nights INTEGER DEFAULT 1",
    "billing_debitor TEXT",
    "closing_text TEXT",
  ];
  for (const col of cols) {
    try {
      await cli.execute(`ALTER TABLE invoices ADD COLUMN ${col};`);
    } catch {
      // Spalte existiert bereits oder Tabelle noch nicht initialisiert
    }
  }

  // Bestehende Rechnungen ohne Empfängerdaten automatisch aus Gast- und Buchungsstamm anreichern
  try {
    await cli.execute(`
      UPDATE invoices SET
        recipient_name = (SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) FROM guests WHERE guests.id = invoices.guest_id),
        recipient_salutation = (SELECT COALESCE(salutation || ' ' || last_name, 'Sehr geehrte Damen und Herren') FROM guests WHERE guests.id = invoices.guest_id),
        recipient_company = (SELECT COALESCE(name_2, '') FROM guests WHERE guests.id = invoices.guest_id),
        recipient_street = (SELECT TRIM(COALESCE(street, '') || ' ' || COALESCE(house_number, '')) FROM guests WHERE guests.id = invoices.guest_id),
        recipient_zip = (SELECT COALESCE(zip_code, '') FROM guests WHERE guests.id = invoices.guest_id),
        recipient_city = (SELECT COALESCE(city, '') FROM guests WHERE guests.id = invoices.guest_id),
        recipient_country = (SELECT COALESCE(country, 'Deutschland') FROM guests WHERE guests.id = invoices.guest_id),
        billing_debitor = (SELECT COALESCE(billing_debitor, '') FROM reservations WHERE reservations.id = invoices.reservation_id),
        nights = (SELECT COALESCE(nights, 1) FROM reservations WHERE reservations.id = invoices.reservation_id),
        room_name = (SELECT COALESCE(rooms.name, 'Zimmer ' || reservations.room_id) FROM reservations LEFT JOIN rooms ON rooms.id = reservations.room_id WHERE reservations.id = invoices.reservation_id),
        room_code = (SELECT COALESCE(rooms.room_code, CAST(reservations.room_id AS TEXT)) FROM reservations LEFT JOIN rooms ON rooms.id = reservations.room_id WHERE reservations.id = invoices.reservation_id)
      WHERE recipient_name IS NULL OR recipient_name = '';
    `);
  } catch (err: any) {
    console.warn('Hinweis zu Invoices Backfill:', err?.message);
  }
}

if (resolvedUrl) {
  try {
    client = createClient({
      url: resolvedUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    db = drizzle(client, { schema });
    ensureInvoiceSchema(client).catch((err) => {
      console.warn('Hinweis zu Schema-Migration für Invoices:', err?.message);
    });
  } catch (err: any) {
    console.warn('LibSQL client initialization error (running in fallback mode):', err?.message);
    client = null;
    db = null;
  }
}

export { client, db, schema };
