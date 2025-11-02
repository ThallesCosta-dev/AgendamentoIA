/**
 * Shared code between client and server
 * Useful to share types between client and server
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

export interface CreateRoomRequest {
  name: string;
  capacity: number;
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

export interface AvailableSlot {
  date: string;
  startTime: string;
}

export interface DemoResponse {
  message: string;
}
