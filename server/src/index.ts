import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { db, client, schema } from './db/index.js';
import { eq, desc } from 'drizzle-orm';
import { fiskalyService } from './services/fiskalyService.js';
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

// Multi-Client LAN Synchronisation via Server-Sent Events (SSE)
const sseClients = new Set<express.Response>();

export function broadcastEvent(type: string, payload?: any) {
  const message = `data: ${JSON.stringify({ type, payload, timestamp: Date.now() })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', clientsCount: sseClients.size + 1 })}\n\n`);
  sseClients.add(res);

  // Heartbeat every 25 Sekunden für stabile LAN-Verbindungen
  const heartbeat = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

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
  broadcastEvent('ROOMS_CHANGED', { roomId: Number(id), housekeepingStatus });
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
  broadcastEvent('ROOMS_CHANGED', { roomId: Number(id) });
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
  const { id: _, ...guestInsertData } = req.body;
  try {
    if (db) {
      const newGuest = await db.insert(schema.guests).values({
        ...guestInsertData,
        createdAt: new Date().toISOString()
      }).returning();
      if (newGuest && newGuest[0]) {
        broadcastEvent('GUESTS_CHANGED', { action: 'create', guest: newGuest[0] });
        return res.status(201).json(newGuest[0]);
      }
    }
  } catch (err: any) {
    console.warn('DB insert failed for guest:', err.message);
  }
  const fallbackGuest = {
    ...guestInsertData,
    id: memoryGuests.length + 1,
    createdAt: new Date().toISOString()
  };
  memoryGuests.unshift(fallbackGuest);
  broadcastEvent('GUESTS_CHANGED', { action: 'create', guest: fallbackGuest });
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
  broadcastEvent('GUESTS_CHANGED', { action: 'update', guestId: Number(id) });
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
  broadcastEvent('GUESTS_CHANGED', { action: 'delete', guestId: Number(id) });
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
        broadcastEvent('RESERVATIONS_CHANGED', { action: 'create', reservation: newRes[0] });
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
  broadcastEvent('RESERVATIONS_CHANGED', { action: 'create', reservation: fallbackRes });
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
  broadcastEvent('RESERVATIONS_CHANGED', { action: 'update', reservationId: Number(id) });
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
  broadcastEvent('RESERVATIONS_CHANGED', { action: 'delete', reservationId: Number(id) });
  res.json({ success: true });
});

// 4. Rechnungen & Folio-Positionen
app.get('/api/invoices', async (req, res) => {
  try {
    if (db) {
      const allInvoices = await db.query.invoices.findMany({
        with: {
          items: true,
          guest: true,
          reservation: true,
        },
        orderBy: desc(schema.invoices.id),
      });
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
  const { id } = req.params;
  try {
    if (db) {
      const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, Number(id)));
      if (items && items.length > 0) return res.json(items);
    }
  } catch (err: any) {
    console.warn('DB query failed for invoice items:', err.message);
  }
  const memInv = memoryInvoices.find((i: any) => i.id === Number(id));
  if (memInv && memInv.items) {
    return res.json(memInv.items);
  }
  res.json([]);
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
  broadcastEvent('INVOICES_CHANGED', { action: 'update-folio', itemId: Number(id), folioBucket });
  res.json({ success: true, folioBucket });
});

