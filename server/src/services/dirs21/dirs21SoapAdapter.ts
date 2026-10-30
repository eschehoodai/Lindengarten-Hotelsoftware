import {
  Dirs21Adapter,
  Dirs21Config,
  InventoryUpdateDTO,
  ChannelReservationDTO,
  ConnectionTestResult,
  SyncPushResult,
} from './types.js';

export class Dirs21SoapAdapter implements Dirs21Adapter {
  readonly channelName = 'DIRS21-WebService-V2';

  async testConnection(config: Dirs21Config): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      const response = await fetch(config.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'http://www.opentravel.org/OTA/2003/05/OTA_Ping',
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ota="http://www.opentravel.org/OTA/2003/05">
  <soapenv:Header/>
  <soapenv:Body>
    <ota:OTA_PingRQ TimeStamp="${new Date().toISOString()}" Version="2.001">
      <ota:EchoData>Ping</ota:EchoData>
    </ota:OTA_PingRQ>
  </soapenv:Body>
</soapenv:Envelope>`,
      });

      const pingMs = Date.now() - start;
      if (response.ok) {
        return {
          success: true,
          message: `Verbindung zu DIRS21 (${config.environment}) erfolgreich (${response.status} OK)`,
          pingMs,
          environment: config.environment,
        };
      } else {
        return {
          success: false,
          message: `DIRS21 Endpunkt antwortete mit HTTP ${response.status}: ${response.statusText}`,
          pingMs,
          environment: config.environment,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Netzwerkfehler beim Verbinden zu DIRS21 (${config.endpointUrl}): ${err?.message}`,
        pingMs: Date.now() - start,
        environment: config.environment,
      };
    }
  }

  async pushInventory(
    config: Dirs21Config,
    updates: InventoryUpdateDTO[]
  ): Promise<SyncPushResult> {
    // Platzhalter für echtes SOAP-Handling nach Erhalt der DIRS21 WSDL/XSD Spezifikation
    return {
      success: true,
      rawRequest: `<SOAP_PENDING_XSD count="${updates.length}"/>`,
      rawResponse: `<SOAP_RESPONSE_PENDING/>`,
    };
  }

  async fetchReservations(config: Dirs21Config): Promise<{
    reservations: ChannelReservationDTO[];
    rawRequest: string;
    rawResponse: string;
  }> {
    return {
      reservations: [],
      rawRequest: `<SOAP_READ_PENDING_XSD/>`,
      rawResponse: `<SOAP_RESPONSE_PENDING/>`,
    };
  }

  async acknowledgeReservation(
    config: Dirs21Config,
    externalId: string,
    status: 'SUCCESS' | 'ERROR',
    message?: string
  ): Promise<boolean> {
    return true;
  }
}
