import { eq } from 'drizzle-orm';
import { db, client } from '../db/index.js';
import * as schema from '../db/schema.js';

export type SequenceType = 'GUEST' | 'RESERVATION' | 'INVOICE' | 'CASH_RECEIPT';

interface SequenceConfig {
  code: SequenceType;
  prefix: string;
  hasYearPrefix: boolean;
  padLength: number;
}

const SEQUENCE_CONFIGS: Record<SequenceType, SequenceConfig> = {
  GUEST: {
    code: 'GUEST',
    prefix: 'G-',
    hasYearPrefix: false,
    padLength: 6,
  },
  RESERVATION: {
    code: 'RESERVATION',
    prefix: 'B-',
    hasYearPrefix: true,
    padLength: 6,
  },
  INVOICE: {
    code: 'INVOICE',
    prefix: 'RE-',
    hasYearPrefix: true,
    padLength: 6,
  },
  CASH_RECEIPT: {
    code: 'CASH_RECEIPT',
    prefix: 'KB-',
    hasYearPrefix: true,
    padLength: 6,
  },
};

// In-Memory Fallback falls keine DB aktiv ist
const inMemorySequences: Record<SequenceType, { currentValue: number; currentYear: number }> = {
  GUEST: { currentValue: 0, currentYear: new Date().getFullYear() },
  RESERVATION: { currentValue: 0, currentYear: new Date().getFullYear() },
  INVOICE: { currentValue: 0, currentYear: new Date().getFullYear() },
  CASH_RECEIPT: { currentValue: 0, currentYear: new Date().getFullYear() },
};