// Helper für automatische fiskaly KassenSichV Signierung
async function ensureTseSigned(invData: any) {
  const isPaidOrStorno = Boolean(invData.isPaid || invData.status === 'BEZAHLT' || invData.status === 'STORNO_BELEG');
  const needsSigning = isPaidOrStorno && (!invData.tseSignature || invData.tseSignature.startsWith('SIG-') || invData.tseTransactionId?.startsWith('TSE-2026-'));
  
  if (needsSigning) {
    const isStorno = invData.status === 'STORNO_BELEG' || invData.invoiceNumber?.endsWith('-S');
    const signRes = await fiskalyService.signInvoiceTransaction({
      invoiceNumber: invData.invoiceNumber,
      totalGross: invData.totalGross,
      netLodging: invData.netLodging,
      taxLodging: invData.taxLodging,
      netService: invData.netService,
      taxService: invData.taxService,
      paymentMethod: invData.paymentMethod || 'BAR',
      isStorno,
    });

    if (signRes.success) {
      invData.tseTransactionId = signRes.tseTransactionId;
      invData.tseSignature = signRes.tseSignature;
      invData.tseSignatureCounter = signRes.tseSignatureCounter;
      invData.tseSerialNumber = signRes.tseSerialNumber;
      invData.tseTimestamp = signRes.tseTimestamp;
      invData.tseQrCodeData = signRes.tseQrCodeData;
      invData.tseOfflineFallback = false;
    } else if (signRes.tseOfflineFallback) {
      invData.tseOfflineFallback = true;
      invData.tseTransactionId = invData.tseTransactionId || 'TSE-OFFLINE-FALLBACK';
      invData.tseSignature = 'OFFLINE-NICHT-SIGNIERT';
      invData.tseTimestamp = new Date().toISOString();
    }
  }
}

app.post('/api/invoices', async (req, res) => {
  const invData = req.body;
  await ensureTseSigned(invData);
  const { items, guest, reservation, ...dbInvoiceData } = invData;
  try {
    if (db) {
      let savedInvoiceId: number;
      const existing = await db.select().from(schema.invoices).where(eq(schema.invoices.invoiceNumber, invData.invoiceNumber));
      if (existing && existing.length > 0) {
        const updated = await db.update(schema.invoices)
          .set(dbInvoiceData)
          .where(eq(schema.invoices.invoiceNumber, invData.invoiceNumber))
          .returning();
        savedInvoiceId = updated[0].id;
      } else {
        const newInvoice = await db.insert(schema.invoices).values({
          ...dbInvoiceData,
          createdAt: dbInvoiceData.createdAt || new Date().toISOString()
        }).returning();
        savedInvoiceId = newInvoice[0].id;
      }

      // Positionen (invoice_items) relational synchronisieren
      if (Array.isArray(items)) {
        await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, savedInvoiceId));
        if (items.length > 0) {
          const insertItems = items.map((it: any, idx: number) => ({
            invoiceId: savedInvoiceId,
            folioBucket: it.folioBucket || 'A',
            positionNumber: it.positionNumber || (idx + 1),
            description: it.description || '',
            roomCode: it.roomCode || '',
            quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 0),
            unitPriceGross: Number(it.unitPriceGross) || 0,
            totalGross: Number(it.totalGross) || 0,
            taxRate: Number(it.taxRate) || 0.07,
            taxCode: it.taxCode || (it.taxRate === 0.19 ? 1 : 2),
            taxType: it.taxType || (it.taxRate === 0.19 ? 'SERVICE' : 'LODGING'),
            dateFrom: it.dateFrom || null,
            dateTo: it.dateTo || null,
            infoNote: it.infoNote || '',
          }));
          await db.insert(schema.invoiceItems).values(insertItems);
        }
      }

      const full = await db.query.invoices.findFirst({
        where: eq(schema.invoices.id, savedInvoiceId),
        with: { items: true, guest: true, reservation: true },
      });
      if (full) {
        broadcastEvent('INVOICES_CHANGED', { action: 'save', invoiceId: full.id });
        return res.status(201).json(full);
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
    broadcastEvent('INVOICES_CHANGED', { action: 'save', invoiceId: memoryInvoices[idx].id });
    return res.json(memoryInvoices[idx]);
  } else {
    const fallbackInv = {
      ...invData,
      id: invData.id || (memoryInvoices.length + 1),
      createdAt: new Date().toISOString()
    };
    memoryInvoices.unshift(fallbackInv);
    broadcastEvent('INVOICES_CHANGED', { action: 'save', invoiceId: fallbackInv.id });
    return res.status(201).json(fallbackInv);
  }
});

