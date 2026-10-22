/**
 * Steuern, Rundungen & Abrechnungs-Engine (Hotel Lindengarten)
 *
 * Implementiert die deutschen Steuervorschriften (§ 12 UStG),
 * die Leipziger Beherbergungssteuersatzung (5% strikt cent-abgerundet),
 * sowie das Dreifach-Folio-Splitting (Folio A, B, C) nach ELAN hogatec Standard.
 */

export type TaxType = 'LODGING' | 'SERVICE' | 'CITY_TAX' | 'EXEMPT';
export type TaxRate = 0.07 | 0.19 | 0.00;

export interface InvoiceLineItem {
  id?: number;
  positionNumber: number;
  folioBucket: 'A' | 'B' | 'C';
  description: string;
  roomCode?: string;
  quantity: number;
  unitPriceGross: number;
  totalGross: number;
  taxRate: TaxRate;
  taxCode: number; // 2 = 7%, 1 = 19%, 0 = 0%
  taxType: TaxType;
  dateFrom?: string;
  dateTo?: string;
  infoNote?: string;
}

export interface FolioSummary {
  folioBucket: 'A' | 'B' | 'C';
  netLodging: number; // Netto 7%
  taxLodging: number; // USt 7%
  grossLodging: number; // Brutto 7%
  netService: number; // Netto 19%
  taxService: number; // USt 19%
  grossService: number; // Brutto 19%
  cityTaxAmount: number; // City Tax Leipzig (0% USt)
  totalNet: number;
  totalTax: number;
  totalGross: number;
  items: InvoiceLineItem[];
}

export interface InvoiceTaxCalculation {
  netLodging: number; // 7% Netto
  taxLodging: number; // 7% USt
  grossLodging: number; // 7% Brutto
  netService: number; // 19% Netto
  taxService: number; // 19% USt
  grossService: number; // 19% Brutto
  cityTaxAmount: number; // 0% USt (Leipzig Beherbergungssteuer)
  totalNet: number;
  totalTax: number;
  totalGross: number;
  folios: {
    A: FolioSummary;
    B: FolioSummary;
    C: FolioSummary;
  };
}

/**
 * Kaufmännische Rundung auf exakt 2 Nachkommastellen (Cent).
 * Verhindert IEEE 754 Rundungsartefakte.
 */
