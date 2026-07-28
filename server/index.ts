import "dotenv/config";
import express from "express";
import cors from "cors";
import { AppConfigResponse } from "@shared/api";
import { initializeDatabase } from "./db";
import { requireAdmin } from "./middleware/auth";
import { createRateLimiter } from "./middleware/rateLimit";
import { getAllowedEmailDomains } from "./utils/validation";
import { handleLogin, handleLogout } from "./routes/auth";
import {
  handleListRooms,
  handleCreateRoom,
  handleDeleteRoom,
  handleGetRoom,
  handleUpdateRoom,
} from "./routes/rooms";
import {
  handleListBookings,
  handleCheckAvailability,
  handleCreateBooking,
  handleGetAvailableTimes,
  handleGetBooking,
  handleUpdateBooking,
  handleDeleteBooking,
} from "./routes/bookings";
import { handleChat } from "./routes/chat";
import {
  handleAIGetBooking,
  handleAIUpdateBooking,
  handleAICancelBooking,
  handleEmailClassification,
  handleEmailResponseGeneration,
} from "./routes/ai";
import {
  handleEmailProcessorStatus,
  handleEmailProcessorStart,
  handleEmailProcessorStop,
  handleEmailProcessorManualProcess,
  handleEmailProcessorStats,
  handleEmailProcessorLogs,
  handleEmailProcessorLogsByDate,
  handleEmailProcessorTest,
} from "./routes/emailProcessor";
import { initializeEmailProcessor } from "./services/emailProcessor";

export async function initializeApp() {
  // Initialize database
  await initializeDatabase();

  // Initialize email processor (will only start if configured)
  const emailProcessor = initializeEmailProcessor();
  if (emailProcessor) {
    console.log("Email processor initialized (manual start required)");
  } else {
    console.log("Email processor not configured");
  }
}

export function createServer() {
  const app = express();

  // CORS: se CORS_ORIGIN estiver definido (lista separada por vírgula),
  // restringe às origens listadas; caso contrário permanece aberto (dev).
  const corsOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : {}));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rate limiter (em memória) para os endpoints que chamam a IA
  const aiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

  // Rate limiter para TODAS as rotas públicas /api/ai/* (proteção contra
  // enumeração/abuso do espelho usado pelo chatbot)
  const aiDbRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });

  // Rate limiter do login administrativo (mitiga força bruta)
  const loginRateLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 10,
    message:
      "Muitas tentativas de login em pouco tempo. Aguarde um instante e tente novamente.",
  });

  // Autenticação administrativa
  app.post("/api/auth/login", loginRateLimiter, handleLogin);
  app.post("/api/auth/logout", handleLogout);

  // Configuração pública (usada pelo cliente para validar emails com a mesma lista)
  app.get("/api/config", (_req, res) => {
    const response: AppConfigResponse = {
      allowedEmailDomains: getAllowedEmailDomains(),
    };
    res.json(response);
  });

  // API de Salas (leitura pública; escrita exige admin)
  app.get("/api/rooms", handleListRooms);
  app.get("/api/rooms/:id", handleGetRoom);
  app.post("/api/rooms", requireAdmin, handleCreateRoom);
  app.put("/api/rooms/:id", requireAdmin, handleUpdateRoom);
  app.delete("/api/rooms/:id", requireAdmin, handleDeleteRoom);

  // API de Agendamentos
  // IMPORTANTE: rotas fixas (available-times, check-availability) devem ser
  // registradas ANTES de "/api/bookings/:id" para não serem sombreadas.
  app.get("/api/bookings/available-times", handleGetAvailableTimes);
  app.post("/api/bookings/check-availability", handleCheckAvailability);
  app.get("/api/bookings", requireAdmin, handleListBookings);
  app.post("/api/bookings", handleCreateBooking);
  app.get("/api/bookings/:id", requireAdmin, handleGetBooking);
  app.put("/api/bookings/:id", requireAdmin, handleUpdateBooking);
  app.delete("/api/bookings/:id", requireAdmin, handleDeleteBooking);

  // API de Chat (Powered IA)
  app.post("/api/chat", aiRateLimiter, handleChat);

  // Rate limiter em TODAS as rotas /api/ai/*
  app.use("/api/ai", aiDbRateLimiter);

  // API de Operações de Banco de Dados IA (usadas pelo chatbot).
  // Apenas as rotas por ID são públicas; GET mascara o email do cliente e
  // PUT/DELETE exigem o email da reserva como fator de verificação.
  app.get("/api/ai/bookings/:id", handleAIGetBooking);
  app.put("/api/ai/bookings/:id", handleAIUpdateBooking);
  app.delete("/api/ai/bookings/:id", handleAICancelBooking);

  // API de Email Processing IA (uso interno/administrativo)
  app.post("/api/ai/email/classify", requireAdmin, handleEmailClassification);
  app.post(
    "/api/ai/email/response",
    requireAdmin,
    handleEmailResponseGeneration,
  );

  // API de Email Processor Management (exige admin em TODAS as rotas)
  app.use("/api/email-processor", requireAdmin);
  app.get("/api/email-processor/status", handleEmailProcessorStatus);
  app.post("/api/email-processor/start", handleEmailProcessorStart);
  app.post("/api/email-processor/stop", handleEmailProcessorStop);
  app.post(
    "/api/email-processor/manual-process",
    handleEmailProcessorManualProcess,
  );
  app.get("/api/email-processor/stats", handleEmailProcessorStats);
  app.get("/api/email-processor/logs", handleEmailProcessorLogs);
  app.get("/api/email-processor/logs/by-date", handleEmailProcessorLogsByDate);
  app.post(
    "/api/email-processor/test",
    aiRateLimiter,
    handleEmailProcessorTest,
  );

  // Health check
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Handler global de erros (JSON, PT-BR). Trata inclusive JSON malformado
  // no corpo da requisição (SyntaxError do express.json → 400).
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (res.headersSent) {
        next(err);
        return;
      }

      if (
        err instanceof SyntaxError &&
        (err as SyntaxError & { status?: number }).status === 400
      ) {
        res
          .status(400)
          .json({ error: "JSON inválido no corpo da requisição" });
        return;
      }

      console.error("Unhandled error:", err);
      res.status(500).json({ error: "Erro interno do servidor" });
    },
  );

  return app;
}
