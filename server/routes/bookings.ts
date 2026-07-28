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
  getBookingById,
  updateBookingById,
  deleteBookingById,
  BookingConflictError,
} from "../data";
import {
  validateDate,
  validateTime,
  validateTimeRange,
  validateInstitutionalEmail,
  institutionalEmailErrorMessage,
  timeToMinutes,
} from "../utils/validation";
import { sendBookingConfirmationEmail } from "../services/email";

export const handleListBookings: RequestHandler = async (_req, res) => {
  try {
    const bookings = await getBookings();
    const response: ListBookingsResponse = { bookings };
    res.json(response);
  } catch (error) {
    console.error("Error listing bookings:", error);
    res.status(500).json({ error: "Não foi possível listar os agendamentos" });
  }
};

export const handleCheckAvailability: RequestHandler = async (req, res) => {
  try {
    const { date, startTime, endTime } = req.body as CheckAvailabilityRequest;

    if (!date || !startTime || !endTime) {
      res.status(400).json({ error: "Campos obrigatórios ausentes" });
      return;
    }

    const allRooms = await getRooms();

    // Verifica disponibilidade para cada sala
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
    res
      .status(500)
      .json({ error: "Não foi possível verificar a disponibilidade" });
  }
};

export const handleCreateBooking: RequestHandler = async (req, res) => {
  try {
    const { roomId, clientName, clientEmail, date, startTime, endTime } =
      req.body as CreateBookingRequest;

    // Validação
    if (
      !roomId ||
      !clientName ||
      !clientEmail ||
      !date ||
      !startTime ||
      !endTime
    ) {
      res.status(400).json({ error: "Campos obrigatórios ausentes" });
      return;
    }

    // Valida formato e intervalo da data
    if (!validateDate(date)) {
      res.status(400).json({
        error:
          "Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD)",
      });
      return;
    }

    // Valida formato e intervalo da hora
    if (!validateTime(startTime)) {
      res
        .status(400)
        .json({ error: "Horário de início inválido (use o formato HH:mm)" });
      return;
    }

    if (!validateTime(endTime)) {
      res
        .status(400)
        .json({ error: "Horário de término inválido (use o formato HH:mm)" });
      return;
    }

    if (!validateTimeRange(startTime, endTime)) {
      res.status(400).json({
        error: "O horário de término deve ser depois do horário de início",
      });
      return;
    }

    // Valida email institucional
    if (!validateInstitutionalEmail(clientEmail)) {
      res.status(400).json({ error: institutionalEmailErrorMessage() });
      return;
    }

    // Verifica se a sala existe
    const rooms = await getRooms();
    const room = rooms.find((r) => String(r.id) === String(roomId));
    if (!room) {
      res.status(404).json({ error: "Sala não encontrada" });
      return;
    }

    // A verificação de disponibilidade e a inserção acontecem de forma
    // síncrona (sem await entre elas) dentro de createBooking — com o Node
    // single-threaded, isso garante a ausência de reservas duplicadas no
    // armazenamento em memória.
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

    const response: CreateBookingResponse = { booking };
    res.status(201).json(response);
  } catch (error) {
    if (error instanceof BookingConflictError) {
      res
        .status(409)
        .json({ error: "A sala não está disponível no horário solicitado" });
      return;
    }
    console.error("Error creating booking:", error);
    res.status(500).json({ error: "Não foi possível criar o agendamento" });
  }
};

export const handleGetAvailableTimes: RequestHandler = async (req, res) => {
  try {
    const { date } = req.query as { date: string };

    if (!date) {
      res.status(400).json({ error: "A data é obrigatória" });
      return;
    }

    const allRooms = await getRooms();
    const allBookings = await getBookings();
    const bookings = allBookings.filter((b) => b.date === date);

    // Obter todos os agendamentos para esta data
    const bookedSlots: {
      [roomId: string]: Array<{ start: number; end: number }>;
    } = {};

    bookings.forEach((booking) => {
      if (!bookedSlots[booking.roomId]) {
        bookedSlots[booking.roomId] = [];
      }
      bookedSlots[booking.roomId].push({
        start: timeToMinutes(booking.startTime),
        end: timeToMinutes(booking.endTime),
      });
    });

    res.json({ availableRooms: allRooms, bookedSlots });
  } catch (error) {
    console.error("Error getting available times:", error);
    res
      .status(500)
      .json({ error: "Não foi possível obter os horários disponíveis" });
  }
};

export const handleGetBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await getBookingById(id);

    if (!booking) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    res.json(booking);
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({ error: "Não foi possível obter o agendamento" });
  }
};

export const handleUpdateBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, date, startTime, endTime, roomId } =
      req.body;

    if (!clientName || !clientEmail || !date || !startTime || !endTime) {
      res.status(400).json({ error: "Campos obrigatórios ausentes" });
      return;
    }

    // Validar formato e intervalo da data
    if (!validateDate(date)) {
      res.status(400).json({
        error:
          "Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD)",
      });
      return;
    }

    // Valida formato e intervalo da hora
    if (!validateTime(startTime)) {
      res
        .status(400)
        .json({ error: "Horário de início inválido (use o formato HH:mm)" });
      return;
    }

    if (!validateTime(endTime)) {
      res
        .status(400)
        .json({ error: "Horário de término inválido (use o formato HH:mm)" });
      return;
    }

    if (!validateTimeRange(startTime, endTime)) {
      res.status(400).json({
        error: "O horário de término deve ser depois do horário de início",
      });
      return;
    }

    // Valida email institucional
    if (!validateInstitutionalEmail(clientEmail)) {
      res.status(400).json({ error: institutionalEmailErrorMessage() });
      return;
    }

    const existingBooking = await getBookingById(id);
    if (!existingBooking) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    // Se a sala foi alterada, valida que ela existe ANTES de atualizar
    // (evita que o erro apareça como "Agendamento não encontrado")
    if (roomId) {
      const rooms = await getRooms();
      const room = rooms.find((r) => String(r.id) === String(roomId));
      if (!room) {
        res.status(404).json({ error: "Sala não encontrada" });
        return;
      }
    }

    // Rejeita a atualização se colidir com OUTRO agendamento
    const targetRoomId = roomId || existingBooking.roomId;
    const hasConflict = await bookingExists(
      targetRoomId,
      date,
      startTime,
      endTime,
      id,
    );
    if (hasConflict) {
      res
        .status(409)
        .json({ error: "A sala não está disponível no horário solicitado" });
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
      res.status(404).json({ error: "Agendamento não encontrado" });
    } else {
      res
        .status(500)
        .json({ error: "Não foi possível atualizar o agendamento" });
    }
  }
};

export const handleDeleteBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await deleteBookingById(id);
    if (!success) {
      res.status(404).json({ error: "Agendamento não encontrado" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ error: "Não foi possível excluir o agendamento" });
  }
};
