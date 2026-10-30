import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Room, Reservation, Guest, PriceVariant, Invoice } from '../../types';
import { 
  Calendar, ChevronLeft, ChevronRight, Lock, Unlock, 
  CheckCircle2, Clock, Plus, Sparkles, AlertTriangle, ShieldCheck,
  Table as TableIcon, LayoutGrid, Info, MessageSquareText
} from 'lucide-react';
import { ActionBar } from '../ActionBar';
import { StatusDialog } from '../dialogs/StatusDialog';
import { ReservationDialog } from '../dialogs/ReservationDialog';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';

interface TimelineSchedulerProps {
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  priceVariants: PriceVariant[];
  invoices?: Invoice[];
  onSaveReservation: (data: Partial<Reservation>) => Promise<any>;
  onDeleteReservation: (id: number) => Promise<void>;
  onUpdateRoom: (room: Room) => Promise<void>;
  onRefresh: () => void;
}

// 1. Draggable Buchungs-Balken Komponente
interface BookingBarProps {
  reservation: Reservation;
  room: Room;
  rowIndex?: number;
  totalDays: number;
  monthStart: Date;
  nextMonthStart: Date;
  onSelect: (res: Reservation) => void;
  onDoubleClick: (res: Reservation) => void;
  isSelected: boolean;
  invoice?: Invoice;
  resInvoices?: Invoice[];
  hasConflict?: boolean;
}

