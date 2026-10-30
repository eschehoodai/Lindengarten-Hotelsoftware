import { client } from '../../db/index.js';
import { getDirs21Config } from './dirs21Config.js';
import { getDirs21Adapter } from './dirs21AdapterFactory.js';
import { calculateInventoryForCategory } from './inventoryCalculator.js';
import { writeChannelLog } from './dirs21Logger.js';
import { InventoryUpdateDTO } from './types.js';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

export async function enqueueAvailabilitySync(
  categoryCode: string,
  dateFrom: string,
  dateTo: string
): Promise<void> {
  if (!client) return;
  const now = new Date().toISOString();

  try {
    await client.execute({
      sql: `INSERT INTO channel_sync_queue (channel, category_code, date_from, date_to, status, retry_count, created_at)
            VALUES ('dirs21', ?, ?, ?, 'pending', 0, ?)`,
      args: [categoryCode, dateFrom, dateTo, now],
    });
  } catch (err: any) {
    console.warn('Queue-Insert fehlgeschlagen:', err?.message);
  }
}

export async function triggerFullSync(lookaheadDays: number = 365): Promise<{ queuedCount: number }> {
  if (!client) return { queuedCount: 0 };
  const today = new Date().toISOString().split('T')[0];
  const future = new Date(Date.now() + lookaheadDays * 86400000).toISOString().split('T')[0];

  const mappingsRes = await client.execute(`SELECT category_code FROM channel_room_mappings WHERE is_active = 1`);
  const mappings = mappingsRes.rows || [];

  for (const m of mappings) {
    await enqueueAvailabilitySync(String(m.category_code), today, future);
  }

  // Sofort anstoßen
  processOutboundQueue().catch(() => {});
  return { queuedCount: mappings.length };
}

export async function processOutboundQueue(): Promise<void> {
  if (isProcessing || !client) return;
  isProcessing = true;

  try {
    const config = getDirs21Config();
    if (!config.isActive) {
      isProcessing = false;
      return;
    }

    const nowIso = new Date().toISOString();

    // 1. Offene Items laden (inklusive solche, deren nextRetryAt erreicht ist)
    const queueRes = await client.execute({
      sql: `SELECT * FROM channel_sync_queue 
            WHERE status = 'pending' 
               OR (status = 'failed' AND retry_count < 5 AND next_retry_at <= ?)
            ORDER BY id ASC LIMIT 50`,
      args: [nowIso],
    });

    const items = queueRes.rows || [];
    if (items.length === 0) {
      isProcessing = false;
      return;
    }

    // Status auf 'processing' setzen
    const itemIds = items.map((i: any) => Number(i.id));
    const placeholders = itemIds.map(() => '?').join(',');
    await client.execute({
      sql: `UPDATE channel_sync_queue SET status = 'processing' WHERE id IN (${placeholders})`,
      args: itemIds,
    });

    // 2. Gruppieren nach Kategorie & Intervall-Merge
    const categoryGroups = new Map<string, { minDate: string; maxDate: string; itemIds: number[] }>();

    for (const item of items) {
      const cat = String(item.category_code);
      const from = String(item.date_from);
      const to = String(item.date_to);
      const id = Number(item.id);

      if (!categoryGroups.has(cat)) {
        categoryGroups.set(cat, { minDate: from, maxDate: to, itemIds: [id] });
      } else {
        const g = categoryGroups.get(cat)!;
        if (from < g.minDate) g.minDate = from;
        if (to > g.maxDate) g.maxDate = to;
        g.itemIds.push(id);
      }
    }

    // 3. Mappings abrufen
    const mappingsRes = await client.execute(`SELECT category_code, channel_room_id FROM channel_room_mappings WHERE is_active = 1`);
    const mappingMap = new Map<string, string>();
    for (const r of mappingsRes.rows || []) {
      mappingMap.set(String(r.category_code), String(r.channel_room_id));
    }

    const adapter = getDirs21Adapter(config);
    const allUpdates: InventoryUpdateDTO[] = [];
    const processedIds: number[] = [];

    for (const [cat, group] of categoryGroups.entries()) {
      const channelRoomId = mappingMap.get(cat) || '102';
      const updates = await calculateInventoryForCategory(cat, channelRoomId, group.minDate, group.maxDate);
      allUpdates.push(...updates);
      processedIds.push(...group.itemIds);
    }

    if (allUpdates.length > 0) {
      const startMs = Date.now();
      const pushRes = await adapter.pushInventory(config, allUpdates);
      const durationMs = Date.now() - startMs;

      // In Revisions-Log schreiben
      await writeChannelLog({
        channel: 'dirs21',
        direction: 'OUTBOUND',
        action: 'AVAILABILITY_PUSH',
        endpointUrl: config.endpointUrl,
        requestPayload: pushRes.rawRequest,
        responsePayload: pushRes.rawResponse,
        responseStatus: pushRes.success ? 200 : 500,
        durationMs,
        status: pushRes.success ? 'SUCCESS' : 'ERROR',
        errorMessage: pushRes.errorMessage,
      });

      const processedNow = new Date().toISOString();
      if (pushRes.success) {
        // Erfolgreich verarbeitet
        await client.execute({
          sql: `UPDATE channel_sync_queue SET status = 'completed', processed_at = ? WHERE id IN (${placeholders})`,
          args: [processedNow, ...itemIds],
        });
      } else {
        // Retry mit Exponential Backoff (30s, 2m, 10m, 30m)
        for (const item of items) {
          const retries = Number(item.retry_count || 0) + 1;
          const backoffSec = Math.pow(4, retries) * 10;
          const nextRetry = new Date(Date.now() + backoffSec * 1000).toISOString();
          await client.execute({
            sql: `UPDATE channel_sync_queue SET status = 'failed', retry_count = ?, next_retry_at = ?, error_message = ? WHERE id = ?`,
            args: [retries, nextRetry, pushRes.errorMessage || 'Netzwerkfehler', Number(item.id)],
          });
        }
      }
    }
  } catch (err: any) {
    console.error('Fehler im DIRS21 Outbound Worker:', err?.message);
  } finally {
    isProcessing = false;
  }
}

export function startOutboundWorker(intervalSeconds: number = 15): void {
  if (workerInterval) clearInterval(workerInterval);
  workerInterval = setInterval(() => {
    processOutboundQueue().catch(() => {});
  }, intervalSeconds * 1000);
}

export function stopOutboundWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}
