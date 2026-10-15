import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Reservation, Room, Guest, PriceVariant, Invoice } from '../../types';
import { ActionBar } from '../ActionBar';
import { ReservationDialog } from '../dialogs/ReservationDialog';
import { StatusDialog } from '../dialogs/StatusDialog';
import { 
  Calendar, DoorClosed, Users, Clock, Lock, Unlock, 
  CheckCircle2, Search, Filter, Key, Coffee, FileText, AlertCircle 
} from 'lucide-react';

interface ReservationsViewProps {
  reservations: Reservation[];
  rooms: Room[];
  guests: Guest[];
  priceVariants: PriceVariant[];
  invoices?: Invoice[];
  onSaveReservation: (data: Partial<Reservation>) => Promise<any>;
  onDeleteReservation: (id: number) => Promise<void>;
  onRefresh: () => void;
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({
  reservations,
  rooms,
  guests,
  priceVariants,
  invoices = [],
  onSaveReservation,
  onDeleteReservation,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(reservations[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Schnelle O(1) Lookup-Map für Rechnungen je Reservierung (unterstützt Folio-Splits)
  const invoicesByReservation = useMemo(() => {
    const map = new Map<number, Invoice[]>();
    (invoices || []).forEach((inv) => {
      if (inv.reservationId) {
        const list = map.get(inv.reservationId) || [];
        list.push(inv);
        map.set(inv.reservationId, list);
      }
    });
    return map;
  }, [invoices]);

  const invoiceMap = useMemo(() => {
    const map = new Map<number, Invoice>();
    (invoices || []).forEach((inv) => {
      if (inv.reservationId) map.set(inv.reservationId, inv);
    });
    return map;
  }, [invoices]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'IN_HOUSE' | 'ARRIVALS' | 'DEPARTURES' | 'RESERVED'>('ALL');
  
  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Sync selected
  useEffect(() => {
    if (!selectedId && reservations.length > 0) {
      setSelectedId(reservations[0].id);
    }
  }, [reservations, selectedId]);

  const selectedRes = useMemo(() => {
    return reservations.find((r) => r.id === selectedId) || reservations[0] || null;
  }, [reservations, selectedId]);

  const selectedRoom = useMemo(() => {
    if (!selectedRes) return undefined;
    return rooms.find((rm) => rm.id === selectedRes.roomId);
  }, [rooms, selectedRes]);

  // Today string for filter comparisons
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return reservations.filter((r) => {
      // Filter status
      if (filterMode === 'IN_HOUSE' && (!r.isArrived || r.isDeparted)) return false;
      if (filterMode === 'RESERVED' && (r.isArrived || r.isDeparted)) return false;
      if (filterMode === 'ARRIVALS' && r.arrivalDate !== todayStr) return false;
      if (filterMode === 'DEPARTURES' && r.departureDate !== todayStr) return false;

      // Text query
      if (!q) return true;
      const matchNr = r.reservationNumber?.toLowerCase().includes(q);
      const matchLast = r.guest?.lastName?.toLowerCase().includes(q) || r.last_name?.toLowerCase().includes(q);
      const matchFirst = r.guest?.firstName?.toLowerCase().includes(q) || r.first_name?.toLowerCase().includes(q);
      const matchRoom = r.room?.name?.toLowerCase().includes(q) || r.room_name?.toLowerCase().includes(q) || r.room?.roomCode?.toLowerCase().includes(q) || r.room_code?.toLowerCase().includes(q);
      const matchDebitor = r.billingDebitor?.toLowerCase().includes(q);
      return matchNr || matchLast || matchFirst || matchRoom || matchDebitor;
    });
  }, [reservations, searchQuery, filterMode, todayStr]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditOpen || isStatusOpen) return;

      const currentIndex = filteredReservations.findIndex((r) => r.id === selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < filteredReservations.length - 1) {
          setSelectedId(filteredReservations[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedId(filteredReservations[currentIndex - 1].id);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedRes) {
          setIsStatusOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredReservations, selectedId, isEditOpen, isStatusOpen, selectedRes]);

  // Actions
  const handleOpenNew = () => {
    setEditingReservation(null);
    setIsEditOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedRes) return;
    setEditingReservation({ ...selectedRes });
    setIsEditOpen(true);
  };

  const handleOpenCopy = () => {
    if (!selectedRes) return;
    const nextResNumber = `18${Math.floor(100 + Math.random() * 900)}`;
    setEditingReservation({
      ...selectedRes,
      id: undefined,
      reservationNumber: nextResNumber,
      isArrived: false,
      isDeparted: false,
    });
    setIsEditOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRes) return;
    const confirm = window.confirm(
      `Möchten Sie die Buchung ${selectedRes.reservationNumber} für "${selectedRes.guest?.lastName || selectedRes.last_name}" wirklich stornieren/löschen?`
    );
    if (confirm) {
      await onDeleteReservation(selectedRes.id);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      
      {/* 1. FILTER & SUCHE */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Buchung suchen (Nr, Gast, Zimmer)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 rounded pl-7 pr-2 py-0.5 text-xs w-60 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1 text-slate-400 hover:text-slate-600 text-xs px-1"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-[#376189] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Alle ({reservations.length})
            </button>
            <button
              onClick={() => setFilterMode('IN_HOUSE')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'IN_HOUSE'
                  ? 'bg-[#397356] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-[#2ea36f]" />
              <span>Im Haus</span>
            </button>
            <button
              onClick={() => setFilterMode('RESERVED')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'RESERVED'
                  ? 'bg-[#cf8232] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <span className="font-bold font-mono text-[#cf8232]">[r]</span>
              <span>Reserviert</span>
            </button>
            <button
              onClick={() => setFilterMode('ARRIVALS')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'ARRIVALS'
                  ? 'bg-[#376189] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Anreisen heute
            </button>
            <button
              onClick={() => setFilterMode('DEPARTURES')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'DEPARTURES'
                  ? 'bg-[#7f8c9b] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Abreisen heute
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Buchungen: {filteredReservations.length} | Pfeiltasten ↑ / ↓ | Enter = Status
        </div>
      </div>

      {/* 2. MASTER: TABELLE OBERER BEREICH */}
      <div 
        ref={tableContainerRef}
        className="flex-1 bg-white border-b border-slate-300 overflow-auto min-h-0 focus:outline-hidden"
        tabIndex={0}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
            <tr>
              <th className="py-1.5 px-3 border-r border-slate-300 w-20">Res-Nr.</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-28">Zimmer</th>
              <th className="py-1.5 px-3 border-r border-slate-300">Gast / Debitor</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Anreise</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Abreise</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-16 text-center">Nächte</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-16 text-center">Pers.</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-28">Preisvariante</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-right">Gesamt</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-28 text-center">Status</th>
              <th className="py-1.5 px-3 w-20 text-center">Sperre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {filteredReservations.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-400 font-sans italic">
                  Keine Buchungen gefunden.
                </td>
              </tr>
            ) : (
              filteredReservations.map((res) => {
                const isSelected = selectedId === res.id;
                const isArrived = res.isArrived && !res.isDeparted;
                const isDeparted = res.isDeparted;
                const isReservedOnly = !res.isArrived && !res.isDeparted;

                return (
                  <tr
                    key={res.id}
                    onClick={() => setSelectedId(res.id)}
                    onDoubleClick={() => setIsStatusOpen(true)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#376189] text-white font-semibold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{res.reservationNumber}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans font-bold">
                      [{res.room_code || res.room?.roomCode}] {res.room_name || res.room?.name}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                      <span className="font-semibold">{res.guest?.lastName || res.last_name}, {res.guest?.firstName || res.first_name}</span>
                      {res.billingDebitor && (
                        <span className={`ml-1.5 text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          (Deb: {res.billingDebitor})
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50">{res.arrivalDate}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50">{res.departureDate}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 text-center font-bold">{res.nights} Ü</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 text-center font-sans">
                      {res.adultsCount}E {res.childrenCount > 0 ? `+${res.childrenCount}K` : ''}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans text-[10px]">{res.priceVariant}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 text-right font-bold">
                      {(() => {
                        const resInvs = invoicesByReservation.get(res.id) || [];
                        const hasInvs = resInvs.length > 0;
                        const isFullyPaid = hasInvs && resInvs.every((i) => i.isPaid);
                        const isPartiallyPaid = hasInvs && !isFullyPaid && resInvs.some((i) => i.isPaid);
                        const totalGross = hasInvs
                          ? resInvs.reduce((sum, i) => sum + (Number(i.totalGross) || 0), 0)
                          : (Number(res.totalPrice) || 0);

                        return (
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 border border-white/60 shadow-xs ${
                                isFullyPaid
                                  ? 'bg-[#2ea36f] ring-1 ring-[#268a5d]'
                                  : isPartiallyPaid
                                  ? 'bg-[#d4973b] ring-1 ring-[#bd822b] animate-pulse'
                                  : 'bg-[#bd4343] ring-1 ring-[#a33737]'
                              }`}
                              title={
                                isFullyPaid
                                  ? `Rechnung BEZAHLT (${totalGross.toFixed(2)} €)`
                                  : isPartiallyPaid
                                  ? `Rechnung TEILBEZAHLT: ${resInvs.filter((i) => i.isPaid).length} von ${resInvs.length} bezahlt (${totalGross.toFixed(2)} €)`
                                  : `Rechnung NICHT BEZAHLT (${totalGross.toFixed(2)} € offen)`
                              }
                            />
                            <span>{totalGross.toFixed(2)} €</span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 text-center font-sans">
                      {isArrived && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#edf6f1] text-[#285740]'
                        }`}>
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#2ea36f]" />
                          <span>Im Haus</span>
                        </span>
                      )}
                      {isDeparted && (
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#e5eaf0] text-[#4f5c6e]'
                        }`}>
                          Abgereist
                        </span>
                      )}
                      {isReservedOnly && (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#fcf3e6] text-[#8c5820]'
                        }`}>
                          <span className="font-mono text-[#cf8232] font-black">[r]</span>
                          <span>Reserviert</span>
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-3 text-center">
                      {res.isLockedToRoom ? (
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                          isSelected ? 'text-amber-200' : 'text-amber-700'
                        }`} title="Fest gebucht (Gesperrt gegen Umzug)">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Fest</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]" title="Verlegbar per DnD">
                          Verlegbar
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. DETAIL: DETAILPANEL UNTERE HÄLFTE */}
      <div className="h-56 bg-white border-t border-slate-300 p-2.5 shrink-0 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#376189]" />
              <span>Buchungsdetail & Verpflegung (ELAN hogatec):</span>
              <strong className="text-[#376189]">
                {selectedRes ? `Res-Nr. ${selectedRes.reservationNumber || '—'} [${selectedRes.room_code || selectedRoom?.roomCode || ''} ${selectedRes.room_name || selectedRoom?.name || ''}]` : 'Keine Buchung'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsStatusOpen(true)}
              className="flex items-center gap-1 bg-[#eef3f7] hover:bg-[#e1eaf1] text-[#2c4f70] border border-[#a8c0d6] px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-colors"
            >
              <Clock className="w-3.5 h-3.5 text-[#376189]" />
              <span>[F6] Status & Check-In öffnen</span>
            </button>
          </div>
        </div>

        {selectedRes ? (
          <div className="grid grid-cols-4 gap-3 text-xs flex-1">
            {/* SPALTE 1: GASTINFO & MITREISENDE */}
            <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Gastdaten</span>
                <div className="font-bold text-slate-800 text-xs mt-0.5">
                  {selectedRes.guest?.lastName || selectedRes.last_name}, {selectedRes.guest?.firstName || selectedRes.first_name}
                </div>
                <div className="text-[11px] text-slate-600">
                  {selectedRes.guest?.street} {selectedRes.guest?.houseNumber}, {selectedRes.guest?.zipCode} {selectedRes.guest?.city}
                </div>
                {selectedRes.guest?.phone && (
                  <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                    Tel: {selectedRes.guest?.phone}
                  </div>
                )}
              </div>
              {selectedRes.companionNames && (
                <div className="text-[10px] text-[#2c4f70] bg-[#eef3f7] p-1 rounded border border-[#ccdbe8] mt-1">
                  <strong>Mitreisende:</strong> {selectedRes.companionNames}
                </div>
              )}
            </div>

            {/* SPALTE 2: REISEZEITRAUM & ZIMMER */}
            <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Aufenthalt & Zimmer</span>
                <div className="font-bold text-[#243c54] mt-0.5">
                  Zimmer {selectedRes.room_code || selectedRoom?.roomCode}: {selectedRes.room_name || selectedRoom?.name}
                </div>
                <div className="font-mono text-[11px] text-slate-700 mt-1">
                  {selectedRes.arrivalDate} → {selectedRes.departureDate}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  {selectedRes.nights} Übernachtungen ({selectedRes.adultsCount} Erw., {selectedRes.childrenCount} Ki.)
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                {selectedRes.isLockedToRoom ? (
                  <span className="flex items-center gap-1 text-amber-700 font-bold bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                    <Lock className="w-2.5 h-2.5" /> Fest gebucht (kein Umzug)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded">
                    <Unlock className="w-2.5 h-2.5" /> Nicht Fest (verlegbar)
                  </span>
                )}
              </div>
            </div>

            {/* SPALTE 3: VERPFLEGUNGSMATRIX */}
            {(() => {
              const getBoard = (res: typeof selectedRes): 'Frühstück' | 'OHP' | '2Gang' | '3Gang' => {
                if (res.boardType === 'OHP' || res.dailyArrangement?.toUpperCase().includes('OHP')) return 'OHP';
                if (res.boardType === '3Gang' || res.dailyArrangement?.includes('3 Gang') || res.dailyArrangement?.includes('3Gang') || (res.threeGangCount && res.threeGangCount > 0)) return '3Gang';
                if (res.boardType === '2Gang' || res.dailyArrangement?.includes('2 Gang') || res.dailyArrangement?.includes('2Gang') || (res.twoGangCount && res.twoGangCount > 0)) return '2Gang';
                return 'Frühstück';
              };
              const resBoard = getBoard(selectedRes);
              return (
                <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-semibold flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Coffee className="w-3 h-3 text-amber-600" />
                        <span>Verpflegungsmatrix</span>
                      </div>
                      <span className="font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded text-[10px]">
                        {resBoard}
                      </span>
                    </span>
                    <div className="grid grid-cols-4 gap-1 text-center font-mono mt-1 text-[11px]">
                      <div className={`p-1 rounded border transition-colors ${resBoard === 'Frühstück' ? 'bg-amber-100/90 border-amber-300 font-bold text-amber-950' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        <div className="text-[9px] font-bold">Frühstück</div>
                        <div>{selectedRes.breakfastCount || (resBoard === 'Frühstück' ? selectedRes.adultsCount : 0)}</div>
                      </div>
                      <div className={`p-1 rounded border transition-colors ${resBoard === 'OHP' ? 'bg-amber-100/90 border-amber-300 font-bold text-amber-950' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        <div className="text-[9px] font-bold">OHP</div>
                        <div>{selectedRes.ohpCount || (resBoard === 'OHP' ? selectedRes.adultsCount : 0)}</div>
                      </div>
                      <div className={`p-1 rounded border transition-colors ${resBoard === '2Gang' ? 'bg-amber-100/90 border-amber-300 font-bold text-amber-950' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        <div className="text-[9px] font-bold">2Gang</div>
                        <div>{selectedRes.twoGangCount || (resBoard === '2Gang' ? (selectedRes.dinnerCount || selectedRes.adultsCount) : 0)}</div>
                      </div>
                      <div className={`p-1 rounded border transition-colors ${resBoard === '3Gang' ? 'bg-amber-100/90 border-amber-300 font-bold text-amber-950' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        <div className="text-[9px] font-bold">3Gang</div>
                        <div>{selectedRes.threeGangCount || (resBoard === '3Gang' ? (selectedRes.dinnerCount || selectedRes.adultsCount) : 0)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-700 border-t border-slate-200 pt-1 flex items-center justify-between">
                    <span className="text-slate-500">Auswahl:</span>
                    <span className="font-semibold text-slate-800">{selectedRes.boardType || selectedRes.dailyArrangement || resBoard}</span>
                  </div>
                </div>
              );
            })()}

            {/* SPALTE 4: FINANZEN & PREISE */}
            <div className="bg-slate-50 p-2 rounded border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Preis & Abrechnung</span>
                <div className="text-xs text-slate-700 font-semibold mt-0.5">
                  Variante: {selectedRes.priceVariant}
                </div>
                <div className="text-[11px] font-mono text-slate-600">
                  Einzelpreis: {(Number(selectedRes.pricePerNight) || 0).toFixed(2)} € / Nacht
                </div>
                <div className="text-sm font-mono font-bold text-emerald-700 mt-1">
                  Gesamt: {(Number(selectedRes.totalPrice) || 0).toFixed(2)} €
                </div>
              </div>
              {selectedRes.notes && (
                <div className="text-[10px] text-slate-600 truncate bg-white p-1 rounded border border-slate-200">
                  <strong>Notiz:</strong> {selectedRes.notes}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 4. AKTIONLEISTE */}
      <ActionBar
        onSelect={() => setIsStatusOpen(true)}
        selectLabel="[F6] Status / Check-In"
        onNew={handleOpenNew}
        onCopy={handleOpenCopy}
        onEdit={handleOpenEdit}
        editLabel="[F9] Ändern"
        onDelete={handleDelete}
        canDelete={!!selectedRes}
        onClose={() => {}}
      />

      {/* DIALOGE */}
      {isEditOpen && (
        <ReservationDialog
          reservation={editingReservation}
          rooms={rooms}
          guests={guests}
          priceVariants={priceVariants}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSave={async (data) => {
            await onSaveReservation(data);
            setIsEditOpen(false);
          }}
        />
      )}

      {isStatusOpen && selectedRes && (
        <StatusDialog
          reservation={selectedRes}
          room={selectedRoom}
          isOpen={isStatusOpen}
          onClose={() => setIsStatusOpen(false)}
          onUpdateStatus={async (data) => {
            await onSaveReservation({ ...selectedRes, ...data });
          }}
        />
      )}

    </div>
  );
};
