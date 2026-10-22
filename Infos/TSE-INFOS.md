# Leitfaden: TSE-Anbindung (fiskaly), KassenSichV & 10 Jahre GoBD-Aufbewahrung
**Hotelsoftware Lindengarten**  
*Stand: Oktober 2026*

---

## 1. Gesetzliche Vorgaben: Was muss an die TSE gesendet werden?

Rechtliche Grundlagen:
* **§ 146a Abgabenordnung (AO)** (Kassensicherungsverordnung – KassenSichV)
* **BSI TR-03153** (Technische Richtlinie für Technische Sicherheitseinrichtungen)
* **DSFinV-K** (Digitale Schnittstelle der Finanzverwaltung für Kassensysteme)

### A. Pflichtdaten an das TSE-Sicherheitsmodul (fiskaly SIGN DE v2):
Die TSE signiert Transaktionen kryptografisch, um Manipulationen an Umsätzen, Zeitstempeln und Belegnummern zu verhindern. Übermittelt werden:

1. **Transaktionsbeginn (Start):**
   * Startzeitpunkt (`time_start`)
   * Kassen-Client-ID (`client_id`, z. B. `ERS-LINDENGARTEN-POS-01`)
   * Transaktionsstatus: `ACTIVE` (Revision 1)
2. **Beleg- / Vorgangsart (`receipt_type`):**
   * Standard-Rechnung/Beleg: `RECEIPT`
   * Storno-Rechnung: `CANCELLATION`
3. **Betragsaufschlüsselung nach Steuersätzen (`amounts_per_vat_rate`):**
   * **`REDUCED_1` (7 % USt):** Gesetzlicher Satz für Übernachtung / Beherbergung.
   * **`NORMAL` (19 % USt):** Voller Steuersatz für Gastronomie, Frühstücksbuffet, Minibar, Parkplatz oder sonstige Dienstleistungen.
4. **Zahlungsarten (`amounts_per_payment_type`):**
   * **`CASH`:** Barzahlung (Bargeld an der Rezeption).
   * **`NON_CASH`:** Unbare Zahlungen (EC-Karte, Girocard, Kreditkarte).
5. **Transaktionsabschluss (Finish):**
   * Status `FINISHED` (Revision 2) mit dem fiskaly-Schema `standard_v1` (DSFinV-K konform).

### B. Was benötigt das TSE-Sicherheitsmodul NICHT:
* Reine Freitext-Beschreibungen (z. B. *"2x Übernachtung Komfort-Doppelzimmer 102"*), Gast-Namen oder detaillierte Artikelzeilen müssen **nicht** an das kryptografische TSE-Modul gesendet werden. Die TSE schützt die Summen, Steuersätze und Zeitstempel.
* Die Artikeldetails gehören jedoch zur Rechnung und zur Kassen-Nachschau (DSFinV-K) und werden in der lokalen Datenbank in `invoice_items` aufbewahrt.

---

## 2. Technische Umsetzung im Hotelprogramm

