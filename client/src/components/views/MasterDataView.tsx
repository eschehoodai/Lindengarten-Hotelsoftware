import React, { useState } from 'react';
import type { PriceVariant, Salutation } from '../../types';
import { ActionBar } from '../ActionBar';
import { Settings, Tag, UserCheck, CheckCircle2 } from 'lucide-react';

interface MasterDataViewProps {
  priceVariants: PriceVariant[];
  salutations: Salutation[];
  onRefresh: () => void;
}

export const MasterDataView: React.FC<MasterDataViewProps> = ({
  priceVariants,
  salutations,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'prices' | 'salutations'>('prices');
  const [selectedPriceId, setSelectedPriceId] = useState<number>(priceVariants[0]?.id || 1);
  const [selectedSalId, setSelectedSalId] = useState<number>(salutations[0]?.id || 1);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-200 select-none">
      
      {/* 1. KOPFZEILE MIT UNTER-TABS */}
      <div className="bg-slate-100 border-b border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Settings className="w-3.5 h-3.5 text-blue-600" />
            <span>Stammdaten & Konfiguration:</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveSubTab('prices')}
              className={`flex items-center gap-1 px-3 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                activeSubTab === 'prices'
                  ? 'bg-blue-600 text-white font-semibold'
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
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Anreden-Katalog ({salutations.length})</span>
            </button>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 font-mono">
          Systemstammdaten Hotel Lindengarten (ELAN hogatec Format)
        </div>
      </div>

      {/* 2. TABELLENBEREICH */}
      <div className="flex-1 bg-white border-b border-slate-300 overflow-auto min-h-0">
        {activeSubTab === 'prices' ? (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-10 border-b border-slate-300 text-slate-700 font-semibold text-[11px]">
              <tr>
                <th className="py-1.5 px-3 border-r border-slate-300 w-24">Nr.</th>
                <th className="py-1.5 px-3 border-r border-slate-300 w-32">Kurzcode</th>
                <th className="py-1.5 px-3 border-r border-slate-300">Bezeichnung Preisvariante</th>
                <th className="py-1.5 px-3 w-32 text-center">Pauschalrechnung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {priceVariants.map((pv) => {
                const isSelected = selectedPriceId === pv.id;
                return (
                  <tr
                    key={pv.id}
                    onClick={() => setSelectedPriceId(pv.id)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <td className="py-1 px-3 border-r border-slate-200/50 font-bold">{pv.variantNumber}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans font-bold">{pv.shortCode}</td>
                    <td className="py-1 px-3 border-r border-slate-200/50 font-sans">{pv.name}</td>
                    <td className="py-1 px-3 text-center font-sans">
                      {pv.isFlatRate ? (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          isSelected ? 'bg-emerald-400 text-slate-900' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>Ja (Pauschal)</span>
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
        ) : (
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
                        ? 'bg-blue-600 text-white font-semibold'
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
        )}
      </div>

      {/* 3. DETAIL-HINWEIS PANEL UNTEN */}
      <div className="h-24 bg-white border-t border-slate-300 p-3 shrink-0 flex items-center justify-between">
        <div className="text-xs text-slate-600">
          <div className="font-bold text-slate-800">
            {activeSubTab === 'prices' ? 'Preisvarianten-Konfiguration' : 'Anreden & Titelkatalog'}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Diese Stammdaten werden in Reservierungsdialogen, Gästeverwaltung und Rechnungsformularen verwendet.
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Status: Fest hinterlegt in SQLite (lindengarten.db)
        </div>
      </div>

      {/* 4. AKTIONLEISTE */}
      <ActionBar
        onSelect={() => {}}
        canSelect={false}
        canEdit={false}
        canDelete={false}
      />
    </div>
  );
};
