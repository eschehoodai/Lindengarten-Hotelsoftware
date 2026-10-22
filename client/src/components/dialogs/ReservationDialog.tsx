import React, { useState, useEffect, useMemo } from 'react';
import type { Reservation, Room, Guest, PriceVariant } from '../../types';
import { BOARD_OPTIONS, parseBoardTypes } from '../../types';
import { 
  Calendar, DoorClosed, Users, Utensils, DollarSign, 
  Lock, Unlock, X, Check, Coffee, FileText, Building2, AlertTriangle
} from 'lucide-react';
import { calculateSplitTax } from '../../services/taxEngine';
import { calculateBreakfastSplit } from '../../services/invoiceGenerator';

interface ReservationDialogProps {
  reservation: Partial<Reservation> | null;
  rooms: Room[];
  guests: Guest[];
  priceVariants: PriceVariant[];
  reservations?: Reservation[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservationData: Partial<Reservation>) => Promise<void>;
}

export const ReservationDialog: React.FC<ReservationDialogProps> = ({
  reservation,
  rooms,
  guests,
  priceVariants,
  reservations = [],
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Partial<Reservation>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextResNumber = reservation?.reservationNumber || `18${Math.floor(100 + Math.random() * 900)}`;

    const defaultRoom = (reservation?.roomId && rooms.find((r) => r.id === reservation.roomId)) || rooms[0];
    const defaultGuest = (reservation?.guestId && guests.find((g) => g.id === reservation.guestId)) || guests[0];

    const defaults: Partial<Reservation> = {
      reservationNumber: nextResNumber,
      guestId: defaultGuest?.id || 1,
      roomId: defaultRoom?.id || 1,
      arrivalDate: today,
      departureDate: tomorrow,
      nights: 1,
      adultsCount: 2,
      childrenCount: 0,
      companionNames: '',
      isArrived: false,
      isDeparted: false,
      isWrittenReservation: true,
      isLockedToRoom: false,
      priceVariant: 'Doppelt belegt',
      pricePerNight: defaultRoom?.basePrice || 85.0,
      totalPrice: defaultRoom?.basePrice || 85.0,
      isFlatRate: false,
      boardType: 'Frühstück',
      hasBreakfast: true,
      breakfastCount: 2,
      ohpCount: 0,
      twoGangCount: 0,
      threeGangCount: 0,
      lunchCount: 0,
      coffeeTeaCount: 0,
      dinnerCount: 0,
      dailyArrangement: 'Frühstück',
      billingDebitor: '',
      notes: '',
    };

    if (reservation) {
      setFormData({
        ...defaults,
        ...reservation,
        boardType: reservation.boardType ?? reservation.dailyArrangement ?? 'Frühstück',
        dailyArrangement: reservation.dailyArrangement ?? reservation.boardType ?? 'Frühstück',
      });
    } else {
      setFormData(defaults);
    }
  }, [reservation, rooms, guests, isOpen]);

  if (!isOpen) return null;

  // Berechne Nächte & Gesamtpreis bei Änderung von Anreise/Abreise
  const handleDateChange = (arrival: string, departure: string) => {
    let nights = 1;
    if (arrival && departure) {
      const start = new Date(arrival);
      const end = new Date(departure);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      nights = diffDays > 0 ? diffDays : 1;
    }
    const pricePerNight = formData.pricePerNight || 85.0;
    const totalPrice = formData.isFlatRate ? (formData.totalPrice || pricePerNight) : nights * pricePerNight;
    
    setFormData((prev) => ({
      ...prev,
      arrivalDate: arrival,
      departureDate: departure,
      nights,
      totalPrice,
    }));
  };

  // Zimmerwechsel aktualisiert Basispreis
  const handleRoomChange = (roomId: number) => {
    const selectedRoom = rooms.find((r) => r.id === roomId);
    const price = selectedRoom ? selectedRoom.basePrice : 85.0;
    const nights = formData.nights || 1;
    setFormData((prev) => ({
      ...prev,
      roomId,
      pricePerNight: price,
      totalPrice: prev.isFlatRate ? (prev.totalPrice || price) : nights * price,
    }));
  };

  const handlePriceVariantChange = (selectedVariantName: string) => {
    const matched = priceVariants.find((pv) => pv.name === selectedVariantName || pv.shortCode === selectedVariantName);
    let bfPersons = matched?.breakfastPersons;
    if (bfPersons === undefined) {
      if (selectedVariantName.includes('Doppelt')) bfPersons = 2;
      else if (selectedVariantName.includes('Einfach')) bfPersons = 1;
      else if (selectedVariantName.includes('Dreifach')) bfPersons = 3;
      else if (selectedVariantName.includes('ohne F&B') || selectedVariantName === 'Ohne') bfPersons = 0;
      else if (selectedVariantName === 'Online') bfPersons = 0;
      else bfPersons = 2;
    }

    const hasBf = bfPersons > 0;
    setFormData((prev) => {
      const existingBoard = prev.boardType || prev.dailyArrangement;
      const newBoard = existingBoard !== undefined ? existingBoard : (hasBf ? 'Frühstück' : '');
      return {
        ...prev,
        priceVariant: selectedVariantName,
        hasBreakfast: hasBf,
        breakfastCount: bfPersons,
        boardType: newBoard,
        dailyArrangement: selectedVariantName === 'Online'
          ? 'Online-Buchung (Prüfung erforderlich)'
          : newBoard,
      };
    });
  };

  const handlePricePerNightChange = (price: number) => {
    const nights = formData.nights || 1;
    setFormData((prev) => ({
      ...prev,
      pricePerNight: price,
      totalPrice: prev.isFlatRate ? (prev.totalPrice || price) : nights * price,
    }));
  };

  // Aktive Verpflegungsarten (Mehrfachauswahl für Personal & Küche)
  const activeBoardTypes = useMemo(() => {
    return parseBoardTypes(formData.boardType || formData.dailyArrangement);
  }, [formData.boardType, formData.dailyArrangement]);

  const toggleBoardType = (typeId: string) => {
    const current = [...activeBoardTypes];
    const index = current.indexOf(typeId);
    let updated: string[];
    if (index >= 0) {
      updated = current.filter((t) => t !== typeId);
    } else {
      updated = [...current, typeId];
    }
    const serialized = updated.join(', ');
    setFormData((prev) => ({
      ...prev,
      boardType: serialized,
      dailyArrangement: serialized,
      hasBreakfast: updated.includes('Frühstück'),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestId || !formData.roomId) {
      alert('Bitte wählen Sie Gast und Zimmer aus.');
      return;
    }

    // Kollisionsprüfung bei Zimmerauswahl / Umzug im Dialog
    if (reservations.length > 0 && formData.arrivalDate && formData.departureDate) {
      const arrivalA = new Date(formData.arrivalDate).getTime();
      const departureA = new Date(formData.departureDate).getTime();
      const targetRoom = rooms.find((r) => r.id === formData.roomId);

      const conflictingBooking = reservations.find((r) => {
        if (formData.id && r.id === formData.id) return false;
        if (r.roomId !== formData.roomId) return false;

        const arrivalB = new Date(r.arrivalDate).getTime();
        const departureB = new Date(r.departureDate).getTime();

        return arrivalA < departureB && departureA > arrivalB;
      });

      if (conflictingBooking) {
        const guestName = conflictingBooking.guest?.lastName || conflictingBooking.last_name || 'Anderer Gast';
        alert(
          `⚠️ KOLLISION / DOPPELBELEGUNG VERHINDERT!\n\n` +
          `Zimmer "${targetRoom?.name || formData.roomId}" ist im Zeitraum ${formData.arrivalDate} bis ${formData.departureDate} ` +
          `bereits durch Gast "${guestName}" belegt.\n\n` +
          `Bitte wählen Sie ein anderes freies Zimmer oder passen Sie den Zeitraum an.`
        );
        return;
      }
    }

    const payload: Partial<Reservation> = {
      ...formData,
      boardType: formData.boardType !== undefined ? formData.boardType : (activeBoardTypes.join(', ') || 'Frühstück'),
      dailyArrangement: formData.dailyArrangement !== undefined ? formData.dailyArrangement : (activeBoardTypes.join(', ') || 'Frühstück'),
    };
    setIsSaving(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3"
    >
      <div className="bg-white rounded-md shadow-2xl border border-slate-400 w-full max-w-3xl flex flex-col overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100 max-h-[92vh]">
        
        {/* TITELKOPF (ELAN hogatec Stil) */}
        <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold tracking-wide">
              Reservierung - Detailmaske [Res-Nr: {formData.reservationNumber || 'NEU'}]
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORMULAR CONTENT */}
        <form onSubmit={handleSubmit} className="p-3 flex flex-col gap-3 text-xs bg-slate-100 overflow-y-auto">
          
          {/* BLOCK 1: GAST & ZIMMER */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-3 gap-3.5">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#376189]" />
                <span>HAUPTGAST / RESERVIERT AUF <span className="text-rose-600 font-bold ml-0.5">*</span></span>
              </label>
              <select
                value={formData.guestId || ''}
                onChange={(e) => setFormData({ ...formData, guestId: Number(e.target.value) })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-bold text-slate-900 shadow-2xs"
              >
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.guestNumber}] {g.lastName}, {g.firstName} {g.name2 ? `(${g.name2})` : ''} - {g.city || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                RECHNUNGS-DEBITOR (ZAHLER)
              </label>
              <input
                type="text"
                placeholder="leer = Gast selbst"
                value={formData.billingDebitor || ''}
                onChange={(e) => setFormData({ ...formData, billingDebitor: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <DoorClosed className="w-3.5 h-3.5 text-[#376189]" />
                <span>ZIMMERAUSWAHL (HOTEL LINDENGARTEN) <span className="text-rose-600 font-bold ml-0.5">*</span></span>
              </label>
              <select
                value={formData.roomId || ''}
                onChange={(e) => handleRoomChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-bold text-[#1b2b3d] shadow-2xs"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.roomCode}] {r.name} - {r.categoryCode} ({r.baseBeds} Betten, Basis: {(Number(r.basePrice) || 0).toFixed(2)} €)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">BUCHUNGSNUMMER</label>
              <input
                type="text"
                value={formData.reservationNumber || ''}
                onChange={(e) => setFormData({ ...formData, reservationNumber: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>
          </div>

          {/* BLOCK 2: ZEITRAUM & PERSONEN */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-4 gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                ANREISEDATUM <span className="text-rose-600 font-bold ml-1">*</span>
              </label>
              <input
                type="date"
                value={formData.arrivalDate || ''}
                onChange={(e) => handleDateChange(e.target.value, formData.departureDate || '')}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 shadow-2xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                ABREISEDATUM <span className="text-rose-600 font-bold ml-1">*</span>
              </label>
              <input
                type="date"
                value={formData.departureDate || ''}
                onChange={(e) => handleDateChange(formData.arrivalDate || '', e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 shadow-2xs"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ÜBERNACHTUNGEN</label>
              <input
                type="number"
                min="1"
                value={formData.nights || 1}
                onChange={(e) => {
                  const n = parseInt(e.target.value) || 1;
                  setFormData((prev) => ({
                    ...prev,
                    nights: n,
                    totalPrice: prev.isFlatRate ? (prev.totalPrice || 0) : n * (prev.pricePerNight || 0),
                  }));
                }}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ERWACHSENE</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={formData.adultsCount || 1}
                  onChange={(e) => setFormData({ ...formData, adultsCount: parseInt(e.target.value) || 1 })}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs md:text-[13px] font-bold text-slate-900 shadow-2xs"
                />
              </div>
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">KINDER</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={formData.childrenCount || 0}
                  onChange={(e) => setFormData({ ...formData, childrenCount: parseInt(e.target.value) || 0 })}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs"
                />
              </div>
            </div>

            <div className="col-span-4 flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                MITREISENDE PERSONEN (Z.B. ALINE, TORSTEN UND LEA)
              </label>
              <input
                type="text"
                value={formData.companionNames || ''}
                onChange={(e) => setFormData({ ...formData, companionNames: e.target.value })}
                placeholder="Namen weiterer Mitreisender"
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs"
              />
            </div>
          </div>

          {/* BLOCK 3: PREISFINDUNG & VERARBEITUNG */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs grid grid-cols-4 gap-3.5">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>PREISVARIANTE (AUS STAMMDATEN)</span>
              </label>
              <select
                value={formData.priceVariant || 'Doppelt belegt'}
                onChange={(e) => handlePriceVariantChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 shadow-2xs"
              >
                {priceVariants.map((pv) => (
                  <option key={pv.id} value={pv.name}>
                    [{pv.shortCode}] {pv.name} {pv.isOnlineImport ? '(Online-Import)' : pv.isFlatRate ? '(Pauschal)' : ''}
                  </option>
                ))}
                <option value="Doppelt belegt">Doppelt belegt</option>
                <option value="Einfach belegt">Einfach belegt</option>
                <option value="Dreifach belegt">Dreifach belegt</option>
                <option value="ohne F&B 1 Person">ohne F&B 1 Person</option>
                <option value="ohne F&B 2 Personen">ohne F&B 2 Personen</option>
                <option value="Online">Online</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">PREIS / NACHT (€)</label>
              <input
                type="number"
                step="0.5"
                value={formData.pricePerNight || 0}
                onChange={(e) => handlePricePerNightChange(parseFloat(e.target.value) || 0)}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-emerald-800 uppercase tracking-wide">GESAMTPREIS INKL. (€)</label>
              <input
                type="number"
                step="0.5"
                value={formData.totalPrice || 0}
                onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                className="bg-emerald-50 border border-emerald-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-emerald-900 shadow-2xs"
              />
            </div>

            {/* HINWEIS-BANNER FÜR ONLINE-IMPORT */}
            {formData.priceVariant === 'Online' && (
              <div className="col-span-4 bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong>Online-Schnittstellenimport (Info):</strong> Diese Buchung wurde über ein Portal importiert.
                  Bitte wählen Sie oben die tatsächliche Belegung (z. B. <em>Doppelt belegt</em> oder <em>Einfach belegt</em>), damit das System den F&B-Frühstückssplit (4,80 € / Pers. / Tag) auf der Rechnung anwendet.
                </div>
              </div>
            )}

            {/* LIVE STEUER-AUFSCHLÜSSELUNG (7% Logis & 19% Frühstück) */}
            <div className="col-span-4 bg-slate-50 border border-slate-200 rounded p-2 flex flex-col gap-1.5 text-[11px] font-mono">
              {(() => {
                const nights = formData.nights || 1;
                const unitPrice = formData.pricePerNight || (formData.totalPrice ? formData.totalPrice / nights : 85);

                const split = calculateBreakfastSplit({
                  variantName: formData.priceVariant || 'Doppelt belegt',
                  pricePerNight: unitPrice,
                  nights,
                  breakfastPersons: formData.breakfastCount,
                  breakfastDays: formData.breakfastDays,
                });

                const splitLodging = calculateSplitTax(split.totalLodgingGross, 0.07);
                const splitBf = calculateSplitTax(split.totalBreakfastGross, 0.19);

                return (
                  <>
                    <div className="flex items-center justify-between text-xs font-sans">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700">Rechnungs-Split:</span>
                        {split.totalBreakfastCount > 0 ? (
                          <span>
                            Logis: <strong>{split.totalLodgingGross.toFixed(2)} €</strong> (7% MwSt = {splitLodging.tax.toFixed(2)} €) + 
                            Frühstück: <strong>{split.totalBreakfastGross.toFixed(2)} €</strong> ({split.totalBreakfastCount}x à 4,80 €, 19% MwSt = {splitBf.tax.toFixed(2)} €)
                          </span>
                        ) : (
                          <span className="text-slate-600">
                            Reine Logis: <strong>{split.totalLodgingGross.toFixed(2)} €</strong> (100% à 7% MwSt, kein Frühstücksabzug)
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 font-mono text-[10px]">
                        Gesamt: <strong>{(split.totalLodgingGross + split.totalBreakfastGross).toFixed(2)} €</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                      <span className="text-[10px] text-slate-500 font-sans italic">
                        Anreisetag ab 15:00 Uhr ohne Frühstück ({nights} ÜN = {split.days} Frühstückstage)
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* BLOCK 4: VERPFLEGUNGSMATRIX (Personal-Info mit Mehrfachauswahl) */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-2.5">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800 uppercase tracking-wide text-xs">
                <Utensils className="w-4 h-4 text-amber-600" />
                <span>VERPFLEGUNGSMATRIX (INFORMATION FÜR PERSONAL & KÜCHE)</span>
              </div>
              <div className="text-[11px] text-slate-600 font-medium">
                Auswahl:{' '}
                {activeBoardTypes.length > 0 ? (
                  <strong className="text-amber-900 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 ml-1">
                    {activeBoardTypes.join(', ')}
                  </strong>
                ) : (
                  <span className="italic text-slate-400 ml-1">Keine Verpflegung hinterlegt</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 pt-1">
              {BOARD_OPTIONS.map((opt) => {
                const isSelected = activeBoardTypes.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleBoardType(opt.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold ${isSelected ? 'text-amber-950 font-extrabold' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        {opt.description}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleBoardType(opt.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 cursor-pointer accent-amber-600 focus:ring-amber-500"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* BLOCK 5: FLAGS & SPERREN */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.isWrittenReservation}
                onChange={(e) => setFormData({ ...formData, isWrittenReservation: e.target.checked })}
                className="w-4 h-4 text-[#376189] rounded focus:ring-[#376189] cursor-pointer"
              />
              <span className="text-xs md:text-[13px] font-semibold text-slate-900">
                Schriftlich reserviert (Bestätigung versendet)
              </span>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded border transition-colors shadow-2xs ${
              formData.isLockedToRoom ? 'bg-[#fcf3e6] border-[#e2a862]' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={!!formData.isLockedToRoom}
                onChange={(e) => setFormData({ ...formData, isLockedToRoom: e.target.checked })}
                className="w-4 h-4 text-[#cf8232] rounded focus:ring-[#cf8232] cursor-pointer"
              />
              <span className="text-xs md:text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                {formData.isLockedToRoom ? (
                  <>
                    <Lock className="w-4 h-4 text-[#cf8232]" />
                    <span>Fest gebucht (Gesperrt gegen DnD-Umzug)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-slate-400" />
                    <span>Nicht Fest (verlegbar)</span>
                  </>
                )}
              </span>
            </label>
          </div>

          {/* NOTIZEN */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              NOTIZEN & SONDERWÜNSCHE
            </label>
            <input
              type="text"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="z.B. Spätanreise nach 20:00 Uhr, Allergikerbettwäsche erwünscht"
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs"
            />
          </div>

          {/* FUSSZEILE BUTTONS */}
          <div className="bg-slate-200 border-t border-slate-300 p-2 flex items-center justify-between mt-1 rounded">
            <button
              type="button"
              onClick={onClose}
              className="border border-slate-400 bg-white hover:bg-slate-100 text-slate-700 px-3 py-1 rounded font-semibold text-xs cursor-pointer"
            >
              [Esc] Abbrechen
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 bg-[#376189] hover:bg-[#2c4f70] text-white border border-[#264563] px-4 py-1.2 rounded font-semibold text-xs shadow-xs cursor-pointer active:translate-y-px"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Wird gespeichert...' : '[F9] Reservierung speichern'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
