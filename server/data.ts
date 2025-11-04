import { Room, Booking } from "@shared/api";
import { getConnection } from "./db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

export async function createRoom(
  room: Omit<Room, "id" | "createdAt">,
): Promise<Room> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      "INSERT INTO rooms (name, capacity) VALUES (?, ?)",
      [room.name, room.capacity],
    );

    return {
      id: String(result.insertId),
      name: room.name,
      capacity: room.capacity,
      createdAt: new Date().toISOString(),
    };
  } finally {
    connection.release();
  }
}

export async function deleteRoom(roomId: string): Promise<boolean> {
  const connection = await getConnection();
  try {
    // Delete bookings for this room first
    await connection.execute("DELETE FROM bookings WHERE room_id = ?", [
      roomId,
    ]);

    // Then delete the room
    const [result] = await connection.execute<ResultSetHeader>(
      "DELETE FROM rooms WHERE id = ?",
      [roomId],
    );

    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
}

export async function getRooms(): Promise<Room[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, name, capacity, created_at FROM rooms ORDER BY name",
    );

    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      capacity: row.capacity,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));
  } finally {
    connection.release();
  }
}

export async function getRoomById(id: string): Promise<Room | null> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      "SELECT id, name, capacity, created_at FROM rooms WHERE id = ?",
      [id],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: String(row.id),
      name: row.name,
      capacity: row.capacity,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  } finally {
    connection.release();
  }
}

export async function updateRoomById(
  id: string,
  updates: {
    name?: string;
    capacity?: number;
  },
): Promise<Room> {
  const connection = await getConnection();
  try {
    // Get the current room
    const currentRoom = await getRoomById(id);
    if (!currentRoom) {
      throw new Error(`Room with ID ${id} not found`);
    }

    const updateName = updates.name ?? currentRoom.name;
    const updateCapacity = updates.capacity ?? currentRoom.capacity;

    await connection.execute(
      "UPDATE rooms SET name = ?, capacity = ? WHERE id = ?",
      [updateName, updateCapacity, id],
    );

    const updatedRoom = await getRoomById(id);
    if (!updatedRoom) {
      throw new Error("Failed to retrieve updated room");
    }

    return updatedRoom;
  } finally {
    connection.release();
  }
}

export async function createBooking(
  booking: Omit<Booking, "id" | "createdAt">,
): Promise<Booking> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO bookings (room_id, room_name, client_name, client_email, date, start_time, end_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.roomId,
        booking.roomName,
        booking.clientName,
        booking.clientEmail,
        booking.date,
        booking.startTime,
        booking.endTime,
      ],
    );

    return {
      id: String(result.insertId),
      ...booking,
      createdAt: new Date().toISOString(),
    };
  } finally {
    connection.release();
  }
}

export async function getBookings(): Promise<Booking[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, room_id as roomId, room_name as roomName, client_name as clientName,
              client_email as clientEmail, date, start_time as startTime, end_time as endTime,
              created_at
       FROM bookings ORDER BY date DESC, start_time DESC`,
    );

    return rows.map((row) => ({
      id: String(row.id),
      roomId: String(row.roomId),
      roomName: row.roomName,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      date: String(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));
  } finally {
    connection.release();
  }
}

export async function getBookingsByRoom(roomId: string): Promise<Booking[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, room_id as roomId, room_name as roomName, client_name as clientName,
              client_email as clientEmail, date, start_time as startTime, end_time as endTime,
              created_at
       FROM bookings WHERE room_id = ? ORDER BY date ASC, start_time ASC`,
      [roomId],
    );

    return rows.map((row) => ({
      id: String(row.id),
      roomId: String(row.roomId),
      roomName: row.roomName,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      date: String(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    }));
  } finally {
    connection.release();
  }
}

export async function bookingExists(
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<boolean> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM bookings 
       WHERE room_id = ? AND date = ? 
       AND start_time < ? AND end_time > ?`,
      [roomId, date, endTime, startTime],
    );

    return rows.length > 0;
  } finally {
    connection.release();
  }
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT id, room_id as roomId, room_name as roomName, client_name as clientName,
              client_email as clientEmail, date, start_time as startTime, end_time as endTime,
              created_at
       FROM bookings WHERE id = ?`,
      [id],
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: String(row.id),
      roomId: String(row.roomId),
      roomName: row.roomName,
      clientName: row.clientName,
      clientEmail: row.clientEmail,
      date: String(row.date),
      startTime: row.startTime,
      endTime: row.endTime,
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : new Date(row.created_at).toISOString(),
    };
  } finally {
    connection.release();
  }
}

export async function updateBookingById(
  id: string,
  updates: {
    clientName?: string;
    clientEmail?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    roomId?: string;
    roomName?: string;
  },
): Promise<Booking> {
  const connection = await getConnection();
  try {
    // Get the current booking
    const currentBooking = await getBookingById(id);
    if (!currentBooking) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    // Build update query dynamically
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.clientName) {
      updateFields.push("client_name = ?");
      updateValues.push(updates.clientName);
    }
    if (updates.clientEmail) {
      updateFields.push("client_email = ?");
      updateValues.push(updates.clientEmail);
    }
    if (updates.date) {
      updateFields.push("date = ?");
      updateValues.push(updates.date);
    }
    if (updates.startTime) {
      updateFields.push("start_time = ?");
      updateValues.push(updates.startTime);
    }
    if (updates.endTime) {
      updateFields.push("end_time = ?");
      updateValues.push(updates.endTime);
    }
    if (updates.roomId) {
      updateFields.push("room_id = ?");
      updateValues.push(updates.roomId);
    }
    if (updates.roomName) {
      updateFields.push("room_name = ?");
      updateValues.push(updates.roomName);
    }

    if (updateFields.length === 0) {
      return currentBooking;
    }

    updateValues.push(id);

    await connection.execute(
      `UPDATE bookings SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues,
    );

    // Return updated booking
    const updatedBooking = await getBookingById(id);
    if (!updatedBooking) {
      throw new Error("Failed to retrieve updated booking");
    }

    return updatedBooking;
  } finally {
    connection.release();
  }
}

export async function deleteBookingById(id: string): Promise<boolean> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      "DELETE FROM bookings WHERE id = ?",
      [id],
    );

    return result.affectedRows > 0;
  } finally {
    connection.release();
  }
}

export function validateInstitutionalEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;
  // Accept any Brazilian educational institution email (.edu.br domain)
  return email.endsWith(".edu.br");
}
