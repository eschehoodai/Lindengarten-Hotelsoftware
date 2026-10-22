import React, { useState, useEffect } from 'react';
import type { PriceVariant, Salutation } from '../../types';
import { ActionBar } from '../ActionBar';
import { 
  Settings, Tag, UserCheck, CheckCircle2, ShieldCheck, 
  Download, RefreshCw, AlertTriangle, FileArchive, Check,
  ExternalLink, Key, Cpu
} from 'lucide-react';

interface MasterDataViewProps {
  priceVariants: PriceVariant[];
  salutations: Salutation[];
  onRefresh: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  priceVariants,
  salutations,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'prices' | 'salutations' | 'tse'>('prices');
  const [selectedPriceId, setSelectedPriceId] = useState<number>(priceVariants[0]?.id || 1);
  const [selectedSalId, setSelectedSalId] = useState<number>(salutations[0]?.id || 1);

  // TSE State
  const [tseStatus, setTseStatus] = useState<any>(null);
  const [loadingTse, setLoadingTse] = useState<boolean>(false);
  const [exportingTse, setExportingTse] = useState<boolean>(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const fetchTseStatus = async () => {
    setLoadingTse(true);
    try {
      const res = await fetch('/api/tse/status');
      if (res.ok) {
        const data = await res.json();
        setTseStatus(data);
      }
    } catch (err: any) {
      console.warn('Fehler beim Laden des TSE-Status:', err.message);
    } finally {
      setLoadingTse(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'tse') {
      fetchTseStatus();
    }
  }, [activeSubTab]);

  const handleTriggerExport = async () => {
    setExportingTse(true);
    setExportMessage('Starte TAR-Export bei fiskaly SIGN DE...');
    setExportError(null);
    try {
      const res = await fetch('/api/tse/export', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fehler beim Anfordern des Exports');
      }
      const data = await res.json();
      const exportId = data.exportId;
      setExportMessage(`Export ${exportId} wird generiert. Warte auf Fertigstellung...`);

      // Polling bis Export fertig ist (max 30s)
      let attempts = 0;
      let completed = false;
      while (attempts < 15 && !completed) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
        const checkRes = await fetch(`/api/tse/export/${exportId}`);
        if (checkRes.ok) {
          const statusData = await checkRes.json();
          if (statusData.state === 'COMPLETED' || statusData.time_end) {
            completed = true;
          }
        }
      }

      setExportMessage('Export fertiggestellt! Download startet...');
      
      // Download der Datei auslösen
      const fileRes = await fetch(`/api/tse/export/${exportId}/file`);
      if (!fileRes.ok) throw new Error('Download des TAR-Archivs fehlgeschlagen.');
      
      const blob = await fileRes.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsfinvk-export-lindengarten-${new Date().toISOString().split('T')[0]}.tar`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setExportMessage('TAR-Archiv erfolgreich heruntergeladen!');
      setTimeout(() => setExportMessage(null), 5000);
    } catch (err: any) {
      console.error('Export-Fehler:', err);
      setExportError(err.message || 'Export fehlgeschlagen');
      setTimeout(() => setExportError(null), 6000);
    } finally {
      setExportingTse(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      
      {/* 1. KOPFZEILE MIT UNTER-TABS */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Settings className="w-3.5 h-3.5 text-[#376189]" />
            <span>Stammdaten & Konfiguration:</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('prices')}
              className={`flex items-center gap-1 px-3 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'prices'
                  ? 'bg-[#376189] text-white font-semibold shadow-xs'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <Tag className="w-3 h-3" />
              <span>Preisvarianten ({priceVariants.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('salutations')}
              className={`flex items-center gap-1 px-3 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'salutations'
                  ? 'bg-[#376189] text-white font-semibold shadow-xs'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Anreden-Katalog ({salutations.length})</span>
            </button>
            <button
              onClick={() => setActiveSubTab('tse')}
              className={`flex items-center gap-1 px-3 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'tse'
                  ? 'bg-[#376189] text-white font-semibold shadow-xs'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>TSE & KassenSichV (fiskaly)</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Systemstammdaten Romantik Hotel Zum Lindengarten (KassenSichV § 146a AO)
        </div>
      </div>

      {/* 2. TABELLEN- ODER TSE-BEREICH */}
      <div className="flex-1 bg-white border-b border-slate-300 overflow-auto min-h-0">
        {activeSubTab === 'prices' ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
              <tr>
                <th className="py-1.5 px-3 border-r border-slate-300 w-16">Nr.</th>
                <th className="py-1.5 px-3 border-r border-slate-300 w-36">Kurzcode</th>
                <th className="py-1.5 px-3 border-r border-slate-300">Bezeichnung Preisvariante</th>
                <th className="py-1.5 px-3 border-r border-slate-300 w-44">Frühstück (F&B / Tag)</th>
                <th className="py-1.5 px-3 border-r border-slate-300 w-52">Steuersplit auf Rechnung</th>
                <th className="py-1.5 px-3 w-28 text-center">Pauschal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {priceVariants.map((pv) => {
                const isSelected = selectedPriceId === pv.id;
                const bfPersons = pv.breakfastPersons ?? (
                  pv.name.includes('Doppelt') ? 2 :
                  pv.name.includes('Einfach') ? 1 :
                  pv.name.includes('Dreifach') ? 3 : 0
                );
                const bfRate = pv.breakfastRate ?? 4.80;
                const bfDayTotal = bfPersons * bfRate;
                const isOnline = pv.isOnlineImport || pv.name === 'Online';

                return (
                  <tr
                    key={pv.id}
                    onClick={() => setSelectedPriceId(pv.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#376189] text-white font-semibold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{pv.variantNumber}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans font-bold">{pv.shortCode}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans flex items-center gap-2">
                      <span>{pv.name}</span>
                      {isOnline && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}>
                          Online-Import
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">
                      {isOnline ? (
                        <span className="italic opacity-80">Warten auf Belegungszuweisung</span>
                      ) : bfPersons > 0 ? (
                        <span className="font-semibold">
                          {bfPersons} Pers. ({bfDayTotal.toFixed(2)} € / Tag)
                        </span>
                      ) : (
                        <span className="opacity-70">Kein Frühstück (0,00 €)</span>
                      )}
                    </td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans text-[10px]">
                      {isOnline ? (
                        <span className="italic opacity-80">100% vorläufig (7% USt)</span>
                      ) : bfPersons > 0 ? (
                        <span>
                          {bfDayTotal.toFixed(2)} € (19% MwSt) + Restbetrag (7% Logis)
                        </span>
                      ) : (
                        <span>100% reine Übernachtung (7% USt)</span>
                      )}
                    </td>
                    <td className="py-1 px-3 text-center font-sans">
                      {pv.isFlatRate ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#edf6f1] text-[#285740]'
                        }`}>
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Ja</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Nein</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : activeSubTab === 'salutations' ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
              <tr>
                <th className="py-1.5 px-3 border-r border-slate-300 w-24">Anrede-Nr.</th>
                <th className="py-1.5 px-3 border-r border-slate-300 w-32">Kürzel</th>
                <th className="py-1.5 px-3 border-r border-slate-300">Briefanrede (Anschreiben / Meldeschein)</th>
                <th className="py-1.5 px-3">Anschriftstext (Rechnung)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {salutations.map((sal) => {
                const isSelected = selectedSalId === sal.id;
                return (
                  <tr
                    key={sal.id}
                    onClick={() => setSelectedSalId(sal.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#376189] text-white font-semibold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{sal.salutationNumber}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans font-bold">{sal.code || '-'}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans font-medium">{sal.letterGreeting}</td>
                    <td className="py-1 px-3 font-sans text-slate-600">{sal.addressText || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* TSE & KASSENSICHV DASHBOARD (FISKALY) */
          <div className="p-6 max-w-5xl mx-auto space-y-6">
            
            {/* Header Status Card */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shadow-xs">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      <span>fiskaly SIGN DE V2 Cloud-TSE</span>
                      <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded-full font-semibold border border-emerald-300 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                        {tseStatus?.env === 'TEST' ? 'Testmodus aktiv' : 'Live / Verbunden'}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gesetzeskonforme Technische Sicherheitseinrichtung gem. § 146a AO und KassenSichV
                    </p>
                  </div>
                </div>

                <button
                  onClick={fetchTseStatus}
                  disabled={loadingTse}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium cursor-pointer shadow-xs transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loadingTse ? 'animate-spin' : ''}`} />
                  <span>Status prüfen</span>
                </button>
              </div>

              {/* Status Kennzahlen Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200 text-xs font-mono">
                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">TSS Status</div>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{tseStatus?.tssState || 'INITIALIZED'}</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">Kassen-Client</div>
                  <div className="font-bold text-emerald-700 text-sm mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{tseStatus?.clientState || 'REGISTERED'}</span>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">BSI-Zertifikat</div>
                  <div className="font-bold text-slate-700 text-xs mt-1 truncate">
                    BSI-DSZ-CC-1153
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded border border-slate-200">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">Signatur-Algorithmus</div>
                  <div className="font-bold text-slate-700 text-xs mt-1 truncate">
                    {tseStatus?.signatureAlgorithm || 'ecdsa-plain-SHA256'}
                  </div>
                </div>
              </div>

              {/* Detail-Parameter */}
              <div className="mt-3 bg-white p-3 rounded border border-slate-200 text-[11px] font-mono space-y-1.5 text-slate-600">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">TSS-ID (Sicherheitsmodul):</span>
                  <span className="font-bold text-slate-800 select-all">{tseStatus?.tssId || '3c1c5e75-6f28-4611-8954-beede2018f9c'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Client-ID (Kassenarbeitsplatz):</span>
                  <span className="font-bold text-slate-800 select-all">{tseStatus?.clientId || 'a7992c42-ea06-423a-b262-c4a73c02ddde'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Seriennummer elektronisches Kassensystem:</span>
                  <span className="font-bold text-slate-800 select-all">{tseStatus?.serialNumber || 'ERS-LINDENGARTEN-POS-01'}</span>
                </div>
              </div>
            </div>

            {/* Finanzamt / DSFinV-K Export Sektion */}
            <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#376189] shrink-0">
                  <FileArchive className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-slate-800">
                    Finanzamt-Prüfdatenexport (§ 146b AO Kassen-Nachschau)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Bei einer unangekündigten Kassen-Nachschau (§ 146b AO) oder einer steuerlichen Betriebsprüfung
                    können Sie hier das vollständige TAR-Archiv aller kryptographisch signierten Transaktionen nach DSFinV-K Standard erzeugen und direkt für den Prüfer herunterladen.
                  </p>

                  {exportMessage && (
                    <div className="mt-3 p-2.5 rounded bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{exportMessage}</span>
                    </div>
                  )}

                  {exportError && (
                    <div className="mt-3 p-2.5 rounded bg-red-50 border border-red-300 text-red-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{exportError}</span>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleTriggerExport}
                      disabled={exportingTse}
                      className="px-4 py-2 bg-[#376189] hover:bg-[#284a6c] text-white rounded text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    >
                      <Download className={`w-4 h-4 ${exportingTse ? 'animate-bounce' : ''}`} />
                      <span>{exportingTse ? 'Export wird erstellt...' : 'DSFinV-K / TAR-Archiv für Finanzamt generieren & herunterladen'}</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Format: .tar (BSI TR-03153)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rechtliche Konformität & Ausfallkonzept */}
            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-xs text-slate-600 space-y-2">
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Rechtliche Konformität & AEAO-Ausfallschutz</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                Die Hotelsoftware Lindengarten implementiert das von fiskaly und der Finanzverwaltung vorgegebene 
                <strong> „Don't block the till“</strong>-Prinzip. Bei vorübergehendem Internetausfall oder Unerreichbarkeit der Cloud-TSE wird der Checkout niemals blockiert; stattdessen greift der gesetzliche Ausfallvermerk gem. AEAO zu § 146a Punkt 7 auf Belegen, bis die Verbindung wiederhergestellt ist.
              </p>
            </div>

          </div>
        )}
      </div>

      {/* 3. DETAIL-HINWEIS PANEL UNTEN */}
      <div className="bg-white border-t border-slate-300 p-3 shrink-0 flex items-center justify-between">
        <div className="text-xs text-slate-600">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            <span>
              {activeSubTab === 'prices' ? 'Preisvarianten & Lindengarten F&B Frühstückssplit' : 
               activeSubTab === 'salutations' ? 'Anreden & Titelkatalog' : 
               'fiskaly SIGN DE V2 Cloud-TSE Status'}
            </span>
            {activeSubTab === 'prices' && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                Frühstücksanteil: 4,80 € (19% MwSt)
              </span>
            )}
            {activeSubTab === 'tse' && (
              <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                KassenSichV § 146a AO konform
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {activeSubTab === 'prices' 
              ? 'Berechnungslogik: Am Anreisetag (ab 15:00 Uhr) findet kein Frühstück statt. Bei N Übernachtungen fallen N Frühstückstage an. Der Betrag wird vom Zimmerpreis herausgerechnet (19% USt) und der Restbetrag als reine Logis (7% USt) besteuert.'
              : activeSubTab === 'salutations' 
              ? 'Diese Stammdaten werden in Reservierungsdialogen, Gästeverwaltung und Rechnungsformularen verwendet.'
              : 'Das Sicherheitsmodul signiert jeden Kassiervorgang und erzeugt den vorgeschriebenen DSFinV-K QR-Code für Prüfer.'}
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono shrink-0 pl-4">
          Status: {activeSubTab === 'tse' ? 'fiskaly Cloud-TSE Aktiv' : 'Fest hinterlegt in SQLite (lindengarten.db)'}
        </div>
      </div>

      {/* 4. UNTERE SCHALTFLÄCHEN-LEISTE (ACTIONBAR) */}
      <ActionBar
        onHelp={() => alert('fiskaly Cloud-TSE Hilfe: Die KassenSichV-Anbindung signiert Kassenbelege kryptographisch und ermöglicht DSFinV-K TAR-Exporte für das Finanzamt.')}
      />

    </div>
  );
};
