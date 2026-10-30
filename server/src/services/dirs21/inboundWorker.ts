import { client } from '../../db/index.js';
import { getDirs21Config } from './dirs21Config.js';
import { getDirs21Adapter } from './dirs21AdapterFactory.js';
import { writeChannelLog } from './dirs21Logger.js';
import { enqueueAvailabilitySync } from './outboundWorker.js';
import { ChannelReservationDTO } from './types.js';
import { sequenceService } from '../sequenceService.js';

let inboundInterval: NodeJS.Timeout | null = null;
let isPolling = false;
let sseBroadcaster: ((type: string, payload?: any) => void) | null = null;

export function setInboundBroadcaster(fn: (type: string, payload?: any) => void) {
  sseBroadcaster = fn;
}

export async function processSingleIncomingReservation(
  dto: ChannelReservationDTO
): Promise<{
  success: boolean;
  actionTaken: string;
  reservationId?: number;
  roomId?: number | null;
  roomName?: string | null;
  categoryCode?: string;
  guestName?: string;
  arrivalDate?: string;
  departureDate?: string;
}> {
  if (!client) return { success: false, actionTaken: 'NO_DB' };

  // 1. Idempotenz-Prüfung anhand externalReservationId
  const existingRes = await client.execute({
    sql: `SELECT id, room_id, arrival_date, departure_date, status, reservation_number 
          FROM reservations 
          WHERE external_reservation_id = ?`,
    args: [dto.externalReservationId],
  });

  const existing = existingRes.rows && existingRes.rows.length > 0 ? existingRes.rows[0] : null;

  // FALL A: STORNIERUNG (CANCEL)
  if (dto.action === 'CANCEL') {
    if (existing) {
      await client.execute({
        sql: `UPDATE reservations SET status = 'cancelled' WHERE id = ?`,
        args: [Number(existing.id)],
      });
      // Verfügbarkeit wieder freigeben für die betroffenen Tage
      await enqueueAvailabilitySync(dto.categoryCode, dto.arrivalDate, dto.departureDate);
      return { success: true, actionTaken: 'CANCELLED', reservationId: Number(existing.id) };
    }
    return { success: true, actionTaken: 'CANCEL_IGNORED_NOT_FOUND' };
  }

  // FALL B: ÄNDERUNG (MODIFY)
  if (existing && dto.action === 'MODIFY') {
    // Prüfen, ob das bisherige Zimmer noch passt
    let currentRoomId: number | null = existing.room_id ? Number(existing.room_id) : null;
    let newStatus = 'confirmed';

    if (currentRoomId) {
      // Kollisionsprüfung für das aktuelle Zimmer im geänderten Zeitraum
      const collRes = await client.execute({
        sql: `SELECT id FROM reservations 
              WHERE room_id = ? 
                AND id != ? 
                AND (status IS NULL OR status != 'cancelled')
                AND departure_date > ? 
                AND arrival_date < ?`,
        args: [currentRoomId, Number(existing.id), dto.arrivalDate, dto.departureDate],
      });

      if (collRes.rows && collRes.rows.length > 0) {
        // Kollision! Auf Tetris-Ablage ausweichen
        currentRoomId = null;
        newStatus = 'unassigned';
      }
    }

    await client.execute({
      sql: `UPDATE reservations SET 
              room_id = ?, 
              arrival_date = ?, 
              departure_date = ?, 
              nights = ?, 
              adults_count = ?, 
              children_count = ?, 
              price_per_night = ?, 
              total_price = ?, 
              status = ?, 
              last_synced_at = ?,
              notes = ?
            WHERE id = ?`,
      args: [
        currentRoomId,
        dto.arrivalDate,
        dto.departureDate,
        dto.nights,
        dto.adultsCount,
        dto.childrenCount,
        dto.pricePerNight,
        dto.totalPrice,
        newStatus,
        new Date().toISOString(),
        dto.notes || 'Geändert via DIRS21',
        Number(existing.id),
      ],
    });

    await enqueueAvailabilitySync(dto.categoryCode, dto.arrivalDate, dto.departureDate);
    return { success: true, actionTaken: 'MODIFIED', reservationId: Number(existing.id) };
  }

  // FALL C: NEUE BUCHUNG (NEW)
  if (existing) {
    // Bereits importiert! Idempotent überspringen
    return { success: true, actionTaken: 'DUPLICATE_SKIPPED', reservationId: Number(existing.id) };
  }

  // 1. Gast suchen oder anlegen
  let guestId: number;
  const guestQuery = dto.guest.email
    ? await client.execute({
        sql: `SELECT id FROM guests WHERE email = ? LIMIT 1`,
        args: [dto.guest.email],
      })
    : await client.execute({
        sql: `SELECT id FROM guests WHERE last_name = ? AND first_name = ? LIMIT 1`,
        args: [dto.guest.lastName, dto.guest.firstName],
      });

  if (guestQuery.rows && guestQuery.rows.length > 0) {
    guestId = Number(guestQuery.rows[0].id);
  } else {
    // Neuen Gast anlegen mit sauberem Nummernkreis
    const guestNumber = await sequenceService.getNextNumber('GUEST');
    const searchName = `${dto.guest.lastName}, ${dto.guest.firstName}`.trim();
    const newGuestRes = await client.execute({
      sql: `INSERT INTO guests (
              guest_number, search_name, title_code, salutation, last_name, first_name,
              street, zip_code, city, country, phone, email, payment_method, is_regular_guest, created_at
            ) VALUES (?, ?, 1, 'Sehr geehrte(r)', ?, ?, ?, ?, ?, ?, ?, ?, 'KREDIT', 0, ?) RETURNING id`,
      args: [
        guestNumber,
        searchName,
        dto.guest.lastName,
        dto.guest.firstName,
        dto.guest.street || null,
        dto.guest.zipCode || null,
        dto.guest.city || null,
        dto.guest.country || 'Deutschland',
        dto.guest.phone || null,
        dto.guest.email || null,
        new Date().toISOString(),
      ],
    });
    guestId = Number(newGuestRes.rows[0].id);
  }

  // 2. First-Fit Zimmerzuweisung innerhalb der gebuchten Kategorie
  const catRoomsRes = await client.execute({
    sql: `SELECT id, room_code FROM rooms WHERE category_code = ? AND housekeeping_status != 'maintenance' ORDER BY sort_order ASC`,
    args: [dto.categoryCode],
  });
  const catRooms = catRoomsRes.rows || [];

  let assignedRoomId: number | null = null;
  let assignedRoomName: string | null = null;
  let resStatus = 'confirmed';

  for (const r of catRooms) {
    const candidateId = Number(r.id);
    const collRes = await client.execute({
      sql: `SELECT id FROM reservations 
            WHERE room_id = ? 
              AND (status IS NULL OR status != 'cancelled')
              AND departure_date > ? 
              AND arrival_date < ?`,
      args: [candidateId, dto.arrivalDate, dto.departureDate],
    });

    if (!collRes.rows || collRes.rows.length === 0) {
      // Zimmer ist für den gesamten Zeitraum kollisionsfrei frei!
      assignedRoomId = candidateId;
      assignedRoomName = String(r.name || r.room_code || candidateId);
      break;
    }
  }

  // Wenn kein einzelnes Zimmer durchgehend frei war -> Tetris-Fallback!
  if (!assignedRoomId) {
    assignedRoomId = null;
    resStatus = 'unassigned';
  }

  // 3. Reservierungsnummer generieren mit sauberem Nummernkreis
  const resNumber = await sequenceService.getNextNumber('RESERVATION');
  const nowIso = new Date().toISOString();

  const insertRes = await client.execute({
    sql: `INSERT INTO reservations (
            reservation_number, guest_id, room_id, arrival_date, departure_date, nights,
            adults_count, children_count, price_variant, price_per_night, total_price,
            board_type, has_breakfast, breakfast_count, daily_arrangement,
            status, category_code, external_reservation_id, channel_source, ota_confirmation_code, last_synced_at, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Online', ?, ?, ?, 1, ?, 'Frühstück', ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    args: [
      resNumber,
      guestId,
      assignedRoomId,
      dto.arrivalDate,
      dto.departureDate,
      dto.nights,
      dto.adultsCount,
      dto.childrenCount,
      dto.pricePerNight,
      dto.totalPrice,
      dto.boardType || 'Frühstück',
      dto.adultsCount,
      resStatus,
      dto.categoryCode,
      dto.externalReservationId,
      dto.channelSource,
      dto.otaConfirmationCode,
      nowIso,
      resStatus === 'unassigned'
        ? `⚠️ ONLINE-BUCHUNG UNZUGEWIESEN: Kein freies ${dto.categoryCode}-Zimmer am Stück. Bitte Buchung im Kalender öffnen und manuell einem freien Zimmer zuweisen.`
        : dto.notes || `Online-Buchung (${dto.channelSource})`,
      nowIso,
    ],
  });

  const newReservationId = Number(insertRes.rows[0].id);

  // 4. Outbound-Verfügbarkeit nachführen
  await enqueueAvailabilitySync(dto.categoryCode, dto.arrivalDate, dto.departureDate);

  return {
    success: true,
    actionTaken: resStatus === 'unassigned' ? 'UNASSIGNED_TETRIS' : 'CREATED',
    reservationId: newReservationId,
    roomId: assignedRoomId,
    roomName: assignedRoomName,
    guestName: `${dto.guest.firstName} ${dto.guest.lastName}`,
    categoryCode: dto.categoryCode,
    arrivalDate: dto.arrivalDate,
    departureDate: dto.departureDate,
  };
}

export async function pollInboundReservationsNow(): Promise<{ processedCount: number }> {
  if (isPolling || !client) return { processedCount: 0 };
  isPolling = true;

  try {
    const config = getDirs21Config();
    if (!config.isActive) {
      isPolling = false;
      return { processedCount: 0 };
    }

    const adapter = getDirs21Adapter(config);
    const startMs = Date.now();
    const fetchResult = await adapter.fetchReservations(config);
    const durationMs = Date.now() - startMs;

    let processedCount = 0;

    for (const resDto of fetchResult.reservations) {
      const result = await processSingleIncomingReservation(resDto);
      if (result.success) {
        processedCount++;
        await adapter.acknowledgeReservation(config, resDto.externalReservationId, 'SUCCESS');
      }
    }

    // Protokollieren
    await writeChannelLog({
      channel: 'dirs21',
      direction: 'INBOUND',
      action: 'BOOKING_FETCH',
      endpointUrl: config.endpointUrl,
      requestPayload: fetchResult.rawRequest,
      responsePayload: fetchResult.rawResponse,
      responseStatus: 200,
      durationMs,
      status: 'SUCCESS',
    });

    if (processedCount > 0 && sseBroadcaster) {
      sseBroadcaster('RESERVATIONS_CHANGED', { action: 'channel_import', count: processedCount });
    }

    return { processedCount };
  } catch (err: any) {
    console.error('Fehler beim DIRS21 Inbound Polling:', err?.message);
    return { processedCount: 0 };
  } finally {
    isPolling = false;
  }
}

export function startInboundWorker(intervalSeconds: number = 120): void {
  if (inboundInterval) clearInterval(inboundInterval);
  inboundInterval = setInterval(() => {
    pollInboundReservationsNow().catch(() => {});
  }, intervalSeconds * 1000);
}

export function stopInboundWorker(): void {
  if (inboundInterval) {
    clearInterval(inboundInterval);
    inboundInterval = null;
  }
}
