import { RequestHandler } from "express";
import {
  CreateBookingRequest,
  ListBookingsResponse,
  CheckAvailabilityRequest,
  CheckAvailabilityResponse,
  CreateBookingResponse,
} from "@shared/api";
import {
  createBooking,
  getBookings,
  getRooms,
  bookingExists,
  validateInstitutionalEmail,
} from "../data";

export const handleListBookings: RequestHandler = async (_req, res) => {
  try {
    const bookings = await getBookings();
    const response: ListBookingsResponse = { bookings };
    res.json(response);
  } catch (error) {
    console.error("Error listing bookings:", error);
    res.status(500).json({ error: "Failed to list bookings" });
  }
};

export const handleCheckAvailability: RequestHandler = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body as CheckAvailabilityRequest;

    if (!date || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const allRooms = await getRooms();

    // Check availability for each room
    const availableRooms = [];
    const bookedRoomIds = [];

    for (const room of allRooms) {
      const exists = await bookingExists(room.id, date, startTime, endTime);
      if (exists) {
        bookedRoomIds.push(room.id);
      } else {
        availableRooms.push(room);
      }
    }

    const response: CheckAvailabilityResponse = {
      availableRooms,
      bookedRooms: bookedRoomIds,
    };
    res.json(response);
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({ error: "Failed to check availability" });
  }
};

export const handleCreateBooking: RequestHandler = async (req, res) => {
  try {
    const { roomId, clientName, clientEmail, date, startTime, endTime } =
      req.body as CreateBookingRequest;

    // Validation
    if (
      !roomId ||
      !clientName ||
      !clientEmail ||
      !date ||
      !startTime ||
      !endTime
    ) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate institutional email
    if (!validateInstitutionalEmail(clientEmail)) {
      res.status(400).json({
        error:
          "Email must be from a Brazilian educational institution (.edu.br)",
      });
      return;
    }

    // Check if room exists
    const rooms = await getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Check availability
    const isBooked = await bookingExists(roomId, date, startTime, endTime);
    if (isBooked) {
      res.status(409).json({
        error: "Room is not available for the requested time slot",
      });
      return;
    }

    const booking = await createBooking({
      roomId,
      roomName: room.name,
      clientName,
      clientEmail,
      date,
      startTime,
      endTime,
    });

    const response: CreateBookingResponse = { booking };
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Failed to create booking" });
  }
};

export const handleGetAvailableTimes: RequestHandler = async (req, res) => {
  try {
    const { date } = req.query as { date: string };

    if (!date) {
      res.status(400).json({ error: "Date is required" });
      return;
    }

    const allRooms = await getRooms();
    const allBookings = await getBookings();
    const bookings = allBookings.filter((b) => b.date === date);

    // Get all bookings for this date
    const bookedSlots: {
      [roomId: string]: Array<{ start: number; end: number }>;
    } = {};

    bookings.forEach((booking) => {
      if (!bookedSlots[booking.roomId]) {
        bookedSlots[booking.roomId] = [];
      }
      const startMinutes =
        parseInt(booking.startTime.split(":")[0]) * 60 +
        parseInt(booking.startTime.split(":")[1]);
      const endMinutes =
        parseInt(booking.endTime.split(":")[0]) * 60 +
        parseInt(booking.endTime.split(":")[1]);
      bookedSlots[booking.roomId].push({
        start: startMinutes,
        end: endMinutes,
      });
    });

    res.json({ availableRooms: allRooms, bookedSlots });
  } catch (error) {
    console.error("Error getting available times:", error);
    res.status(500).json({ error: "Failed to get available times" });
  }
};
