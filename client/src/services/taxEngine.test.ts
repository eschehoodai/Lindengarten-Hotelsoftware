import { describe, it, expect } from 'vitest';
import {
  roundToCent,
  calculateSplitTax,
  calculateInvoiceSummary,
  generateDefaultFolioItems,
  type InvoiceLineItem,
} from './taxEngine';

describe('1. Kaufmännische Rundung & USt-Splitting (§ 12 UStG)', () => {
  it('rundet kaufmännisch sauber auf volle Cent', () => {
    expect(roundToCent(10.004)).toBe(10.00);
    expect(roundToCent(10.005)).toBe(10.01);
    expect(roundToCent(10.009)).toBe(10.01);
    expect(roundToCent(0.1 + 0.2)).toBe(0.30);
  });

  describe('Logis-Steuersatz 7 % USt (§ 12 Abs. 2 Nr. 11 UStG)', () => {
    it('spaltet 107,00 € glatt auf (100 € Netto + 7 € USt)', () => {
      const result = calculateSplitTax(107.00, 0.07);
      expect(result.gross).toBe(107.00);
      expect(result.net).toBe(100.00);
      expect(result.tax).toBe(7.00);
      expect(result.net + result.tax).toBe(result.gross);
    });

    it('berechnet Standard-Zimmer Lindengarten 85,00 € brutto präzise', () => {
      const result = calculateSplitTax(85.00, 0.07);
      // 85 / 1.07 = 79.43925... -> 79.44 € Netto
      expect(result.gross).toBe(85.00);
      expect(result.net).toBe(79.44);
      expect(result.tax).toBe(5.56);
      expect(result.net + result.tax).toBe(85.00);
    });

    it('berechnet Einzelzimmer 65,00 € brutto ohne Rundungsdifferenz', () => {
      const result = calculateSplitTax(65.00, 0.07);
      // 65 / 1.07 = 60.7476... -> 60.75 € Netto
      expect(result.gross).toBe(65.00);
      expect(result.net).toBe(60.75);
      expect(result.tax).toBe(4.25);
      expect(result.net + result.tax).toBe(65.00);
    });

    it('berechnet Suite 120,00 € brutto präzise', () => {
      const result = calculateSplitTax(120.00, 0.07);
      // 120 / 1.07 = 112.1495... -> 112.15 € Netto
      expect(result.gross).toBe(120.00);
      expect(result.net).toBe(112.15);
      expect(result.tax).toBe(7.85);
      expect(result.net + result.tax).toBe(120.00);
    });
  });

  describe('Service & F&B-Steuersatz 19 % USt (§ 12 Abs. 1 UStG)', () => {
    it('spaltet 119,00 € glatt auf (100 € Netto + 19 € USt)', () => {
      const result = calculateSplitTax(119.00, 0.19);
      expect(result.gross).toBe(119.00);
      expect(result.net).toBe(100.00);
      expect(result.tax).toBe(19.00);
      expect(result.net + result.tax).toBe(result.gross);
    });

    it('berechnet Lindengarten-Frühstück 12,50 € brutto präzise', () => {
      const result = calculateSplitTax(12.50, 0.19);
      // 12.50 / 1.19 = 10.5042... -> 10.50 € Netto
      expect(result.gross).toBe(12.50);
      expect(result.net).toBe(10.50);
      expect(result.tax).toBe(2.00);
      expect(result.net + result.tax).toBe(12.50);
    });

    it('berechnet Parkplatz 25,00 € brutto präzise (wie in Bild 04)', () => {
      const result = calculateSplitTax(25.00, 0.19);
      // 25.00 / 1.19 = 21.0084... -> 21.01 € Netto
      expect(result.gross).toBe(25.00);
      expect(result.net).toBe(21.01);
      expect(result.tax).toBe(3.99);
      expect(result.net + result.tax).toBe(25.00);
    });
  });

  describe('0 % USt (Durchlaufende Posten & City Tax)', () => {
    it('lässt 0 % Steuersatz unverändert ohne USt', () => {
      const result = calculateSplitTax(4.25, 0.00);
      expect(result.gross).toBe(4.25);
      expect(result.net).toBe(4.25);
      expect(result.tax).toBe(0.00);
    });
  });
});

