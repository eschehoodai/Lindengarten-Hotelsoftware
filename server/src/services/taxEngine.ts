/**
 * Steuern, Rundungen & Abrechnungs-Engine (Hotel Lindengarten Backend)
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

export function roundToCent(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

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

  const rawTax = basisAmount * (taxRatePercent / 100);
  const cityTaxAmount = Math.floor((rawTax + 1e-9) * 100) / 100;

  return {
    cityTaxAmount,
    isExempt: false,
    basisAmount,
  };
}

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

  const hasExplicitCityTaxItem = items.some((i) => i.taxType === 'CITY_TAX');

  if (!hasExplicitCityTaxItem) {
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

  for (const bucket of ['A', 'B', 'C'] as const) {
    const f = folios[bucket];
    f.totalNet = roundToCent(f.netLodging + f.netService + f.cityTaxAmount);
    f.totalTax = roundToCent(f.taxLodging + f.taxService);
    f.totalGross = roundToCent(f.grossLodging + f.grossService + f.cityTaxAmount);
  }

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
