import { RequestHandler } from "express";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

interface OpenRouterResponse {
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

const SYSTEM_PROMPT = `Você é um assistente de agendamento de salas para defesa de tese em uma instituição educacional.

IMPORTANTE: O SISTEMA FRONTEND CUIDA DE:
- Verificar disponibilidade de salas
- Listar salas disponíveis
- Coletar seleção de sala
- Confirmar agendamento

VOCÊ DEVE FOCAR EM:
1. Ser amigável e profissional
2. Coletar informações incompletas (nome, email, data, horários de inicio e horario de termino)
2.2 Faça UMA PERGUNTA POR VEZ para as informações acima
3. Validar formatos (email deve ter .edu.br)
4. Esclarecer dúvidas do usuário
5. Guiar o usu��rio naturalmente no processo

- SEMPRE aguarde que o USUÁRIO forneça os horários
- Peça explicitamente: "Qual é o horário de INÍCIO que você deseja?"
- Peça explicitamente: "Qual é o horário de TÉRMINO?"
- Não assuma nenhum horário padrão

FLUXO ESPERADO:
1. Perguntar nome completo (se não fornecido)
2. Perguntar email institucional (se não fornecido)
3. Perguntar data desejada (se não fornecido)
4. PERGUNTAR EXPLICITAMENTE horário de INÍCIO (não sugira horários padrão)
5. PERGUNTAR EXPLICITAMENTE horário de TÉRMINO (não sugira horários padrão)
6. O SISTEMA AUTOMATICAMENTE vai:
   - Verificar salas disponíveis
   - Apresentar lista de salas ao usuário
   - Coletar seleção de sala
   - Pedir confirmação final
   - Criar agendamento
   - Mostrar ID da reserva

APÓS AGENDAMENTO CRIADO:
- Parabéns! O ID será exibido
- Oferecer ajuda para: modificar, cancelar, nova reserva
- Para modificações/cancelamentos: usuário fornece ID e sistema processa

VALIDAÇÃO:
- Email: deve terminar em .edu.br (exemplo: aluno@universidade.edu.br)
- Data: deve ser válida e futura
- Horários: hora final deve ser depois da inicial
- Formato: HH:mm para horários, YYYY-MM-DD ou DD/MM/YYYY para datas

ESTILO:
- Conversa natural e concisa
- Respostas em português brasileiro
- Sempre educado e prestativo
- Não prometa coisas que o sistema não faz (não diga "vou verificar" quando o sistema já fez isso)`;

export const handleChat: RequestHandler = async (req, res) => {
  try {
    const { messages } = req.body as ChatRequest;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Invalid request format" });
      return;
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error("OPENROUTER_API_KEY is not set");
      res.status(500).json({
        error:
          "API key not configured. Please set OPENROUTER_API_KEY environment variable.",
      });
      return;
    }

    console.log("Chat request received with", messages.length, "messages");

    const messagesWithSystem: ChatMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://openrouter.ai",
          "X-Title": "SalaAgenda Chatbot",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2:free",
          messages: messagesWithSystem,
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 500,
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);

      let errorMessage = `OpenRouter API error: ${response.statusText}`;
      let details = "";
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
        if (errorJson.error?.code === 401) {
          details = " - Chave da API inválida ou expirada. Verifique a chave no OpenRouter.";
        }
      } catch (e) {
        // Manter mensagem de erro padrão
      }

      console.error(`Full error details: ${errorMessage}${details}`);
      res.status(response.status).json({
        error: errorMessage + details,
      });
      return;
    }

    const data = (await response.json()) as OpenRouterResponse;

    if (!data.choices || data.choices.length === 0) {
      res.status(500).json({ error: "No response from AI model" });
      return;
    }

    const aiMessage = data.choices[0].message.content;
    res.json({
      message: aiMessage,
      usage: data.usage,
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to process chat request",
    });
  }
};
