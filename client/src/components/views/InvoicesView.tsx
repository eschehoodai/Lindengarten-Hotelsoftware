import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, ShieldCheck, Printer, Code, 
  CheckCircle2, User, 
  Search, Plus, Trash2, Calendar, BedDouble, Edit3, Eye,
  Check, Save, DollarSign, HeartHandshake,
  FilePlus2, ArrowRightLeft, Receipt, X
} from 'lucide-react';
import type { Reservation, Room, Guest, Invoice } from '../../types';
import { 
  type InvoiceLineItem, 
  roundToCent 
} from '../../services/taxEngine';
import { 
  generateInvoiceFromReservation, 
  createAdditionalInvoice,
  createFreeInvoice,
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
  onDeleteInvoice?: (id: number) => Promise<void> | void;
  onRefresh: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  reservations,
  rooms,
  guests,
  onSaveInvoice,
  onDeleteInvoice,
}) => {
  // 1. STATE: Selektion links (Buchung oder freie Kassenrechnung)
  const [selectedType, setSelectedType] = useState<'reservation' | 'freeInvoice'>('reservation');
  const [selectedResId, setSelectedResId] = useState<number | null>(() => reservations[0]?.id || 1);
  const [selectedFreeInvId, setSelectedFreeInvId] = useState<number | null>(null);

  // Rechnungs-Tab innerhalb der aktiven Buchung (Folio-Splitting A, B, ...)
  const [activeInvoiceId, setActiveInvoiceId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'partial' | 'paid' | 'free'>('all');
  const [viewMode, setViewMode] = useState<'edit' | 'pdf'>('edit');
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [moveDropdownPosIdx, setMoveDropdownPosIdx] = useState<number | null>(null);

  // Aktive Reservierung ermitteln
  const activeReservation = useMemo(() => {
    if (selectedType !== 'reservation' || !selectedResId) return null;
    return reservations.find((r) => r.id === selectedResId) || reservations[0] || null;
  }, [reservations, selectedType, selectedResId]);

  // Rechnungen für die aktive Reservierung
  const bookingInvoices = useMemo(() => {
    if (!activeReservation) return [];
    return invoices.filter((inv) => inv.reservationId === activeReservation.id);
  }, [invoices, activeReservation]);

  // Freie Kassenrechnungen (ohne Reservierungsbezug)
  const freeInvoices = useMemo(() => {
    return invoices.filter((inv) => !inv.reservationId);
  }, [invoices]);

  // Zähler für Filter-Badges
  const counts = useMemo(() => {
    let openCount = 0;
    let partialCount = 0;
    let paidCount = 0;

    reservations.forEach((res) => {
      const matchingInvs = invoices.filter((inv) => inv.reservationId === res.id);
      const hasInvs = matchingInvs.length > 0;
      const isFullyPaid = hasInvs && matchingInvs.every((inv) => inv.isPaid);
      const isPartiallyPaid = hasInvs && !isFullyPaid && matchingInvs.some((inv) => inv.isPaid);

      if (isFullyPaid) {
        paidCount++;
      } else if (isPartiallyPaid) {
        partialCount++;
      } else {
        openCount++;
      }
    });

    freeInvoices.forEach((inv) => {
      if (inv.isPaid) paidCount++;
      else openCount++;
    });

    return {
      all: reservations.length + freeInvoices.length,
      open: openCount,
      partial: partialCount,
      paid: paidCount,
      free: freeInvoices.length,
    };
  }, [reservations, freeInvoices, invoices]);

  // Gefilterte Buchungen für die Master-Liste links
  const filteredReservations = useMemo(() => {
    if (statusFilter === 'free') return [];
    return reservations.filter((res) => {
      const guest = res.guest || guests.find((g) => g.id === res.guestId);
      const room = res.room || rooms.find((r) => r.id === res.roomId);
      const guestName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.toLowerCase();
      const roomName = (room?.name || '').toLowerCase();
      const resNum = (res.reservationNumber || '').toLowerCase();
      const q = searchQuery.toLowerCase();

      const matchesSearch = !q || guestName.includes(q) || roomName.includes(q) || resNum.includes(q);
      if (!matchesSearch) return false;

      // Statusprüfung über alle Rechnungen dieser Buchung
      const matchingInvs = invoices.filter((inv) => inv.reservationId === res.id);
      const hasInvoices = matchingInvs.length > 0;
      const isFullyPaid = hasInvoices && matchingInvs.every((inv) => inv.isPaid);
      const isPartiallyPaid = hasInvoices && !isFullyPaid && matchingInvs.some((inv) => inv.isPaid);
      const isCompletelyOpen = !hasInvoices || matchingInvs.every((inv) => !inv.isPaid);

      if (statusFilter === 'open' && !isCompletelyOpen) return false;
      if (statusFilter === 'partial' && !isPartiallyPaid) return false;
      if (statusFilter === 'paid' && !isFullyPaid) return false;

      return true;
    });
  }, [reservations, guests, rooms, searchQuery, statusFilter, invoices]);

  // Gefilterte freie Kassenrechnungen
  const filteredFreeInvoices = useMemo(() => {
    return freeInvoices.filter((inv) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        (inv.recipientName || '').toLowerCase().includes(q) || 
        (inv.invoiceNumber || '').toLowerCase().includes(q) ||
        (inv.recipientCompany || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (statusFilter === 'open' && inv.isPaid) return false;
      if (statusFilter === 'partial') return false; // Freie Kassenbelege sind entweder ganz bezahlt oder offen
      if (statusFilter === 'paid' && !inv.isPaid) return false;

      return true;
    });
  }, [freeInvoices, searchQuery, statusFilter]);

  // 2. STATE: Aktuelle Rechnung im Bearbeitungsmodus
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);

  // Synchronisiere currentInvoice, wenn sich Selektion oder Rechnungen ändern
  useEffect(() => {
    if (selectedType === 'freeInvoice' && selectedFreeInvId) {
      const freeInv = freeInvoices.find((i) => i.id === selectedFreeInvId);
      if (freeInv) {
        setCurrentInvoice(freeInv);
        return;
      }
    }

    if (selectedType === 'reservation' && activeReservation) {
      if (bookingInvoices.length > 0) {
        const found = bookingInvoices.find((i) => i.id === activeInvoiceId) || bookingInvoices[0];
        setCurrentInvoice(found);
        if (activeInvoiceId !== found.id) {
          setActiveInvoiceId(found.id);
        }
      } else {
        const generated = generateInvoiceFromReservation(
          activeReservation, 
          null, 
          guests, 
          rooms
        );
        setCurrentInvoice(generated);
        setActiveInvoiceId(generated.id);
      }
    }
  }, [selectedType, selectedResId, selectedFreeInvId, activeInvoiceId, bookingInvoices, freeInvoices, activeReservation, guests, rooms]);

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
      id: Date.now() + Math.floor(Math.random() * 100),
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

  // Weitere Rechnung (Zweitrechnung) zur aktiven Buchung anlegen
  const handleCreateAdditional = async () => {
    if (selectedType === 'reservation' && activeReservation) {
      // Wenn noch keine Rechnung gespeichert ist, speichern wir erst die Hauptrechnung
      const baseInvoices = bookingInvoices.length > 0 ? bookingInvoices : (currentInvoice ? [currentInvoice] : []);
      if (bookingInvoices.length === 0 && currentInvoice) {
        await onSaveInvoice(currentInvoice);
      }

      const newAdditional = createAdditionalInvoice(activeReservation, baseInvoices, guests, rooms);
      await onSaveInvoice(newAdditional);
      setActiveInvoiceId(newAdditional.id);
      setCurrentInvoice(newAdditional);
      setSaveSuccessMsg(`Zweitrechnung ${newAdditional.invoiceNumber} angelegt!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } else {
      handleCreateFree();
    }
  };

  // Freie Kassenrechnung (ohne Buchungsbezug) anlegen
  const handleCreateFree = async () => {
    const newFree = createFreeInvoice();
    await onSaveInvoice(newFree);
    setSelectedType('freeInvoice');
    setSelectedFreeInvId(newFree.id);
    setSelectedResId(null);
    setActiveInvoiceId(newFree.id);
    setCurrentInvoice(newFree);
    setSaveSuccessMsg(`Freie Kassenrechnung ${newFree.invoiceNumber} angelegt!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Position auf eine andere Rechnung verschieben (Folio-Split A/B)
  const handleMoveItemToInvoice = async (itemIndex: number, targetInvoiceId: number) => {
    if (!currentInvoice || !currentInvoice.items) return;
    const itemToMove = currentInvoice.items[itemIndex];
    if (!itemToMove) return;

    // 1. Aus aktueller Rechnung entfernen
    const updatedSourceItems = currentInvoice.items.filter((_, idx) => idx !== itemIndex).map((it, idx) => ({
      ...it,
      positionNumber: idx + 1,
    }));
    const sourceTotals = recalculateInvoiceTotals(updatedSourceItems);
    const updatedSourceInvoice: Invoice = {
      ...currentInvoice,
      items: updatedSourceItems,
      ...sourceTotals,
    };

    // 2. Zur Zielrechnung hinzufügen
    const targetInvoice = bookingInvoices.find((i) => i.id === targetInvoiceId);
    if (!targetInvoice) return;

    const targetItems = [...(targetInvoice.items || [])];
    const newTargetItem: InvoiceLineItem = {
      ...itemToMove,
      id: Date.now() + Math.floor(Math.random() * 100),
      positionNumber: targetItems.length + 1,
    };
    const updatedTargetItems = [...targetItems, newTargetItem];
    const targetTotals = recalculateInvoiceTotals(updatedTargetItems);
    const updatedTargetInvoice: Invoice = {
      ...targetInvoice,
      items: updatedTargetItems,
      ...targetTotals,
    };

    // 3. Beide Rechnungen synchronisieren
    await onSaveInvoice(updatedSourceInvoice);
    await onSaveInvoice(updatedTargetInvoice);

    setCurrentInvoice(updatedSourceInvoice);
    setMoveDropdownPosIdx(null);
    setSaveSuccessMsg(`Position "${itemToMove.description}" auf ${updatedTargetInvoice.invoiceNumber} verschoben!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Einzelne Rechnung löschen / stornieren
  const handleDeleteSpecificInvoice = async (invId: number) => {
    const invToDelete = invoices.find((i) => i.id === invId) || (currentInvoice?.id === invId ? currentInvoice : null);
    if (!invToDelete) return;
    if (!window.confirm(`Möchten Sie die Rechnung ${invToDelete.invoiceNumber} wirklich löschen?`)) {
      return;
    }

    try {
      if (onDeleteInvoice) {
        await onDeleteInvoice(invId);
      }
      setSaveSuccessMsg(`Rechnung ${invToDelete.invoiceNumber} gelöscht.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      const remaining = bookingInvoices.filter((i) => i.id !== invId);
      if (remaining.length > 0) {
        setActiveInvoiceId(remaining[0].id);
        setCurrentInvoice(remaining[0]);
      } else if (reservations.length > 0) {
        setSelectedType('reservation');
        setSelectedResId(reservations[0].id);
        setSelectedFreeInvId(null);
      }
    } catch (err) {
      console.error('Fehler beim Löschen der Rechnung:', err);
    }
  };

  const handleDeleteCurrentInvoice = async () => {
    if (!currentInvoice) return;
    await handleDeleteSpecificInvoice(currentInvoice.id);
  };

  // Tastaturnavigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        if (e.key === 'F9') {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedType === 'reservation') {
          const curIdx = filteredReservations.findIndex((r) => r.id === selectedResId);
          if (curIdx < filteredReservations.length - 1) {
            setSelectedResId(filteredReservations[curIdx + 1].id);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedType === 'reservation') {
          const curIdx = filteredReservations.findIndex((r) => r.id === selectedResId);
          if (curIdx > 0) {
            setSelectedResId(filteredReservations[curIdx - 1].id);
          }
        }
      } else if (e.key === 'F6') {
        e.preventDefault();
        setViewMode('pdf');
        setTimeout(() => window.print(), 200);
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleCreateAdditional();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredReservations, selectedResId, selectedType, currentInvoice]);

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
          {freeInvoices.length > 0 && (
            <span className="bg-purple-100 text-purple-900 font-bold px-2 py-0.5 rounded text-[11px] border border-purple-200">
              {freeInvoices.length} Kassenbelege
            </span>
          )}
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
        
        {/* LINKE SPALTE: VORGÄNGE & FREIE RECHNUNGEN (MASTER) */}
        <div className="w-84 md:w-96 bg-white border-r border-slate-300 flex flex-col shrink-0 min-h-0 shadow-xs">
          
          {/* Header & Aktionen */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2 shrink-0">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gebuchte Zimmer & Vorgänge</span>
              </span>
              <button
                onClick={handleCreateFree}
                className="flex items-center gap-1 bg-white hover:bg-purple-50 text-purple-700 border border-purple-300 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer shadow-xs transition-colors"
                title="Rechnung ohne Zimmerbuchung erstellen (z. B. Thekenverkauf / Restaurant)"
              >
                <Plus className="w-3 h-3 text-purple-600" />
                <span>+ Freie Rechnung</span>
              </button>
            </div>

            {/* Suchfeld */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Gast, Zimmer, Res-Nr. oder Beleg suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded pl-8 pr-2 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-blue-500"
              />
            </div>

            {/* Filter-Chips (Matte & Ruhige Palette) */}
            <div className="flex items-center gap-1 text-[11px] flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-[#376189] text-white font-bold shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Alle ({counts.all})
              </button>
              <button
                onClick={() => setStatusFilter('open')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors flex items-center gap-1 ${
                  statusFilter === 'open'
                    ? 'bg-[#bd4343] text-white font-bold shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#bd4343] shadow-xs shrink-0 inline-block" />
                <span>Offen ({counts.open})</span>
              </button>
              <button
                onClick={() => setStatusFilter('partial')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors flex items-center gap-1 ${
                  statusFilter === 'partial'
                    ? 'bg-[#d4973b] text-slate-950 font-bold shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
                title="Nur Buchungen mit teilweise bezahlten Rechnungen anzeigen"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-[#d4973b] border border-[#b06a1f] shadow-xs shrink-0 inline-block animate-pulse" />
                <span>Teilbezahlt ({counts.partial})</span>
              </button>
              <button
                onClick={() => setStatusFilter('paid')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors flex items-center gap-1 ${
                  statusFilter === 'paid'
                    ? 'bg-[#2ea36f] text-white font-bold shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-[#2ea36f] shadow-xs shrink-0 inline-block" />
                <span>Bezahlt ({counts.paid})</span>
              </button>
              <button
                onClick={() => setStatusFilter('free')}
                className={`px-2 py-0.5 rounded cursor-pointer font-medium transition-colors ${
                  statusFilter === 'free'
                    ? 'bg-[#6d5684] text-white font-bold shadow-xs'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Freie Kasse ({counts.free})
              </button>
            </div>
          </div>

          {/* Buchungs- & Kassenbeleg-Liste */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {/* 1. Zimmerbuchungen */}
            {filteredReservations.map((res) => {
              const isSelected = selectedType === 'reservation' && selectedResId === res.id;
              const guest = res.guest || guests.find((g) => g.id === res.guestId);
              const room = res.room || rooms.find((r) => r.id === res.roomId);
              const guestFullName = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim() || res.last_name || 'Gast';
              
              // Alle Rechnungen zu dieser Buchung ermitteln
              const resInvs = invoices.filter((i) => i.reservationId === res.id);
              const hasInvs = resInvs.length > 0;
              const totalGross = hasInvs 
                ? resInvs.reduce((sum, i) => sum + (Number(i.totalGross) || 0), 0)
                : (res.totalPrice || 85.0);
              
              const isFullyPaid = hasInvs && resInvs.every((i) => i.isPaid);
              const isPartiallyPaid = hasInvs && !isFullyPaid && resInvs.some((i) => i.isPaid);

              return (
                <div
                  key={`res-${res.id}`}
                  onClick={() => {
                    setSelectedType('reservation');
                    setSelectedResId(res.id);
                    setSelectedFreeInvId(null);
                    if (resInvs.length > 0) {
                      setActiveInvoiceId(resInvs[0].id);
                    }
                  }}
                  className={`p-2.5 cursor-pointer transition-colors border-l-4 ${
                    isSelected
                      ? 'bg-[#ebf2f8] border-[#376189] shadow-inner'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        isSelected ? 'bg-[#376189] text-white' : 'bg-slate-200 text-slate-800'
                      }`}>
                        {room?.name || `Zimmer ${res.roomId}`}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        #{res.reservationNumber || res.id}
                      </span>
                      {resInvs.length > 1 && (
                        <span className="text-[9px] bg-[#dce8f3] text-[#1d3349] font-bold px-1.5 py-0.2 rounded border border-[#c4d8ea]">
                          {resInvs.length} Rechnungen
                        </span>
                      )}
                    </div>
                    
                    {/* Ampel-Status Badge: Grün = Bezahlt, Gelber Punkt = Teilbezahlt, Rot = Offen */}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1.5 border shadow-2xs ${
                      isFullyPaid
                        ? 'bg-[#edf6f1] text-[#285740] border-[#b7dec9]'
                        : isPartiallyPaid
                        ? 'bg-[#fcf3e6] text-[#8c5820] border-[#eed19a] ring-1 ring-[#eed19a]/60'
                        : 'bg-[#faeded] text-[#852828] border-[#ecc2c2]'
                    }`}>
                      {isFullyPaid ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#2ea36f] border border-[#268a5d] shadow-xs shrink-0 inline-block" />
                          <span>Bezahlt</span>
                        </>
                      ) : isPartiallyPaid ? (
                        <>
                          {/* Ampel: Gelber visueller Punkt */}
                          <span className="w-2.5 h-2.5 rounded-full bg-[#d4973b] border border-[#b06a1f] shadow-xs shrink-0 inline-block animate-pulse" />
                          <span className="font-extrabold text-[#8c5820]">Teilbezahlt</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#bd4343] border border-[#a33737] shadow-xs shrink-0 inline-block" />
                          <span>Offen</span>
                        </>
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
            })}

            {/* 2. Freie Kassenrechnungen */}
            {filteredFreeInvoices.length > 0 && (
              <div className="bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between border-y border-slate-200">
                <span className="flex items-center gap-1">
                  <Receipt className="w-3 h-3 text-purple-600" />
                  <span>Freie Kassenbelege</span>
                </span>
                <span>{filteredFreeInvoices.length}</span>
              </div>
            )}

            {filteredFreeInvoices.map((inv) => {
              const isSelected = selectedType === 'freeInvoice' && selectedFreeInvId === inv.id;
              return (
                <div
                  key={`free-${inv.id}`}
                  onClick={() => {
                    setSelectedType('freeInvoice');
                    setSelectedFreeInvId(inv.id);
                    setSelectedResId(null);
                    setActiveInvoiceId(inv.id);
                    setCurrentInvoice(inv);
                  }}
                  className={`p-2.5 cursor-pointer transition-colors border-l-4 ${
                    isSelected
                      ? 'bg-purple-50 border-purple-600 shadow-inner'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded font-mono bg-purple-100 text-purple-900 border border-purple-200">
                        KASSE
                      </span>
                      <span className="text-[10px] text-slate-600 font-mono font-bold">
                        {inv.invoiceNumber}
                      </span>
                    </div>

                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                      inv.isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inv.isPaid ? 'Bezahlt' : 'Offen'}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900 text-xs truncate">
                    {inv.recipientName || 'Barverkauf'}
                    {inv.recipientCompany && <span className="text-slate-500 font-normal"> ({inv.recipientCompany})</span>}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 mt-1">
                    <span className="font-mono text-slate-500">{inv.invoiceDate}</span>
                    <span className="font-bold font-mono text-purple-950 text-xs">
                      {inv.totalGross.toFixed(2)} €
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredReservations.length === 0 && filteredFreeInvoices.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic text-xs">
                Keine passenden Vorgänge oder Rechnungen gefunden.
              </div>
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
          
          {/* UMSCHALT- & AKTIONSLEISTE OBEN */}
          <div className="bg-white border-b border-slate-300 px-3 py-2 flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('edit')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'edit'
                    ? 'bg-[#376189] text-white shadow-xs'
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
                    ? 'bg-[#376189] text-white shadow-xs'
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
                <Plus className="w-3.5 h-3.5 text-[#376189]" />
                <span>Position hinzufügen</span>
              </button>

              {/* NEUER BUTTON: WEITERE RECHNUNG SCHREIBEN */}
              <button
                onClick={handleCreateAdditional}
                className="flex items-center gap-1 bg-[#eef3f7] hover:bg-[#e1eaf1] border border-[#a8c0d6] text-[#2c4f70] px-2.5 py-1 rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                title="Weitere Rechnung zu diesem Vorgang anlegen (z. B. Zweitrechnung / Folio B) [F8]"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-[#376189]" />
                <span>+ Weitere Rechnung schreiben</span>
              </button>

              <button
                onClick={handleSave}
                className="flex items-center gap-1 bg-[#397356] hover:bg-[#2c5b44] text-white px-3 py-1 rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                title="Rechnung speichern (F9)"
              >
                <Save className="w-3.5 h-3.5" />
                <span>[F9] Speichern</span>
              </button>
            </div>
          </div>

          {/* FOLIO-TABS: MEHRERE RECHNUNGEN ZU EINER BUCHUNG (WENN VORHANDEN ODER ERSTELLT) */}
          {selectedType === 'reservation' && (
            <div className="bg-slate-200 px-3 pt-2 border-b border-slate-300 flex items-center justify-between overflow-x-auto shrink-0">
              <div className="flex items-center gap-1.5">
                {/* Fallback-Tab, falls noch keine Rechnung im Server gespeichert ist */}
                {bookingInvoices.length === 0 && currentInvoice && (
                  <button
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-t text-xs font-bold border-t border-x bg-white text-[#1b2b3d] border-slate-300 shadow-xs -mb-[1px] z-10"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#376189]" />
                    <span>Rechnung 1: {currentInvoice.invoiceNumber}</span>
                    <span className="font-mono text-[11px] bg-slate-200 px-1.5 py-0.2 rounded">
                      {currentInvoice.totalGross.toFixed(2)} €
                    </span>
                  </button>
                )}

                {/* Echte gespeicherte Rechnungen */}
                {bookingInvoices.map((inv, idx) => {
                  const isCurrent = currentInvoice?.id === inv.id;
                  return (
                    <div key={inv.id} className="flex items-center">
                      <button
                        onClick={() => {
                          setActiveInvoiceId(inv.id);
                          setCurrentInvoice(inv);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-bold transition-all border-t border-x cursor-pointer ${
                          isCurrent
                            ? 'bg-white text-[#1b2b3d] border-slate-300 shadow-xs -mb-[1px] z-10'
                            : 'bg-slate-100 text-slate-600 border-slate-300/80 hover:bg-slate-50'
                        }`}
                      >
                        <FileText className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#376189]' : 'text-slate-400'}`} />
                        <span>Rechnung {idx + 1} ({inv.invoiceNumber})</span>
                        <span className="font-mono text-[11px] bg-slate-200/90 px-1.5 py-0.2 rounded text-slate-800">
                          {inv.totalGross.toFixed(2)} €
                        </span>
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          inv.isPaid ? 'bg-[#edf6f1] text-[#285740]' : 'bg-[#fcf3e6] text-[#8c5820]'
                        }`}>
                          {inv.isPaid ? 'Bezahlt' : 'Offen'}
                        </span>
                        
                        {/* Zweitrechnung löschen können, wenn >1 Rechnung vorhanden */}
                        {bookingInvoices.length > 1 && idx > 0 && !inv.isPaid && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSpecificInvoice(inv.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 cursor-pointer ml-1"
                            title="Diese Zweitrechnung löschen"
                          >
                            <X className="w-3 h-3" />
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Schnell-Tab für weitere Rechnung */}
                <button
                  onClick={handleCreateAdditional}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-700 hover:bg-white/80 rounded-t border border-dashed border-blue-400 font-semibold cursor-pointer mb-0.5 ml-1 transition-colors"
                  title="Weitere Rechnung für diesen Gast / diese Buchung hinzufügen"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Neue Rechnung</span>
                </button>
              </div>

              {bookingInvoices.length > 1 && (
                <div className="text-[10px] text-slate-600 font-mono pb-1 flex items-center gap-2">
                  {bookingInvoices.some((i) => i.isPaid) && !bookingInvoices.every((i) => i.isPaid) ? (
                    <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-950 border border-amber-300 font-bold px-2 py-0.5 rounded shadow-xs">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-600 shadow-xs inline-block animate-pulse" />
                      <span>Teilbezahlt</span>
                    </span>
                  ) : bookingInvoices.every((i) => i.isPaid) ? (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold px-2 py-0.5 rounded shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs inline-block" />
                      <span>Vollständig bezahlt</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-300 font-bold px-2 py-0.5 rounded shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shadow-xs inline-block" />
                      <span>Offen</span>
                    </span>
                  )}
                  <span>Folio-Split: <strong>{bookingInvoices.length} Rechnungen</strong></span>
                </div>
              )}
            </div>
          )}

          {/* TAB BEI FREIER RECHNUNG */}
          {selectedType === 'freeInvoice' && currentInvoice && (
            <div className="bg-slate-200 px-3 pt-2 border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-bold border-t border-x bg-white text-purple-900 border-slate-300 shadow-xs -mb-[1px] z-10">
                  <Receipt className="w-3.5 h-3.5 text-purple-600" />
                  <span>Kassenbeleg: {currentInvoice.invoiceNumber}</span>
                  <span className="font-mono text-[11px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded">
                    {currentInvoice.totalGross.toFixed(2)} €
                  </span>
                </div>
                <button
                  onClick={handleCreateFree}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs text-purple-700 hover:bg-white/80 rounded-t border border-dashed border-purple-400 font-semibold cursor-pointer mb-0.5 ml-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Weiterer Kassenbeleg</span>
                </button>
              </div>

              <button
                onClick={handleDeleteCurrentInvoice}
                className="text-[11px] text-rose-600 hover:text-rose-800 pb-1 cursor-pointer flex items-center gap-1"
                title="Diesen Kassenbeleg stornieren / löschen"
              >
                <Trash2 className="w-3 h-3" />
                <span>Beleg stornieren</span>
              </button>
            </div>
          )}

          {/* INHALT DER RECHTEN SPALTE: EDIT-MODUS ODER PDF-VORSCHAU */}
          {!currentInvoice ? (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-400 italic text-sm">
              Wählen Sie links einen Vorgang oder erstellen Sie eine freie Rechnung.
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
                      <User className="w-3.5 h-3.5 text-[#376189]" />
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
                    <Calendar className="w-3.5 h-3.5 text-[#376189]" />
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
                        min="0"
                        value={currentInvoice.nights || 0}
                        onChange={(e) => {
                          const n = Math.max(0, Number(e.target.value) || 0);
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
                        value={currentInvoice.roomName || ''}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, roomName: e.target.value })}
                        className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-700 font-semibold"
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
                  <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
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
                    <button
                      onClick={() => handleAddItem({ desc: 'Zusatz-Frühstücksbuffet', price: 12.00, taxRate: 0.19 })}
                      className="px-2 py-0.5 bg-white hover:bg-slate-50 border border-slate-300 rounded text-slate-700 cursor-pointer"
                    >
                      + Frühstück (12€)
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
                        <th className="py-1.5 px-2 w-20 text-center">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(currentInvoice.items || []).map((item, idx) => {
                        const otherInvoices = bookingInvoices.filter((i) => i.id !== currentInvoice.id);
                        return (
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
                              <div className="flex items-center justify-center gap-1 relative">
                                {/* Folio-Transfer-Button: Wenn mehrere Rechnungen für die Buchung existieren */}
                                {otherInvoices.length > 0 && (
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (otherInvoices.length === 1) {
                                          handleMoveItemToInvoice(idx, otherInvoices[0].id);
                                        } else {
                                          setMoveDropdownPosIdx(moveDropdownPosIdx === idx ? null : idx);
                                        }
                                      }}
                                      className="text-[#376189] hover:text-[#203c58] p-1 rounded hover:bg-[#eef3f7] cursor-pointer"
                                      title={otherInvoices.length === 1 
                                        ? `Auf Rechnung ${otherInvoices[0].invoiceNumber} verschieben` 
                                        : 'Auf andere Rechnung verschieben (Folio-Split)'}
                                    >
                                      <ArrowRightLeft className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Dropdown-Menü, falls mehr als 2 Rechnungen existieren */}
                                    {moveDropdownPosIdx === idx && otherInvoices.length > 1 && (
                                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-300 shadow-xl rounded z-40 p-1 text-[11px] min-w-36 flex flex-col gap-0.5">
                                        <span className="text-[10px] text-slate-400 px-1 font-semibold text-left">
                                          Verschieben nach:
                                        </span>
                                        {otherInvoices.map((targetInv, tIdx) => (
                                          <button
                                            key={targetInv.id}
                                            onClick={() => handleMoveItemToInvoice(idx, targetInv.id)}
                                            className="text-left px-2 py-1 hover:bg-blue-50 text-slate-700 rounded cursor-pointer truncate"
                                          >
                                            Rechnung {tIdx + 2}: {targetInv.invoiceNumber}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                <button
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                  title="Position löschen"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
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
                    <span className="text-base font-extrabold text-[#1b2b3d] bg-[#eef3f7] px-3 py-1 rounded border border-[#ccdbe8]">
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
                    className="text-[10px] text-[#376189] hover:underline cursor-pointer"
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
        onCopy={handleCreateAdditional}
        canCopy={true}
        onEdit={handleSave}
        canEdit={true}
        editLabel="[F9] Speichern"
        canDelete={Boolean(currentInvoice && (!currentInvoice.reservationId || bookingInvoices.length > 1))}
        onDelete={handleDeleteCurrentInvoice}
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
                className="bg-[#376189] hover:bg-[#2c4f70] text-white px-3 py-1 rounded font-bold cursor-pointer"
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
