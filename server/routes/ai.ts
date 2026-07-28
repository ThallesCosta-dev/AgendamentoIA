import { RequestHandler } from "express";
import {
  getRooms,
  deleteBookingById,
  updateBookingById,
  getBookingById,
  bookingExists,
} from "../data";
import {
  validateDate,
  validateTime,
  validateTimeRange,
  maskEmail,
} from "../utils/validation";
import { sendBookingCancellationEmail } from "../services/email";
import { classifyEmail } from "../services/emailClassifier";
import {
  generateInformationRequestResponse,
  generateIncompleteBookingResponse,
} from "../services/emailResponder";

const EMAIL_MISMATCH_ERROR =
  "O email informado não corresponde ao email da reserva";

/** Comparação de emails caso-insensível (com trim). */
function emailsMatch(a: string, b: string): boolean {
  return (
    typeof a === "string" &&
    typeof b === "string" &&
    a.trim().toLowerCase() === b.trim().toLowerCase()
  );
}

/**
 * Endpoint de IA: Obtém um agendamento específico por ID
 * Público, mas o email do cliente é retornado MASCARADO
 * (ex.: "th***@ioc.fiocruz.br") — a verificação de posse acontece
 * nas rotas de modificação/cancelamento.
 */
export const handleAIGetBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "O ID do agendamento é obrigatório",
      });
      return;
    }

    const booking = await getBookingById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: `Agendamento com ID ${id} não encontrado`,
      });
      return;
    }

    res.json({
      success: true,
      booking: {
        ...booking,
        clientEmail: maskEmail(booking.clientEmail),
      },
    });
  } catch (error) {
    console.error("Error getting booking:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível obter o agendamento",
    });
  }
};

/**
 * Endpoint de IA: Atualiza/modifica um agendamento existente por ID
 * O campo `clientEmail` do corpo é usado APENAS como fator de verificação:
 * deve corresponder (caso-insensível) ao email da reserva. Ele nunca altera
 * o email armazenado.
 */
export const handleAIUpdateBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { clientName, clientEmail, date, startTime, endTime, roomId } =
      req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "O ID do agendamento é obrigatório",
      });
      return;
    }

    if (!clientEmail || typeof clientEmail !== "string") {
      res.status(400).json({
        success: false,
        error:
          "O campo clientEmail é obrigatório para verificar a titularidade da reserva",
      });
      return;
    }

    // Verifica se o agendamento existe
    const existingBooking = await getBookingById(id);
    if (!existingBooking) {
      res.status(404).json({
        success: false,
        error: `Agendamento com ID ${id} não encontrado`,
      });
      return;
    }

    // Verificação de titularidade: o email informado deve corresponder
    // ao email da reserva
    if (!emailsMatch(clientEmail, existingBooking.clientEmail)) {
      res.status(403).json({
        success: false,
        error: EMAIL_MISMATCH_ERROR,
      });
      return;
    }

    // Valores efetivos após a atualização
    const effectiveDate = date || existingBooking.date;
    const effectiveStartTime = startTime || existingBooking.startTime;
    const effectiveEndTime = endTime || existingBooking.endTime;
    const effectiveRoomId = roomId || existingBooking.roomId;

    // Valida data e horários efetivos
    if (!validateDate(effectiveDate)) {
      res.status(400).json({
        success: false,
        error:
          "Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD)",
      });
      return;
    }

    if (!validateTime(effectiveStartTime) || !validateTime(effectiveEndTime)) {
      res.status(400).json({
        success: false,
        error: "Horário inválido (use o formato HH:mm)",
      });
      return;
    }

    if (!validateTimeRange(effectiveStartTime, effectiveEndTime)) {
      res.status(400).json({
        success: false,
        error: "O horário de término deve ser depois do horário de início",
      });
      return;
    }

    // Verifica se a sala existe se foi alterada
    let roomName = existingBooking.roomName;
    if (roomId) {
      const rooms = await getRooms();
      const room = rooms.find((r) => String(r.id) === String(roomId));
      if (!room) {
        res.status(404).json({
          success: false,
          error: "Sala não encontrada",
        });
        return;
      }
      roomName = room.name;
    }

    // Rejeita a atualização se colidir com OUTRO agendamento
    const hasConflict = await bookingExists(
      effectiveRoomId,
      effectiveDate,
      effectiveStartTime,
      effectiveEndTime,
      id,
    );
    if (hasConflict) {
      res.status(409).json({
        success: false,
        error: "A sala não está disponível no horário solicitado",
      });
      return;
    }

    // clientEmail NÃO é um campo de atualização nesta rota — o email
    // armazenado permanece o mesmo.
    const updatedBooking = await updateBookingById(id, {
      clientName: clientName || existingBooking.clientName,
      date: effectiveDate,
      startTime: effectiveStartTime,
      endTime: effectiveEndTime,
      roomId: effectiveRoomId,
      roomName,
    });

    res.json({
      success: true,
      booking: updatedBooking,
      message: `Agendamento ${id} atualizado com sucesso`,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível atualizar o agendamento",
    });
  }
};

