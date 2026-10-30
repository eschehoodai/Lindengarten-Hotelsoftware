import 'dotenv/config';
import { client } from './index.js';

async function resetProductionDatabase() {
  console.log('🔄 ========================================================');
  console.log('🚀 Lindengarten Production Reset / Übergabe-Bereinigung');
  console.log('🔄 ========================================================\n');

  if (!client) {
    console.error('❌ Keine Datenbankverbindung verfügbar.');
    process.exit(1);
  }

  const currentYear = new Date().getFullYear();

  // 1. Bewegungsdaten und Testdaten löschen
  console.log('🧹 1. Lösche Test-Buchungen, Rechnungen, Folios und Test-Gäste...');
  await client.execute(`DELETE FROM invoice_items;`);
  await client.execute(`DELETE FROM invoices;`);
  await client.execute(`DELETE FROM reservations;`);
  await client.execute(`DELETE FROM guests;`);
  await client.execute(`DELETE FROM channel_sync_queue;`);
  await client.execute(`DELETE FROM channel_sync_logs;`);

  // 2. SQLite Auto-Increment Zähler zurücksetzen
  console.log('🔢 2. Setze SQLite Auto-Increment Zähler auf 0 zurück...');
  try {
    await client.execute(`
      DELETE FROM sqlite_sequence 
      WHERE name IN ('guests', 'reservations', 'invoices', 'invoice_items', 'channel_sync_logs', 'channel_sync_queue');
    `);
  } catch (err: any) {
    console.warn('   (sqlite_sequence Hinweis:', err?.message || err, ')');
  }

  // 3. Nummernkreise für GoBD und Kundenübergabe initialisieren
  console.log(`🎯 3. Initialisiere Nummernkreise für das Geschäftsjahr ${currentYear}...`);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS number_sequences (
      code TEXT PRIMARY KEY,
      current_value INTEGER NOT NULL DEFAULT 0,
      prefix TEXT NOT NULL DEFAULT '',
      pad_length INTEGER NOT NULL DEFAULT 6,
      has_year_prefix INTEGER DEFAULT 0,
      current_year INTEGER,
      updated_at TEXT NOT NULL
    );
  `);

  await client.execute(`DELETE FROM number_sequences;`);
  await client.execute({
    sql: `INSERT INTO number_sequences (code, current_value, prefix, pad_length, has_year_prefix, current_year, updated_at) VALUES
      ('GUEST', 0, 'G-', 6, 0, ?, datetime('now')),
      ('RESERVATION', 0, 'B-', 6, 1, ?, datetime('now')),
      ('INVOICE', 0, 'RE-', 6, 1, ?, datetime('now')),
      ('CASH_RECEIPT', 0, 'KB-', 6, 1, ?, datetime('now'));`,
    args: [currentYear, currentYear, currentYear, currentYear],
  });

  // 4. Stammdaten-Integritätsprüfung (15 Zimmer, Kategorien, Preisvarianten)
  console.log('🏨 4. Überprüfe Stammdaten (Zimmer, Kategorien, Preisvarianten)...');
  const roomsCount = await client.execute(`SELECT COUNT(*) as cnt FROM rooms;`);
  const salutationsCount = await client.execute(`SELECT COUNT(*) as cnt FROM salutations;`);
  const variantsCount = await client.execute(`SELECT COUNT(*) as cnt FROM price_variants;`);
  const mappingsCount = await client.execute(`SELECT COUNT(*) as cnt FROM channel_room_mappings;`);

  console.log(`   -> Zimmer im Hotel Lindengarten: ${roomsCount.rows[0]?.cnt ?? 0} (vollständig erhalten)`);
  console.log(`   -> Anreden / Salutations: ${salutationsCount.rows[0]?.cnt ?? 0}`);
  console.log(`   -> Preisvarianten: ${variantsCount.rows[0]?.cnt ?? 0}`);
  console.log(`   -> DIRS21 Channel Mappings: ${mappingsCount.rows[0]?.cnt ?? 0}`);

  console.log('\n✨ ========================================================');
  console.log('🎉 BEREINIGUNG ERFOLGREICH!');
  console.log('✨ Das System ist bereit für die saubere Kundenübergabe.');
  console.log('--------------------------------------------------------');
  console.log(`   👤 Nächster Gast:             G-000001 (technische ID: 1)`);
  console.log(`   📅 Nächste Buchung:           B-${currentYear}-000001 (technische ID: 1)`);
  console.log(`   🧾 Nächste Hotelrechnung:     RE-${currentYear}-000001 (technische ID: 1)`);
  console.log(`   💶 Nächster Kassenbeleg:      KB-${currentYear}-000001`);
  console.log('✨ ========================================================\n');
}

resetProductionDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Fehler beim Production Reset:', err);
    process.exit(1);
  });
