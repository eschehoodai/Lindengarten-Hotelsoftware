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

export type TaxExemptReason =
  | 'GdB >= 80 mit Merkzeichen B'
  | 'Begleitperson (Merkzeichen B)'
  | 'Ausbildung ohne Zweitwohnung'
  | 'Bettlägerig mit ärztlichem Attest'
  | 'Kinder unter 6 Jahren'
  | 'Schul-/Freizeitfahrt (Gruppe bis 15 J.)'
  | 'Jahresgästetaxe Familie'
  | 'beruflich'
  | 'minderjaehrig'
  | 'schwerbehindert'
  | 'medizinisch'
  | string;

export interface JonsdorfGaestetaxeParams {
  nights?: number;
  adultsCount?: number;
  childrenCount?: number; // 6 bis 14 Jahre (1,45 €)
  smallChildrenCount?: number; // 0 bis 5 Jahre (0,00 €)
  isExempt?: boolean;
  exemptReason?: string | null;
  rates?: {
    adultRate?: number; // Standard: 2.90
    childRate?: number; // Standard: 1.45 (50%)
    smallChildRate?: number; // Standard: 0.00
  };
}

export interface JonsdorfGaestetaxeResult {
  cityTaxAmount: number; // Für Folio & ZUGFeRD Kompatibilität
  gaestetaxeAmount: number;
  isExempt: boolean;
  reason?: string;
  nights: number;
  adultsCount: number;
  adultRate: number;
  childrenCount: number;
  childRate: number;
  smallChildrenCount: number;
  smallChildRate: number;
  breakdown: string;
}

/**
 * Gästetaxesatzung Kurort Jonsdorf (Fassung vom 05.05.2025 / 1. Änderung)
 *
 * Gesetzliche Vorgaben:
 * 1. Tagessatz Erwachsene & Jugendliche ab 15 Jahren: 2,90 € je Person & Tag/Übernachtung (§ 4 Abs. 1 & Anlage S. 8)
 * 2. Kinder & Jugendliche vom vollendeten 6. bis zum vollendeten 15. Lebensjahr: 1,45 € (50% Ermäßigung gem. § 5)
 * 3. Kinder bis zur Vollendung des 6. Lebensjahres: kostenfrei (0,00 € gem. § 3 Abs. 1 a)
 * 4. Erhebungsmaßstab: Die Verpflichtung entsteht am Ankunftstag und endet am Abreisetag.
 *    Dauer wird nach Zahl der Übernachtungen bemessen. Ankunfts- und Abreisetag gelten als 1 Tag (§ 4 Abs. 1).
 * 5. Befreiungen (§ 3 Abs. 1):
 *    - GdB >= 80 mit Vermerk "B" im Ausweis
 *    - Begleitperson eines Ausweisinhabers mit Vermerk "B"
 *    - Ausbildung ohne Zweitwohnung
 *    - Bettlägerige Kranke mit ärztlichem Attest
 *    - Kinder unter 6 Jahren
 * 6. WICHTIGER RECHTSHINWEIS (§ 2 Abs. 5):
 *    Personen, die aus beruflichen Gründen (Tagungen, Messen, Montage) übernachten,
 *    sind in Kurort Jonsdorf AUSDRÜCKLICH GÄSTETAXEPFLICHTIG!
 */
