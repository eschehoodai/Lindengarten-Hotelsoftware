export interface Guest {
  id: number;
  guestNumber: string;
  searchName: string;
  titleCode: number;
  salutation: string;
  lastName: string;
  firstName: string;
  name2?: string;
  firstName2?: string;
  careOf?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  fax?: string;
  birthDate?: string;
  nationality?: string;
  idCardNumber?: string;
  paymentMethod?: string;
  isRegularGuest: boolean;
  isTaxExempt?: boolean;
  taxExemptReason?: string;
  remarks?: string;
  guestInfo?: string;
  createdAt?: string;
}

export interface Room {
  id: number;
  roomCode: string;
  name: string;
  categoryCode: string;
  categoryName: string;
  baseBeds: number;
  maxCapacity: number;
  basePrice: number;
  floor: string;
  sortOrder: number;
  housekeepingStatus: 'clean' | 'dirty' | 'maintenance';
  specialCleaningNote?: string | null;
}

export interface Reservation {
  id: number;
  reservationNumber: string;
  guestId: number;
  roomId: number;
  arrivalDate: string;
  departureDate: string;
  nights: number;
  adultsCount: number;
  childrenCount: number;
  companionNames?: string;
  isArrived: boolean;
  isDeparted: boolean;
  isWrittenReservation: boolean;
  isLockedToRoom: boolean; // Wenn true -> nicht per DnD verschiebbar!
  priceVariant: string;
  pricePerNight: number;
  totalPrice: number;
  isFlatRate: boolean;
  boardType?: 'Frühstück' | 'OHP' | '2Gang' | '3Gang' | string;
  hasBreakfast: boolean;
  breakfastCount: number;
  breakfastDays?: number;
  ohpCount?: number;
  twoGangCount?: number;
  threeGangCount?: number;
  lunchCount?: number;
  coffeeTeaCount?: number;
  dinnerCount?: number;
  dailyArrangement?: string;
  billingDebitor?: string;
  notes?: string;
  
  // Joins
  guest?: Guest;
  room?: Room;
  last_name?: string;
  first_name?: string;
  search_name?: string;
  room_code?: string;
  room_name?: string;
}

export interface BoardOption {
  id: string;
  label: string;
  description: string;
}

export const BOARD_OPTIONS: BoardOption[] = [
  { id: 'Frühstück', label: 'Frühstück', description: 'Frühstücksbuffet' },
  { id: 'OHP', label: 'OHP', description: 'Ohne Halbpension' },
  { id: '2Gang', label: '2Gang', description: '2-Gang Menü (HP)' },
  { id: '3Gang', label: '3Gang', description: '3-Gang Menü (HP)' },
];

export function parseBoardTypes(raw?: string | null): string[] {
  if (!raw) return [];
  const parts = raw.split(/[,;+/]+/).map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of parts) {
    if (part === 'Frühstück' || part.toLowerCase().includes('frühstück') || part.toLowerCase().includes('buffet')) {
      if (!result.includes('Frühstück')) result.push('Frühstück');
    } else if (part === 'OHP' || part.toUpperCase().includes('OHP')) {
      if (!result.includes('OHP')) result.push('OHP');
    } else if (part === '2Gang' || part.includes('2 Gang') || part.includes('2-Gang') || part.includes('2Gang')) {
      if (!result.includes('2Gang')) result.push('2Gang');
    } else if (part === '3Gang' || part.includes('3 Gang') || part.includes('3-Gang') || part.includes('3Gang')) {
      if (!result.includes('3Gang')) result.push('3Gang');
    } else if (!result.includes(part)) {
      result.push(part);
    }
  }

  return result;
}

export interface Salutation {
  id: number;
  salutationNumber: number;
  addressText: string;
  letterGreeting: string;
  code: string;
}

export interface PriceVariant {
  id: number;
  variantNumber: number;
  name: string;
  shortCode: string;
  isFlatRate: boolean;
  breakfastPersons?: number;
  breakfastRate?: number;
  isOnlineImport?: boolean;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  reservationId?: number;
  guestId: number;
  invoiceDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  nights: number;
  
  // Anschrift & Personalisierung
  recipientSalutation?: string;
  recipientName?: string;
  recipientCompany?: string;
  recipientStreet?: string;
  recipientZip?: string;
  recipientCity?: string;
  recipientCountry?: string;
  
  // Buchungsbezug
  roomCode?: string;
  roomName?: string;
  billingDebitor?: string;
  
  // Positionen & Beträge
  items?: any[];
  netLodging: number;
  taxLodging: number;
  netService: number;
  taxService: number;
  cityTaxAmount?: number;
  totalGross: number;
  
  // Texte & Konditionen
  closingText?: string;
  paymentMethod: string;
  isPaid: boolean;
  status: string;
  
  // TSE & Fiskalisierung (fiskaly SIGN DE API v2 / KassenSichV)
  tseTransactionId?: string;
  tseTransactionNumber?: number;
  tseSignature?: string;
  tseSignatureCounter?: number;
  tseSignatureAlgorithm?: string;
  tseSerialNumber?: string;
  tseTimestamp?: string;
  tseQrCodeData?: string;
  tseOfflineFallback?: boolean;
  
  // Joins
  guest?: Guest;
  reservation?: Reservation;
}

export const APP_VERSION = '2.0';