describe('3. Dreifach-Folio-Splitting & Rechnungs-Engine (Bild 04)', () => {
  it('berechnet und aggregiert Folio A (Logis), Folio B (Gast) und Folio C getrennt', () => {
    // Szenario aus Bild 04:
    // Folio A: Übernachtung 2 Nächte à 85.00 € = 170.00 € Logis (7%)
    // Folio B: 2x Frühstück à 12.50 € = 25.00 € (19%) + 1x Parkplatz 10.00 € (19%)
    const items: InvoiceLineItem[] = [
      {
        positionNumber: 1,
        folioBucket: 'A',
        description: 'Übernachtung Zimmer Tobias',
        roomCode: 'Tobias',
        quantity: 2,
        unitPriceGross: 85.00,
        totalGross: 170.00,
        taxRate: 0.07,
        taxCode: 2,
        taxType: 'LODGING',
      },
      {
        positionNumber: 2,
        folioBucket: 'B',
        description: 'Frühstücksbuffet',
        quantity: 2,
        unitPriceGross: 12.50,
        totalGross: 25.00,
        taxRate: 0.19,
        taxCode: 1,
        taxType: 'SERVICE',
      },
      {
        positionNumber: 3,
        folioBucket: 'B',
        description: 'Tiefgaragen-Parkplatz',
        quantity: 1,
        unitPriceGross: 10.00,
        totalGross: 10.00,
        taxRate: 0.19,
        taxCode: 1,
        taxType: 'SERVICE',
      },
    ];

    const summary = calculateInvoiceSummary(items, false, null);

    // 1. Folio A Prüfung (Firmenübernahme Logis)
    // 170.00 € Brutto -> 170 / 1.07 = 158.88 € Netto, 11.12 € USt
    expect(summary.folios.A.grossLodging).toBe(170.00);
    expect(summary.folios.A.netLodging).toBe(158.88);
    expect(summary.folios.A.taxLodging).toBe(11.12);
    expect(summary.folios.A.grossService).toBe(0.00);
    expect(summary.folios.A.cityTaxAmount).toBe(0.00);
    expect(summary.folios.A.totalGross).toBe(170.00);

    // 2. Folio B Prüfung (Privatauslagen Gast)
    // F&B: 25.00 € + 10.00 € = 35.00 € Brutto (19%)
    // 35 / 1.19 = 29.41 € Netto, 5.59 € USt
    expect(summary.folios.B.grossLodging).toBe(0.00);
    expect(summary.folios.B.grossService).toBe(35.00);
    expect(summary.folios.B.netService).toBe(29.41);
    expect(summary.folios.B.taxService).toBe(5.59);
    expect(summary.folios.B.totalGross).toBe(35.00);

    // 3. Folio C Prüfung (Leer)
    expect(summary.folios.C.totalGross).toBe(0.00);

    // 4. Gesamtrechnung Prüfung
    expect(summary.grossLodging).toBe(170.00);
    expect(summary.grossService).toBe(35.00);
    expect(summary.cityTaxAmount).toBe(0.00);
    expect(summary.totalGross).toBe(205.00);

    // Prüfsummen-Validierung: totalGross === totalNet + totalTax
    expect(summary.totalGross).toBe(roundToCent(summary.totalNet + summary.totalTax));
  });

  it('erzeugt automatisch Standard-Folio-Posten für Logis und Frühstück', () => {
    const items = generateDefaultFolioItems({
      guestName: 'Familie Junghans',
      roomCode: 'Herman',
      nights: 5,
      lodgingPricePerNight: 166.00,
      breakfastCountTotal: 15,
      breakfastPricePerPerson: 12.50,
    });

    expect(items).toHaveLength(2);

    // Posten 1: Folio A Logis
    expect(items[0].folioBucket).toBe('A');
    expect(items[0].taxType).toBe('LODGING');
    expect(items[0].taxRate).toBe(0.07);
    expect(items[0].totalGross).toBe(830.00); // 5 * 166

    // Posten 2: Folio B Frühstück
    expect(items[1].folioBucket).toBe('B');
    expect(items[1].taxType).toBe('SERVICE');
    expect(items[1].taxRate).toBe(0.19);
    expect(items[1].totalGross).toBe(187.50); // 15 * 12.50
  });
});

