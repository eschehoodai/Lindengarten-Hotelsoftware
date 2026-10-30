import { client, schema } from '../../db/index.js';
import { desc } from 'drizzle-orm';

export interface LogEntry {
  channel?: string;
  direction: 'INBOUND' | 'OUTBOUND';
  action: 'AVAILABILITY_PUSH' | 'BOOKING_FETCH' | 'BOOKING_ACK' | 'CONNECTION_TEST';
  endpointUrl: string;
  requestPayload: string;
  responsePayload?: string;
  responseStatus?: number;
  durationMs: number;
  status: 'SUCCESS' | 'ERROR';
  errorMessage?: string;
}

export async function writeChannelLog(entry: LogEntry): Promise<void> {
  const channel = entry.channel || 'dirs21';
  const now = new Date().toISOString();

  try {
    if (client) {
      await client.execute({
        sql: `INSERT INTO channel_sync_logs 
              (channel, direction, action, endpoint_url, request_payload, response_payload, response_status, duration_ms, status, error_message, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          channel,
          entry.direction,
          entry.action,
          entry.endpointUrl,
          entry.requestPayload,
          entry.responsePayload || null,
          entry.responseStatus || (entry.status === 'SUCCESS' ? 200 : 500),
          entry.durationMs,
          entry.status,
          entry.errorMessage || null,
          now,
        ],
      });
    }
  } catch (err: any) {
    console.warn('Logging in channel_sync_logs fehlgeschlagen:', err?.message);
  }
}

export async function getRecentChannelLogs(limit: number = 50) {
  try {
    if (client) {
      const res = await client.execute({
        sql: `SELECT * FROM channel_sync_logs ORDER BY id DESC LIMIT ?`,
        args: [limit],
      });
      return res.rows || [];
    }
  } catch (err: any) {
    console.warn('Abruf aus channel_sync_logs fehlgeschlagen:', err?.message);
  }
  return [];
}