export class SequenceService {
  /**
   * Stellt sicher, dass alle Standard-Nummernkreise in der Datenbank angelegt sind.
   */
  public async ensureInitialized(): Promise<void> {
    if (!db) return;
    try {
      const currentYear = new Date().getFullYear();
      for (const [code, cfg] of Object.entries(SEQUENCE_CONFIGS)) {
        const existing = await db
          .select()
          .from(schema.numberSequences)
          .where(eq(schema.numberSequences.code, code));

        if (!existing || existing.length === 0) {
          await db.insert(schema.numberSequences).values({
            code,
            currentValue: 0,
            prefix: cfg.prefix,
            padLength: cfg.padLength,
            hasYearPrefix: cfg.hasYearPrefix,
            currentYear,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err: any) {
      console.warn('[SequenceService] ensureInitialized error:', err?.message);
    }
  }

  /**
   * Formatiert eine Zahl nach den Nummernkreis-Regeln
   */
  public formatNumber(code: SequenceType, val: number, year: number): string {
    const cfg = SEQUENCE_CONFIGS[code];
    const padded = String(val).padStart(cfg.padLength, '0');
    if (cfg.hasYearPrefix) {
      return `${cfg.prefix}${year}-${padded}`;
    }
    return `${cfg.prefix}${padded}`;
  }

  /**
   * Holt die nächste fortlaufende Nummer und inkrementiert den Zähler atomar.
   */
  public async getNextNumber(code: SequenceType, forcedYear?: number): Promise<string> {
    const year = forcedYear || new Date().getFullYear();
    const cfg = SEQUENCE_CONFIGS[code];

    if (db) {
      try {
        await this.ensureInitialized();

        const rows = await db
          .select()
          .from(schema.numberSequences)
          .where(eq(schema.numberSequences.code, code));

        let currentVal = 0;
        let dbYear = year;

        if (rows && rows.length > 0) {
          const row = rows[0];
          currentVal = row.currentValue ?? 0;
          dbYear = row.currentYear ?? year;

          // Bei Jahreswechsel fängt der Jahreszähler bei 1 an
          if (cfg.hasYearPrefix && dbYear !== year) {
            currentVal = 0;
            dbYear = year;
          }
        }

        const nextVal = currentVal + 1;
        const nowIso = new Date().toISOString();

        if (rows && rows.length > 0) {
          await db
            .update(schema.numberSequences)
            .set({
              currentValue: nextVal,
              currentYear: dbYear,
              updatedAt: nowIso,
            })
            .where(eq(schema.numberSequences.code, code));
        } else {
          await db.insert(schema.numberSequences).values({
            code,
            currentValue: nextVal,
            prefix: cfg.prefix,
            padLength: cfg.padLength,
            hasYearPrefix: cfg.hasYearPrefix,
            currentYear: dbYear,
            updatedAt: nowIso,
          });
        }

        return this.formatNumber(code, nextVal, dbYear);
      } catch (err: any) {
        console.warn(`[SequenceService] DB Error in getNextNumber(${code}):`, err?.message);
      }
    }

    // In-Memory Fallback
    const mem = inMemorySequences[code];
    if (cfg.hasYearPrefix && mem.currentYear !== year) {
      mem.currentValue = 0;
      mem.currentYear = year;
    }
    mem.currentValue += 1;
    return this.formatNumber(code, mem.currentValue, mem.currentYear);
  }

  /**
   * Vorschau der nächsten Nummer ohne Zählererhöhung (für Dialog-Placeholder / Formulare)
   */
  public async peekNextNumber(code: SequenceType, forcedYear?: number): Promise<string> {
    const year = forcedYear || new Date().getFullYear();
    const cfg = SEQUENCE_CONFIGS[code];

    if (db) {
      try {
        await this.ensureInitialized();
        const rows = await db
          .select()
          .from(schema.numberSequences)
          .where(eq(schema.numberSequences.code, code));

        if (rows && rows.length > 0) {
          let currentVal = rows[0].currentValue ?? 0;
          let dbYear = rows[0].currentYear ?? year;
          if (cfg.hasYearPrefix && dbYear !== year) {
            currentVal = 0;
            dbYear = year;
          }
          return this.formatNumber(code, currentVal + 1, dbYear);
        }
      } catch (err: any) {
        console.warn(`[SequenceService] DB Error in peekNextNumber(${code}):`, err?.message);
      }
    }

    const mem = inMemorySequences[code];
    let val = mem.currentValue;
    let y = mem.currentYear;
    if (cfg.hasYearPrefix && y !== year) {
      val = 0;
      y = year;
    }
    return this.formatNumber(code, val + 1, y);
  }

  /**
   * Setzt einen Nummernkreis zurück (z. B. für saubere Projektübergabe oder Reset)
   */
  public async resetSequence(code: SequenceType, startVal: number = 0, year?: number): Promise<void> {
    const currentYear = year || new Date().getFullYear();
    if (db) {
      try {
        await this.ensureInitialized();
        await db
          .update(schema.numberSequences)
          .set({
            currentValue: startVal,
            currentYear,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.numberSequences.code, code));
      } catch (err: any) {
        console.warn(`[SequenceService] Error resetting sequence ${code}:`, err?.message);
      }
    }
    inMemorySequences[code] = { currentValue: startVal, currentYear };
  }

  /**
   * Setzt alle Nummernkreise auf 0 zurück (nächster Wert wird 1 / 000001)
   */
  public async resetAll(): Promise<void> {
    for (const code of Object.keys(SEQUENCE_CONFIGS) as SequenceType[]) {
      await this.resetSequence(code, 0);
    }
  }

  /**
   * Passt die Zähler an vorhandene Daten an (z. B. nach Seeding oder Migration)
   */
  public async syncWithHighestExisting(code: SequenceType, highestValue: number): Promise<void> {
    if (db) {
      try {
        await this.ensureInitialized();
        await db
          .update(schema.numberSequences)
          .set({
            currentValue: highestValue,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(schema.numberSequences.code, code));
      } catch (err: any) {
        console.warn(`[SequenceService] Error syncing sequence ${code}:`, err?.message);
      }
    }
    inMemorySequences[code].currentValue = highestValue;
  }
}

export const sequenceService = new SequenceService();