describe('4. GoBD & ZUGFeRD Rundungskonsistenz', () => {
  it('garantiert Identität von Netto + Steuer = Brutto bei krummen Cent-Werten', () => {
    const oddAmounts = [17.33, 49.99, 73.13, 83.50, 101.01, 237.89, 999.95];

    for (const gross of oddAmounts) {
      // Test 7%
      const split7 = calculateSplitTax(gross, 0.07);
      expect(roundToCent(split7.net + split7.tax)).toBe(split7.gross);

      // Test 19%
      const split19 = calculateSplitTax(gross, 0.19);
      expect(roundToCent(split19.net + split19.tax)).toBe(split19.gross);
    }
  });

  it('behandelt Stornopositionen und negative Beträge (Gutschriften) rechnerisch korrekt', () => {
    const refund = calculateSplitTax(-85.00, 0.07);
    expect(refund.gross).toBe(-85.00);
    expect(refund.net).toBe(-79.44);
    expect(refund.tax).toBe(-5.56);
    expect(roundToCent(refund.net + refund.tax)).toBe(-85.00);
  });
});

describe('5. Erweiterte Szenarien & Folio-Umbuchungen (A <-> B <-> C)', () => {
  it('ermöglicht Umbuchung eines Postens von Folio A auf Folio B mit korrekter Steuerrekalkulation', () => {
    // Initial: Frühstück liegt irrtümlich auf Folio A
    const item1: InvoiceLineItem = {
      positionNumber: 1,
      folioBucket: 'A',
      description: 'Übernachtung',
      quantity: 1,
      unitPriceGross: 85.00,
      totalGross: 85.00,
      taxRate: 0.07,
      taxCode: 2,
      taxType: 'LODGING',
    };
    const item2: InvoiceLineItem = {
      positionNumber: 2,
      folioBucket: 'A', // Liegt auf Folio A
      description: 'Frühstück',
      quantity: 1,
      unitPriceGross: 12.50,
      totalGross: 12.50,
      taxRate: 0.19,
      taxCode: 1,
      taxType: 'SERVICE',
    };

    const initialSummary = calculateInvoiceSummary([item1, item2], false, null);
    expect(initialSummary.folios.A.totalGross).toBe(97.50); // 85 + 12.50
    expect(initialSummary.folios.B.totalGross).toBe(0.00);

    // Umbuchung: Frühstück wird auf Folio B (Gastkonto) umgebucht
    const movedItem2: InvoiceLineItem = { ...item2, folioBucket: 'B' };
    const updatedSummary = calculateInvoiceSummary([item1, movedItem2], false, null);

    // Folio A enthält jetzt nur noch Logis (85 €)
    expect(updatedSummary.folios.A.grossLodging).toBe(85.00);
    expect(updatedSummary.folios.A.grossService).toBe(0.00);
    expect(updatedSummary.folios.A.totalGross).toBe(85.00);

    // Folio B enthält jetzt das Frühstück (12.50 €)
    expect(updatedSummary.folios.B.grossService).toBe(12.50);
    expect(updatedSummary.folios.B.totalGross).toBe(12.50);

    // Gesamtsumme bleibt exakt identisch
    expect(updatedSummary.totalGross).toBe(initialSummary.totalGross);
  });
});

