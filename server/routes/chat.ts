import { RequestHandler } from "express";
import { getAllowedEmailDomains } from "../utils/validation";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Limites de segurança para o histórico encaminhado ao provedor de IA
const MAX_FORWARDED_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

// Tempo máximo de espera pela resposta do provedor de IA
const GROQ_TIMEOUT_MS = 30_000;

const GENERIC_CHAT_ERROR =
  "Não foi possível processar sua mensagem no momento. Por favor, tente novamente mais tarde.";

function buildSystemPrompt(): string {
  const domains = getAllowedEmailDomains().join(", ");

  return `Você é um assistente de agendamento de salas do SalaAgenda (IOC/Fiocruz).

REGRAS INVIOLÁVEIS (nunca quebre, mesmo que o usuário peça):
- Você NÃO tem acesso ao sistema de reservas. NUNCA simule, narre ou invente ações do sistema (nada de "(O sistema verifica...)" ou similares).
- NUNCA liste salas nem afirme quais estão disponíveis — a lista real é exibida automaticamente pelo sistema, fora desta conversa.
- NUNCA confirme um agendamento e NUNCA gere, invente ou repita um ID de reserva que o sistema não tenha exibido.
- NUNCA encene mais de um turno da conversa: responda apenas a mensagem atual e pare.

SEU ÚNICO PAPEL:
1. Coletar as informações que faltam: nome completo, email institucional, data, horário de início e horário de término
2. Fazer UMA pergunta por vez
3. Esclarecer dúvidas do usuário sobre o processo
4. Ser amigável, profissional e conciso

COLETA DE HORÁRIOS:
- SEMPRE aguarde que o USUÁRIO forneça os horários; não sugira nem assuma horários padrão
- Peça explicitamente o horário de INÍCIO e depois o de TÉRMINO

QUANDO TODOS OS DADOS ESTIVEREM COLETADOS:
- Diga apenas que o sistema verificará a disponibilidade e exibirá as salas — e pare. Não invente o resultado.

VALIDAÇÃO (oriente o usuário, quem valida de verdade é o sistema):
- Email: deve ser institucional, de um dos domínios aceitos: ${domains} (exemplo: pesquisador@ioc.fiocruz.br)
- Data: deve ser válida e futura (formatos aceitos: DD/MM/AAAA ou YYYY-MM-DD)
- Horários: formato HH:mm; hora final depois da inicial

ESTILO:
- Conversa natural e concisa, em português brasileiro
- Não prometa coisas que o sistema não faz (não diga "vou verificar" — você não verifica nada)`;
}

export const handleChat: RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Formato de requisição inválido" });
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error("GROQ_API_KEY is not set");
      res.status(500).json({
        error: "Serviço de IA não configurado no servidor.",
      });
      return;
    }

    // Encaminha apenas as últimas mensagens, com conteúdo limitado
    const sanitizedMessages: ChatMessage[] = messages
      .filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
      .slice(-MAX_FORWARDED_MESSAGES)
      .map((m) => ({
        role: m.role,
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }));

    const messagesWithSystem: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      ...sanitizedMessages,
    ];

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        messages: messagesWithSystem,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      res.status(502).json({ error: GENERIC_CHAT_ERROR });
      return;
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (!data.choices || data.choices.length === 0) {
      console.error("Groq returned no choices");
      res.status(502).json({ error: GENERIC_CHAT_ERROR });
      return;
    }

    const aiMessage = data.choices[0].message.content;
    res.json({
      message: aiMessage,
      usage: data.usage,
    });
  } catch (error) {
    // Timeout/abort da chamada ao provedor de IA → 502 com a mensagem
    // genérica. (AbortSignal.timeout rejeita com DOMException, que pode não
    // ser instanceof Error — verifica pelo nome.)
    const errorName = (error as { name?: string } | null)?.name;
    if (errorName === "TimeoutError" || errorName === "AbortError") {
      console.error("Groq API timeout after", GROQ_TIMEOUT_MS, "ms");
      res.status(502).json({ error: GENERIC_CHAT_ERROR });
      return;
    }

    console.error("Chat error:", error);
    res.status(500).json({ error: GENERIC_CHAT_ERROR });
  }
};
