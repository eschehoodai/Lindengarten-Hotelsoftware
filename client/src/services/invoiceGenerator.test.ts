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
});
