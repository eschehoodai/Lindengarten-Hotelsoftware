import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, ShieldCheck, Printer, Code, 
  CheckCircle2, User, 
  Search, Plus, Trash2, Calendar, BedDouble, Edit3, Eye,
  Check, Save, DollarSign, HeartHandshake,
  FilePlus2, ArrowRightLeft, Receipt, X,
  Lock, RotateCcw, Ban, AlertTriangle, Sparkles
} from 'lucide-react';
import type { Reservation, Room, Guest, Invoice, PriceVariant } from '../../types';
import { 
  type InvoiceLineItem, 
  roundToCent 
} from '../../services/taxEngine';
import { 
  generateInvoiceFromReservation, 
  createAdditionalInvoice,
  createFreeInvoice,
  recalculateInvoiceTotals, 
  calculateBreakfastSplit,
  DEFAULT_CLOSING_TEXT 
} from '../../services/invoiceGenerator';
import { InvoicePdfDocument } from '../pdf/InvoicePdfDocument';
import { ActionBar } from '../ActionBar';
import { ConfirmDialog } from '../dialogs/ConfirmDialog';

interface InvoicesViewProps {
  invoices: Invoice[];
  reservations: Reservation[];
  rooms: Room[];
  guests: Guest[];
  priceVariants?: PriceVariant[];
  onSaveInvoice: (invoice: Invoice) => Promise<Invoice | void> | Invoice | void;
  onDeleteInvoice?: (id: number) => Promise<void> | void;
  onRefresh: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  reservations,
  rooms,
  guests,
  priceVariants = [],
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