const BookingBar: React.FC<BookingBarProps> = ({
  reservation,
  room,
  rowIndex = 0,
  totalDays,
  monthStart,
  nextMonthStart,
  onSelect,
  onDoubleClick,
  isSelected,
  invoice,
  resInvoices = [],
  hasConflict = false,
}) => {
  const isLocked = !!reservation.isLockedToRoom;
  const isArrived = !!reservation.isArrived && !reservation.isDeparted;
  const isDeparted = !!reservation.isDeparted;
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // Sichere lokale Datumszerlegung YYYY-MM-DD
  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return new Date(NaN);
    const parts = String(dateStr).split('T')[0].split('-').map(Number);
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return new Date(dateStr);
    }
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  };

  const arrDate = parseLocalDate(reservation.arrivalDate);
  const depDate = parseLocalDate(reservation.departureDate);

  if (isNaN(arrDate.getTime()) || isNaN(depDate.getTime())) {
    return null;
  }

  // Liegt die Buchung außerhalb des angezeigten Monats?
  if (depDate <= monthStart || arrDate >= nextMonthStart) {
    return null;
  }

  // Starttag (1-basiert bezogen auf diesen Monat)
  const startDay = arrDate < monthStart ? 1 : arrDate.getDate();
  // Endtag (1-basiert bezogen auf diesen Monat, exklusiv für Abreisetag)
  const endDay = depDate >= nextMonthStart ? totalDays + 1 : depDate.getDate();
  const daySpan = Math.max(1, endDay - startDay);

  // Positionierung im CSS Grid: Strikt auf Zeile 1 fixieren (verhindert vertikale Fehlausrichtung / Zeilensprung)
  const gridStyle: React.CSSProperties = {
    gridColumnStart: startDay,
    gridColumnEnd: `span ${daySpan}`,
    gridRowStart: 1,
    gridRowEnd: 2,
  };

  const guestName = reservation.guest?.lastName || reservation.last_name || 'Gast';
  const firstName = reservation.guest?.firstName || reservation.first_name || '';

  // Zahlungsstatus & Rechnungsbetrag für das Ampel-Modell (Grün = Bezahlt, Gelb = Teilbezahlt, Rot = Offen)
  const allInvs = resInvoices.length > 0 ? resInvoices : (invoice ? [invoice] : []);
  const hasInvs = allInvs.length > 0;
  const isFullyPaid = hasInvs && allInvs.every((i) => i.isPaid);
  const isPartiallyPaid = hasInvs && !isFullyPaid && allInvs.some((i) => i.isPaid);

  const totalAmount = hasInvs
    ? allInvs.reduce((sum, i) => sum + (Number(i.totalGross) || 0), 0)
    : (reservation.totalPrice ?? (reservation.nights * (room.basePrice || 85)));
  const paymentMethod = invoice?.paymentMethod || allInvs[0]?.paymentMethod || 'BAR';

  // Farbe nach Status (Harmonisierte matte & ruhige Naturpalette)
  let barBg = 'bg-[#cf8232] hover:bg-[#bd7428] text-slate-900 border-[#b06a1f]'; // Standard Reserviert (Mattes warmes Ocker)
  if (reservation.roomId === null || reservation.roomId === 0 || room.id === 0) {
    barBg = 'bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold border-amber-600 shadow-sm animate-pulse'; // Unzugewiesene Online-Buchung (Tetris-Puffer)
  } else if (isArrived) {
    barBg = 'bg-[#397356] hover:bg-[#306248] text-white border-[#27533c]'; // Im Haus (Mattes Salbeigrün)
  } else if (isDeparted) {
    barBg = 'bg-[#7f8c9b] hover:bg-[#6e7b8a] text-white border-[#616d7a]'; // Abgereist (Gedämpftes Schiefergrau)
  } else if (reservation.priceVariant === 'Pauschalangebot' || reservation.isFlatRate) {
    barBg = 'bg-[#376189] hover:bg-[#2e5275] text-white border-[#264563]'; // Pauschale/Gruppe (Nordisches Schieferblau)
  }

  const hasNotes = !!reservation.notes && reservation.notes.trim().length > 0;
  // Für die obersten Zimmer (z. B. Zimmer 1 und Zimmer 2) klappt das Popup nach unten auf, damit es nicht von der Kopfzeile beschnitten wird
  const showBelow = rowIndex < 2;

  return (
    <div
      style={gridStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(reservation);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(reservation);
      }}
      className={`relative h-9 my-auto rounded shadow-xs border px-2 flex items-center justify-between text-xs font-sans font-bold transition-all cursor-pointer pointer-events-auto ${
        isHovered ? 'z-50' : 'z-10'
      } ${barBg} ${
        isSelected ? 'ring-2 ring-[#5b8bb8] ring-offset-1 scale-[1.01]' : ''
      } ${
        hasConflict ? 'ring-2 ring-rose-500 shadow-md shadow-rose-500/40 border-rose-600 animate-pulse' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 truncate">
        {/* Status-Buchstabe r (Mattes Mauve) aus Bild 01 */}
        {!isArrived && !isDeparted && (
          <span className="font-mono font-black text-[#502d4b] bg-[#e5d0e2] px-1 py-0.5 rounded text-[10px] shrink-0">
            r
          </span>
        )}
        {hasConflict && (
          <span className="bg-rose-600 text-white font-black text-[9px] px-1 py-0.5 rounded shrink-0 shadow-xs uppercase tracking-tighter" title="Kollision / Überschneidung auf diesem Zimmer!">
            Kollision
          </span>
        )}
        {isArrived && <CheckCircle2 className="w-4 h-4 text-white shrink-0" />}
        {isDeparted && <Clock className="w-3.5 h-3.5 text-white/80 shrink-0" />}
        <span className="truncate text-xs font-bold leading-none">{guestName} ({reservation.nights}Ü)</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 ml-1.5">
        {/* Ampel-Modell Zahlungsstatus: Grüner Punkt (Bezahlt) vs. Gelber Punkt (Teilbezahlt) vs. Roter Punkt (Nicht Bezahlt) */}
        <span
          className={`flex items-center justify-center shrink-0 transition-transform ${
            daySpan >= 3 ? 'gap-1 bg-black/25 backdrop-blur-xs px-1.5 py-0.5 rounded-full border border-white/20' : ''
          }`}
        >
          <span
            className={`w-2.5 h-2.5 rounded-full border border-white/90 shadow-xs shrink-0 ${
              isFullyPaid
                ? 'bg-[#2ea36f] ring-1 ring-[#268a5d] shadow-[#2ea36f]/40'
                : isPartiallyPaid
                ? 'bg-[#d4973b] ring-1 ring-[#bd822b] shadow-[#d4973b]/40 animate-pulse'
                : 'bg-[#bd4343] ring-1 ring-[#a33737] shadow-[#bd4343]/40'
            }`}
          />
          {daySpan >= 3 && (
            <span className="text-[10px] font-bold text-white drop-shadow-xs leading-none hidden md:inline">
              {isFullyPaid ? 'Bezahlt' : isPartiallyPaid ? 'Teilbezahlt' : 'Offen'}
            </span>
          )}
        </span>

        {isLocked && (
          <span><Lock className="w-3.5 h-3.5 text-amber-950/80" /></span>
        )}
      </div>

      {/* GROSSER, DEUTLICH SICHTBARER POPUP-KASTEN NUR BEI VORHANDENEN NOTIZEN & SONDERWÜNSCHEN */}
      {isHovered && hasNotes && (
        <div 
          className={`absolute left-1/2 -translate-x-1/2 w-80 max-w-[90vw] p-3 rounded-lg bg-slate-900/95 text-white border border-amber-400/40 shadow-2xl backdrop-blur-sm pointer-events-none z-50 text-left animate-in fade-in zoom-in-95 duration-150 ${
            showBelow ? 'top-full mt-2' : 'bottom-full mb-2'
          }`}
        >
          {/* Dreieckspfeil nach oben (wenn Kasten unten steht) */}
          {showBelow && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-0 h-0 border-x-6 border-x-transparent border-b-6 border-b-slate-900/95" />
          )}

          <div className="flex items-center gap-2 pb-1.5 border-b border-slate-700/80 mb-2">
            <MessageSquareText className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-sans font-bold text-xs uppercase tracking-wider text-amber-400">
              Notizen & Sonderwünsche
            </span>
          </div>
          <p className="font-sans font-medium text-sm text-slate-100 leading-snug whitespace-pre-line select-text">
            {reservation.notes}
          </p>

          {/* Dreieckspfeil nach unten (wenn Kasten oben steht) */}
          {!showBelow && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-6 border-x-transparent border-t-6 border-t-slate-900/95" />
          )}
        </div>
      )}
    </div>
  );
};

// 2. Zimmer-Zeile Komponente
interface RoomRowProps {
  room: Room;
  children: React.ReactNode;
  onCellClick: (room: Room, dayNumber: number) => void;
  days: { dayNum: number; isWeekend: boolean }[];
}

const RoomRow: React.FC<RoomRowProps> = ({
  room,
  children,
  onCellClick,
  days,
}) => {
  return (
    <div
      className="relative grid h-full border-b border-slate-200 transition-colors hover:bg-slate-50"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))` }}
    >
      {/* Hintergrund Raster für Klicks & Wochenenden */}
      {days.map(({ dayNum, isWeekend }) => (
        <div
          key={dayNum}
          onClick={() => onCellClick(room, dayNum)}
          className={`border-r border-slate-200/60 h-full cursor-cell transition-colors hover:bg-[#376189]/15 ${
            isWeekend ? 'bg-[#b84d4d]/10' : ''
          }`}
          title={`Zimmer ${room.name} am Tag ${dayNum} belegen`}
        />
      ))}

      {/* Überlagerte Buchungs-Balken: Einzeilig mit 1fr für saubere Zentrierung ohne Zeilenversatz */}
      <div 
        className="absolute inset-0 grid items-center pointer-events-none"
        style={{ 
          gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))`,
          gridTemplateRows: '1fr',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// 3. Hauptkomponente: TimelineScheduler
export const TimelineScheduler: React.FC<TimelineSchedulerProps> = ({
  rooms,
  reservations,
  guests,
  priceVariants,
  invoices = [],
  onSaveReservation,
  onDeleteReservation,
  onUpdateRoom,
  onRefresh,
}) => {
  // Startdatum Standard: Oktober 2026 (wie in den Lindengarten Referenzbildern)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 9, 1)); // 0-indexed: 9 = Oktober
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(reservations[0] || null);

  // Schnelle O(1) Lookup-Map für ALLE Rechnungen je Reservierung (unterstützt Folio-Splits / Mehrfachrechnungen)
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

  const UNASSIGNED_VIRTUAL_ROOM: Room = useMemo(() => ({
    id: 0,
    roomCode: 'OTA',
    name: '⚠️ Unzugewiesene Online-Buchungen',
    categoryCode: 'OTA',
    categoryName: 'Unzugewiesen',
    baseBeds: 2,
    maxCapacity: 4,
    basePrice: 0,
    floor: 'Online-Puffer',
    sortOrder: 9999,
    housekeepingStatus: 'clean',
  }), []);

  const allUnassignedReservations = useMemo(() => {
    return reservations.filter(
      (r) => (!r.roomId || r.roomId === 0) && r.status !== 'cancelled'
    );
  }, [reservations]);

  const monthStartStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }, [currentDate]);

  const nextMonthStartStr = useMemo(() => {
    const nextD = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const y = nextD.getFullYear();
    const m = String(nextD.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }, [currentDate]);

  const currentMonthUnassigned = useMemo(() => {
    return allUnassignedReservations
      .filter((r) => r.departureDate > monthStartStr && r.arrivalDate < nextMonthStartStr)
      .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
  }, [allUnassignedReservations, monthStartStr, nextMonthStartStr]);

  const otherMonthUnassigned = useMemo(() => {
    return allUnassignedReservations.filter(
      (r) => !(r.departureDate > monthStartStr && r.arrivalDate < nextMonthStartStr)
    );
  }, [allUnassignedReservations, monthStartStr, nextMonthStartStr]);

  // Dialog-Zustände
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [newResPreset, setNewResPreset] = useState<Partial<Reservation> | null>(null);
  const [resToDelete, setResToDelete] = useState<Reservation | null>(null);

  const confirmDelete = async () => {
    if (!resToDelete) return;
    const targetId = resToDelete.id;
    setResToDelete(null);
    await onDeleteReservation(targetId);
  };

  // Synchronisiertes vertikales Scrollen (Zimmer-Spalte & Kalender-Matrix)
  const leftColRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (leftColRef.current) {
      leftColRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleLeftColScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (gridBodyRef.current) {
      gridBodyRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Monatsberechnung
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
  const nextMonthStart = new Date(year, month + 1, 1, 0, 0, 0, 0);

  // Sync selectedRes when reservations change
  useEffect(() => {
    if (!selectedRes && reservations.length > 0) {
      setSelectedRes(reservations[0]);
    } else if (selectedRes) {
      const updated = reservations.find((r) => r.id === selectedRes.id);
      if (updated) setSelectedRes(updated);
    }
  }, [reservations]);

  // Tage-Array mit Wochenende-Erkennung (Samstag / Sonntag = signalrot nach Bild 01)
  const days = useMemo(() => {
    return Array.from({ length: totalDaysInMonth }, (_, i) => {
      const dayNum = i + 1;
      const date = new Date(year, month, dayNum);
      const dayOfWeek = date.getDay(); // 0 = So, 6 = Sa
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2);
      return { dayNum, dayName, isWeekend };
    });
  }, [year, month, totalDaysInMonth]);

  // Monats-Navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const handleToday = () => {
    setCurrentDate(new Date(2026, 9, 1)); // Oktober 2026 Fokus
  };

  // Tastatursteuerung für F6-F9 in Timeline
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isStatusOpen || isEditOpen || resToDelete) return;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (isInput) return;

      if (e.key === 'F6') {
        if (selectedRes) {
          e.preventDefault();
          setIsStatusOpen(true);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        setNewResPreset(null);
        setIsEditOpen(true);
      } else if (e.key === 'F8') {
        if (selectedRes) {
          e.preventDefault();
          setNewResPreset({
            ...selectedRes,
            id: undefined,
            reservationNumber: undefined,
          });
          setIsEditOpen(true);
        }
      } else if (e.key === 'F9') {
        if (selectedRes) {
          e.preventDefault();
          setNewResPreset(selectedRes);
          setIsEditOpen(true);
        }
      } else if (e.key === 'Delete') {
        if (selectedRes) {
          e.preventDefault();
          setResToDelete(selectedRes);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStatusOpen, isEditOpen, resToDelete, selectedRes, onDeleteReservation]);



  // Klick auf freie Zelle: Neue Buchung für dieses Zimmer & Tag
  const handleCellClick = (room: Room, dayNumber: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const arrivalDate = `${year}-${pad(month + 1)}-${pad(dayNumber)}`;
    const departureDay = Math.min(totalDaysInMonth, dayNumber + 1);
    const departureDate = `${year}-${pad(month + 1)}-${pad(departureDay)}`;

    setNewResPreset({
      roomId: room.id,
      arrivalDate,
      departureDate,
      nights: 1,
      pricePerNight: room.basePrice,
      totalPrice: room.basePrice,
    });
    setIsEditOpen(true);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      
      {/* 1. KOPFZEILE / KALENDERSTEUERUNG */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded shadow-xs p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
              title="Vorheriger Monat"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-800 px-2 min-w-36 text-center font-sans">
              {monthName}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded text-slate-700 cursor-pointer"
              title="Nächster Monat"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleToday}
            className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 px-2.5 py-1 rounded font-semibold text-xs cursor-pointer shadow-xs"
          >
            Oktober 2026 (Live)
          </button>

          {/* Legende mit matten & ruhigen Farbtönen */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-600 border-l border-slate-300 pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#cf8232] border border-[#b06a1f] inline-block" />
              <span>Reserviert</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#397356] border border-[#27533c] inline-block" />
              <span>Im Haus</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#b84d4d] inline-block" />
              <span>Wochenende (Sa/So)</span>
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#b06a1f]" />
              <span>Fest gebucht (gesperrt)</span>
            </span>
            {/* Ampel Legende Zahlungsstatus */}
            <span className="flex items-center gap-1 border-l border-slate-300 pl-3" title="Ampelmodell Zahlungsstatus">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2ea36f] border border-[#268a5d] shadow-xs inline-block" />
              <span>Bezahlt</span>
            </span>
            <span className="flex items-center gap-1" title="Ampelmodell Zahlungsstatus">
              <span className="w-2.5 h-2.5 rounded-full bg-[#bd4343] border border-[#a33737] shadow-xs inline-block" />
              <span>Nicht bezahlt</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setNewResPreset(null);
              setIsEditOpen(true);
            }}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-1 rounded text-xs shadow-xs cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Neue Reservierung [F7]</span>
          </button>
        </div>
      </div>

      {/* 2. TIMELINE-MATRIX (Feste Zimmerzuordnung, Umzug nur über [F9] Ändern) */}
      <div className="flex-1 flex min-h-0 bg-white overflow-hidden border-b border-slate-300">
        
        {/* LINKE SPALTE: ZIMMER-STAMM (Y-Achse) */}
        <div className="w-52 border-r border-slate-300 flex flex-col shrink-0 bg-slate-50 z-20 shadow-xs">
          {/* Kopf Zelle */}
          <div className="h-10 border-b border-slate-300 bg-slate-200 px-3 flex items-center justify-between text-xs font-bold text-slate-700 shrink-0">
            <span>Zimmer</span>
            <span className="text-[10px] text-slate-500 font-mono font-normal">Kategorie</span>
          </div>

          {/* Zimmer-Liste mit optimaler Zeilenhöhe: nur Zimmername links & Kategorie rechts */}
          <div 
            ref={leftColRef}
            className="flex-1 min-h-0 overflow-hidden grid"
            style={{
              gridTemplateRows: rooms.length > 0 ? `repeat(${rooms.length + 1}, minmax(38px, 1fr))` : undefined,
            }}
          >
            {rooms.map((room) => {
              return (
                <div
                  key={room.id}
                  className="h-full px-3 flex items-center justify-between text-xs hover:bg-slate-100 transition-colors border-b border-slate-200 min-w-0"
                >
                  <span 
                    className="font-sans font-semibold text-slate-800 truncate text-xs min-w-0 pr-2" 
                    title={room.name}
                  >
                    {room.name}
                  </span>

                  <span className="text-[10px] text-slate-600 font-mono font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                    {room.categoryCode}
                  </span>
                </div>
              );
            })}

            {/* USER-VORGABE: UNZUGEWIESEN-ZEILE GANZ AM ENDE DER LISTE */}
            <div
              className={`h-full px-2.5 flex items-center justify-between text-xs transition-colors border-b border-amber-300 min-w-0 ${
                currentMonthUnassigned.length > 0 || otherMonthUnassigned.length > 0 ? 'bg-amber-100 font-bold text-amber-950' : 'bg-slate-50 text-slate-500'
              }`}
              title="Hier landen Online-Buchungen (DIRS21 / OTAs), die aufgrund voller oder gestückelter Belegung noch keinem festen Zimmer zugewiesen sind."
            >
              <div className="font-sans truncate text-xs min-w-0 pr-1 flex items-center gap-1.5">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${
                  currentMonthUnassigned.length > 0 ? 'text-amber-600 animate-bounce' : otherMonthUnassigned.length > 0 ? 'text-amber-600' : 'text-slate-400'
                }`} />
                <span className="truncate">⚠️ Unzugewiesen ({currentMonthUnassigned.length})</span>
                {otherMonthUnassigned.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const firstOther = otherMonthUnassigned[0];
                      const [tY, tM] = firstOther.arrivalDate.split('-').map(Number);
                      setCurrentDate(new Date(tY, tM - 1, 1));
                    }}
                    className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs cursor-pointer shrink-0"
                    title={`Zu unzugewiesener Buchung im ${new Date(otherMonthUnassigned[0].arrivalDate).toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })} springen`}
                  >
                    <span>{new Date(otherMonthUnassigned[0].arrivalDate).toLocaleDateString('de-DE', { month: 'short' })} ({otherMonthUnassigned.length}) ↗</span>
                  </button>
                )}
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                currentMonthUnassigned.length > 0 || otherMonthUnassigned.length > 0 ? 'bg-amber-200 text-amber-900 border-amber-400' : 'bg-slate-200 text-slate-600 border-slate-300'
              }`}>
                OTA
              </span>
            </div>
          </div>
        </div>

        {/* RECHTE SPALTE: ZEITACHSE & SCHEDULER MATRIX (X-Achse) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-auto overflow-y-hidden">
          
          {/* TAGE KOPFZEILE (mit signalroten Wochenenden nach Bild 01) */}
          <div 
            className="grid h-10 border-b border-slate-300 bg-slate-100 shrink-0 font-mono text-center text-xs"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))` }}
          >
            {days.map(({ dayNum, dayName, isWeekend }) => (
              <div
                key={dayNum}
                className={`border-r border-slate-300 flex flex-col justify-center ${
                  isWeekend ? 'bg-[#b84d4d] text-white font-bold' : 'text-slate-700'
                }`}
              >
                <span className="text-[9px] uppercase leading-none">{dayName}</span>
                <span className="text-xs font-bold leading-tight">{dayNum}</span>
              </div>
            ))}
          </div>

          {/* ZEILEN DER ZIMMER MIT BUCHUNGSBALKEN (vollständig abgestimmt auf die Zimmerspalte) */}
          <div 
            ref={gridBodyRef}
            onScroll={handleGridScroll}
            className="flex-1 min-h-0 overflow-y-auto grid"
            style={{
              gridTemplateRows: rooms.length > 0 ? `repeat(${rooms.length + 1}, minmax(38px, 1fr))` : undefined,
            }}
          >
            {rooms.map((room, roomIdx) => {
              // Finde alle Reservierungen dieses Zimmers, strikt chronologisch sortiert nach Anreisedatum
              const roomReservations = reservations
                .filter((r) => Number(r.roomId) === room.id || Number((r as any).room_id) === room.id)
                .sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));

              return (
                <RoomRow
                  key={room.id}
                  room={room}
                  days={days}
                  onCellClick={handleCellClick}
                >
                  {roomReservations.map((res) => {
                    const resInvs = invoicesByReservation.get(res.id) || [];
                    const hasConflict = roomReservations.some(
                      (other) => other.id !== res.id && res.arrivalDate < other.departureDate && res.departureDate > other.arrivalDate
                    );
                    return (
                      <BookingBar
                        key={res.id}
                        reservation={res}
                        room={room}
                        rowIndex={roomIdx}
                        totalDays={totalDaysInMonth}
                        monthStart={monthStart}
                        nextMonthStart={nextMonthStart}
                        isSelected={selectedRes?.id === res.id}
                        invoice={resInvs[0] || invoiceMap.get(res.id)}
                        resInvoices={resInvs}
                        hasConflict={hasConflict}
                        onSelect={(r) => setSelectedRes(r)}
                        onDoubleClick={(r) => {
                          setSelectedRes(r);
                          setNewResPreset(r);
                          setIsEditOpen(true);
                        }}
                      />
                    );
                  })}
                </RoomRow>
              );
            })}

            {/* USER-VORGABE: UNZUGEWIESEN-ZEILE GANZ AM ENDE DER TIMELINE-MATRIX */}
            <RoomRow
              key="unassigned-row"
              room={UNASSIGNED_VIRTUAL_ROOM}
              days={days}
              onCellClick={handleCellClick}
            >
              {currentMonthUnassigned.map((res) => {
                const resInvs = invoicesByReservation.get(res.id) || [];
                const hasConflict = currentMonthUnassigned.some(
                  (other) => other.id !== res.id && res.arrivalDate < other.departureDate && res.departureDate > other.arrivalDate
                );
                return (
                  <BookingBar
                    key={res.id}
                    reservation={res}
                    room={UNASSIGNED_VIRTUAL_ROOM}
                    rowIndex={rooms.length}
                    totalDays={totalDaysInMonth}
                    monthStart={monthStart}
                    nextMonthStart={nextMonthStart}
                    isSelected={selectedRes?.id === res.id}
                    invoice={resInvs[0] || invoiceMap.get(res.id)}
                    resInvoices={resInvs}
                    hasConflict={hasConflict}
                    onSelect={(r) => setSelectedRes(r)}
                    onDoubleClick={(r) => {
                      setSelectedRes(r);
                      setNewResPreset(r);
                      setIsEditOpen(true);
                    }}
                  />
                );
              })}
              {currentMonthUnassigned.length === 0 && otherMonthUnassigned.length > 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-auto">
                  <button
                    onClick={() => {
                      const firstOther = otherMonthUnassigned[0];
                      const [tY, tM] = firstOther.arrivalDate.split('-').map(Number);
                      setCurrentDate(new Date(tY, tM - 1, 1));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-semibold shadow-xs cursor-pointer transition-all"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {otherMonthUnassigned.length} unzugewiesene Online-Buchung(en) im {new Date(otherMonthUnassigned[0].arrivalDate).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                    </span>
                    <span className="underline font-bold">Jetzt anzeigen ↗</span>
                  </button>
                </div>
              )}
            </RoomRow>
          </div>

        </div>

      </div>

      {/* 3. SCHNELLINFO-BAR UNTEN (wie in Bild 01 der ELAN hogatec Software) */}
      <div className="h-10 bg-slate-800 text-white px-3 flex items-center justify-between text-xs shrink-0 border-t border-slate-700 font-mono shadow-inner">
        {selectedRes ? (() => {
          const resInvs = invoicesByReservation.get(selectedRes.id) || [];
          const hasInvs = resInvs.length > 0;
          const isFullyPaid = hasInvs && resInvs.every((i) => i.isPaid);
          const isPartiallyPaid = hasInvs && !isFullyPaid && resInvs.some((i) => i.isPaid);
          const selectedAmount = hasInvs
            ? resInvs.reduce((sum, i) => sum + (Number(i.totalGross) || 0), 0)
            : (selectedRes.totalPrice ?? 0);
          const paidCount = resInvs.filter((i) => i.isPaid).length;

          return (
            <div className="flex items-center gap-3 truncate">
              <span className="bg-[#cf8232] text-slate-950 font-bold px-1.5 py-0.2 rounded text-[11px] font-sans">
                Reser
              </span>
              <span className="text-slate-200">
                Reservierung auf:{' '}
                <strong className="text-white font-sans">
                  [{selectedRes.reservationNumber || '—'}] {selectedRes.guest?.lastName || selectedRes.last_name || 'Gast'}, {selectedRes.guest?.firstName || selectedRes.first_name || ''}
                </strong>
              </span>
              <span className="text-slate-400">
                ({selectedRes.nights || 1}Ü/{selectedRes.adultsCount || 1}P. (GPr.: {(Number(selectedRes.totalPrice) || 0).toFixed(2)} €) / Z:{selectedRes.room_code || rooms.find(r => r.id === selectedRes.roomId)?.roomCode || '?'})
              </span>
              {selectedRes.companionNames && (
                <span className="text-[#eed19a] text-[11px] font-sans">
                  Mitreisende: {selectedRes.companionNames}
                </span>
              )}
              {selectedRes.isLockedToRoom && (
                <span className="flex items-center gap-1 text-[#e3b364] bg-[#3a1f06]/80 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold">
                  <Lock className="w-3 h-3" /> Fest gebucht
                </span>
              )}
              {/* Ampel Zahlungsstatus */}
              <span 
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-sans font-bold text-[11px] border ${
                  isFullyPaid
                    ? 'bg-[#1c3e2e]/90 text-[#86d4b1] border-[#2ea36f]/60'
                    : isPartiallyPaid
                    ? 'bg-[#3a1f06]/90 text-[#e3b364] border-[#d4973b]/70 ring-1 ring-[#d4973b]/40'
                    : 'bg-[#381616]/90 text-[#df9696] border-[#bd4343]/60'
                }`}
                title={
                  isFullyPaid
                    ? 'Rechnungen sind vollständig bezahlt'
                    : isPartiallyPaid
                    ? `Teilbezahlt: ${paidCount} von ${resInvs.length} Rechnungen bezahlt`
                    : 'Rechnung ist noch unbezahlt'
                }
              >
                <span className={`w-2.5 h-2.5 rounded-full border border-white/60 shadow-xs ${
                  isFullyPaid
                    ? 'bg-emerald-400 ring-1 ring-emerald-500'
                    : isPartiallyPaid
                    ? 'bg-amber-400 ring-1 ring-amber-500 animate-pulse'
                    : 'bg-rose-500 ring-1 ring-rose-600 animate-pulse'
                }`} />
                <span>
                  {isFullyPaid
                    ? 'Rechnung: BEZAHLT'
                    : isPartiallyPaid
                    ? `Rechnung: TEILBEZAHLT (${paidCount}/${resInvs.length})`
                    : 'Rechnung: NICHT BEZAHLT'}
                </span>
                <span className="opacity-80 font-normal">({selectedAmount.toFixed(2)} €)</span>
              </span>
            </div>
          );
        })() : (
          <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Klicken Sie auf eine Buchung für Detailinfos oder doppelt für Check-In / Status [F6]. Freie Zelle anklicken für Neuanlage.</span>
          </div>
        )}

        <div className="flex items-center gap-2 font-sans">
          {selectedRes && (
            <button
              onClick={() => setIsStatusOpen(true)}
              className="bg-[#376189] hover:bg-[#2c4f70] text-white font-semibold px-2.5 py-0.5 rounded text-[11px] cursor-pointer shadow-xs transition-colors"
            >
              [F6] Status / Check-In
            </button>
          )}
        </div>
      </div>

      {/* 4. AKTIONLEISTE UNTEN */}
      <ActionBar
        onSelect={() => {
          if (selectedRes) setIsStatusOpen(true);
        }}
        selectLabel="[F6] Status / Check-In"
        onNew={() => {
          setNewResPreset(null);
          setIsEditOpen(true);
        }}
        onCopy={() => {
          if (selectedRes) {
            setNewResPreset({
              ...selectedRes,
              id: undefined,
              reservationNumber: undefined,
            });
            setIsEditOpen(true);
          }
        }}
        onEdit={() => {
          if (selectedRes) {
            setNewResPreset(selectedRes);
            setIsEditOpen(true);
          }
        }}
        editLabel="[F9] Ändern"
        onDelete={() => {
          if (selectedRes) {
            setResToDelete(selectedRes);
          }
        }}
        canDelete={!!selectedRes}
        onClose={() => {}}
      />

      {/* MODALE DIALOGE */}
      {isStatusOpen && selectedRes && (
        <StatusDialog
          reservation={selectedRes}
          room={rooms.find((r) => r.id === selectedRes.roomId)}
          isOpen={isStatusOpen}
          onClose={() => setIsStatusOpen(false)}
          onUpdateStatus={async (data) => {
            await onSaveReservation({ ...selectedRes, ...data });
          }}
        />
      )}

      {isEditOpen && (
        <ReservationDialog
          reservation={newResPreset}
          rooms={rooms}
          guests={guests}
          priceVariants={priceVariants}
          reservations={reservations}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSave={async (data) => {
            await onSaveReservation(data);
            setIsEditOpen(false);
          }}
        />
      )}

      {/* BESTÄTIGUNGSDIALOG RESERVIERUNG LÖSCHEN */}
      <ConfirmDialog
        isOpen={!!resToDelete}
        title="Buchung stornieren / löschen?"
        message={
          <>
            Möchten Sie die Buchung{' '}
            <strong>{resToDelete?.reservationNumber}</strong> für Gast{' '}
            <strong>
              {resToDelete?.guest
                ? `${resToDelete.guest.lastName}, ${resToDelete.guest.firstName}`
                : resToDelete?.last_name || 'Unbekannt'}
            </strong>{' '}
            wirklich stornieren bzw. unwiderruflich löschen?
          </>
        }
        details={
          resToDelete
            ? [
                { label: 'Buchungs-Nr', value: resToDelete.reservationNumber },
                {
                  label: 'Gast',
                  value: resToDelete.guest
                    ? `${resToDelete.guest.lastName}, ${resToDelete.guest.firstName}`
                    : resToDelete.last_name || '-',
                },
                {
                  label: 'Zimmer',
                  value: `Zimmer ${
                    rooms.find((r) => r.id === resToDelete.roomId)?.roomCode ||
                    rooms.find((r) => r.id === resToDelete.roomId)?.name ||
                    resToDelete.room?.roomCode ||
                    resToDelete.roomId ||
                    '-'
                  }`,
                },
                {
                  label: 'Reisezeitraum',
                  value: `${resToDelete.arrivalDate} bis ${resToDelete.departureDate} (${resToDelete.nights || 1} ÜN)`,
                },
                ...(resToDelete.totalPrice
                  ? [{ label: 'Gesamtbetrag', value: `${resToDelete.totalPrice.toFixed(2)} €` }]
                  : []),
              ]
            : undefined
        }
        hint="Hinweis: Die Zimmerbelegung wird freigegeben. Eventuelle Kassenbelege oder Rechnungen sollten separat geprüft werden."
        confirmLabel="[Enter] Buchung stornieren"
        cancelLabel="[Esc] Abbrechen"
        danger={true}
        onConfirm={confirmDelete}
        onClose={() => setResToDelete(null)}
      />

    </div>
  );
};
