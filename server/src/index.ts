import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, client, schema } from './db/index.js';
import { eq, desc } from 'drizzle-orm';
import {
  FALLBACK_ROOMS,
  FALLBACK_GUESTS,
  FALLBACK_RESERVATIONS,
  FALLBACK_PRICE_VARIANTS,
  FALLBACK_SALUTATIONS,
  FALLBACK_INVOICES
} from './fallbackData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// In-Memory state clone for resilient cloud demo execution
const memoryRooms = JSON.parse(JSON.stringify(FALLBACK_ROOMS));
const memoryGuests = JSON.parse(JSON.stringify(FALLBACK_GUESTS));
const memoryReservations = JSON.parse(JSON.stringify(FALLBACK_RESERVATIONS));
const memoryInvoices = JSON.parse(JSON.stringify(FALLBACK_INVOICES));

app.use(cors());
app.use(express.json());

// 1. Zimmer
app.get('/api/rooms', async (req, res) => {
  try {
    if (db) {
      const allRooms = await db.select().from(schema.rooms).orderBy(schema.rooms.sortOrder);
      if (allRooms && allRooms.length > 0) {
        return res.json(allRooms);
      }
    }
  } catch (err: any) {
    console.warn('DB query failed for /api/rooms, using fallback:', err.message);
  }
  res.json(memoryRooms);
});

app.put('/api/rooms/:id/status', async (req, res) => {
  const { id } = req.params;
  const { housekeepingStatus, specialCleaningNote } = req.body;
  try {
    if (db) {
      await db.update(schema.rooms)
        .set({ housekeepingStatus, specialCleaningNote })
        .where(eq(schema.rooms.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB write failed for status:', err.message);
  }
  const r = memoryRooms.find((x: any) => x.id === Number(id));
  if (r) {
    r.housekeepingStatus = housekeepingStatus;
    r.specialCleaningNote = specialCleaningNote;
  }
  res.json({ success: true });
});

app.put('/api/rooms/:id', async (req, res) => {
  const { id } = req.params;
  const { id: _, ...updateData } = req.body;
  try {
    if (db) {
      await db.update(schema.rooms)
        .set(updateData)
        .where(eq(schema.rooms.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB write failed for room:', err.message);
  }
  const idx = memoryRooms.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryRooms[idx] = { ...memoryRooms[idx], ...updateData };
  }
  res.json({ success: true });
});

// 2. Gäste
app.get('/api/guests', async (req, res) => {
  try {
    if (db) {
      const allGuests = await db.select().from(schema.guests).orderBy(desc(schema.guests.id));
      if (allGuests && allGuests.length > 0) {
        return res.json(allGuests);
      }
    }
  } catch (err: any) {
    console.warn('DB query failed for /api/guests:', err.message);
  }
  res.json(memoryGuests);
});

app.post('/api/guests', async (req, res) => {
  try {
    if (db) {
      const newGuest = await db.insert(schema.guests).values({
        ...req.body,
        createdAt: new Date().toISOString()
      }).returning();
      if (newGuest && newGuest[0]) {
        return res.status(201).json(newGuest[0]);
      }
    }
  } catch (err: any) {
    console.warn('DB insert failed for guest:', err.message);
  }
  const fallbackGuest = {
    ...req.body,
    id: memoryGuests.length + 1,
    createdAt: new Date().toISOString()
  };
  memoryGuests.unshift(fallbackGuest);
  res.status(201).json(fallbackGuest);
});

app.put('/api/guests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      await db.update(schema.guests)
        .set(req.body)
        .where(eq(schema.guests.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB update failed for guest:', err.message);
  }
  const idx = memoryGuests.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryGuests[idx] = { ...memoryGuests[idx], ...req.body };
  }
  res.json({ success: true });
});

app.delete('/api/guests/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      await db.delete(schema.guests).where(eq(schema.guests.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB delete failed for guest:', err.message);
  }
  const idx = memoryGuests.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) memoryGuests.splice(idx, 1);
  res.json({ success: true });
});

