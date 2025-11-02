import { Room, Booking } from "@shared/api";

// Simple in-memory data store
// In production, replace with a real database (Supabase, Neon, etc.)
export const db = {
  rooms: [
    { id: "1", name: "Sala 101", capacity: 30, createdAt: new Date().toISOString() },
    { id: "2", name: "Auditório Principal", capacity: 100, createdAt: new Date().toISOString() },
    { id: "3", name: "Sala de Conferência A", capacity: 20, createdAt: new Date().toISOString() },
  ] as Room[],
  bookings: [] as Booking[],
};

let nextRoomId = 4;
let nextBookingId = 1;

export function createRoom(room: Omit<Room, "id" | "createdAt">): Room {
  const newRoom: Room = {
    ...room,
    id: String(nextRoomId++),
    createdAt: new Date().toISOString(),
  };
  db.rooms.push(newRoom);
  return newRoom;
}

export function deleteRoom(roomId: string): boolean {
  const index = db.rooms.findIndex((r) => r.id === roomId);
  if (index > -1) {
    db.rooms.splice(index, 1);
    // Also delete bookings for this room
    db.bookings = db.bookings.filter((b) => b.roomId !== roomId);
    return true;
  }
  return false;
}

export function getRooms(): Room[] {
  return db.rooms;
}

export function createBooking(booking: Omit<Booking, "id" | "createdAt">): Booking {
  const newBooking: Booking = {
    ...booking,
    id: String(nextBookingId++),
    createdAt: new Date().toISOString(),
  };
  db.bookings.push(newBooking);
  return newBooking;
}

export function getBookings(): Booking[] {
  return db.bookings;
}

export function getBookingsByRoom(roomId: string): Booking[] {
  return db.bookings.filter((b) => b.roomId === roomId);
}

export function bookingExists(roomId: string, date: string, startTime: string, endTime: string): boolean {
  return db.bookings.some((b) => {
    if (b.roomId !== roomId || b.date !== date) return false;

    // Check for time overlap
    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);
    const existingStart = timeToMinutes(b.startTime);
    const existingEnd = timeToMinutes(b.endTime);

    // Overlapping if: newStart < existingEnd AND newEnd > existingStart
    return newStart < existingEnd && newEnd > existingStart;
  });
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateInstitutionalEmail(email: string, domain: string = "instituicao.edu.br"): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  return email.endsWith(domain);
}
