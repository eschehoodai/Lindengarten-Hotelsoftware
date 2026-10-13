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
if (!resolvedUrl) {
  if (fs.existsSync(defaultLocalDbPath)) {
    resolvedUrl = `file:${defaultLocalDbPath}`;
  } else {
    // Cloud / Vercel Serverless environment
    resolvedUrl = 'file:/tmp/lindengarten.db';
  }
}

let client: any = null;
let db: any = null;

try {
  client = createClient({
    url: resolvedUrl,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  db = drizzle(client, { schema });
} catch (err: any) {
  console.warn('LibSQL client initialization error (running in fallback mode):', err?.message);
}

export { client, db, schema };
