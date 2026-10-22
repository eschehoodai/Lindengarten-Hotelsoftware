import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configFilePath = path.resolve(__dirname, '../../data/fiskaly_config.json');

export interface FiskalyConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
  tssId?: string;
  clientId?: string;
  adminPin?: string;
  clientSerial?: string;
}

export interface FiskalySignResult {
  success: boolean;
  fallback?: boolean;
  error?: string;
  tseTransactionId?: string;
  tseTransactionNumber?: number;
  tseSignature?: string;
  tseSignatureCounter?: number;
  tseSignatureAlgorithm?: string;
  tseSerialNumber?: string;
  tseTimeStart?: number;
  tseTimeEnd?: number;
  tseTimestamp?: string;
  tseQrCodeData?: string;
  tseOfflineFallback?: boolean;
}

class FiskalyService {
  private config: FiskalyConfig;
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): FiskalyConfig {
    const defaultConfig: FiskalyConfig = {
      baseUrl: process.env.FISKALY_BASE_URL || 'https://kassensichv-middleware.fiskaly.com',
      apiKey: process.env.FISKALY_API_KEY || '',
      apiSecret: process.env.FISKALY_API_SECRET || '',
      timeoutMs: Number(process.env.FISKALY_TIMEOUT_MS) || 4000,
      clientSerial: process.env.FISKALY_CLIENT_SERIAL || 'ERS-LINDENGARTEN-POS-01',
    };

    try {
      if (fs.existsSync(configFilePath)) {
        const fileData = JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
        return { ...defaultConfig, ...fileData };
      }
    } catch (err: any) {
      console.warn('Could not read fiskaly_config.json:', err.message);
    }

    return defaultConfig;
  }

  public saveConfig(updates: Partial<FiskalyConfig>) {
    this.config = { ...this.config, ...updates };
    try {
      const dir = path.dirname(configFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(configFilePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err: any) {
      console.error('Failed to save fiskaly_config.json:', err.message);
    }
  }

  public getConfig(): FiskalyConfig {
    return { ...this.config };
  }

  /**
   * Token-Management mit Caching gem. fiskaly Best Practices (24h Gültigkeit)
   */
  public async getAuthToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && now < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    const { apiKey, apiSecret, baseUrl } = this.config;
    if (!apiKey || !apiSecret) {
      throw new Error('Fiskaly API-Schlüssel oder API-Geheimnis fehlt in der Konfiguration.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch(`${baseUrl}/api/v2/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Fiskaly Auth fehlgeschlagen (${res.status}): ${errText}`);
      }

      const data: any = await res.json();
      this.cachedToken = data.access_token;
      // Gültigkeit: falls nicht übergeben, auf 23h setzen
      const expSeconds = data.access_token_expires_at || Math.floor(now / 1000) + 23 * 3600;
      this.tokenExpiresAt = expSeconds * 1000;
      return this.cachedToken!;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Universeller HTTP-Request an die fiskaly API mit automatischem Token-Handling & Retry bei 401
   */
  public async request(endpoint: string, options: RequestInit = {}, customTimeoutMs?: number): Promise<any> {
    const timeout = customTimeoutMs || this.config.timeoutMs;
    let token = await this.getAuthToken();

    const doFetch = async (bearerToken: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bearerToken}`,
          ...((options.headers as Record<string, string>) || {}),
        };

        const res = await fetch(`${this.config.baseUrl}/api/v2${endpoint}`, {
          ...options,
          headers,
          signal: controller.signal,
        });

        return res;
      } finally {
        clearTimeout(timer);
      }
    };

    let response = await doFetch(token);

    // Bei 401 Unauthorized: Einmalig Token erneuern und erneut versuchen
    if (response.status === 401) {
      token = await this.getAuthToken(true);
      response = await doFetch(token);
    }

    const responseText = await response.text();
    let responseData: any = {};
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseData = { raw: responseText };
    }

    if (!response.ok) {
      const errMsg = responseData.message || responseData.error || responseText || `HTTP ${response.status}`;
      const error: any = new Error(errMsg);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    return responseData;
  }

  /**
   * Status-Check der TSE-Anbindung
   */
  public async getStatus(): Promise<any> {
    try {
      const tssListRes = await this.request('/tss', { method: 'GET' }, 5000);
      const tssCount = tssListRes?.count || 0;
      let activeTss: any = null;

      if (this.config.tssId) {
        try {
          activeTss = await this.request(`/tss/${this.config.tssId}`, { method: 'GET' }, 4000);
        } catch (e: any) {
          console.warn('Could not fetch configured TSS:', e.message);
        }
      } else if (tssCount > 0 && Array.isArray(tssListRes.data)) {
        activeTss = tssListRes.data[0];
      }

      let activeClient: any = null;
      if (activeTss && this.config.clientId) {
        try {
          activeClient = await this.request(`/tss/${activeTss._id}/client/${this.config.clientId}`, { method: 'GET' }, 4000);
        } catch (e: any) {
          console.warn('Could not fetch configured client:', e.message);
        }
      }

      return {
        online: true,
        configured: Boolean(this.config.apiKey && this.config.apiSecret),
        tssCount,
        tssId: activeTss?._id || this.config.tssId || null,
        tssState: activeTss?.state || 'NOT_INITIALIZED',
        clientId: activeClient?._id || this.config.clientId || null,
        clientState: activeClient?.state || 'NOT_REGISTERED',
        serialNumber: activeClient?.serial_number || this.config.clientSerial,
        signatureAlgorithm: activeTss?.signature_algorithm || 'ecdsa-plain-SHA256',
        certificateId: activeTss?.bsi_certification_id || null,
        env: activeTss?._env || 'TEST',
      };
    } catch (err: any) {
      return {
        online: false,
        error: err.message,
        configured: Boolean(this.config.apiKey && this.config.apiSecret),
        tssId: this.config.tssId || null,
        clientId: this.config.clientId || null,
      };
    }
  }

  /**
   * Einmaliges Onboarding: TSS anlegen, PIN setzen, initialisieren und Kassen-Client registrieren
   */
  public async initializeTssAndClient(adminPin = '1234567890'): Promise<any> {
    console.log('[fiskaly] Starte automatische Initialisierung von TSS & Kassen-Client...');
    const tssId = this.config.tssId || crypto.randomUUID();
    const clientId = this.config.clientId || crypto.randomUUID();

    // 1. Prüfen, ob bereits eine TSS vorhanden ist
    const existingList = await this.request('/tss', { method: 'GET' }, 10000);
    let targetTssId = tssId;
    let targetAdminPuk: string | null = null;
    let tssCreated = false;

    if (existingList.count > 0 && existingList.data?.[0]?._id) {
      targetTssId = existingList.data[0]._id;
      console.log(`[fiskaly] Gefundene vorhandene TSS: ${targetTssId} (Status: ${existingList.data[0].state})`);
      if (existingList.data[0].state === 'INITIALIZED') {
        this.saveConfig({ tssId: targetTssId });
      }
    } else {
      // Neue TSS erstellen (Timeout 35s gem. Quickstart)
      console.log(`[fiskaly] Erstelle neue TSS: ${targetTssId}`);
      const createRes = await this.request(`/tss/${targetTssId}`, {
        method: 'PUT',
        body: JSON.stringify({ description: 'Hotel Lindengarten Cloud-TSE' }),
      }, 35000);

      targetAdminPuk = createRes.admin_puk;
      tssCreated = true;
      console.log(`[fiskaly] TSS erstellt. Admin-PUK erhalten.`);
    }

    // 2. Falls neu erstellt: Admin-PIN ändern, Auth & Initialisieren
    if (tssCreated && targetAdminPuk) {
      console.log('[fiskaly] Setze Admin-PIN...');
      await this.request(`/tss/${targetTssId}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({
          admin_puk: targetAdminPuk,
          new_admin_pin: adminPin,
        }),
      }, 10000);

      console.log('[fiskaly] Authentifiziere Admin mit neuer PIN...');
      await this.request(`/tss/${targetTssId}/admin/auth`, {
        method: 'POST',
        body: JSON.stringify({ admin_pin: adminPin }),
      }, 10000);

      console.log('[fiskaly] Initialisiere TSS...');
      await this.request(`/tss/${targetTssId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'INITIALIZED' }),
      }, 20000);
      console.log('[fiskaly] TSS erfolgreich auf INITIALIZED gesetzt!');
    }

    // 3. Client anlegen & registrieren
    console.log(`[fiskaly] Prüfe / erstelle Kassen-Client für TSS ${targetTssId}...`);
    const clientsRes = await this.request(`/tss/${targetTssId}/client`, { method: 'GET' }, 10000);
    let targetClientId = clientId;

    if (clientsRes.count > 0 && clientsRes.data?.[0]?._id) {
      targetClientId = clientsRes.data[0]._id;
      console.log(`[fiskaly] Vorhandener Client gefunden: ${targetClientId}`);
    } else {
      console.log(`[fiskaly] Erstelle neuen Client ${targetClientId} mit Seriennummer ${this.config.clientSerial}...`);
      await this.request(`/tss/${targetTssId}/client/${targetClientId}`, {
        method: 'PUT',
        body: JSON.stringify({ serial_number: this.config.clientSerial || 'ERS-LINDENGARTEN-POS-01' }),
      }, 15000);

      console.log(`[fiskaly] Registriere Client ${targetClientId}...`);
      await this.request(`/tss/${targetTssId}/client/${targetClientId}`, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'REGISTERED' }),
      }, 15000);
      console.log('[fiskaly] Client erfolgreich als REGISTERED registriert!');
    }

    // Speichern der IDs
    this.saveConfig({
      tssId: targetTssId,
      clientId: targetClientId,
      adminPin,
    });

    return {
      success: true,
      tssId: targetTssId,
      clientId: targetClientId,
      message: 'TSS und Kassen-Client erfolgreich initialisiert und betriebsbereit.',
    };
  }

  /**
   * Transaktionssignierung für Rechnungen gem. § 146a AO & DSFinV-K standard_v1
   * Hält sich strikt an die "Don't block the till" Regel mit automatischer Offline-Fallback Kennzeichnung.
   */
  public async signInvoiceTransaction(invoiceData: {
    invoiceNumber: string;
    totalGross: number;
    netLodging?: number;
    taxLodging?: number;
    netService?: number;
    taxService?: number;
    paymentMethod?: string;
    isStorno?: boolean;
  }): Promise<FiskalySignResult> {
    const { tssId, clientId } = this.config;

    if (!tssId || !clientId) {
      console.warn('[fiskaly] Keine TSS/Client ID konfiguriert. Verwende KassenSichV Offline-Fallback.');
      return {
        success: false,
        fallback: true,
        tseOfflineFallback: true,
        error: 'TSE noch nicht initialisiert (Offline-Fallback gem. AEAO zu § 146a aktiv)',
      };
    }

    const txId = crypto.randomUUID();
    const isStorno = Boolean(invoiceData.isStorno);
    const absGross = Math.abs(invoiceData.totalGross || 0);

    // MwSt.-Beträge nach Steuersätzen ermitteln
    const amountsPerVatRate: Array<{ vat_rate: string; amount: string }> = [];

    const grossLodging = Math.abs((invoiceData.netLodging || 0) + (invoiceData.taxLodging || 0));
    const grossService = Math.abs((invoiceData.netService || 0) + (invoiceData.taxService || 0));

    if (grossLodging > 0) {
      amountsPerVatRate.push({
        vat_rate: 'REDUCED_1', // 7% UStG
        amount: grossLodging.toFixed(2),
      });
    }

    if (grossService > 0) {
      amountsPerVatRate.push({
        vat_rate: 'NORMAL', // 19% UStG
        amount: grossService.toFixed(2),
      });
    }

    // Fallback falls keine Posten-Aufschlüsselung vorliegt
    if (amountsPerVatRate.length === 0) {
      amountsPerVatRate.push({
        vat_rate: 'NORMAL',
        amount: (absGross || 0).toFixed(2),
      });
    }

    // Zahlart zuweisen (CASH vs NON_CASH)
    const method = (invoiceData.paymentMethod || 'BAR').toUpperCase();
    const paymentType = (method === 'BAR' || method === 'CASH') ? 'CASH' : 'NON_CASH';

    const amountsPerPaymentType = [
      {
        payment_type: paymentType,
        amount: (absGross || 0).toFixed(2),
      },
    ];

    try {
      // Schritt 1: Start Transaction (Rev 1, State ACTIVE) - Max 3500ms
      await this.request(
        `/tss/${tssId}/tx/${txId}?tx_revision=1`,
        {
          method: 'PUT',
          body: JSON.stringify({
            state: 'ACTIVE',
            client_id: clientId,
          }),
        },
        3500
      );

      // Schritt 2: Finish Transaction (Rev 2, State FINISHED mit standard_v1 Schema)
      const finishPayload = {
        state: 'FINISHED',
        client_id: clientId,
        schema: {
          standard_v1: {
            receipt: {
              receipt_type: isStorno ? 'CANCELLATION' : 'RECEIPT',
              amounts_per_vat_rate: amountsPerVatRate,
              amounts_per_payment_type: amountsPerPaymentType,
            },
          },
        },
      };

      const finishRes = await this.request(
        `/tss/${tssId}/tx/${txId}?tx_revision=2`,
        {
          method: 'PUT',
          body: JSON.stringify(finishPayload),
        },
        3500
      );

      console.log(`[fiskaly] Transaktion #${finishRes.number} erfolgreich signiert für Rechnung ${invoiceData.invoiceNumber}!`);

      return {
        success: true,
        tseTransactionId: finishRes._id || txId,
        tseTransactionNumber: finishRes.number,
        tseSignature: finishRes.signature?.value,
        tseSignatureCounter: finishRes.signature?.counter,
        tseSignatureAlgorithm: finishRes.signature?.algorithm || 'ecdsa-plain-SHA256',
        tseSerialNumber: finishRes.tss_id || tssId,
        tseTimeStart: finishRes.time_start,
        tseTimeEnd: finishRes.time_end,
        tseTimestamp: finishRes.time_end ? new Date(finishRes.time_end * 1000).toISOString() : new Date().toISOString(),
        tseQrCodeData: finishRes.qr_code_data,
        tseOfflineFallback: false,
      };
    } catch (err: any) {
      console.warn(`[fiskaly] Signierung für Rechnung ${invoiceData.invoiceNumber} fehlgeschlagen (${err.message}). KassenSichV Offline-Fallback aktiviert.`);
      return {
        success: false,
        fallback: true,
        tseOfflineFallback: true,
        error: err.message,
      };
    }
  }

  /**
   * DSFinV-K TAR-Export für das Finanzamt anstoßen (§ 146b AO Kassen-Nachschau)
   */
  public async triggerExport(): Promise<any> {
    const { tssId } = this.config;
    if (!tssId) throw new Error('Keine TSS konfiguriert.');

    const exportId = crypto.randomUUID();
    console.log(`[fiskaly] Starte DSFinV-K Export ${exportId} für TSS ${tssId}...`);

    const res = await this.request(
      `/tss/${tssId}/export/${exportId}`,
      {
        method: 'PUT',
        body: JSON.stringify({}),
      },
      15000
    );

    return {
      exportId: res._id || exportId,
      status: res.state || 'PENDING',
      timeCreation: res.time_creation,
    };
  }

  /**
   * Status eines TAR-Exports prüfen
   */
  public async getExportStatus(exportId: string): Promise<any> {
    const { tssId } = this.config;
    if (!tssId) throw new Error('Keine TSS konfiguriert.');

    const res = await this.request(`/tss/${tssId}/export/${exportId}`, { method: 'GET' }, 10000);
    return res;
  }

  /**
   * Fertiges TAR-Archiv für das Finanzamt herunterladen
   */
  public async getExportFile(exportId: string): Promise<ArrayBuffer> {
    const { tssId, baseUrl } = this.config;
    if (!tssId) throw new Error('Keine TSS konfiguriert.');

    const token = await this.getAuthToken();
    const res = await fetch(`${baseUrl}/api/v2/tss/${tssId}/export/${exportId}/file`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Export-Datei nicht bereit oder fehlgeschlagen (${res.status}): ${text}`);
    }

    return await res.arrayBuffer();
  }
}

export const fiskalyService = new FiskalyService();