export function calculateJonsdorfGaestetaxe(
  nightsOrParams: number | JonsdorfGaestetaxeParams = 1,
  adultsCount: number = 1,
  childrenCount: number = 0,
  smallChildrenCount: number = 0,
  isExempt: boolean = false,
  exemptReason?: string | null,
  customRates?: { adultRate?: number; childRate?: number; smallChildRate?: number }
): JonsdorfGaestetaxeResult {
  let nights = 1;
  let adults = 1;
  let children = 0;
  let smallChildren = 0;
  let exempt = false;
  let reason: string | undefined | null = null;
  let adultRate = 2.90;
  let childRate = 1.45;
  let smallChildRate = 0.00;

  if (typeof nightsOrParams === 'object' && nightsOrParams !== null) {
    nights = Math.max(0, nightsOrParams.nights ?? 1);
    adults = Math.max(0, nightsOrParams.adultsCount ?? 1);
    children = Math.max(0, nightsOrParams.childrenCount ?? 0);
    smallChildren = Math.max(0, nightsOrParams.smallChildrenCount ?? 0);
    exempt = !!nightsOrParams.isExempt;
    reason = nightsOrParams.exemptReason;
    if (nightsOrParams.rates?.adultRate !== undefined) adultRate = nightsOrParams.rates.adultRate;
    if (nightsOrParams.rates?.childRate !== undefined) childRate = nightsOrParams.rates.childRate;
    if (nightsOrParams.rates?.smallChildRate !== undefined) smallChildRate = nightsOrParams.rates.smallChildRate;
  } else {
    nights = Math.max(0, Number(nightsOrParams) || 0);
    adults = Math.max(0, adultsCount);
    children = Math.max(0, childrenCount);
    smallChildren = Math.max(0, smallChildrenCount);
    exempt = isExempt;
    reason = exemptReason;
    if (customRates?.adultRate !== undefined) adultRate = customRates.adultRate;
    if (customRates?.childRate !== undefined) childRate = customRates.childRate;
    if (customRates?.smallChildRate !== undefined) smallChildRate = customRates.smallChildRate;
  }

  // Befreiungsprüfung (§ 3 Satzung Kurort Jonsdorf)
  // Hinweis zu § 2 Abs. 5: Berufliche Reisen sind in Jonsdorf steuerpflichtig!
  const isBusinessExemptAttempt = typeof reason === 'string' && (
    reason.toLowerCase().includes('beruflich') ||
    reason.toLowerCase().includes('dienstlich') ||
    reason.toLowerCase().includes('geschäftlich') ||
    reason.toLowerCase().includes('business')
  );

  const isActuallyExempt = (exempt || (typeof reason === 'string' && reason.trim().length > 0)) && !isBusinessExemptAttempt;

  if (isActuallyExempt) {
    return {
      cityTaxAmount: 0.0,
      gaestetaxeAmount: 0.0,
      isExempt: true,
      reason: reason || 'Befreit gem. § 3 Satzung Kurort Jonsdorf',
      nights,
      adultsCount: adults,
      adultRate,
      childrenCount: children,
      childRate,
      smallChildrenCount: smallChildren,
      smallChildRate,
      breakdown: `Befreit (${reason || 'Nachweis gem. § 3'})`,
    };
  }

  if (nights === 0 || (adults === 0 && children === 0 && smallChildren === 0)) {
    return {
      cityTaxAmount: 0.0,
      gaestetaxeAmount: 0.0,
      isExempt: false,
      nights,
      adultsCount: adults,
      adultRate,
      childrenCount: children,
      childRate,
      smallChildrenCount: smallChildren,
      smallChildRate,
      breakdown: 'Keine Übernachtungen oder steuerpflichtigen Personen',
    };
  }

  const adultSum = roundToCent(adults * adultRate * nights);
  const childSum = roundToCent(children * childRate * nights);
  const smallChildSum = roundToCent(smallChildren * smallChildRate * nights);
  const total = roundToCent(adultSum + childSum + smallChildSum);

  const breakdownParts: string[] = [];
  if (adults > 0) breakdownParts.push(`${adults} Erw. (${adultSum.toFixed(2)} €)`);
  if (children > 0) breakdownParts.push(`${children} Kind(er) (${childSum.toFixed(2)} €)`);
  if (smallChildren > 0) breakdownParts.push(`${smallChildren} Kind(er) < 6 J. (0,00 €)`);

  return {
    cityTaxAmount: total,
    gaestetaxeAmount: total,
    isExempt: false,
    reason: undefined,
    nights,
    adultsCount: adults,
    adultRate,
    childrenCount: children,
    childRate,
    smallChildrenCount: smallChildren,
    smallChildRate,
    breakdown: `${nights} Übernachtung(en) [${breakdownParts.join(', ')}] = ${total.toFixed(2)} €`,
  };
}

/**
 * @deprecated Übergangsfunktion: Frühere Leipziger Beherbergungssteuer (5% City Tax)
 * Wurde für Kurort Jonsdorf abgelöst durch `calculateJonsdorfGaestetaxe`.
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
 * - Folio B: Frühstück / Verpflegung (19% USt) + Gästetaxe Kurort Jonsdorf (0% USt)
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
    adultsCount = 1,
    childrenCount = 0,
    smallChildrenCount = 0,
    breakfastCountTotal = 0,
    breakfastPricePerPerson = 12.5,
    isCityTaxExempt = false,
    cityTaxExemptReason = null,
    dateFrom,
    dateTo,
    useLegacyLeipzigCityTax = false,
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

  // 3. Posten: Gästetaxe Kurort Jonsdorf auf Folio B (Gastkonto)
  if (useLegacyLeipzigCityTax) {
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
  } else {
    const gaestetaxe = calculateJonsdorfGaestetaxe({
      nights,
      adultsCount,
      childrenCount,
      smallChildrenCount,
      isExempt: isCityTaxExempt,
      exemptReason: cityTaxExemptReason,
    });

    if (gaestetaxe.gaestetaxeAmount > 0) {
      const breakdownParts: string[] = [];
      if (adultsCount > 0) breakdownParts.push(`${adultsCount} Erw.`);
      if (childrenCount > 0) breakdownParts.push(`${childrenCount} Kind(er)`);

      items.push({
        positionNumber: pos++,
        folioBucket: 'B',
        description: `Gästetaxe Kurort Jonsdorf (${nights} ÜN, ${breakdownParts.join(', ')})`,
        roomCode,
        quantity: 1,
        unitPriceGross: gaestetaxe.gaestetaxeAmount,
        totalGross: gaestetaxe.gaestetaxeAmount,
        taxRate: 0.00,
        taxCode: 0,
        taxType: 'CITY_TAX',
        dateFrom,
        dateTo,
        infoNote: `Satzung Gemeinde Kurort Jonsdorf vom 05.05.2025 (2,90 € Erw. / 1,45 € Kinder)`,
      });
    }
  }

  return items;
}
