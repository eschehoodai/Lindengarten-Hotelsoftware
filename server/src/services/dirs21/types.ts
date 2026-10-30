export interface Dirs21Config {
  channel: string;
  hotelId: string;
  username: string;
  password: string;
  endpointUrl: string;
  environment: 'mock' | 'sandbox' | 'production';
  isActive: boolean;
  pollingIntervalSeconds: number;
  syncIntervalSeconds: number;
  syncLookaheadDays: number;
  updatedAt: string;
}

export interface InventoryUpdateDTO {
  categoryCode: string;
  channelRoomId: string;
  date: string; // YYYY-MM-DD
  availableRooms: number;
  totalRooms: number;
}

export interface ChannelGuestDTO {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  country?: string;
}

export interface ChannelReservationDTO {
  externalReservationId: string;
  otaConfirmationCode: string;
  channelSource: string; // z. B. 'DIRS21 / Booking.com'
  action: 'NEW' | 'MODIFY' | 'CANCEL';
  categoryCode: string;
  channelRoomId: string;
  arrivalDate: string;   // YYYY-MM-DD
  departureDate: string; // YYYY-MM-DD
  nights: number;
  adultsCount: number;
  childrenCount: number;
  totalPrice: number;
  pricePerNight: number;
  boardType: string;
  guest: ChannelGuestDTO;
  notes?: string;
  rawPayload: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  pingMs: number;
  environment: string;
}

export interface SyncPushResult {
  success: boolean;
  rawRequest: string;
  rawResponse: string;
  errorMessage?: string;
}

export interface Dirs21Adapter {
  readonly channelName: string;
  testConnection(config: Dirs21Config): Promise<ConnectionTestResult>;
  pushInventory(config: Dirs21Config, updates: InventoryUpdateDTO[]): Promise<SyncPushResult>;
  fetchReservations(config: Dirs21Config): Promise<{
    reservations: ChannelReservationDTO[];
    rawRequest: string;
    rawResponse: string;
  }>;
  acknowledgeReservation(
    config: Dirs21Config,
    externalId: string,
    status: 'SUCCESS' | 'ERROR',
    message?: string
  ): Promise<boolean>;
}
