import React, { useState, useMemo, useRef } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  pointerWithin,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import type { Room, Reservation, Guest, PriceVariant } from '../../types';
import { 
  Calendar, ChevronLeft, ChevronRight, Lock, Unlock, 
  CheckCircle2, Clock, Plus, Sparkles, AlertTriangle, ShieldCheck,
  Table as TableIcon, LayoutGrid, Info
} from 'lucide-react';
import { ActionBar } from '../ActionBar';
import { StatusDialog } from '../dialogs/StatusDialog';
import { ReservationDialog } from '../dialogs/ReservationDialog';

interface TimelineSchedulerProps {
  rooms: Room[];
  reservations: Reservation[];
  guests: Guest[];
  priceVariants: PriceVariant[];
  onSaveReservation: (data: Partial<Reservation>) => Promise<void>;
  onDeleteReservation: (id: number) => Promise<void>;
  onUpdateRoom: (room: Room) => Promise<void>;
  onRefresh: () => void;
}

// 1. Draggable Buchungs-Balken Komponente
interface BookingBarProps {
  reservation: Reservation;
  room: Room;
  totalDays: number;
  monthStart: Date;
  onSelect: (res: Reservation) => void;
  onDoubleClick: (res: Reservation) => void;
  isSelected: boolean;
}

