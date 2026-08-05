import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MessageCircle, Loader } from "lucide-react";
import { Room, Booking } from "@shared/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DEFAULT_ALLOWED_EMAIL_DOMAINS,
  getAppConfig,
  isEmailDomainAllowed,
} from "@/lib/config";

// Analisa formatação inline (**negrito** e *itálico*) de um trecho sem quebras de linha
function parseInlineContent(text: string, keyPrefix: string) {
  const parts: (string | JSX.Element)[] = [];
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Padrão **negrito**
      parts.push(
        <strong key={`${keyPrefix}-bold-${match.index}`} className="font-bold">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      // Padrão *itálico*
      parts.push(
        <em key={`${keyPrefix}-italic-${match.index}`} className="italic">
          {match[2]}
        </em>,
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts;
}

// Analisa formatação do tipo markdown para mensagens do bot.
// Divide por quebras de linha primeiro (sem lookbehind, compatível com Safari)
// e aplica a formatação inline em cada linha.
function parseMessageContent(content: string) {
  const lines = content.split(/\\n|\n/);
  const parts: (string | JSX.Element)[] = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      parts.push(<br key={`br-${index}`} />);
    }
    parts.push(...parseInlineContent(line, `line-${index}`));
  });

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

// Remove acentos e converte para minúsculas, para comparações robustas
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Verifica se uma palavra inteira aparece no texto (já normalizado),
// delimitada por início/fim, espaços ou pontuação
const matchesWord = (normalizedText: string, word: string): boolean =>
  new RegExp(`(^|[\\s!.,;:?()"'])${word}($|[\\s!.,;:?()"'])`).test(
    normalizedText,
  );

interface RoomMatchResult {
  room: Room | null;
  ambiguous: Room[];
}

// Encontra a sala mencionada na mensagem:
// 1) nome exato (sem diferenciar caixa/acentos);
// 2) número inteiro citado na mensagem contra os números dos nomes das salas;
// 3) substring única. Se ambíguo, retorna a lista de candidatas.
const findRoomMatch = (input: string, rooms: Room[]): RoomMatchResult => {
  const normInput = normalizeText(input).trim();

  const exact = rooms.filter(
    (r) => normalizeText(r.name).trim() === normInput,
  );
  if (exact.length === 1) return { room: exact[0], ambiguous: [] };
  if (exact.length > 1) return { room: null, ambiguous: exact };

  const inputNumbers = normInput.match(/\d+/g) || [];
  if (inputNumbers.length > 0) {
    const byNumber = rooms.filter((r) => {
      const roomNumbers = r.name.match(/\d+/g) || [];
      return inputNumbers.some((n) =>
        roomNumbers.some((rn) => parseInt(rn, 10) === parseInt(n, 10)),
      );
    });
    if (byNumber.length === 1) return { room: byNumber[0], ambiguous: [] };
    if (byNumber.length > 1) return { room: null, ambiguous: byNumber };
    // A mensagem cita um número que não corresponde a nenhuma sala
    return { room: null, ambiguous: [] };
  }

  const bySubstring = rooms.filter((r) => {
    const roomName = normalizeText(r.name).trim();
    return (
      normInput.includes(roomName) ||
      (normInput.length >= 3 && roomName.includes(normInput))
    );
  });
  if (bySubstring.length === 1) return { room: bySubstring[0], ambiguous: [] };
  if (bySubstring.length > 1) return { room: null, ambiguous: bySubstring };

  return { room: null, ambiguous: [] };
};

// Erro de API com status HTTP, para distinguir 403 (email de verificação
// incorreto) de outros erros
class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Frases de cortesia que não devem ser interpretadas como nome
// (comparadas já normalizadas: minúsculas e sem acentos)
const NAME_STOPLIST = new Set([
  "obrigado",
  "obrigada",
  "valeu",
  "ok",
  "blz",
  "beleza",
  "perfeito",
  "otimo",
  "bom dia",
  "boa tarde",
  "boa noite",
  "tchau",
  "ate mais",
  "legal",
  "show",
]);