  // Rechnungen für die aktive Reservierung (chronologisch aufsteigend sortiert: Rechnung 1 = Hauptrechnung)
  const bookingInvoices = useMemo(() => {
    if (!activeReservation) return [];
    return invoices
      .filter((inv) => inv.reservationId === activeReservation.id)
      .sort((a, b) => a.id - b.id);
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
  const [stornoModalOpen, setStornoModalOpen] = useState(false);

  // In-App Modals für sichere Bestätigungen ohne störende Browser-Popups
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [lockedNoticeInvoice, setLockedNoticeInvoice] = useState<Invoice | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{ index: number; item: InvoiceLineItem } | null>(null);

  // Ermittle, ob die aktuelle Rechnung im Speicher / DB bereits festgeschrieben ist
  const persistedInvoice = useMemo(() => {
    if (!currentInvoice) return null;
    return invoices.find((i) => i.id === currentInvoice.id || (currentInvoice.invoiceNumber && i.invoiceNumber === currentInvoice.invoiceNumber));
  }, [invoices, currentInvoice?.id, currentInvoice?.invoiceNumber]);

  // Status-Checks für Schreibschutz & GoBD:
  // Festgeschrieben ist eine Rechnung erst, wenn sie im persistenten Speicher bereits bezahlt hinterlegt ist,
  // oder wenn es sich um einen Stornobeleg / stornierten Beleg handelt.
  // Reine Entwürfe (OFFEN) bleiben editierbar, bis [F9] Speichern gedrückt wird!
  const isInvoiceLocked = Boolean(
    (persistedInvoice && (persistedInvoice.isPaid || persistedInvoice.status === 'BEZAHLT')) ||
    currentInvoice?.status === 'STORNIERT' || 
    currentInvoice?.status === 'STORNO_BELEG'
  );
  const isStorniert = currentInvoice?.status === 'STORNIERT';
  const isStornoBeleg = currentInvoice?.status === 'STORNO_BELEG';

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
        // Leere Zweitrechnungen / Folios bleiben leer und ziehen keine Logis-Positionen erneut an!
        setCurrentInvoice(found);
        if (activeInvoiceId !== found.id) {
          setActiveInvoiceId(found.id);
        }
      } else {
        // Noch gar keine Rechnung zur Buchung im Speicher vorhanden:
        // Einmaligen initialen Entwurf mit Übernachtung und Frühstück generieren
        const generated = generateInvoiceFromReservation(
          activeReservation, 
          null, 
          guests, 
          rooms,
          priceVariants
        );
        setCurrentInvoice(generated);
        setActiveInvoiceId(generated.id);
      }
    }
  }, [selectedType, selectedResId, selectedFreeInvId, activeInvoiceId, bookingInvoices, freeInvoices, activeReservation, guests, rooms, priceVariants]);

  // Hilfsfunktion: Positionen im Invoice aktualisieren und Summen neu berechnen (Single Source of Truth)
  const updateItems = (newItems: InvoiceLineItem[]) => {
    if (!currentInvoice || isInvoiceLocked) return;
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

  // Hilfsfunktion: Bereinigung für Backend-Speicherung (leere Eingaben sicher als 0)
  const sanitizeInvoiceForSave = (inv: Invoice): Invoice => ({
    ...inv,
    items: (inv.items || []).map((it) => ({
      ...it,
      description: it.description || '',
      quantity: Number(it.quantity) || 0,
      unitPriceGross: Number(it.unitPriceGross) || 0,
      totalGross: Number(it.totalGross) || 0,
    })),
  });

  // Position hinzufügen (immer komplett leer)
  const handleAddItem = () => {
    if (!currentInvoice || isInvoiceLocked) return;
    const currentItems = currentInvoice.items || [];
    const nextPosNum = currentItems.length + 1;

    const newItem: InvoiceLineItem = {
      id: Date.now() + Math.floor(Math.random() * 100),
      positionNumber: nextPosNum,
      folioBucket: 'A',
      description: '',
      roomCode: currentInvoice.roomCode || '',
      quantity: '' as any,
      unitPriceGross: '' as any,
      totalGross: 0,
      taxRate: 0.19,
      taxCode: 1,
      taxType: 'SERVICE',
      dateFrom: currentInvoice.servicePeriodStart,
      dateTo: currentInvoice.servicePeriodEnd,
      infoNote: '',
    };

    updateItems([...currentItems, newItem]);
  };

  // Position entfernen (mit GoBD / KassenSichV und Bestätigungs-Dialog)
  const handleRemoveItem = (index: number) => {
    if (!currentInvoice) return;
    if (isInvoiceLocked) {
      setLockedNoticeInvoice(currentInvoice);
      return;
    }
    const currentItems = currentInvoice.items || [];
    const targetItem = currentItems[index];
    if (!targetItem) return;

    setItemToDelete({ index, item: targetItem });
  };

  const confirmRemoveItem = () => {
    if (!itemToDelete || !currentInvoice) return;
    const { index } = itemToDelete;
    setItemToDelete(null);
    const currentItems = currentInvoice.items || [];
    const updated = currentItems.filter((_, idx) => idx !== index).map((it, idx) => ({
      ...it,
      positionNumber: idx + 1,
    }));
    updateItems(updated);
  };

  // Einzelne Eigenschaft einer Position bearbeiten
  const handleItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    if (!currentInvoice || isInvoiceLocked) return;
    const currentItems = [...(currentInvoice.items || [])];
    const targetItem = { ...currentItems[index] };

    if (field === 'quantity') {
      const q = value === '' ? ('' as any) : Math.max(0, Number(value) || 0);
      targetItem.quantity = q;
      const numQ = Number(q) || 0;
      const numP = Number(targetItem.unitPriceGross) || 0;
      targetItem.totalGross = roundToCent(numQ * numP);
    } else if (field === 'unitPriceGross') {
      const p = value === '' ? ('' as any) : Math.max(0, Number(value) || 0);
      targetItem.unitPriceGross = p;
      const numP = Number(p) || 0;
      const numQ = Number(targetItem.quantity) || 0;
      targetItem.totalGross = roundToCent(numQ * numP);
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
    if (isInvoiceLocked) {
      setLockedNoticeInvoice(currentInvoice);
      return;
    }
    try {
      let invToSave: Invoice = sanitizeInvoiceForSave(currentInvoice);
      // Kassenabschluss & KassenSichV Fiskalisierung:
      // Wenn "Rechnung bezahlt" markiert ist, wird der Status verbindlich auf BEZAHLT gesetzt
      // und eine rechtssichere TSE-Transaktions-ID & Signatur erzeugt (sofern noch nicht vorhanden).
      if (invToSave.isPaid) {
        invToSave.status = 'BEZAHLT';
      } else {
        invToSave.status = 'OFFEN';
      }

      const saved = await onSaveInvoice(invToSave);
      if (saved) {
        setCurrentInvoice(saved);
      } else {
        setCurrentInvoice(invToSave);
      }
      setSaveSuccessMsg(`Rechnung ${invToSave.invoiceNumber} erfolgreich gespeichert!`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Fehler beim Speichern der Rechnung:', err);
    }
  };

  const [tseSigningLoading, setTseSigningLoading] = useState<boolean>(false);

  // Kassiervorgang: Wenn auf "Rechnung bezahlt" geklickt wird
  const handleTogglePaid = async (checked: boolean) => {
    if (!currentInvoice) return;
    const updated: Invoice = {
      ...currentInvoice,
      isPaid: checked,
      status: checked ? 'BEZAHLT' : 'OFFEN',
    };
    setCurrentInvoice(updated);

    if (checked) {
      // Wenn als bezahlt markiert: Sofort im Backend speichern & bei fiskaly TSE signieren!
      try {
        setSaveSuccessMsg('Wird gespeichert & bei fiskaly TSE signiert...');
        const saved = await onSaveInvoice(sanitizeInvoiceForSave(updated));
        if (saved) {
          setCurrentInvoice(saved);
        }
        setSaveSuccessMsg(`Rechnung ${updated.invoiceNumber} als bezahlt verbucht & bei fiskaly TSE signiert!`);
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      } catch (err) {
        console.error('Fehler beim Bezahlen/Fiskalisieren:', err);
      }
    } else {
      const saved = await onSaveInvoice(sanitizeInvoiceForSave(updated));
      if (saved) {
        setCurrentInvoice(saved);
      }
    }
  };

  // Manuelle TSE-Nachsignierung über fiskaly API
  const handleManualTseSign = async () => {
    if (!currentInvoice) return;
    setTseSigningLoading(true);
    try {
      const toSign: Invoice = {
        ...currentInvoice,
        isPaid: true,
        status: 'BEZAHLT',
      };
      await onSaveInvoice(sanitizeInvoiceForSave(toSign));

      const identifier = currentInvoice.invoiceNumber || currentInvoice.id;
      const res = await fetch(`/api/tse/sign/${identifier}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.invoice) {
          setCurrentInvoice(data.invoice);
          await onSaveInvoice(data.invoice);
          setSaveSuccessMsg(`Rechnung ${data.invoice.invoiceNumber} erfolgreich bei fiskaly signiert (Zähler #${data.invoice.tseSignatureCounter})!`);
          setTimeout(() => setSaveSuccessMsg(null), 4000);
        }
      } else {
        const err = await res.json();
        alert(`TSE-Signierung fehlgeschlagen: ${err.error || 'Fehler'}`);
      }
    } catch (err: any) {
      console.error('Fehler beim manuellen TSE-Signieren:', err);
      alert(`Fehler bei TSE-Signierung: ${err.message}`);
    } finally {
      setTseSigningLoading(false);
    }
  };

  // Storno-Workflow: Offizielle GoBD-Rechnungskorrektur mit negativer TSE-Transaktion
  const handleExecuteStorno = async () => {
    if (!currentInvoice) return;
    const today = new Date().toISOString().split('T')[0];
    const originalNumber = currentInvoice.invoiceNumber;
    const stornoNumber = `${originalNumber}-S`;

    // 1. Originalrechnung auf STORNIERT setzen
    const updatedOriginal: Invoice = {
      ...currentInvoice,
      status: 'STORNIERT',
      closingText: `${currentInvoice.closingText || ''}\n[STORNIERT am ${today} durch Stornorechnung ${stornoNumber}]`.trim(),
    };

    // 2. Neue Stornorechnung (Gutschrift) mit negierten Vorzeichen erzeugen
    const stornoItems: InvoiceLineItem[] = (currentInvoice.items || []).map((it, idx) => ({
      ...it,
      id: Date.now() + idx + 100,
      positionNumber: idx + 1,
      description: `STORNO zu Pos. ${it.positionNumber}: ${it.description}`,
      quantity: it.quantity > 0 ? -it.quantity : it.quantity,
      totalGross: it.totalGross > 0 ? -roundToCent(it.totalGross) : it.totalGross,
      infoNote: `Stornobuchung zu Rechnung ${originalNumber}`,
    }));

    const stornoInvoice: Invoice = {
      ...currentInvoice,
      id: Date.now() + Math.floor(Math.random() * 1000),
      invoiceNumber: stornoNumber,
      invoiceDate: today,
      status: 'STORNO_BELEG',
      isPaid: true,
      items: stornoItems,
      netLodging: -Math.abs(currentInvoice.netLodging || 0),
      taxLodging: -Math.abs(currentInvoice.taxLodging || 0),
      netService: -Math.abs(currentInvoice.netService || 0),
      taxService: -Math.abs(currentInvoice.taxService || 0),
      cityTaxAmount: 0,
      totalGross: -Math.abs(currentInvoice.totalGross || 0),
      tseTransactionId: undefined,
      tseSignature: undefined,
      closingText: `Offizielle Stornorechnung / Rechnungskorrektur zu Rechnung ${originalNumber} gem. § 14 UStG und KassenSichV.`,
    };

    try {
      await onSaveInvoice(updatedOriginal);
      await onSaveInvoice(stornoInvoice);
      setStornoModalOpen(false);
      setActiveInvoiceId(stornoInvoice.id);
      setCurrentInvoice(stornoInvoice);
      setSaveSuccessMsg(`Rechnung ${originalNumber} erfolgreich storniert! Stornobeleg ${stornoNumber} angelegt.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Fehler bei Storno-Ausführung:', err);
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
    setActiveInvoiceId(newFree.id);
    setSelectedType('freeInvoice');
    setSelectedFreeInvId(newFree.id);
    setSelectedResId(null);
    setCurrentInvoice(newFree);
    setSaveSuccessMsg(`Freie Kassenrechnung ${newFree.invoiceNumber} angelegt!`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  // Position auf eine andere Rechnung verschieben (Folio-Split A/B)
  const handleMoveItemToInvoice = async (itemIndex: number, targetInvoiceId: number) => {
    if (!currentInvoice || !currentInvoice.items || isInvoiceLocked) return;
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

  // Einzelne Rechnung löschen anfordern (prüft GoBD und öffnet Bestätigungsmodal)
  const handleDeleteSpecificInvoice = (invId: number) => {
    const invToDelete = invoices.find((i) => i.id === invId) || (currentInvoice?.id === invId ? currentInvoice : null);
    if (!invToDelete) return;

    if (invToDelete.isPaid || invToDelete.status === 'BEZAHLT' || invToDelete.status === 'STORNIERT' || invToDelete.status === 'STORNO_BELEG') {
      setLockedNoticeInvoice(invToDelete);
      return;
    }

    setInvoiceToDelete(invToDelete);
  };

  // Bestätigtes Löschen ausführen
  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    const invId = invoiceToDelete.id;
    const invNumber = invoiceToDelete.invoiceNumber;
    const isReservation = Boolean(invoiceToDelete.reservationId);
    setInvoiceToDelete(null);

    try {
      if (onDeleteInvoice) {
        await onDeleteInvoice(invId);
      }
      setSaveSuccessMsg(`Rechnung ${invNumber} gelöscht.`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      if (isReservation) {
        const remaining = bookingInvoices.filter((i) => i.id !== invId);
        if (remaining.length > 0) {
          if (activeInvoiceId === invId) {
            setActiveInvoiceId(remaining[0].id);
            setCurrentInvoice(remaining[0]);
          } else {
            const stillActive = remaining.find((i) => i.id === activeInvoiceId) || remaining[0];
            setActiveInvoiceId(stillActive.id);
            setCurrentInvoice(stillActive);
          }
        } else if (reservations.length > 0) {
          setSelectedType('reservation');
          setSelectedResId(reservations[0].id);
          setSelectedFreeInvId(null);
        }
      } else {
        const remainingFree = freeInvoices.filter((i) => i.id !== invId);
        if (remainingFree.length > 0) {
          setSelectedFreeInvId(remainingFree[0].id);
          setCurrentInvoice(remainingFree[0]);
        } else if (reservations.length > 0) {
          setSelectedType('reservation');
          setSelectedResId(reservations[0].id);
          setSelectedFreeInvId(null);
        } else {
          setCurrentInvoice(null);
        }
      }
    } catch (err) {
      console.error('Fehler beim Löschen der Rechnung:', err);
    }
  };

  const handleDeleteCurrentInvoice = () => {
    if (!currentInvoice) return;
    handleDeleteSpecificInvoice(currentInvoice.id);
  };

  // Tastaturnavigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Wenn ein Bestätigungsmodal offen ist
      if (invoiceToDelete || lockedNoticeInvoice || itemToDelete || stornoModalOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setInvoiceToDelete(null);
          setLockedNoticeInvoice(null);
          setItemToDelete(null);
          setStornoModalOpen(false);
        } else if (e.key === 'Enter') {
          if (invoiceToDelete) {
            e.preventDefault();
            confirmDeleteInvoice();
          } else if (itemToDelete) {
            e.preventDefault();
            confirmRemoveItem();
          }
        }
        return;
      }

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
        if (viewMode === 'edit') {
          setViewMode('pdf');
        } else {
          window.print();
        }
      } else if (e.key === 'Escape') {
        if (viewMode === 'pdf') {
          e.preventDefault();
          setViewMode('edit');
        }
      } else if (e.key === 'F7') {
        e.preventDefault();
        handleAddItem();
      } else if (e.key === 'F8') {
        e.preventDefault();
        handleCreateAdditional();
      } else if (e.key === 'F9') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Delete') {
        if (!isInvoiceLocked && currentInvoice && (!currentInvoice.reservationId || bookingInvoices.length > 1)) {
          e.preventDefault();
          handleDeleteCurrentInvoice();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredReservations, 
    selectedResId, 
    selectedType, 
    currentInvoice, 
    invoiceToDelete, 
    lockedNoticeInvoice, 
    itemToDelete, 
    stornoModalOpen, 
    isInvoiceLocked, 
    bookingInvoices
  ]);

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
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${(currentInvoice.netLodging + currentInvoice.netService).toFixed(2)}</ram:LineTotalAmount>
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
          {currentInvoice?.tseOfflineFallback ? (
            <span className="flex items-center gap-1 text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
              <span>TSE-Ausfallmodus (§ 146a AO)</span>
            </span>
          ) : currentInvoice?.tseSignature ? (
            <span className="flex items-center gap-1 text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>fiskaly TSE: Signiert (#{currentInvoice.tseSignatureCounter || 1})</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>KassenSichV: fiskaly V2 bereit</span>
            </span>
          )}

          {currentInvoice?.isPaid && (!currentInvoice?.tseSignature || currentInvoice?.tseOfflineFallback) && (
            <button
              onClick={handleManualTseSign}
              disabled={tseSigningLoading}
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-sans text-xs flex items-center gap-1 shadow-xs cursor-pointer font-medium disabled:opacity-50"
              title="Transaktion jetzt bei fiskaly in der Cloud signieren"
            >
              <Sparkles className={`w-3 h-3 ${tseSigningLoading ? 'animate-spin' : ''}`} />
              <span>{tseSigningLoading ? 'Signiere...' : 'TSE nachsignieren'}</span>
            </button>
          )}

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
            <span>{viewMode === 'edit' ? '[F6] DIN A4 Vorschau' : '[F6] Drucken'}</span>
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
                disabled={isInvoiceLocked}
                className={`flex items-center gap-1 border px-2.5 py-1 rounded text-xs font-semibold shadow-xs transition-colors ${
                  isInvoiceLocked
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700 cursor-pointer'
                }`}
                title={isInvoiceLocked ? 'Rechnung ist schreibgeschützt (GoBD)' : 'Position hinzufügen (F7)'}
              >
                <Plus className="w-3.5 h-3.5 text-[#376189]" />
                <span>Position hinzufügen</span>
              </button>

              {/* WEITERE RECHNUNG SCHREIBEN */}
              <button
                onClick={handleCreateAdditional}
                className="flex items-center gap-1 bg-[#eef3f7] hover:bg-[#e1eaf1] border border-[#a8c0d6] text-[#2c4f70] px-2.5 py-1 rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                title="Weitere Rechnung zu diesem Vorgang anlegen (z. B. Zweitrechnung / Folio B) [F8]"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-[#376189]" />
                <span>+ Weitere Rechnung schreiben</span>
              </button>

              {/* STORNO BUTTON: Bei bezahlten oder festgeschriebenen Rechnungen */}
              {isInvoiceLocked && !isStorniert && !isStornoBeleg && (
                <button
                  type="button"
                  onClick={() => setStornoModalOpen(true)}
                  className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1 rounded text-xs font-bold cursor-pointer shadow-xs transition-colors"
                  title="Offizielle GoBD-Stornorechnung mit negativer TSE-Signatur erstellen"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Stornieren / Gutschrift</span>
                </button>
              )}

              <button
                onClick={handleSave}
                disabled={isInvoiceLocked}
                className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-bold shadow-xs transition-colors ${
                  isInvoiceLocked
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-[#397356] hover:bg-[#2c5b44] text-white cursor-pointer'
                }`}
                title={isInvoiceLocked ? 'Rechnung ist festgeschrieben (keine Direktänderung möglich)' : 'Rechnung speichern (F9)'}
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
                      <div
                        onClick={() => {
                          setActiveInvoiceId(inv.id);
                          setCurrentInvoice(inv);
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setActiveInvoiceId(inv.id);
                            setCurrentInvoice(inv);
                          }
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
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSpecificInvoice(inv.id);
                            }}
                            className="text-slate-400 hover:text-rose-600 p-0.5 rounded hover:bg-rose-100 cursor-pointer ml-1 transition-colors"
                            title="Diese Zweitrechnung löschen"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
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
              
              {/* GoBD & KassenSichV Status-Banner */}
              {isStorniert ? (
                <div className="bg-rose-50 border border-rose-300 p-2.5 rounded flex items-center justify-between text-xs text-rose-900 font-medium">
                  <div className="flex items-center gap-2">
                    <Ban className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold">STORNIERTE RECHNUNG (GoBD-Archiviert)</span>: Diese Rechnung wurde offiziell storniert und ist schreibgeschützt. Der Stornobeleg führt die Gegenbuchung.
                    </div>
                  </div>
                  <span className="bg-rose-200 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                    STATUS: STORNIERT
                  </span>
                </div>
              ) : isStornoBeleg ? (
                <div className="bg-amber-50 border border-amber-300 p-2.5 rounded flex items-center justify-between text-xs text-amber-900 font-medium">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold">STORNO-BELEG / RECHNUNGSKORREKTUR</span>: Offizielle Gegenbuchung mit negativen Beträgen und eigener TSE-Signatur.
                    </div>
                  </div>
                  <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                    TSE: {currentInvoice.tseTransactionId || 'VALID'}
                  </span>
                </div>
              ) : isInvoiceLocked ? (
                <div className="bg-[#eef3f7] border border-[#a8c0d6] p-2.5 rounded flex items-center justify-between text-xs text-[#1b2b3d] font-medium">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#376189] shrink-0" />
                    <div>
                      <span className="font-bold">Rechnung bezahlt & KassenSichV aktiv</span>: Dieser Beleg ist steuerlich festgeschrieben (GoBD). Direkte Änderungen oder Löschungen von Positionen sind gesperrt.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStornoModalOpen(true)}
                    className="bg-white hover:bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Storno / Gutschrift erstellen</span>
                  </button>
                </div>
              ) : null}

              {/* BLOCK 1: EMPFÄNGER, ANREDE & RECHNUNGSMETADATEN */}
              <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs grid grid-cols-12 gap-3.5 text-xs">
                
                {/* Spalte 1-7: Empfängeranschrift & Anrede */}
                <div className="col-span-12 md:col-span-7 flex flex-col gap-3 border-b md:border-b-0 md:border-r border-slate-200 pb-3 md:pb-0 md:pr-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-[#376189]" />
                      <span>Rechnungsempfänger & Anschrift</span>
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">DIN 5008 Adressfeld</span>
                  </div>

                  {/* Anrede-Auswahl */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                      BRIEFANREDE <span className="text-rose-600 font-bold ml-1">*</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={
                          ['Sehr geehrter Herr', 'Sehr geehrte Frau', 'Sehr geehrte Familie', 'Sehr geehrte Damen und Herren'].includes(currentInvoice.recipientSalutation?.split(' ')[0] || '')
                            ? currentInvoice.recipientSalutation
                            : 'custom'
                        }
                        disabled={isInvoiceLocked}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            setCurrentInvoice({ ...currentInvoice, recipientSalutation: e.target.value });
                          }
                        }}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-medium text-slate-900 w-48 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
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
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientSalutation: e.target.value })}
                        placeholder="Anrede frei formulieren..."
                        className={`flex-1 bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 font-medium shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Name & Firma */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center">
                        GASTNAME <span className="text-rose-600 font-bold ml-1">*</span>
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientName || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientName: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-bold text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        FIRMA / NAME 2 (OPTIONAL)
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientCompany || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientCompany: e.target.value })}
                        placeholder="z.B. Firmenübernahme"
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Straße, PLZ, Ort */}
                  <div className="grid grid-cols-12 gap-2.5">
                    <div className="col-span-6 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        STRASSE & HAUSNR.
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientStreet || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientStreet: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        PLZ
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientZip || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientZip: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 font-mono font-bold shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>

                    <div className="col-span-4 flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        ORT
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.recipientCity || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, recipientCity: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                </div>

                {/* Spalte 8-12: Rechnungs-Kopfdaten */}
                <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                  <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#376189]" />
                    <span>Rechnungs-Stammdaten</span>
                  </span>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        RECHNUNGS-NR.
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.invoiceNumber || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, invoiceNumber: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        RECHNUNGSDATUM
                      </label>
                      <input
                        type="date"
                        value={currentInvoice.invoiceDate || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, invoiceDate: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        ANZAHL ÜBERNACHTUNGEN
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={currentInvoice.nights || 0}
                        disabled={isInvoiceLocked}
                        onChange={(e) => {
                          const n = Math.max(0, Number(e.target.value) || 0);
                          setCurrentInvoice({ ...currentInvoice, nights: n });
                        }}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-mono font-bold text-blue-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        ZIMMER / EINHEIT
                      </label>
                      <input
                        type="text"
                        value={currentInvoice.roomName || ''}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, roomName: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] text-slate-900 font-semibold shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                        ZAHLUNGSART
                      </label>
                      <select
                        value={currentInvoice.paymentMethod || 'BAR'}
                        disabled={isInvoiceLocked}
                        onChange={(e) => setCurrentInvoice({ ...currentInvoice, paymentMethod: e.target.value })}
                        className={`bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs md:text-[13px] font-semibold text-slate-900 shadow-2xs ${isInvoiceLocked ? 'opacity-80 cursor-not-allowed bg-slate-100' : ''}`}
                      >
                        <option value="BAR">Barzahlung</option>
                        <option value="EC">EC-Karte (Maestro/Giro)</option>
                        <option value="KREDIT">Kreditkarte (Visa/MC)</option>
                        <option value="RECHNUNG">Auf Rechnung (Überweisung)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 justify-end">
                      <label className={`flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded cursor-pointer hover:bg-slate-100 transition-colors shadow-2xs ${isStorniert || isStornoBeleg ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={currentInvoice.isPaid || false}
                          disabled={isStorniert || isStornoBeleg}
                          onChange={(e) => handleTogglePaid(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <span className="font-bold text-xs md:text-[13px] text-slate-900">Rechnung bezahlt</span>
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
                    <span className="font-bold text-slate-900 text-sm">
                      Aufgeschlüsselte Rechnungspositionen
                    </span>
                    <span className="text-[11px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded font-mono">
                      {(currentInvoice.items || []).length} Position(en)
                    </span>
                  </div>


                </div>

                {/* Tabelle der Positionen */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wide">
                      <tr>
                        <th className="py-2 px-2 w-10 text-center">Pos.</th>
                        <th className="py-2 px-2">Leistungsbeschreibung / Information</th>
                        <th className="py-2 px-2 w-20 text-center">Menge</th>
                        <th className="py-2 px-2 w-28 text-right">Einzelpreis (€)</th>
                        <th className="py-2 px-2 w-28 text-center">USt-Satz</th>
                        <th className="py-2 px-2 w-28 text-right">Gesamt (€)</th>
                        <th className="py-2 px-2 w-20 text-center">Aktion</th>
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
                                placeholder="Leistungsbeschreibung eingeben..."
                                value={item.description || ''}
                                disabled={isInvoiceLocked}
                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                className={`w-full border rounded px-2 py-1 text-xs font-medium text-slate-800 ${
                                  isInvoiceLocked 
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed' 
                                    : 'bg-white border-slate-300'
                                }`}
                              />
                              <input
                                type="text"
                                placeholder="Zusatzinfo (optional)..."
                                value={item.infoNote || ''}
                                disabled={isInvoiceLocked}
                                onChange={(e) => handleItemChange(idx, 'infoNote', e.target.value)}
                                className={`w-full border rounded px-2 py-0.5 text-[10px] text-slate-500 mt-0.5 italic ${
                                  isInvoiceLocked 
                                    ? 'bg-slate-100/60 border-slate-200 cursor-not-allowed' 
                                    : 'bg-slate-50 border-slate-200'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                placeholder="0"
                                value={item.quantity === '' || item.quantity === undefined ? '' : item.quantity}
                                disabled={isInvoiceLocked}
                                onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                className={`w-16 border rounded px-1.5 py-1 text-xs text-center font-mono font-bold ${
                                  isInvoiceLocked 
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed' 
                                    : 'bg-white border-slate-300'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={item.unitPriceGross === '' || item.unitPriceGross === undefined ? '' : item.unitPriceGross}
                                disabled={isInvoiceLocked}
                                onChange={(e) => handleItemChange(idx, 'unitPriceGross', e.target.value)}
                                className={`w-24 border rounded px-1.5 py-1 text-xs text-right font-mono ${
                                  isInvoiceLocked 
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed' 
                                    : 'bg-white border-slate-300'
                                }`}
                              />
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <select
                                value={item.taxRate}
                                disabled={isInvoiceLocked}
                                onChange={(e) => handleItemChange(idx, 'taxRate', Number(e.target.value))}
                                className={`border rounded px-1.5 py-1 text-xs font-mono font-semibold ${
                                  isInvoiceLocked 
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed' 
                                    : 'bg-white border-slate-300'
                                }`}
                              >
                                <option value={0.07}>7 % (Logis)</option>
                                <option value={0.19}>19 % (Service)</option>
                              </select>
                            </td>
                            <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900 text-xs">
                              {item.quantity !== '' && item.quantity !== undefined && item.unitPriceGross !== '' && item.unitPriceGross !== undefined
                                ? `${(Number(item.totalGross) || 0).toFixed(2)} €`
                                : (Number(item.totalGross) > 0 ? `${Number(item.totalGross).toFixed(2)} €` : '')}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              <div className="flex items-center justify-center gap-1 relative">
                                {/* Folio-Transfer-Button: Wenn mehrere Rechnungen für die Buchung existieren */}
                                {otherInvoices.length > 0 && !isInvoiceLocked && (
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

                                {isInvoiceLocked ? (
                                  <span className="p-1 text-slate-400 inline-flex items-center" title="Schreibgeschützt gem. GoBD & KassenSichV">
                                    <Lock className="w-3.5 h-3.5" />
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleRemoveItem(idx)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 cursor-pointer"
                                    title="Position löschen"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
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
              <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-rose-500" />
                    <span>Persönlicher Schlusstext / Danksagung auf der Rechnung</span>
                  </span>
                  <button
                    onClick={() => setCurrentInvoice({ ...currentInvoice, closingText: DEFAULT_CLOSING_TEXT })}
                    className="text-xs text-[#376189] font-medium hover:underline cursor-pointer"
                  >
                    Standardtext wiederherstellen
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={currentInvoice.closingText || ''}
                  onChange={(e) => setCurrentInvoice({ ...currentInvoice, closingText: e.target.value })}
                  placeholder="z. B. Vielen Dank für Ihren Aufenthalt und beehren Sie uns gerne wieder!"
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2.5 text-xs md:text-[13px] text-slate-900 focus:outline-blue-500 font-medium leading-relaxed shadow-2xs"
                />

                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span className="font-bold uppercase tracking-wider text-[11px] text-slate-500">Vorschlagsvorlagen:</span>
                  <button
                    onClick={() => setCurrentInvoice({
                      ...currentInvoice,
                      closingText: 'Vielen Dank für Ihren Besuch im Romantik Hotel Zum Lindengarten! Wir wünschen Ihnen eine gute Heimreise und freuen uns auf ein baldiges Wiedersehen.'
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

          {/* Unsichtbare Druckkopie im Edit-Modus für reibungslosen Direktdruck */}
          {currentInvoice && viewMode === 'edit' && (
            <div className="hidden print:block">
              <InvoicePdfDocument
                invoice={currentInvoice}
                onPrint={() => window.print()}
                onDownloadPdf={() => window.print()}
              />
            </div>
          )}

        </div>

      </div>

      {/* 3. FUSSZEILE: AKTIONEN & TASTEN (ActionBar) */}
      <ActionBar
        onSelect={() => {
          if (viewMode === 'edit') {
            setViewMode('pdf');
          } else {
            window.print();
          }
        }}
        selectLabel={viewMode === 'edit' ? '[F6] DIN A4 Vorschau' : '[F6] Drucken / PDF speichern'}
        onNew={() => handleAddItem()}
        onCopy={handleCreateAdditional}
        canCopy={true}
        onEdit={handleSave}
        canEdit={!isInvoiceLocked}
        editLabel="[F9] Speichern"
        canDelete={!isInvoiceLocked && Boolean(currentInvoice && (!currentInvoice.reservationId || bookingInvoices.length > 1))}
        onDelete={handleDeleteCurrentInvoice}
      />

      {/* MODAL: GoBD / KassenSichV STORNO BESTÄTIGUNG */}
      {stornoModalOpen && currentInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-400 w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in duration-150">
            <div className="bg-amber-700 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <span className="text-sm font-bold">
                  Rechnung {currentInvoice.invoiceNumber} stornieren?
                </span>
              </div>
              <button
                onClick={() => setStornoModalOpen(false)}
                className="text-amber-200 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-amber-900 font-medium">
                <strong>GoBD & KassenSichV Hinweis:</strong><br />
                Ein Beleg kann nicht einfach gelöscht werden. Gemäß § 14 UStG und KassenSichV wird eine <strong>offizielle Stornorechnung (Rechnungskorrektur)</strong> mit eigener Belegnummer ({currentInvoice.invoiceNumber}-S) und negativen Vorzeichen (-{currentInvoice.totalGross.toFixed(2)} €) erstellt.
              </div>

              <div className="border border-slate-200 rounded p-2.5 bg-slate-50 font-mono text-[11px] flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Originalrechnung:</span>
                  <span className="font-bold">{currentInvoice.invoiceNumber} ({currentInvoice.totalGross.toFixed(2)} €)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Storno-Belegnummer:</span>
                  <span className="font-bold text-amber-800">{currentInvoice.invoiceNumber}-S</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stornobetrag (Gutschrift):</span>
                  <span className="font-bold text-rose-700">-{(currentInvoice.totalGross).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">TSE-Transaktion:</span>
                  <span className="text-emerald-700 font-bold">Wird neu signiert (Fiskaly V2)</span>
                </div>
              </div>

              <p className="text-slate-600">
                Die Originalrechnung bleibt unveränderlich für die Betriebsprüfung im System erhalten. Der Vorgang wird wieder ausgeglichen.
              </p>
            </div>

            <div className="bg-slate-100 px-4 py-3 border-t border-slate-300 flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setStornoModalOpen(false)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleExecuteStorno}
                className="px-4 py-1.5 rounded text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Storno jetzt ausführen</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* MODAL: ENTWURFS-RECHNUNG LÖSCHEN BESTÄTIGUNG */}
      {invoiceToDelete && (
        <ConfirmDialog
          isOpen={!!invoiceToDelete}
          title={
            invoiceToDelete.reservationId
              ? 'Entwurfs-Rechnung löschen?'
              : 'Kassenbeleg löschen?'
          }
          message={
            <>
              Möchten Sie die Entwurfs-Rechnung bzw. den Beleg{' '}
              <strong>{invoiceToDelete.invoiceNumber}</strong> wirklich unwiderruflich löschen?
            </>
          }
          details={[
            { label: 'Belegnummer', value: invoiceToDelete.invoiceNumber },
            {
              label: 'Empfänger / Gast',
              value: invoiceToDelete.recipientName || 'Kein Empfänger angegeben',
            },
            {
              label: 'Status',
              value: 'Offen / Unbezahlt',
            },
            {
              label: 'Rechnungsbetrag',
              value: `${invoiceToDelete.totalGross.toFixed(2)} €`,
            },
            {
              label: 'Positionen',
              value: `${invoiceToDelete.items?.length || 0} Posten`,
            },
          ]}
          hint="Hinweis: Die Rechnung und alle Positionen werden unwiderruflich gelöscht. Übrige Rechnungen dieses Vorgangs (Folio-Split) bleiben unverändert erhalten."
          confirmLabel="[Enter] Unwiderruflich löschen"
          cancelLabel="[Esc] Abbrechen"
          danger={true}
          onConfirm={confirmDeleteInvoice}
          onClose={() => setInvoiceToDelete(null)}
        />
      )}

      {/* MODAL: GOBD / KASSENSICHV SCHUTZHINWEIS */}
      {lockedNoticeInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-md flex flex-col overflow-hidden animate-in fade-in duration-150">
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span className="text-sm font-bold">
                  Rechnung schreibgeschützt (GoBD / KassenSichV)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLockedNoticeInvoice(null)}
                className="text-slate-300 hover:text-white text-xs px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-xs text-slate-700 leading-relaxed">
              <div className="bg-amber-50 border border-amber-300 p-3 rounded text-amber-950 font-medium">
                Rechnung <strong>{lockedNoticeInvoice.invoiceNumber}</strong> ist als <strong>{lockedNoticeInvoice.isPaid ? 'Bezahlt' : lockedNoticeInvoice.status}</strong> im System erfasst.
              </div>

              <p className="text-slate-600">
                Gemäß den Grundsätzen ordnungsmäßiger Buchführung (GoBD) und der Kassensicherungsverordnung (KassenSichV / § 14 UStG) dürfen bezahlte oder steuerlich festgeschriebene Belege nicht gelöscht werden.
              </p>

              <p className="text-slate-600">
                Um diesen Vorgang buchhalterisch und fiskalisch korrekt auszugleichen, erstellen Sie bitte eine offizielle <strong>Stornorechnung (Rechnungskorrektur)</strong> mit TSE-Signatur.
              </p>
            </div>

            <div className="bg-slate-100 px-4 py-3 border-t border-slate-300 flex justify-end items-center gap-2">
              <button
                type="button"
                onClick={() => setLockedNoticeInvoice(null)}
                className="px-3 py-1.5 rounded text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 cursor-pointer"
              >
                Verstanden [Esc]
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = lockedNoticeInvoice;
                  setLockedNoticeInvoice(null);
                  setCurrentInvoice(target);
                  setStornoModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Storno / Gutschrift erstellen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BESTÄTIGUNGSDIALOG POSITION ENTFERNEN */}
      {itemToDelete && (
        <ConfirmDialog
          isOpen={!!itemToDelete}
          title={
            itemToDelete.item.taxType === 'LODGING' && currentInvoice?.reservationId
              ? 'Übernachtungsleistung entfernen?'
              : 'Position aus Rechnung entfernen?'
          }
          message={
            <>
              Möchten Sie die Position{' '}
              <strong>"{itemToDelete.item.description}"</strong> wirklich aus dieser Rechnung entfernen?
            </>
          }
          details={[
            { label: 'Bezeichnung', value: itemToDelete.item.description },
            {
              label: 'Menge × Einzelpreis',
              value: `${itemToDelete.item.quantity} × ${itemToDelete.item.unitPriceGross.toFixed(2)} €`,
            },
            {
              label: 'Gesamtbetrag',
              value: `${itemToDelete.item.totalGross.toFixed(2)} € (inkl. ${itemToDelete.item.taxRate}% USt)`,
            },
          ]}
          hint={
            itemToDelete.item.taxType === 'LODGING' && currentInvoice?.reservationId
              ? 'Hinweis: Die Reservierung im Zimmerplan bleibt weiterhin unberührt bestehen.'
              : undefined
          }
          confirmLabel="[Enter] Position entfernen"
          cancelLabel="[Esc] Abbrechen"
          danger={itemToDelete.item.taxType === 'LODGING' && !!currentInvoice?.reservationId ? false : true}
          onConfirm={confirmRemoveItem}
          onClose={() => setItemToDelete(null)}
        />
      )}

    </div>
  );
};