// 3. Reservierungen (Timeline Daten)
app.get('/api/reservations', async (req, res) => {
  try {
    if (db) {
      const allRes = await db.query.reservations.findMany({
        with: {
          guest: true,
          room: true
        }
      });
      if (allRes && allRes.length > 0) {
        return res.json(allRes);
      }
    }
  } catch (err: any) {
    try {
      if (client) {
        const fallback = await client.execute(`
          SELECT r.*, g.last_name, g.first_name, g.search_name, rm.room_code, rm.name as room_name
          FROM reservations r
          JOIN guests g ON r.guest_id = g.id
          JOIN rooms rm ON r.room_id = rm.id;
        `);
        if (fallback.rows && fallback.rows.length > 0) {
          return res.json(fallback.rows);
        }
      }
    } catch (e: any) {
      console.warn('SQL fallback failed for reservations:', e.message);
    }
  }
  res.json(memoryReservations);
});

app.post('/api/reservations', async (req, res) => {
  try {
    if (db) {
      const newRes = await db.insert(schema.reservations).values({
        ...req.body,
        createdAt: new Date().toISOString()
      }).returning();
      if (newRes && newRes[0]) {
        return res.status(201).json(newRes[0]);
      }
    }
  } catch (err: any) {
    console.warn('DB insert failed for reservation:', err.message);
  }
  const fallbackRes = {
    ...req.body,
    id: memoryReservations.length + 1,
    createdAt: new Date().toISOString()
  };
  memoryReservations.push(fallbackRes);
  res.status(201).json(fallbackRes);
});

app.put('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      await db.update(schema.reservations)
        .set(req.body)
        .where(eq(schema.reservations.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB update failed for reservation:', err.message);
  }
  const idx = memoryReservations.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryReservations[idx] = { ...memoryReservations[idx], ...req.body };
  }
  res.json({ success: true });
});

app.delete('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      await db.delete(schema.reservations).where(eq(schema.reservations.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB delete failed for reservation:', err.message);
  }
  const idx = memoryReservations.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) memoryReservations.splice(idx, 1);
  res.json({ success: true });
});

// 4. Rechnungen & Folio-Positionen
app.get('/api/invoices', async (req, res) => {
  try {
    if (db) {
      const allInvoices = await db.select().from(schema.invoices).orderBy(desc(schema.invoices.id));
      if (allInvoices && allInvoices.length > 0) {
        return res.json(allInvoices);
      }
    }
  } catch (err: any) {
    console.warn('DB query failed for invoices:', err.message);
  }
  res.json(memoryInvoices);
});

app.get('/api/invoices/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    if (db) {
      const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, Number(id)));
      if (items && items.length > 0) return res.json(items);
    }
  } catch (err: any) {
    console.warn('DB query failed for invoice items:', err.message);
  }
  // Fallback demo positions
  res.json([
    {
      id: 1,
      invoiceId: 1,
      folioBucket: 'A',
      positionNumber: 1,
      description: 'Marion Langerwisch 178847',
      roomCode: '4',
      quantity: 5,
      unitPriceGross: 90.0,
      totalGross: 450.0,
      taxRate: 0.07,
      taxCode: 2,
      taxType: 'LODGING',
      dateFrom: '2026-10-05',
      dateTo: '2026-10-10',
      infoNote: 'Doppelt belegt FuB-Gr.: 2'
    },
    {
      id: 2,
      invoiceId: 1,
      folioBucket: 'B',
      positionNumber: 2,
      description: 'Parkplatz',
      roomCode: '4',
      quantity: 5,
      unitPriceGross: 5.0,
      totalGross: 25.0,
      taxRate: 0.19,
      taxCode: 1,
      taxType: 'SERVICE',
      dateFrom: '2026-10-09',
      dateTo: '2026-10-09',
      infoNote: ''
    }
  ]);
});

