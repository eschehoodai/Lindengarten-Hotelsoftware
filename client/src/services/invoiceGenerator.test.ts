import { describe, it, expect } from 'vitest';
import { 
  generateInvoiceFromReservation, 
  createAdditionalInvoice, 
  createFreeInvoice, 
  recalculateInvoiceTotals 
} from './invoiceGenerator';
import type { Reservation, Guest, Room, Invoice } from '../types';

describe('invoiceGenerator Tests', () => {
  const mockGuest: Guest = {
    id: 10,
    guestNumber: 'G-2026-0010',
    searchName: 'Mustermann, Max',
    titleCode: 1,
    salutation: 'Sehr geehrter Herr',
    lastName: 'Mustermann',
    firstName: 'Max',
    street: 'Waldstraße',
    houseNumber: '5',
    zipCode: '02797',
    city: 'Kurort Jonsdorf',
    country: 'Deutschland',
    paymentMethod: 'BAR',
    isRegularGuest: false,
    isTaxExempt: false,
  };

  const mockRoom: Room = {
    id: 3,
    roomCode: '4',
    name: 'Zimmer 4',
    categoryCode: 'DZ',
    categoryName: 'Doppelzimmer',
    baseBeds: 2,
    maxCapacity: 2,
    basePrice: 90.0,
    floor: 'Hauptgebäude',
    sortOrder: 3,
    housekeepingStatus: 'clean',
  };

  const mockReservation: Reservation = {
    id: 100,
    reservationNumber: '18550',
    guestId: 10,
    roomId: 3,
    arrivalDate: '2026-10-15',
    departureDate: '2026-10-18',
    nights: 3,
    adultsCount: 2,
    childrenCount: 0,
    priceVariant: 'Doppelt belegt',
    pricePerNight: 90.0,
    totalPrice: 270.0,
    isArrived: true,
    isDeparted: false,
    isWrittenReservation: true,
    isLockedToRoom: false,
    isFlatRate: false,
    boardType: 'Frühstück',
    hasBreakfast: true,
    breakfastCount: 2,
    guest: mockGuest,
    room: mockRoom,
  };

  it('generiert eine Standard-Hauptrechnung aus einer Reservierung', () => {
    const inv = generateInvoiceFromReservation(mockReservation, null, [mockGuest], [mockRoom]);
    expect(inv.invoiceNumber).toBe('RE-18550');
    expect(inv.reservationId).toBe(100);
    expect(inv.recipientName).toBe('Max Mustermann');
    expect(inv.items).toBeDefined();
    expect(inv.items!.length).toBeGreaterThanOrEqual(1);
    expect(inv.totalGross).toBeGreaterThan(0);
  });

  it('erstellt eine weitere Rechnung (Zweitrechnung) mit dem gleichen Prinzip', () => {
    const mainInv = generateInvoiceFromReservation(mockReservation, null, [mockGuest], [mockRoom]);
    const secondInv = createAdditionalInvoice(mockReservation, [mainInv], [mockGuest], [mockRoom]);

    expect(secondInv.invoiceNumber).toBe('RE-18550-2');
    expect(secondInv.reservationId).toBe(100);
    expect(secondInv.recipientName).toBe('Max Mustermann');
    expect(secondInv.items).toEqual([]);
    expect(secondInv.totalGross).toBe(0);

    // Positionen hinzufügen
    secondInv.items!.push({
      id: 1,
      positionNumber: 1,
      description: 'Parkplatz',
      quantity: 3,
      unitPriceGross: 5.0,
      totalGross: 15.0,
      taxRate: 0.19,
      taxCode: 1,
      taxType: 'SERVICE',
    });

    const totals = recalculateInvoiceTotals(secondInv.items!);
    expect(totals.totalGross).toBe(15.0);
    expect(totals.taxService).toBe(2.39);
    expect(totals.netService).toBe(12.61);
  });

  it('erstellt eine freie Kassenrechnung ohne Bindung an eine Reservierung', () => {
    const freeInv = createFreeInvoice();
    expect(freeInv.reservationId).toBeUndefined();
    expect(freeInv.invoiceNumber).toContain('RE-KASSE-');
    expect(freeInv.roomName).toContain('Kasse');
    expect(freeInv.recipientName).toBe('Barzahler / Kassenkunde');
    expect(freeInv.paymentMethod).toBe('BAR');
    expect(freeInv.totalGross).toBe(0);
  });

  describe('Lindengarten F&B Frühstückssplit Logik', () => {
    it('splittet bei "Doppelt belegt" 2x 4,80 € / Tag mit 19% MwSt aus dem Gesamtpreis heraus', () => {
      const res: Reservation = {
        ...mockReservation,
        priceVariant: 'Doppelt belegt',
        nights: 2,
        pricePerNight: 85.0,
        totalPrice: 170.0,
      };

      const inv = generateInvoiceFromReservation(res, null, [mockGuest], [mockRoom]);
      // Anreisetag ohne Frühstück -> 2 Nächte = 2 Frühstückstage = 4 Frühstücke
      // 4 x 4,80 € = 19,20 € (19% MwSt)
      // Logis = 170,00 € - 19,20 € = 150,80 € (7% MwSt)
      const logisItem = inv.items?.find((i) => i.taxType === 'LODGING');
      const bfItem = inv.items?.find((i) => i.taxType === 'SERVICE' && i.description.includes('Frühstück'));

      expect(logisItem).toBeDefined();
      expect(bfItem).toBeDefined();
      expect(bfItem?.quantity).toBe(4);
      expect(bfItem?.unitPriceGross).toBe(4.80);
      expect(bfItem?.totalGross).toBe(19.20);
      expect(bfItem?.taxRate).toBe(0.19);

      expect(logisItem?.totalGross).toBe(150.80);
      expect(logisItem?.taxRate).toBe(0.07);

      // Gesamtbetrag der beiden Positionen muss exakt 170,00 € betragen
      expect((logisItem!.totalGross + bfItem!.totalGross)).toBe(170.0);
    });

    it('splittet bei "Einfach belegt" 1x 4,80 € / Tag mit 19% MwSt', () => {
      const res: Reservation = {
        ...mockReservation,
        priceVariant: 'Einfach belegt',
        nights: 3,
        pricePerNight: 70.0,
        totalPrice: 210.0,
      };

      const inv = generateInvoiceFromReservation(res, null, [mockGuest], [mockRoom]);
      // 3 Nächte = 3 Frühstücke à 4,80 € = 14,40 €
      // Logis = 210,00 € - 14,40 € = 195,60 €
      const logisItem = inv.items?.find((i) => i.taxType === 'LODGING');
      const bfItem = inv.items?.find((i) => i.taxType === 'SERVICE' && i.description.includes('Frühstück'));

      expect(bfItem?.quantity).toBe(3);
      expect(bfItem?.totalGross).toBe(14.40);
      expect(logisItem?.totalGross).toBe(195.60);
      expect((logisItem!.totalGross + bfItem!.totalGross)).toBe(210.0);
    });

    it('zieht bei "ohne F&B" kein Frühstück ab (100% Logis 7%)', () => {
      const res: Reservation = {
        ...mockReservation,
        priceVariant: 'ohne F&B 1 Person',
        nights: 2,
        pricePerNight: 65.0,
        totalPrice: 130.0,
      };

      const inv = generateInvoiceFromReservation(res, null, [mockGuest], [mockRoom]);
      const bfItem = inv.items?.find((i) => i.taxType === 'SERVICE' && i.description.includes('Frühstück'));
      const logisItem = inv.items?.find((i) => i.taxType === 'LODGING');

      expect(bfItem).toBeUndefined();
      expect(logisItem?.totalGross).toBe(130.0);
      expect(logisItem?.taxRate).toBe(0.07);
    });

    it('markiert "Online" als vorläufig ohne Frühstücksabzug', () => {
      const res: Reservation = {
        ...mockReservation,
        priceVariant: 'Online',
        nights: 1,
        pricePerNight: 95.0,
        totalPrice: 95.0,
      };

      const inv = generateInvoiceFromReservation(res, null, [mockGuest], [mockRoom]);
      const bfItem = inv.items?.find((i) => i.taxType === 'SERVICE' && i.description.includes('Frühstück'));
      const logisItem = inv.items?.find((i) => i.taxType === 'LODGING');

      expect(bfItem).toBeUndefined();
      expect(logisItem?.totalGross).toBe(95.0);
      expect(logisItem?.infoNote).toContain('Online-Import');
    });
  });
});
