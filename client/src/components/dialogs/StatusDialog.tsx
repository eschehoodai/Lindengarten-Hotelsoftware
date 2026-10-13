import React, { useState, useEffect } from 'react';
import type { Reservation, Room } from '../../types';
import { 
  Key, CheckCircle2, Clock, AlertCircle, Lock, Unlock, 
  FileText, DoorClosed, X, ShieldCheck, Check
} from 'lucide-react';

interface StatusDialogProps {
  reservation: Reservation;
  room?: Room;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (updated: Partial<Reservation>) => Promise<void>;
}

export const StatusDialog: React.FC<StatusDialogProps> = ({
  reservation,
  room,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  const [isArrived, setIsArrived] = useState<boolean>(reservation.isArrived);
  const [isDeparted, setIsDeparted] = useState<boolean>(reservation.isDeparted);
  const [isWrittenReservation, setIsWrittenReservation] = useState<boolean>(reservation.isWrittenReservation);
  const [isLockedToRoom, setIsLockedToRoom] = useState<boolean>(reservation.isLockedToRoom);
  const [keycardStatus, setKeycardStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleWriteKeycard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleWriteKeycard = () => {
    // Simulator für Türschloss-System / RFID Schlüsselkarten-Schnittstelle (Bild 03 Hotkey F9)
    const cardId = `RFID-${Math.floor(100000 + Math.random() * 900000)}`;
    setKeycardStatus(`Schlüsselkarte kodiert! Zimmer: ${reservation.room_code || room?.roomCode} | Karte: ${cardId} | Gültig bis: ${reservation.departureDate} 11:00 Uhr`);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateStatus({
        isArrived,
        isDeparted,
        isWrittenReservation,
        isLockedToRoom,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3"
    >
      <div className="bg-white rounded-md shadow-2xl border border-slate-400 w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100">
        
        {/* TITELLEISTE (ELAN hogatec Stil) */}
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <DoorClosed className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide">
              Zimmerbelegungsstatus & Schnittstellen [Res-Nr: {reservation.reservationNumber}]
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* INHALT */}
        <div className="p-4 flex flex-col gap-3 text-xs bg-slate-50">
          
          {/* KOPFZEILE INFO */}
          <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Gast / Zimmer</div>
              <div className="font-bold text-slate-800 text-sm">
                {reservation.guest?.lastName || reservation.last_name}, {reservation.guest?.firstName || reservation.first_name}
              </div>
              <div className="text-xs text-blue-700 font-semibold">
                Zimmer: {reservation.room_code || room?.roomCode} - {reservation.room_name || room?.name}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500 uppercase font-semibold">Aufenthaltszeitraum</div>
              <div className="font-mono text-slate-800 font-bold">
                {reservation.arrivalDate} bis {reservation.departureDate}
              </div>
              <div className="text-slate-500 text-[11px]">
                {reservation.nights} Nächte | {reservation.adultsCount} Erw.
              </div>
            </div>
          </div>

          {/* STATUS-PANEL (CHECK-IN / CHECK-OUT) */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs flex flex-col gap-2.5">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Anreise- & Abreisestatus (Check-In)</span>
            </span>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {/* Check-In Schalter */}
              <button
                type="button"
                onClick={() => {
                  const nextArrived = !isArrived;
                  setIsArrived(nextArrived);
                  if (nextArrived) setIsDeparted(false);
                }}
                className={`flex items-center justify-between p-2 rounded border text-xs font-semibold cursor-pointer transition-all ${
                  isArrived
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${isArrived ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>Check-In (Eingecheckt)</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isArrived ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isArrived ? 'JA (Im Haus)' : 'NEIN'}
                </span>
              </button>

              {/* Check-Out Schalter */}
              <button
                type="button"
                onClick={() => {
                  const nextDeparted = !isDeparted;
                  setIsDeparted(nextDeparted);
                  if (nextDeparted) setIsArrived(true);
                }}
                className={`flex items-center justify-between p-2 rounded border text-xs font-semibold cursor-pointer transition-all ${
                  isDeparted
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${isDeparted ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>Check-Out (Abgereist)</span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  isDeparted ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-600'
                }`}>
                  {isDeparted ? 'JA (Abgereist)' : 'NEIN'}
                </span>
              </button>
            </div>
          </div>

          {/* FLAGS & SPERREN (aus Bild 03) */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs flex flex-col gap-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1">
              Buchungsflags & Belegungsschutz
            </span>

            <div className="flex flex-col gap-2 pt-1">
              {/* Schriftlich reserviert */}
              <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded">
                <input
                  type="checkbox"
                  checked={isWrittenReservation}
                  onChange={(e) => setIsWrittenReservation(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-800">Schriftlich reserviert</span>
                  <span className="text-[10px] text-slate-500">
                    Kennzeichnet eine bestätigte Reservierung (Buchungsbestätigung versendet).
                  </span>
                </div>
              </label>

              {/* Fest gebucht (nicht verlegbar per DnD!) */}
              <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${
                isLockedToRoom ? 'bg-amber-50/70 border-amber-300' : 'hover:bg-slate-50 border-transparent'
              }`}>
                <input
                  type="checkbox"
                  checked={isLockedToRoom}
                  onChange={(e) => setIsLockedToRoom(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded"
                />
                <div className="flex items-center gap-1.5 flex-1">
                  {isLockedToRoom ? (
                    <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <Unlock className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">
                      {isLockedToRoom ? 'Fest gebucht (Gesperrt gegen Zimmerumzug)' : 'Nicht Fest (verlegbar)'}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isLockedToRoom 
                        ? 'Buchung ist auf dieses Zimmer fixiert und wird im Belegungsplan gegen Drag-and-Drop geschützt.' 
                        : 'Buchung kann im Belegungsplan frei auf andere gleichwertige Zimmer verschoben werden.'}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* SCHNITTSTELLEN: SCHLÜSSELKARTE SCHREIBEN (Bild 03 Hotkey F9) */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>Türschloss-Schnittstelle (Keycard Encoder)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Hotkey: [F9] Schlüssel schreiben
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-600 flex-1">
                Kodiert die Transponder- / RFID-Schlüsselkarte für <strong>Zimmer {reservation.room_code || room?.roomCode}</strong> für den Aufenthaltszeitraum.
              </div>
              <button
                type="button"
                onClick={handleWriteKeycard}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 border border-amber-600 font-bold px-3 py-1.5 rounded shadow-xs active:translate-y-px cursor-pointer transition-all"
                title="Schlüsselkarte kodieren (F9)"
              >
                <Key className="w-3.5 h-3.5" />
                <span>[F9] Schlüssel schreiben</span>
              </button>
            </div>

            {keycardStatus && (
              <div className="mt-1 bg-emerald-50 border border-emerald-300 text-emerald-800 p-2 rounded text-[11px] font-mono flex items-center gap-1.5 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{keycardStatus}</span>
              </div>
            )}
          </div>

        </div>

        {/* DIALOG-FUSSZEILE */}
        <div className="bg-slate-200 border-t border-slate-300 px-3 py-2 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-400 bg-white hover:bg-slate-100 text-slate-700 px-3 py-1 rounded font-semibold text-xs cursor-pointer"
          >
            [Esc] Abbrechen
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 px-4 py-1 rounded font-semibold text-xs shadow-xs cursor-pointer active:translate-y-px"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Wird gespeichert...' : 'Status speichern [Enter]'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
