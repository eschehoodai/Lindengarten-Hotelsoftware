import React, { useState, useEffect } from 'react';
import type { Reservation, Room, Guest, PriceVariant } from '../../types';
import { 
  Calendar, DoorClosed, Users, Utensils, DollarSign, 
  Lock, Unlock, X, Check, Coffee, FileText, Building2, ShieldAlert
} from 'lucide-react';
import { calculateSplitTax, calculateJonsdorfGaestetaxe } from '../../services/taxEngine';

interface ReservationDialogProps {
  reservation: Partial<Reservation> | null;
  rooms: Room[];
  guests: Guest[];
  priceVariants: PriceVariant[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (reservationData: Partial<Reservation>) => Promise<void>;
}

const resolveBoardType = (data: Partial<Reservation>): 'Frühstück' | 'OHP' | '2Gang' | '3Gang' => {
  if (data.boardType === 'OHP' || data.dailyArrangement?.toUpperCase().includes('OHP')) return 'OHP';
  if (data.boardType === '3Gang' || data.dailyArrangement?.includes('3 Gang') || data.dailyArrangement?.includes('3Gang') || (data.threeGangCount && data.threeGangCount > 0)) return '3Gang';
  if (data.boardType === '2Gang' || data.dailyArrangement?.includes('2 Gang') || data.dailyArrangement?.includes('2Gang') || (data.twoGangCount && data.twoGangCount > 0)) return '2Gang';
  return 'Frühstück';
};

export const ReservationDialog: React.FC<ReservationDialogProps> = ({
  reservation,
  rooms,
  guests,
  priceVariants,
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
      const resolved = resolveBoardType(reservation);
      setFormData({
        ...defaults,
        ...reservation,
        boardType: reservation.boardType || resolved,
        dailyArrangement: reservation.dailyArrangement || resolved,
        breakfastCount: reservation.breakfastCount ?? (resolved === 'Frühstück' ? (reservation.adultsCount || 2) : 0),
        ohpCount: reservation.ohpCount ?? (resolved === 'OHP' ? (reservation.adultsCount || 2) : 0),
        twoGangCount: reservation.twoGangCount ?? (resolved === '2Gang' ? (reservation.dinnerCount || reservation.adultsCount || 2) : 0),
        threeGangCount: reservation.threeGangCount ?? (resolved === '3Gang' ? (reservation.dinnerCount || reservation.adultsCount || 2) : 0),
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

  const handlePricePerNightChange = (price: number) => {
    const nights = formData.nights || 1;
    setFormData((prev) => ({
      ...prev,
      pricePerNight: price,
      totalPrice: prev.isFlatRate ? (prev.totalPrice || price) : nights * price,
    }));
  };

  const currentBoard = resolveBoardType(formData);

  const selectBoardType = (type: 'Frühstück' | 'OHP' | '2Gang' | '3Gang') => {
    const guestCount = formData.adultsCount || 1;
    setFormData((prev) => ({
      ...prev,
      boardType: type,
      dailyArrangement: type,
      hasBreakfast: type !== 'OHP',
      breakfastCount: type === 'Frühstück' ? guestCount : (type === '2Gang' || type === '3Gang' ? guestCount : 0),
      ohpCount: type === 'OHP' ? guestCount : 0,
      twoGangCount: type === '2Gang' ? guestCount : 0,
      threeGangCount: type === '3Gang' ? guestCount : 0,
      dinnerCount: (type === '2Gang' || type === '3Gang') ? guestCount : 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestId || !formData.roomId) {
      alert('Bitte wählen Sie Gast und Zimmer aus.');
      return;
    }
    const resolved = resolveBoardType(formData);
    const payload: Partial<Reservation> = {
      ...formData,
      boardType: formData.boardType || resolved,
      dailyArrangement: formData.dailyArrangement || resolved,
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
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <Users className="w-3 h-3 text-[#376189]" />
                <span>Hauptgast / Reserviert auf *</span>
              </label>
              <select
                value={formData.guestId || ''}
                onChange={(e) => setFormData({ ...formData, guestId: Number(e.target.value) })}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-slate-800"
              >
                {guests.map((g) => (
                  <option key={g.id} value={g.id}>
                    [{g.guestNumber}] {g.lastName}, {g.firstName} {g.name2 ? `(${g.name2})` : ''} - {g.city || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">
                Rechnungs-Debitor (Zahler)
              </label>
              <input
                type="text"
                placeholder="leer = Gast selbst"
                value={formData.billingDebitor || ''}
                onChange={(e) => setFormData({ ...formData, billingDebitor: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs"
              />
            </div>

            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <DoorClosed className="w-3 h-3 text-[#376189]" />
                <span>Zimmerauswahl (Hotel Lindengarten) *</span>
              </label>
              <select
                value={formData.roomId || ''}
                onChange={(e) => handleRoomChange(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-bold text-[#1b2b3d]"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.roomCode}] {r.name} - {r.categoryCode} ({r.baseBeds} Betten, Basis: {(Number(r.basePrice) || 0).toFixed(2)} €)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">Buchungsnummer</label>
              <input
                type="text"
                value={formData.reservationNumber || ''}
                onChange={(e) => setFormData({ ...formData, reservationNumber: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono font-bold"
              />
            </div>
          </div>

          {/* BLOCK 2: ZEITRAUM & PERSONEN */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">Anreisedatum *</label>
              <input
                type="date"
                value={formData.arrivalDate || ''}
                onChange={(e) => handleDateChange(e.target.value, formData.departureDate || '')}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">Abreisedatum *</label>
              <input
                type="date"
                value={formData.departureDate || ''}
                onChange={(e) => handleDateChange(formData.arrivalDate || '', e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">Übernachtungen</label>
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
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Erwachsene</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={formData.adultsCount || 1}
                  onChange={(e) => setFormData({ ...formData, adultsCount: parseInt(e.target.value) || 1 })}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold"
                />
              </div>
              <div className="flex flex-col gap-1 w-1/2">
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Kinder</label>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={formData.childrenCount || 0}
                  onChange={(e) => setFormData({ ...formData, childrenCount: parseInt(e.target.value) || 0 })}
                  className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
                />
              </div>
            </div>

            <div className="col-span-4 flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">
                Mitreisende Personen (z.B. Aline, Torsten und Lea)
              </label>
              <input
                type="text"
                value={formData.companionNames || ''}
                onChange={(e) => setFormData({ ...formData, companionNames: e.target.value })}
                placeholder="Namen weiterer Mitreisender"
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
              />
            </div>
          </div>

          {/* BLOCK 3: PREISFINDUNG & VERARBEITUNG */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] text-slate-500 uppercase font-semibold flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600" />
                <span>Preisvariante (aus Stammdaten)</span>
              </label>
              <select
                value={formData.priceVariant || 'Doppelt belegt'}
                onChange={(e) => setFormData({ ...formData, priceVariant: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold"
              >
                {priceVariants.map((pv) => (
                  <option key={pv.id} value={pv.name}>
                    [{pv.shortCode}] {pv.name} {pv.isFlatRate ? '(Pauschal)' : ''}
                  </option>
                ))}
                <option value="Doppelt belegt">Doppelt belegt</option>
                <option value="Einfach belegt">Einfach belegt</option>
                <option value="Dreifach belegt">Dreifach belegt</option>
                <option value="Pauschalangebot">Pauschalangebot</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold">Preis / Nacht (€)</label>
              <input
                type="number"
                step="0.5"
                value={formData.pricePerNight || 0}
                onChange={(e) => handlePricePerNightChange(parseFloat(e.target.value) || 0)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-500 uppercase font-semibold text-emerald-700">Gesamt Logis (€)</label>
              <input
                type="number"
                step="0.5"
                value={formData.totalPrice || 0}
                onChange={(e) => setFormData({ ...formData, totalPrice: parseFloat(e.target.value) || 0 })}
                className="bg-emerald-50 border border-emerald-300 rounded px-2 py-1 text-xs font-mono font-bold text-emerald-800 text-sm"
              />
            </div>

            {/* LIVE STEUER-AUFSCHLÜSSELUNG (7% USt & Gästetaxe Kurort Jonsdorf) */}
            <div className="col-span-4 bg-slate-50 border border-slate-200 rounded p-2 flex items-center justify-between text-[11px] font-mono">
              {(() => {
                const guestObj = guests.find((g) => g.id === formData.guestId);
                const isExempt = !!guestObj?.isTaxExempt;
                const reason = guestObj?.taxExemptReason;
                const lodgingGross = formData.totalPrice || 0;
                const nights = formData.nights || 1;
                const adultsCount = formData.adultsCount || 1;
                const childrenCount = formData.childrenCount || 0;
                const split7 = calculateSplitTax(lodgingGross, 0.07);
                const gaestetaxe = calculateJonsdorfGaestetaxe({
                  nights,
                  adultsCount,
                  childrenCount,
                  isExempt,
                  exemptReason: reason,
                });

                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-600 font-sans">
                        Steuersplitting Logis: <strong>{split7.net.toFixed(2)} €</strong> Netto + <strong>{split7.tax.toFixed(2)} €</strong> (7% USt)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {gaestetaxe.isExempt ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          <ShieldAlert className="w-3 h-3 text-emerald-600" />
                          <span>Gästetaxe-Befreit ({reason || 'Nachweis gem. § 3'})</span>
                        </span>
                      ) : (
                        <span 
                          className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-800 px-2 py-0.5 rounded text-[10px] font-bold"
                          title="Satzung Kurort Jonsdorf vom 05.05.2025: 2,90 € Erw., 1,45 € Kinder (6-14 J.)"
                        >
                          <span>Gästetaxe Jonsdorf ({nights} ÜN, {adultsCount} Erw.{childrenCount > 0 ? `, ${childrenCount} Kind(er)` : ''}): <strong>{gaestetaxe.gaestetaxeAmount.toFixed(2)} €</strong></span>
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* BLOCK 4: VERPFLEGUNGSMATRIX */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs flex flex-col gap-2">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-1 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Utensils className="w-3.5 h-3.5 text-amber-600" />
                <span>Verpflegungsmatrix (Tägliche Portionen F&B)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-normal normal-case">
                Aktive Auswahl: <strong className="text-amber-800 font-semibold">{currentBoard}</strong>
              </span>
            </span>

            <div className="grid grid-cols-4 gap-3 pt-1">
              {/* Option 1: Frühstück */}
              <div 
                onClick={() => selectBoardType('Frühstück')}
                className={`flex flex-col justify-between p-2.5 rounded border transition-all cursor-pointer ${
                  currentBoard === 'Frühstück'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${currentBoard === 'Frühstück' ? 'text-amber-950 font-extrabold' : 'text-slate-700'}`}>
                      Frühstück
                    </span>
                    <input
                      type="radio"
                      name="boardTypeSelection"
                      checked={currentBoard === 'Frühstück'}
                      onChange={() => selectBoardType('Frühstück')}
                      className="w-3.5 h-3.5 text-amber-600 cursor-pointer accent-amber-600"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Frühstücksbuffet</span>
                </div>
                <div 
                  className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-200/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500">Portionen:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.breakfastCount ?? (currentBoard === 'Frühstück' ? (formData.adultsCount || 1) : 0)}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setFormData((prev) => ({ 
                        ...prev, 
                        breakfastCount: count,
                        hasBreakfast: count > 0,
                        ...(count > 0 && currentBoard !== 'Frühstück' ? { boardType: 'Frühstück', dailyArrangement: 'Frühstück' } : {})
                      }));
                    }}
                    className={`w-16 bg-white border rounded px-1.5 py-0.5 text-xs text-center font-bold ${
                      currentBoard === 'Frühstück' ? 'border-amber-400 text-amber-950' : 'border-slate-300 text-slate-600'
                    }`}
                  />
                </div>
              </div>

              {/* Option 2: OHP */}
              <div 
                onClick={() => selectBoardType('OHP')}
                className={`flex flex-col justify-between p-2.5 rounded border transition-all cursor-pointer ${
                  currentBoard === 'OHP'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${currentBoard === 'OHP' ? 'text-amber-950 font-extrabold' : 'text-slate-700'}`}>
                      OHP
                    </span>
                    <input
                      type="radio"
                      name="boardTypeSelection"
                      checked={currentBoard === 'OHP'}
                      onChange={() => selectBoardType('OHP')}
                      className="w-3.5 h-3.5 text-amber-600 cursor-pointer accent-amber-600"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Ohne Halbpension</span>
                </div>
                <div 
                  className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-200/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500">Portionen:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.ohpCount ?? (currentBoard === 'OHP' ? (formData.adultsCount || 1) : 0)}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setFormData((prev) => ({ 
                        ...prev, 
                        ohpCount: count,
                        ...(count > 0 && currentBoard !== 'OHP' ? { boardType: 'OHP', dailyArrangement: 'OHP', hasBreakfast: false, breakfastCount: 0 } : {})
                      }));
                    }}
                    className={`w-16 bg-white border rounded px-1.5 py-0.5 text-xs text-center font-bold ${
                      currentBoard === 'OHP' ? 'border-amber-400 text-amber-950' : 'border-slate-300 text-slate-600'
                    }`}
                  />
                </div>
              </div>

              {/* Option 3: 2Gang */}
              <div 
                onClick={() => selectBoardType('2Gang')}
                className={`flex flex-col justify-between p-2.5 rounded border transition-all cursor-pointer ${
                  currentBoard === '2Gang'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${currentBoard === '2Gang' ? 'text-amber-950 font-extrabold' : 'text-slate-700'}`}>
                      2Gang
                    </span>
                    <input
                      type="radio"
                      name="boardTypeSelection"
                      checked={currentBoard === '2Gang'}
                      onChange={() => selectBoardType('2Gang')}
                      className="w-3.5 h-3.5 text-amber-600 cursor-pointer accent-amber-600"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">2-Gang Menü (HP)</span>
                </div>
                <div 
                  className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-200/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500">Portionen:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.twoGangCount ?? (currentBoard === '2Gang' ? (formData.adultsCount || 1) : 0)}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setFormData((prev) => ({ 
                        ...prev, 
                        twoGangCount: count,
                        dinnerCount: count,
                        ...(count > 0 && currentBoard !== '2Gang' ? { boardType: '2Gang', dailyArrangement: '2Gang' } : {})
                      }));
                    }}
                    className={`w-16 bg-white border rounded px-1.5 py-0.5 text-xs text-center font-bold ${
                      currentBoard === '2Gang' ? 'border-amber-400 text-amber-950' : 'border-slate-300 text-slate-600'
                    }`}
                  />
                </div>
              </div>

              {/* Option 4: 3Gang */}
              <div 
                onClick={() => selectBoardType('3Gang')}
                className={`flex flex-col justify-between p-2.5 rounded border transition-all cursor-pointer ${
                  currentBoard === '3Gang'
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/50 shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-bold ${currentBoard === '3Gang' ? 'text-amber-950 font-extrabold' : 'text-slate-700'}`}>
                      3Gang
                    </span>
                    <input
                      type="radio"
                      name="boardTypeSelection"
                      checked={currentBoard === '3Gang'}
                      onChange={() => selectBoardType('3Gang')}
                      className="w-3.5 h-3.5 text-amber-600 cursor-pointer accent-amber-600"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">3-Gang Menü (HP)</span>
                </div>
                <div 
                  className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-slate-200/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-[10px] text-slate-500">Portionen:</span>
                  <input
                    type="number"
                    min="0"
                    value={formData.threeGangCount ?? (currentBoard === '3Gang' ? (formData.adultsCount || 1) : 0)}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setFormData((prev) => ({ 
                        ...prev, 
                        threeGangCount: count,
                        dinnerCount: count,
                        ...(count > 0 && currentBoard !== '3Gang' ? { boardType: '3Gang', dailyArrangement: '3Gang' } : {})
                      }));
                    }}
                    className={`w-16 bg-white border rounded px-1.5 py-0.5 text-xs text-center font-bold ${
                      currentBoard === '3Gang' ? 'border-amber-400 text-amber-950' : 'border-slate-300 text-slate-600'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BLOCK 5: FLAGS & SPERREN */}
          <div className="bg-white p-3 rounded border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!formData.isWrittenReservation}
                onChange={(e) => setFormData({ ...formData, isWrittenReservation: e.target.checked })}
                className="w-4 h-4 text-[#376189] rounded focus:ring-[#376189]"
              />
              <span className="text-xs font-semibold text-slate-800">
                Schriftlich reserviert (Bestätigung versendet)
              </span>
            </label>

            <label className={`flex items-center gap-2 cursor-pointer p-1.5 rounded border transition-colors ${
              formData.isLockedToRoom ? 'bg-[#fcf3e6] border-[#e2a862]' : 'border-slate-200'
            }`}>
              <input
                type="checkbox"
                checked={!!formData.isLockedToRoom}
                onChange={(e) => setFormData({ ...formData, isLockedToRoom: e.target.checked })}
                className="w-4 h-4 text-[#cf8232] rounded focus:ring-[#cf8232]"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                {formData.isLockedToRoom ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#cf8232]" />
                    <span>Fest gebucht (Gesperrt gegen DnD-Umzug)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Nicht Fest (verlegbar)</span>
                  </>
                )}
              </span>
            </label>
          </div>

          {/* NOTIZEN */}
          <div className="bg-white p-2.5 rounded border border-slate-200 shadow-xs flex flex-col gap-1">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">
              Notizen & Sonderwünsche
            </label>
            <input
              type="text"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="z.B. Spätanreise nach 20:00 Uhr, Allergikerbettwäsche erwünscht"
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs"
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
