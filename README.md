# 🏨 Hotelsoftware Lindengarten (Modern Web-Desktop v2.0)

Eine moderne, webbasierte Desktop-Hotelsoftware für das **Hotel Lindengarten**, entwickelt als Nachfolger der 20 Jahre alten Windows-Legacy-Software (*ELAN hogatec*). 

Das System ist für den **parallelen Mehrplatz-Betrieb (Multi-Client LAN)** an 2 Rezeptions-PCs ausgelegt und verbindet moderne Web-Technologien (React 19, Tailwind CSS v4, SQLite/LibSQL) mit der bewährten, datendichten Ergonomie und vollständigen Tastatursteuerung (`F1`–`F9`, `Esc`, Pfeiltasten) von Desktop-Anwendungen.

---

## 🚀 Technologie-Stack

| Schicht | Technologie | Details |
| :--- | :--- | :--- |
| **Frontend** | **React 19 + TypeScript** | Typsicher, performant, keine störenden Außen-Scrollbalken |
| **Styling** | **Tailwind CSS v4** | CSS Grid Layouts, Master-Detail Split-Screen, hohe Datendichte |
| **Timeline & DnD** | **@dnd-kit/core** | 2D-Zimmerbelegungsplan, Kollisionserkennung & Buchungsschutz |
| **Backend & API** | **Node.js (TypeScript) + Express** | RESTful LAN-Server auf Port 3001 |
| **Datenbank & ORM** | **SQLite / LibSQL + Drizzle ORM** | Schnelle, dateibasierte LAN-Datenbank (`lindengarten.db`) |
| **Testing** | **Vitest** | 100% Testabdeckung der Steuer- und Rundungslogik |
| **Compliance** | **fiskaly KassenSichV & ZUGFeRD 2.0** | Cloud-TSE mit Offline-Resilienz & Factur-X / EN 16931 |

---

## 📌 Umgesetzte Module & Phasen

### ✅ Phase 1: Datenmodellierung & Fullstack-Scaffold
- SQLite-Schema (`db/schema.ts`) via Drizzle ORM für Gäste, Zimmer, Reservierungen, Rechnungen, Folios, Preisvarianten und Anreden.
- Seeding aller 14 realen Lindengarten-Zimmer (*1, 2, 4, 5, Tobias, Annie, Herman, Prinze, Stall, Scheun, Schupp, Heubod, Kammer, Luisa*).
- Express REST-Server (`server/`) und Vite + React 19 Frontend (`client/`).

### ✅ Phase 2: UI-Architektur, Master-Detail & Hotkeys
- **Tastatursteuerung & Aktionsleiste:** `[F6]` Wählen/Status, `[F7]` Neu, `[F8]` Kopieren, `[F9]` Ändern/Speichern, `[Entf]` Löschen, `[Esc]` Abbrechen.
- **[F1] Belegung:** Modulwechsel & Belegungsübersicht.
- **[F2] Gäste:** Gästestamm mit Adressverwaltung, Bundesmeldegesetz-Pflichtfeldern (Ausweisnr., Nationalität) und Leipzig City-Tax Befreiungsprüfung (`isTaxExempt`).
- **[F3] Zimmer:** Zimmerstamm mit Schnellfiltern (`DZ`, `EZ`, `TBZ`, `SUITE`, `⚠️ Nur Schmutzig`) und Live-Housekeeping Status (`Sauber` vs. `Dirty`).
- **[F5] Stammdaten:** Kataloge für Preisvarianten und Anreden.
- **Dialoge:**
  - `ReservationDialog`: Buchungsmaske mit Zimmerauswahl, Reisedaten, Preisfindung und F&B Verpflegungsmatrix (*Fr, Mt, KT, Ab*).
  - `StatusDialog`: Check-In/Check-Out Schalter, Buchungsschutz (`isLockedToRoom`) und RFID-Türschloss-Schnittstelle (`[F9] Schlüssel schreiben`).

### ✅ Phase 3: Steuer- & Abrechnungslogik (inkl. Leipziger City Tax)
- **§ 12 UStG Aufteilung:** Logis (7% USt) vs. F&B/Services (19% USt) vs. Befreit (0% USt).
- **Leipziger Beherbergungssteuer:** 5,00% auf reines Logisbrutto, **strikte cent-genaue Abrundung** (`Math.floor`) nach Satzung der Stadt Leipzig und Befreiungsprüfung.
- **Dreifach-Folio-Splitting:** Aufteilung in Folio A (Logis/Firma), Folio B (Gastkonto/Auslagen) und Folio C (Sonderposten) mit dynamischer Umbuchung.
- **Vitest Unit-Tests:** 23 Tests mit 100% Erfolgsquote (`npm test`).

### ✅ Phase 4: Interaktiver 2D Timeline-Scheduler
- Grafischer Zimmerbelegungsplan nach Bild 01 der ELAN hogatec Software:
  - Vertikal: Alle 14 Lindengarten Zimmer mit Housekeeping-Zustand.
  - Horizontal: Kalendertage mit **signalrot markierten Samstagen und Sonntagen** (`Sa`/`So`).
  - Buchungsbalken mit Gastname, Nächteanzahl, Buchungsstatus `[r]` (Magenta) und Sperr-Icon 🔒.
- **Drag-and-Drop mit `@dnd-kit/core`:**
  - Buchungen können per DnD auf andere Zimmer verschoben werden.
  - Fest gebuchte Zimmer (`isLockedToRoom`) sperren Drag-and-Drop.
  - Striktes Verhindern von Doppelbelegungen durch Kollisionsprüfung.
- **Schnellinfo-Bar:** Live-Statuszeile am unteren Bildschirmrand.
- **Ansichts-Umschalter:** 1-Klick-Wechsel zwischen 2D-Timeline und tabellarischer Buchungsliste.

---

## 🛠️ Installation & Lokale Ausführung

### Voraussetzungen
- Node.js (Version 20+ empfohlen)
- Git

### 1. Repository klonen & Abhängigkeiten installieren
```bash
git clone https://github.com/eschehoodai/Lindengarten-Hotelsoftware.git
cd Lindengarten-Hotelsoftware

# Server-Abhängigkeiten installieren
cd server
npm install

# Client-Abhängigkeiten installieren
cd ../client
npm install
cd ..
```

### 2. Datenbank initialisieren (Optional / Neu-Seed)
```bash
npm run seed
```

### 3. Entwicklungsserver starten
In zwei separaten Terminals:

**Terminal 1 (Backend REST-Server auf Port 3001):**
```bash
npm run dev:server
```

**Terminal 2 (Frontend Client auf Port 5174 / 5173):**
```bash
npm run dev:client
```

Der Client ist im Browser unter `http://localhost:5174/` (bzw. im lokalen Netzwerk über die IP des Haupt-PCs) erreichbar.

### 4. Tests ausführen
```bash
npm test
```

---

## 📑 Lizenz & Dokumentation
Entwickelt für das **Hotel Lindengarten**. Detaillierte Architekturentscheidungen und Domain-Analysen befinden sich in [`WORKPAPER.md`](./WORKPAPER.md) und [`Konzept.txt`](./Konzept.txt).
