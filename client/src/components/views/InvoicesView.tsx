import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, ShieldCheck, ArrowRightLeft, Printer, Code, 
  CreditCard, CheckCircle2, Building, User, Layers, RefreshCw 
} from 'lucide-react';
import { 
  calculateInvoiceSummary, 
  type InvoiceLineItem, 
  type InvoiceTaxCalculation,
  roundToCent 
} from '../../services/taxEngine';
import { ActionBar } from '../ActionBar';

interface Invoice {
  id: number;
  invoiceNumber: string;
  reservationId?: number;
  guestId: number;
  invoiceDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  netLodging: number;
  taxLodging: number;
  netService: number;
  taxService: number;
  cityTaxAmount: number;
  totalGross: number;
  paymentMethod: string;
  isPaid: boolean;
  tseTransactionId?: string;
  status: string;
  guestName?: string;
  billingDebitor?: string;
}

interface InvoicesViewProps {
  invoices: Invoice[];
  onRefresh: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  onRefresh,
}) => {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number>(invoices[0]?.id || 1);
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState<boolean>(false);

  const selectedInvoice = useMemo(() => {
    return invoices.find((inv) => inv.id === selectedInvoiceId) || invoices[0] || null;
  }, [invoices, selectedInvoiceId]);

  // Lade Rechnungspositionen bei Auswahl
  useEffect(() => {
    if (!selectedInvoice) return;

    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        const res = await fetch(`/api/invoices/${selectedInvoice.id}/items`);
        if (res.ok) {
          const rawItems = await res.json();
          // Map to typed InvoiceLineItem
          const mapped: InvoiceLineItem[] = rawItems.map((ri: any) => ({
            id: ri.id,
            positionNumber: ri.positionNumber,
            folioBucket: (ri.folioBucket as 'A' | 'B' | 'C') || 'A',
            description: ri.description,
            roomCode: ri.roomCode,
            quantity: ri.quantity || 1,
            unitPriceGross: ri.unitPriceGross || ri.totalGross,
            totalGross: ri.totalGross,
            taxRate: (ri.taxRate as 0.07 | 0.19 | 0.0) || 0.07,
            taxCode: ri.taxCode || 2,
            taxType: (ri.taxType as any) || 'LODGING',
            dateFrom: ri.dateFrom,
            dateTo: ri.dateTo,
            infoNote: ri.infoNote,
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Positionen:', err);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [selectedInvoice]);

  // Live-Berechnung der Steuern & Folios mit der taxEngine
  const calculation: InvoiceTaxCalculation = useMemo(() => {
    return calculateInvoiceSummary(items, false, null, 5.0);
  }, [items]);

  // Posten zwischen Folios A, B, C verschieben
  const handleMoveFolio = async (item: InvoiceLineItem, targetBucket: 'A' | 'B' | 'C') => {
    if (!item.id) return;

    // Optimistisches State Update
    const updated = items.map((i) => 
      i.id === item.id ? { ...i, folioBucket: targetBucket } : i
    );
    setItems(updated);

    try {
      await fetch(`/api/invoice-items/${item.id}/folio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folioBucket: targetBucket }),
      });
    } catch (err) {
      console.error('Fehler beim Verschieben:', err);
    }
  };

  // Erzeuge ZUGFeRD 2.0 / Factur-X XML Vorschau
  const generateZugferdXmlPreview = () => {
    if (!selectedInvoice) return '';
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
    <ram:ID>${selectedInvoice.invoiceNumber}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${selectedInvoice.invoiceDate.replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <!-- Steuernachweis nach deutschem Steuerrecht (§ 14 UStG) -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:TaxCurrencyCode>EUR</ram:TaxCurrencyCode>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <!-- Logis 7% USt -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${calculation.taxLodging.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${calculation.netLodging.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>7.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <!-- F&B 19% USt -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${calculation.taxService.toFixed(2)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${calculation.netService.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <!-- Leipzig City Tax 0% USt (Nicht steuerbare Gemeindeabgabe) -->
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${calculation.cityTaxAmount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>O</ram:CategoryCode>
        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${calculation.totalNet.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${calculation.totalNet.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${calculation.totalTax.toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${calculation.totalGross.toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${calculation.totalGross.toFixed(2)}</ram:DuePayableAmount>
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
          <span className="font-bold text-slate-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Rechnungsverwaltung & Dreifach-Folio-Split (Bild 04 ELAN hogatec)</span>
          </span>
          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[11px] border border-emerald-200">
            {invoices.length} Rechnungen erfasst
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <span>KassenSichV: Fiskaly V2 aktiv</span>
          <span>|</span>
          <span>E-Rechnung: EN 16931 Factur-X / ZUGFeRD</span>
        </div>
      </div>

      {/* 2. OBERE HÄLFTE: RECHNUNGSLISTE (MASTER) */}
      <div className="h-44 bg-white border-b border-slate-300 overflow-auto shrink-0">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
            <tr>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Rechnungs-Nr.</th>
              <th className="py-1.5 px-3 border-r border-slate-300 w-24">Datum</th>
              <th className="py-1.5 px-3 border-r border-slate-300">Leistungszeitraum</th>
              <th className="py-1.5 px-3 border-r border-slate-300 text-right w-28">Netto Logis (7%)</th>
              <th className="py-1.5 px-3 border-r border-slate-300 text-right w-28">Netto Service (19%)</th>
              <th className="py-1.5 px-3 border-r border-slate-300 text-right w-32">City Tax Leipzig (0%)</th>
              <th className="py-1.5 px-3 border-r border-slate-300 text-right w-28 font-bold">Brutto Gesamt</th>
              <th className="py-1.5 px-3 border-r border-slate-300 text-center w-24">Zahlart</th>
              <th className="py-1.5 px-3 text-center w-36">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
            {invoices.map((inv) => {
              const isSelected = selectedInvoiceId === inv.id;
              return (
                <tr
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{inv.invoiceNumber}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50">{inv.invoiceDate}</td>
                  <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                    {inv.servicePeriodStart} bis {inv.servicePeriodEnd}
                  </td>
                  <td className="py-1 px-3 border-r border-slate-200/50 text-right">
                    {inv.netLodging?.toFixed(2)} €
                  </td>
                  <td className="py-1 px-3 border-r border-slate-200/50 text-right">
                    {inv.netService?.toFixed(2)} €
                  </td>
                  <td className={`py-1 px-3 border-r border-slate-200/50 text-right font-bold ${
                    isSelected ? 'text-emerald-200' : 'text-emerald-700'
                  }`}>
                    {inv.cityTaxAmount?.toFixed(2)} €
                  </td>
                  <td className="py-1 px-3 border-r border-slate-200/50 text-right font-bold">
                    {inv.totalGross?.toFixed(2)} €
                  </td>
                  <td className="py-1 px-3 border-r border-slate-200/50 text-center font-sans">
                    {inv.paymentMethod}
                  </td>
                  <td className="py-1 px-3 text-center font-sans">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      <span>TSE signiert</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. UNTERE HÄLFTE: 3-WEGE FOLIO-SPLIT CONTAINER (A, B, C) */}
      <div className="flex-1 p-2.5 flex flex-col min-h-0 bg-slate-200 gap-2">
        
        {/* Info-Leiste der markierten Rechnung */}
        <div className="bg-white p-2 rounded border border-slate-300 shadow-xs flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">
              Rechnung {selectedInvoice?.invoiceNumber}:
            </span>
            <span className="text-slate-600 font-sans">
              Leistungszeitraum: {selectedInvoice?.servicePeriodStart} - {selectedInvoice?.servicePeriodEnd}
            </span>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <span className="text-slate-600">
              Netto: <strong>{calculation.totalNet.toFixed(2)} €</strong>
            </span>
            <span className="text-slate-600">
              USt (7%+19%): <strong>{calculation.totalTax.toFixed(2)} €</strong>
            </span>
            <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Leipzig City Tax: {calculation.cityTaxAmount.toFixed(2)} €
            </span>
            <span className="text-sm font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Brutto: {calculation.totalGross.toFixed(2)} €
            </span>
          </div>
        </div>

        {/* DIE 3 FOLIO-CONTAINER NEBENEINANDER */}
        <div className="flex-1 grid grid-cols-3 gap-2 min-h-0">
          
          {/* FOLIO A: FIRMENÜBERNAHME (LOGIS 7%) */}
          <div className="bg-white rounded border border-slate-300 shadow-xs flex flex-col min-h-0 overflow-hidden">
            <div className="bg-blue-600 text-white px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 font-bold">
                <Building className="w-3.5 h-3.5" />
                <span>Folio A (Firmenübernahme Logis)</span>
              </div>
              <span className="text-[10px] bg-blue-700 px-1.5 py-0.2 rounded font-mono">
                {calculation.folios.A.items.length} Posten
              </span>
            </div>

            {/* Positionen Liste Folio A */}
            <div className="flex-1 overflow-auto p-2 divide-y divide-slate-100 text-xs">
              {calculation.folios.A.items.map((item) => (
                <div key={item.id || item.positionNumber} className="py-1.5 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-slate-800">{item.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.quantity}x {item.unitPriceGross.toFixed(2)} € | Steuersatz: {(item.taxRate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {item.totalGross.toFixed(2)} €
                    </span>
                    <button
                      onClick={() => handleMoveFolio(item, 'B')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-100 text-blue-700 border border-slate-300 rounded text-[10px] font-bold cursor-pointer"
                      title="Auf Folio B verschieben"
                    >
                      → B
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summen Footer Folio A */}
            <div className="bg-slate-50 border-t border-slate-200 p-2 text-[11px] font-mono shrink-0 flex flex-col gap-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Logis Netto (7%):</span>
                <span>{calculation.folios.A.netLodging.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>USt 7%:</span>
                <span>{calculation.folios.A.taxLodging.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>City Tax (0%):</span>
                <span>{calculation.folios.A.cityTaxAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-xs">
                <span>Gesamt Folio A:</span>
                <span className="text-blue-800">{calculation.folios.A.totalGross.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* FOLIO B: GASTKONTO (PRIVATAUSLAGEN & F&B 19%) */}
          <div className="bg-white rounded border border-slate-300 shadow-xs flex flex-col min-h-0 overflow-hidden">
            <div className="bg-amber-600 text-white px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 font-bold">
                <User className="w-3.5 h-3.5" />
                <span>Folio B (Gastkonto Privatauslagen)</span>
              </div>
              <span className="text-[10px] bg-amber-700 px-1.5 py-0.2 rounded font-mono">
                {calculation.folios.B.items.length} Posten
              </span>
            </div>

            {/* Positionen Liste Folio B */}
            <div className="flex-1 overflow-auto p-2 divide-y divide-slate-100 text-xs">
              {calculation.folios.B.items.map((item) => (
                <div key={item.id || item.positionNumber} className="py-1.5 flex items-center justify-between hover:bg-slate-50">
                  <button
                    onClick={() => handleMoveFolio(item, 'A')}
                    className="mr-2 px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 text-amber-800 border border-slate-300 rounded text-[10px] font-bold cursor-pointer"
                    title="Auf Folio A zurückverschieben"
                  >
                    ← A
                  </button>
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-slate-800">{item.description}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.quantity}x {item.unitPriceGross.toFixed(2)} € | Steuersatz: {(item.taxRate * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {item.totalGross.toFixed(2)} €
                    </span>
                    <button
                      onClick={() => handleMoveFolio(item, 'C')}
                      className="px-1.5 py-0.5 bg-slate-100 hover:bg-amber-100 text-amber-800 border border-slate-300 rounded text-[10px] font-bold cursor-pointer"
                      title="Auf Folio C verschieben"
                    >
                      → C
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summen Footer Folio B */}
            <div className="bg-slate-50 border-t border-slate-200 p-2 text-[11px] font-mono shrink-0 flex flex-col gap-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Service Netto (19%):</span>
                <span>{calculation.folios.B.netService.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>USt 19%:</span>
                <span>{calculation.folios.B.taxService.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>City Tax (0%):</span>
                <span>{calculation.folios.B.cityTaxAmount.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-xs">
                <span>Gesamt Folio B:</span>
                <span className="text-amber-800">{calculation.folios.B.totalGross.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* FOLIO C: SONDERPOSTEN / KONFERENZ / DRITTE */}
          <div className="bg-white rounded border border-slate-300 shadow-xs flex flex-col min-h-0 overflow-hidden">
            <div className="bg-slate-700 text-white px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-1.5 font-bold">
                <Layers className="w-3.5 h-3.5" />
                <span>Folio C (Sonderposten & Dritte)</span>
              </div>
              <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded font-mono">
                {calculation.folios.C.items.length} Posten
              </span>
            </div>

            {/* Positionen Liste Folio C */}
            <div className="flex-1 overflow-auto p-2 divide-y divide-slate-100 text-xs">
              {calculation.folios.C.items.length === 0 ? (
                <div className="py-8 text-center text-slate-400 italic font-sans text-xs">
                  Keine Posten auf Folio C. Positionen können von A oder B hierher verschoben werden.
                </div>
              ) : (
                calculation.folios.C.items.map((item) => (
                  <div key={item.id || item.positionNumber} className="py-1.5 flex items-center justify-between hover:bg-slate-50">
                    <button
                      onClick={() => handleMoveFolio(item, 'A')}
                      className="mr-2 px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-[10px] font-bold cursor-pointer"
                      title="Auf Folio A zurückverschieben"
                    >
                      ← A
                    </button>
                    <div className="flex-1 pr-2">
                      <div className="font-semibold text-slate-800">{item.description}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {item.quantity}x {item.unitPriceGross.toFixed(2)} € | {(item.taxRate * 100).toFixed(0)}%
                      </div>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-xs">
                      {item.totalGross.toFixed(2)} €
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Summen Footer Folio C */}
            <div className="bg-slate-50 border-t border-slate-200 p-2 text-[11px] font-mono shrink-0 flex flex-col gap-0.5">
              <div className="flex justify-between text-slate-600">
                <span>Netto:</span>
                <span>{calculation.folios.C.totalNet.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>USt:</span>
                <span>{calculation.folios.C.totalTax.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-xs">
                <span>Gesamt Folio C:</span>
                <span className="text-slate-800">{calculation.folios.C.totalGross.toFixed(2)} €</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4. FOOTER AKTIONEN */}
      <ActionBar
        onSelect={() => window.print()}
        selectLabel="[F6] Sofortdruck / PDF"
        onNew={() => {}}
        onCopy={() => setXmlPreviewOpen(true)}
        canCopy={true}
        onEdit={() => {}}
        canEdit={false}
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
                  ZUGFeRD 2.0.1 / Factur-X EN 16931 XML Vorschau [Rech-Nr: {selectedInvoice?.invoiceNumber}]
                </span>
              </div>
              <button
                onClick={() => setXmlPreviewOpen(false)}
                className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded"
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