app.put('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  const invData = req.body;
  await ensureTseSigned(invData);
  const { items, guest, reservation, ...dbInvoiceData } = invData;
  try {
    if (db) {
      await db.update(schema.invoices)
        .set(dbInvoiceData)
        .where(eq(schema.invoices.id, Number(id)));

      if (Array.isArray(items)) {
        await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, Number(id)));
        if (items.length > 0) {
          const insertItems = items.map((it: any, idx: number) => ({
            invoiceId: Number(id),
            folioBucket: it.folioBucket || 'A',
            positionNumber: it.positionNumber || (idx + 1),
            description: it.description || '',
            roomCode: it.roomCode || '',
            quantity: typeof it.quantity === 'number' ? it.quantity : (Number(it.quantity) || 0),
            unitPriceGross: Number(it.unitPriceGross) || 0,
            totalGross: Number(it.totalGross) || 0,
            taxRate: Number(it.taxRate) || 0.07,
            taxCode: it.taxCode || (it.taxRate === 0.19 ? 1 : 2),
            taxType: it.taxType || (it.taxRate === 0.19 ? 'SERVICE' : 'LODGING'),
            dateFrom: it.dateFrom || null,
            dateTo: it.dateTo || null,
            infoNote: it.infoNote || '',
          }));
          await db.insert(schema.invoiceItems).values(insertItems);
        }
      }

      const full = await db.query.invoices.findFirst({
        where: eq(schema.invoices.id, Number(id)),
        with: { items: true, guest: true, reservation: true },
      });
      if (full) {
        broadcastEvent('INVOICES_CHANGED', { action: 'update', invoiceId: Number(id) });
        return res.json(full);
      }
    }
  } catch (err: any) {
    console.warn('DB update failed for invoice:', err.message);
  }
  const idx = memoryInvoices.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    memoryInvoices[idx] = { ...memoryInvoices[idx], ...invData };
    broadcastEvent('INVOICES_CHANGED', { action: 'update', invoiceId: Number(id) });
    return res.json(memoryInvoices[idx]);
  }
  broadcastEvent('INVOICES_CHANGED', { action: 'update', invoiceId: Number(id) });
  res.json({ success: true, ...invData });
});

// Löschen einer Rechnung (mit GoBD / KassenSichV Schutz)
app.delete('/api/invoices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (db) {
      const existing = await db.query.invoices.findFirst({
        where: eq(schema.invoices.id, Number(id)),
      });
      if (existing) {
        // GoBD & KassenSichV Schutz: Bezahlte oder stornierte Rechnungen dürfen nicht physisch gelöscht werden!
        if (existing.isPaid || existing.status === 'BEZAHLT' || existing.status === 'STORNIERT' || existing.status === 'STORNO_BELEG') {
          return res.status(400).json({
            error: 'Bezahlte und steuerlich festgeschriebene Rechnungen können gem. GoBD und KassenSichV nicht gelöscht werden. Bitte erstellen Sie eine Stornorechnung.'
          });
        }
        await db.delete(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, Number(id)));
        await db.delete(schema.invoices).where(eq(schema.invoices.id, Number(id)));
        broadcastEvent('INVOICES_CHANGED', { action: 'delete', invoiceId: Number(id) });
        return res.json({ success: true });
      }
    }
  } catch (err: any) {
    console.warn('DB delete failed for invoice:', err.message);
  }

  const idx = memoryInvoices.findIndex((x: any) => x.id === Number(id));
  if (idx !== -1) {
    const memInv = memoryInvoices[idx];
    if (memInv.isPaid || memInv.status === 'BEZAHLT' || memInv.status === 'STORNIERT' || memInv.status === 'STORNO_BELEG') {
      return res.status(400).json({
        error: 'Bezahlte und steuerlich festgeschriebene Rechnungen können gem. GoBD und KassenSichV nicht gelöscht werden. Bitte erstellen Sie eine Stornorechnung.'
      });
    }
    memoryInvoices.splice(idx, 1);
  }
  broadcastEvent('INVOICES_CHANGED', { action: 'delete', invoiceId: Number(id) });
  res.json({ success: true });
});

