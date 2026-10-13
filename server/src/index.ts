import express from 'express';
import cors from 'cors';
import { db, client, schema } from './db/index.js';
import { eq, desc } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 1. Zimmer
app.get('/api/rooms', async (req, res) => {
  try {
    const allRooms = await db.select().from(schema.rooms).orderBy(schema.rooms.sortOrder);
    res.json(allRooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { housekeepingStatus, specialCleaningNote } = req.body;
    await db.update(schema.rooms)
      .set({ housekeepingStatus, specialCleaningNote })
      .where(eq(schema.rooms.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/rooms/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { id: _, ...updateData } = req.body;
    await db.update(schema.rooms)
      .set(updateData)
      .where(eq(schema.rooms.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Gäste
app.get('/api/guests', async (req, res) => {
  try {
    const allGuests = await db.select().from(schema.guests).orderBy(desc(schema.guests.id));
    res.json(allGuests);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/guests', async (req, res) => {
  try {
    const newGuest = await db.insert(schema.guests).values({
      ...req.body,
      createdAt: new Date().toISOString()
    }).returning();
    res.status(201).json(newGuest[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/guests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.update(schema.guests)
      .set(req.body)
      .where(eq(schema.guests.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.guests).where(eq(schema.guests.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Reservierungen (Timeline Daten)
app.get('/api/reservations', async (req, res) => {
  try {
    const allRes = await db.query.reservations.findMany({
      with: {
        guest: true,
        room: true
      }
    });
    res.json(allRes);
  } catch (err: any) {
    // Fallback falls Relations nicht greifen
    try {
      const fallback = await client.execute(`
        SELECT r.*, g.last_name, g.first_name, g.search_name, rm.room_code, rm.name as room_name
        FROM reservations r
        JOIN guests g ON r.guest_id = g.id
        JOIN rooms rm ON r.room_id = rm.id;
      `);
      res.json(fallback.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const newRes = await db.insert(schema.reservations).values({
      ...req.body,
      createdAt: new Date().toISOString()
    }).returning();
    res.status(201).json(newRes[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.update(schema.reservations)
      .set(req.body)
      .where(eq(schema.reservations.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.reservations).where(eq(schema.reservations.id, Number(id)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Rechnungen & Folio-Positionen
app.get('/api/invoices', async (req, res) => {
  try {
    const allInvoices = await db.select().from(schema.invoices).orderBy(desc(schema.invoices.id));
    res.json(allInvoices);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/invoices/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const items = await db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, Number(id)));
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/invoice-items/:id/folio', async (req, res) => {
  try {
    const { id } = req.params;
    const { folioBucket } = req.body;
    await db.update(schema.invoiceItems)
      .set({ folioBucket })
      .where(eq(schema.invoiceItems.id, Number(id)));
    res.json({ success: true, folioBucket });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const newInvoice = await db.insert(schema.invoices).values({
      ...req.body,
      createdAt: new Date().toISOString()
    }).returning();
    res.status(201).json(newInvoice[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Stammdaten (Preisvarianten & Anreden)
app.get('/api/price-variants', async (req, res) => {
  try {
    const variants = await db.select().from(schema.priceVariants).orderBy(schema.priceVariants.variantNumber);
    res.json(variants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/salutations', async (req, res) => {
  try {
    const sal = await db.select().from(schema.salutations).orderBy(schema.salutations.salutationNumber);
    res.json(sal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health / Status Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'Hotelsoftware Lindengarten Backend',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🏨 Lindengarten Backend Server läuft auf Port ${PORT}`);
  console.log(`🌐 Erreichbar im lokalen Netzwerk für Rezeptions-PCs unter: http://localhost:${PORT}`);
});
