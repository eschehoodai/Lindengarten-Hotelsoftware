import {
  Dirs21Adapter,
  Dirs21Config,
  InventoryUpdateDTO,
  ChannelReservationDTO,
  ConnectionTestResult,
  SyncPushResult,
} from './types.js';

let mockBookingQueue: ChannelReservationDTO[] = [];

export class Dirs21MockAdapter implements Dirs21Adapter {
  readonly channelName = 'DIRS21-Mock-Simulator';

  async testConnection(config: Dirs21Config): Promise<ConnectionTestResult> {
    const start = Date.now();
    // Simuliere Netzwerklatenz 30-60ms
    await new Promise((r) => setTimeout(r, 45));
    const pingMs = Date.now() - start;

    return {
      success: true,
      message: `DIRS21 Mock-WebService V2 antwortet einwandfrei. Hotel-ID: ${config.hotelId}, Benutzer: ${config.username}`,
      pingMs,
      environment: 'mock',
    };
  }

  async pushInventory(
    config: Dirs21Config,
    updates: InventoryUpdateDTO[]
  ): Promise<SyncPushResult> {
    const timeStamp = new Date().toISOString();
    const updateNodes = updates
      .map(
        (u) => `      <AvailStatusMessage BookingLimit="${u.availableRooms}">
        <StatusApplicationControl Start="${u.date}" End="${u.date}" InvTypeCode="${u.channelRoomId}" />
      </AvailStatusMessage>`
      )
      .join('\n');

    const rawRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ota="http://www.opentravel.org/OTA/2003/05">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${config.username}</wsse:Username>
        <wsse:Password>${config.password ? '******' : 'DEMO'}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ota:OTA_HotelAvailNotifRQ TimeStamp="${timeStamp}" Target="Production" Version="2.001">
      <ota:POS>
        <ota:Source>
          <ota:RequestorID ID="${config.hotelId}" Type="DIRS21" />
        </ota:Source>
      </ota:POS>
      <ota:AvailStatusMessages HotelCode="${config.hotelId}">
${updateNodes}
      </ota:AvailStatusMessages>
    </ota:OTA_HotelAvailNotifRQ>
  </soapenv:Body>
</soapenv:Envelope>`;

    const rawResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ota:OTA_HotelAvailNotifRS xmlns:ota="http://www.opentravel.org/OTA/2003/05" TimeStamp="${new Date().toISOString()}" Version="2.001">
      <ota:Success/>
      <ota:Warnings>
        <ota:Warning Type="INFO">Mock: ${updates.length} Kontingenteinträge erfolgreich in DIRS21-Simulation aktualisiert.</ota:Warning>
      </ota:Warnings>
    </ota:OTA_HotelAvailNotifRS>
  </soapenv:Body>
</soapenv:Envelope>`;

    return {
      success: true,
      rawRequest,
      rawResponse,
    };
  }

