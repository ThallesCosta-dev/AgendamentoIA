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
  getBookingById,
  updateBookingById,
  deleteBookingById,
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

const validateDate = (dateStr: string): boolean => {
  // Internal storage uses YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);

  // Check if it's a valid calendar date
  const selectedDate = new Date(year, month - 1, day);
  if (
    selectedDate.getFullYear() !== year ||
    selectedDate.getMonth() !== month - 1 ||
    selectedDate.getDate() !== day
  ) {
    return false;
  }

  // Date must be today or in the future (no past dates)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selectedDate.setHours(0, 0, 0, 0);

  return selectedDate >= today;
};

const validateTime = (timeStr: string): boolean => {
  // Validate HH:mm format (00:00 to 23:59)
  if (!/^\d{2}:\d{2}$/.test(timeStr)) {
    return false;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

const validateTimeRange = (startTime: string, endTime: string): boolean => {
  // Both times must be valid format
  if (!validateTime(startTime) || !validateTime(endTime)) {
    return false;
  }

  // End time must be after start time
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;

  return endTotalMinutes > startTotalMinutes;
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

    // Validate date format and range
    if (!validateDate(date)) {
      res.status(400).json({
        error: "Data inválida. A data deve ser hoje ou no futuro (formato: DD-MM-YYYY)",
      });
      return;
    }

    // Validate time format and range
    if (!validateTime(startTime)) {
      res.status(400).json({ error: "Invalid start time format (use HH:mm)" });
      return;
    }

    if (!validateTime(endTime)) {
      res.status(400).json({ error: "Invalid end time format (use HH:mm)" });
      return;
    }

    if (!validateTimeRange(startTime, endTime)) {
      res.status(400).json({
        error: "End time must be after start time",
      });
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

export const handleGetBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.json(booking);
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({ error: "Failed to get booking" });
  }
};

export const handleUpdateBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, date, startTime, endTime, roomId } =
      req.body;

    if (!clientName || !clientEmail || !date || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Validate date format and range
    if (!validateDate(date)) {
      res.status(400).json({
        error: "Data inválida. A data deve ser hoje ou no futuro (formato: DD-MM-YYYY)",
      });
      return;
    }

    // Validate time format and range
    if (!validateTime(startTime)) {
      res.status(400).json({ error: "Invalid start time format (use HH:mm)" });
      return;
    }

    if (!validateTime(endTime)) {
      res.status(400).json({ error: "Invalid end time format (use HH:mm)" });
      return;
    }

    if (!validateTimeRange(startTime, endTime)) {
      res.status(400).json({
        error: "End time must be after start time",
      });
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

    const booking = await updateBookingById(id, {
      clientName,
      clientEmail,
      date,
      startTime,
      endTime,
      roomId,
    });

    res.json(booking);
  } catch (error) {
    console.error("Error updating booking:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: "Booking not found" });
    } else {
      res.status(500).json({ error: "Failed to update booking" });
    }
  }
};

export const handleDeleteBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await deleteBookingById(id);
    if (!success) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Failed to delete booking" });
  }
};
