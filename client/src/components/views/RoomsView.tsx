import React, { useState, useEffect, useRef } from 'react';
import type { Room } from '../../types';
import { ActionBar } from '../ActionBar';
import { Sparkles, AlertTriangle, ShieldCheck, Filter, DoorClosed } from 'lucide-react';

interface RoomsViewProps {
  rooms: Room[];
  onUpdateRoom: (room: Room) => Promise<void>;
  onRefresh: () => void;
}

export const RoomsView: React.FC<RoomsViewProps> = ({ rooms, onUpdateRoom }) => {
  const [selectedId, setSelectedId] = useState<number>(rooms[0]?.id || 1);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [formData, setFormData] = useState<Room | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const selectedRoom = rooms.find((r) => r.id === selectedId) || rooms[0];

  useEffect(() => {
    if (selectedRoom) {
      setFormData({ ...selectedRoom });
      setIsEditing(false);
    }
  }, [selectedId, rooms]);

  // Tastaturnavigation in der Tabelle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; // Wenn im Formular getippt wird, Pfeiltasten im Input belassen

      const currentIndex = filteredRooms.findIndex((r) => r.id === selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < filteredRooms.length - 1) {
          setSelectedId(filteredRooms[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedId(filteredRooms[currentIndex - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isEditing, rooms, filterCategory]);

  const filteredRooms = rooms.filter((r) => {
    if (filterCategory === 'ALL') return true;
    if (filterCategory === 'DIRTY') return r.housekeepingStatus === 'dirty';
    return r.categoryCode === filterCategory;
  });

  const handleToggleCleaning = async () => {
    if (!selectedRoom) return;
    const nextStatus = selectedRoom.housekeepingStatus === 'clean' ? 'dirty' : 'clean';
    const updated = { ...selectedRoom, housekeepingStatus: nextStatus as any };
    await onUpdateRoom(updated);
  };

  const handleSave = async () => {
    if (!formData) return;
    await onUpdateRoom(formData);
    setIsEditing(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      {/* FILTER- & KOPFLEISTE */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Kategorie-Filter:</span>
          </div>
          <div className="flex items-center gap-1">
            {['ALL', 'DZ', 'EZ', 'TBZ', 'SUITE', 'DIRTY'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-[#376189] text-white font-semibold'
                    : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                {cat === 'ALL' && 'Alle Zimmer'}
                {cat === 'DIRTY' && '⚠️ Nur Schmutzig'}
                {cat !== 'ALL' && cat !== 'DIRTY' && cat}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Zeilen: {filteredRooms.length} von {rooms.length} | Pfeiltasten ↑ / ↓ zur Navigation
        </div>
      </div>

      {/* 1. MASTER: TABELLE OBERE HÄLFTE */}
      <div 
        ref={tableRef}
        className="flex-1 bg-white border-b border-slate-300 overflow-auto min-h-0 focus:outline-hidden"
        tabIndex={0}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
            <tr>
              <th className="py-1.5 px-3 border-r border-slate-300 w-16">Code</th>
              <th className="py-1.5 px-3 border-r border-slate-300">Zimmerbezeichnung</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Kategorie</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-28">Basispreis (Brutto)</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-32">Gebäude</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-36">Housekeeping</th>
              <th className="py-1.5 px-3">Besonderer Hinweis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {filteredRooms.map((room) => {
              const isSelected = selectedId === room.id;
              const isDirty = room.housekeepingStatus === 'dirty';

              return (
                <tr
                  key={room.id}
                  onClick={() => setSelectedId(room.id)}
                  onDoubleClick={handleToggleCleaning}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[#376189] text-white font-semibold'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{room.roomCode}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50 font-sans">{room.name}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50">{room.categoryCode}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50">{(Number(room.basePrice) || 0).toFixed(2)} €</td>
                  <td className="py-1 px-3 border-r border-slate-200/50 font-sans">{room.floor}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : isDirty
                          ? 'bg-[#fcf3e6] text-[#8c5820] border border-[#eed19a]'
                          : 'bg-[#edf6f1] text-[#285740] border border-[#b7dec9]'
                      }`}
                    >
                      {isDirty ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-[#cf8232]" />
                          <span>Dirty (Reinigung)</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 text-[#397356]" />
                          <span>Sauber (Gästefertig)</span>
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-1 px-3 font-sans italic">
                    {room.specialCleaningNote || '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. DETAIL: FORMULAR UNTERE HÄLFTE */}
      <div className="min-h-[16rem] bg-white border-t border-slate-300 p-3.5 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <DoorClosed className="w-4 h-4 text-[#376189]" />
              <span>
                Zimmerdetails & Housekeeping:{' '}
                {selectedRoom ? `[${selectedRoom.roomCode}] ${selectedRoom.name}` : ''}
              </span>
            </span>
            {isEditing && (
              <span className="bg-amber-500 text-white text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                Bearbeitungsmodus
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleCleaning}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Reinigungszustand umschalten"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Status umschalten (Doppelklick)</span>
            </button>
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-bold">
              ID: {selectedRoom?.id} | Sort: {selectedRoom?.sortOrder}
            </span>
          </div>
        </div>

        {formData ? (
          <div className="grid grid-cols-4 gap-3.5 text-xs flex-1">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ZIMMERCODE</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formData.roomCode}
                onChange={(e) => setFormData({ ...formData, roomCode: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ZIMMERBEZEICHNUNG</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-bold text-slate-900 disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">KATEGORIE / NAME</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 font-medium disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">BASISPREIS PRO NACHT (€)</label>
              <input
                type="number"
                step="0.5"
                disabled={!isEditing}
                value={formData.basePrice}
                onChange={(e) => setFormData({ ...formData, basePrice: parseFloat(e.target.value) || 0 })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-emerald-800 disabled:bg-slate-100 shadow-2xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">BETTEN</label>
              <input
                type="number"
                disabled={!isEditing}
                value={formData.baseBeds}
                onChange={(e) => setFormData({ ...formData, baseBeds: parseInt(e.target.value) || 1 })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 font-semibold disabled:bg-slate-100 shadow-2xs"
                placeholder="Betten"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">GEBÄUDE</label>
              <select
                disabled={!isEditing}
                value={formData.floor === 'Nebengebäude' ? 'Nebengebäude' : 'Hauptgebäude'}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 disabled:bg-slate-100 cursor-pointer shadow-2xs"
              >
                <option value="Hauptgebäude">Hauptgebäude</option>
                <option value="Nebengebäude">Nebengebäude</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">REINIGUNGSZUSTAND</label>
              <select
                disabled={!isEditing}
                value={formData.housekeepingStatus}
                onChange={(e) => setFormData({ ...formData, housekeepingStatus: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 disabled:bg-slate-100 shadow-2xs"
              >
                <option value="clean">Sauber (Gästefertig)</option>
                <option value="dirty">Dirty (Reinigung ausstehend)</option>
                <option value="maintenance">Wartung / Gesperrt</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">SONDERHINWEIS HOUSEKEEPING</label>
              <input
                type="text"
                disabled={!isEditing}
                value={formData.specialCleaningNote || ''}
                onChange={(e) => setFormData({ ...formData, specialCleaningNote: e.target.value })}
                placeholder="z. B. Keine Wäsche"
                className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 italic disabled:bg-slate-100 shadow-2xs"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* 3. FOOTER-AKTIONEN */}
      <ActionBar
        isEditing={isEditing}
        onEdit={() => {
          if (isEditing) {
            handleSave();
          } else {
            setIsEditing(true);
          }
        }}
        onClose={() => {
          if (isEditing) {
            setFormData(selectedRoom ? { ...selectedRoom } : null);
            setIsEditing(false);
          }
        }}
        onSelect={handleToggleCleaning}
        selectLabel="[F6] Status wechseln"
        editLabel="[F9] Ändern"
      />
    </div>
  );
};
