import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Guest, Salutation } from '../../types';
import { ActionBar } from '../ActionBar';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';
import { 
  Users, Search, Star, CheckCircle, 
  MapPin, Phone, Mail, CreditCard, Building, Calendar, IdCard, Filter, FileText 
} from 'lucide-react';
import { MeldescheinPdfDocument } from '../pdf/MeldescheinPdfDocument';

interface GuestsViewProps {
  guests: Guest[];
  salutations: Salutation[];
  onSaveGuest: (guest: Partial<Guest>) => Promise<Guest | void>;
  onDeleteGuest: (id: number) => Promise<void>;
  onCreateBookingForGuest?: (guest: Guest) => void;
  onSelectGuest?: (guest: Guest) => void;
}

export const GuestsView: React.FC<GuestsViewProps> = ({
  guests,
  salutations,
  onSaveGuest,
  onDeleteGuest,
  onCreateBookingForGuest,
  onSelectGuest,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(guests[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'REGULAR'>('ALL');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Guest>>({});
  const [guestToDelete, setGuestToDelete] = useState<Guest | null>(null);
  const [meldescheinGuest, setMeldescheinGuest] = useState<Guest | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const lastNameInputRef = useRef<HTMLInputElement>(null);

  // Sync selected guest
  useEffect(() => {
    if (!selectedId && guests.length > 0) {
      setSelectedId(guests[0].id);
    }
  }, [guests, selectedId]);

  const selectedGuest = useMemo(() => {
    return guests.find((g) => g.id === selectedId) || guests[0] || null;
  }, [guests, selectedId]);

  useEffect(() => {
    if (!isNew && selectedGuest) {
      setFormData({ ...selectedGuest });
      setIsEditing(false);
    }
  }, [selectedGuest, isNew]);

  // Fokus auf Nachname beim Start des Bearbeitens / Neuanlegens
  useEffect(() => {
    if (isEditing) {
      const timer = setTimeout(() => {
        lastNameInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isEditing]);

  // Filtered guests
  const filteredGuests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return guests.filter((g) => {
      // Filter tab
      if (filterMode === 'REGULAR' && !g.isRegularGuest) return false;

      // Text search
      if (!q) return true;
      const matchSearchName = g.searchName?.toLowerCase().includes(q);
      const matchLast = g.lastName?.toLowerCase().includes(q);
      const matchFirst = g.firstName?.toLowerCase().includes(q);
      const matchFirm = g.name2?.toLowerCase().includes(q);
      const matchCity = g.city?.toLowerCase().includes(q);
      const matchNum = g.guestNumber?.toLowerCase().includes(q);
      const matchPhone = g.phone?.toLowerCase().includes(q);
      return matchSearchName || matchLast || matchFirst || matchFirm || matchCity || matchNum || matchPhone;
    });
  }, [guests, searchQuery, filterMode]);

  // Actions
  const handleStartNew = () => {
    setIsNew(true);
    setIsEditing(true);
    const nextNumber = `G-${new Date().getFullYear()}-${String(guests.length + 1).padStart(4, '0')}`;
    setFormData({
      guestNumber: nextNumber,
      searchName: '',
      titleCode: 1,
      salutation: 'Sehr geehrter Herr',
      lastName: '',
      firstName: '',
      name2: '',
      firstName2: '',
      careOf: '',
      street: '',
      houseNumber: '',
      zipCode: '',
      city: '',
      country: 'Deutschland',
      phone: '',
      email: '',
      fax: '',
      birthDate: '',
      nationality: 'deutsch',
      idCardNumber: '',
      paymentMethod: 'BAR',
      isRegularGuest: false,
      remarks: '',
      guestInfo: '',
    });
  };

  const handleStartCopy = () => {
    if (!selectedGuest) return;
    setIsNew(true);
    setIsEditing(true);
    const nextNumber = `G-${new Date().getFullYear()}-${String(guests.length + 1).padStart(4, '0')}`;
    setFormData({
      ...selectedGuest,
      id: undefined,
      guestNumber: nextNumber,
      searchName: `${selectedGuest.searchName || selectedGuest.lastName} (Kopie)`,
    });
  };

  const handleSave = async () => {
    if (!formData.lastName || !formData.firstName) {
      alert('Bitte geben Sie mindestens Vorname und Nachname des Gastes an.');
      return;
    }

    // Auto-create searchName if empty
    const payload = {
      ...formData,
      searchName: formData.searchName || `${formData.lastName}, ${formData.firstName}`,
    };

    const saved = await onSaveGuest(payload);
    setIsEditing(false);
    setIsNew(false);
    if (saved && (saved as Guest).id) {
      setSelectedId((saved as Guest).id);
    }
  };

  const handleDelete = () => {
    if (!selectedGuest || isEditing) return;
    setGuestToDelete(selectedGuest);
  };

  const confirmDelete = async () => {
    if (!guestToDelete) return;
    const targetId = guestToDelete.id;
    setGuestToDelete(null);
    await onDeleteGuest(targetId);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsNew(false);
    if (selectedGuest) {
      setFormData({ ...selectedGuest });
    }
  };

  // Keyboard navigation through table (wenn nicht in Eingabefeldern getippt wird)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (guestToDelete) return;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

      // Tastaturkürzel während der Bearbeitung
      if (isEditing) {
        if (e.key === 'F9') {
          e.preventDefault();
          handleSave();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
        }
        return;
      }

      if (isInput) return;

      const currentIndex = filteredGuests.findIndex((g) => g.id === selectedId);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < filteredGuests.length - 1) {
          setSelectedId(filteredGuests[currentIndex + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          setSelectedId(filteredGuests[currentIndex - 1].id);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setIsEditing(true);
      } else if (e.key === 'F6') {
        if (selectedGuest && onCreateBookingForGuest) {
          e.preventDefault();
          onCreateBookingForGuest(selectedGuest);
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleStartNew();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleStartCopy();
      } else if (e.key === 'F9') {
        e.preventDefault();
        setIsEditing(true);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        handleDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredGuests, selectedId, isEditing, selectedGuest, onCreateBookingForGuest, formData, guestToDelete]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      {/* 1. FILTER & SUCHE LEISTE */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          {/* Schnellsuchfeld */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
            <input
              type="text"
              placeholder="Gast suchen (Name, Nr, Ort, Firma)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-300 rounded pl-7 pr-2 py-0.5 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans"
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

          {/* Filter-Buttons (Matte Palette) */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-[#376189] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Alle Gäste ({guests.length})
            </button>
            <button
              onClick={() => setFilterMode('REGULAR')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'REGULAR'
                  ? 'bg-[#cf8232] text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <Star className="w-3 h-3 text-[#cf8232] fill-[#cf8232]" />
              <span>Stammgäste</span>
            </button>

          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Treffer: {filteredGuests.length} von {guests.length} | Pfeiltasten ↑ / ↓ | Enter = Wählen
        </div>
      </div>

      {/* 2. MASTER: GÄSTETABELLE (OBERER BEREICH) */}
      <div 
        ref={tableContainerRef}
        className="flex-1 bg-white border-b border-slate-300 overflow-auto min-h-0 focus:outline-hidden"
        tabIndex={0}
      >
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
            <tr>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Gastnr.</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-36">Suchname</th>
              <th className="py-1.5 px-3 border-r border-slate-300">Name, Vorname</th>
              <th className="py-1.5 px-3 border-r border-slate-300">Firma / Zusatz</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-44">PLZ, Ort</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-32">Telefon</th>
              <th className="py-1.5 px-3 w-24 text-center">Stammgast</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {filteredGuests.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 font-sans italic">
                  Keine Gäste gefunden, die den Filterkriterien entsprechen.
                </td>
              </tr>
            ) : (
              filteredGuests.map((guest) => {
                const isSelected = selectedId === guest.id;
                return (
                  <tr
                    key={guest.id}
                    onClick={() => {
                      if (!isEditing) {
                        setSelectedId(guest.id);
                        setIsNew(false);
                      }
                    }}
                    onDoubleClick={() => {
                      if (!isEditing) {
                        setSelectedId(guest.id);
                        setIsEditing(true);
                      }
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#376189] text-white font-semibold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{guest.guestNumber}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">{guest.searchName || '-'}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                      {guest.lastName}, {guest.firstName}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans text-slate-600">
                      {guest.name2 || '-'}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                      {guest.zipCode ? `${guest.zipCode} ${guest.city}` : guest.city || '-'}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50">{guest.phone || '-'}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 text-center font-sans">
                      {guest.isRegularGuest ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#fcf3e6] text-[#8c5820]'
                        }`}>
                          <Star className="w-2.5 h-2.5 fill-current text-[#cf8232]" />
                          <span>Ja</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 3. DETAIL: FORMULAR GÄSTE-STAMMDATEN (UNTERER SPLIT-SCREEN) */}
      <div className="min-h-[17.5rem] bg-white border-t border-slate-300 p-3 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#376189]" />
              <span>Gästestamm-Detailmaske (Meldeschein & Adresse):</span>
              <strong className="text-[#376189]">
                {formData.firstName || formData.lastName
                  ? `${formData.salutation || ''} ${formData.firstName || ''} ${formData.lastName || ''}`.trim()
                  : 'Neuer Gast'}
              </strong>
            </span>
            {isEditing && (
              <span className="bg-[#397356] text-white text-[11px] px-2.5 py-0.5 rounded font-bold uppercase tracking-wider animate-pulse">
                {isNew ? 'Neuanlage' : 'Bearbeitungsmodus'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {selectedGuest && !isEditing && (
              <button
                type="button"
                onClick={() => setMeldescheinGuest(selectedGuest)}
                className="flex items-center gap-1.5 bg-[#376189] hover:bg-[#2c4f70] text-white px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shadow-xs transition-colors"
                title="Amtlichen Meldeschein (§§ 29, 30 BMG) für diesen Gast öffnen & drucken"
              >
                <FileText className="w-3.5 h-3.5 text-amber-300" />
                <span>Meldeschein (DIN A4)</span>
              </button>
            )}
            <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 font-bold">
              Gast-Nr: <strong className="text-slate-900">{formData.guestNumber || 'Neu'}</strong>
            </span>
            {selectedGuest && !isEditing && (
              <span className="text-xs text-slate-500 font-mono">
                ID: {selectedGuest.id}
              </span>
            )}
          </div>
        </div>

        {/* EINGABEFELDER-GRID */}
        <div className="grid grid-cols-6 gap-2.5 text-xs flex-1">
          {/* ZEILE 1: Anrede, Suchname, Stammgast */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ANREDE</label>
            <select
              disabled={!isEditing}
              value={formData.salutation || 'Sehr geehrter Herr'}
              onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs md:text-[13px] font-medium text-slate-900 disabled:bg-slate-100 shadow-2xs"
            >
              <option value="Sehr geehrter Herr">Herr</option>
              <option value="Sehr geehrte Frau">Frau</option>
              <option value="Sehr geehrte Familie">Familie</option>
              <option value="Sehr geehrte Damen und Herren">Firma</option>
              <option value="Herr Dr.">Herr Dr.</option>
              <option value="Frau Dr.">Frau Dr.</option>
            </select>
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">SUCHNAME (SCHNELLSUCHE)</label>
            <input
              type="text"
              disabled={!isEditing}
              placeholder="z.B. Müller, Thomas"
              value={formData.searchName || ''}
              onChange={(e) => setFormData({ ...formData, searchName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] disabled:bg-slate-100 font-medium text-slate-900 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">TELEFON</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Festnetz / Mobil"
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="col-span-2 flex items-center justify-between gap-2 pt-4">
            {/* Stammgast Checkbox */}
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={!!formData.isRegularGuest}
                onChange={(e) => setFormData({ ...formData, isRegularGuest: e.target.checked })}
                className="w-4 h-4 text-amber-600 rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Stammgast</span>
              </span>
            </label>
          </div>

          {/* ZEILE 2: Nachname, Vorname, Firma, Vorname 2 */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
              NACHNAME <span className="text-rose-600 font-bold ml-1">*</span>
            </label>
            <input
              ref={lastNameInputRef}
              type="text"
              disabled={!isEditing}
              value={formData.lastName || ''}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-bold text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
              VORNAME <span className="text-rose-600 font-bold ml-1">*</span>
            </label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.firstName || ''}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] disabled:bg-slate-100 font-medium text-slate-900 shadow-2xs"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">FIRMA / NAME 2</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.name2 || ''}
              onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
              placeholder="Firmenname (optional)"
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          {/* ZEILE 3: Straße, Hausnummer, PLZ, Ort, Land */}
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">STRASSE</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.street || ''}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">HAUSNR.</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.houseNumber || ''}
              onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">PLZ</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.zipCode || ''}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ORT</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] disabled:bg-slate-100 font-medium text-slate-900 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">LAND</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.country || 'Deutschland'}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          {/* ZEILE 4: Meldeschein-Felder (Geburt, Nationalität, Ausweisnr, E-Mail, Zahlungsart, City-Tax Grund) */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">GEBURTSDATUM</label>
            <input
              type="date"
              disabled={!isEditing}
              value={formData.birthDate || ''}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs md:text-[13px] text-slate-900 font-mono disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">NATIONALITÄT</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.nationality || 'deutsch'}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">PASS-/AUSWEISNR.</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.idCardNumber || ''}
              onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
              placeholder="Ausländerpflicht BMG"
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">E-MAIL</label>
            <input
              type="email"
              disabled={!isEditing}
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 disabled:bg-slate-100 shadow-2xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">ZAHLUNGSART</label>
            <select
              disabled={!isEditing}
              value={formData.paymentMethod || 'BAR'}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 disabled:bg-slate-100 shadow-2xs"
            >
              <option value="BAR">BAR</option>
              <option value="EC">EC-Karte</option>
              <option value="KREDIT">Kreditkarte</option>
              <option value="RECHNUNG">Rechnung / Überweisung</option>
            </select>
          </div>


        </div>
      </div>

      {/* 4. AKTIONEN: STANDARD-AKTIONLEISTE (F6-F9, Esc, Entf) */}
      <ActionBar
        isEditing={isEditing}
        onSelect={() => {
          if (selectedGuest) {
            if (onCreateBookingForGuest) {
              onCreateBookingForGuest(selectedGuest);
            } else if (onSelectGuest) {
              onSelectGuest(selectedGuest);
            }
          }
        }}
        selectLabel={onCreateBookingForGuest ? '[F6] Neue Buchung mit diesem Gast' : onSelectGuest ? '[F6] Gast auswählen' : '[F6] Übernehmen'}
        canSelect={!isEditing && !!selectedGuest}
        onNew={handleStartNew}
        onCopy={handleStartCopy}
        onEdit={() => {
          if (isEditing) {
            handleSave();
          } else {
            setIsEditing(true);
          }
        }}
        editLabel="[F9] Ändern"
        onDelete={handleDelete}
        canDelete={!isEditing && !!selectedGuest}
        onClose={() => {
          if (isEditing) {
            handleCancel();
          }
        }}
      />

      {/* BESTÄTIGUNGSDIALOG LÖSCHEN */}
      <ConfirmDialog
        isOpen={!!guestToDelete}
        title="Gast wirklich löschen?"
        message={
          <>
            Möchten Sie den Gast{' '}
            <strong>
              {guestToDelete?.firstName} {guestToDelete?.lastName}
            </strong>{' '}
            wirklich unwiderruflich aus den Stammdaten löschen?
          </>
        }
        details={
          guestToDelete
            ? [
                { label: 'Gast-Nummer', value: guestToDelete.guestNumber || '-' },
                {
                  label: 'Name',
                  value: `${guestToDelete.salutation || ''} ${guestToDelete.firstName || ''} ${guestToDelete.lastName}`.trim(),
                },
                {
                  label: 'Ort / Adresse',
                  value:
                    [guestToDelete.street, guestToDelete.zipCode, guestToDelete.city]
                      .filter(Boolean)
                      .join(', ') || 'Keine Adresse hinterlegt',
                },
                ...(guestToDelete.name2
                  ? [{ label: 'Zusatz / Firma', value: guestToDelete.name2 }]
                  : []),
              ]
            : undefined
        }
        hint="Hinweis: Bereits erstellte Rechnungen und Buchungen dieses Gastes bleiben erhalten."
        confirmLabel="[Enter] Gast löschen"
        cancelLabel="[Esc] Abbrechen"
        danger={true}
        onConfirm={confirmDelete}
        onClose={() => setGuestToDelete(null)}
      />

      {/* MELDESCHEIN VORSCHAU MODAL */}
      {meldescheinGuest && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setMeldescheinGuest(null);
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="relative max-h-[92vh] overflow-y-auto">
            <MeldescheinPdfDocument
              guest={meldescheinGuest}
              onClose={() => setMeldescheinGuest(null)}
              onPrint={() => window.print()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
