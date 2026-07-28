/**
 * Código compartilhado entre cliente e servidor
 * Útil para compartilhar tipos entre cliente e servidor
 */

export interface Room {
  id: string;
  name: string;
  capacity: number;
  createdAt: string;
}

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  clientName: string;
  clientEmail: string;
  date: string; // ISO date string
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  createdAt: string;
}

export interface CreateBookingRequest {
  roomId: string;
  clientName: string;
  clientEmail: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface ListRoomsResponse {
  rooms: Room[];
}

export interface ListBookingsResponse {
  bookings: Booking[];
}

export interface CheckAvailabilityRequest {
  date: string;
  startTime: string;
  endTime: string;
}

export interface CheckAvailabilityResponse {
  availableRooms: Room[];
  bookedRooms: string[]; // room IDs
}

export interface CreateBookingResponse {
  booking: Booking;
}

// ---------------------------------------------------------------------------
// Autenticação administrativa
// ---------------------------------------------------------------------------

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  /** Presente apenas em caso de sucesso. */
  token?: string;
  /** ISO date string — presente apenas em caso de sucesso. */
  expiresAt?: string;
  /** Presente apenas em caso de falha. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Configuração pública da aplicação
// ---------------------------------------------------------------------------

export interface AppConfigResponse {
  /** Domínios de email institucionais aceitos (ex.: ["fiocruz.br", "edu.br"]). */
  allowedEmailDomains: string[];
}
