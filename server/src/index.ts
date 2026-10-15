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

function extractReservationData(body: any) {
  const data: any = {};
  if (body.reservationNumber !== undefined || body.reservation_number !== undefined)
    data.reservationNumber = String(body.reservationNumber ?? body.reservation_number);
  if (body.guestId !== undefined || body.guest_id !== undefined)
    data.guestId = Number(body.guestId ?? body.guest_id);
  if (body.roomId !== undefined || body.room_id !== undefined)
    data.roomId = Number(body.roomId ?? body.room_id);
  if (body.arrivalDate !== undefined || body.arrival_date !== undefined)
    data.arrivalDate = String(body.arrivalDate ?? body.arrival_date);
  if (body.departureDate !== undefined || body.departure_date !== undefined)
    data.departureDate = String(body.departureDate ?? body.departure_date);
  if (body.nights !== undefined) data.nights = Number(body.nights);
  if (body.adultsCount !== undefined || body.adults_count !== undefined)
    data.adultsCount = Number(body.adultsCount ?? body.adults_count);
  if (body.childrenCount !== undefined || body.children_count !== undefined)
    data.childrenCount = Number(body.childrenCount ?? body.children_count);
  if (body.companionNames !== undefined || body.companion_names !== undefined)
    data.companionNames = body.companionNames ?? body.companion_names ?? '';
  if (body.isArrived !== undefined || body.is_arrived !== undefined)
    data.isArrived = Boolean(body.isArrived ?? body.is_arrived);
  if (body.isDeparted !== undefined || body.is_departed !== undefined)
    data.isDeparted = Boolean(body.isDeparted ?? body.is_departed);
  if (body.isWrittenReservation !== undefined || body.is_written_reservation !== undefined)
    data.isWrittenReservation = Boolean(body.isWrittenReservation ?? body.is_written_reservation);
  if (body.isLockedToRoom !== undefined || body.is_locked_to_room !== undefined)
    data.isLockedToRoom = Boolean(body.isLockedToRoom ?? body.is_locked_to_room);
  if (body.priceVariant !== undefined || body.price_variant !== undefined)
    data.priceVariant = body.priceVariant ?? body.price_variant;
  if (body.pricePerNight !== undefined || body.price_per_night !== undefined)
    data.pricePerNight = Number(body.pricePerNight ?? body.price_per_night);
  if (body.totalPrice !== undefined || body.total_price !== undefined)
    data.totalPrice = Number(body.totalPrice ?? body.total_price);
  if (body.isFlatRate !== undefined || body.is_flat_rate !== undefined)
    data.isFlatRate = Boolean(body.isFlatRate ?? body.is_flat_rate);
  if (body.boardType !== undefined || body.board_type !== undefined)
    data.boardType = body.boardType ?? body.board_type;
  if (body.hasBreakfast !== undefined || body.has_breakfast !== undefined)
    data.hasBreakfast = Boolean(body.hasBreakfast ?? body.has_breakfast);
  if (body.breakfastCount !== undefined || body.breakfast_count !== undefined)
    data.breakfastCount = Number(body.breakfastCount ?? body.breakfast_count);
  if (body.ohpCount !== undefined || body.ohp_count !== undefined)
    data.ohpCount = Number(body.ohpCount ?? body.ohp_count);
  if (body.twoGangCount !== undefined || body.two_gang_count !== undefined)
    data.twoGangCount = Number(body.twoGangCount ?? body.two_gang_count);
  if (body.threeGangCount !== undefined || body.three_gang_count !== undefined)
    data.threeGangCount = Number(body.threeGangCount ?? body.three_gang_count);
  if (body.lunchCount !== undefined || body.lunch_count !== undefined)
    data.lunchCount = Number(body.lunchCount ?? body.lunch_count);
  if (body.coffeeTeaCount !== undefined || body.coffee_tea_count !== undefined)
    data.coffeeTeaCount = Number(body.coffeeTeaCount ?? body.coffee_tea_count);
  if (body.dinnerCount !== undefined || body.dinner_count !== undefined)
    data.dinnerCount = Number(body.dinnerCount ?? body.dinner_count);
  if (body.dailyArrangement !== undefined || body.daily_arrangement !== undefined)
    data.dailyArrangement = body.dailyArrangement ?? body.daily_arrangement;
  if (body.billingDebitor !== undefined || body.billing_debitor !== undefined)
    data.billingDebitor = body.billingDebitor ?? body.billing_debitor;
  if (body.notes !== undefined) data.notes = body.notes;
  return data;
}

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
    console.warn('Drizzle query failed for reservations:', err.message);
    try {
      if (client) {
        const fallback = await client.execute(`
          SELECT r.*, g.last_name, g.first_name, g.search_name, rm.room_code, rm.name as room_name
          FROM reservations r
          JOIN guests g ON r.guest_id = g.id
          JOIN rooms rm ON r.room_id = rm.id;
        `);
        if (fallback.rows && fallback.rows.length > 0) {
          const mapped = fallback.rows.map((row: any) => ({
            id: Number(row.id),
            reservationNumber: String(row.reservation_number || ''),
            guestId: Number(row.guest_id),
            roomId: Number(row.room_id),
            arrivalDate: String(row.arrival_date || ''),
            departureDate: String(row.departure_date || ''),
            nights: Number(row.nights) || 1,
            adultsCount: Number(row.adults_count) || 1,
            childrenCount: Number(row.children_count) || 0,
            companionNames: row.companion_names || '',
            isArrived: Boolean(row.is_arrived),
            isDeparted: Boolean(row.is_departed),
            isWrittenReservation: Boolean(row.is_written_reservation),
            isLockedToRoom: Boolean(row.is_locked_to_room),
            priceVariant: row.price_variant || 'Doppelt belegt',
            pricePerNight: Number(row.price_per_night) || 85,
            totalPrice: Number(row.total_price) || 85,
            isFlatRate: Boolean(row.is_flat_rate),
            boardType: row.board_type || 'Frühstück',
            hasBreakfast: Boolean(row.has_breakfast),
            breakfastCount: Number(row.breakfast_count) || 1,
            ohpCount: Number(row.ohp_count) || 0,
            twoGangCount: Number(row.two_gang_count) || 0,
            threeGangCount: Number(row.three_gang_count) || 0,
            dailyArrangement: row.daily_arrangement || '',
            billingDebitor: row.billing_debitor || '',
            notes: row.notes || '',
            createdAt: row.created_at || new Date().toISOString(),
            last_name: row.last_name,
            first_name: row.first_name,
            search_name: row.search_name,
            room_code: row.room_code,
            room_name: row.room_name,
            guest: {
              id: Number(row.guest_id),
              lastName: row.last_name || '',
              firstName: row.first_name || '',
              searchName: row.search_name || '',
            },
            room: {
              id: Number(row.room_id),
              roomCode: row.room_code || '',
              name: row.room_name || '',
            }
          }));
          return res.json(mapped);
        }
      }
    } catch (e: any) {
      console.warn('SQL fallback failed for reservations:', e.message);
    }
  }
  res.json(memoryReservations);
});

app.post('/api/reservations', async (req, res) => {
  const cleanData = extractReservationData(req.body);
  try {
    if (db) {
      const newRes = await db.insert(schema.reservations).values({
        ...cleanData,
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
    ...cleanData,
    id: memoryReservations.length + 1,
    createdAt: new Date().toISOString()
  };
  memoryReservations.push(fallbackRes);
  res.status(201).json(fallbackRes);
});

app.put('/api/reservations/:id', async (req, res) => {
  const { id } = req.params;
  const cleanData = extractReservationData(req.body);
  try {
    if (db) {
      await db.update(schema.reservations)
        .set(cleanData)
        .where(eq(schema.reservations.id, Number(id)));
    }
  } catch (err: any) {
    console.warn('DB update failed for reservation:', err.message);
  }
  const idx = memoryReservations.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryReservations[idx] = { ...memoryReservations[idx], ...cleanData };
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
