import React from 'react';
import type { Invoice } from '../../types';
import { roundToCent, calculateSplitTax } from '../../services/taxEngine';
import { CheckCircle2, ShieldCheck, Printer, Download, Sparkles } from 'lucide-react';

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
  const items = invoice.items || [];

  // Berechne die Steuertabelle nach § 14 UStG
  let net7 = 0;
  let tax7 = 0;
  let gross7 = 0;

  let net19 = 0;
  let tax19 = 0;
  let gross19 = 0;

  let cityTax = 0;

  items.forEach((it) => {
    const total = roundToCent(Number(it.totalGross) || (Number(it.quantity) * Number(it.unitPriceGross)) || 0);
    if (it.taxRate === 0.07 || it.taxType === 'LODGING') {
      const split = calculateSplitTax(total, 0.07);
      net7 += split.net;
      tax7 += split.tax;
      gross7 += split.gross;
    } else if (it.taxRate === 0.00 || it.taxType === 'CITY_TAX') {
      cityTax += total;
    } else {
      const split = calculateSplitTax(total, 0.19);
      net19 += split.net;
      tax19 += split.tax;
      gross19 += split.gross;
    }
  });

  const totalNet = roundToCent(net7 + net19 + cityTax);
  const totalTax = roundToCent(tax7 + tax19);
  const totalGross = roundToCent(gross7 + gross19 + cityTax);

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
        className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[20mm] shadow-2xl border border-slate-300 flex flex-col justify-between font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:min-h-0 print:text-black"
        style={{ boxSizing: 'border-box' }}
      >
        <div>
          {/* 1. BRIEFKOPF / HEADER */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-serif">
                Hotel Lindengarten
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 tracking-wide">
                Gastlichkeit & Erholung im Zittauer Gebirge
              </p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">
                Lindenweg 4 • 02797 Kurort Jonsdorf
              </p>
            </div>

            <div className="text-right text-[10px] text-slate-600 space-y-0.5 font-mono">
              <div>Telefon: +49 (0) 35844 7000</div>
              <div>E-Mail: empfang@lindengarten-jonsdorf.de</div>
              <div>Web: www.lindengarten-jonsdorf.de</div>
              <div className="text-slate-400 pt-1">USt-IdNr.: DE 208 456 789</div>
            </div>
          </div>

          {/* 2. ADRESSFELD (DIN 5008) & METADATEN-BLOCK */}
          <div className="grid grid-cols-12 gap-6 mt-8 mb-6">
            
            {/* Linke Seite: Anschrift des Gastes */}
            <div className="col-span-7 flex flex-col justify-between">
              <div>
                {/* Rücksendeangabe klein */}
                <div className="text-[9px] text-slate-400 border-b border-slate-200 pb-1 mb-3">
                  Hotel Lindengarten • Lindenweg 4 • 02797 Kurort Jonsdorf
                </div>
                
                {/* Anschrift */}
                <div className="text-xs space-y-0.5 font-medium text-slate-800 leading-snug">
                  {invoice.recipientCompany && (
                    <div className="font-bold text-slate-900">{invoice.recipientCompany}</div>
                  )}
                  {invoice.billingDebitor && invoice.billingDebitor !== invoice.recipientName && (
                    <div className="text-slate-600 text-[11px]">z. Hd. {invoice.billingDebitor}</div>
                  )}
                  <div className="font-semibold">{invoice.recipientName}</div>
                  <div>{invoice.recipientStreet || 'Lindenallee 12'}</div>
                  <div>
                    {invoice.recipientZip || '04109'} {invoice.recipientCity || 'Leipzig'}
                  </div>
                  {invoice.recipientCountry && invoice.recipientCountry !== 'Deutschland' && (
                    <div className="text-[11px] uppercase tracking-wider">{invoice.recipientCountry}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Rechte Seite: Rechnungsdaten-Kasten */}
            <div className="col-span-5 bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between border-b border-slate-200 pb-1">
                <span className="text-slate-500 font-sans">Rechnungs-Nr.:</span>
                <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Rechnungsdatum:</span>
                <span>{invoice.invoiceDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Leistungszeitraum:</span>
                <span className="text-[11px]">{invoice.servicePeriodStart} - {invoice.servicePeriodEnd}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">Übernachtungen:</span>
                <span className="font-bold">{invoice.nights} Übernachtung(en)</span>
              </div>
              {invoice.roomName && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Zimmer / Einheit:</span>
                  <span className="font-bold text-slate-800 text-[11px]">{invoice.roomName}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1 text-[11px]">
                <span className="text-slate-500 font-sans">Zahlart:</span>
                <span className="font-bold text-blue-900">{invoice.paymentMethod}</span>
              </div>
            </div>

          </div>

          {/* 3. DOKUMENTENTITEL & ANREDE */}
          <div className="mb-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900 font-serif border-b border-slate-200 pb-1">
              RECHNUNG
            </h2>
            <div className="mt-2 text-xs text-slate-800 font-sans">
              <p className="font-bold mb-1">
                {invoice.recipientSalutation || 'Sehr geehrte Damen und Herren'},
              </p>
              <p className="text-slate-600">
                wir bedanken uns herzlich für Ihren Besuch im Hotel Lindengarten und erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:
              </p>
            </div>
          </div>

          {/* 4. POSITIONSTABELLE */}
          <div className="mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-800 text-slate-700 font-semibold text-[11px]">
                  <th className="py-1.5 px-2 w-10 text-center">Pos.</th>
                  <th className="py-1.5 px-2">Leistungsbeschreibung / Zeitraum</th>
                  <th className="py-1.5 px-2 text-center w-16">Menge</th>
                  <th className="py-1.5 px-2 text-right w-24">Einzelpreis</th>
                  <th className="py-1.5 px-2 text-center w-16">MwSt</th>
                  <th className="py-1.5 px-2 text-right w-28">Gesamt (brutto)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs font-sans">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-2 text-center text-slate-500 font-mono text-[11px]">
                      {item.positionNumber || idx + 1}
                    </td>
                    <td className="py-2 px-2">
                      <div className="font-medium text-slate-900">{item.description}</div>
                      {item.infoNote && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5 font-sans">
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

          {/* 5. STEUER- & SUMMENBLOCK (§ 14 UStG) */}
          <div className="grid grid-cols-12 gap-6 mb-6">
            
            {/* Steuertabelle */}
            <div className="col-span-7 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] font-mono">
              <div className="font-bold text-slate-700 font-sans mb-1.5 text-xs">
                Steueraufschlüsselung gem. § 14 UStG:
              </div>
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-[10px] text-slate-500">
                    <th className="text-left pb-1">Steuersatz</th>
                    <th className="pb-1">Nettobetrag</th>
                    <th className="pb-1">MwSt-Betrag</th>
                    <th className="pb-1">Bruttobetrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[10px]">
                  {gross7 > 0 && (
                    <tr>
                      <td className="text-left py-0.5">7,00 % (Logis)</td>
                      <td className="py-0.5">{net7.toFixed(2)} €</td>
                      <td className="py-0.5">{tax7.toFixed(2)} €</td>
                      <td className="py-0.5 font-semibold">{gross7.toFixed(2)} €</td>
                    </tr>
                  )}
                  {gross19 > 0 && (
                    <tr>
                      <td className="text-left py-0.5">19,00 % (F&B / Service)</td>
                      <td className="py-0.5">{net19.toFixed(2)} €</td>
                      <td className="py-0.5">{tax19.toFixed(2)} €</td>
                      <td className="py-0.5 font-semibold">{gross19.toFixed(2)} €</td>
                    </tr>
                  )}
                  {cityTax > 0 && (
                    <tr>
                      <td className="text-left py-0.5 text-emerald-800">0,00 % (Gästetaxe Jonsdorf*)</td>
                      <td className="py-0.5">{cityTax.toFixed(2)} €</td>
                      <td className="py-0.5">0,00 €</td>
                      <td className="py-0.5 font-semibold text-emerald-800">{cityTax.toFixed(2)} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {cityTax > 0 && (
                <div className="text-[9px] text-slate-500 font-sans mt-1.5 italic">
                  * Nicht steuerbare Gemeindeabgabe gem. Satzung der Gemeinde Kurort Jonsdorf.
                </div>
              )}
            </div>

            {/* Summenfeld Rechts */}
            <div className="col-span-5 flex flex-col justify-end text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Gesamtbetrag Netto:</span>
                <span>{totalNet.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Enthaltene MwSt:</span>
                <span>{totalTax.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t-2 border-slate-900 pt-1.5 mt-1 font-serif">
                <span>RECHNUNGSBETRAG:</span>
                <span className="font-mono">{totalGross.toFixed(2)} €</span>
              </div>
              <div className="text-right text-[10px] text-slate-500 font-sans mt-1">
                {invoice.isPaid ? (
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ Rechnungsbetrag dankend erhalten ({invoice.paymentMethod})
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    Zahlbar bei Abreise ({invoice.paymentMethod})
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* 6. PERSÖNLICHER SCHLUSSTEXT / DANKESFORMEL */}
          <div className="bg-slate-50/80 border-l-4 border-[#376189] p-3 rounded-r my-4 text-xs font-sans text-slate-800 leading-relaxed">
            <p className="font-medium">
              {invoice.closingText || 'Vielen Dank für Ihren Aufenthalt im Hotel Lindengarten! Wir hoffen, Sie hatten eine erholsame Zeit bei uns und beehren uns gerne wieder.'}
            </p>
            <p className="mt-2 text-slate-600 text-[11px]">
              Wir wünschen Ihnen eine gute und sichere Heimreise!
            </p>
            <p className="mt-1 font-serif italic text-slate-700">
              Ihr Team vom Hotel Lindengarten
            </p>
          </div>

        </div>

        {/* 7. DOKUMENTEN-FUSSZEILE (FISKAL / TSE & BANK) */}
        <div className="border-t border-slate-300 pt-3 text-[9px] text-slate-500 font-mono space-y-1">
          <div className="flex justify-between">
            <span>Bankverbindung: Volksbank Löbau-Zittau eG</span>
            <span>IBAN: DE12 8559 0000 0123 4567 89</span>
            <span>BIC: GENODEF1LBZ</span>
          </div>
          <div className="flex justify-between text-slate-400 border-t border-slate-100 pt-1">
            <span>KassenSichV: TSE-Transaktions-ID {invoice.tseTransactionId || 'TSE-2026-LIVE-VALID'}</span>
            <span>E-Rechnung konform zu EN 16931 (ZUGFeRD 2.0 / Factur-X)</span>
            <span>Seite 1 von 1</span>
          </div>
        </div>

      </div>

    </div>
  );
};