const BookingBar: React.FC<BookingBarProps> = ({
  reservation,
  room,
  totalDays,
  monthStart,
  onSelect,
  onDoubleClick,
  isSelected,
}) => {
  const isLocked = !!reservation.isLockedToRoom;
  const isArrived = !!reservation.isArrived && !reservation.isDeparted;
  const isDeparted = !!reservation.isDeparted;

  // Draggable Hook: gesperrt wenn isLockedToRoom wahr ist
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `booking-${reservation.id}`,
    data: { reservation, sourceRoom: room },
    disabled: isLocked,
  });

  // Berechne Starttag und Dauer im angezeigten Monat
  const resArrival = new Date(reservation.arrivalDate);
  const resDeparture = new Date(reservation.departureDate);

  const startDay = Math.max(1, Math.ceil((resArrival.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const endDay = Math.min(totalDays + 1, Math.ceil((resDeparture.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const daySpan = Math.max(1, endDay - startDay);

  // Positionierung im CSS Grid
  const gridStyle: React.CSSProperties = {
    gridColumnStart: startDay,
    gridColumnEnd: `span ${daySpan}`,
    opacity: isDragging ? 0.4 : 1,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  };

  const guestName = reservation.guest?.lastName || reservation.last_name || 'Gast';
  const firstName = reservation.guest?.firstName || reservation.first_name || '';

  // Farbe nach Status
  let barBg = 'bg-amber-500 hover:bg-amber-600 text-slate-900 border-amber-600'; // Standard Reserviert (Orange wie Bild 01)
  if (isArrived) {
    barBg = 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700'; // Im Haus
  } else if (isDeparted) {
    barBg = 'bg-slate-400 hover:bg-slate-500 text-white border-slate-500'; // Abgereist
  } else if (reservation.priceVariant === 'Pauschalangebot' || reservation.isFlatRate) {
    barBg = 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'; // Pauschale/Gruppe
  }

  return (
    <div
      ref={setNodeRef}
      style={gridStyle}
      {...(isLocked ? {} : listeners)}
      {...(isLocked ? {} : attributes)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(reservation);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(reservation);
      }}
      className={`h-7 my-auto rounded shadow-xs border px-1.5 flex items-center justify-between text-[11px] font-sans font-bold z-10 transition-all cursor-pointer ${barBg} ${
        isSelected ? 'ring-2 ring-blue-400 ring-offset-1 scale-[1.01]' : ''
      }`}
      title={`${guestName}, ${firstName} | ${reservation.arrivalDate} bis ${reservation.departureDate} (${reservation.nights} Ü) | Zimmer: ${room.name} ${
        isLocked ? '🔒 Fest gebucht (Drag-and-Drop gesperrt)' : '↔ Zum Verschieben auf ein anderes Zimmer ziehen'
      }`}
    >
      <div className="flex items-center gap-1 truncate">
        {/* Status-Buchstabe r (Magenta) aus Bild 01 */}
        {!isArrived && !isDeparted && (
          <span className="font-mono font-black text-fuchsia-950 bg-fuchsia-200 px-1 rounded text-[10px] shrink-0" title="Reserviert">
            r
          </span>
        )}
        {isArrived && <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />}
        <span className="truncate">{guestName} ({reservation.nights}Ü)</span>
      </div>

      <div className="flex items-center gap-1 shrink-0 ml-1">
        {isLocked ? (
          <span title="Fest gebucht (Gesperrt)"><Lock className="w-3 h-3 text-amber-950/80" /></span>
        ) : (
          <span className="text-[9px] opacity-70 hidden xl:inline">↔</span>
        )}
      </div>
    </div>
  );
};

// 2. Droppable Zimmer-Zeile Komponente
interface RoomRowDroppableProps {
  room: Room;
  children: React.ReactNode;
  onCellClick: (room: Room, dayNumber: number) => void;
  days: { dayNum: number; isWeekend: boolean }[];
}

const RoomRowDroppable: React.FC<RoomRowDroppableProps> = ({
  room,
  children,
  onCellClick,
  days,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `room-row-${room.id}`,
    data: { room },
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative grid h-9 border-b border-slate-200 transition-colors ${
        isOver ? 'bg-blue-100/70 ring-1 ring-blue-400' : 'hover:bg-slate-50'
      }`}
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))` }}
    >
      {/* Hintergrund Raster für Klicks & Wochenenden */}
      {days.map(({ dayNum, isWeekend }) => (
        <div
          key={dayNum}
          onClick={() => onCellClick(room, dayNum)}
          className={`border-r border-slate-200/60 h-full cursor-cell transition-colors hover:bg-blue-50/50 ${
            isWeekend ? 'bg-rose-50/40' : ''
          }`}
          title={`Zimmer ${room.name} am Tag ${dayNum} belegen`}
        />
      ))}

      {/* Überlagerte Buchungs-Balken */}
      <div 
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))` }}
      >
        <div className="col-span-full grid h-full items-center pointer-events-auto"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(32px, 1fr))` }}
        >
          {children}
        </div>
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
  onSaveReservation,
  onDeleteReservation,
  onUpdateRoom,
  onRefresh,
}) => {
  // Startdatum Standard: Oktober 2026 (wie in den Lindengarten Referenzbildern)
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 9, 1)); // 0-indexed: 9 = Oktober
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(reservations[0] || null);
  const [activeDragRes, setActiveDragRes] = useState<Reservation | null>(null);

  // Dialog-Zustände
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [newResPreset, setNewResPreset] = useState<Partial<Reservation> | null>(null);

  // Monatsberechnung
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1);

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

  // Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    const res = event.active.data.current?.reservation as Reservation;
    if (res) {
      setActiveDragRes(res);
      setSelectedRes(res);
    }
  };

  // Drag End mit KOLLISIONSPRÜFUNG
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragRes(null);

    if (!over) return;

    const movingRes = active.data.current?.reservation as Reservation;
    const targetRoom = over.data.current?.room as Room;

    if (!movingRes || !targetRoom) return;

    // Wenn auf dasselbe Zimmer gedroppt wurde, keine Änderung nötig
    if (movingRes.roomId === targetRoom.id) return;

    // 1. KOLLISIONSERKENNUNG (Doppelbelegung strikt verhindern!)
    const arrivalA = new Date(movingRes.arrivalDate).getTime();
    const departureA = new Date(movingRes.departureDate).getTime();

    const conflictingBooking = reservations.find((r) => {
      if (r.id === movingRes.id) return false;
      if (r.roomId !== targetRoom.id) return false;

      const arrivalB = new Date(r.arrivalDate).getTime();
      const departureB = new Date(r.departureDate).getTime();

      // Überlappung wenn: arrivalA < departureB && departureA > arrivalB
      return arrivalA < departureB && departureA > arrivalB;
    });

    if (conflictingBooking) {
      alert(
        `⚠️ KOLLISION / DOPPELBELEGUNG VERHINDERT!\n\n` +
        `Zimmer "${targetRoom.name}" (${targetRoom.roomCode}) ist im Zeitraum ${movingRes.arrivalDate} bis ${movingRes.departureDate} ` +
        `bereits durch Gast "${conflictingBooking.guest?.lastName || conflictingBooking.last_name}" belegt.\n\n` +
        `Die Buchung kann nicht auf dieses Zimmer verschoben werden.`
      );
      return;
    }

    // 2. Keine Kollision: Zimmer-Update durchführen
    try {
      await onSaveReservation({
        ...movingRes,
        roomId: targetRoom.id,
        // Preis gegebenenfalls an Zimmerbasis anpassen falls kein Festpreis
        pricePerNight: movingRes.isFlatRate ? movingRes.pricePerNight : targetRoom.basePrice,
        totalPrice: movingRes.isFlatRate ? movingRes.totalPrice : movingRes.nights * targetRoom.basePrice,
      });
    } catch (err) {
      console.error('Fehler beim Verschieben:', err);
    }
  };

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

          {/* Legende */}
          <div className="hidden lg:flex items-center gap-3 text-[11px] text-slate-600 border-l border-slate-300 pl-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 border border-amber-600 inline-block" />
              <span>Reserviert</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 border border-emerald-700 inline-block" />
              <span>Im Haus</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" />
              <span>Wochenende (Sa/So)</span>
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-amber-700" />
              <span>Fest gebucht (gesperrt)</span>
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

      {/* 2. DND-CONTEXT & TIMELINE-MATRIX */}
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex min-h-0 bg-white overflow-hidden border-b border-slate-300">
          
          {/* LINKE SPALTE: ZIMMER-STAMM (Y-Achse) */}
          <div className="w-48 border-r border-slate-300 flex flex-col shrink-0 bg-slate-50 z-20 shadow-xs">
            {/* Kopf Zelle */}
            <div className="h-10 border-b border-slate-300 bg-slate-200 px-3 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Zimmer</span>
              <span className="text-[10px] text-slate-500 font-mono font-normal">Kategorie</span>
            </div>

            {/* Zimmer-Liste */}
            <div className="flex-1 overflow-hidden divide-y divide-slate-200">
              {rooms.map((room) => {
                const isDirty = room.housekeepingStatus === 'dirty';
                return (
                  <div
                    key={room.id}
                    className="h-9 px-2 flex items-center justify-between text-xs hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-mono font-bold text-blue-900 w-12 truncate text-[11px]">
                        {room.roomCode}
                      </span>
                      <span className="font-sans font-semibold text-slate-800 truncate text-[11px]" title={room.name}>
                        {room.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isDirty && (
                        <span className="bg-amber-100 text-amber-800 text-[9px] px-1 rounded font-bold" title="Reinigung ausstehend">
                          Dirty
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        {room.categoryCode}
                      </span>
                    </div>
                  </div>
                );
              })}
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
                    isWeekend ? 'bg-rose-500 text-white font-bold' : 'text-slate-700'
                  }`}
                >
                  <span className="text-[9px] uppercase leading-none">{dayName}</span>
                  <span className="text-xs font-bold leading-tight">{dayNum}</span>
                </div>
              ))}
            </div>

            {/* ZEILEN DER ZIMMER MIT BUCHUNGSBALKEN */}
            <div className="flex-1 overflow-y-auto">
              {rooms.map((room) => {
                // Finde alle Reservierungen dieses Zimmers
                const roomReservations = reservations.filter((r) => r.roomId === room.id);

                return (
                  <RoomRowDroppable
                    key={room.id}
                    room={room}
                    days={days}
                    onCellClick={handleCellClick}
                  >
                    {roomReservations.map((res) => (
                      <BookingBar
                        key={res.id}
                        reservation={res}
                        room={room}
                        totalDays={totalDaysInMonth}
                        monthStart={monthStart}
                        isSelected={selectedRes?.id === res.id}
                        onSelect={(r) => setSelectedRes(r)}
                        onDoubleClick={(r) => {
                          setSelectedRes(r);
                          setIsStatusOpen(true);
                        }}
                      />
                    ))}
                  </RoomRowDroppable>
                );
              })}
            </div>

          </div>

        </div>

        {/* Drag Overlay Vorschau */}
        <DragOverlay>
          {activeDragRes ? (
            <div className="h-7 bg-blue-600 text-white font-bold text-xs rounded px-2 flex items-center shadow-2xl opacity-90 border border-blue-400">
              <span>↔ {activeDragRes.guest?.lastName || activeDragRes.last_name} ({activeDragRes.nights}Ü)</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 3. SCHNELLINFO-BAR UNTEN (wie in Bild 01 der ELAN hogatec Software) */}
      <div className="h-10 bg-slate-800 text-white px-3 flex items-center justify-between text-xs shrink-0 border-t border-slate-700 font-mono shadow-inner">
        {selectedRes ? (
          <div className="flex items-center gap-3 truncate">
            <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.2 rounded text-[11px] font-sans">
              Reser
            </span>
            <span className="text-slate-200">
              Reservierung auf:{' '}
              <strong className="text-white font-sans">
                [{selectedRes.reservationNumber}] {selectedRes.guest?.lastName || selectedRes.last_name}, {selectedRes.guest?.firstName || selectedRes.first_name}
              </strong>
            </span>
            <span className="text-slate-400">
              ({selectedRes.nights}Ü/{selectedRes.adultsCount}P. (GPr.: {selectedRes.totalPrice.toFixed(2)} €) / Z:{selectedRes.room_code || rooms.find(r => r.id === selectedRes.roomId)?.roomCode})
            </span>
            {selectedRes.companionNames && (
              <span className="text-amber-300 text-[11px] font-sans">
                Mitreisende: {selectedRes.companionNames}
              </span>
            )}
            {selectedRes.isLockedToRoom && (
              <span className="flex items-center gap-1 text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded text-[10px] font-sans font-bold">
                <Lock className="w-3 h-3" /> Fest gebucht (kein DnD-Umzug)
              </span>
            )}
          </div>
        ) : (
          <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Klicken Sie auf eine Buchung für Detailinfos oder doppelt für Check-In / Status [F6]. Freie Zelle anklicken für Neuanlage.</span>
          </div>
        )}

        <div className="flex items-center gap-2 font-sans">
          {selectedRes && (
            <button
              onClick={() => setIsStatusOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-2 py-0.5 rounded text-[11px] cursor-pointer"
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
              reservationNumber: `18${Math.floor(100 + Math.random() * 900)}`,
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
        onDelete={async () => {
          if (selectedRes) {
            const confirm = window.confirm(`Buchung ${selectedRes.reservationNumber} stornieren?`);
            if (confirm) await onDeleteReservation(selectedRes.id);
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
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSave={async (data) => {
            await onSaveReservation(data);
            setIsEditOpen(false);
          }}
        />
      )}

    </div>
  );
};