  async fetchReservations(config: Dirs21Config): Promise<{
    reservations: ChannelReservationDTO[];
    rawRequest: string;
    rawResponse: string;
  }> {
    const rawRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ota="http://www.opentravel.org/OTA/2003/05">
  <soapenv:Body>
    <ota:OTA_ReadRQ TimeStamp="${new Date().toISOString()}" Target="Production" Version="2.001">
      <ota:POS>
        <ota:Source>
          <ota:RequestorID ID="${config.hotelId}" Type="DIRS21" />
        </ota:Source>
      </ota:POS>
      <ota:ReadRequests>
        <ota:HotelReadRequest HotelCode="${config.hotelId}">
          <ota:SelectionCriteria SelectionType="Undelivered"/>
        </ota:HotelReadRequest>
      </ota:ReadRequests>
    </ota:OTA_ReadRQ>
  </soapenv:Body>
</soapenv:Envelope>`;

    const popped = [...mockBookingQueue];
    mockBookingQueue = [];

    const rawResponse = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <ota:OTA_ResRetrieveRS xmlns:ota="http://www.opentravel.org/OTA/2003/05" TimeStamp="${new Date().toISOString()}" Version="2.001">
      <ota:Success/>
      <ota:ReservationsList Count="${popped.length}">
        <!-- ${popped.length} reservierte Vorgänge abgerufen -->
      </ota:ReservationsList>
    </ota:OTA_ResRetrieveRS>
  </soapenv:Body>
</soapenv:Envelope>`;

    return {
      reservations: popped,
      rawRequest,
      rawResponse,
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

  // Simulator-Methode zum Erzeugen realistischer Buchungsszenarien
  static injectScenario(
    scenario: 'clean' | 'tetris' | 'collision_unassigned' | 'december' | 'cancel' = 'clean'
  ): ChannelReservationDTO {
    const randomId = Math.floor(10000000 + Math.random() * 90000000).toString();
    const otaCode = 'BKG-' + Math.floor(100000 + Math.random() * 900000);

    const baseGuest = {
      firstName: 'Maximilian',
      lastName: 'Mustermann',
      email: 'm.mustermann@beispiel.de',
      phone: '+49 170 1234567',
      street: 'Hauptstraße 42',
      zipCode: '02763',
      city: 'Zittau',
      country: 'Deutschland',
    };

    let booking: ChannelReservationDTO;

    if (scenario === 'tetris' || scenario === 'collision_unassigned') {
      // Bucht Einzelzimmer EZ (Gesinde Kammer) vom 05. bis 08.10.2026.
      // Da Gesinde Kammer bereits 04.-09.10. belegt ist und Lindengarten nur 1 EZ hat,
      // ist diese Buchung mathematisch garantiert unzugewiesen (landet in der Unzugewiesen-Zeile)!
      booking = {
        externalReservationId: 'DIRS-' + randomId,
        otaConfirmationCode: otaCode,
        channelSource: 'DIRS21 / Booking.com',
        action: 'NEW',
        categoryCode: 'EZ',
        channelRoomId: '101',
        arrivalDate: '2026-10-05',
        departureDate: '2026-10-08',
        nights: 3,
        adultsCount: 1,
        childrenCount: 0,
        pricePerNight: 65.0,
        totalPrice: 195.0,
        boardType: 'Frühstück',
        guest: {
          ...baseGuest,
          firstName: 'Susanne & Frank',
          lastName: 'Overbeck (Kollision / Unzugewiesen)',
        },
        notes: 'Online-Buchung via DIRS21 (Booking.com). Kollidiert mit Gesinde Kammer -> Landet in Zeile "Unzugewiesen".',
        rawPayload: `<MockXML id="${randomId}" />`,
      };
    } else if (scenario === 'december') {
      // Bucht Doppelzimmer für Zukunftsmonat Dezember 2026 (11.12. - 15.12.2026)
      booking = {
        externalReservationId: 'DIRS-' + randomId,
        otaConfirmationCode: otaCode,
        channelSource: 'DIRS21 / Booking.com',
        action: 'NEW',
        categoryCode: 'DZ',
        channelRoomId: '102',
        arrivalDate: '2026-12-11',
        departureDate: '2026-12-15',
        nights: 4,
        adultsCount: 2,
        childrenCount: 0,
        pricePerNight: 95.0,
        totalPrice: 380.0,
        boardType: 'Frühstück',
        guest: {
          ...baseGuest,
          firstName: 'Dr. Martin',
          lastName: 'Winterstein (Dezember-Gast)',
        },
        notes: 'Online-Buchung via DIRS21 (Booking.com) für Weihnachtsmarkt-Wochenende im Dezember 2026.',
        rawPayload: `<MockXMLDecember id="${randomId}" />`,
      };
    } else if (scenario === 'cancel') {
      booking = {
        externalReservationId: 'DIRS-19101', // referenziert Test-Buchung
        otaConfirmationCode: otaCode,
        channelSource: 'DIRS21 / Expedia',
        action: 'CANCEL',
        categoryCode: 'DZ',
        channelRoomId: '102',
        arrivalDate: '2026-10-02',
        departureDate: '2026-10-06',
        nights: 4,
        adultsCount: 2,
        childrenCount: 0,
        pricePerNight: 95.0,
        totalPrice: 380.0,
        boardType: 'Frühstück',
        guest: {
          ...baseGuest,
          firstName: 'Thomas',
          lastName: 'Bergmann',
        },
        notes: 'Stornierung durch Gast via Expedia über DIRS21.',
        rawPayload: `<MockXMLCancel id="${randomId}" />`,
      };
    } else {
      // Saubere Direktzuweisung Doppelzimmer in Oktober 2026
      booking = {
        externalReservationId: 'DIRS-' + randomId,
        otaConfirmationCode: otaCode,
        channelSource: 'DIRS21 / Booking.com',
        action: 'NEW',
        categoryCode: 'DZ',
        channelRoomId: '102',
        arrivalDate: '2026-10-23',
        departureDate: '2026-10-26',
        nights: 3,
        adultsCount: 2,
        childrenCount: 0,
        pricePerNight: 90.0,
        totalPrice: 270.0,
        boardType: 'Frühstück',
        guest: baseGuest,
        notes: 'Online-Buchung via DIRS21 (Booking.com). Direktzuweisung in freies Zimmer.',
        rawPayload: `<MockXMLClean id="${randomId}" />`,
      };
    }

    mockBookingQueue.push(booking);
    return booking;
  }
}
