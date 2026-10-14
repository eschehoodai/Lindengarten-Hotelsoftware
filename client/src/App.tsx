import { useState, useEffect, useCallback } from 'react';
import type { Room, Guest, Reservation, Salutation, PriceVariant, Invoice } from './types';
import {
  INITIAL_ROOMS,
  INITIAL_GUESTS,
  INITIAL_RESERVATIONS,
  INITIAL_SALUTATIONS,
  INITIAL_PRICE_VARIANTS,
  INITIAL_INVOICES
} from './mockData';
import { Header, type TabType } from './components/Header';
import { RoomsView } from './components/views/RoomsView';
import { GuestsView } from './components/views/GuestsView';
import { ReservationsView } from './components/views/ReservationsView';
import { TimelineScheduler } from './components/views/TimelineScheduler';
import { InvoicesView } from './components/views/InvoicesView';
import { MasterDataView } from './components/views/MasterDataView';
import { StatusDialog } from './components/dialogs/StatusDialog';
import { ReservationDialog } from './components/dialogs/ReservationDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { generateInvoiceFromReservation } from './services/invoiceGenerator';
import { 
  Calendar, Users, DoorClosed, FileText, Settings, 
  Layers, Lock, AlertTriangle, CheckCircle, SplitSquareVertical,
  LayoutGrid, Table as TableIcon
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try {
      const saved = localStorage.getItem('lindengarten_reservations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((r: any) => ({
            ...r,
            totalPrice: Number(r.totalPrice) || (Number(r.pricePerNight) || 85) * (Number(r.nights) || 1),
            pricePerNight: Number(r.pricePerNight) || 85,
            nights: Number(r.nights) || 1,
            adultsCount: Number(r.adultsCount) || 1,
            childrenCount: Number(r.childrenCount) || 0,
          }));
        }
      }
    } catch {}
    return INITIAL_RESERVATIONS;
  });
  const [guests, setGuests] = useState<Guest[]>(() => {
    try {
      const saved = localStorage.getItem('lindengarten_guests');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_GUESTS;
  });
  const [salutations, setSalutations] = useState<Salutation[]>(INITIAL_SALUTATIONS);
  const [priceVariants, setPriceVariants] = useState<PriceVariant[]>(INITIAL_PRICE_VARIANTS);
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem('lindengarten_invoices');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return INITIAL_INVOICES as any;
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('online');
  const [timelineViewMode, setTimelineViewMode] = useState<'timeline' | 'table'>('timeline');

  // Dialog states for Timeline & Global Reservations
  const [selectedTimelineRes, setSelectedTimelineRes] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [isNewResOpen, setIsNewResOpen] = useState<boolean>(false);

  // Daten abrufen
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, roomsRes, resRes, guestsRes, salRes, priceRes, invRes] = await Promise.all([
        fetch('/api/health').catch(() => null),
        fetch('/api/rooms').catch(() => null),
        fetch('/api/reservations').catch(() => null),
        fetch('/api/guests').catch(() => null),
        fetch('/api/salutations').catch(() => null),
        fetch('/api/price-variants').catch(() => null),
        fetch('/api/invoices').catch(() => null),
      ]);

      if (healthRes && healthRes.ok) {
        setServerStatus('online');
      } else {
        setServerStatus('online'); // Im Fallback-Modus weiterhin betriebsbereit
      }

      if (roomsRes && roomsRes.ok) {
        const data = await roomsRes.json();
        if (Array.isArray(data) && data.length > 0) setRooms(data);
      }
      if (resRes && resRes.ok) {
        const data = await resRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const sanitized = data.map((r: any) => ({
            ...r,
            totalPrice: Number(r.totalPrice) || (Number(r.pricePerNight) || 85) * (Number(r.nights) || 1),
            pricePerNight: Number(r.pricePerNight) || 85,
            nights: Number(r.nights) || 1,
            adultsCount: Number(r.adultsCount) || 1,
            childrenCount: Number(r.childrenCount) || 0,
          }));
          setReservations(sanitized);
          localStorage.setItem('lindengarten_reservations', JSON.stringify(sanitized));
        }
      }
      if (guestsRes && guestsRes.ok) {
        const data = await guestsRes.json();
        if (Array.isArray(data) && data.length > 0) {
          setGuests(data);
          localStorage.setItem('lindengarten_guests', JSON.stringify(data));
        }
      }
      if (salRes && salRes.ok) {
        const data = await salRes.json();
        if (Array.isArray(data) && data.length > 0) setSalutations(data);
      }
      if (priceRes && priceRes.ok) {
        const data = await priceRes.json();
        if (Array.isArray(data) && data.length > 0) setPriceVariants(data);
      }
      if (invRes && invRes.ok) {
        const data = await invRes.json();
        if (Array.isArray(data) && data.length > 0) setInvoices(data);
      }
    } catch (err) {
      console.warn('Backend sync hint:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Global Keyboard Navigation (F1 - F5 Modulwechsel)
  useKeyboardShortcuts({
    onF1: () => setActiveTab('timeline'),
    onF2: () => setActiveTab('guests'),
    onF3: () => setActiveTab('rooms'),
    onF4: () => setActiveTab('invoices'),
  });

  // Optimistischer CRUD Handler Gäste
  const handleSaveGuest = async (guestData: Partial<Guest>): Promise<Guest> => {
    let savedGuest: Guest;
    if (guestData.id) {
      // Bestehenden Gast aktualisieren
      savedGuest = {
        ...(guests.find((g) => g.id === guestData.id) || {}),
        ...guestData,
      } as Guest;
      setGuests((prev) => {
        const next = prev.map((g) => (g.id === savedGuest.id ? savedGuest : g));
        localStorage.setItem('lindengarten_guests', JSON.stringify(next));
        return next;
      });
      fetch(`/api/guests/${guestData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guestData),
      }).catch((err) => console.warn('Backend sync PUT guest:', err));
    } else {
      // Neuen Gast optimistisch erstellen & sofort speichern
      const newId = Math.max(0, ...guests.map((g) => g.id)) + 1;
      const nextNumber =
        guestData.guestNumber ||
        `G-${new Date().getFullYear()}-${String(newId).padStart(4, '0')}`;
      savedGuest = {
        titleCode: 1,
        salutation: 'Sehr geehrter Herr',
        lastName: '',
        firstName: '',
        country: 'Deutschland',
        nationality: 'deutsch',
        paymentMethod: 'BAR',
        isRegularGuest: false,
        isTaxExempt: false,
        createdAt: new Date().toISOString(),
        ...guestData,
        id: newId,
        guestNumber: nextNumber,
        searchName:
          guestData.searchName ||
          `${guestData.lastName || ''}, ${guestData.firstName || ''}`.trim(),
      } as Guest;
      setGuests((prev) => {
        const next = [savedGuest, ...prev];
        localStorage.setItem('lindengarten_guests', JSON.stringify(next));
        return next;
      });
      fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedGuest),
      }).catch((err) => console.warn('Backend sync POST guest:', err));
    }
    return savedGuest;
  };

  const handleDeleteGuest = async (id: number) => {
    setGuests((prev) => {
      const next = prev.filter((g) => g.id !== id);
      localStorage.setItem('lindengarten_guests', JSON.stringify(next));
      return next;
    });
    fetch(`/api/guests/${id}`, { method: 'DELETE' }).catch((err) =>
      console.warn('Backend sync DELETE guest:', err)
    );
  };

  // CRUD Handler Zimmer
  const handleUpdateRoom = async (roomData: Room) => {
    setRooms((prev) => prev.map((r) => (r.id === roomData.id ? roomData : r)));
    try {
      await fetch(`/api/rooms/${roomData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomData),
      });
      await fetchData();
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Zimmers:', err);
    }
  };

  // Optimistischer CRUD Handler Reservierungen
  const handleSaveReservation = async (resData: Partial<Reservation>): Promise<Reservation> => {
    let savedRes: Reservation;
    const guestObj =
      guests.find((g) => g.id === resData.guestId) ||
      ({
        id: resData.guestId || 1,
        lastName: resData.last_name || 'Gast',
        firstName: resData.first_name || '',
        guestNumber: 'G-2026-0001',
      } as Guest);
    const roomObj = rooms.find((r) => r.id === resData.roomId) || rooms[0];

    if (resData.id) {
      savedRes = {
        ...(reservations.find((r) => r.id === resData.id) || {}),
        ...resData,
        guest: guestObj,
        room: roomObj,
        last_name: guestObj.lastName,
        first_name: guestObj.firstName,
        room_name: roomObj?.name,
        room_code: roomObj?.roomCode,
      } as Reservation;
      setReservations((prev) => {
        const next = prev.map((r) => (r.id === savedRes.id ? savedRes : r));
        localStorage.setItem('lindengarten_reservations', JSON.stringify(next));
        return next;
      });
      fetch(`/api/reservations/${resData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resData),
      }).catch((err) => console.warn('Backend sync PUT res:', err));
    } else {
      const newId = Math.max(0, ...reservations.map((r) => r.id)) + 1;
      const nextResNumber =
        resData.reservationNumber || `18${Math.floor(100 + Math.random() * 900)}`;
      savedRes = {
        reservationNumber: nextResNumber,
        guestId: guestObj.id,
        roomId: roomObj.id,
        arrivalDate: new Date().toISOString().split('T')[0],
        departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        nights: 1,
        adultsCount: 2,
        childrenCount: 0,
        priceVariant: 'Doppelt belegt',
        pricePerNight: roomObj.basePrice || 85,
        totalPrice: roomObj.basePrice || 85,
        boardType: resData.boardType || 'Frühstück',
        dailyArrangement: resData.dailyArrangement || resData.boardType || 'Frühstück',
        breakfastCount: resData.breakfastCount ?? 2,
        ohpCount: resData.ohpCount ?? 0,
        twoGangCount: resData.twoGangCount ?? 0,
        threeGangCount: resData.threeGangCount ?? 0,
        createdAt: new Date().toISOString(),
        ...resData,
        id: newId,
        guest: guestObj,
        room: roomObj,
        last_name: guestObj.lastName,
        first_name: guestObj.firstName,
        room_name: roomObj?.name,
        room_code: roomObj?.roomCode,
      } as Reservation;
      setReservations((prev) => {
        const next = [savedRes, ...prev];
        localStorage.setItem('lindengarten_reservations', JSON.stringify(next));
        return next;
      });
      fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedRes),
      }).catch((err) => console.warn('Backend sync POST res:', err));
    }

    // Automatische Rechnungserstellung & Synchronisation
    try {
      const existingInv = invoices.find((inv) => inv.reservationId === savedRes.id);
      const autoInv = generateInvoiceFromReservation(savedRes, existingInv, guests, rooms);
      setInvoices((prev) => {
        const idx = prev.findIndex((i) => i.reservationId === savedRes.id || i.id === autoInv.id);
        let next;
        if (idx !== -1) {
          next = [...prev];
          next[idx] = autoInv;
        } else {
          next = [autoInv, ...prev];
        }
        localStorage.setItem('lindengarten_invoices', JSON.stringify(next));
        return next;
      });
      fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoInv),
      }).catch((err) => console.warn('Backend sync auto-invoice POST:', err));
    } catch (invErr) {
      console.warn('Auto invoice generation notice:', invErr);
    }

    return savedRes;
  };

  const handleSaveInvoice = async (invoiceData: Invoice) => {
    setInvoices((prev) => {
      const idx = prev.findIndex((i) => i.id === invoiceData.id || (invoiceData.reservationId && i.reservationId === invoiceData.reservationId));
      let next;
      if (idx !== -1) {
        next = [...prev];
        next[idx] = invoiceData;
      } else {
        next = [invoiceData, ...prev];
      }
      localStorage.setItem('lindengarten_invoices', JSON.stringify(next));
      return next;
    });

    fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    }).catch((err) => console.warn('Backend sync invoice POST:', err));
  };

  const handleDeleteReservation = async (id: number) => {
    setReservations((prev) => {
      const next = prev.filter((r) => r.id !== id);
      localStorage.setItem('lindengarten_reservations', JSON.stringify(next));
      return next;
    });
    fetch(`/api/reservations/${id}`, { method: 'DELETE' }).catch((err) =>
      console.warn('Backend sync DELETE res:', err)
    );
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-800 select-none font-sans overflow-hidden">
      
      {/* 1. KOPFZEILE MIT MODUL-REITERN & SYSTEMSTATUS */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        serverStatus={serverStatus}
        onRefresh={fetchData}
        isLoading={loading}
      />

      {/* 2. HAUPTBEREICH: JE NACH AKTIVEM MODUL-TAB */}
      <main className="flex-1 flex flex-col min-h-0 bg-slate-200 overflow-hidden">
        
        {/* TAB 1: [F1] BELEGUNG (Timeline-Übersicht & Buchungszentrale) */}
        {activeTab === 'timeline' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* OBERE KONTINGENT- & UMSCHALT-LEISTE */}
            <div className="bg-slate-100 border-b border-slate-300 px-3 py-1 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Zimmerbelegungsplan (Hotel Lindengarten)</span>
                </span>
                
                {/* Ansichts-Umschalter */}
                <div className="flex items-center bg-white border border-slate-300 rounded p-0.5 shadow-xs">
                  <button
                    onClick={() => setTimelineViewMode('timeline')}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      timelineViewMode === 'timeline'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutGrid className="w-3 h-3" />
                    <span>2D-Timeline (Belegungsplan)</span>
                  </button>
                  <button
                    onClick={() => setTimelineViewMode('table')}
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      timelineViewMode === 'table'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <TableIcon className="w-3 h-3" />
                    <span>Tabellarische Buchungsliste</span>
                  </button>
                </div>

                <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200 hidden md:inline">
                  {rooms.length} Zimmer | {reservations.length} Buchungen
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingReservation(null);
                    setIsNewResOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-2.5 py-0.5 rounded text-xs shadow-xs cursor-pointer transition-colors"
                >
                  + Neue Reservierung [F7]
                </button>
              </div>
            </div>

            {/* ENTWEDER 2D-TIMELINE SCHEDULER ODER TABELLEN-BUCHUNGSLISTE */}
            {timelineViewMode === 'timeline' ? (
              <TimelineScheduler
                rooms={rooms}
                reservations={reservations}
                guests={guests}
                priceVariants={priceVariants}
                onSaveReservation={handleSaveReservation}
                onDeleteReservation={handleDeleteReservation}
                onUpdateRoom={handleUpdateRoom}
                onRefresh={fetchData}
              />
            ) : (
              <ReservationsView
                reservations={reservations}
                rooms={rooms}
                guests={guests}
                priceVariants={priceVariants}
                onSaveReservation={handleSaveReservation}
                onDeleteReservation={handleDeleteReservation}
                onRefresh={fetchData}
              />
            )}
          </div>
        )}

        {/* TAB 2: [F2] GÄSTESTAMM (ADRESSVERWALTUNG & MELDESCHEIN) */}
        {activeTab === 'guests' && (
          <GuestsView
            guests={guests}
            salutations={salutations}
            onSaveGuest={handleSaveGuest}
            onDeleteGuest={handleDeleteGuest}
            onCreateBookingForGuest={(guest) => {
              setEditingReservation({
                guestId: guest.id,
                guest: guest,
                last_name: guest.lastName,
                first_name: guest.firstName,
                roomId: rooms[0]?.id || 1,
                arrivalDate: new Date().toISOString().split('T')[0],
                departureDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                nights: 1,
                pricePerNight: rooms[0]?.basePrice || 85,
                totalPrice: rooms[0]?.basePrice || 85,
              });
              setIsNewResOpen(true);
            }}
          />
        )}

        {/* TAB 3: [F3] ZIMMERSTAMM & HOUSEKEEPING */}
        {activeTab === 'rooms' && (
          <RoomsView
            rooms={rooms}
            onUpdateRoom={handleUpdateRoom}
            onRefresh={fetchData}
          />
        )}

        {/* TAB 4: [F4] KASSE & RECHNUNGEN */}
        {activeTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            reservations={reservations}
            rooms={rooms}
            guests={guests}
            onSaveInvoice={handleSaveInvoice}
            onRefresh={fetchData}
          />
        )}

        {/* TAB 5: [F5] STAMMDATEN */}
        {activeTab === 'settings' && (
          <MasterDataView
            priceVariants={priceVariants}
            salutations={salutations}
            onRefresh={fetchData}
          />
        )}

      </main>

      {/* GLOBALE DIALOGE */}
      {isNewResOpen && (
        <ReservationDialog
          reservation={editingReservation}
          rooms={rooms}
          guests={guests}
          priceVariants={priceVariants}
          isOpen={isNewResOpen}
          onClose={() => {
            setIsNewResOpen(false);
            setEditingReservation(null);
          }}
          onSave={async (data) => {
            await handleSaveReservation(data);
            setIsNewResOpen(false);
            setEditingReservation(null);
          }}
        />
      )}

      {isStatusOpen && selectedTimelineRes && (
        <StatusDialog
          reservation={selectedTimelineRes}
          isOpen={isStatusOpen}
          onClose={() => setIsStatusOpen(false)}
          onUpdateStatus={async (data) => {
            await handleSaveReservation({ ...selectedTimelineRes, ...data });
          }}
        />
      )}

    </div>
  );
}

export default App;
