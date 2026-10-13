import { useState, useEffect, useCallback } from 'react';
import type { Room, Guest, Reservation, Salutation, PriceVariant } from './types';
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
import { 
  Calendar, Users, DoorClosed, FileText, Settings, 
  Layers, Lock, AlertTriangle, CheckCircle, SplitSquareVertical,
  LayoutGrid, Table as TableIcon
} from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('timeline');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [salutations, setSalutations] = useState<Salutation[]>([]);
  const [priceVariants, setPriceVariants] = useState<PriceVariant[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
  const [timelineViewMode, setTimelineViewMode] = useState<'timeline' | 'table'>('timeline');

  // Dialog states for Timeline
  const [selectedTimelineRes, setSelectedTimelineRes] = useState<Reservation | null>(null);
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
        setServerStatus('offline');
      }

      if (roomsRes && roomsRes.ok) setRooms(await roomsRes.json());
      if (resRes && resRes.ok) setReservations(await resRes.json());
      if (guestsRes && guestsRes.ok) setGuests(await guestsRes.json());
      if (salRes && salRes.ok) setSalutations(await salRes.json());
      if (priceRes && priceRes.ok) setPriceVariants(await priceRes.json());
      if (invRes && invRes.ok) setInvoices(await invRes.json());
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setServerStatus('offline');
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

  // CRUD Handler Gäste
  const handleSaveGuest = async (guestData: Partial<Guest>) => {
    try {
      if (guestData.id) {
        // PUT
        await fetch(`/api/guests/${guestData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guestData),
        });
      } else {
        // POST
        await fetch('/api/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guestData),
        });
      }
      await fetchData();
    } catch (err) {
      console.error('Fehler beim Speichern des Gastes:', err);
      alert('Fehler beim Speichern des Gastes.');
    }
  };

  const handleDeleteGuest = async (id: number) => {
    try {
      await fetch(`/api/guests/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error('Fehler beim Löschen des Gastes:', err);
      alert('Fehler beim Löschen des Gastes.');
    }
  };

  // CRUD Handler Zimmer
  const handleUpdateRoom = async (roomData: Room) => {
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

  // CRUD Handler Reservierungen
  const handleSaveReservation = async (resData: Partial<Reservation>) => {
    try {
      if (resData.id) {
        // PUT
        await fetch(`/api/reservations/${resData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resData),
        });
      } else {
        // POST
        await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resData),
        });
      }
      await fetchData();
    } catch (err) {
      console.error('Fehler beim Speichern der Reservierung:', err);
      alert('Fehler beim Speichern der Reservierung.');
    }
  };

  const handleDeleteReservation = async (id: number) => {
    try {
      await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
      await fetchData();
    } catch (err) {
      console.error('Fehler beim Löschen der Reservierung:', err);
      alert('Fehler beim Löschen der Reservierung.');
    }
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
                  onClick={() => setIsNewResOpen(true)}
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
            onSelectGuest={(guest) => {
              // Bei Doppelklick auf Gast: Schnelle Buchung starten
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

        {/* TAB 4: [F4] KASSE & RECHNUNGEN (FOLIO-SPLITTING A/B/C) */}
        {activeTab === 'invoices' && (
          <InvoicesView
            invoices={invoices}
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
          reservation={null}
          rooms={rooms}
          guests={guests}
          priceVariants={priceVariants}
          isOpen={isNewResOpen}
          onClose={() => setIsNewResOpen(false)}
          onSave={async (data) => {
            await handleSaveReservation(data);
            setIsNewResOpen(false);
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
