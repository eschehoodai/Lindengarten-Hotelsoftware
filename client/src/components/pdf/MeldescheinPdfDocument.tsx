import React from 'react';
import type { Guest, Reservation, Room } from '../../types';
import { Printer, Download, CheckCircle2, X, FileText, ShieldCheck } from 'lucide-react';
import { HOTEL_CONFIG } from '../../constants/hotelConfig';

export interface MeldescheinPdfDocumentProps {
  guest: Guest;
  reservation?: Reservation;
  room?: Room;
  onPrint?: () => void;
  onClose?: () => void;
}

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return dateStr;
  } catch {
    return dateStr || '';
  }
};

export const MeldescheinPdfDocument: React.FC<MeldescheinPdfDocumentProps> = ({
  guest,
  reservation,
  room,
  onPrint,
  onClose,
}) => {
  const currentYear = new Date().getFullYear();
  const meldescheinNumber = `MS-${currentYear}-${(guest.guestNumber || '0001').replace(/^G-/, '')}${reservation ? `-${reservation.reservationNumber}` : ''}`;
  const todayStr = new Date().toISOString().split('T')[0];
  const formattedToday = formatDate(todayStr);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // Berechnung der Mitreisenden
  const companionsTotal = reservation
    ? Math.max(0, (reservation.adultsCount || 1) - 1) + (reservation.childrenCount || 0)
    : 0;

  return (
    <div className="flex flex-col items-center w-full">
      {/* DRUCK- & AKTIONSLEISTE (wird beim echten Drucken via print:hidden ausgeblendet) */}
      <div className="w-full max-w-[210mm] mb-3 flex items-center justify-between bg-slate-800 text-white px-4 py-2.5 rounded shadow print:hidden">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>DIN A4 Meldeschein (§§ 29, 30 BMG)</span>
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300 font-mono text-[11px]">{meldescheinNumber}</span>
          <span className="text-slate-400">|</span>
          <span className="text-slate-300">
            {guest.lastName}, {guest.firstName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#397356] hover:bg-[#2c5b44] text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors shadow-xs"
            title="Meldeschein drucken"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>[F6] Drucken / PDF speichern</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2.5 py-1 rounded text-xs font-medium cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Schließen</span>
            </button>
          )}
        </div>
      </div>

      {/* DAS ECHTE DIN A4 DOKUMENT (210mm x 297mm) */}
      <div
        id="meldeschein-printable"
        className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-[15mm] shadow-2xl border border-slate-300 flex flex-col justify-between font-sans print:shadow-none print:border-none print:m-0 print:p-[10mm] print:text-black"
        style={{ boxSizing: 'border-box' }}
      >
        <div>
          {/* 1. BRIEFKOPF / BEHERBERGUNGSSTÄTTE */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-serif">
                {HOTEL_CONFIG.name}
              </h1>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {HOTEL_CONFIG.street} • {HOTEL_CONFIG.location}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Telefon: {HOTEL_CONFIG.phone} • Fax: {HOTEL_CONFIG.fax} • E-Mail: {HOTEL_CONFIG.email} • Web: {HOTEL_CONFIG.web}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-slate-900 text-white text-[11px] font-bold tracking-wider px-2 py-0.5 rounded uppercase">
                Amtlicher Meldeschein
              </span>
              <div className="text-[9px] text-slate-600 font-medium mt-1">
                gem. §§ 29, 30 Bundesmeldegesetz (BMG)
              </div>
              <div className="font-mono text-xs font-bold text-slate-800 mt-1">
                {meldescheinNumber}
              </div>
            </div>
          </div>

          {/* 2. AUFENTHALTS- & ZIMMERDATEN (KOPFBLOCK) */}
          <div className="grid grid-cols-4 gap-2 my-3 p-2.5 bg-slate-50 border border-slate-300 rounded text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Zimmer-Nr.:</span>
              <span className="font-bold text-sm text-slate-900">
                {room?.roomCode || reservation?.room_code || room?.name || '__________'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ankunftstag:</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatDate(reservation?.arrivalDate) || formattedToday}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Voraussichtl. Abreise:</span>
              <span className="font-bold text-slate-900 font-mono">
                {formatDate(reservation?.departureDate) || '____.__.________'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Buchungs-Nr.:</span>
              <span className="font-mono text-slate-800 font-semibold">
                {reservation?.reservationNumber || guest.guestNumber || '-'}
              </span>
            </div>
          </div>

          {/* 3. PFLICHTANGABEN ZUR HAUPTPERSON (§ 30 ABS. 1 BMG) */}
          <div className="border border-slate-300 rounded mb-3 overflow-hidden">
            <div className="bg-slate-200 px-3 py-1 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>1. Angaben zur meldepflichtigen Person (Hauptgast)</span>
              <span className="text-[10px] font-normal text-slate-600">Pflichtfelder gem. § 30 Abs. 1 BMG</span>
            </div>

            <div className="p-3 grid grid-cols-3 gap-x-4 gap-y-2 text-xs">
              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Familienname (Nachname):</span>
                <div className="border-b border-slate-400 font-bold text-slate-900 py-0.5 min-h-[22px]">
                  {guest.lastName || ''}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Vorname(n):</span>
                <div className="border-b border-slate-400 font-medium text-slate-900 py-0.5 min-h-[22px]">
                  {guest.firstName || ''}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Geburtsdatum:</span>
                <div className="border-b border-slate-400 font-mono text-slate-900 py-0.5 min-h-[22px]">
                  {formatDate(guest.birthDate) || '____.__.________'}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Staatsangehörigkeit:</span>
                <div className="border-b border-slate-400 font-medium text-slate-900 py-0.5 min-h-[22px]">
                  {guest.nationality || 'Deutsch'}
                </div>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Straße und Hausnummer:</span>
                <div className="border-b border-slate-400 font-medium text-slate-900 py-0.5 min-h-[22px]">
                  {[guest.street, guest.houseNumber].filter(Boolean).join(' ') || ''}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Postleitzahl & Wohnort:</span>
                <div className="border-b border-slate-400 font-medium text-slate-900 py-0.5 min-h-[22px]">
                  {[guest.zipCode, guest.city].filter(Boolean).join(' ') || ''}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Wohnsitzland:</span>
                <div className="border-b border-slate-400 font-medium text-slate-900 py-0.5 min-h-[22px]">
                  {guest.country || 'Deutschland'}
                </div>
              </div>

              <div className="col-span-1">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Pass- / Personalausweis-Nr.*:
                </span>
                <div className="border-b border-slate-400 font-mono text-slate-900 py-0.5 min-h-[22px]">
                  {guest.idCardNumber || ''}
                </div>
                <span className="text-[8px] text-slate-500 block leading-tight mt-0.5">
                  *Pflichtangabe bei ausländischen Staatsangehörigen (§ 29 Abs. 2 S. 2 BMG)
                </span>
              </div>
            </div>

            {/* Freiwillige Kontaktdaten für Notfälle / Kurtaxe */}
            <div className="bg-slate-50 border-t border-slate-200 px-3 py-1.5 grid grid-cols-3 gap-3 text-[11px]">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-semibold block">Telefon (freiwillig):</span>
                <div className="border-b border-slate-300 text-slate-700 py-0.5 min-h-[18px]">
                  {guest.phone || ''}
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-[9px] text-slate-500 uppercase font-semibold block">E-Mail (freiwillig):</span>
                <div className="border-b border-slate-300 text-slate-700 py-0.5 min-h-[18px]">
                  {guest.email || ''}
                </div>
              </div>
            </div>
          </div>

          {/* 4. MITREISENDE ANGEHÖRIGE (§ 29 ABS. 2 S. 2 & 3 BMG) */}
          <div className="border border-slate-300 rounded mb-3 overflow-hidden">
            <div className="bg-slate-200 px-3 py-1 font-bold text-xs text-slate-800 flex items-center justify-between">
              <span>2. Mitreisende Angehörige (Ehegatten, Lebenspartner, minderjährige Kinder)</span>
              <span className="text-[10px] font-normal text-slate-600">
                Anzahl Mitreisende: <strong>{companionsTotal}</strong>
              </span>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[10px] text-slate-600">
                  <th className="py-1 px-2 text-left font-semibold w-10">Lfd.</th>
                  <th className="py-1 px-2 text-left font-semibold">Familienname, Vorname</th>
                  <th className="py-1 px-2 text-left font-semibold w-28">Geburtsdatum</th>
                  <th className="py-1 px-2 text-left font-semibold w-32">Staatsangehörigkeit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Zeile 1: Vorbefüllt wenn Mitreisende eingetragen */}
                <tr>
                  <td className="py-1.5 px-2 text-slate-500 font-mono">1.</td>
                  <td className="py-1.5 px-2 font-medium">
                    {reservation?.companionNames || (companionsTotal > 0 ? '(Begleitperson)' : '')}
                  </td>
                  <td className="py-1.5 px-2 font-mono text-slate-500">____.__.________</td>
                  <td className="py-1.5 px-2 text-slate-700">
                    {reservation?.companionNames ? (guest.nationality || 'Deutsch') : ''}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-slate-500 font-mono">2.</td>
                  <td className="py-1.5 px-2"></td>
                  <td className="py-1.5 px-2 font-mono text-slate-400">____.__.________</td>
                  <td className="py-1.5 px-2"></td>
                </tr>
                <tr>
                  <td className="py-1.5 px-2 text-slate-500 font-mono">3.</td>
                  <td className="py-1.5 px-2"></td>
                  <td className="py-1.5 px-2 font-mono text-slate-400">____.__.________</td>
                  <td className="py-1.5 px-2"></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 5. GÄSTETAXE / KURABGABE (KURORT JONSDORF) & REISEZWECK */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="border border-slate-300 rounded p-2.5 text-xs">
              <span className="font-bold text-slate-800 block mb-1">
                3. Art des Aufenthalts (Gemeindliche Gästetaxe):
              </span>
              <div className="space-y-1.5 text-[11px] text-slate-700">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" defaultChecked={!guest.isTaxExempt} className="rounded" />
                  <span><strong>Privataufenthalt / Urlaub</strong> (Gästetaxepflichtig nach Satzung)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" defaultChecked={Boolean(guest.isTaxExempt)} className="rounded" />
                  <span>
                    <strong>Beruflich veranlasst</strong> (Steuerbefreiung gem. Nachweis / Arbeitgeberbestätigung)
                  </span>
                </label>
                <div className="pt-1 text-[10px] text-slate-500">
                  Kurort Jonsdorf erhebt eine satzungsgemäße Kurtaxe. Gästekarten berechtigen zu zahlreichen Vergünstigungen in der Ferienregion Zittauer Gebirge.
                </div>
              </div>
            </div>

            <div className="border border-slate-300 rounded p-2.5 text-xs flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-800 block mb-1">
                  4. Fahrzeug & Hotelparkplatz:
                </span>
                <div className="mt-1">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Amtliches KFZ-Kennzeichen:
                  </span>
                  <div className="border-b border-slate-400 py-1 font-mono font-bold text-slate-900 tracking-wider">
                    {/* Freies Feld für Kennzeichen */}
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 mt-2">
                Kostenfreies Parken für Hotelgäste auf dem hauseigenen Hotelparkplatz.
              </div>
            </div>
          </div>

          {/* 6. GESETZLICHE BELEHRUNG & DATENSCHUTZHINWEISE */}
          <div className="border border-slate-200 bg-slate-50 rounded p-2 text-[9px] text-slate-600 leading-tight space-y-1">
            <div className="flex items-center gap-1 font-bold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
              <span>Gesetzliche Aufbewahrungsfrist & Information gem. Art. 13 DSGVO:</span>
            </div>
            <p>
              <strong>Aufbewahrungspflicht (§ 30 Abs. 4 Bundesmeldegesetz - BMG):</strong> Die Meldescheine sind vom Tag der Ankunft der beherbergten Person an <strong>ein Jahr aufzubewahren</strong> und innerhalb von drei Monaten nach Ablauf der Aufbewahrungsfrist von der Beherbergungsstätte datenschutzgerecht zu vernichten.
            </p>
            <p>
              <strong>Datenschutzhinweis:</strong> Die Verarbeitung Ihrer personenbezogenen Daten erfolgt ausschließlich zur Erfüllung der gesetzlichen Meldepflicht (§§ 29, 30 BMG), zur steuerlichen Abrechnung der gemeindlichen Gästetaxe (Sächsisches Kommunalabgabengesetz) und der ordnungsgemäßen Abwicklung Ihres Beherbergungsvertrags. Eine Weitergabe erfolgt nur an berechtigte Behörden im Rahmen der gesetzlichen Vorschriften.
            </p>
          </div>
        </div>

        {/* 7. UNTERSCHRIFT & DATUM */}
        <div className="pt-4 border-t-2 border-slate-800 mt-3">
          <div className="text-[10px] text-slate-600 italic mb-4">
            Ich bestätige hiermit die Richtigkeit und Vollständigkeit der vorstehend gemachten Angaben gem. § 30 BMG.
          </div>

          <div className="grid grid-cols-2 gap-8 items-end">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ort und Datum:</span>
              <div className="border-b border-slate-800 py-1 font-medium text-slate-900 text-xs">
                {HOTEL_CONFIG.city}, den {formattedToday}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                Eigenhändige Unterschrift des Gastes (§ 30 Abs. 1 BMG):
              </span>
              <div className="border-b-2 border-slate-800 py-5 text-center text-xs text-slate-400">
                {/* Unterschriftsbereich */}
                <span className="text-[9px] text-slate-400 block pt-4">X (Unterschrift der meldepflichtigen Person)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[8px] text-slate-400 pt-3 mt-2 border-t border-slate-200">
            <span>{HOTEL_CONFIG.dinReturnLine}</span>
            <span>Konform zu §§ 29, 30 BMG & SächsKAG</span>
            <span>Seite 1 von 1</span>
          </div>
        </div>
      </div>
    </div>
  );
};
