# DIRS21 & Timeline Unassigned / Tetris Investigation & Resolution

## Ursache Zuweisung Overbeck auf Zimmer Scheune:
- `Dirs21MockAdapter.injectScenario('tetris')` bucht 2026-10-15 bis 2026-10-19 in Kategorie `SUITE`.
- Im Hotel existieren 4 Suiten: Stall Suite (Sort 9), Scheune (Sort 10), Heuboden (Sort 12), Suite Luisa (Sort 14).
- Im Seed-Zustand waren alle 4 Suiten vom 15.10. bis 19.10. frei (Junghans reiste am 15.10. ab).
- First-Fit in `server/src/services/dirs21/inboundWorker.ts` wählt bei Belegung das nächste freie Zimmer.

## Behobene Probleme (Oktober 2026):
1. **Buchungsdopplung bei Zimmerzuweisung behoben:**
   - Problem: Buchungen aus DIRS21-Überbuchung starten mit `roomId = null` und `status = 'unassigned'`. Bei Zuweisung eines Zimmers im Dialog blieb `status = 'unassigned'`. Dadurch filterte `TimelineScheduler.tsx` die Buchung sowohl ins gewählte Zimmer als auch in die Unzugewiesen-Zeile.
   - Lösung: Backend (`extractReservationData`) und Frontend (`ReservationDialog.tsx`, `App.tsx`) schalten bei Zuweisung einer `roomId > 0` automatisch auf `status = 'confirmed'`. `TimelineScheduler.tsx` filtert Unzugewiesen strikt nach `!r.roomId || r.roomId === 0`.
2. **Löschblockade (SQLite Foreign Key Constraint) behoben:**
   - Problem: Zu jeder Buchung wird eine Entwurfsrechnung angelegt (`invoices.reservation_id`). Beim Löschen verhinderte SQLite per Foreign Key das Löschen der Reservierung.
   - Lösung: `DELETE /api/reservations/:id` in `server/src/index.ts` kaskadiert offene Entwurfsrechnungen und deren `invoice_items` vor dem Löschen der Reservierung (finalisierte GoBD-Rechnungen behalten die Historie, entkoppeln jedoch die `reservation_id`).
3. **Veraltetes Drag-and-Drop bereinigt:**
   - Automatische DIRS21-Notizen, Dialog-Hinweise, `WORKPAPER.md`, `README.md` und `FARBSYSTEM_DOKUMENTATION.md` vollständig aktualisiert: Verlegung & Zuweisung erfolgt sicher per Buchungsdialog (Doppelklick / F9), geschützt durch `isLockedToRoom`.