export function roundToCent(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * USt-Aufteilung für Bruttobeträge (7%, 19% oder 0%).
 * Netto = round(Brutto / (1 + Steuersatz))
 * USt = round(Brutto - Netto)
 */
export function calculateSplitTax(
  grossAmount: number,
  taxRate: TaxRate
): { net: number; tax: number; gross: number } {
  const roundedGross = roundToCent(grossAmount);
  if (taxRate === 0 || roundedGross === 0) {
    return { net: roundedGross, tax: 0, gross: roundedGross };
  }

  const net = roundToCent(roundedGross / (1 + taxRate));
  const tax = roundToCent(roundedGross - net);

  return { net, tax, gross: roundedGross };
}

// Gästetaxe & kommunale Abgaben wurden vollständig entfernt



/**
 * Erstellt eine leere Folio-Zusammenfassung
 */
function createEmptyFolioSummary(bucket: 'A' | 'B' | 'C'): FolioSummary {
  return {
    folioBucket: bucket,
    netLodging: 0,
    taxLodging: 0,
    grossLodging: 0,
    netService: 0,
    taxService: 0,
    grossService: 0,
    cityTaxAmount: 0,
    totalNet: 0,
    totalTax: 0,
    totalGross: 0,
    items: [],
  };
}

/**
 * Berechnet die vollständige Steuer- und Folio-Übersicht für eine Liste von Rechnungspositionen.
 */
export function calculateInvoiceSummary(
  items: InvoiceLineItem[],
  _isCityTaxExempt?: boolean,
  _cityTaxExemptReason?: string | null,
  _cityTaxRatePercent?: number
): InvoiceTaxCalculation {
  const folios: Record<'A' | 'B' | 'C', FolioSummary> = {
    A: createEmptyFolioSummary('A'),
    B: createEmptyFolioSummary('B'),
    C: createEmptyFolioSummary('C'),
  };

  // 1. Positionen durchlaufen und auf Folios aggregieren
  for (const item of items) {
    const bucket = item.folioBucket || 'A';
    const targetFolio = folios[bucket];
    targetFolio.items.push(item);

    const gross = roundToCent(item.totalGross);

    if (item.taxType === 'LODGING' || item.taxRate === 0.07) {
      const split = calculateSplitTax(gross, 0.07);
      targetFolio.grossLodging = roundToCent(targetFolio.grossLodging + split.gross);
      targetFolio.netLodging = roundToCent(targetFolio.netLodging + split.net);
      targetFolio.taxLodging = roundToCent(targetFolio.taxLodging + split.tax);
    } else {
      // SERVICE / F&B (19%)
      const split = calculateSplitTax(gross, 0.19);
      targetFolio.grossService = roundToCent(targetFolio.grossService + split.gross);
      targetFolio.netService = roundToCent(targetFolio.netService + split.net);
      targetFolio.taxService = roundToCent(targetFolio.taxService + split.tax);
    }
  }

  // 2. Summen je Folio berechnen
  for (const bucket of ['A', 'B', 'C'] as const) {
    const f = folios[bucket];
    f.cityTaxAmount = 0.0;
    f.totalNet = roundToCent(f.netLodging + f.netService);
    f.totalTax = roundToCent(f.taxLodging + f.taxService);
    f.totalGross = roundToCent(f.grossLodging + f.grossService);
  }

  // 3. Gesamtsummen über alle Folios
  const netLodging = roundToCent(folios.A.netLodging + folios.B.netLodging + folios.C.netLodging);
  const taxLodging = roundToCent(folios.A.taxLodging + folios.B.taxLodging + folios.C.taxLodging);
  const grossLodging = roundToCent(folios.A.grossLodging + folios.B.grossLodging + folios.C.grossLodging);

  const netService = roundToCent(folios.A.netService + folios.B.netService + folios.C.netService);
  const taxService = roundToCent(folios.A.taxService + folios.B.taxService + folios.C.taxService);
  const grossService = roundToCent(folios.A.grossService + folios.B.grossService + folios.C.grossService);

  const cityTaxAmount = 0.0;

  const totalNet = roundToCent(netLodging + netService);
  const totalTax = roundToCent(taxLodging + taxService);
  const totalGross = roundToCent(grossLodging + grossService);

  return {
    netLodging,
    taxLodging,
    grossLodging,
    netService,
    taxService,
    grossService,
    cityTaxAmount,
    totalNet,
    totalTax,
    totalGross,
    folios: {
      A: folios.A,
      B: folios.B,
      C: folios.C,
    },
  };
}

/**
 * Standard-Aufteilung einer Hotelbuchung in Folio-Positionen:
 * - Folio A: Übernachtung (7% USt)
 * - Folio B: Frühstück / Verpflegung (19% USt)
 */
export function generateDefaultFolioItems(params: {
  guestName: string;
  roomCode: string;
  nights: number;
  lodgingPricePerNight: number;
  adultsCount?: number;
  childrenCount?: number;
  smallChildrenCount?: number;
  breakfastCountTotal?: number;
  breakfastPricePerPerson?: number;
  isCityTaxExempt?: boolean;
  cityTaxExemptReason?: string | null;
  dateFrom?: string;
  dateTo?: string;
  useLegacyLeipzigCityTax?: boolean;
}): InvoiceLineItem[] {
  const {
    guestName,
    roomCode,
    nights,
    lodgingPricePerNight,
    breakfastCountTotal = 0,
    breakfastPricePerPerson = 12.5,
    dateFrom,
    dateTo,
  } = params;

  const items: InvoiceLineItem[] = [];
  let pos = 1;

  // 1. Posten: Übernachtung auf Folio A (Firmenübernahme)
  const totalLodgingGross = roundToCent(nights * lodgingPricePerNight);
  items.push({
    positionNumber: pos++,
    folioBucket: 'A',
    description: `Übernachtung Zimmer ${roomCode} (${guestName})`,
    roomCode,
    quantity: nights,
    unitPriceGross: lodgingPricePerNight,
    totalGross: totalLodgingGross,
    taxRate: 0.07,
    taxCode: 2,
    taxType: 'LODGING',
    dateFrom,
    dateTo,
    infoNote: `${nights} Übernachtungen à ${lodgingPricePerNight.toFixed(2)} €`,
  });

  // 2. Posten: Frühstück auf Folio B (Gastkonto)
  if (breakfastCountTotal > 0) {
    const totalBreakfastGross = roundToCent(breakfastCountTotal * breakfastPricePerPerson);
    items.push({
      positionNumber: pos++,
      folioBucket: 'B',
      description: `Reichhaltiges Lindengarten-Frühstücksbuffet`,
      roomCode,
      quantity: breakfastCountTotal,
      unitPriceGross: breakfastPricePerPerson,
      totalGross: totalBreakfastGross,
      taxRate: 0.19,
      taxCode: 1,
      taxType: 'SERVICE',
      dateFrom,
      dateTo,
      infoNote: `${breakfastCountTotal} Portionen à ${breakfastPricePerPerson.toFixed(2)} €`,
    });
  }

  return items;
}
