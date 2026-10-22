import type { Reservation, Guest, Room, Invoice, PriceVariant } from '../types';
import { 
  type InvoiceLineItem, 
  calculateSplitTax, 
  roundToCent 
} from './taxEngine';
import { HOTEL_CONFIG } from '../constants/hotelConfig';

export const DEFAULT_CLOSING_TEXT = HOTEL_CONFIG.closingText;

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

  for (const item of items) {
    const total = roundToCent(item.totalGross || (item.quantity * item.unitPriceGross));
    if (item.taxRate === 0.07 || item.taxType === 'LODGING') {
      const split = calculateSplitTax(total, 0.07);
      netLodging += split.net;
      taxLodging += split.tax;
      grossLodging += split.gross;
    } else {
      // SERVICE / F&B (19%)
      const split = calculateSplitTax(total, 0.19);
      netService += split.net;
      taxService += split.tax;
      grossService += split.gross;
    }
  }

  const totalGross = roundToCent(grossLodging + grossService);

  return {
    netLodging: roundToCent(netLodging),
    taxLodging: roundToCent(taxLodging),
    netService: roundToCent(netService),
    taxService: roundToCent(taxService),
    cityTaxAmount: 0,
    totalGross,
  };
}

export interface BreakfastSplitConfig {
  variantName?: string;
  pricePerNight: number;
  nights: number;
  breakfastPersons?: number;
  breakfastDays?: number;
  breakfastRate?: number;
}

/**
 * Berechnet den steuerrechtlichen Logis- und Frühstückssplit für Hotel Lindengarten.
 * - Zimmerbasispreis enthält Logis (7% MwSt) und Frühstück (19% MwSt à 4,80 € / Person / Tag).
 * - Anreisetag ab 15:00 Uhr hat kein Frühstück -> Tage entsprechen den Nächten.
 * - Doppelt belegt: 2 Pers. (2x 4,80 €)
 * - Einfach belegt: 1 Pers. (1x 4,80 €)
 * - Dreifach belegt: 3 Pers. (3x 4,80 €)
 * - ohne F&B: 0 Pers. (kein Abzug)
 * - Online: Vorläufiger Importstatus
 */
export function calculateBreakfastSplit(config: BreakfastSplitConfig) {
  const {
    variantName = 'Doppelt belegt',
    pricePerNight,
    nights,
    breakfastRate = 4.80,
  } = config;

  let persons = config.breakfastPersons;
  if (persons === undefined) {
    if (variantName.includes('Doppelt')) persons = 2;
    else if (variantName.includes('Einfach')) persons = 1;
    else if (variantName.includes('Dreifach')) persons = 3;
    else if (variantName.includes('ohne F&B') || variantName === 'Ohne') persons = 0;
    else if (variantName === 'Online') persons = 0;
    else persons = 2; // Default
  }

  const days = Math.max(0, config.breakfastDays ?? nights);
  const totalBreakfastCount = Math.max(0, persons * days);
  const totalRoomGross = roundToCent(pricePerNight * nights);
  const totalBreakfastGross = roundToCent(totalBreakfastCount * breakfastRate);
  const totalLodgingGross = Math.max(0, roundToCent(totalRoomGross - totalBreakfastGross));
  const lodgingUnitPrice = nights > 0 ? roundToCent(totalLodgingGross / nights) : totalLodgingGross;

  return {
    persons,
    days,
    breakfastRate,
    totalBreakfastCount,
    totalRoomGross,
    totalBreakfastGross,
    totalLodgingGross,
    lodgingUnitPrice,
    isOnline: variantName === 'Online',
  };
}

/**
 * Erstellt oder aktualisiert eine Rechnung aus den Buchungsdaten einer Reservierung.
 */
