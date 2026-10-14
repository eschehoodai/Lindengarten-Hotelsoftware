import type { Reservation, Guest, Room, Invoice } from '../types';
import { 
  type InvoiceLineItem, 
  calculateSplitTax, 
  calculateJonsdorfGaestetaxe, 
  roundToCent 
} from './taxEngine';

export const DEFAULT_CLOSING_TEXT = 
  'Vielen Dank für Ihren Aufenthalt im Hotel Lindengarten! Wir hoffen, Sie hatten eine angenehme Zeit bei uns und beehren uns gerne wieder.';

/**
 * Berechnet Summen und Steueranteile für eine Liste von Rechnungspositionen.
 */
export function recalculateInvoiceTotals(items: InvoiceLineItem[]) {
  let netLodging = 0;
  let taxLodging = 0;
  let grossLodging = 0;

  let netService = 0;
  let taxService = 0;
  let grossService = 0;

  let cityTaxAmount = 0;

  for (const item of items) {
    const total = roundToCent(item.totalGross || (item.quantity * item.unitPriceGross));
    if (item.taxType === 'LODGING' || item.taxRate === 0.07) {
      const split = calculateSplitTax(total, 0.07);
      netLodging += split.net;
      taxLodging += split.tax;
      grossLodging += split.gross;
    } else if (item.taxType === 'CITY_TAX' || item.taxRate === 0.0) {
      cityTaxAmount += total;
    } else {
      // SERVICE / F&B (19%)
      const split = calculateSplitTax(total, 0.19);
      netService += split.net;
      taxService += split.tax;
      grossService += split.gross;
    }
  }

  const totalGross = roundToCent(grossLodging + grossService + cityTaxAmount);

  return {
    netLodging: roundToCent(netLodging),
    taxLodging: roundToCent(taxLodging),
    netService: roundToCent(netService),
    taxService: roundToCent(taxService),
    cityTaxAmount: roundToCent(cityTaxAmount),
    totalGross,
  };
}

/**
 * Erstellt oder aktualisiert eine Rechnung aus den Buchungsdaten einer Reservierung.
 */
