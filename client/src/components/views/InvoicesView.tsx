import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, ShieldCheck, Printer, Code, 
  CreditCard, CheckCircle2, Building, User, Layers, RefreshCw,
  Search, Plus, Trash2, Calendar, BedDouble, Edit3, Eye, Download,
  Check, Save, ArrowUpDown, DollarSign, HeartHandshake, HelpCircle
} from 'lucide-react';
import type { Reservation, Room, Guest, Invoice } from '../../types';
import { 
  type InvoiceLineItem, 
  calculateSplitTax, 
  roundToCent 
} from '../../services/taxEngine';
import { 
  generateInvoiceFromReservation, 
  recalculateInvoiceTotals, 
  DEFAULT_CLOSING_TEXT 
} from '../../services/invoiceGenerator';
import { InvoicePdfDocument } from '../pdf/InvoicePdfDocument';
import { ActionBar } from '../ActionBar';

interface InvoicesViewProps {
  invoices: Invoice[];
  reservations: Reservation[];
  rooms: Room[];
  guests: Guest[];
  onSaveInvoice: (invoice: Invoice) => Promise<void> | void;
  onRefresh: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  reservations,
  rooms,
  guests,
  onSaveInvoice,
  onRefresh,
}) => {
  // 1. STATE: Selektierte Reservierung
  const [selectedResId, setSelectedResId] = useState<number>(() => {
    return reservations[0]?.id || 1;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'paid'>('all');
  const [viewMode, setViewMode] = useState<'edit' | 'pdf'>('edit');
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Gefilterte Buchungen für die Master-Liste links
  const filteredReservations = useMemo(() => {
    return reservations.filter((res) => {
      const guest = res.guest || guests.find((g) => g.id === res.guestId);
      const room = res.room || rooms.find((r) => r.id === res.roomId);
      const guestName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.toLowerCase();
      const roomName = (room?.name || '').toLowerCase();
      const resNum = (res.reservationNumber || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || guestName.includes(q) || roomName.includes(q) || resNum.includes(q);
      if (!matchesSearch) return false;

      // Statusprüfung
      const matchingInv = invoices.find((inv) => inv.reservationId === res.id);
      const isPaid = matchingInv ? matchingInv.isPaid : false;

      if (statusFilter === 'open' && isPaid) return false;
      if (statusFilter === 'paid' && !isPaid) return false;

      return true;
    });
  }, [reservations, guests, rooms, searchQuery, statusFilter, invoices]);

  // Aktive Reservierung ermitteln
  const activeReservation = useMemo(() => {
    return reservations.find((r) => r.id === selectedResId) || reservations[0] || null;
  }, [reservations, selectedResId]);

  // 2. STATE: Aktuelle Rechnung im Bearbeitungsmodus
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);

  // Synchronisiere currentInvoice, wenn sich die gewählte Reservierung ändert
  useEffect(() => {
    if (!activeReservation) return;

    // Prüfe, ob bereits eine gespeicherte Rechnung für diese Reservierung vorliegt
    const existing = invoices.find((inv) => inv.reservationId === activeReservation.id);
    const generated = generateInvoiceFromReservation(
      activeReservation, 
      existing, 
      guests, 
      rooms
    );

    setCurrentInvoice(generated);
  }, [activeReservation, invoices, guests, rooms]);

  // Tastaturnavigation in der Reservierungsliste (Pfeiltasten ↑ / ↓)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Nicht reagieren, wenn in Textfeldern getippt wird
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        if (e.key === 'F9') {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const curIdx = filteredReservations.findIndex((r) => r.id === selectedResId);
        if (curIdx < filteredReservations.length - 1) {
          setSelectedResId(filteredReservations[curIdx + 1].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const curIdx = filteredReservations.findIndex((r) => r.id === selectedResId);
        if (curIdx > 0) {
          setSelectedResId(filteredReservations[curIdx - 1].id);
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        setViewMode('pdf');
        setTimeout(() => window.print(), 200);
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredReservations, selectedResId, currentInvoice]);

  // Hilfsfunktion: Positionen im Invoice aktualisieren und Summen neu berechnen
  const updateItems = (newItems: InvoiceLineItem[]) => {
    if (!currentInvoice) return;
    const totals = recalculateInvoiceTotals(newItems);
    setCurrentInvoice({
      ...currentInvoice,
      items: newItems,
      netLodging: totals.netLodging,
      taxLodging: totals.taxLodging,
      netService: totals.netService,
      taxService: totals.taxService,
      cityTaxAmount: totals.cityTaxAmount,
      totalGross: totals.totalGross,
    });
  };

  // Position hinzufügen
  const handleAddItem = (preset?: { desc: string; price: number; taxRate: 0.07 | 0.19 | 0.0 }) => {
    if (!currentInvoice) return;
    const currentItems = currentInvoice.items || [];
    const nextPosNum = currentItems.length + 1;

    const newItem: InvoiceLineItem = {
      id: Date.now(),
      positionNumber: nextPosNum,
      folioBucket: 'A',
      description: preset?.desc || 'Zusatzleistung / Bewirtung',
      roomCode: currentInvoice.roomCode || '',
      quantity: 1,
      unitPriceGross: preset?.price || 15.00,
      totalGross: preset?.price || 15.00,
      taxRate: preset?.taxRate ?? 0.19,
      taxCode: preset?.taxRate === 0.07 ? 2 : preset?.taxRate === 0.0 ? 0 : 1,
      taxType: preset?.taxRate === 0.07 ? 'LODGING' : preset?.taxRate === 0.0 ? 'CITY_TAX' : 'SERVICE',
      dateFrom: currentInvoice.servicePeriodStart,
      dateTo: currentInvoice.servicePeriodEnd,
      infoNote: '',
    };

    updateItems([...currentItems, newItem]);
  };

  // Position entfernen
  const handleRemoveItem = (index: number) => {
    if (!currentInvoice) return;
    const currentItems = currentInvoice.items || [];
    const updated = currentItems.filter((_, idx) => idx !== index).map((it, idx) => ({
      ...it,
      positionNumber: idx + 1,
    }));
    updateItems(updated);
  };

  // Einzelne Eigenschaft einer Position bearbeiten
  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    if (!currentInvoice) return;
    const currentItems = [...(currentInvoice.items || [])];
    const targetItem = { ...currentItems[index] };

    if (field === 'quantity') {
      const q = Math.max(0, Number(value) || 0);
      targetItem.quantity = q;
      targetItem.totalGross = roundToCent(q * targetItem.unitPriceGross);
    } else if (field === 'unitPriceGross') {
      const p = Math.max(0, Number(value) || 0);
      targetItem.unitPriceGross = p;
      targetItem.totalGross = roundToCent(targetItem.quantity * p);
    } else if (field === 'taxRate') {
      const r = Number(value) as 0.07 | 0.19 | 0.0;
      targetItem.taxRate = r;
      targetItem.taxCode = r === 0.07 ? 2 : r === 0.0 ? 0 : 1;
      targetItem.taxType = r === 0.07 ? 'LODGING' : r === 0.0 ? 'CITY_TAX' : 'SERVICE';
    } else {
      (targetItem as any)[field] = value;
    }

    currentItems[index] = targetItem;
    updateItems(currentItems);
  };

  // Speichern
  const handleSave = async () => {
    if (!currentInvoice) return;
    try {
      await onSaveInvoice(currentInvoice);
      setSaveSuccessMsg(`Rechnung ${currentInvoice.invoiceNumber} erfolgreich gespeichert!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Fehler beim Speichern der Rechnung:', err);
    }
  };

  // ZUGFeRD / Factur-X XML Vorschau
  const generateZugferdXmlPreview = () => {
    if (!currentInvoice) return '';
    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:comfort</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${currentInvoice.invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${currentInvoice.invoiceDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <!-- Steuernachweis nach deutschem Steuerrecht (§ 14 UStG) -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:TaxCurrencyCode>EUR</ram:TaxCurrencyCode>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <!-- Logis 7% USt -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${currentInvoice.taxLodging.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${currentInvoice.netLodging.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>7.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <!-- F&B / Service 19% USt -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${currentInvoice.taxService.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${currentInvoice.netService.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <!-- Gästetaxe Kurort Jonsdorf 0% USt -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${currentInvoice.cityTaxAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>O</ram:CategoryCode>
        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${(currentInvoice.netLodging + currentInvoice.netService + currentInvoice.cityTaxAmount).toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${(currentInvoice.taxLodging + currentInvoice.taxService).toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${currentInvoice.totalGross.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${currentInvoice.totalGross.toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      
      {/* 1. KOPFZEILE */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-blue-600" />
            <span>Kasse & Rechnungsverwaltung (Hotel Lindengarten)</span>
          </span>
          <span className="bg-blue-100 text-blue-900 font-bold px-2 py-0.5 rounded text-[11px] border border-blue-200">
            {reservations.length} Zimmer belegt
          </span>
          {saveSuccessMsg && (
            <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-300 animate-in fade-in flex items-center gap-1">
              <Check className="w-3 h-3" />
              <span>{saveSuccessMsg}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 font-mono">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>KassenSichV: Fiskaly V2 aktiv</span>
          </span>
          <span>|</span>
          <span>E-Rechnung: EN 16931 / ZUGFeRD 2.0</span>
          <span>|</span>
          <button 
            onClick={() => setXmlPreviewOpen(true)}
            className="text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
          >
            <Code className="w-3 h-3" />
            <span>XML</span>
          </button>
        </div>
      </div>

      {/* 2. HAUPTBEREICH: MASTER-DETAIL SPLITSCREEN */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* LINKE SPALTE: GEBUCHTE ZIMMER & VORGÄNGE (MASTER) */}
        <div className="w-84 md:w-96 bg-white border-r border-slate-300 flex flex-col shrink-0 min-h-0 shadow-xs">
          
          {/* Header & Suchleiste */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gebuchte Zimmer & Belegungen</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredReservations.length} Treffer
              </span>
            </div>

            {/* Suchfeld */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Gast, Zimmer, Res-Nr. suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded pl-8 pr-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-blue-500"
              />
            </div>

            {/* Filter-Chips */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Alle ({reservations.length})
              </button>
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                  statusFilter === 'open'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Offen
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                  statusFilter === 'paid'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Bezahlt
              </button>
            </div>
          </div>

          {/* Buchungs-Liste */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredReservations.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs">
                Keine passenden Buchungen gefunden.
              </div>
            ) : (
              filteredReservations.map((res) => {
                const isSelected = selectedResId === res.id;
                const guest = res.guest || guests.find((g) => g.id === res.guestId);
                const room = res.room || rooms.find((r) => r.id === res.roomId);
                const guestFullName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || res.last_name || 'Gast';
                
                // Invoice lookup
                const inv = invoices.find((i) => i.reservationId === res.id);
                const isPaid = inv?.isPaid ?? false;
                const totalGross = inv?.totalGross ?? res.totalPrice ?? 85.0;

                return (
                  <div
                    key={res.id}
                    onClick={() => setSelectedResId(res.id)}
                    className={`p-2.5 cursor-pointer transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-blue-50 border-blue-600 shadow-inner'
                        : 'border-transparent hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'
                        }`}>
                          {room?.name || `Zimmer ${res.roomId}`}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          #{res.reservationNumber || res.id}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isPaid ? (
                          <>
                            <Check className="w-2.5 h-2.5" />
                            <span>Bezahlt</span>
                          </>
                        ) : (
                          <span>Offen</span>
                        )}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-xs truncate">
                      {guestFullName}
                      {guest?.name2 && <span className="text-slate-500 font-normal"> ({guest.name2})</span>}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                      <span className="font-mono">
                        {res.arrivalDate} bis {res.departureDate} ({res.nights} Ü)
                      </span>
                      <span className="font-bold font-mono text-slate-900 text-xs">
                        {totalGross.toFixed(2)} €
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Fußzeile der linken Spalte */}
          <div className="p-2 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between items-center">
            <span>Navigation: ↑ / ↓ Pfeiltasten</span>
            <span>[F6] PDF Drucken</span>
          </div>

        </div>

        {/* RECHTE SPALTE: RECHNUNGS-ZENTRALE & PDF-VORSCHAU (DETAIL) */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-100 overflow-hidden">
          
          {/* UMSCHALT-LEISTE OBEN */}
          <div className="bg-white border-b border-slate-300 px-3 py-2 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Rechnungsdaten bearbeiten</span>
              </button>

              <button
                onClick={() => setViewMode('pdf')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'pdf'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>DIN A4 PDF-Vorschau</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAddItem()}
                className="flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer shadow-xs"
                title="Position hinzufügen (F7)"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Position hinzufügen</span>
              </button>

              <button
                onClick={handleSave}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                title="Rechnung speichern (F9)"
              >
                <Save className="w-3.5 h-3.5" />
                <span>[F9] Speichern</span>
              </button>
            </div>
          </div>

          {/* INHALT DER RECHTEN SPALTE: EDIT-MODUS ODER PDF-VORSCHAU */}
          {!currentInvoice ? (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 italic text-sm">
              Wählen Sie links eine Buchung aus, um die Rechnung anzuzeigen.
            </div>
          ) : viewMode === 'pdf' ? (
            /* MODUS 1: DIN A4 PDF VORSCHAU */
            <div className="flex-1 overflow-auto p-4 bg-slate-300 flex justify-center">
              <InvoicePdfDocument
                invoice={currentInvoice}
                onPrint={() => window.print()}
                onDownloadPdf={() => window.print()}
              />
            </div>
          ) : (
            /* MODUS 2: RECHNUNG BEARBEITEN */
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
              
              {/* BLOCK 1: EMPFÄNGER, ANREDE & RECHNUNGSMETADATEN */}
              <div className="bg-white p-3 rounded border border-slate-300 shadow-xs grid grid-cols-12 gap-3 text-xs">
                
                {/* Spalte 1-7: Empfängeranschrift & Anrede */}
                <div className="col-span-12 md:col-span-7 flex flex-col gap-2.5 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rechnungsempfänger & Anschrift</span>
                    </span>
                    <span className="text-[10px] text-slate-400">DIN 5008 Adressfeld</span>
                  </div>

                  {/* Anrede-Auswahl */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-semibold uppercase">
                      Briefanrede *
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={
                          ['Sehr geehrter Herr', 'Sehr geehrte Frau', 'Sehr geehrte Familie', 'Sehr geehrte Damen und Herren'].includes(currentInvoice.recipientSalutation?.split(' ')[0] || '')
                            ? currentInvoice.recipientSalutation
                            : 'custom'
                        }
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            setCurrentInvoice({ ...currentInvoice, recipientSalutation: e.target.value });
                          }
                        }}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 w-44"
                      >
                        <option value={`Sehr geehrte Familie ${currentInvoice.recipientName?.split(' ').pop() || ''}`}>
                          Sehr geehrte Familie...
                        </option>
                        <option value={`Sehr geehrter Herr ${currentInvoice.recipientName?.split(' ').pop() || ''}`}>
                          Sehr geehrter Herr...
                        </option>
                        <option value={`Sehr geehrte Frau ${currentInvoice.recipientName?.split(' ').pop() || ''}`}>
                          Sehr geehrte Frau...
                        </option>
                        <option value="Sehr geehrte Damen und Herren">
                          Sehr geehrte Damen und Herren
                        </option>
                        <option value="custom">Eigener Text...</option>
                      </select>

                      <input
                        type="text"
                        value={currentInvoice.recipientSalutation || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientSalutation: e.target.value })}
                        placeholder="Anrede frei formulieren..."
                        className="flex-1 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-medium"
                      />
                    </div>
                  </div>

                  {/* Name & Firma */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Gastname *
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientName || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientName: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Firma / Name 2 (optional)
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientCompany || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientCompany: e.target.value })}
                        placeholder="z.B. Firmenübernahme"
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Straße, PLZ, Ort */}
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-6 flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Straße & Hausnr.
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientStreet || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientStreet: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                      />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        PLZ
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientZip || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientZip: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800 font-mono"
                      />
                    </div>

                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Ort
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientCity || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientCity: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                </div>

                {/* Spalte 8-12: Rechnungs-Kopfdaten */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-2.5">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Rechnungs-Stammdaten</span>
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Rechnungs-Nr.
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.invoiceNumber || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, invoiceNumber: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Rechnungsdatum
                      </label>
                      <input
                        type="date"
                        value={currentInvoice.invoiceDate || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, invoiceDate: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Anzahl Übernachtungen
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={currentInvoice.nights || 1}
                        onChange={(e) => {
                          const n = Math.max(1, Number(e.target.value) || 1);
                          setCurrentInvoice({ ...currentInvoice, nights: n });
                        }}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold text-blue-800"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Zimmer / Einheit
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={currentInvoice.roomName || ''}
                        className="bg-slate-100 border border-slate-200 rounded px-2 py-1 text-xs text-slate-600 font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase">
                        Zahlungsart
                      </label>
                      <select
                        value={currentInvoice.paymentMethod || 'BAR'}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, paymentMethod: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-semibold text-slate-800"
                      >
                        <option value="BAR">Barzahlung</option>
                        <option value="EC">EC-Karte (Maestro/Giro)</option>
                        <option value="KREDIT">Kreditkarte (Visa/MC)</option>
                        <option value="RECHNUNG">Auf Rechnung (Überweisung)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 justify-end">
                      <label className="flex items-center gap-2 p-1 bg-slate-50 border border-slate-200 rounded cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={currentInvoice.isPaid || false}
                          onChange={(e) => setCurrentInvoice({ ...currentInvoice, isPaid: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <span className="font-bold text-xs text-slate-800">Rechnung bezahlt</span>
                      </label>
                    </div>
                  </div>

                </div>

              </div>

              {/* BLOCK 2: AUFGESCHLÜSSELTE POSITIONEN-TABELLE */}
              <div className="bg-white rounded border border-slate-300 shadow-xs flex flex-col overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800 text-xs">
                      Aufgeschlüsselte Rechnungspositionen
                    </span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                      {(currentInvoice.items || []).length} Position(en)
                    </span>
                  </div>

                  {/* Schnell-Presets zum Einfügen */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-500 text-[10px]">Schnellposten:</span>
                    <button
                      onClick={() => handleAddItem({ desc: 'Parkplatz', price: 5.00, taxRate: 0.19 })}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 cursor-pointer"
                    >
                      + Parkplatz (5€)
                    </button>
                    <button
                      onClick={() => handleAddItem({ desc: 'Minibar / Getränke', price: 12.50, taxRate: 0.19 })}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 cursor-pointer"
                    >
                      + Minibar (12,50€)
                    </button>
                    <button
                      onClick={() => handleAddItem({ desc: 'Gästetaxe Kurort Jonsdorf', price: 2.90, taxRate: 0.00 })}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 cursor-pointer"
                    >
                      + Gästetaxe Jonsdorf
                    </button>
                  </div>
                </div>

                {/* Tabelle der Positionen */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="py-1.5 px-2 w-10 text-center">Pos.</th>
                        <th className="py-1.5 px-2">Leistungsbeschreibung / Information</th>
                        <th className="py-1.5 px-2 w-20 text-center">Menge</th>
                        <th className="py-1.5 px-2 w-28 text-right">Einzelpreis (€)</th>
                        <th className="py-1.5 px-2 w-28 text-center">USt-Satz</th>
                        <th className="py-1.5 px-2 w-28 text-right">Gesamt (€)</th>
                        <th className="py-1.5 px-2 w-12 text-center">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(currentInvoice.items || []).map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-2 text-center font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-800"
                            />
                            <input
                              type="text"
                              placeholder="Zusatzinfo (optional)..."
                              value={item.infoNote || ''}
                              onChange={(e) => handleItemChange(idx, 'infoNote', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-0.5 text-[10px] text-slate-500 mt-0.5 italic"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-16 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center font-mono font-bold"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unitPriceGross}
                              onChange={(e) => handleItemChange(idx, 'unitPriceGross', e.target.value)}
                              className="w-24 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-right font-mono"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <select
                              value={item.taxRate}
                              onChange={(e) => handleItemChange(idx, 'taxRate', Number(e.target.value))}
                              className="bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono font-semibold"
                            >
                              <option value={0.07}>7 % (Logis)</option>
                              <option value={0.19}>19 % (Service)</option>
                              <option value={0.00}>0 % (Gästetaxe)</option>
                            </select>
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 text-xs">
                            {(Number(item.totalGross) || 0).toFixed(2)} €
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <button
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                              title="Position löschen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Fußzeile mit Summen-Zusammenfassung */}
                <div className="bg-slate-50 border-t border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono shrink-0">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-600">
                      Netto Logis (7%): <strong>{currentInvoice.netLodging.toFixed(2)} €</strong> (USt: {currentInvoice.taxLodging.toFixed(2)} €)
                    </span>
                    <span>|</span>
                    <span className="text-slate-600">
                      Netto Service (19%): <strong>{currentInvoice.netService.toFixed(2)} €</strong> (USt: {currentInvoice.taxService.toFixed(2)} €)
                    </span>
                    <span>|</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Gästetaxe Jonsdorf: {currentInvoice.cityTaxAmount.toFixed(2)} €
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      Rechnungsbetrag Brutto:
                    </span>
                    <span className="text-base font-extrabold text-blue-900 bg-blue-50 px-3 py-1 rounded border border-blue-200">
                      {currentInvoice.totalGross.toFixed(2)} €
                    </span>
                  </div>
                </div>
              </div>

              {/* BLOCK 3: PERSÖNLICHE GRUSSFORMEL / SCHLUSSTEXT */}
              <div className="bg-white p-3 rounded border border-slate-300 shadow-xs flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <HeartHandshake className="w-4 h-4 text-rose-500" />
                    <span>Persönlicher Schlusstext / Danksagung auf der Rechnung</span>
                  </span>
                  <button
                    onClick={() => setCurrentInvoice({ ...currentInvoice, closingText: DEFAULT_CLOSING_TEXT })}
                    className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                  >
                    Standardtext wiederherstellen
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={currentInvoice.closingText || ''}
                  onChange={(e) => setCurrentInvoice({ ...currentInvoice, closingText: e.target.value })}
                  placeholder="z. B. Vielen Dank für Ihren Aufenthalt und beehren Sie uns gerne wieder!"
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-xs text-slate-800 focus:outline-blue-500 font-medium leading-relaxed"
                />

                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span>Vorschlagsvorlagen:</span>
                  <button
                    onClick={() => setCurrentInvoice({
                      ...currentInvoice,
                      closingText: 'Vielen Dank für Ihren Besuch im Hotel Lindengarten! Wir wünschen Ihnen eine gute Heimreise und freuen uns auf ein baldiges Wiedersehen.'
                    })}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    Erholungsurlaub
                  </button>
                  <button
                    onClick={() => setCurrentInvoice({
                      ...currentInvoice,
                      closingText: 'Herzlichen Dank für Ihre Treue zu unserem Haus! Als Stammgast schätzen wir Ihren Besuch sehr und beehren Sie uns bald wieder.'
                    })}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    Stammgast
                  </button>
                  <button
                    onClick={() => setCurrentInvoice({
                      ...currentInvoice,
                      closingText: 'Vielen Dank für die angenehme Zusammenarbeit und Ihren Aufenthalt. Beehren Sie uns gerne wieder bei Ihrer nächsten Reise.'
                    })}
                    className="bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded text-slate-700 cursor-pointer"
                  >
                    Geschäftsreise
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

      {/* 3. FUSSZEILE: AKTIONEN & TASTEN (ActionBar) */}
      <ActionBar
        onSelect={() => {
          setViewMode('pdf');
          setTimeout(() => window.print(), 150);
        }}
        selectLabel="[F6] PDF Drucken / Vorschau"
        onNew={() => handleAddItem()}
        onCopy={() => setXmlPreviewOpen(true)}
        canCopy={true}
        onEdit={handleSave}
        canEdit={true}
        editLabel="[F9] Speichern"
        canDelete={false}
      />

      {/* MODAL: ZUGFeRD 2.0 / Factur-X XML VORSCHAU */}
      {xmlPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-2xl border border-slate-400 w-full max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
            <div className="bg-slate-800 text-white px-3 py-2 flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">
                  ZUGFeRD 2.0.1 / Factur-X EN 16931 XML Vorschau [Rech-Nr: {currentInvoice?.invoiceNumber}]
                </span>
              </div>
              <button
                onClick={() => setXmlPreviewOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                ✕ Schließen
              </button>
            </div>

            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-auto flex-1 whitespace-pre leading-relaxed">
              {generateZugferdXmlPreview()}
            </div>

            <div className="bg-slate-100 p-2 border-t border-slate-300 flex justify-between items-center text-xs">
              <span className="text-slate-500">
                Konform zu EN 16931 und Wachstumschancengesetz ab 2025
              </span>
              <button
                onClick={() => setXmlPreviewOpen(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded font-bold cursor-pointer"
              >
                Schließen [Esc]
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