// Formato básico de email (a verificação de domínio fica em validateEmail)
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM_DATA = {
  name: "",
  email: "",
  date: "",
  startTime: "",
  endTime: "",
  duration: "",
  equipment: "",
  selectedRoomId: "",
};

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messageCounterRef = useRef(0);
  const initializedRef = useRef(false);

  // Dados do formulário extraídos da conversa
  const [formData, setFormData] = useState({ ...EMPTY_FORM_DATA });

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [currentFlow, setCurrentFlow] = useState<ConversationFlow>("booking");
  const [currentBookingId, setCurrentBookingId] = useState<string>("");
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [modificationField, setModificationField] = useState<string>("");
  // Email informado pelo usuário para verificar a titularidade da reserva
  // nos fluxos de modificação/cancelamento (exigido pelo servidor)
  const [verificationEmail, setVerificationEmail] = useState<string>("");
  const [allowedEmailDomains, setAllowedEmailDomains] = useState<string[]>(
    DEFAULT_ALLOWED_EMAIL_DOMAINS,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para o final
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Carrega os domínios de e-mail permitidos (com cache e fallback)
  useEffect(() => {
    let active = true;
    getAppConfig().then((config) => {
      if (active) {
        setAllowedEmailDomains(config.allowedEmailDomains);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Inicializa com saudação
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialMessage: Message = {
      id: `msg-${messageCounterRef.current}`,
      type: "bot",
      content:
        "Olá! 👋 Bem-vindo ao assistente de agendamento de salas. Estou aqui para ajudá-lo a reservar uma sala. Por favor, comece nos informando seu nome completo.",
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
    // Se já está no formato ISO (YYYY-MM-DD), retorna como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Converte D/M/AAAA, DD-MM-AAAA, D/M/AA etc. para YYYY-MM-DD
    // (dia e mês com 1 ou 2 dígitos; ano com 2 ou 4 dígitos)
    const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2}|\d{4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, "0");
      const month = dmy[2].padStart(2, "0");
      const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      return `${year}-${month}-${day}`;
    }

    return dateStr;
  };

  const formatDateForDisplay = (dateStr: string): string => {
    // Converter YYYY-MM-DD para DD/MM/YYYY para exibição
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split("-");
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  const extractDataFromText = (text: string): ExtractedData => {
    const data: ExtractedData = {};

    // Padrão de email
    const emailMatch = text.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    if (emailMatch) {
      data.email = emailMatch[0];
    }

    // Padrão de nome - se começar com letra maiúscula e tiver 2+ palavras
    const nameMatch = text.match(
      /(?:meu nome é|me chamo|sou) ([A-Za-záàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ\s]+)/i,
    );
    if (nameMatch) {
      data.name = nameMatch[1].trim();
    } else if (!emailMatch) {
      // Tenta extrair as primeiras 2-3 palavras se parecerem um nome
      const nameWords = text.match(
        /^([A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ][a-záàâãäéèêëíìîïóòôõöúùûüçñ]+(?:\s+[A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ][a-záàâãäéèêëíìîïóòôõöúùûüçñ]+)?)/,
      );
      // Mensagens de cortesia ("Obrigado", "Bom dia" etc.) não são nomes
      const normalizedWhole = normalizeText(text.trim())
        .replace(/[!.,;:?]+$/, "")
        .trim();
      if (
        nameWords &&
        !text.toLowerCase().includes("agendar") &&
        !NAME_STOPLIST.has(normalizedWhole)
      ) {
        data.name = nameWords[1];
      }
    }

    // Padrão de data (YYYY-MM-DD, D/M/AAAA, DD-MM-AA, ou formato português como "15 de fevereiro")
    const isoDateMatch = text.match(/(\d{4}-\d{2}-\d{2})/);
    const dmyDateMatch = text.match(
      /(?:^|[^\d\/\-])(\d{1,2}[\/\-]\d{1,2}[\/\-](?:\d{4}|\d{2}))(?![\d\/\-])/,
    );
    if (isoDateMatch) {
      data.date = isoDateMatch[1];
    } else if (dmyDateMatch) {
      data.date = convertDateToISO(dmyDateMatch[1]);
    } else {
      // Tentar formato de data em português
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
          // Sem ano informado: usa o ano atual, ou o próximo se a data já passou
          const now = new Date();
          let year = now.getFullYear();
          const candidate = new Date(year, parseInt(month) - 1, parseInt(day));
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (candidate < today) {
            year += 1;
          }
          data.date = `${year}-${month}-${day}`;
        }
      }

      if (!data.date) {
        // Formato curto dia/mês sem ano ("15/08"). Delimitado para não
        // capturar horários ("10:30", "9:30-10:30") nem trechos de datas
        // completas (que já teriam casado acima) ou números soltos.
        const dmShortMatch = text.match(
          /(?:^|[^\d\/\-:])(\d{1,2})[\/\-](\d{1,2})(?![\d\/\-:])/,
        );
        if (dmShortMatch) {
          const day = parseInt(dmShortMatch[1], 10);
          const month = parseInt(dmShortMatch[2], 10);
          if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
            // Sem ano informado: usa o ano atual, ou o próximo se a data já passou
            const now = new Date();
            let year = now.getFullYear();
            const candidate = new Date(year, month - 1, day);
            const today = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            if (candidate < today) {
              year += 1;
            }
            data.date = `${year}-${String(month).padStart(2, "0")}-${String(
              day,
            ).padStart(2, "0")}`;
          }
        }
      }
    }

    // Padrão de hora (HH:mm ou apenas HH com h/horas)
    const validTimes = [];

    // Primeiro tenta corresponder formatos de hora explícitos (HH:mm ou HH h/horas)
    const explicitTimeMatches = text.match(/(\d{1,2}):(\d{2})\s*(?:h|horas)?|(\d{1,2})\s*(?:h|horas)/g);
    if (explicitTimeMatches) {
      for (const timeStr of explicitTimeMatches) {
        // Analisar formato HH:mm
        const colonMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (colonMatch) {
          const hour = parseInt(colonMatch[1]);
          if (hour >= 0 && hour <= 23) {
            validTimes.push(`${colonMatch[1].padStart(2, "0")}:${colonMatch[2]}`);
          }
          continue;
        }

        // Analisar formato HH (com h ou horas)
        const hMatch = timeStr.match(/(\d{1,2})\s*(?:h|horas)/);
        if (hMatch) {
          const hour = parseInt(hMatch[1]);
          if (hour >= 0 && hour <= 23) {
            validTimes.push(`${hMatch[1].padStart(2, "0")}:00`);
          }
        }
      }
    }

    // Se nenhuma hora explícita for encontrada, tentar corresponder números simples (0-23) apenas se o texto for muito curto
    // Isso ajuda a capturar "15" ou "16" como horas, mas não corresponde números de data em strings mais longas
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

    // Padrão de duração (números seguidos por minuto/min/h/hora)
    const durationMatch = text.match(/(\d+)\s*(minuto|min|h|hora|horas)/i);
    if (durationMatch) {
      data.duration = durationMatch[0];
    }

    return data;
  };

  const formatAllowedDomains = (): string =>
    allowedEmailDomains.map((domain) => `@${domain}`).join(", ");

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    // Aceitar apenas e-mails dos domínios institucionais permitidos
    return isEmailDomainAllowed(email, allowedEmailDomains);
  };

  const validateDate = (dateStr: string): boolean => {
    // Validar formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return false;
    }

    const [year, month, day] = dateStr.split("-").map(Number);

    // Verificar se é uma data de calendário válida
    const selectedDate = new Date(year, month - 1, day);
    if (
      selectedDate.getFullYear() !== year ||
      selectedDate.getMonth() !== month - 1 ||
      selectedDate.getDate() !== day
    ) {
      return false;
    }

    // Data deve ser hoje ou no futuro (sem datas passadas)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today;
  };

  const validateTime = (timeStr: string): boolean => {
    // Validar formato HH:mm (00:00 a 23:59)
    if (!/^\d{2}:\d{2}$/.test(timeStr)) {
      return false;
    }

    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  };

  const validateTimeRange = (startTime: string, endTime: string): boolean => {
    // Ambas as horas devem estar em formato válido
    if (!validateTime(startTime) || !validateTime(endTime)) {
      return false;
    }

    // Hora final deve ser depois da hora inicial
    const [startHours, startMinutes] = startTime.split(":").map(Number);
    const [endHours, endMinutes] = endTime.split(":").map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    return endTotalMinutes > startTotalMinutes;
  };

  // Retorna a lista de salas disponíveis, ou null se a verificação falhou
  // (erro de rede/servidor) — null NÃO significa "nenhuma sala disponível"
  const checkAvailability = async (
    date: string,
    startTime: string,
    endTime: string,
  ): Promise<Room[] | null> => {
    try {
      const response = await fetch("/api/bookings/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, startTime, endTime }),
      });

      if (!response.ok) {
        throw new Error("Erro ao verificar disponibilidade");
      }
      const data = await response.json();
      return data.availableRooms as Room[];
    } catch (error) {
      return null;
    }
  };


  const fetchBookingDetails = async (bookingId: string) => {
    const response = await fetch(`/api/ai/bookings/${bookingId}`);
    if (!response.ok) {
      throw new Error("Agendamento não encontrado");
    }
    const data = await response.json();
    return data.booking as Booking;
  };

  // O servidor exige clientEmail no corpo como fator de verificação
  // (deve corresponder ao email armazenado na reserva; 403 se divergir).
  // O email da reserva NÃO é mais um campo editável pelo chat.
  const modifyBooking = async (
    bookingId: string,
    updates: {
      clientName?: string;
      date?: string;
      startTime?: string;
      endTime?: string;
      roomId?: string;
    },
    emailForVerification: string,
  ) => {
    const response = await fetch(`/api/ai/bookings/${bookingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, clientEmail: emailForVerification }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        error?.error || "Erro ao modificar o agendamento",
        response.status,
      );
    }

    const data = await response.json();
    return data.booking as Booking;
  };

  // O servidor exige ?email= como fator de verificação (403 se divergir)
  const cancelBooking = async (bookingId: string, emailForVerification: string) => {
    const response = await fetch(
      `/api/ai/bookings/${bookingId}?email=${encodeURIComponent(emailForVerification)}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(
        error?.error || "Erro ao cancelar o agendamento",
        response.status,
      );
    }

    return true;
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
      // Verificar se o usuário quer modificar ou cancelar o agendamento
      // (correspondência por palavra inteira para evitar falsos positivos)
      const normalizedInput = normalizeText(userInput);
      const wantsModify =
        matchesWord(normalizedInput, "modificar") ||
        matchesWord(normalizedInput, "editar") ||
        matchesWord(normalizedInput, "alterar");
      const wantsCancel =
        matchesWord(normalizedInput, "cancelar") ||
        matchesWord(normalizedInput, "remover");

      if (wantsModify && currentFlow === "booking") {
        // Abandona uma confirmação pendente ao trocar de fluxo
        sessionStorage.removeItem("pendingBooking");
        setFormData((prev) => ({ ...prev, selectedRoomId: "" }));
        // Limpa a lista de salas do fluxo de agendamento para não interferir
        // na extração de dados quando o usuário voltar a agendar
        setAvailableRooms([]);
        setVerificationEmail("");
        setCurrentFlow("modify");
        addBotMessage(
          "Para modificar um agendamento, preciso do ID da reserva. Qual é o ID? (Exemplo: #12345 ou 12345)",
        );
        setIsLoading(false);
        return;
      }

      if (wantsCancel && currentFlow === "booking") {
        // Abandona uma confirmação pendente ao trocar de fluxo
        sessionStorage.removeItem("pendingBooking");
        setFormData((prev) => ({ ...prev, selectedRoomId: "" }));
        // Limpa a lista de salas do fluxo de agendamento para não interferir
        // na extração de dados quando o usuário voltar a agendar
        setAvailableRooms([]);
        setVerificationEmail("");
        setCurrentFlow("cancel");
        addBotMessage(
          "Para cancelar um agendamento, preciso do ID da reserva. Qual é o ID? (Exemplo: #12345 ou 12345)",
        );
        setIsLoading(false);
        return;
      }

      // Extrair ID do agendamento se estiver no fluxo de modificação/cancelamento
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

            // O email retornado pelo servidor vem mascarado (ex.: th***@dominio)
            const bookingInfo = `📋 Dados do Agendamento #${fetchedBooking.id}:\n📍 Sala: ${fetchedBooking.roomName}\n📅 Data: ${formatDateForDisplay(fetchedBooking.date)}\n⏰ Horário: ${fetchedBooking.startTime} - ${fetchedBooking.endTime}\n👤 Nome: ${fetchedBooking.clientName}\n📧 Email: ${fetchedBooking.clientEmail}`;

            addBotMessage(
              `${bookingInfo}\n\n🔒 Por segurança, informe o email usado na reserva:`,
            );
            setVerificationEmail("");
            if (currentFlow === "modify") {
              setModificationField("");
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
            setVerificationEmail("");
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

      // Coletar o email de verificação exigido pelo servidor antes de
      // permitir modificação/cancelamento
      if (
        (currentFlow === "modify" || currentFlow === "cancel") &&
        currentBookingId &&
        currentBooking &&
        !verificationEmail
      ) {
        // Rota de saída do fluxo (em "cancelar" no fluxo de cancelamento a
        // palavra é ambígua, então lá apenas voltar/sair encerram)
        const wantsExit =
          matchesWord(normalizedInput, "voltar") ||
          matchesWord(normalizedInput, "sair") ||
          (currentFlow === "modify" && matchesWord(normalizedInput, "cancelar"));
        if (wantsExit) {
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setModificationField("");
          setVerificationEmail("");
          addBotMessage(
            "Operação encerrada. Como posso ajudá-lo? (novo agendamento, modificar ou cancelar)",
          );
          setIsLoading(false);
          return;
        }

        const emailMatch = userInput.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        const emailCandidate = emailMatch ? emailMatch[0] : userInput.trim();
        if (!EMAIL_FORMAT_REGEX.test(emailCandidate)) {
          addBotMessage(
            "❌ Email em formato inválido. Por segurança, informe o email usado na reserva:",
          );
          setIsLoading(false);
          return;
        }

        setVerificationEmail(emailCandidate);
        if (currentFlow === "modify") {
          addBotMessage(
            "Quais dados deseja modificar?\n- Nome\n- Data\n- Hora inicial\n- Hora final\n- Sala\n\n(O email da reserva não pode ser alterado pelo chat.)",
          );
          setModificationField("");
        } else {
          addBotMessage(
            "⚠️ Tem certeza que deseja CANCELAR este agendamento? (Sim/Não)",
          );
        }
        setIsLoading(false);
        return;
      }

      // Lidar com confirmação de cancelamento (palavra inteira)
      if (
        currentFlow === "cancel" &&
        currentBookingId &&
        currentBooking &&
        verificationEmail
      ) {
        if (
          matchesWord(normalizedInput, "sim") ||
          matchesWord(normalizedInput, "yes") ||
          matchesWord(normalizedInput, "confirmar")
        ) {
          try {
            await cancelBooking(currentBookingId, verificationEmail);
          } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
              // Email não confere com o da reserva: pedir novamente
              setVerificationEmail("");
              addBotMessage(
                `❌ ${error.message}\n\n🔒 Por segurança, informe o email usado na reserva:`,
              );
            } else {
              addBotMessage(
                `❌ Erro ao cancelar: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
              );
            }
            setIsLoading(false);
            return;
          }
          addBotMessage(
            `✅ Agendamento #${currentBookingId} foi cancelado com sucesso!`,
          );
          // Mantém o histórico da IA em sincronia com o que aconteceu
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            {
              role: "assistant" as const,
              content: `Agendamento #${currentBookingId} cancelado com sucesso.`,
            },
          ]);
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setVerificationEmail("");
          setIsLoading(false);
          return;
        } else if (
          matchesWord(normalizedInput, "nao") ||
          matchesWord(normalizedInput, "no")
        ) {
          addBotMessage(
            "Cancelamento abortado. Como posso ajudá-lo? (novo agendamento, modificar ou cancelar)",
          );
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            {
              role: "assistant" as const,
              content: `Cancelamento do agendamento #${currentBookingId} abortado pelo usuário.`,
            },
          ]);
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setVerificationEmail("");
          setIsLoading(false);
          return;
        } else {
          // Não repassar ao LLM com um cancelamento pendente: reperguntar
          addBotMessage(
            "Deseja realmente cancelar este agendamento? Responda sim ou não.",
          );
          setIsLoading(false);
          return;
        }
      }

      // Lidar com seleção de campo de modificação
      if (
        currentFlow === "modify" &&
        currentBookingId &&
        currentBooking &&
        !modificationField
      ) {
        if (
          matchesWord(normalizedInput, "cancelar") ||
          matchesWord(normalizedInput, "voltar") ||
          matchesWord(normalizedInput, "sair")
        ) {
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setModificationField("");
          setVerificationEmail("");
          addBotMessage(
            "Modificação encerrada. Como posso ajudá-lo? (novo agendamento, modificar ou cancelar)",
          );
          setIsLoading(false);
          return;
        }
        if (matchesWord(normalizedInput, "nome")) {
          setModificationField("clientName");
          addBotMessage("Qual é o novo nome?");
          setIsLoading(false);
          return;
        } else if (matchesWord(normalizedInput, "email")) {
          // Alterar o email da reserva agora é uma operação administrativa
          addBotMessage(
            "❌ O email da reserva não pode ser alterado pelo chat. Entre em contato com a administração para isso.\n\nQuais outros dados deseja modificar?\n- Nome\n- Data\n- Hora inicial\n- Hora final\n- Sala",
          );
          setIsLoading(false);
          return;
        } else if (matchesWord(normalizedInput, "data")) {
          setModificationField("date");
          addBotMessage("Qual é a nova data? (YYYY-MM-DD ou DD/MM/YYYY)");
          setIsLoading(false);
          return;
        } else if (
          normalizedInput.includes("hora inicial") ||
          matchesWord(normalizedInput, "inicio")
        ) {
          setModificationField("startTime");
          addBotMessage("Qual é a nova hora inicial? (HH:mm)");
          setIsLoading(false);
          return;
        } else if (
          normalizedInput.includes("hora final") ||
          matchesWord(normalizedInput, "fim")
        ) {
          setModificationField("endTime");
          addBotMessage("Qual é a nova hora final? (HH:mm)");
          setIsLoading(false);
          return;
        } else if (matchesWord(normalizedInput, "sala")) {
          setModificationField("roomId");
          const rooms = await checkAvailability(
            currentBooking.date,
            currentBooking.startTime,
            currentBooking.endTime,
          );
          if (rooms === null) {
            // Falha na verificação — não é o mesmo que "nenhuma sala"
            addBotMessage(
              "❌ Erro ao verificar disponibilidade. Tente novamente.",
            );
            setModificationField("");
          } else if (rooms.length > 0) {
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

      // Lidar com entrada de valor de modificação
      if (
        currentFlow === "modify" &&
        currentBookingId &&
        currentBooking &&
        modificationField
      ) {
        // Rota de saída: sem isso, qualquer texto (inclusive "cancelar")
        // seria consumido como o novo valor do campo
        if (
          matchesWord(normalizedInput, "cancelar") ||
          matchesWord(normalizedInput, "voltar") ||
          matchesWord(normalizedInput, "sair")
        ) {
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setModificationField("");
          setVerificationEmail("");
          setAvailableRooms([]);
          addBotMessage(
            "Modificação encerrada sem alterações. Como posso ajudá-lo? (novo agendamento, modificar ou cancelar)",
          );
          setIsLoading(false);
          return;
        }

        try {
          let newValue = userInput;
          let fieldToUpdate: any = {};

          if (modificationField === "clientName") {
            const trimmedName = newValue.trim();
            if (!trimmedName) {
              addBotMessage(
                "❌ Nome inválido. Por favor, informe o novo nome completo.",
              );
              setIsLoading(false);
              return;
            }
            fieldToUpdate.clientName = trimmedName;
          } else if (modificationField === "date") {
            const convertedDate = convertDateToISO(newValue);
            if (!validateDate(convertedDate)) {
              addBotMessage(
                "❌ Data inválida. A data deve ser hoje ou no futuro (formato: DD/MM/YYYY ou YYYY-MM-DD)",
              );
              setIsLoading(false);
              return;
            }
            fieldToUpdate.date = convertedDate;
          } else if (modificationField === "startTime") {
            if (!validateTime(newValue)) {
              addBotMessage(
                "❌ Hora inválida. Use o formato HH:mm (exemplo: 14:30)",
              );
              setIsLoading(false);
              return;
            }
            fieldToUpdate.startTime = newValue;
          } else if (modificationField === "endTime") {
            if (!validateTime(newValue)) {
              addBotMessage(
                "❌ Hora inválida. Use o formato HH:mm (exemplo: 15:30)",
              );
              setIsLoading(false);
              return;
            }
            // Validar intervalo de hora com a hora inicial atual
            const startTimeToUse = fieldToUpdate.startTime || currentBooking.startTime;
            if (!validateTimeRange(startTimeToUse, newValue)) {
              addBotMessage(
                "❌ Hora final inválida. A hora final deve ser depois da hora inicial",
              );
              setIsLoading(false);
              return;
            }
            fieldToUpdate.endTime = newValue;
          } else if (modificationField === "roomId") {
            const { room: selectedRoom, ambiguous } = findRoomMatch(
              userInput,
              availableRooms,
            );
            if (selectedRoom) {
              fieldToUpdate.roomId = selectedRoom.id;
            } else if (ambiguous.length > 1) {
              const options = ambiguous.map((r) => `- ${r.name}`).join("\n");
              addBotMessage(
                `Encontrei mais de uma sala parecida com a sua resposta. Qual delas você prefere?\n${options}`,
              );
              setIsLoading(false);
              return;
            } else {
              addBotMessage(
                "Sala não encontrada. Por favor, escolha uma das salas listadas acima.",
              );
              setIsLoading(false);
              return;
            }
          }

          const updatedBooking = await modifyBooking(
            currentBookingId,
            fieldToUpdate,
            verificationEmail,
          );
          addBotMessage(
            `✅ Agendamento #${currentBookingId} modificado com sucesso!\n\n📋 Dados atualizados:\n📍 Sala: ${updatedBooking.roomName}\n📅 Data: ${formatDateForDisplay(updatedBooking.date)}\n⏰ Horário: ${updatedBooking.startTime} - ${updatedBooking.endTime}\n👤 Nome: ${updatedBooking.clientName}\n📧 Email: ${updatedBooking.clientEmail}`,
          );
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            {
              role: "assistant" as const,
              content: `Agendamento #${currentBookingId} modificado com sucesso.`,
            },
          ]);
          setCurrentFlow("booking");
          setCurrentBookingId("");
          setCurrentBooking(null);
          setModificationField("");
          setVerificationEmail("");
          // Limpa a lista usada na troca de sala para não travar a extração
          // de dados do próximo agendamento
          setAvailableRooms([]);
          setIsLoading(false);
          return;
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) {
            // Email não confere com o da reserva: pedir novamente
            setVerificationEmail("");
            setModificationField("");
            setAvailableRooms([]);
            addBotMessage(
              `❌ ${error.message}\n\n🔒 Por segurança, informe o email usado na reserva:`,
            );
            setIsLoading(false);
            return;
          }
          addBotMessage(
            `❌ Erro ao modificar: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
          );
          setModificationField("");
          setAvailableRooms([]);
          setIsLoading(false);
          return;
        }
      }

      // Fluxo de agendamento regular - enviar mensagem para IA
      // Não extrair nome se estivermos na fase de seleção de sala (para evitar capturar nomes de salas)
      const shouldExtractName = availableRooms.length === 0;
      const extractedData = extractDataFromText(userInput);

      // Se estivermos selecionando uma sala, não sobrescrever o nome
      if (!shouldExtractName && extractedData.name) {
        extractedData.name = undefined;
      }

      // Durante a seleção de sala, um número solto ("1", "101") é escolha de
      // sala, não horário — só horários explícitos ("14:30", "10h") contam
      if (availableRooms.length > 0 && /^\d{1,3}$/.test(userInput.trim())) {
        extractedData.startTime = undefined;
        extractedData.endTime = undefined;
      }

      // Se já temos uma hora inicial e apenas UMA nova hora é extraída, usar
      // como hora final. Se a mensagem trouxe início E fim ("das 14h às 16h"),
      // substituir ambos em vez de descartar o segundo horário.
      if (
        formData.startTime &&
        !formData.endTime &&
        extractedData.startTime &&
        !extractedData.endTime
      ) {
        extractedData.endTime = extractedData.startTime;
        extractedData.startTime = undefined;
      }

      // Validar email se fornecido
      if (extractedData.email && !validateEmail(extractedData.email)) {
        addBotMessage(
          `❌ E-mail inválido. Por favor, use seu e-mail institucional (domínios aceitos: ${formatAllowedDomains()})`,
        );
        setIsLoading(false);
        return;
      }

      // Construir dados de formulário atualizados PRIMEIRO
      const extractedDate = extractedData.date ? convertDateToISO(extractedData.date) : formData.date;

      // Validar data se fornecida
      if (extractedData.date && !validateDate(extractedDate)) {
        addBotMessage(
          "❌ A data deve ser válida e não pode estar no passado. Use o formato DD/MM/AAAA (ex: 25/12/2026).",
        );
        setIsLoading(false);
        return;
      }

      // Validar hora inicial se fornecida
      if (extractedData.startTime && !validateTime(extractedData.startTime)) {
        addBotMessage(
          "❌ Horário de início inválido. Use o formato HH:mm (ex: 14:30).",
        );
        setIsLoading(false);
        return;
      }

      // Validar hora final se fornecida
      if (extractedData.endTime && !validateTime(extractedData.endTime)) {
        addBotMessage(
          "❌ Horário de término inválido. Use o formato HH:mm (ex: 15:30).",
        );
        setIsLoading(false);
        return;
      }

      // A lista de salas exibida deixa de valer se a data/horário mudou
      const roomListStale = !!(
        extractedData.date ||
        extractedData.startTime ||
        extractedData.endTime
      );

      const updatedFormData = {
        ...formData,
        name: extractedData.name || formData.name,
        email: extractedData.email || formData.email,
        date: extractedDate,
        startTime: extractedData.startTime || formData.startTime,
        endTime: extractedData.endTime || formData.endTime,
        // Sala escolhida para a data/horário antigos não vale mais; limpar
        // aqui garante que a disponibilidade seja verificada de novo
        selectedRoomId: roomListStale ? "" : formData.selectedRoomId,
      };

      // Atualizar dados do formulário com informações extraídas
      if (
        extractedData.name ||
        extractedData.email ||
        extractedData.date ||
        extractedData.startTime ||
        extractedData.endTime
      ) {
        setFormData(updatedFormData);

        // Redefinir salas disponíveis se data/hora mudou (para re-verificar disponibilidade)
        if (roomListStale) {
          setAvailableRooms([]);
          sessionStorage.removeItem("pendingBooking");
        }
      }

      // PRIMEIRO: Verificar se o usuário está tentando selecionar uma sala (antes de verificar disponibilidade)
      if (
        availableRooms.length > 0 &&
        !updatedFormData.selectedRoomId &&
        !roomListStale
      ) {
        const { room: roomSelection, ambiguous } = findRoomMatch(
          userInput,
          availableRooms,
        );

        // Se houver mais de uma sala compatível, pedir para o usuário especificar
        if (!roomSelection && ambiguous.length > 1) {
          const options = ambiguous.map((r) => `- ${r.name}`).join("\n");
          const ambiguousMessage = `Encontrei mais de uma sala parecida com a sua resposta. Qual delas você prefere?\n${options}`;
          addBotMessage(ambiguousMessage);
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            { role: "assistant", content: ambiguousMessage },
          ]);
          setIsLoading(false);
          return;
        }

        // Se o usuário tentou selecionar uma sala mas não está na lista de salas disponíveis, mostrar erro
        if (
          !roomSelection &&
          (matchesWord(normalizedInput, "sala") || /\d/.test(normalizedInput))
        ) {
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

          // Armazenar ID da sala selecionada e dados atualizados para a próxima etapa de confirmação
          sessionStorage.setItem(
            "pendingBooking",
            JSON.stringify(updatedDataWithRoom)
          );

          setIsLoading(false);
          return;
        }
      }

      // Verificar se temos todos os detalhes de agendamento para verificar disponibilidade
      const hasAllDetails =
        updatedFormData.name &&
        updatedFormData.email &&
        updatedFormData.date &&
        updatedFormData.startTime &&
        updatedFormData.endTime;

      if (hasAllDetails && !updatedFormData.selectedRoomId && (availableRooms.length === 0 || roomListStale)) {
        // Temos todos os detalhes e ainda não selecionamos uma sala - verificar disponibilidade
        const date = updatedFormData.date!;
        const startTime = updatedFormData.startTime!;
        const endTime = updatedFormData.endTime!;

        const endMinutes =
          parseInt(endTime.split(":")[0]) * 60 +
          parseInt(endTime.split(":")[1]);
        const startMinutes =
          parseInt(startTime.split(":")[0]) * 60 +
          parseInt(startTime.split(":")[1]);

        if (endMinutes <= startMinutes) {
          addBotMessage(
            "❌ A hora final deve ser depois da hora inicial. Por favor, verifique os horários.",
          );
          setIsLoading(false);
          return;
        }

        try {
          const rooms = await checkAvailability(date, startTime, endTime);

          if (rooms === null) {
            // Falha na verificação — não afirmar que não há salas
            addBotMessage(
              "❌ Erro ao verificar disponibilidade. Tente novamente.",
            );
            setIsLoading(false);
            return;
          }

          setAvailableRooms(rooms);

          if (rooms.length > 0) {
            const roomsList = rooms.map((r) => `- ${r.name}`).join("\n");
            const roomsMessage = `✅ Salas disponíveis para ${formatDateForDisplay(date)} de ${startTime} a ${endTime}:\n\n${roomsList}\n\nQual sala você prefere?`;
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
          addBotMessage(
            "❌ Erro ao verificar disponibilidade. Tente novamente.",
          );
          setIsLoading(false);
          return;
        }
      }


      // Lidar com confirmação do agendamento — só quando o bot está de fato
      // aguardando confirmação (sala já selecionada), com palavra inteira
      const awaitingBookingConfirmation = !!updatedFormData.selectedRoomId;
      const saidYes =
        matchesWord(normalizedInput, "sim") ||
        matchesWord(normalizedInput, "yes") ||
        matchesWord(normalizedInput, "confirmar");
      // Não tratar "no" (contração de "em + o", como em "sim, no horário
      // combinado") como negativa; apenas "não"/"nao". E o "sim" é avaliado
      // ANTES da negativa (como no fluxo de cancelamento).
      const saidNo = matchesWord(normalizedInput, "nao");

      if (awaitingBookingConfirmation && saidYes) {
        // Usar os dados de agendamento pendentes armazenados para garantir que todos os campos estejam definidos
        const pendingBooking = sessionStorage.getItem("pendingBooking");
        if (!pendingBooking) {
          addBotMessage(
            "❌ Não encontrei os dados da reserva para confirmar. Por favor, recomece o agendamento informando seu nome, e-mail, data e horário novamente.",
          );
          setFormData({ ...EMPTY_FORM_DATA });
          setAvailableRooms([]);
          setIsLoading(false);
          return;
        }

        const bookingData = JSON.parse(pendingBooking);
        setFormData(bookingData);

        // Criar agendamento com os dados confirmados
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
            const error = await response.json().catch(() => null);
            throw new Error(error?.error || "Erro ao criar o agendamento");
          }

          const data = await response.json();
          sessionStorage.removeItem("pendingBooking");

          const bookingIdText = String(data.booking.id);

          // Formatar data sem problemas de fuso horário
          const [year, month, day] = bookingData.date.split("-");
          const formattedDate = `${day}/${month}/${year}`;
          const successMessage = `✅ Perfeito! Sua sala foi reservada com sucesso!\n\n🎫 **ID da Reserva: #${bookingIdText}**\n(Anote ou copie este ID — ele é necessário para modificar ou cancelar a reserva.)\n\nDetalhes da Reserva:\n📍 Sala: ${data.booking.roomName}\n📅 Data: ${formattedDate}\n⏰ Horário: ${bookingData.startTime} - ${bookingData.endTime}\n📧 Confirmação enviada para: ${bookingData.email}\n\nObrigado por usar o SalaAgenda!`;

          addBotMessage(successMessage);
          // Mantém o histórico da IA em sincronia: a reserva foi concluída
          setConversationHistory((prev) => [
            ...prev,
            { role: "user" as const, content: userInput },
            {
              role: "assistant" as const,
              content: `Agendamento criado com sucesso — ID #${bookingIdText}.`,
            },
          ]);
          toast.success(`Agendamento confirmado! ID da reserva: #${bookingIdText}`, {
            duration: 10000,
            action: {
              label: "Copiar ID",
              onClick: () => {
                navigator.clipboard
                  ?.writeText(bookingIdText)
                  .then(() => toast.success("ID copiado!"))
                  .catch(() => {});
              },
            },
          });

          // Redefinir dados do formulário para próximo agendamento
          setFormData({ ...EMPTY_FORM_DATA });
          setAvailableRooms([]);
          setCurrentFlow("booking");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Erro ao confirmar reserva",
          );
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (awaitingBookingConfirmation && saidNo) {
        // Fluxo abandonado: limpar a reserva pendente
        sessionStorage.removeItem("pendingBooking");
        setFormData({ ...updatedFormData, selectedRoomId: "" });
        const abortMessage =
          "Sem problemas! O agendamento não foi confirmado. Você pode escolher outra sala da lista acima ou informar uma nova data e horário.";
        addBotMessage(abortMessage);
        // Mantém o histórico da IA em sincronia: a confirmação foi abortada
        setConversationHistory((prev) => [
          ...prev,
          { role: "user" as const, content: userInput },
          { role: "assistant" as const, content: abortMessage },
        ]);
        setIsLoading(false);
        return;
      }

      // Enviar mensagem para IA para conversa geral
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
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || "Erro ao obter resposta do assistente",
        );
      }

      const data = await response.json();
      const aiMessage = data.message;

      if (!aiMessage) {
        throw new Error("O assistente não retornou resposta. Tente novamente");
      }

      addBotMessage(aiMessage);
      setConversationHistory([
        ...newConversationHistory,
        { role: "assistant", content: aiMessage },
      ]);
    } catch (error) {
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
            Reserve sua sala de forma rápida e simples
          </p>
        </div>
      </div>

      <Card className="flex-1 overflow-hidden flex flex-col bg-card border border-border">
        {/* Messages Area */}
        <div
          className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-card to-card/50"
          role="log"
          aria-live="polite"
          aria-label="Mensagens da conversa"
        >
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
              aria-label="Digite sua mensagem para o assistente"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1 rounded-full border-border focus:border-primary focus:ring-primary"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading}
              aria-label="Enviar mensagem"
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
