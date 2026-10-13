import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Guest, Salutation } from '../../types';
import { ActionBar } from '../ActionBar';
import { 
  Users, Search, Star, ShieldAlert, CheckCircle, 
  MapPin, Phone, Mail, CreditCard, Building, Calendar, IdCard, Filter 
} from 'lucide-react';

interface GuestsViewProps {
  guests: Guest[];
  salutations: Salutation[];
  onSaveGuest: (guest: Partial<Guest>) => Promise<void>;
  onDeleteGuest: (id: number) => Promise<void>;
  onSelectGuest?: (guest: Guest) => void;
}

export const GuestsView: React.FC<GuestsViewProps> = ({
  guests,
  salutations,
  onSaveGuest,
  onDeleteGuest,
  onSelectGuest,
}) => {
  const [selectedId, setSelectedId] = useState<number | null>(guests[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'REGULAR' | 'TAX_EXEMPT'>('ALL');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<Guest>>({});
  const tableContainerRef = useRef<HTMLDivElement>(null);

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

  // Filtered guests
  const filteredGuests = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return guests.filter((g) => {
      // Filter tab
      if (filterMode === 'REGULAR' && !g.isRegularGuest) return false;
      if (filterMode === 'TAX_EXEMPT' && !g.isTaxExempt) return false;

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

  // Keyboard navigation through table
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditing) return; // Do not intercept while typing in inputs

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
        if (selectedGuest && onSelectGuest) {
          onSelectGuest(selectedGuest);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredGuests, selectedId, isEditing, selectedGuest, onSelectGuest]);

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
      isTaxExempt: false,
      taxExemptReason: '',
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

    await onSaveGuest(payload);
    setIsEditing(false);
    setIsNew(false);
  };

  const handleDelete = async () => {
    if (!selectedGuest) return;
    const confirm = window.confirm(
      `Möchten Sie den Gast "${selectedGuest.firstName} ${selectedGuest.lastName}" (Nr: ${selectedGuest.guestNumber}) wirklich löschen?`
    );
    if (confirm) {
      await onDeleteGuest(selectedGuest.id);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsNew(false);
    if (selectedGuest) {
      setFormData({ ...selectedGuest });
    }
  };

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

          {/* Filter-Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'ALL'
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              Alle Gäste ({guests.length})
            </button>
            <button
              onClick={() => setFilterMode('REGULAR')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'REGULAR'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Stammgäste</span>
            </button>
            <button
              onClick={() => setFilterMode('TAX_EXEMPT')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                filterMode === 'TAX_EXEMPT'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <ShieldAlert className="w-3 h-3 text-emerald-500" />
              <span>City-Tax Befreit</span>
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
              <th className="py-1.5 px-3 border-r border-slate-300 w-24 text-center">Stammgast</th>
              <th className="py-1.5 px-3 w-28 text-center">City-Tax</th>
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
                    onDoubleClick={() => onSelectGuest && onSelectGuest(guest)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
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
                          isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                        }`}>
                          <Star className="w-2.5 h-2.5 fill-current" />
                          <span>Ja</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-1 px-3 text-center font-sans">
                      {guest.isTaxExempt ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          Befreit
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Normal (5%)</span>
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
      <div className="h-64 bg-white border-t border-slate-300 p-2.5 shrink-0 flex flex-col justify-between overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 pb-1 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Gästestamm-Detailmaske (Meldeschein & Adresse):</span>
              <strong className="text-blue-700">
                {formData.firstName || formData.lastName
                  ? `${formData.salutation || ''} ${formData.firstName || ''} ${formData.lastName || ''}`.trim()
                  : 'Neuer Gast'}
              </strong>
            </span>
            {isEditing && (
              <span className="bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase animate-pulse">
                {isNew ? 'Neuanlage' : 'Bearbeitungsmodus'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              Gast-Nr: <strong>{formData.guestNumber || 'Neu'}</strong>
            </span>
            {selectedGuest && !isEditing && (
              <span className="text-xs text-slate-400 font-mono">
                ID: {selectedGuest.id}
              </span>
            )}
          </div>
        </div>

        {/* EINGABEFELDER-GRID */}
        <div className="grid grid-cols-6 gap-2 text-xs flex-1">
          {/* ZEILE 1: Anrede, Suchname, Stammgast */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Anrede</label>
            <select
              disabled={!isEditing}
              value={formData.salutation || 'Sehr geehrter Herr'}
              onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs disabled:bg-slate-100"
            >
              <option value="Sehr geehrter Herr">Herr</option>
              <option value="Sehr geehrte Frau">Frau</option>
              <option value="Sehr geehrte Familie">Familie</option>
              <option value="Sehr geehrte Damen und Herren">Firma</option>
              <option value="Herr Dr.">Herr Dr.</option>
              <option value="Frau Dr.">Frau Dr.</option>
            </select>
          </div>

          <div className="col-span-2 flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Suchname (Schnellsuche)</label>
            <input
              type="text"
              disabled={!isEditing}
              placeholder="z.B. Müller, Thomas"
              value={formData.searchName || ''}
              onChange={(e) => setFormData({ ...formData, searchName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 font-medium"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Telefon</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Festnetz / Mobil"
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="col-span-2 flex items-center justify-between gap-2 pt-3">
            {/* Stammgast Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-2 py-1 rounded border border-slate-200">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={!!formData.isRegularGuest}
                onChange={(e) => setFormData({ ...formData, isRegularGuest: e.target.checked })}
                className="w-3.5 h-3.5 text-amber-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Stammgast</span>
              </span>
            </label>

            {/* City-Tax Befreit Checkbox */}
            <label className="flex items-center gap-1.5 cursor-pointer bg-slate-50 px-2 py-1 rounded border border-slate-200">
              <input
                type="checkbox"
                disabled={!isEditing}
                checked={!!formData.isTaxExempt}
                onChange={(e) => setFormData({ ...formData, isTaxExempt: e.target.checked })}
                className="w-3.5 h-3.5 text-emerald-600 rounded"
              />
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                <span>City-Tax Befreit</span>
              </span>
            </label>
          </div>

          {/* ZEILE 2: Nachname, Vorname, Firma, Vorname 2 */}
          <div className="col-span-2 flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Nachname *</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.lastName || ''}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-bold disabled:bg-slate-100"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Vorname *</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.firstName || ''}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 font-medium"
            />
          </div>

          <div className="col-span-2 flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Firma / Name 2</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.name2 || ''}
              onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
              placeholder="Firmenname (optional)"
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          {/* ZEILE 3: Straße, Hausnummer, PLZ, Ort, Land */}
          <div className="col-span-2 flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Straße</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.street || ''}
              onChange={(e) => setFormData({ ...formData, street: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Hausnr.</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.houseNumber || ''}
              onChange={(e) => setFormData({ ...formData, houseNumber: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">PLZ</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.zipCode || ''}
              onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Ort</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100 font-medium"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Land</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.country || 'Deutschland'}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          {/* ZEILE 4: Meldeschein-Felder (Geburt, Nationalität, Ausweisnr, E-Mail, Zahlungsart, City-Tax Grund) */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Geburtsdatum</label>
            <input
              type="date"
              disabled={!isEditing}
              value={formData.birthDate || ''}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Nationalität</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.nationality || 'deutsch'}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Pass-/Ausweisnr.</label>
            <input
              type="text"
              disabled={!isEditing}
              value={formData.idCardNumber || ''}
              onChange={(e) => setFormData({ ...formData, idCardNumber: e.target.value })}
              placeholder="Ausländerpflicht BMG"
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">E-Mail</label>
            <input
              type="email"
              disabled={!isEditing}
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs disabled:bg-slate-100"
            />
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Zahlungsart</label>
            <select
              disabled={!isEditing}
              value={formData.paymentMethod || 'BAR'}
              onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs font-semibold disabled:bg-slate-100"
            >
              <option value="BAR">BAR</option>
              <option value="EC">EC-Karte</option>
              <option value="KREDIT">Kreditkarte</option>
              <option value="RECHNUNG">Rechnung / Überweisung</option>
            </select>
          </div>

          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">City-Tax Befreiungsgrund</label>
            <select
              disabled={!isEditing || !formData.isTaxExempt}
              value={formData.taxExemptReason || ''}
              onChange={(e) => setFormData({ ...formData, taxExemptReason: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-xs disabled:bg-slate-100"
            >
              <option value="">Keiner</option>
              <option value="beruflich">Beruflich veranlasst</option>
              <option value="minderjaehrig">Minderjährig (&lt; 18 Jahre)</option>
              <option value="schwerbehindert">Schwerbehindert (GdB ≥ 80)</option>
              <option value="medizinisch">Medizinisch zwingend</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. AKTIONEN: STANDARD-AKTIONLEISTE (F6-F9, Esc, Entf) */}
      <ActionBar
        isEditing={isEditing}
        onSelect={() => {
          if (selectedGuest && onSelectGuest) {
            onSelectGuest(selectedGuest);
          }
        }}
        selectLabel={onSelectGuest ? '[F6] Gast auswählen' : '[F6] Übernehmen'}
        canSelect={!!selectedGuest}
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
    </div>
  );
};
