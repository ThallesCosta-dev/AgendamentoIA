import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Send, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Room, Booking } from "@shared/api";
import { cn } from "@/lib/utils";

type ConversationStep =
  | "greeting"
  | "name"
  | "email"
  | "date"
  | "time"
  | "duration"
  | "room_selection"
  | "confirmation"
  | "success"
  | "error";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  timestamp: Date;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState<ConversationStep>("greeting");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    date: "",
    startTime: "",
    endTime: "",
    selectedRoomId: "",
  });

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize with greeting
  useEffect(() => {
    addBotMessage("Olá! 👋 Bem-vindo ao assistente de agendamento de salas para defesa de tese. Sou aqui para ajudá-lo a reservar uma sala. Qual é o seu nome completo?");
  }, []);

  const addBotMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: "bot",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, message]);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    return email.endsWith("@instituicao.edu.br");
  };

  const checkAvailability = async (date: string, startTime: string, endTime: string) => {
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
      addBotMessage("❌ Erro ao verificar disponibilidade. Por favor, tente novamente.");
      setCurrentStep("error");
      return [];
    }
  };

  const createBooking = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: formData.selectedRoomId,
          clientName: formData.name,
          clientEmail: formData.email,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create booking");
      }

      const data = await response.json();
      setBooking(data.booking);
      setCurrentStep("success");
      addBotMessage(
        `✅ Perfeito! Sua defesa foi agendada com sucesso!\n\nDetalhes da Reserva:\n📍 Sala: ${data.booking.roomName}\n📅 Data: ${new Date(formData.date).toLocaleDateString("pt-BR")}\n⏰ Horário: ${formData.startTime} - ${formData.endTime}\n📧 Confirmação enviada para: ${formData.email}\n\nObrigado por usar nosso assistente!`
      );
    } catch (error) {
      console.error("Error creating booking:", error);
      addBotMessage(`❌ Erro ao confirmar a reserva: ${error instanceof Error ? error.message : "Erro desconhecido"}. Por favor, tente novamente.`);
      setCurrentStep("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userInput = input.trim();
    addUserMessage(userInput);
    setInput("");
    setIsLoading(true);

    try {
      switch (currentStep) {
        case "greeting":
          setFormData((prev) => ({ ...prev, name: userInput }));
          addBotMessage(`Prazer conhecê-lo, ${userInput}! 😊\n\nAgora, qual é seu e-mail institucional? (deve ser do domínio @instituicao.edu.br)`);
          setCurrentStep("email");
          break;

        case "email":
          if (!validateEmail(userInput)) {
            addBotMessage(`❌ E-mail inválido. Por favor, use seu e-mail institucional no formato: seu.email@instituicao.edu.br`);
            break;
          }
          setFormData((prev) => ({ ...prev, email: userInput }));
          addBotMessage(`Ótimo! E-mail registrado: ${userInput}\n\nQual é a data desejada para a defesa? (formato: DD/MM/YYYY ou YYYY-MM-DD)`);
          setCurrentStep("date");
          break;

        case "date":
          const dateRegex = /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/;
          if (!dateRegex.test(userInput)) {
            addBotMessage(`❌ Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD`);
            break;
          }

          let isoDate = userInput;
          if (userInput.includes("/")) {
            const [day, month, year] = userInput.split("/");
            isoDate = `${year}-${month}-${day}`;
          }

          setFormData((prev) => ({ ...prev, date: isoDate }));
          addBotMessage(`Data marcada: ${userInput}\n\nQual é o horário desejado para o início da defesa? (formato: HH:mm, ex: 14:30)`);
          setCurrentStep("time");
          break;

        case "time":
          const timeRegex = /^\d{2}:\d{2}$/;
          if (!timeRegex.test(userInput)) {
            addBotMessage(`❌ Formato de horário inválido. Use HH:mm (ex: 14:30)`);
            break;
          }
          setFormData((prev) => ({ ...prev, startTime: userInput }));
          addBotMessage(`Horário de início: ${userInput}\n\nQual é o horário de término estimado? (formato: HH:mm)`);
          setCurrentStep("duration");
          break;

        case "duration":
          const endTimeRegex = /^\d{2}:\d{2}$/;
          if (!endTimeRegex.test(userInput)) {
            addBotMessage(`❌ Formato de horário inválido. Use HH:mm`);
            break;
          }

          const endMinutes = parseInt(userInput.split(":")[0]) * 60 + parseInt(userInput.split(":")[1]);
          const startMinutes = parseInt(formData.startTime.split(":")[0]) * 60 + parseInt(formData.startTime.split(":")[1]);

          if (endMinutes <= startMinutes) {
            addBotMessage(`❌ O horário de término deve ser posterior ao horário de início.`);
            break;
          }

          setFormData((prev) => ({ ...prev, endTime: userInput }));
          addBotMessage(`Verificando salas disponíveis de ${formData.startTime} às ${userInput}...`);

          const rooms = await checkAvailability(formData.date, formData.startTime, userInput);
          if (rooms.length === 0) {
            addBotMessage(`❌ Infelizmente, não há salas disponíveis para este horário e data.\n\nDeseja tentar uma outra data ou horário?`);
            setCurrentStep("error");
          } else {
            setAvailableRooms(rooms);
            addBotMessage(`✅ Encontrei ${rooms.length} sala(s) disponível(is)! Qual você prefere?\n\n${rooms.map((r) => `🔹 ${r.name} (capacidade: ${r.capacity} pessoas)`).join("\n")}`);
            setCurrentStep("room_selection");
          }
          break;

        case "room_selection":
          const selectedRoom = availableRooms.find(
            (r) => r.name.toLowerCase() === userInput.toLowerCase()
          );
          if (!selectedRoom) {
            addBotMessage(`❌ Sala não encontrada. Por favor, escolha uma das opções listadas acima.`);
            break;
          }
          setFormData((prev) => ({ ...prev, selectedRoomId: selectedRoom.id }));
          addBotMessage(
            `Ótimo! Você escolheu a ${selectedRoom.name}.\n\n📋 Resumo da sua reserva:\n\n👤 Nome: ${formData.name}\n📧 E-mail: ${formData.email}\n📅 Data: ${formData.date}\n⏰ Horário: ${formData.startTime} - ${formData.endTime}\n📍 Sala: ${selectedRoom.name}\n\nConfirmar a reserva? (Digite: Sim ou Não)`
          );
          setCurrentStep("confirmation");
          break;

        case "confirmation":
          if (userInput.toLowerCase() === "sim" || userInput.toLowerCase() === "yes") {
            await createBooking();
          } else if (userInput.toLowerCase() === "não" || userInput.toLowerCase() === "no") {
            setCurrentStep("greeting");
            setFormData({
              name: "",
              email: "",
              date: "",
              startTime: "",
              endTime: "",
              selectedRoomId: "",
            });
            addBotMessage(`Entendo! Vamos recomeçar do zero. Qual é o seu nome completo?`);
          } else {
            addBotMessage(`Por favor, responda com "Sim" ou "Não"`);
          }
          break;

        case "success":
          setCurrentStep("greeting");
          setFormData({
            name: "",
            email: "",
            date: "",
            startTime: "",
            endTime: "",
            selectedRoomId: "",
          });
          addBotMessage(`Deseja fazer outro agendamento? Se sim, qual é o seu nome completo?`);
          break;

        case "error":
          if (userInput.toLowerCase() === "sim") {
            setCurrentStep("greeting");
            setFormData({
              name: "",
              email: "",
              date: "",
              startTime: "",
              endTime: "",
              selectedRoomId: "",
            });
            addBotMessage(`Vamos tentar novamente! Qual é o seu nome completo?`);
          } else {
            addBotMessage(`Obrigado por usar nosso assistente. Tenha um ótimo dia! 👋`);
          }
          break;
      }
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
          <h1 className="text-2xl font-bold text-foreground">Assistente de Agendamento</h1>
          <p className="text-sm text-muted-foreground">Reserve sua sala de defesa de tese</p>
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
                  msg.type === "user" ? "justify-end" : "justify-start"
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
                      : "bg-primary text-primary-foreground rounded-br-none"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))
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
              disabled={isLoading || currentStep === "success"}
              className="flex-1 rounded-full border-border focus:border-primary focus:ring-primary"
              autoFocus
            />
            <Button
              type="submit"
              disabled={!input.trim() || isLoading || currentStep === "success"}
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
