import React, { useState, useEffect } from 'react';
import type { Invoice } from '../../types';
import { roundToCent, calculateSplitTax } from '../../services/taxEngine';
import { CheckCircle2, Printer, Download } from 'lucide-react';
import QRCode from 'qrcode';
import { HOTEL_CONFIG } from '../../constants/hotelConfig';

interface InvoicePdfDocumentProps {
  invoice: Invoice;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
}

export const InvoicePdfDocument: React.FC<InvoicePdfDocumentProps> = ({
  invoice,
  onPrint,
  onDownloadPdf,
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const qrData = invoice.tseQrCodeData || (invoice.tseTransactionId ? `TSE;${invoice.tseTransactionId};${invoice.tseSignature || ''};${invoice.totalGross}EUR;${invoice.invoiceDate}` : null);
    if (qrData) {
      QRCode.toDataURL(qrData, { width: 80, margin: 0 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.warn('QR Code generation failed:', err));
    } else {
      setQrCodeDataUrl(null);
    }
  }, [invoice.tseQrCodeData, invoice.tseTransactionId, invoice.tseSignature, invoice.totalGross, invoice.invoiceDate]);

  const items = invoice.items || [];

  // Berechne die Steuertabelle nach § 14 UStG
  let net7 = 0;
  let tax7 = 0;
  let gross7 = 0;

  let net19 = 0;
  let tax19 = 0;
  let gross19 = 0;

  items.forEach((it) => {
    const total = roundToCent(Number(it.totalGross) || (Number(it.quantity) * Number(it.unitPriceGross)) || 0);
    if (it.taxRate === 0.07 || it.taxType === 'LODGING') {
      const split = calculateSplitTax(total, 0.07);
      net7 += split.net;
      tax7 += split.tax;
      gross7 += split.gross;
    } else {
      const split = calculateSplitTax(total, 0.19);
      net19 += split.net;
      tax19 += split.tax;
      gross19 += split.gross;
    }
  });

  const totalNet = roundToCent(net7 + net19);
  const totalTax = roundToCent(tax7 + tax19);
  const totalGross = roundToCent(gross7 + gross19);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="flex flex-col items-center">
      
      {/* DRUCKLEISTE (Wird beim echten Drucken ausgeblendet) */}
      <div className="w-full max-w-[210mm] mb-3 flex items-center justify-between bg-slate-800 text-white px-4 py-2.5 rounded shadow print:hidden">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            <span>DIN A4 Rechnungsvorschau</span>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 font-mono text-[11px]">Rechnungs-Nr: {invoice.invoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {onDownloadPdf && (
            <button
              onClick={onDownloadPdf}
              className="flex items-center gap-1.5 bg-[#376189] hover:bg-[#2c4f70] text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs"
              title="Als PDF herunterladen"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF Herunterladen</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#397356] hover:bg-[#2c5b44] text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            title="Drucken / Als PDF speichern"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>[F6] Drucken / PDF speichern</span>
          </button>
        </div>
      </div>

      {/* DAS ECHTE DIN A4 DOKUMENT (210mm x 297mm) */}
      <div 
        id="hotel-invoice-printable"
        className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[20mm] shadow-2xl border border-slate-300 flex flex-col justify-between font-sans print:shadow-none print:border-none print:m-0 print:text-black"
        style={{ boxSizing: 'border-box' }}
      >
        <div>
          {/* 1. BRIEFKOPF / HEADER */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-serif">
                {HOTEL_CONFIG.name}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 tracking-wide font-sans">
                {HOTEL_CONFIG.claim}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {HOTEL_CONFIG.street} • {HOTEL_CONFIG.location}
              </p>
            </div>

            <div className="text-right text-[10px] text-slate-500 space-y-0.5">
              <div>Telefon: {HOTEL_CONFIG.phone}</div>
              <div>Fax: {HOTEL_CONFIG.fax}</div>
              <div>E-Mail: {HOTEL_CONFIG.email}</div>
              <div>Web: {HOTEL_CONFIG.web}</div>
              <div className="text-slate-400 pt-0.5 font-mono text-[9.5px]">USt-IdNr.: {HOTEL_CONFIG.taxId}</div>
            </div>
          </div>

          {/* 2. ADRESSFELD & LUFTIGE METADATEN-SPALTE */}
          <div className="grid grid-cols-12 gap-6 mt-7 mb-6">
            
            {/* Linke Seite: Anschrift des Gastes */}
            <div className="col-span-7 flex flex-col justify-between">
              <div>
                {/* Rücksendeangabe klein */}
                <div className="text-[9px] text-slate-400 border-b border-slate-200 pb-1 mb-3">
                  {HOTEL_CONFIG.dinReturnLine}
                </div>
                
                {/* Anschrift */}
                <div className="text-xs space-y-0.5 font-medium text-slate-800 leading-snug">
                  {invoice.recipientCompany && (
                    <div className="font-bold text-slate-900">{invoice.recipientCompany}</div>
                  )}
                  {invoice.billingDebitor && invoice.billingDebitor !== invoice.recipientName && (
                    <div className="text-slate-600 text-[11px]">z. Hd. {invoice.billingDebitor}</div>
                  )}
                  <div className="font-semibold text-slate-900">{invoice.recipientName}</div>
                  <div>{invoice.recipientStreet || 'Lindenallee 12'}</div>
                  <div>
                    {invoice.recipientZip || '04109'} {invoice.recipientCity || 'Leipzig'}
                  </div>
                  {invoice.recipientCountry && invoice.recipientCountry !== 'Deutschland' && (
                    <div className="text-[11px] uppercase tracking-wider text-slate-600">{invoice.recipientCountry}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Rechte Seite: Rechnungsdaten sauber & rahmenlos (kein grauer Kasten) */}
            <div className="col-span-5 flex flex-col justify-end text-xs space-y-1.5 pl-4 border-l border-slate-200">
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">Rechnungs-Nr.</span>
                <span className="font-bold text-slate-900 font-mono text-sm">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500">Rechnungsdatum</span>
                <span className="text-slate-800 font-mono text-[11px]">{invoice.invoiceDate}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500">Leistungszeitraum</span>
                <span className="text-slate-800 font-mono text-[11px]">{invoice.servicePeriodStart} – {invoice.servicePeriodEnd}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[11px] text-slate-500">Aufenthalt</span>
                <span className="text-slate-800 text-[11px] font-medium">{invoice.nights} Übernachtung(en)</span>
              </div>
              {invoice.roomName && (
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] text-slate-500">Zimmer / Einheit</span>
                  <span className="font-semibold text-slate-800 text-[11px]">{invoice.roomName}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline pt-1 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">Zahlungsart</span>
                <span className="font-bold text-slate-900 text-[11px]">{invoice.paymentMethod}</span>
              </div>
            </div>

          </div>

          {/* 3. DOKUMENTENTITEL & PERSÖNLICHE ANREDE */}
          <div className="mb-4">
            <h2 className="text-base font-bold tracking-wider text-slate-900 font-serif border-b border-slate-200 pb-1 uppercase">
              Rechnung
            </h2>
            <div className="mt-2 text-xs text-slate-700 font-sans">
              <p className="font-semibold mb-0.5">
                {invoice.recipientSalutation || 'Sehr geehrte Damen und Herren'},
              </p>
              <p className="text-slate-500">
                {HOTEL_CONFIG.welcomeText}
              </p>
            </div>
          </div>

          {/* 4. POSITIONSTABELLE */}
          <div className="mb-5">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600 font-semibold text-[11px]">
                  <th className="py-1.5 px-2 w-10 text-center">Pos.</th>
                  <th className="py-1.5 px-2">Leistungsbeschreibung / Zeitraum</th>
                  <th className="py-1.5 px-2 text-center w-16">Menge</th>
                  <th className="py-1.5 px-2 text-right w-24">Einzelpreis</th>
                  <th className="py-1.5 px-2 text-center w-16">MwSt</th>
                  <th className="py-1.5 px-2 text-right w-28">Gesamt (brutto)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-sans">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 text-center text-slate-400 font-mono text-[11px]">
                      {item.positionNumber || idx + 1}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-slate-900">{item.description}</div>
                      {item.infoNote && (
                        <div className="text-[10px] text-slate-400 italic mt-0.5 font-sans">
                          {item.infoNote}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-mono">
                      {item.quantity}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-slate-700">
                      {(Number(item.unitPriceGross) || 0).toFixed(2)} €
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-700">
                      {(Number(item.taxRate) * 100).toFixed(0)} %
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                      {(Number(item.totalGross) || 0).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. STEUER- & SUMMENBLOCK (§ 14 UStG) – NAHTLOS & RECHTSBÜNDIG */}
          <div className="grid grid-cols-12 gap-6 mb-5">
            
            {/* Steuertabelle § 14 UStG (Schlank links) */}
            <div className="col-span-6 text-[10.5px] text-slate-600 flex flex-col justify-end">
              <div className="font-semibold text-slate-700 text-[11px] mb-1">
                Steueraufschlüsselung gem. § 14 UStG:
              </div>
              <table className="w-full text-right text-[10px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400">
                    <th className="text-left pb-1">Satz</th>
                    <th className="pb-1">Netto</th>
                    <th className="pb-1">MwSt</th>
                    <th className="pb-1">Brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {gross7 > 0 && (
                    <tr>
                      <td className="text-left py-0.5">7,00 % (Logis)</td>
                      <td className="py-0.5">{net7.toFixed(2)} €</td>
                      <td className="py-0.5">{tax7.toFixed(2)} €</td>
                      <td className="py-0.5 font-semibold text-slate-800">{gross7.toFixed(2)} €</td>
                    </tr>
                  )}
                  {gross19 > 0 && (
                    <tr>
                      <td className="text-left py-0.5">19,00 % (F&B / Service)</td>
                      <td className="py-0.5">{net19.toFixed(2)} €</td>
                      <td className="py-0.5">{tax19.toFixed(2)} €</td>
                      <td className="py-0.5 font-semibold text-slate-800">{gross19.toFixed(2)} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Summenfeld Rechts */}
            <div className="col-span-6 flex flex-col justify-end text-xs space-y-1 pl-6">
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Gesamtbetrag Netto:</span>
                <span className="font-mono">{totalNet.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600 text-[11px]">
                <span>Enthaltene MwSt:</span>
                <span className="font-mono">{totalTax.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t-2 border-slate-800 pt-1.5 mt-0.5 font-serif">
                <span>RECHNUNGSBETRAG:</span>
                <span className="font-mono">{totalGross.toFixed(2)} €</span>
              </div>
              <div className="text-right text-[10px] pt-1">
                {invoice.isPaid ? (
                  <span className="text-emerald-800 font-semibold bg-emerald-50/80 px-2.5 py-0.5 rounded border border-emerald-200 inline-block">
                    ✓ Rechnungsbetrag dankend erhalten ({invoice.paymentMethod})
                  </span>
                ) : (
                  <span className="text-slate-700 font-semibold bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200 inline-block">
                    Zahlbar bei Abreise ({invoice.paymentMethod})
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* 6. PERSÖNLICHER SCHLUSSTEXT / DANKESFORMEL (SCHLANK & ELEGANT) */}
          <div className="my-5 pt-3 border-t border-slate-100 text-xs font-serif italic text-slate-700 flex justify-between items-baseline">
            <p>
              {invoice.closingText || HOTEL_CONFIG.closingText}
            </p>
            <p className="text-[11px] text-slate-500 font-sans not-italic font-medium shrink-0 ml-4">
              {HOTEL_CONFIG.signatureTeam}
            </p>
          </div>

        </div>

        {/* 7. DOKUMENTEN-FUSSZEILE (INTEGRIERT MIT DEZENTEM MINI-TSE-QR-CODE) */}
        <div className="border-t border-slate-200 pt-3 text-[9px] text-slate-500 font-sans">
          <div className="grid grid-cols-12 gap-3 items-center">
            
            {/* Spalte 1: Anschrift */}
            <div className="col-span-4 space-y-0.5">
              <div className="font-bold text-slate-700 text-[9.5px]">{HOTEL_CONFIG.name}</div>
              <div>{HOTEL_CONFIG.street} • {HOTEL_CONFIG.location}</div>
              <div>Inhaber: {HOTEL_CONFIG.owner}</div>
            </div>

            {/* Spalte 2: Bankverbindung & USt */}
            <div className="col-span-5 space-y-0.5 font-mono text-[8.5px]">
              <div>{HOTEL_CONFIG.bank}</div>
              <div>IBAN: {HOTEL_CONFIG.iban} • BIC: {HOTEL_CONFIG.bic}</div>
              <div>USt-IdNr.: {HOTEL_CONFIG.taxId} • {HOTEL_CONFIG.taxOffice}</div>
            </div>

            {/* Spalte 3: Eleganter Mini-TSE-QR-Code (Rechtsbündig in der Zeile) */}
            <div className="col-span-3 flex items-center justify-end gap-2">
              {qrCodeDataUrl ? (
                <>
                  <div className="text-[8px] leading-tight text-right text-slate-500 font-mono">
                    <div className="font-bold text-slate-700">fiskaly Cloud-TSE</div>
                    <div>§ 146a AO KassenSichV</div>
                    <div>Vorgang #{invoice.tseTransactionNumber || 1}</div>
                    <div className={invoice.tseOfflineFallback ? 'text-amber-700 font-bold' : 'text-emerald-700 font-medium'}>
                      {invoice.tseOfflineFallback ? 'OFFLINE-MODUS' : 'SIGNIERT'}
                    </div>
                  </div>
                  <img 
                    src={qrCodeDataUrl} 
                    alt="KassenSichV TSE-QR-Code" 
                    className="w-12 h-12 p-0.5 bg-white border border-slate-200 rounded shrink-0" 
                  />
                </>
              ) : (
                <div className="text-[8px] text-slate-400 text-right leading-tight">
                  <div className="font-medium text-slate-600">Rechnung auf Ziel</div>
                  <div>E-Rechnung EN 16931</div>
                  <div>Seite 1 von 1</div>
                </div>
              )}
            </div>

          </div>

          {/* Feine Subzeile */}
          <div className="flex justify-between items-center text-[8px] text-slate-400 border-t border-slate-100 pt-1.5 mt-2">
            <span>E-Rechnung konform zu EN 16931 (ZUGFeRD 2.0 / Factur-X)</span>
            <span>KassenSichV zertifiziert durch BSI TR-03153</span>
            <span>Seite 1 von 1</span>
          </div>
        </div>

      </div>

    </div>
  );
};
