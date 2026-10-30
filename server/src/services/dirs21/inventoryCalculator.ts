import { client } from '../../db/index.js';
import { InventoryUpdateDTO } from './types.js';

export async function calculateInventoryForCategory(
  categoryCode: string,
  channelRoomId: string,
  dateFrom: string, // YYYY-MM-DD
  dateTo: string    // YYYY-MM-DD
): Promise<InventoryUpdateDTO[]> {
  if (!client) return [];

  // 1. Physische Zimmer dieser Kategorie ermitteln
  const roomsRes = await client.execute({
    sql: `SELECT id, room_code, housekeeping_status FROM rooms WHERE category_code = ?`,
    args: [categoryCode],
  });
  const categoryRooms = roomsRes.rows || [];
  const totalRooms = categoryRooms.length;

  if (totalRooms === 0) return [];

  // 2. Alle aktiven Reservierungen für Zimmer dieser Kategorie in diesem Zeitraum laden
  // (Inklusive unzugewiesener Reservierungen, die dieser Kategorie zugeordnet sind)
  const roomIds = categoryRooms.map((r: any) => Number(r.id));
  const placeholders = roomIds.map(() => '?').join(',');

  const resRes = await client.execute({
    sql: `SELECT id, room_id, arrival_date, departure_date, status 
          FROM reservations 
          WHERE (room_id IN (${placeholders}) OR (room_id IS NULL AND status = 'unassigned' AND category_code = ?))
            AND departure_date > ? 
            AND arrival_date < ?
            AND (status IS NULL OR status != 'cancelled')`,
    args: [...roomIds, categoryCode, dateFrom, dateTo],
  });
  const activeReservations = resRes.rows || [];

  // 3. Tagesweises Durchlaufen von dateFrom bis dateTo
  const results: InventoryUpdateDTO[] = [];
  const start = new Date(dateFrom);
  const end = new Date(dateTo);

  // Stelle sicher, dass wir inklusive dem letzten Tag rechnen
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const curDateStr = d.toISOString().split('T')[0];

    // Zähle belegte Zimmer an diesem Tag (Gast übernachtet von curDateStr auf den Folgetag)
    let occupiedCount = 0;
    for (const res of activeReservations) {
      const arr = String(res.arrival_date);
      const dep = String(res.departure_date);
      if (arr <= curDateStr && curDateStr < dep) {
        occupiedCount++;
      }
    }

    // Wartungszimmer (maintenance) abziehen
    let maintenanceCount = 0;
    for (const r of categoryRooms) {
      if (r.housekeeping_status === 'maintenance') {
        maintenanceCount++;
      }
    }

    const available = Math.max(0, totalRooms - occupiedCount - maintenanceCount);

    results.push({
      categoryCode,
      channelRoomId,
      date: curDateStr,
      availableRooms: available,
      totalRooms,
    });
  }

  return results;
}
