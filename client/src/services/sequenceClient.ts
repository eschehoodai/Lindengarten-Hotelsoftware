import type { Guest, Reservation, Invoice } from '../types';

export type SequenceType = 'GUEST' | 'RESERVATION' | 'INVOICE' | 'CASH_RECEIPT';

/**
 * Fragt die nächste verbindliche Sequenznummer vom Server ab.
 */
export async function fetchNextNumber(type: SequenceType): Promise<string | null> {
  try {
    const res = await fetch('/api/sequences/next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.number || null;
    }
  } catch (err) {
    console.warn(`[sequenceClient] Failed to fetch next number for ${type}:`, err);
  }
  return null;
}

/**
 * Fragt eine unverbindliche Vorschau der nächsten Sequenznummer vom Server ab (für Dialoge).
 */
export async function fetchPreviewNumber(type: SequenceType): Promise<string | null> {
  try {
    const res = await fetch(`/api/sequences/preview?type=${type}`);
    if (res.ok) {
      const data = await res.json();
      return data.nextNumber || null;
    }
  } catch (err) {
    console.warn(`[sequenceClient] Failed to preview number for ${type}:`, err);
  }
  return null;
}

/**
 * Lokaler Fallback-Rechner für Gästenummer: G-000001
 */
export function calculateNextGuestNumber(existingGuests: Guest[] = []): string {
  let maxVal = 0;
  for (const g of existingGuests) {
    const num = g.guestNumber || '';
    const match = num.match(/^G-(\d+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxVal) maxVal = val;
    }
  }
  return `G-${String(maxVal + 1).padStart(6, '0')}`;
}

/**
 * Lokaler Fallback-Rechner für Buchungsnummer: B-YYYY-000001
 */
export function calculateNextReservationNumber(
  existingReservations: Reservation[] = [],
  year: number = new Date().getFullYear()
): string {
  let maxVal = 0;
  for (const r of existingReservations) {
    const num = r.reservationNumber || '';
    const match = num.match(/^B-(\d{4})-(\d+)$/);
    if (match && Number(match[1]) === year) {
      const val = parseInt(match[2], 10);
      if (val > maxVal) maxVal = val;
    }
  }
  return `B-${year}-${String(maxVal + 1).padStart(6, '0')}`;
}

/**
 * Lokaler Fallback-Rechner für Kassenbelegnummer: KB-YYYY-000001
 */
export function calculateNextCashReceiptNumber(
  existingInvoices: Invoice[] = [],
  year: number = new Date().getFullYear()
): string {
  let maxVal = 0;
  for (const inv of existingInvoices) {
    const num = inv.invoiceNumber || '';
    const match = num.match(/^KB-(\d{4})-(\d+)$/);
    if (match && Number(match[1]) === year) {
      const val = parseInt(match[2], 10);
      if (val > maxVal) maxVal = val;
    }
  }
  return `KB-${year}-${String(maxVal + 1).padStart(6, '0')}`;
}