export function generateInvoiceFromReservation(
  reservation: Reservation,
  existingInvoice?: Partial<Invoice> | null,
  guests: Guest[] = [],
  rooms: Room[] = [],
  priceVariants: PriceVariant[] = []
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
    const unitPrice = reservation.pricePerNight || (reservation.totalPrice / Math.max(1, nights)) || 85.0;
    const variantName = reservation.priceVariant || 'Doppelt belegt';
    const matchedVariant = priceVariants.find((pv) => pv.name === variantName || pv.shortCode === variantName);

    const split = calculateBreakfastSplit({
      variantName,
      pricePerNight: unitPrice,
      nights,
      breakfastPersons: matchedVariant?.breakfastPersons,
      breakfastDays: reservation.breakfastDays,
      breakfastRate: matchedVariant?.breakfastRate,
    });

    let posCounter = 1;

    // 1. Position: Übernachtung Logis (7% USt)
    items.push({
      id: posCounter,
      positionNumber: posCounter,
      folioBucket: 'A',
      description: `Übernachtung ${roomName} (${variantName})`,
      roomCode,
      quantity: nights,
      unitPriceGross: split.lodgingUnitPrice,
      totalGross: split.totalLodgingGross,
      taxRate: 0.07,
      taxCode: 2,
      taxType: 'LODGING',
      dateFrom: reservation.arrivalDate,
      dateTo: reservation.departureDate,
      infoNote: split.totalBreakfastCount > 0
        ? `Logis-Anteil (7% MwSt) nach Abzug von ${split.totalBreakfastCount}x Frühstück à ${split.breakfastRate.toFixed(2)} €`
        : split.isOnline
        ? `Online-Import (Logis 7% MwSt – bitte Belegungsvariante prüfen)`
        : `Logis 7% MwSt (ohne Frühstück)`,
    });
    posCounter++;

    // 2. Position: Frühstücksbuffet (19% USt), falls Frühstück inkludiert
    if (split.totalBreakfastCount > 0) {
      items.push({
        id: posCounter,
        positionNumber: posCounter,
        folioBucket: 'A',
        description: `Frühstücksbuffet (${split.persons} Pers. x ${split.days} Tage)`,
        roomCode,
        quantity: split.totalBreakfastCount,
        unitPriceGross: split.breakfastRate,
        totalGross: split.totalBreakfastGross,
        taxRate: 0.19,
        taxCode: 1,
        taxType: 'SERVICE',
        dateFrom: reservation.arrivalDate,
        dateTo: reservation.departureDate,
        infoNote: `F&B-Bewirtung (19% MwSt, Anreisetag ab 15:00 Uhr ohne Frühstück)`,
      });
      posCounter++;
    }

    // Hinweis: Die Verpflegungsmatrix dient als reine Personal-Information (Küche & Service)
    // und erzeugt keine automatischen Rechnungsaufschläge mehr. Zusätzliche F&B-Verzehre
    // werden bei Bedarf manuell über das Folio-Konto bzw. die Kasse als Position erfasst.

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
    status: existingInvoice?.status || (existingInvoice?.isPaid ? 'BEZAHLT' : 'OFFEN'),
    tseTransactionId: existingInvoice?.tseTransactionId || undefined,
    guest,
    reservation,
  };

  return newInvoice;
}

/**
 * Erstellt eine weitere Rechnung (Zweitrechnung / Folio B/C) für eine bestehende Reservierung.
 */
