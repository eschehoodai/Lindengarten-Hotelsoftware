import React, { useState, useEffect, useCallback } from 'react';
import type {
  Dirs21Config,
  ChannelRoomMapping,
  ChannelSyncLog,
} from '../../types';
import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Server,
  Layers,
  FileCode,
  PlayCircle,
  Copy,
  ExternalLink,
  Save,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Database,
  Sparkles,
} from 'lucide-react';

export const ChannelManagerTab: React.FC = () => {
  const [config, setConfig] = useState<Dirs21Config | null>(null);
  const [mappings, setMappings] = useState<ChannelRoomMapping[]>([]);
  const [logs, setLogs] = useState<ChannelSyncLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [pingStatus, setPingStatus] = useState<{ success?: boolean; message?: string; pingMs?: number } | null>(null);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [syncLoading, setSyncLoading] = useState<boolean>(false);
  const [pollLoading, setPollLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ChannelSyncLog | null>(null);
  const [simScenario, setSimScenario] = useState<'clean' | 'tetris' | 'december' | 'cancel'>('clean');

  // Daten abrufen
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, mapRes, logsRes] = await Promise.all([
        fetch('/api/channel/config').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/channel/mappings').then((r) => (r.ok ? r.json() : [])),
        fetch('/api/channel/logs?limit=40').then((r) => (r.ok ? r.json() : [])),
      ]);
      if (cfgRes) setConfig(cfgRes);
      if (Array.isArray(mapRes)) setMappings(mapRes);
      if (Array.isArray(logsRes)) setLogs(logsRes);
    } catch (err) {
      console.warn('ChannelManagerTab loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Config speichern
  const handleSaveConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    setSaving(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/channel/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const saved = await res.json();
        setConfig(saved);
        setActionMessage('✅ Einstellungen & Zugangsdaten erfolgreich gespeichert.');
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err: any) {
      setActionMessage('❌ Fehler beim Speichern: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Verbindungstest
  const handleTestConnection = async () => {
    setPingLoading(true);
    setPingStatus(null);
    try {
      const res = await fetch('/api/channel/test-connection', { method: 'POST' });
      const data = await res.json();
      setPingStatus(data);
      loadData();
    } catch (err: any) {
      setPingStatus({ success: false, message: 'Netzwerkfehler: ' + err.message });
    } finally {
      setPingLoading(false);
    }
  };

  // Full-Sync manuell anstoßen
  const handleFullSync = async () => {
    setSyncLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/channel/sync-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookaheadDays: config?.syncLookaheadDays || 365 }),
      });
      const data = await res.json();
      setActionMessage(`🚀 ${data.message}`);
      await loadData();
    } catch (err: any) {
      setActionMessage('❌ Fehler beim Full Sync: ' + err.message);
    } finally {
      setSyncLoading(false);
    }
  };

  // Inbound Polling manuell anstoßen
  const handlePollNow = async () => {
    setPollLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/channel/poll-now', { method: 'POST' });
      const data = await res.json();
      setActionMessage(`📥 Polling durchgeführt: ${data.processedCount} Buchung(en) verarbeitet.`);
      await loadData();
    } catch (err: any) {
      setActionMessage('❌ Fehler beim Polling: ' + err.message);
    } finally {
      setPollLoading(false);
    }
  };

  // Mock-Buchung simulieren
  const handleSimulateBooking = async () => {
    try {
      const res = await fetch('/api/channel/simulate-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: simScenario }),
      });
      const data = await res.json();
      const pRes = data.processResult;
      if (pRes?.actionTaken === 'UNASSIGNED_TETRIS') {
        setActionMessage(`⚠️ Test-Buchung (${pRes.guestName}) eingegangen: Kein einzelnes Zimmer durchgehend frei! In Belegungsplan-Zeile 'Unzugewiesen' eingereiht.`);
      } else if (pRes?.actionTaken === 'CREATED') {
        setActionMessage(`✅ Test-Buchung (${pRes.guestName}) erfolgreich Zimmer '${pRes.roomName || 'Zimmer'}' zugewiesen!`);
      } else if (pRes?.actionTaken === 'CANCELLED') {
        setActionMessage(`ℹ️ Stornierung simuliert (${data.booking.externalReservationId}): Zimmer wieder freigegeben.`);
      } else {
        setActionMessage(`✅ Online-Buchung (${data.booking.externalReservationId}) verarbeitet: ${pRes?.actionTaken || 'OK'}`);
      }
      await loadData();
    } catch (err: any) {
      setActionMessage('❌ Simulationsfehler: ' + err.message);
    }
  };

  // Mapping aktualisieren
  const handleUpdateMapping = async (id: number, channelRoomId: string, channelRoomName: string) => {
    try {
      const res = await fetch(`/api/channel/mappings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelRoomId, channelRoomName }),
      });
      if (res.ok) {
        const updated = await res.json();
        setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)));
      }
    } catch (err) {
      console.warn('Mapping update failed:', err);
    }
  };

  if (loading && !config) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span>Lade DIRS21 Konfiguration...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-slate-100 font-sans select-none space-y-5">
      
      {/* 1. TOP STATUS BAR */}
      <div className="bg-white border border-slate-300 rounded-lg p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-[#376189] shadow-xs">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">DIRS21 Channel Manager (2-Wege Light)</h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                config?.isActive
                  ? config.environment === 'production'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : config.environment === 'sandbox'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}>
                {config?.isActive ? `● Aktiv (${config.environment.toUpperCase()})` : '○ Inaktiv'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatischer Kontingentabgleich & Abholung von Online-Buchungen (Booking.com, Expedia, DIRS21 IBE)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-xs font-semibold border border-slate-300 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Aktualisieren</span>
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-blue-50 border border-blue-300 rounded text-xs text-blue-900 flex items-center justify-between shadow-xs">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="font-bold hover:text-blue-950 cursor-pointer">×</button>
        </div>
      )}

      {/* 2. GRID MIT CONFIG & AKTIONEN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CARD 1: ZUGANGSDATEN & VERBINDUNG */}
        <form onSubmit={handleSaveConfig} className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Server className="w-4 h-4 text-[#376189]" />
              <span>1. Schnittstellen-Zugangsdaten (DIRS21 API)</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">dirs21_config.json</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">DIRS21 Hotel-ID / Lizenznr.:</label>
              <input
                type="text"
                value={config?.hotelId || ''}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, hotelId: e.target.value } : null)}
                placeholder="z. B. 28491"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-[#376189]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">API-Benutzername:</label>
              <input
                type="text"
                value={config?.username || ''}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, username: e.target.value } : null)}
                placeholder="z. B. lindengarten_api"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-[#376189]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">API-Passwort / Token:</label>
              <input
                type="password"
                value={config?.password || ''}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, password: e.target.value } : null)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none focus:border-[#376189]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Betriebsmodus (Environment):</label>
              <select
                value={config?.environment || 'mock'}
                onChange={(e: any) => setConfig((prev) => prev ? { ...prev, environment: e.target.value } : null)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-semibold text-slate-800 focus:outline-none focus:border-[#376189]"
              >
                <option value="mock">🟢 Mock-Simulator (Lokale Test-Engine)</option>
                <option value="sandbox">🟡 Sandbox (DIRS21 Test-Umgebung)</option>
                <option value="production">🔴 Produktion (Scharfer Echtbetrieb)</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">WebService V2 Endpunkt-URL:</label>
            <input
              type="text"
              value={config?.endpointUrl || ''}
              onChange={(e) => setConfig((prev) => prev ? { ...prev, endpointUrl: e.target.value } : null)}
              placeholder="https://soap.dirs21.de/WebServiceV2/"
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-800 text-[11px] focus:outline-none focus:border-[#376189]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-1">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Inbound Polling-Intervall:</label>
              <select
                value={config?.pollingIntervalSeconds || 120}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, pollingIntervalSeconds: Number(e.target.value) } : null)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              >
                <option value={60}>Jede Minute (60s)</option>
                <option value={120}>Alle 2 Minuten (120s - Standard)</option>
                <option value={300}>Alle 5 Minuten (300s)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Outbound Sync-Puffer:</label>
              <select
                value={config?.syncIntervalSeconds || 15}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, syncIntervalSeconds: Number(e.target.value) } : null)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800"
              >
                <option value={10}>10 Sekunden (Schnell)</option>
                <option value={15}>15 Sekunden (Debounced)</option>
                <option value={30}>30 Sekunden (Gebündelt)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-200">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={pingLoading}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded text-xs font-semibold border border-slate-300 cursor-pointer transition-colors"
            >
              <Radio className={`w-3.5 h-3.5 text-[#376189] ${pingLoading ? 'animate-pulse' : ''}`} />
              <span>{pingLoading ? 'Prüfe Verbindung...' : 'Verbindung testen'}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 bg-[#376189] hover:bg-[#2b4c6d] text-white px-4 py-1.5 rounded text-xs font-semibold shadow-xs cursor-pointer transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Speichert...' : 'Zugangsdaten speichern'}</span>
            </button>
          </div>

          {pingStatus && (
            <div className={`p-2.5 rounded text-xs border ${
              pingStatus.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}>
              <div className="font-bold flex items-center justify-between">
                <span>{pingStatus.success ? '✅ Verbindung erfolgreich!' : '❌ Verbindung fehlgeschlagen'}</span>
                {pingStatus.pingMs && <span className="font-mono text-[10px]">{pingStatus.pingMs} ms</span>}
              </div>
              <div className="mt-1 text-[11px] opacity-90">{pingStatus.message}</div>
            </div>
          )}
        </form>

        {/* CARD 2: MANUELLER SYNC & TEST-SIMULATOR */}
        <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <PlayCircle className="w-4 h-4 text-[#397356]" />
                <span>2. Manuelle Aktionen & Test-Simulator</span>
              </h3>
              <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                2-Wege Light
              </span>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-800">Vollständiger Verfügbarkeitsabgleich (Full Sync)</div>
                  <div className="text-slate-500 text-[11px]">Berechnet alle 4 Zimmerkategorien für 365 Tage neu und pusht Kontingente.</div>
                </div>
                <button
                  onClick={handleFullSync}
                  disabled={syncLoading}
                  className="bg-[#376189] hover:bg-[#2b4c6d] text-white px-3 py-1.5 rounded font-semibold text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
                >
                  {syncLoading ? 'Synchronisiere...' : 'Jetzt pushen'}
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-800">Buchungsabruf (Inbound Polling)</div>
                  <div className="text-slate-500 text-[11px]">Fragt sofort aktiv bei DIRS21 nach neuen Buchungen, Änderungen und Stornos.</div>
                </div>
                <button
                  onClick={handlePollNow}
                  disabled={pollLoading}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded font-semibold text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
                >
                  {pollLoading ? 'Frage ab...' : 'Jetzt abrufen'}
                </button>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2 text-xs">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Online-Buchungs-Simulator (für Vorab-Tests)</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Simuliert den Eingang einer echten OTA-Buchung, um das Eintragen in den Kalender zu prüfen:
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <select
                    value={simScenario}
                    onChange={(e: any) => setSimScenario(e.target.value)}
                    className="flex-1 bg-white border border-amber-300 rounded px-2.5 py-1 text-xs text-slate-800"
                  >
                    <option value="clean">🟢 Standard: Doppelzimmer frei (Direktzuweisung in freies Zimmer)</option>
                    <option value="tetris">⚠️ Überbucht / Kollision: Einzelzimmer belegt (Garantiert in 'Unzugewiesen')</option>
                    <option value="december">📅 Zukunftsmonat: Buchung für Dezember 2026 (11.12. - 15.12.2026)</option>
                    <option value="cancel">🔴 Stornierung: Gast storniert via Portal</option>
                  </select>
                  <button
                    onClick={handleSimulateBooking}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1 rounded font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-xs"
                  >
                    Simulieren
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Vorteil des 2-Wege Light Ansatzes:</span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Preise, Frühbucher-Rabatte und Mindestaufenthalte pflegst du wie gewohnt zu 100% im DIRS21-Cockpit. 
              Unser PMS kümmert sich ausschließlich um die sekundengenaue Anzahl freier Zimmer und das fehlerfreie Einpflegen neuer Gäste.
            </p>
          </div>
        </div>

      </div>

      {/* 3. KATEGORIE-MAPPING TABELLE */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#376189]" />
              <span>3. Zimmerkategorie-Mapping (PMS ↔ DIRS21)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Zuordnung der 4 Lindengarten-Kategorien zu den entsprechenden DIRS21 Room Type IDs
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {mappings.length} Kategorien
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold">
                <th className="py-2 px-3">PMS-Kategorie</th>
                <th className="py-2 px-3">Kategoriename</th>
                <th className="py-2 px-3">DIRS21 Room-ID</th>
                <th className="py-2 px-3">DIRS21 Kategoriename</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {mappings.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-2 px-3 font-mono font-bold text-[#376189]">{m.categoryCode}</td>
                  <td className="py-2 px-3 font-medium text-slate-800">{m.categoryName}</td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      defaultValue={m.channelRoomId}
                      onBlur={(e) => handleUpdateMapping(m.id, e.target.value, m.channelRoomName)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs w-28 focus:outline-none focus:border-[#376189]"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="text"
                      defaultValue={m.channelRoomName}
                      onBlur={(e) => handleUpdateMapping(m.id, m.channelRoomId, e.target.value)}
                      className="bg-white border border-slate-300 rounded px-2 py-1 text-xs w-48 focus:outline-none focus:border-[#376189]"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] border border-emerald-300">
                      Aktiv
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right">
                    <span className="text-[11px] text-slate-400">Automatisch synchronisiert</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. REVISIONS-LOGS & ZERTIFIZIERUNGS-PROTOKOLL */}
      <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Database className="w-4 h-4 text-[#376189]" />
              <span>4. Revisionssicheres Sync-Protokoll (DIRS21 Zertifizierungs-Logs)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Vollständige Aufzeichnung aller ausgehenden Verfügbarkeits-Pushes und eingehenden Buchungsabrufe inklusive XML-Rohdaten
            </p>
          </div>
          <span className="text-xs text-slate-500">Letzte {logs.length} Einträge</span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-200 rounded">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100 border-b border-slate-300 font-bold text-slate-700 z-10">
              <tr>
                <th className="py-2 px-3">Zeitstempel</th>
                <th className="py-2 px-3">Richtung</th>
                <th className="py-2 px-3">Aktion</th>
                <th className="py-2 px-3">Dauer</th>
                <th className="py-2 px-3 text-center">Status</th>
                <th className="py-2 px-3 text-right">XML-Inspektor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500 font-sans text-xs">
                    Noch keine Übertragungen protokolliert. Klicke oben auf "Jetzt pushen" oder "Jetzt abrufen".
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-1.5 px-3 text-slate-600">
                      {new Date(log.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-1.5 px-3">
                      <span className={`inline-flex items-center gap-1 font-bold ${
                        log.direction === 'INBOUND' ? 'text-emerald-700' : 'text-blue-700'
                      }`}>
                        {log.direction === 'INBOUND' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        <span>{log.direction}</span>
                      </span>
                    </td>
                    <td className="py-1.5 px-3 font-semibold text-slate-800">{log.action}</td>
                    <td className="py-1.5 px-3 text-slate-600">{log.durationMs} ms</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {log.responseStatus || 200} {log.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[#376189] hover:text-[#2b4c6d] font-bold flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>XML ansehen</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL: XML INSPEKTOR */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-300">
            
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-sm">
                  DIRS21 Protokoll-Inspektor #{selectedLog.id} – {selectedLog.action}
                </span>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">
                  {selectedLog.direction}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 font-mono text-xs bg-slate-50">
              <div>
                <div className="flex items-center justify-between text-slate-700 font-bold mb-1">
                  <span>Gesendeter Request ({selectedLog.direction}):</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(selectedLog.requestPayload)}
                    className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>In Zwischenablage kopieren</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded text-[11px] overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                  {selectedLog.requestPayload}
                </pre>
              </div>

              {selectedLog.responsePayload && (
                <div>
                  <div className="flex items-center justify-between text-slate-700 font-bold mb-1">
                    <span>Empfangene Antwort (DIRS21 Response):</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedLog.responsePayload || '')}
                      className="flex items-center gap-1 text-[11px] text-blue-700 hover:underline cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>In Zwischenablage kopieren</span>
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-emerald-300 rounded text-[11px] overflow-x-auto max-h-56 leading-relaxed whitespace-pre-wrap">
                    {selectedLog.responsePayload}
                  </pre>
                </div>
              )}
            </div>

            <div className="bg-slate-100 px-4 py-2 border-t border-slate-300 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-1.5 rounded text-xs font-semibold cursor-pointer"
              >
                Schließen
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
