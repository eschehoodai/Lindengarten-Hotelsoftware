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
}

let client: any = null;
let db: any = null;

if (resolvedUrl) {
  try {
    client = createClient({
      url: resolvedUrl,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    db = drizzle(client, { schema });
  } catch (err: any) {
    console.warn('LibSQL client initialization error (running in fallback mode):', err?.message);
    client = null;
    db = null;
  }
}

export { client, db, schema };