### A. Backend-Architektur:
* **Zentraler Service:** [`server/src/services/fiskalyService.ts`](file:///c:/Users/X/Desktop/Hotelsoftware%20Lindengarten/server/src/services/fiskalyService.ts)
  * Verwaltet Cloud-TSS (`tssId`), Kassen-Client (`clientId`) und Authentifizierungs-Token mit automatischem Caching (24h).
  * Führt `signInvoiceTransaction()` durch.
  * Stellt Funktionen für den **DSFinV-K Export** (`triggerExport`, `getExportStatus`, `getExportFile`) bereit.
* **Automatischer Signier-Trigger:** [`server/src/index.ts`](file:///c:/Users/X/Desktop/Hotelsoftware%20Lindengarten/server/src/index.ts) (`ensureTseSigned`)
  * Triggert bei Rechnungserstellung oder Statusänderung auf `BEZAHLT` oder `STORNO_BELEG`.
* **API-Endpunkte:**
  * `GET /api/tse/status` – Prüft Online-Status, TSS-Status (`INITIALIZED`), Client-Status (`REGISTERED`).
  * `POST /api/tse/init` – Automatisches Setup / Onboarding der TSE.
  * `POST /api/tse/sign/:id` – Manuelles (Nach-)Signieren einer Rechnung.
  * `POST /api/tse/export` & `GET /api/tse/export/:id/file` – DSFinV-K TAR-Export für Steuerprüfer.

### B. Belegausgabepflicht (§ 146a Abs. 2 AO):
* Umgesetzt in: [`client/src/components/pdf/InvoicePdfDocument.tsx`](file:///c:/Users/X/Desktop/Hotelsoftware%20Lindengarten/client/src/components/pdf/InvoicePdfDocument.tsx)
* Jede Rechnung enthält im druckbaren PDF den vorgeschriebenen KassenSichV-Block:
  * **TSE-QR-Code:** Maschinenlesbar nach BSI TR-03153 für die Kassen-Nachschau.
  * **Transaktions-ID & Belegnummer:** `tseTransactionId` und fortlaufende Nummer.
  * **TSE-Seriennummer:** Seriennummer der Cloud-TSS.
  * **Signaturzähler:** Fortlaufender Zähler (`tseSignatureCounter`).
  * **Start- und Endzeitpunkt:** Exakte Sekundenstempel.
  * **Signatur-Prüfwert:** Kryptografischer Signatur-Hash (`ecdsa-plain-SHA256`).

### C. Ausfallsicherheit ("Don't block the till" / AEAO zu § 146a):
* Ist die Internetverbindung unterbrochen oder fiskaly kurzzeitig nicht erreichbar, wird der Kassier-/Rechnungsvorgang **nicht blockiert**.
* Das System setzt automatisch das Flag `tseOfflineFallback = true` und kennzeichnet den Beleg mit *"OFFLINE-MODUS / NICHT SIGNIERT"*.
* Sobald die Verbindung wieder steht, kann in [`client/src/components/views/InvoicesView.tsx`](file:///c:/Users/X/Desktop/Hotelsoftware%20Lindengarten/client/src/components/views/InvoicesView.tsx) über den Button **"TSE nachsignieren"** die Signatur nachgeholt werden.

---

## 3. 10 Jahre Aufbewahrungspflicht (§ 147 AO / GoBD)

Das Gesetz verlangt, dass alle steuerlich relevanten Unterlagen, Rechnungen, Kassenbelege, Stornierungen und TSE-Transaktionsprotokolle **10 Jahre lang unveränderbar, jederzeit verfügbar und lesbar** aufbewahrt werden müssen.

### Wo und wie werden die Daten gespeichert?
1. **Lokale SQLite-Datenbank (`lindengarten.db`):**
   * Gespeichert in den Tabellen:
     * `invoices`: Rechnungsnummer, Brutto/Netto, Steuern (7% & 19%), Zahlart, Status, Erstellungsdatum.
     * `invoice_items`: Sämtliche Einzelleistungen, Übernachtungs- und Nebenleistungspositionen.
     * TSE-Metadaten: `tse_transaction_id`, `tse_signature`, `tse_signature_counter`, `tse_serial_number`, `tse_timestamp`, `tse_qr_code_data`, `tse_offline_fallback`.
   * Die Daten bleiben in SQLite dauerhaft erhalten und werden nicht gelöscht.
2. **In der Cloud bei fiskaly (SIGN DE):**
   * Alle signierten Transaktionen sind dem Cloud-TSS-Konto zugeordnet.

### Reicht die lokale Datenbank allein für 10 Jahre GoBD aus?
* **Technisch:** Das System speichert alles vollständig ab.
* **Organisatorisch / Prüfungsrechtlich:** 
  * Eine reine lokale Festplatte birgt Risiken (Festplattendefekt, Brand, Viren, versehentliches Löschen). Die GoBD verlangt ein revisionssicheres, unveränderbares Speicher- und Backup-Konzept.
* **Empfohlene Umsetzung für 100%ige Konformität:**
  1. **Option A – fiskaly SAFE (Empfehlung):**
     * fiskaly bietet im Workspace das Zusatzprodukt **SAFE** an (*"Archiviert Fiskal-Daten für 10 bis 30 Jahre gemäß Aufbewahrungspflichten"*).
     * Wird dies im fiskaly Dashboard gebucht/aktiviert, archiviert fiskaly alle Transaktionen und TAR-Exporte automatisch revisionssicher in zertifizierten deutschen ISO-27001-Rechenzentren.
  2. **Option B – Lokales Revisions-Backup:**
     * Regelmäßiger Download des **DSFinV-K TAR-Archivs** über **Stammdaten -> TSE** in der Hotelsoftware.
     * Monatliche/quartalsweise Sicherung der Datei `lindengarten.db` und der TAR-Exporte auf einem externen, schreibgeschützten Datenträger (z. B. NAS mit WORM-Modus oder gesichertem Cloud-Speicher).

---

## 4. Anforderungs-Checkliste im Überblick

| Anforderung | Rechtsgrundlage | Status im System | Bemerkung |
| :--- | :--- | :--- | :--- |
| **Kryptografische Signierung** | § 146a Abs. 1 AO | **Erfüllt** | BSI-zertifizierte Cloud-TSE via fiskaly SIGN DE v2 |
| **Steuersatz-Trennung (7% / 19%)** | KassenSichV & DSFinV-K | **Erfüllt** | Aufteilung in `REDUCED_1` (7%) und `NORMAL` (19%) |
| **Zahlarten-Trennung (Bar / Karte)** | KassenSichV | **Erfüllt** | Aufteilung in `CASH` und `NON_CASH` |
| **Belegausgabepflicht** | § 146a Abs. 2 AO | **Erfüllt** | Alle gesetzlichen Pflichtfelder auf Rechnungs-PDF |
| **TSE-QR-Code auf Belegen** | BSI TR-03153 | **Erfüllt** | Generierung von scannbarem QR-Code im PDF |
| **Ausfall- und Offlinekonzept** | AEAO zu § 146a | **Erfüllt** | Offline-Fallback verhindert Kassenblockade; Nachsignierung möglich |
| **DSFinV-K TAR-Export** | § 146b AO | **Erfüllt** | Download über Stammdaten -> TSE für Kassen-Nachschau |
| **10 Jahre Aufbewahrung** | § 147 AO & GoBD | **Bereitgestellt** | In SQLite hinterlegt; zu sichern über Backup oder fiskaly SAFE |
| **Kassen-Meldepflicht an Finanzamt** | § 146a Abs. 4 AO | **Betreiber-Pflicht** | Einmalige Anmeldung über *meinELSTER* (oder optional fiskaly SUBMIT DE) |
