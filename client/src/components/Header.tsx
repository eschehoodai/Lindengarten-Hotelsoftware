import React, { useState, useEffect } from 'react';
import { Calendar, Users, DoorClosed, FileText, Settings, RefreshCw, Building2, User } from 'lucide-react';

export type TabType = 'timeline' | 'guests' | 'rooms' | 'invoices' | 'settings';

interface HeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  serverStatus: 'online' | 'offline';
  onRefresh: () => void;
  isLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  serverStatus,
  onRefresh,
  isLoading,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      };
      setCurrentTime(now.toLocaleDateString('de-DE', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-3 py-1 bg-slate-800 text-white border-b border-slate-700 shadow-sm shrink-0 select-none">
      {/* Links: Logo & Name */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 bg-emerald-600/30 border border-emerald-500/50 px-2 py-0.5 rounded text-xs font-semibold text-emerald-300">
          <Building2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Hotel Lindengarten</span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
          ELAN Web-Desktop v2.0
        </span>
      </div>

      {/* Mitte: Modul-Tabs mit F-Tasten Shortcuts */}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => onTabChange('timeline')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Zimmerbelegungsplan (F1)"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>[F1] Belegung</span>
        </button>

        <button
          onClick={() => onTabChange('guests')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
            activeTab === 'guests'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Gästestamm & Adressen (F2)"
        >
          <Users className="w-3.5 h-3.5" />
          <span>[F2] Gäste</span>
        </button>

        <button
          onClick={() => onTabChange('rooms')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
            activeTab === 'rooms'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Zimmerstamm & Housekeeping (F3)"
        >
          <DoorClosed className="w-3.5 h-3.5" />
          <span>[F3] Zimmer</span>
        </button>

        <button
          onClick={() => onTabChange('invoices')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
            activeTab === 'invoices'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Kasse, Folio-Split & Rechnungen (F4)"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>[F4] Kasse & Rechnungen</span>
        </button>

        <button
          onClick={() => onTabChange('settings')}
          className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Stammdaten & Preise (F5)"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>[F5] Stammdaten</span>
        </button>
      </nav>

      {/* Rechts: Status, Angemeldet CHEF, Datum & Uhrzeit */}
      <div className="flex items-center gap-3 text-xs">
        {/* Benutzer CHEF */}
        <div className="hidden md:flex items-center gap-1 text-slate-300 bg-slate-700/50 px-2 py-0.5 rounded text-[11px]">
          <User className="w-3 h-3 text-amber-400" />
          <span>Angemeldet: <strong>CHEF</strong></span>
        </div>

        {/* Uhrzeit */}
        <span className="text-slate-300 text-[11px] font-mono hidden lg:inline">
          {currentTime || '10. Okt 2026 15:00'}
        </span>

        {/* LAN DB Status */}
        <div className="flex items-center gap-1.5 bg-slate-900/70 px-2 py-0.5 rounded border border-slate-700">
          <span
            className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px] text-slate-300">
            {serverStatus === 'online' ? 'LAN-DB Online' : 'Offline'}
          </span>
        </div>

        {/* Refresh Button */}
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
          title="Daten neu synchronisieren"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
};
