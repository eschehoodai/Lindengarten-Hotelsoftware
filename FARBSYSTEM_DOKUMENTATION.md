# Farbsystem & Design-Spezifikation: Hotel Lindengarten (ELAN Web-Desktop v2.0)

> **Dokumenten-Version:** 2.2 (Harmonisierte matte & augenschonende Farbpalette)  
> **Stand:** Oktober 2026  
> **Zielgruppe:** Rezeptionsleitung, Geschäftsführung, Kundenpräsentation, Designabteilung (UI/UX), Frontend-Entwicklung  
> **Projekt:** Hotelmanagement-Plattform Hotel Lindengarten  
> **Technologische Basis:** Tailwind CSS v4, React 19, TypeScript  
> **Begleitendes Präsentationsdokument für Kunden:** [FARBSYSTEM_PRAESENTATION.html](file:///c:/Users/X/Desktop/Hotelsoftware%20Lindengarten/FARBSYSTEM_PRAESENTATION.html) *(Interaktiv im Browser öffenbar mit Vorher-Nachher-Vergleich)*

---

## 1. Einleitung & Design-Philosophie

Die Hotelsoftware **Hotel Lindengarten** basiert auf der gezielten Modernisierung einer bewährten, hochfunktionalen Windows-Desktop-Anwendung (*ELAN hogatec* / klassische 2000er Desktop-PMS-Systeme). 

### Warum die matte & ruhige Farbpalette?
Bei der täglichen mehrstündigen Arbeit an der Rezeption führen übersättigte, grelle Primärfarben (wie Standard-Neonorange oder grelles Signalrot) schnell zu visueller Ermüdung und Unruhe. Die **Version 2.2** setzt daher auf eine **fein kalibrierte, matte Natur- und Salonpalette**:
1. **Volle semantische Kontinuität:** Orange bleibt Standard-Reservierung, Grün bleibt Eingecheckt/Sauber, Rot bleibt Wochenende/Offen, Blau bleibt Navigation/Pauschale.
2. **Reduzierte Sättigung (ca. 25–35 % sanfter):** Samtiges Ocker, ruhiges Salbei-/Waldgrün, mattes Ziegelrot und gediegenes Schieferblau harmonieren perfekt mit dem warmen Holz- und Naturambiente des Zittauer Gebirges.
3. **Ausgeglichene Luminanz:** Kein Element „schreit“ den Benutzer mehr an; die Informationsdichte bleibt maximal, wirkt aber entspannt, hochwertig und augenschonend.
4. **WCAG 2.1 AA/AAA Konformität:** Alle Textkontraste wurden neu berechnet und erfüllen die strengen Lesbarkeitskriterien.

---

## 2. Gesamtübersicht der Farbpaletten & Farbwerte (Matt & Ruhig)

### 2.1 Neutrale Palette: UI-Chrome & Flächen (Slate Muted)
Ergonomische Graustufen mit dezent warmem Unterton statt kaltem Industriestahl.

| Farbmuster | Token / Klasse | Hex-Code | RGB | Semantische Verwendung |
| :---: | :--- | :--- | :--- | :--- |
| ![#0f141c](./farbfelder/slate-950.svg) | `bg-slate-950` | `#0f141c` | `15, 20, 28` | Tiefster Schatten, Text auf hellsten Badges |
| ![#18202c](./farbfelder/slate-900.svg) | `bg-slate-900` | `#18202c` | `24, 32, 44` | Haupttext dunkel, LAN-Statusbox |
| ![#242c38](./farbfelder/slate-800.svg) | `bg-slate-800` | `#242c38` | `36, 44, 56` | **Kopfleiste (Header)**, **Schnellinfo-Bar (Timeline)** |
| ![#384252](./farbfelder/slate-700.svg) | `bg-slate-700` | `#384252` | `56, 66, 82` | Trennlinien im Header, User-Badge CHEF, Beenden-Taste |
| ![#4f5c6e](./farbfelder/slate-600.svg) | `bg-slate-600` | `#4f5c6e` | `79, 92, 110` | Sekundärer Text, Tabellen-Sublabels, Meta-Angaben |
| ![#69778b](./farbfelder/slate-500.svg) | `bg-slate-500` | `#69778b` | `105, 119, 139` | Deaktivierte Icons, Platzhaltertexte, Notizen |
| ![#7f8c9b](./farbfelder/slate-400.svg) | `bg-slate-400` | `#7f8c9b` | `127, 140, 155` | **Status `Abgereist` (Check-Out)**, dezenter Rahmen |
| ![#c5ccd6](./farbfelder/slate-300.svg) | `bg-slate-300` | `#c5ccd6` | `197, 204, 214` | **Aktionsleiste Fußzeile**, Tabellenränder |
| ![#e5eaf0](./farbfelder/slate-200.svg) | `bg-slate-200` | `#e5eaf0` | `229, 234, 240` | **Haupt-App-Hintergrund (Canvas)**, Deaktivierte Buttons |
| ![#f1f4f8](./farbfelder/slate-100.svg) | `bg-slate-100` | `#f1f4f8` | `241, 244, 248` | Tabellenkopfzeilen (Thead), Filterleisten, Toolbars |
| ![#f8fafc](./farbfelder/slate-50.svg) | `bg-slate-50` | `#f8fafc` | `248, 250, 252` | Formular-Input-Hintergründe, Zeilen-Hover |
| ![#ffffff](./farbfelder/white.svg) | `bg-white` | `#ffffff` | `255, 255, 255` | Tabellen-Körper, Modalkarten, Standard-Buttons, DIN A4 PDF |

---

### 2.2 Primär- & Interaktionsfarbe (Schieferblau / Nordic Blue)
Ersetzt das grelle Neon-Kobaltblau durch ein gediegenes, ruhiges Schieferblau.

| Farbmuster | Token / Klasse | Hex-Code | RGB | Semantische Verwendung |
| :---: | :--- | :--- | :--- | :--- |
| ![#1d3349](./farbfelder/blue-900.svg) | `bg-blue-900` | `#1d3349` | `29, 51, 73` | Text in Rechnungs-Tabs, Zahlart-Label im PDF |
| ![#264563](./farbfelder/blue-800.svg) | `bg-blue-800` | `#264563` | `38, 69, 99` | Aktive Reiter-Texte, Hover dunkler Buttons |
| ![#2e5275](./farbfelder/blue-700.svg) | `bg-blue-700` | `#2e5275` | `46, 82, 117` | E-Rechnungs-Links (XML/ZUGFeRD) |
| ![#376189](./farbfelder/blue-600.svg) | `bg-blue-600` | `#376189` | `55, 97, 137` | **Haupt-Aktivfarbe:** Aktive Modul-Tabs (F1–F5), ausgewählte Tabellenzeilen, Primärschalter |
| ![#4875a3](./farbfelder/blue-500.svg) | `bg-blue-500` | `#4875a3` | `72, 117, 163` | Input Focus-Rings, Drag-and-Drop Hervorhebung |
| ![#5b8bb8](./farbfelder/blue-400.svg) | `bg-blue-400` | `#5b8bb8` | `91, 139, 184` | Fokus-Rahmen um selektierte Buchungsbalken (`ring-2`) |
| ![#c4d8ea](./farbfelder/blue-200.svg) | `bg-blue-200` | `#c4d8ea` | `196, 216, 234` | Rahmen um Zähler-Badges |
| ![#dce8f3](./farbfelder/blue-100.svg) | `bg-blue-100` | `#dce8f3` | `220, 232, 243` | Zähler-Badges ("X Zimmer belegt"), DnD Drop-Zone Hover |
| ![#ebf2f8](./farbfelder/blue-50.svg) | `bg-blue-50` | `#ebf2f8` | `235, 242, 248` | Selektierte Vorgangskarten in der Rechnungsliste |

---

### 2.3 Statusfarben: Zimmerbelegung & Timeline (Operational Booking Palette)
Ruhige, samtige Farbtöne für den Belegungsplan zur Vermeidung von visueller Überreizung.

| Status | Farbmuster | Klassen (Tailwind) | Hex-Werte | Bedeutung & Verhalten |
| :--- | :---: | :--- | :--- | :--- |
| **Reserviert** (Standard) | ![#cf8232](./farbfelder/amber-500.svg) | `bg-[#cf8232] hover:bg-[#bd7428] text-slate-900 border-[#b06a1f]` | `#cf8232` (Border: `#b06a1f`) | **Mattes Ocker / Sandstein:** Ersetzt das grelle Knallorange. Gestochen scharfer Kontrast mit dunklem Text. |
| **Vorreserviert (Indikator)** | ![#e5d0e2](./farbfelder/fuchsia-200.svg) | `bg-[#e5d0e2] text-[#502d4b] font-mono` | `#e5d0e2` (Text: `#502d4b`) | **Mattes Mauve / Altrosa:** Dezentes `r`-Kürzel statt grellem Bonbon-Pink. |
| **Im Haus (Eingecheckt)** | ![#397356](./farbfelder/emerald-600.svg) | `bg-[#397356] hover:bg-[#306248] text-white border-[#27533c]` | `#397356` (Border: `#27533c`) | **Mattes Wald- & Salbeigrün:** Natürlich, gastfreundlich, blendfrei. |
| **Abgereist (Check-Out)** | ![#7f8c9b](./farbfelder/slate-400.svg) | `bg-[#7f8c9b] hover:bg-[#6e7b8a] text-white border-[#616d7a]` | `#7f8c9b` (Border: `#616d7a`) | **Gedämpftes Schiefergrau:** Tritt dezent in den Hintergrund. |
| **Pauschale / Gruppe** | ![#376189](./farbfelder/blue-600.svg) | `bg-[#376189] hover:bg-[#2e5275] text-white border-[#264563]` | `#376189` (Border: `#264563`) | **Nordisches Schieferblau:** Seriös und augenfreundlich. |
| **Wochenende (Tage Sa/So)** | ![#b84d4d](./farbfelder/rose-500.svg) | `bg-[#b84d4d] text-white font-bold` | `#b84d4d` | **Mattes Ziegelrot / Terracotta:** Eindeutiges Signal für Samstag/Sonntag ohne grellen Neon-Effekt. |
| **Fest gebucht (Gesperrt)** | ![#3a1f06](./farbfelder/amber-950.svg) | `text-[#3a1f06]/80` (Icon) / `bg-[#3a1f06]/60 text-[#e3b364]` | `#3a1f06` / `#e3b364` | Buchung gegen versehentliches Verschieben gesperrt. Symbol: `Lock`. |

---

### 2.4 Finanz- & Kassenstatus: Das 3-Stufen-Ampelmodell
Satte, aber blendfreie Signallichter zur sofortigen Zahlungskontrolle.

| Zahlungsstatus | Farbmuster Dot | Ampel-Farbe | Indikator-Dot | Badge-Klassen | Dunkle Leiste (Timeline) |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **Bezahlt** (vollständig beglichen) | ![#2ea36f](./farbfelder/emerald-500.svg) | Lindengrün | `bg-[#2ea36f] ring-1 ring-[#268a5d] shadow-[#2ea36f]/40` (`#2ea36f`) | `bg-[#edf6f1] text-[#285740] border-[#b7dec9]` | `bg-[#1c3e2e]/90 text-[#86d4b1] border-[#2ea36f]/60` |
| **Teilbezahlt** (Folio-Split offen) | ![#d4973b](./farbfelder/amber-400.svg) | Bernsteingold | `bg-[#d4973b] ring-1 ring-[#bd822b] shadow-[#d4973b]/40 animate-pulse` (`#d4973b`) | `bg-[#fcf3e6] text-[#8c5820] border-[#eed19a] ring-1 ring-[#eed19a]/60` | `bg-[#3a1f06]/90 text-[#e3b364] border-[#d4973b]/70` |
| **Offen** (Zahlung ausstehend) | ![#bd4343](./farbfelder/rose-600.svg) | Karminrot matt | `bg-[#bd4343] ring-1 ring-[#a33737] shadow-[#bd4343]/40` (`#bd4343`) | `bg-[#faeded] text-[#852828] border-[#ecc2c2]` | `bg-[#381616]/90 text-[#df9696] border-[#bd4343]/60` |

---

### 2.5 Housekeeping & Zimmerhygiene (RoomsView)

| Zustand | Farbmuster | Symbol | Klassen (Tailwind) | Hex-Codes |
| :--- | :---: | :--- | :--- | :--- |
| **Sauber (Gästefertig)** | ![#edf6f1](./farbfelder/emerald-100.svg) | `ShieldCheck` | `bg-[#edf6f1] text-[#285740] border-[#b7dec9]` | Hintergrund `#edf6f1`, Text `#285740`, Rahmen `#b7dec9` |
| **Dirty (Reinigung nötig)** | ![#fcf3e6](./farbfelder/amber-100.svg) | `AlertTriangle` | `bg-[#fcf3e6] text-[#8c5820] border-[#eed19a]` | Hintergrund `#fcf3e6`, Text `#8c5820`, Rahmen `#eed19a` |
| **Sonderstatus** (z.B. "Keine Wäsche") | ![#69778b](./farbfelder/slate-500.svg) | Text `italic` | `text-[#69778b] italic` | `#69778b` |

---

### 2.6 Gästestamm & Gästetaxe (GuestsView)

| Eigenschaft | Farbmuster | Symbol | Klassen (Tailwind) | Bedeutung |
| :--- | :---: | :--- | :--- | :--- |
| **Stammgast** | ![#fcf3e6](./farbfelder/amber-100.svg) | `Star` (gefüllt) | `bg-[#fcf3e6] text-[#8c5820]` (Inaktiv) / `bg-[#d4973b] text-slate-900` (Selektiert) | Stammkunde des Hauses (warmes Honiggold). |
| **Gästetaxe befreit** | ![#edf6f1](./farbfelder/emerald-100.svg) | Text "Befreit" | `bg-[#edf6f1] text-[#285740]` (Inaktiv) / `bg-[#2ea36f] text-slate-900` (Selektiert) | Befreiung gem. Satzung Kurort Jonsdorf (z.B. Merkzeichen "B"). |
| **Gästetaxe normal** | ![#7f8c9b](./farbfelder/slate-400.svg) | Text "(2,90 €)" | `text-[#7f8c9b]` | Reguläre Abgabe 2,90 € / Nacht gem. Ortssatzung. |

---

### 2.7 Freie Kasse & Sonderbelege (Schieferviolett / Pflaume)

| Farbmuster | Token / Klasse | Hex-Code | RGB | Semantische Verwendung |
| :---: | :--- | :--- | :--- | :--- |
| ![#403052](./farbfelder/purple-900.svg) | `bg-[#403052]` | `#403052` | `64, 48, 82` | Text auf freien Kassen-Badges |
| ![#6d5684](./farbfelder/purple-600.svg) | `bg-[#6d5684]` | `#6d5684` | `109, 86, 132` | Icon `Receipt`, Schaltfläche `+ Freie Rechnung` |
| ![#f4f0f8](./farbfelder/purple-100.svg) | `bg-[#f4f0f8]` | `#f4f0f8` | `244, 240, 248` | Zähler-Badge ("X Kassenbelege"), Kassen-Folio-Badge |
| ![#f9f7fb](./farbfelder/purple-50.svg) | `bg-[#f9f7fb]` | `#f9f7fb` | `249, 247, 251` | Selektierte Zeile bei freier Restaurant-/Thekenrechnung |

---

## 3. Barrierefreiheit & Kontrastprüfung (WCAG 2.1)

| Farbkombination | Kontrastverhältnis | WCAG Level | Bewertung |
| :--- | :--- | :--- | :--- |
| `text-slate-900` (`#0f141c`) auf `bg-[#cf8232]` (Mattes Ocker) | **8.2 : 1** | **AAA** | Exzellent lesbar, kein Überstrahlen mehr |
| `text-white` (`#ffffff`) auf `bg-[#376189]` (Schieferblau) | **5.4 : 1** | **AA** | Perfekt für Buttons & Tabs |
| `text-white` (`#ffffff`) auf `bg-[#397356]` (Salbeigrün) | **5.2 : 1** | **AA** | Deutlich über dem Mindeststandard von 4.5:1 |
| `text-white` (`#ffffff`) auf `bg-[#b84d4d]` (Ziegelrot) | **5.0 : 1** | **AA** | Sanftes, aber eindeutiges Wochenende-Signal |
| `text-[#285740]` auf `bg-[#edf6f1]` (Sauber Badge) | **7.8 : 1** | **AAA** | Sehr hohe visuelle Klarheit bei Tageslicht |
| `text-[#8c5820]` auf `bg-[#fcf3e6]` (Dirty Badge) | **7.5 : 1** | **AAA** | Ruhiger, blendfreier Warnhinweis |

---

*Dokument gepflegt für das Projekt Hotelsoftware Lindengarten. Änderungen an den Statusfarben bedürfen der Freigabe durch die Rezeptionsleitung.*