export function generateInvoiceFromReservation(
  reservation: Reservation,
  existingInvoice?: Partial<Invoice> | null,
  guests: Guest[] = [],
  rooms: Room[] = []
): Invoice {
  const guest = reservation.guest || guests.find((g) => g.id === reservation.guestId);
  const room = reservation.room || rooms.find((r) => r.id === reservation.roomId);

  const todayStr = new Date().toISOString().split('T')[0];
  const invoiceNumber = existingInvoice?.invoiceNumber || `RE-${reservation.reservationNumber || reservation.id}`;

  // Anrede ermitteln
  let recipientSalutation = existingInvoice?.recipientSalutation;
  if (!recipientSalutation) {
    if (guest?.salutation) {
      recipientSalutation = `${guest.salutation} ${guest.lastName || ''}`.trim();
    } else if (guest?.titleCode === 3) {
      recipientSalutation = `Sehr geehrte Familie ${guest?.lastName || ''}`.trim();
    } else if (guest?.titleCode === 2) {
      recipientSalutation = `Sehr geehrte Frau ${guest?.lastName || ''}`.trim();
    } else if (guest?.titleCode === 4) {
      recipientSalutation = 'Sehr geehrte Damen und Herren';
    } else {
      recipientSalutation = `Sehr geehrter Herr ${guest?.lastName || ''}`.trim();
    }
  }

  const recipientName = existingInvoice?.recipientName || 
    `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || 
    reservation.last_name || 
    'Gast';

  const recipientCompany = existingInvoice?.recipientCompany || 
    guest?.name2 || 
    (reservation.billingDebitor !== guest?.lastName ? reservation.billingDebitor : '') || 
    '';

  const recipientStreet = existingInvoice?.recipientStreet || 
    (guest ? `${guest.street || ''} ${guest.houseNumber || ''}`.trim() : '');

  const recipientZip = existingInvoice?.recipientZip || guest?.zipCode || '';
  const recipientCity = existingInvoice?.recipientCity || guest?.city || '';
  const recipientCountry = existingInvoice?.recipientCountry || guest?.country || 'Deutschland';

  const nights = existingInvoice?.nights ?? (reservation.nights || 1);
  const roomName = room?.name || reservation.room_name || `Zimmer ${reservation.roomId}`;
  const roomCode = room?.roomCode || reservation.room_code || `${reservation.roomId}`;

  // Positionen generieren oder bestehende beibehalten
  let items: InvoiceLineItem[] = [];

  if (existingInvoice?.items && existingInvoice.items.length > 0) {
    items = existingInvoice.items.map((it: any, idx: number) => ({
      id: it.id || idx + 1,
      positionNumber: it.positionNumber || idx + 1,
      folioBucket: it.folioBucket || 'A',
      description: it.description || '',
      roomCode: it.roomCode || roomCode,
      quantity: Number(it.quantity) || 1,
      unitPriceGross: Number(it.unitPriceGross) || Number(it.totalGross) || 0,
      totalGross: roundToCent(Number(it.totalGross) || (Number(it.quantity) * Number(it.unitPriceGross)) || 0),
      taxRate: (it.taxRate as 0.07 | 0.19 | 0.00) ?? 0.07,
      taxCode: it.taxCode || (it.taxRate === 0.19 ? 1 : it.taxRate === 0.0 ? 0 : 2),
      taxType: it.taxType || (it.taxRate === 0.19 ? 'SERVICE' : it.taxRate === 0.0 ? 'CITY_TAX' : 'LODGING'),
      dateFrom: it.dateFrom || reservation.arrivalDate,
      dateTo: it.dateTo || reservation.departureDate,
      infoNote: it.infoNote || '',
    }));
  } else {
    // 1. Position: Übernachtung Logis (7% USt)
    const unitPrice = reservation.pricePerNight || (reservation.totalPrice / Math.max(1, nights)) || 85.0;
    const lodgingTotal = roundToCent(unitPrice * nights);

    items.push({
      id: 1,
      positionNumber: 1,
      folioBucket: 'A',
      description: `Übernachtung ${roomName} (${reservation.priceVariant || 'Standard'})`,
      roomCode,
      quantity: nights,
      unitPriceGross: unitPrice,
      totalGross: lodgingTotal,
      taxRate: 0.07,
      taxCode: 2,
      taxType: 'LODGING',
      dateFrom: reservation.arrivalDate,
      dateTo: reservation.departureDate,
      infoNote: `${reservation.adultsCount || 2} Pers., ${nights} Übernachtung(en)`,
    });

    let posCounter = 2;

    // 2. Position: Verpflegung / F&B (19% USt), falls gewählt und separat
    if (reservation.boardType && reservation.boardType !== 'Ohne' && reservation.boardType !== 'Frühstück') {
      const mealName = reservation.boardType === '2Gang' 
        ? 'Halbpension 2-Gang Menü' 
        : reservation.boardType === '3Gang' 
        ? 'Halbpension 3-Gang Menü' 
        : 'Oberlausitzer Halbpension (OHP)';
      
      const mealQuantity = (reservation.twoGangCount || reservation.threeGangCount || reservation.ohpCount || reservation.adultsCount || 1) * nights;
      const mealUnitPrice = reservation.boardType === '3Gang' ? 24.50 : 18.50;
      
      if (!reservation.isFlatRate) {
        items.push({
          id: posCounter,
          positionNumber: posCounter,
          folioBucket: 'A',
          description: `${mealName}`,
          roomCode,
          quantity: mealQuantity,
          unitPriceGross: mealUnitPrice,
          totalGross: roundToCent(mealQuantity * mealUnitPrice),
          taxRate: 0.19,
          taxCode: 1,
          taxType: 'SERVICE',
          dateFrom: reservation.arrivalDate,
          dateTo: reservation.departureDate,
          infoNote: `${reservation.boardType} für ${reservation.adultsCount || 1} Person(en)`,
        });
        posCounter++;
      }
    }

    // 3. Position: Gästetaxe Kurort Jonsdorf (0% USt)
    const jonsdorfTax = calculateJonsdorfGaestetaxe({
      nights,
      adultsCount: reservation.adultsCount || 2,
      childrenCount: reservation.childrenCount || 0,
      isExempt: guest?.isTaxExempt || false,
      exemptReason: guest?.taxExemptReason,
    });

    if (jonsdorfTax.gaestetaxeAmount > 0) {
      items.push({
        id: posCounter,
        positionNumber: posCounter,
        folioBucket: 'A',
        description: 'Gästetaxe Kurort Jonsdorf (0% MwSt gem. Satzung)',
        roomCode,
        quantity: nights,
        unitPriceGross: roundToCent(jonsdorfTax.gaestetaxeAmount / Math.max(1, nights)),
        totalGross: roundToCent(jonsdorfTax.gaestetaxeAmount),
        taxRate: 0.00,
        taxCode: 0,
        taxType: 'CITY_TAX',
        dateFrom: reservation.arrivalDate,
        dateTo: reservation.departureDate,
        infoNote: jonsdorfTax.breakdown || `${reservation.adultsCount || 2} Erw., ${reservation.childrenCount || 0} Kinder`,
      });
      posCounter++;
    }
  }

  // Summen berechnen
  const totals = recalculateInvoiceTotals(items);

  const newInvoice: Invoice = {
    id: existingInvoice?.id || (reservation.id * 1000 + 1),
    invoiceNumber,
    reservationId: reservation.id,
    guestId: reservation.guestId,
    invoiceDate: existingInvoice?.invoiceDate || todayStr,
    servicePeriodStart: reservation.arrivalDate,
    servicePeriodEnd: reservation.departureDate,
    nights,
    recipientSalutation,
    recipientName,
    recipientCompany,
    recipientStreet,
    recipientZip,
    recipientCity,
    recipientCountry,
    roomCode,
    roomName,
    billingDebitor: reservation.billingDebitor || '',
    items,
    netLodging: totals.netLodging,
    taxLodging: totals.taxLodging,
    netService: totals.netService,
    taxService: totals.taxService,
    cityTaxAmount: totals.cityTaxAmount,
    totalGross: totals.totalGross,
    closingText: existingInvoice?.closingText || DEFAULT_CLOSING_TEXT,
    paymentMethod: existingInvoice?.paymentMethod || guest?.paymentMethod || 'BAR',
    isPaid: existingInvoice?.isPaid ?? false,
    status: existingInvoice?.status || 'final',
    tseTransactionId: existingInvoice?.tseTransactionId || `TSE-2026-${Math.floor(100000 + Math.random() * 900000)}`,
    guest,
    reservation,
  };

  return newInvoice;
}