// -------------------------------------------------------------
// 6. TSE & KassenSichV Endpunkte (fiskaly SIGN DE API v2)
// -------------------------------------------------------------

// Live-Status der TSE abfragen
app.get('/api/tse/status', async (req, res) => {
  try {
    const status = await fiskalyService.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message, online: false });
  }
});

// Automatische Initialisierung von TSS & Kassen-Client (One-Click Setup)
app.post('/api/tse/init', async (req, res) => {
  try {
    const { adminPin } = req.body || {};
    const initRes = await fiskalyService.initializeTssAndClient(adminPin || '1234567890');
    res.json(initRes);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manuelle Signierung einer Rechnung
app.post('/api/tse/sign/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let inv: any = null;
    const numId = Number(id);
    if (db) {
      if (!isNaN(numId)) {
        inv = await db.query.invoices.findFirst({
          where: eq(schema.invoices.id, numId),
        });
      }
      if (!inv) {
        inv = await db.query.invoices.findFirst({
          where: eq(schema.invoices.invoiceNumber, id),
        });
      }
    }
    if (!inv) {
      inv = memoryInvoices.find((x: any) => (!isNaN(numId) && x.id === numId) || x.invoiceNumber === id);
    }
    if (!inv) {
      return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    }

    const signRes = await fiskalyService.signInvoiceTransaction({
      invoiceNumber: inv.invoiceNumber,
      totalGross: inv.totalGross,
      netLodging: inv.netLodging,
      taxLodging: inv.taxLodging,
      netService: inv.netService,
      taxService: inv.taxService,
      paymentMethod: inv.paymentMethod || 'BAR',
      isStorno: inv.status === 'STORNO_BELEG' || inv.invoiceNumber?.endsWith('-S'),
    });

    if (signRes.success) {
      inv.tseTransactionId = signRes.tseTransactionId;
      inv.tseSignature = signRes.tseSignature;
      inv.tseSignatureCounter = signRes.tseSignatureCounter;
      inv.tseSerialNumber = signRes.tseSerialNumber;
      inv.tseTimestamp = signRes.tseTimestamp;
      inv.tseQrCodeData = signRes.tseQrCodeData;
      inv.tseOfflineFallback = false;

      if (db && inv.id) {
        await db.update(schema.invoices)
          .set({
            tseTransactionId: signRes.tseTransactionId,
            tseSignature: signRes.tseSignature,
            tseSignatureCounter: signRes.tseSignatureCounter,
            tseSerialNumber: signRes.tseSerialNumber,
            tseTimestamp: signRes.tseTimestamp,
            tseQrCodeData: signRes.tseQrCodeData,
            tseOfflineFallback: false,
          })
          .where(eq(schema.invoices.id, inv.id));

        const full = await db.query.invoices.findFirst({
          where: eq(schema.invoices.id, inv.id),
          with: { items: true, guest: true, reservation: true },
        });
        if (full) inv = full;
      }
    }

    broadcastEvent('INVOICES_CHANGED', { action: 'tse-sign', invoiceId: inv?.id });
    res.json({ signRes, invoice: inv });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DSFinV-K TAR-Export für das Finanzamt anstoßen (§ 146b AO Kassen-Nachschau)
app.post('/api/tse/export', async (req, res) => {
  try {
    const exportResult = await fiskalyService.triggerExport();
    res.json(exportResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Status des TAR-Exports abfragen
app.get('/api/tse/export/:id', async (req, res) => {
  try {
    const status = await fiskalyService.getExportStatus(req.params.id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Fertiges TAR-Archiv herunterladen
app.get('/api/tse/export/:id/file', async (req, res) => {
  try {
    const arrayBuffer = await fiskalyService.getExportFile(req.params.id);
    const buffer = Buffer.from(arrayBuffer);
    res.setHeader('Content-Type', 'application/x-tar');
    res.setHeader('Content-Disposition', `attachment; filename="dsfinvk-export-${req.params.id}.tar"`);
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
