/**
 * Steuern, Rundungen & Abrechnungs-Engine (Hotel Lindengarten)
 *
 * Implementiert die deutschen Steuervorschriften (§ 12 UStG),
 * die Leipziger Beherbergungssteuersatzung (5% strikt cent-abgerundet),
 * sowie das Dreifach-Folio-Splitting (Folio A, B, C) nach ELAN hogatec Standard.
 */

export type TaxType = 'LODGING' | 'SERVICE' | 'CITY_TAX' | 'EXEMPT';
export type TaxRate = 0.07 | 0.19 | 0.00;
export type TaxExemptReason = 'beruflich' | 'minderjaehrig' | 'schwerbehindert' | 'medizinisch' | string;

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

/**
 * Leipziger Beherbergungssteuer (City Tax Leipzig)
 *
 * Gesetzliche Vorgaben:
 * 1. Steuersatz: 5,00 % (dynamisch konfigurierbar)
 * 2. Bemessungsgrundlage: Ausschließlich das reine Übernachtungsbrutto (Logis).
 *    F&B (Frühstück, Minibar, Restaurant), Parkplatz etc. sind STEUERFREI bezüglich City Tax!
 * 3. Rundungsvorschrift: Gesetzlich strikt auf volle Cent ABGERUNDET (Floor).
 *    Beispiel: 83,50 € * 5% = 4,175 € -> 4,17 €
 * 4. Befreiungen:
 *    - Minderjährige (< 18 Jahre)
 *    - Schwerbehinderte mit GdB >= 80
 *    - Zwingend medizinische Übernachtung
 *    - Beruflich veranlasste Übernachtung (falls belegt)
 */
export function calculateLeipzigCityTax(
  lodgingGross: number,
  isExempt: boolean = false,
  exemptReason?: string | null,
  taxRatePercent: number = 5.0
): {
  cityTaxAmount: number;
  isExempt: boolean;
  reason?: string;
  basisAmount: number;
} {
  const basisAmount = roundToCent(Math.max(0, lodgingGross));

  // Befreiungsprüfung
  if (isExempt || (exemptReason && exemptReason.trim().length > 0)) {
    return {
      cityTaxAmount: 0.0,
      isExempt: true,
      reason: exemptReason || 'Befreit',
      basisAmount,
    };
  }

  if (basisAmount === 0 || taxRatePercent <= 0) {
    return {
      cityTaxAmount: 0.0,
      isExempt: false,
      basisAmount,
    };
  }

  // Satzungsgemäße Abrundung auf volle Cent (Math.floor mit Epsilon)
  const rawTax = basisAmount * (taxRatePercent / 100);
  const cityTaxAmount = Math.floor((rawTax + 1e-9) * 100) / 100;

  return {
    cityTaxAmount,
    isExempt: false,
    basisAmount,
  };
}

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
  isCityTaxExempt: boolean = false,
  cityTaxExemptReason?: string | null,
  cityTaxRatePercent: number = 5.0
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
    } else if (item.taxType === 'SERVICE' || item.taxRate === 0.19) {
      const split = calculateSplitTax(gross, 0.19);
      targetFolio.grossService = roundToCent(targetFolio.grossService + split.gross);
      targetFolio.netService = roundToCent(targetFolio.netService + split.net);
      targetFolio.taxService = roundToCent(targetFolio.taxService + split.tax);
    } else if (item.taxType === 'CITY_TAX' || item.taxRate === 0.00) {
      targetFolio.cityTaxAmount = roundToCent(targetFolio.cityTaxAmount + gross);
    }
  }

  // 2. City Tax für Folios berechnen, falls noch nicht explizit als Posten vorhanden
  // Wenn kein expliziter CITY_TAX Posten in den Items ist, berechnen wir die City Tax automatisch
  const hasExplicitCityTaxItem = items.some((i) => i.taxType === 'CITY_TAX');

  if (!hasExplicitCityTaxItem) {
    // City Tax wird standardmäßig dem Folio B (Gastkonto) zugeordnet,
    // falls Folio A die Logis trägt, oder direkt dem Folio, wo die Logis liegt.
    for (const bucket of ['A', 'B', 'C'] as const) {
      const folio = folios[bucket];
      if (folio.grossLodging > 0) {
        const cTax = calculateLeipzigCityTax(
          folio.grossLodging,
          isCityTaxExempt,
          cityTaxExemptReason,
          cityTaxRatePercent
        );
        folio.cityTaxAmount = roundToCent(cTax.cityTaxAmount);
      }
    }
  }

  // 3. Summen je Folio berechnen
  for (const bucket of ['A', 'B', 'C'] as const) {
    const f = folios[bucket];
    f.totalNet = roundToCent(f.netLodging + f.netService + f.cityTaxAmount);
    f.totalTax = roundToCent(f.taxLodging + f.taxService);
    f.totalGross = roundToCent(f.grossLodging + f.grossService + f.cityTaxAmount);
  }

  // 4. Gesamtsummen über alle Folios
  const netLodging = roundToCent(folios.A.netLodging + folios.B.netLodging + folios.C.netLodging);
  const taxLodging = roundToCent(folios.A.taxLodging + folios.B.taxLodging + folios.C.taxLodging);
  const grossLodging = roundToCent(folios.A.grossLodging + folios.B.grossLodging + folios.C.grossLodging);

  const netService = roundToCent(folios.A.netService + folios.B.netService + folios.C.netService);
  const taxService = roundToCent(folios.A.taxService + folios.B.taxService + folios.C.taxService);
  const grossService = roundToCent(folios.A.grossService + folios.B.grossService + folios.C.grossService);

  const cityTaxAmount = roundToCent(folios.A.cityTaxAmount + folios.B.cityTaxAmount + folios.C.cityTaxAmount);

  const totalNet = roundToCent(netLodging + netService + cityTaxAmount);
  const totalTax = roundToCent(taxLodging + taxService);
  const totalGross = roundToCent(grossLodging + grossService + cityTaxAmount);

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
 * - Folio B: Frühstück / Verpflegung (19% USt) + City Tax Leipzig (0% USt)
 */
export function generateDefaultFolioItems(params: {
  guestName: string;
  roomCode: string;
  nights: number;
  lodgingPricePerNight: number;
  breakfastCountTotal?: number;
  breakfastPricePerPerson?: number;
  isCityTaxExempt?: boolean;
  cityTaxExemptReason?: string | null;
  dateFrom?: string;
  dateTo?: string;
}): InvoiceLineItem[] {
  const {
    guestName,
    roomCode,
    nights,
    lodgingPricePerNight,
    breakfastCountTotal = 0,
    breakfastPricePerPerson = 12.5,
    isCityTaxExempt = false,
    cityTaxExemptReason = null,
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

  // 3. Posten: Leipziger Beherbergungssteuer auf Folio B (Gastkonto)
  const cityTax = calculateLeipzigCityTax(
    totalLodgingGross,
    isCityTaxExempt,
    cityTaxExemptReason
  );

  if (cityTax.cityTaxAmount > 0) {
    items.push({
      positionNumber: pos++,
      folioBucket: 'B',
      description: `Beherbergungssteuer Stadt Leipzig (5% auf ${totalLodgingGross.toFixed(2)} € Logis)`,
      roomCode,
      quantity: 1,
      unitPriceGross: cityTax.cityTaxAmount,
      totalGross: cityTax.cityTaxAmount,
      taxRate: 0.00,
      taxCode: 0,
      taxType: 'CITY_TAX',
      dateFrom,
      dateTo,
      infoNote: `Gesetzlich cent-abgerundet nach Satzung der Stadt Leipzig`,
    });
  }

  return items;
}
