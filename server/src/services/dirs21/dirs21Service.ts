import { client } from '../../db/index.js';
import { getDirs21Config, saveDirs21Config } from './dirs21Config.js';
import { getDirs21Adapter } from './dirs21AdapterFactory.js';
import { Dirs21MockAdapter } from './dirs21MockAdapter.js';
import { writeChannelLog, getRecentChannelLogs } from './dirs21Logger.js';
import {
  enqueueAvailabilitySync,
  triggerFullSync,
  startOutboundWorker,
  stopOutboundWorker,
} from './outboundWorker.js';
import {
  startInboundWorker,
  stopInboundWorker,
  pollInboundReservationsNow,
  processSingleIncomingReservation,
  setInboundBroadcaster,
} from './inboundWorker.js';
import { Dirs21Config } from './types.js';

export class Dirs21Service {
  private static instance: Dirs21Service;

  private constructor() {}

  public static getInstance(): Dirs21Service {
    if (!Dirs21Service.instance) {
      Dirs21Service.instance = new Dirs21Service();
    }
    return Dirs21Service.instance;
  }

  public init(broadcastFn: (type: string, payload?: any) => void): void {
    setInboundBroadcaster(broadcastFn);
    const config = getDirs21Config();

    if (config.isActive) {
      startOutboundWorker(config.syncIntervalSeconds || 15);
      startInboundWorker(config.pollingIntervalSeconds || 120);
      console.log('📡 DIRS21 Channel Manager Service (2-Wege Light) gestartet. Modus:', config.environment);
    }
  }

  public getConfig(): Dirs21Config {
    return getDirs21Config();
  }

  public updateConfig(partial: Partial<Dirs21Config>): Dirs21Config {
    const updated = saveDirs21Config(partial);
    // Worker mit neuen Intervallen neu starten
    stopOutboundWorker();
    stopInboundWorker();
    if (updated.isActive) {
      startOutboundWorker(updated.syncIntervalSeconds || 15);
      startInboundWorker(updated.pollingIntervalSeconds || 120);
    }
    return updated;
  }

  public async getMappings() {
    if (!client) return [];
    const res = await client.execute(`SELECT * FROM channel_room_mappings ORDER BY id ASC`);
    return res.rows || [];
  }

  public async updateMapping(id: number, data: { channelRoomId?: string; channelRoomName?: string; isActive?: boolean }) {
    if (!client) return null;
    await client.execute({
      sql: `UPDATE channel_room_mappings 
            SET channel_room_id = COALESCE(?, channel_room_id),
                channel_room_name = COALESCE(?, channel_room_name),
                is_active = COALESCE(?, is_active),
                updated_at = ?
            WHERE id = ?`,
      args: [
        data.channelRoomId ?? null,
        data.channelRoomName ?? null,
        data.isActive !== undefined ? (data.isActive ? 1 : 0) : null,
        new Date().toISOString(),
        id,
      ],
    });
    const res = await client.execute({ sql: `SELECT * FROM channel_room_mappings WHERE id = ?`, args: [id] });
    return res.rows && res.rows[0] ? res.rows[0] : null;
  }

  public async testConnection() {
    const config = getDirs21Config();
    const adapter = getDirs21Adapter(config);
    const result = await adapter.testConnection(config);

    await writeChannelLog({
      channel: 'dirs21',
      direction: 'OUTBOUND',
      action: 'CONNECTION_TEST',
      endpointUrl: config.endpointUrl,
      requestPayload: `<Ping hotelId="${config.hotelId}" environment="${config.environment}" />`,
      responsePayload: `<PingResult success="${result.success}" pingMs="${result.pingMs}">${result.message}</PingResult>`,
      responseStatus: result.success ? 200 : 500,
      durationMs: result.pingMs,
      status: result.success ? 'SUCCESS' : 'ERROR',
      errorMessage: result.success ? undefined : result.message,
    });

    return result;
  }

  public async triggerFullSync(lookaheadDays: number = 365) {
    return await triggerFullSync(lookaheadDays);
  }

  public async triggerInboundPoll() {
    return await pollInboundReservationsNow();
  }

  public async simulateMockBooking(
    scenario: 'clean' | 'tetris' | 'collision_unassigned' | 'december' | 'cancel' = 'clean'
  ) {
    const simulatedDto = Dirs21MockAdapter.injectScenario(scenario);
    const processResult = await processSingleIncomingReservation(simulatedDto);
    return {
      scenario,
      booking: simulatedDto,
      processResult,
    };
  }

  public async notifyAvailabilityChange(categoryCode: string, dateFrom: string, dateTo: string) {
    await enqueueAvailabilitySync(categoryCode, dateFrom, dateTo);
  }

  public async getRecentLogs(limit: number = 50) {
    return await getRecentChannelLogs(limit);
  }
}

export const dirs21Service = Dirs21Service.getInstance();
