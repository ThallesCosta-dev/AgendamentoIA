import { RequestHandler } from "express";
import {
  getRooms,
  getBookings,
  getBookingsByRoom,
  createBooking,
  deleteBookingById,
  updateBookingById,
  getBookingById,
  validateInstitutionalEmail,
} from "../data";
import { CreateBookingRequest, Room, Booking } from "@shared/api";
import { sendBookingConfirmationEmail } from "../services/email";

/**
 * AI endpoint: List all available rooms
 * Used by AI to check room inventory
 */
export const handleAIListRooms: RequestHandler = async (_req, res) => {
  try {
    const rooms = await getRooms();
    res.json({
      success: true,
      rooms,
      count: rooms.length,
    });
  } catch (error) {
    console.error("Error listing rooms:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list rooms",
    });
  }
};

/**
 * AI endpoint: List all bookings with optional filtering
 * Used by AI to check booking status
 */
export const handleAIListBookings: RequestHandler = async (req, res) => {
  try {
    const { email, date, roomId } = req.query;

    let bookings = await getBookings();

    if (email) {
      bookings = bookings.filter((b) => b.clientEmail === email);
    }
    if (date) {
      bookings = bookings.filter((b) => b.date === date);
    }
    if (roomId) {
      bookings = bookings.filter((b) => b.roomId === roomId);
    }

    res.json({
      success: true,
      bookings,
      count: bookings.length,
    });
  } catch (error) {
    console.error("Error listing bookings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list bookings",
    });
  }
};

/**
 * AI endpoint: Get a specific booking by ID
 * Used by AI to retrieve booking details for modification or cancellation
 */
export const handleAIGetBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "Booking ID is required",
      });
      return;
    }

    const booking = await getBookingById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: `Booking with ID ${id} not found`,
      });
      return;
    }

    res.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get booking",
    });
  }
};

/**
 * AI endpoint: Create a new booking
 * Used by AI to make reservations
 */
export const handleAICreateBooking: RequestHandler = async (req, res) => {
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
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
    }

    // Validate institutional email
    if (!validateInstitutionalEmail(clientEmail)) {
      res.status(400).json({
        success: false,
        error:
          "Email must be from a Brazilian educational institution (.edu.br)",
      });
      return;
    }

    // Check if room exists
    const rooms = await getRooms();
    const room = rooms.find((r) => r.id === roomId);
    if (!room) {
      res.status(404).json({
        success: false,
        error: "Room not found",
      });
      return;
    }

    // Booking will be created by the main API, this is for AI
    const booking = await createBooking({
      roomId,
      roomName: room.name,
      clientName,
      clientEmail,
      date,
      startTime,
      endTime,
    });

    try {
      await sendBookingConfirmationEmail(booking);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    res.status(201).json({
      success: true,
      booking,
      message: `Booking created successfully with ID: ${booking.id}`,
    });
  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create booking",
    });
  }
};

/**
 * AI endpoint: Update/modify an existing booking by ID
 * Used by AI to change booking details (date, time, room)
 */
export const handleAIUpdateBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, date, startTime, endTime, roomId } =
      req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "Booking ID is required",
      });
      return;
    }

    // Check if booking exists
    const existingBooking = await getBookingById(id);
    if (!existingBooking) {
      res.status(404).json({
        success: false,
        error: `Booking with ID ${id} not found`,
      });
      return;
    }

    // Validate email if changed
    if (clientEmail && !validateInstitutionalEmail(clientEmail)) {
      res.status(400).json({
        success: false,
        error:
          "Email must be from a Brazilian educational institution (.edu.br)",
      });
      return;
    }

    // Check if room exists if changed
    let roomName = existingBooking.roomName;
    if (roomId) {
      const rooms = await getRooms();
      const room = rooms.find((r) => r.id === roomId);
      if (!room) {
        res.status(404).json({
          success: false,
          error: "Room not found",
        });
        return;
      }
      roomName = room.name;
    }

    const updatedBooking = await updateBookingById(id, {
      clientName: clientName || existingBooking.clientName,
      clientEmail: clientEmail || existingBooking.clientEmail,
      date: date || existingBooking.date,
      startTime: startTime || existingBooking.startTime,
      endTime: endTime || existingBooking.endTime,
      roomId: roomId || existingBooking.roomId,
      roomName,
    });

    res.json({
      success: true,
      booking: updatedBooking,
      message: `Booking ${id} updated successfully`,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update booking",
    });
  }
};

/**
 * AI endpoint: Delete/cancel a booking by ID
 * Used by AI to cancel reservations
 */
export const handleAICancelBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "Booking ID is required",
      });
      return;
    }

    // Check if booking exists
    const booking = await getBookingById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: `Booking with ID ${id} not found`,
      });
      return;
    }

    const success = await deleteBookingById(id);
    if (!success) {
      res.status(500).json({
        success: false,
        error: "Failed to cancel booking",
      });
      return;
    }

    res.json({
      success: true,
      message: `Booking ${id} cancelled successfully`,
      cancelledBooking: booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel booking",
    });
  }
};

/**
 * AI endpoint: Check room availability
 * Used by AI to check if rooms are available for a given time slot
 */
export const handleAICheckAvailability: RequestHandler = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        error: "Date, startTime, and endTime are required",
      });
      return;
    }

    const allRooms = await getRooms();
    const allBookings = await getBookings();

    // Filter bookings for the requested date/time
    const conflictingBookings = allBookings.filter((b) => {
      return b.date === date && b.startTime < endTime && b.endTime > startTime;
    });

    const bookedRoomIds = new Set(conflictingBookings.map((b) => b.roomId));
    const availableRooms = allRooms.filter((r) => !bookedRoomIds.has(r.id));

    res.json({
      success: true,
      availableRooms,
      bookedRooms: allRooms.filter((r) => bookedRoomIds.has(r.id)),
      date,
      startTime,
      endTime,
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check availability",
    });
  }
};
