import { validateInstitutionalEmail } from "../data";
import { createEmailLogger } from "../utils/emailLogger";

const logger = createEmailLogger("EmailClassifier");

export interface ExtractedBookingData {
  clientName?: string;
  clientEmail?: string;
  roomName?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export interface EmailClassificationResult {
  type: "INFORMATION_REQUEST" | "BOOKING_REQUEST" | "UNCLEAR";
  extractedData: ExtractedBookingData;
  missingFields: string[];
  confidence: number;
  message?: string;
}

export function extractDataFromText(text: string): ExtractedBookingData {
  const data: ExtractedBookingData = {};

  // Email pattern - more comprehensive
  const emailMatch = text.match(/[\w\.-]+@[\w\.-]+\.\w+/g);
  if (emailMatch) {
    // Find institutional email (.edu.br)
    const institutionalEmail = emailMatch.find(email => email.endsWith(".edu.br"));
    if (institutionalEmail) {
      data.clientEmail = institutionalEmail;
    }
  }

  // Name patterns - multiple approaches
  const namePatterns = [
    /(?:meu nome é|me chamo|sou|ass:|assinatura:)\s+([A-Z][a-záàâãéèêíïóôõöúçñ\s]{2,50})/gi,
    /^([A-Z][a-záàâãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)?)/,
    /(?:de|por)\s+([A-Z][a-záàâãéèêíïóôõöúçñ\s]{2,50})$/i
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Filter out common words that might be captured
      if (!name.toLowerCase().includes("reserva") &&
          !name.toLowerCase().includes("sala") &&
          !name.toLowerCase().includes("agendamento") &&
          name.split(" ").length >= 2) {
        data.clientName = name;
        break;
      }
    }
  }

  // Date patterns - comprehensive
  const datePatterns = [
    // YYYY-MM-DD (ISO format)
    /(\d{4}-\d{2}-\d{2})/g,
    // DD/MM/YYYY or DD-MM-YYYY
    /(\d{2}[\/-]\d{2}[\/-]\d{4})/g,
    // DD/MM or DD-MM (current year implied)
    /(\d{2}[\/-]\d{2})(?![\/-]\d{2})/g,
    // Portuguese format: "15 de fevereiro de 2025" or "15 de fevereiro"
    /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/gi
  ];

  const foundDates = [];
  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const convertedDate = convertDateToISO(match);
        if (convertedDate && isValidDate(convertedDate)) {
          foundDates.push(convertedDate);
        }
      }
    }
  }

  if (foundDates.length > 0) {
    // Prefer the first date found that's in the future
    const futureDates = foundDates.filter(date => isDateFuture(date));
    if (futureDates.length > 0) {
      data.date = futureDates[0];
    } else {
      data.date = foundDates[0];
    }
  }

  // Time patterns - comprehensive
  const timePatterns = [
    // HH:MM format
    /(\d{1,2}):(\d{2})\s*(?:h|horas)?/gi,
    // HH h format
    /(\d{1,2})\s*(?:h|horas)/gi,
    // Simple numbers that look like hours (in short contexts)
    /(?:\s|^)(\d{1,2})(?=\s|$)/g
  ];

  const validTimes = [];

  // Extract explicit times first
  const timeMatches = text.match(/\d{1,2}:\d{2}|\d{1,2}\s*(?:h|horas)/gi);
  if (timeMatches) {
    for (const timeStr of timeMatches) {
      const parsedTime = parseTime(timeStr);
      if (parsedTime) {
        validTimes.push(parsedTime);
      }
    }
  }

  if (validTimes.length >= 1) {
    data.startTime = validTimes[0];
  }
  if (validTimes.length >= 2) {
    data.endTime = validTimes[1];
  }

  // Room name patterns - look for room mentions
  const roomPatterns = [
    /(?:sala|salão|auditório|laboratório)\s+([A-Za-z0-9\s\-À-ž]{2,30})/gi,
    /(?:room|auditorium|lab)\s+([A-Za-z0-9\s\-]{2,30})/gi
  ];

  for (const pattern of roomPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const roomName = match.trim();
        if (roomName && roomName.length > 3) {
          data.roomName = roomName;
          break;
        }
      }
    }
    if (data.roomName) break;
  }

  logger.debug("Extracted data from text", { text, extractedData: data });
  return data;
}

