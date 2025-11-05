import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MessageCircle, Loader } from "lucide-react";
import { Room, Booking } from "@shared/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Parse markdown-like formatting for bot messages
function parseMessageContent(content: string) {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;

  // Pattern to match: **bold**, *italic*, and line breaks
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|(?<!\*)(\\n|\n)(?!\*)/g;
  let match;

  while ((match = pattern.exec(content)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(content.substring(lastIndex, match.index));
    }

    if (match[1]) {
      // **bold** pattern
      parts.push(
        <strong key={`${lastIndex}-bold`} className="font-bold">
          {match[1]}
        </strong>,
      );
    } else if (match[2]) {
      // *italic* pattern
      parts.push(
        <em key={`${lastIndex}-italic`} className="italic">
          {match[2]}
        </em>,
      );
    } else if (match[3]) {
      // Line break pattern
      parts.push(<br key={`${lastIndex}-br`} />);
    }

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.substring(lastIndex));
  }

  return parts.length === 0 ? content : parts;
}

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
  role: "user" | "assistant";
}

interface ExtractedData {
  name?: string;
  email?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  equipment?: string;
}

type ConversationFlow = "booking" | "modify" | "cancel" | "none";

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messageCounterRef = useRef(0);
  const initializedRef = useRef(false);

  // Form data extracted from conversation
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    date: "",
    startTime: "",
    endTime: "",
    duration: "",
    equipment: "",
    selectedRoomId: "",
  });

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [currentFlow, setCurrentFlow] = useState<ConversationFlow>("booking");
  const [currentBookingId, setCurrentBookingId] = useState<string>("");
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [modificationField, setModificationField] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialMessage: Message = {
      id: `msg-${messageCounterRef.current}`,
      type: "bot",
      content:
        "Olá! 👋 Bem-vindo ao assistente de agendamento de salas para defesa de tese. Estou aqui para ajudá-lo a reservar uma sala. Por favor, comece nos informando seu nome completo.",
      timestamp: new Date(),
      role: "assistant",
    };
    messageCounterRef.current += 1;
    setMessages([initialMessage]);
    setConversationHistory([
      {
        role: "assistant",
        content: initialMessage.content,
      },
    ]);
  }, []);

  const convertDateToISO = (dateStr: string): string => {
    // If already in ISO format (YYYY-MM-DD), return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Convert DD-MM-YYYY to YYYY-MM-DD
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("-");
      return `${year}-${month}-${day}`;
    }

    // Convert DD/MM/YYYY to YYYY-MM-DD (legacy support)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
      const [day, month, year] = dateStr.split("/");
      return `${year}-${month}-${day}`;
    }

    return dateStr;
  };

  const formatDateForDisplay = (dateStr: string): string => {
    // Convert YYYY-MM-DD to DD/MM/YYYY for display
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const extractDataFromText = (text: string): ExtractedData => {
    const data: ExtractedData = {};

    // Email pattern
    const emailMatch = text.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch) {
      data.email = emailMatch[0];
    }

    // Name pattern - if starts with capital letter and is 2+ words
    const nameMatch = text.match(
      /(?:meu nome é|me chamo|sou) ([A-Z][a-záàâãéèêíïóôõöúçñ\s]+)/i,
    );
    if (nameMatch) {
      data.name = nameMatch[1].trim();
    } else if (!emailMatch) {
      // Try to extract first 2-3 words if they look like a name
      const nameWords = text.match(
        /^([A-Z][a-záà��ãéèêíïóôõöúçñ]+(?:\s+[A-Z][a-záàâãéèêíïóôõöúçñ]+)?)/,
      );
      if (nameWords && !text.toLowerCase().includes("agendar")) {
        data.name = nameWords[1];
      }
    }

    // Date pattern (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or Portuguese format like "15 de fevereiro")
    const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    const dateDashMatch = text.match(/(\d{2}-\d{2}-\d{4})/);
    const dateSlashMatch = text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (isoDateMatch) {
      data.date = isoDateMatch[1];
    } else if (dateDashMatch) {
      data.date = convertDateToISO(dateDashMatch[1]);
    } else if (dateSlashMatch) {
      data.date = convertDateToISO(dateSlashMatch[1]);
    } else {
      // Try Portuguese date format
      const ptDateMatch = text.match(
        /(\d{1,2})\s+de\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i,
      );
      if (ptDateMatch) {
        const day = ptDateMatch[1].padStart(2, "0");
        const months: { [key: string]: string } = {
          janeiro: "01",
          fevereiro: "02",
          março: "03",
          abril: "04",
          maio: "05",
          junho: "06",
          julho: "07",
          agosto: "08",
          setembro: "09",
          outubro: "10",
          novembro: "11",
          dezembro: "12",
        };
        const month = months[ptDateMatch[2].toLowerCase()];
        if (month) {
          const year = new Date().getFullYear();
          data.date = `${year}-${month}-${day}`;
        }
      }
    }

    // Time pattern (HH:mm or just HH with h/horas)
    const validTimes = [];

    // First try to match explicit time formats (HH:mm or HH h/horas)
    const explicitTimeMatches = text.match(/(\d{1,2}):(\d{2})\s*(?:h|horas)?|(\d{1,2})\s*(?:h|horas)/g);
    if (explicitTimeMatches) {
      for (const timeStr of explicitTimeMatches) {
        // Parse HH:mm format
        const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (colonMatch) {
          const hour = parseInt(colonMatch[1]);
          if (hour >= 0 && hour <= 23) {
            validTimes.push(`${colonMatch[1].padStart(2, "0")}:${colonMatch[2]}`);
          }
          continue;
        }

        // Parse HH format (with h or horas)
        const hMatch = timeStr.match(/(\d{1,2})\s*(?:h|horas)/);
        if (hMatch) {
          const hour = parseInt(hMatch[1]);
          if (hour >= 0 && hour <= 23) {
            validTimes.push(`${hMatch[1].padStart(2, "0")}:00`);
          }
        }
      }
    }

    // If no explicit times found, try to match plain numbers (0-23) only if text is very short
    // This helps capture "15" or "16" as times, but won't match date numbers in longer strings
    if (validTimes.length === 0 && text.trim().length <= 3) {
      const plainNumberMatch = text.match(/^(\d{1,2})$/);
      if (plainNumberMatch) {
        const num = parseInt(plainNumberMatch[1]);
        if (num >= 0 && num <= 23) {
          validTimes.push(`${num.toString().padStart(2, "0")}:00`);
        }
      }
    }

    if (validTimes.length >= 1) {
      data.startTime = validTimes[0];
    }
    if (validTimes.length >= 2) {
      data.endTime = validTimes[1];
    }

    // Duration pattern (numbers followed by minuto/min/h/hora)
    const durationMatch = text.match(/(\d+)\s*(minuto|min|h|hora|horas)/i);
    if (durationMatch) {
      data.duration = durationMatch[0];
    }

    console.log("Extracted from text:", { text, data });
    return data;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    // Accept any Brazilian educational institution email (.edu.br domain)
    return email.endsWith(".edu.br");
  };

  const validateDate = (dateStr: string): boolean => {
    // Validate YYYY-MM-DD format
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

  const checkAvailability = async (
    date: string,
    startTime: string,
    endTime: string,
  ) => {
    try {
      const response = await fetch("/api/bookings/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, endTime }),
      });

      if (!response.ok) throw new Error("Failed to check availability");
      const data = await response.json();
      return data.availableRooms as Room[];
    } catch (error) {
      console.error("Error checking availability:", error);
      return [];
    }
  };


  const fetchBookingDetails = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/ai/bookings/${bookingId}`);
      if (!response.ok) {
        throw new Error("Agendamento não encontrado");
      }
      const data = await response.json();
      return data.booking as Booking;
    } catch (error) {
      throw error;
    }
  };

  const modifyBooking = async (
    bookingId: string,
    updates: {
      clientName?: string;
      clientEmail?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      roomId?: string;
    },
  ) => {
    try {
      const response = await fetch(`/api/ai/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to modify booking");
      }

      const data = await response.json();
      return data.booking as Booking;
    } catch (error) {
      throw error;
    }
  };

  const cancelBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/ai/bookings/${bookingId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel booking");
      }

      return true;
    } catch (error) {
      throw error;
    }
  };

  const addBotMessage = (content: string) => {
    const message: Message = {
      id: `msg-${messageCounterRef.current}`,
      type: "bot",
      content,
      timestamp: new Date(),
      role: "assistant",
    };
    messageCounterRef.current += 1;
    setMessages((prev) => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: `msg-${messageCounterRef.current}`,
      type: "user",
      content,
      timestamp: new Date(),
      role: "user",
    };
    messageCounterRef.current += 1;
    setMessages((prev) => [...prev, message]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    addUserMessage(userInput);
    setInput("");
    setIsLoading(true);

    try {
      // Check if user wants to modify or cancel booking
      const lowerInput = userInput.toLowerCase();
      const wantsModify =
        lowerInput.includes("modificar") ||
        lowerInput.includes("editar") ||
        lowerInput.includes("change") ||
        lowerInput.includes("alterar");
      const wantsCancel =
        lowerInput.includes("cancelar") ||
        lowerInput.includes("cancel") ||
        lowerInput.includes("remover");

      if (wantsModify && currentFlow === "booking") {
        setCurrentFlow("modify");
        addBotMessage(
          "Para modificar um agendamento, preciso do ID da reserva. Qual é o ID? (Exemplo: #12345 ou 12345)",
        );
        setIsLoading(false);
        return;
      }

      if (wantsCancel && currentFlow === "booking") {
        setCurrentFlow("cancel");
        addBotMessage(
          "Para cancelar um agendamento, preciso do ID da reserva. Qual é o ID? (Exemplo: #12345 ou 12345)",
        );
        setIsLoading(false);
        return;
      }

      // Extract booking ID if in modify/cancel flow
      if (
        (currentFlow === "modify" || currentFlow === "cancel") &&
        !currentBookingId
      ) {
        const idMatch = userInput.match(/#?(\d+)/);
        if (idMatch) {
          const bookingId = idMatch[1];
          setCurrentBookingId(bookingId);

          try {
            const fetchedBooking = await fetchBookingDetails(bookingId);
            setCurrentBooking(fetchedBooking);

            const bookingInfo = `📋 Dados do Agendamento #${fetchedBooking.id}:\n📍 Sala: ${fetchedBooking.roomName}\n📅 Data: ${new Date(fetchedBooking.date).toLocaleDateString("pt-BR")}\n⏰ Horário: ${fetchedBooking.startTime} - ${fetchedBooking.endTime}\n👤 Nome: ${fetchedBooking.clientName}\n📧 Email: ${fetchedBooking.clientEmail}`;

            if (currentFlow === "modify") {
              addBotMessage(
                `${bookingInfo}\n\nQuais dados deseja modificar?\n- Nome\n- Email\n- Data\n- Hora inicial\n- Hora final\n- Sala`,
              );
              setModificationField("");
            } else {
              addBotMessage(
                `${bookingInfo}\n\n⚠️ Tem certeza que deseja CANCELAR este agendamento? (Sim/Não)`,
              );
            }
            setIsLoading(false);
            return;
          } catch (error) {
            addBotMessage(
              `❌ Agendamento não encontrado. Verifique o ID e tente novamente.`,
            );
            setCurrentFlow("booking");
            setCurrentBookingId("");
            setCurrentBooking(null);
            setIsLoading(false);
            return;
          }
        } else {
          addBotMessage(
            "ID inválido. Por favor, digite um número (Exemplo: 12345)",
          );
          setIsLoading(false);
          return;
        }
      }

      // Handle cancel confirmation
      if (currentFlow === "cancel" && currentBookingId && currentBooking) {
        if (
          lowerInput.includes("sim") ||
          lowerInput.includes("yes") ||
          lowerInput.includes("confirmar")
        ) {
          await cancelBooking(currentBookingId);
          addBotMessage(
            `✅ Agendamento #${currentBookingId} foi cancelado com sucesso!`,
          );
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setIsLoading(false);
          return;
        } else if (
          lowerInput.includes("não") ||
          lowerInput.includes("no") ||
          lowerInput.includes("nao")
        ) {
          addBotMessage(
            "Cancelamento abortado. Como posso ajudá-lo? (novo agendamento, modificar ou cancelar)",
          );
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setIsLoading(false);
          return;
        }
      }

      // Handle modification field selection
      if (
        currentFlow === "modify" &&
        currentBookingId &&
        currentBooking &&
        !modificationField
      ) {
        if (lowerInput.includes("nome")) {
          setModificationField("clientName");
          addBotMessage("Qual é o novo nome?");
          setIsLoading(false);
          return;
        } else if (lowerInput.includes("email")) {
          setModificationField("clientEmail");
          addBotMessage("Qual é o novo email?");
          setIsLoading(false);
          return;
        } else if (lowerInput.includes("data")) {
          setModificationField("date");
          addBotMessage("Qual é a nova data? (YYYY-MM-DD ou DD/MM/YYYY)");
          setIsLoading(false);
          return;
        } else if (
          lowerInput.includes("hora inicial") ||
          lowerInput.includes("início") ||
          lowerInput.includes("start time")
        ) {
          setModificationField("startTime");
          addBotMessage("Qual é a nova hora inicial? (HH:mm)");
          setIsLoading(false);
          return;
        } else if (
          lowerInput.includes("hora final") ||
          lowerInput.includes("fim") ||
          lowerInput.includes("end time")
        ) {
          setModificationField("endTime");
          addBotMessage("Qual é a nova hora final? (HH:mm)");
          setIsLoading(false);
          return;
        } else if (lowerInput.includes("sala")) {
          setModificationField("roomId");
          const rooms = await checkAvailability(
            currentBooking.date,
            currentBooking.startTime,
            currentBooking.endTime,
          );
          if (rooms.length > 0) {
            const roomsList = rooms.map((r) => `- ${r.name}`).join("\n");
            addBotMessage(
              `Salas disponíveis para essa data e hora:\n${roomsList}\n\nQual sala você prefere?`,
            );
            setAvailableRooms(rooms);
          } else {
            addBotMessage(
              "Nenhuma sala disponível para essa data e hora. Tente modificar a data ou horário primeiro.",
            );
            setModificationField("");
          }
          setIsLoading(false);
          return;
        }
      }

      // Handle modification value input
      if (
        currentFlow === "modify" &&
        currentBookingId &&
        currentBooking &&
        modificationField
      ) {
        try {
          let newValue = userInput;
          let fieldToUpdate: any = {};

          if (modificationField === "clientName") {
            fieldToUpdate.clientName = newValue;
          } else if (modificationField === "clientEmail") {
            if (!validateEmail(newValue)) {
              addBotMessage(
                "❌ Email inválido. Use um email institucional (.edu.br)",
              );
              setIsLoading(false);
              return;
            }
            fieldToUpdate.clientEmail = newValue;
          } else if (modificationField === "date") {
            fieldToUpdate.date = newValue;
          } else if (modificationField === "startTime") {
            fieldToUpdate.startTime = newValue;
          } else if (modificationField === "endTime") {
            fieldToUpdate.endTime = newValue;
          } else if (modificationField === "roomId") {
            const selectedRoom = availableRooms.find((r) =>
              newValue.toLowerCase().includes(r.name.toLowerCase()),
            );
            if (selectedRoom) {
              fieldToUpdate.roomId = selectedRoom.id;
            } else {
              addBotMessage(
                "Sala não encontrada. Por favor, escolha uma sala válida.",
              );
              setIsLoading(false);
              return;
            }
          }

          const updatedBooking = await modifyBooking(
            currentBookingId,
            fieldToUpdate,
          );
          addBotMessage(
            `✅ Agendamento #${currentBookingId} modificado com sucesso!\n\n📋 Dados atualizados:\n📍 Sala: ${updatedBooking.roomName}\n�� Data: ${new Date(updatedBooking.date).toLocaleDateString("pt-BR")}\n⏰ Horário: ${updatedBooking.startTime} - ${updatedBooking.endTime}\n👤 Nome: ${updatedBooking.clientName}\n📧 Email: ${updatedBooking.clientEmail}`,
          );
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setModificationField("");
          setIsLoading(false);
          return;
        } catch (error) {
          addBotMessage(
            `❌ Erro ao modificar: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
          );
          setModificationField("");
          setIsLoading(false);
          return;
        }
      }

      // Regular booking flow - send message to AI
      // Don't extract name if we're in room selection phase (to avoid capturing room names)
      const shouldExtractName = availableRooms.length === 0;
      const extractedData = extractDataFromText(userInput);

      // If we're selecting a room, don't override the name
      if (!shouldExtractName && extractedData.name) {
        extractedData.name = undefined;
      }

      // If we already have a startTime and a new time is extracted, use it as endTime
      if (formData.startTime && !formData.endTime && extractedData.startTime) {
        extractedData.endTime = extractedData.startTime;
        extractedData.startTime = undefined;
      }

      console.log("Extracted data:", extractedData);
      console.log("Current formData:", formData);

      // Validate email if provided
      if (extractedData.email && !validateEmail(extractedData.email)) {
        addBotMessage(
          `❌ E-mail inválido. Por favor, use seu e-mail institucional (.edu.br)`,
        );
        setIsLoading(false);
        return;
      }

      // Build updated form data FIRST
      const extractedDate = extractedData.date ? convertDateToISO(extractedData.date) : formData.date;

      // Validate date if provided
      if (extractedData.date && !validateDate(extractedDate)) {
        addBotMessage(
          "❌ A data deve ser hoje ou no futuro. Por favor, use o formato DD-MM-YYYY (ex: 25-12-2025).",
        );
        setIsLoading(false);
        return;
      }

      // Validate start time if provided
      if (extractedData.startTime && !validateTime(extractedData.startTime)) {
        addBotMessage(
          "❌ Horário de início inválido. Use o formato HH:mm (ex: 14:30).",
        );
        setIsLoading(false);
        return;
      }

      // Validate end time if provided
      if (extractedData.endTime && !validateTime(extractedData.endTime)) {
        addBotMessage(
          "❌ Horário de término inválido. Use o formato HH:mm (ex: 15:30).",
        );
        setIsLoading(false);
        return;
      }

      const updatedFormData = {
        ...formData,
        name: extractedData.name || formData.name,
        email: extractedData.email || formData.email,
        date: extractedDate,
        startTime: extractedData.startTime || formData.startTime,
        endTime: extractedData.endTime || formData.endTime,
      };

      console.log("Updated formData:", updatedFormData);

      // Update form data with extracted information
      if (
        extractedData.name ||
        extractedData.email ||
        extractedData.date ||
        extractedData.startTime ||
        extractedData.endTime
      ) {
        setFormData(updatedFormData);

        // Reset available rooms if date/time changed (so we re-check availability)
        if (extractedData.date || extractedData.startTime || extractedData.endTime) {
          setAvailableRooms([]);
        }
      }

      // FIRST: Check if user is trying to select a room (before checking availability)
      if (availableRooms.length > 0 && !updatedFormData.selectedRoomId) {
        // Check if user mentioned any room name
        const mentionedRoomName = userInput.toLowerCase();
        const roomSelection = availableRooms.find((r) =>
          mentionedRoomName.includes(r.name.toLowerCase()),
        );

        // If user tried to select a room but it's not in available rooms list, show error
        if (!roomSelection && mentionedRoomName.includes("sala")) {
          addBotMessage(
            `❌ A sala mencionada não está disponível para este horário. Por favor, escolha uma das salas listadas acima.`,
          );
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            {
              role: "assistant",
              content: `❌ A sala mencionada não está disponível para este horário. Por favor, escolha uma das salas listadas acima.`,
            },
          ]);
          setIsLoading(false);
          return;
        }

        if (roomSelection) {
          console.log("Room selected:", roomSelection.name);
          const updatedDataWithRoom = {
            ...updatedFormData,
            selectedRoomId: roomSelection.id,
          };

          setFormData(updatedDataWithRoom);

          const confirmMessage = `Você selecionou a sala "${roomSelection.name}".\n\n📋 Resumo:\n👤 ${updatedDataWithRoom.name}\n📧 ${updatedDataWithRoom.email}\n📅 ${formatDateForDisplay(updatedDataWithRoom.date)}\n⏰ ${updatedDataWithRoom.startTime} - ${updatedDataWithRoom.endTime}\n📍 ${roomSelection.name}\n\nDeseja confirmar este agendamento?`;
          addBotMessage(confirmMessage);
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            { role: "assistant", content: confirmMessage },
          ]);

          // Store the selected room ID and updated data for the next confirmation step
          sessionStorage.setItem(
            "pendingBooking",
            JSON.stringify(updatedDataWithRoom)
          );

          setIsLoading(false);
          return;
        }
      }

      // Check if we have all booking details to check availability
      const hasAllDetails =
        updatedFormData.name &&
        updatedFormData.email &&
        updatedFormData.date &&
        updatedFormData.startTime &&
        updatedFormData.endTime;

      console.log("Has all details:", {
        hasAllDetails,
        availableRoomsLength: availableRooms.length,
        name: updatedFormData.name,
        email: updatedFormData.email,
        date: updatedFormData.date,
        startTime: updatedFormData.startTime,
        endTime: updatedFormData.endTime,
      });

      if (hasAllDetails && !updatedFormData.selectedRoomId && availableRooms.length === 0) {
        // We have all details and haven't selected a room yet - check availability
        const date = updatedFormData.date!;
        const startTime = updatedFormData.startTime!;
        const endTime = updatedFormData.endTime!;

        console.log("✅ Checking availability for:", date, startTime, endTime);

        const endMinutes =
          parseInt(endTime.split(":")[0]) * 60 +
          parseInt(endTime.split(":")[1]);
        const startMinutes =
          parseInt(startTime.split(":")[0]) * 60 +
          parseInt(startTime.split(":")[1]);

        console.log("Time comparison:", {
          startMinutes,
          endMinutes,
          isValid: endMinutes > startMinutes,
        });

        if (endMinutes <= startMinutes) {
          console.log("Invalid time range: end time must be after start time");
          addBotMessage(
            "❌ A hora final deve ser depois da hora inicial. Por favor, verifique os horários.",
          );
          setIsLoading(false);
          return;
        }

        try {
          console.log("Calling checkAvailability API...");
          const rooms = await checkAvailability(date, startTime, endTime);
          console.log("Available rooms:", rooms);
          setAvailableRooms(rooms);

          if (rooms.length > 0) {
            const roomsList = rooms.map((r) => `- ${r.name}`).join("\n");
            const roomsMessage = `✅ Salas disponíveis para ${date} de ${startTime} a ${endTime}:\n\n${roomsList}\n\nQual sala você prefere?`;
            addBotMessage(roomsMessage);
            setConversationHistory((prev) => [
              ...prev,
              { role: "user" as const, content: userInput },
              { role: "assistant", content: roomsMessage },
            ]);
            setIsLoading(false);
            return;
          } else {
            addBotMessage(
              "❌ Desculpe, nenhuma sala está disponível para este horário. Tente outro horário ou data.",
            );
            setConversationHistory((prev) => [
              ...prev,
              { role: "user" as const, content: userInput },
              {
                role: "assistant",
                content:
                  "❌ Desculpe, nenhuma sala está disponível para este horário. Tente outro horário ou data.",
              },
            ]);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error checking availability:", error);
          addBotMessage(
            "❌ Erro ao verificar disponibilidade. Tente novamente.",
          );
          setIsLoading(false);
          return;
        }
      }


      // Handle confirmation
      if (
        (userInput.toLowerCase().includes("sim") ||
          userInput.toLowerCase().includes("yes")) &&
        updatedFormData.selectedRoomId
      ) {
        if (
          updatedFormData.name &&
          updatedFormData.email &&
          updatedFormData.date &&
          updatedFormData.startTime &&
          updatedFormData.endTime
        ) {
          // Use the stored pending booking data to ensure all fields are set
          const pendingBooking = sessionStorage.getItem("pendingBooking");
          if (pendingBooking) {
            const bookingData = JSON.parse(pendingBooking);
            setFormData(bookingData);

            // Create booking with the confirmed data
            try {
              setIsLoading(true);

              const response = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  roomId: bookingData.selectedRoomId,
                  clientName: bookingData.name,
                  clientEmail: bookingData.email,
                  date: bookingData.date,
                  startTime: bookingData.startTime,
                  endTime: bookingData.endTime,
                }),
              });

              if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to create booking");
              }

              const data = await response.json();
              setBooking(data.booking);
              sessionStorage.removeItem("pendingBooking");

              // Format date without timezone issues
              const [year, month, day] = bookingData.date.split("-");
              const formattedDate = `${day}/${month}/${year}`;
              const successMessage = `✅ Perfeito! Sua defesa foi agendada com sucesso!\n\n📌 **ID da Reserva: #${data.booking.id}**\n\nDetalhes da Reserva:\n📍 Sala: ${data.booking.roomName}\n📅 Data: ${formattedDate}\n⏰ Horário: ${bookingData.startTime} - ${bookingData.endTime}\n📧 Confirmação enviada para: ${bookingData.email}\n\nGuarde este ID para futuras modificações ou cancelamentos!\n\nObrigado por usar nosso assistente!`;

              addBotMessage(successMessage);
              toast.success("Agendamento confirmado!");

              // Reset form data for next booking
              setFormData({
                name: "",
                email: "",
                date: "",
                startTime: "",
                endTime: "",
                duration: "",
                equipment: "",
                selectedRoomId: "",
              });
              setAvailableRooms([]);
              setCurrentFlow("booking");
            } catch (error) {
              console.error("Error creating booking:", error);
              toast.error(
                error instanceof Error ? error.message : "Erro ao confirmar reserva",
              );
            } finally {
              setIsLoading(false);
            }
          }
          return;
        }
      }

      // Send message to AI for general conversation
      const newConversationHistory = [
        ...conversationHistory,
        { role: "user" as const, content: userInput },
      ];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newConversationHistory,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        const errorMsg = errorData.error || "Failed to get AI response";
        console.error("Chat API error:", errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const aiMessage = data.message;

      if (!aiMessage) {
        throw new Error("Empty response from AI");
      }

      addBotMessage(aiMessage);
      setConversationHistory([
        ...newConversationHistory,
        { role: "assistant", content: aiMessage },
      ]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao processar mensagem";
      addBotMessage(`❌ Erro: ${errorMessage}. Por favor, tente novamente.`);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-primary/10 p-3 rounded-lg">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Assistente de Agendamento
          </h1>
          <p className="text-sm text-muted-foreground">
            Reserve sua sala de defesa de tese
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-card border border-border">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-card to-card/50">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Iniciando conversa...
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 animate-in fade-in duration-300",
                  msg.type === "user" ? "justify-end" : "justify-start",
                )}
              >
                {msg.type === "bot" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-xs lg:max-w-md px-4 py-3 rounded-lg whitespace-pre-wrap text-sm",
                    msg.type === "bot"
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground rounded-br-none",
                  )}
                >
                  {msg.type === "bot"
                    ? parseMessageContent(msg.content)
                    : msg.content}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-3 justify-start animate-in fade-in duration-300">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader className="h-4 w-4 text-primary animate-spin" />
              </div>
              <div className="bg-muted text-muted-foreground px-4 py-3 rounded-lg">
                Processando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-card">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <Input
              type="text"
              placeholder="Digite sua resposta..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-full border-border focus:border-primary focus:ring-primary"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">Enviar</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