export function createAdditionalInvoice(
  reservation: Reservation,
  existingInvoicesForRes: Invoice[] = [],
  guests: Guest[] = [],
  rooms: Room[] = []
): Invoice {
  const guest = reservation.guest || guests.find((g) => g.id === reservation.guestId);
  const room = reservation.room || rooms.find((r) => r.id === reservation.roomId);
  const todayStr = new Date().toISOString().split('T')[0];
  const nextSuffix = existingInvoicesForRes.length + 1;
  const baseNumber = reservation.reservationNumber || String(reservation.id);
  const invoiceNumber = `RE-${baseNumber}-${nextSuffix}`;

  // Wenn auf der ersten Rechnung die Firma stand, standardmäßig auf Privatrechnung für den Gast wechseln
  let salutation = 'Sehr geehrter Herr';
  if (guest?.salutation) {
    salutation = `${guest.salutation} ${guest.lastName || ''}`.trim();
  } else if (guest?.titleCode === 2) {
    salutation = `Sehr geehrte Frau ${guest?.lastName || ''}`.trim();
  } else if (guest?.titleCode === 3) {
    salutation = `Sehr geehrte Familie ${guest?.lastName || ''}`.trim();
  }

  const recipientName = guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : 'Gast';
  const recipientStreet = guest ? `${guest.street || ''} ${guest.houseNumber || ''}`.trim() : '';
  const recipientZip = guest?.zipCode || '';
  const recipientCity = guest?.city || '';
  const recipientCountry = guest?.country || 'Deutschland';

  const roomName = room?.name || reservation.room_name || `Zimmer ${reservation.roomId}`;
  const roomCode = room?.roomCode || reservation.room_code || `${reservation.roomId}`;

  const items: InvoiceLineItem[] = [];
  const totals = recalculateInvoiceTotals(items);

  const additionalInvoice: Invoice = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    invoiceNumber,
    reservationId: reservation.id,
    guestId: reservation.guestId,
    invoiceDate: todayStr,
    servicePeriodStart: reservation.arrivalDate,
    servicePeriodEnd: reservation.departureDate,
    nights: reservation.nights || 1,
    recipientSalutation: salutation,
    recipientName,
    recipientCompany: '', // Auf Zweitrechnung primär private Anschrift
    recipientStreet,
    recipientZip,
    recipientCity,
    recipientCountry,
    roomCode,
    roomName,
    billingDebitor: guest?.lastName || '',
    items,
    netLodging: totals.netLodging,
    taxLodging: totals.taxLodging,
    netService: totals.netService,
    taxService: totals.taxService,
    cityTaxAmount: totals.cityTaxAmount,
    totalGross: totals.totalGross,
    closingText: DEFAULT_CLOSING_TEXT,
    paymentMethod: guest?.paymentMethod || 'BAR',
    isPaid: false,
    status: 'OFFEN',
    tseTransactionId: undefined,
    guest,
    reservation,
  };

  return additionalInvoice;
}

/**
 * Erstellt eine freie Kassenrechnung (ohne Bindung an eine feste Zimmerreservierung).
 */
export function createFreeInvoice(presetGuest?: Guest | null): Invoice {
  const todayStr = new Date().toISOString().split('T')[0];
  const uniqueNum = Math.floor(1000 + Math.random() * 9000);
  const invoiceNumber = `RE-KASSE-${new Date().getFullYear()}-${uniqueNum}`;

  const recipientSalutation = presetGuest?.salutation 
    ? `${presetGuest.salutation} ${presetGuest.lastName || ''}`.trim() 
    : 'Sehr geehrte Damen und Herren';
  
  const recipientName = presetGuest 
    ? `${presetGuest.firstName || ''} ${presetGuest.lastName || ''}`.trim() 
    : 'Barzahler / Kassenkunde';
  
  const recipientCompany = presetGuest?.name2 || '';
  const recipientStreet = presetGuest ? `${presetGuest.street || ''} ${presetGuest.houseNumber || ''}`.trim() : '';
  const recipientZip = presetGuest?.zipCode || '';
  const recipientCity = presetGuest?.city || '';
  const recipientCountry = presetGuest?.country || 'Deutschland';

  const items: InvoiceLineItem[] = [];
  const totals = recalculateInvoiceTotals(items);

  const freeInvoice: Invoice = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    invoiceNumber,
    reservationId: undefined,
    guestId: presetGuest?.id || 0,
    invoiceDate: todayStr,
    servicePeriodStart: todayStr,
    servicePeriodEnd: todayStr,
    nights: 0,
    recipientSalutation,
    recipientName,
    recipientCompany,
    recipientStreet,
    recipientZip,
    recipientCity,
    recipientCountry,
    roomCode: 'KASSE',
    roomName: 'Kasse / Thekenverkauf',
    billingDebitor: recipientName,
    items,
    netLodging: totals.netLodging,
    taxLodging: totals.taxLodging,
    netService: totals.netService,
    taxService: totals.taxService,
    cityTaxAmount: totals.cityTaxAmount,
    totalGross: totals.totalGross,
    closingText: DEFAULT_CLOSING_TEXT,
    paymentMethod: 'BAR',
    isPaid: false,
    status: 'OFFEN',
    tseTransactionId: undefined,
    guest: presetGuest || undefined,
  };

  return freeInvoice;
}