function convertDateToISO(dateStr: string): string {
  // If already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Convert DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[\/-]\d{2}[\/-]\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.replace("-", "/").split("/");
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Convert DD/MM or DD-MM (assume current year)
  if (/^\d{2}[\/-]\d{2}$/.test(dateStr)) {
    const [day, month] = dateStr.replace("-", "/").split("/");
    const year = new Date().getFullYear();
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Convert Portuguese date format
  const ptDateMatch = dateStr.match(/(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?/i);
  if (ptDateMatch) {
    const day = ptDateMatch[1].padStart(2, "0");
    const months: { [key: string]: string } = {
      janeiro: "01", fevereiro: "02", março: "03", abril: "04",
      maio: "05", junho: "06", julho: "07", agosto: "08",
      setembro: "09", outubro: "10", novembro: "11", dezembro: "12"
    };
    const month = months[ptDateMatch[2].toLowerCase()];
    const year = ptDateMatch[3] || new Date().getFullYear();
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  return dateStr;
}

function parseTime(timeStr: string): string | null {
  // HH:MM format
  const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (colonMatch) {
    const hours = parseInt(colonMatch[1]);
    const minutes = parseInt(colonMatch[2]);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }

  // HH h format
  const hourMatch = timeStr.match(/(\d{1,2})\s*(?:h|horas)/i);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1]);
    if (hours >= 0 && hours <= 23) {
      return `${hours.toString().padStart(2, "0")}:00`;
    }
  }

  return null;
}

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isDateFuture(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);

  return date >= today;
}

export function classifyEmail(emailContent: string, subject: string = "", senderEmail: string = ""): EmailClassificationResult {
  const text = `${subject} ${emailContent}`.toLowerCase();

  // Extract data first
  const extractedData = extractDataFromText(`${subject} ${emailContent}`);

  // Keywords that suggest information requests
  const informationKeywords = [
    "como", "como faço", "gostaria de saber", "informações", "informação",
    "dúvida", "ajuda", "funciona", "processo", "regras", "política",
    "disponibilidade", "quais salas", "tipos de sala", "valores", "custo",
    "horário de funcionamento", "contato", "telefone", "endereço"
  ];

  // Keywords that suggest booking requests
  const bookingKeywords = [
    "reservar", "agendar", "reserva", "agendamento", "quero reservar",
    "gostaria de reservar", "preciso reservar", "solicitar", "disponível",
    "posso usar", "alugar", "ocupar", "marcar", "combinação"
  ];

  // Check for booking indicators
  const hasBookingKeywords = bookingKeywords.some(keyword => text.includes(keyword));
  const hasInformationKeywords = informationKeywords.some(keyword => text.includes(keyword));

  // Check if sufficient booking data is present
  const hasEmail = extractedData.clientEmail && validateInstitutionalEmail(extractedData.clientEmail);
  const hasName = extractedData.clientName && extractedData.clientName.split(" ").length >= 2;
  const hasDate = extractedData.date;
  const hasTime = extractedData.startTime && extractedData.endTime;

  const bookingDataScore = [hasEmail, hasName, hasDate, hasTime].filter(Boolean).length;

  // Determine classification
  let type: "INFORMATION_REQUEST" | "BOOKING_REQUEST" | "UNCLEAR";
  let confidence = 0;
  let missingFields: string[] = [];

  if (hasBookingKeywords || bookingDataScore >= 3) {
    type = "BOOKING_REQUEST";
    confidence = hasBookingKeywords ? 0.8 : 0.6;

    if (hasEmail && hasName && hasDate && hasTime) {
      confidence = 0.95;
    }

    // Identify missing fields for booking requests
    if (!hasName) missingFields.push("Nome completo");
    if (!hasEmail) missingFields.push("Email institucional (.edu.br)");
    if (!hasDate) missingFields.push("Data da reserva");
    if (!hasTime) missingFields.push("Horário (início e término)");
    if (!extractedData.roomName) missingFields.push("Nome da sala");

  } else if (hasInformationKeywords || (!hasBookingKeywords && bookingDataScore < 2)) {
    type = "INFORMATION_REQUEST";
    confidence = 0.85;
  } else {
    type = "UNCLEAR";
    confidence = 0.4;
  }

  logger.info("Email classified", {
    type,
    confidence,
    hasBookingData: {
      email: hasEmail,
      name: hasName,
      date: hasDate,
      time: hasTime
    },
    missingFields
  });

  return {
    type,
    extractedData,
    missingFields,
    confidence,
    message: type === "UNCLEAR" ? "Não foi possível determinar a intenção do email. Por favor, seja mais específico." : undefined
  };
}