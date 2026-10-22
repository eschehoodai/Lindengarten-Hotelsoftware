/**
 * Zentrale Hotel- und Beherbergungs-Stammdaten für Briefköpfe,
 * PDF-Dokumente (Rechnungen, Meldescheine, Angebote) und Kommunikation.
 */
export const HOTEL_CONFIG = {
  name: 'Romantik Hotel Zum Lindengarten',
  shortName: 'Hotel Zum Lindengarten',
  claim: 'Gastlichkeit & Erholung im Zittauer Gebirge',
  street: 'Großschönauer Straße 21',
  zip: '02796',
  city: 'Jonsdorf Luftkurort',
  location: '02796 Jonsdorf Luftkurort',
  phone: '035844 70654',
  fax: '035844 70611',
  email: 'buchung@romantikhaeuser.de',
  web: 'www.romantikhaeuser.de',

  // DIN 5008 Rücksendeangabe (Fensterkuvert)
  dinReturnLine: 'Romantik Hotel Zum Lindengarten • Großschönauer Straße 21 • 02796 Jonsdorf Luftkurort',

  // Behördliche & rechtliche Angaben
  owner: 'Jens Kunath',
  taxId: 'DE 208 456 789',
  taxOffice: 'Finanzamt Löbau',

  // Bankverbindung
  bank: 'Volksbank Löbau-Zittau eG',
  iban: 'DE12 8559 0000 0123 4567 89',
  bic: 'GENODEF1LBZ',

  // Standard-Texte & Grußformeln
  welcomeText: 'wir bedanken uns herzlich für Ihren Besuch im Romantik Hotel Zum Lindengarten und erlauben uns, Ihnen folgende Leistungen in Rechnung zu stellen:',
  closingText: 'Vielen Dank für Ihren Aufenthalt im Romantik Hotel Zum Lindengarten. Wir hoffen, Sie hatten eine erholsame Zeit und beehren uns gerne wieder.',
  signatureTeam: 'Ihr Jens Kunath',
} as const;

export type HotelConfig = typeof HOTEL_CONFIG;