app.put('/api/invoice-items/:id/folio', async (req, res) => {
  const { id } = req.params;
  const { folioBucket } = req.body;
  try {
    if (db) {
      await db.update(schema.invoiceItems)
        .set({ folioBucket })
        .where(eq(schema.invoiceItems.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB update failed for folio item:', err.message);
  }
  res.json({ success: true, folioBucket });
});

app.post('/api/invoices', async (req, res) => {
  const invData = req.body;
  try {
    if (db) {
      const existing = await db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, invData.invoiceNumber));
      if (existing && existing.length > 0) {
        const updated = await db.update(schema.invoices)
          .set(invData)
          .where(eq(schema.invoices.invoiceNumber, invData.invoiceNumber))
          .returning();
        if (updated && updated[0]) return res.json(updated[0]);
      } else {
        const newInvoice = await db.insert(schema.invoices).values({
          ...invData,
          createdAt: new Date().toISOString()
        }).returning();
        if (newInvoice && newInvoice[0]) {
          return res.status(201).json(newInvoice[0]);
        }
      }
    }
  } catch (err: any) {
    console.warn('DB insert/update failed for invoice:', err.message);
  }

  // Memory fallback
  const idx = memoryInvoices.findIndex((x: any) => 
    (invData.id && x.id === invData.id) || 
    (invData.reservationId && x.reservationId === invData.reservationId) ||
    (invData.invoiceNumber && x.invoiceNumber === invData.invoiceNumber)
  );

  if (idx !== -1) {
    memoryInvoices[idx] = { ...memoryInvoices[idx], ...invData };
    return res.json(memoryInvoices[idx]);
  } else {
    const fallbackInv = {
      ...invData,
      id: invData.id || (memoryInvoices.length + 1),
      createdAt: new Date().toISOString()
    };
    memoryInvoices.unshift(fallbackInv);
    return res.status(201).json(fallbackInv);
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  const invData = req.body;
  try {
    if (db) {
      const updated = await db.update(schema.invoices)
        .set(invData)
        .where(eq(schema.invoices.id, Number(id)))
        .returning();
      if (updated && updated[0]) return res.json(updated[0]);
    }
  } catch (err: any) {
    console.warn('DB update failed for invoice:', err.message);
  }
  const idx = memoryInvoices.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryInvoices[idx] = { ...memoryInvoices[idx], ...invData };
    return res.json(memoryInvoices[idx]);
  }
  res.json({ success: true, ...invData });
});

// 5. Stammdaten (Preisvarianten & Anreden)
app.get('/api/price-variants', async (req, res) => {
  try {
    if (db) {
      const variants = await db.select().from(schema.priceVariants).orderBy(schema.priceVariants.variantNumber);
      if (variants && variants.length > 0) {
        return res.json(variants);
      }
    }
  } catch (err: any) {
    console.warn('DB query failed for price variants:', err.message);
  }
  res.json(FALLBACK_PRICE_VARIANTS);
});

app.get('/api/salutations', async (req, res) => {
  try {
    if (db) {
      const sal = await db.select().from(schema.salutations).orderBy(schema.salutations.salutationNumber);
      if (sal && sal.length > 0) {
        return res.json(sal);
      }
    }
  } catch (err: any) {
    console.warn('DB query failed for salutations:', err.message);
  }
  res.json(FALLBACK_SALUTATIONS);
});

// Health / Status Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Hotelsoftware Lindengarten Backend',
    database: db ? 'connected' : 'memory-fallback',
    env: process.env.VERCEL ? 'vercel-cloud' : 'local-lan',
    timestamp: new Date().toISOString()
  });
});

// Statische Dateien des Frontends (client/dist) ausliefern
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Only listen locally, Vercel Serverless invokes exported handler directly
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🏨 Lindengarten Backend Server läuft auf Port ${PORT}`);
    console.log(`🌐 Erreichbar im lokalen Netzwerk für Rezeptions-PCs unter: http://localhost:${PORT}`);
  });
}

export default app;
export { app };