/**
 * Endpoint de IA: Deleta/cancela um agendamento por ID
 * Exige o parâmetro de query `email` correspondendo (caso-insensível)
 * ao email da reserva.
 */
export const handleAICancelBooking: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const email = req.query.email;

    if (!id) {
      res.status(400).json({
        success: false,
        error: "O ID do agendamento é obrigatório",
      });
      return;
    }

    if (!email || typeof email !== "string") {
      res.status(400).json({
        success: false,
        error:
          "O parâmetro email é obrigatório para verificar a titularidade da reserva",
      });
      return;
    }

    // Verificar se o agendamento existe
    const booking = await getBookingById(id);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: `Agendamento com ID ${id} não encontrado`,
      });
      return;
    }

    // Verificação de titularidade
    if (!emailsMatch(email, booking.clientEmail)) {
      res.status(403).json({
        success: false,
        error: EMAIL_MISMATCH_ERROR,
      });
      return;
    }

    const success = await deleteBookingById(id);
    if (!success) {
      res.status(500).json({
        success: false,
        error: "Não foi possível cancelar o agendamento",
      });
      return;
    }

    try {
      await sendBookingCancellationEmail(booking);
    } catch (emailError) {
      console.error("Failed to send cancellation email:", emailError);
    }

    res.json({
      success: true,
      message: `Agendamento ${id} cancelado com sucesso`,
      cancelledBooking: booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível cancelar o agendamento",
    });
  }
};

/**
 * Endpoint de IA: Classifica email para processamento de reservas
 * Usado pelo sistema de email para classificar emails recebidos
 */
export const handleEmailClassification: RequestHandler = async (req, res) => {
  try {
    const { emailContent, subject, senderEmail } = req.body;

    if (!emailContent) {
      res.status(400).json({
        success: false,
        error: "O conteúdo do email é obrigatório",
      });
      return;
    }

    const classification = classifyEmail(
      emailContent,
      subject || "",
      senderEmail || "",
    );

    res.json({
      success: true,
      classification,
    });
  } catch (error) {
    console.error("Error classifying email:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível classificar o email",
    });
  }
};

/**
 * Endpoint de IA: Gera resposta baseada na classificação do email
 * Usa os templates reais do emailResponder.
 */
export const handleEmailResponseGeneration: RequestHandler = async (
  req,
  res,
) => {
  try {
    const {
      classification,
      extractedData,
      missingFields,
      senderEmail,
      originalSubject,
    } = req.body;

    if (!classification || !senderEmail) {
      res.status(400).json({
        success: false,
        error: "Os campos classification e senderEmail são obrigatórios",
      });
      return;
    }

    const safeMissingFields: string[] = Array.isArray(missingFields)
      ? missingFields.map((f) => String(f))
      : [];

    let responseData;
    if (
      classification === "INFORMATION_REQUEST" ||
      classification === "UNCLEAR"
    ) {
      responseData = await generateInformationRequestResponse(
        senderEmail,
        originalSubject,
      );
    } else if (classification === "BOOKING_REQUEST") {
      responseData = await generateIncompleteBookingResponse(
        senderEmail,
        extractedData && typeof extractedData === "object" ? extractedData : {},
        safeMissingFields,
        originalSubject,
      );
    } else {
      res.status(400).json({
        success: false,
        error:
          "Classificação inválida. Use INFORMATION_REQUEST, BOOKING_REQUEST ou UNCLEAR.",
      });
      return;
    }

    res.json({
      success: true,
      responseData,
    });
  } catch (error) {
    console.error("Error generating email response:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível gerar a resposta do email",
    });
  }
};
