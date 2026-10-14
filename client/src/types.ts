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
  isTaxExempt: boolean;
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
  cityTaxAmount: number;
  totalGross: number;
  
  // Texte & Konditionen
  closingText?: string;
  paymentMethod: string;
  isPaid: boolean;
  status: string;
  
  // TSE & Fiskalisierung
  tseTransactionId?: string;
  tseSignature?: string;
  
  // Joins
  guest?: Guest;
  reservation?: Reservation;
}

export const APP_VERSION = '2.0';

