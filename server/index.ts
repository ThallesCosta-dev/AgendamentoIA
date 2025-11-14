import "dotenv/config";
import express from "express";
import cors from "cors";
import { initializeDatabase } from "./db";
import { initializeEmailProcessor } from "./services/emailProcessor";
import { handleDemo } from "./routes/demo";
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
  handleAIListRooms,
  handleAIListBookings,
  handleAIGetBooking,
  handleAICreateBooking,
  handleAIUpdateBooking,
  handleAICancelBooking,
  handleAICheckAvailability,
  handleEmailClassification,
  handleEmailResponseGeneration,
} from "./routes/ai";
import {
  initializeEmailProcessor,
} from "./services/emailProcessor";
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

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API de Salas
  app.get("/api/rooms", handleListRooms);
  app.get("/api/rooms/:id", handleGetRoom);
  app.post("/api/rooms", handleCreateRoom);
  app.put("/api/rooms/:id", handleUpdateRoom);
  app.delete("/api/rooms/:id", handleDeleteRoom);

  // API de Agendamentos
  app.get("/api/bookings", handleListBookings);
  app.get("/api/bookings/:id", handleGetBooking);
  app.post("/api/bookings/check-availability", handleCheckAvailability);
  app.post("/api/bookings", handleCreateBooking);
  app.put("/api/bookings/:id", handleUpdateBooking);
  app.delete("/api/bookings/:id", handleDeleteBooking);
  app.get("/api/bookings/available-times", handleGetAvailableTimes);

  // API de Chat (Powered IA)
  app.post("/api/chat", handleChat);

  // API de Operações de Banco de Dados IA
  app.get("/api/ai/rooms", handleAIListRooms);
  app.get("/api/ai/bookings", handleAIListBookings);
  app.get("/api/ai/bookings/:id", handleAIGetBooking);
  app.post("/api/ai/bookings", handleAICreateBooking);
  app.post("/api/ai/bookings/check-availability", handleAICheckAvailability);
  app.put("/api/ai/bookings/:id", handleAIUpdateBooking);
  app.delete("/api/ai/bookings/:id", handleAICancelBooking);

  // API de Email Processing IA
  app.post("/api/ai/email/classify", handleEmailClassification);
  app.post("/api/ai/email/response", handleEmailResponseGeneration);

  // API de Email Processor Management
  app.get("/api/email-processor/status", handleEmailProcessorStatus);
  app.post("/api/email-processor/start", handleEmailProcessorStart);
  app.post("/api/email-processor/stop", handleEmailProcessorStop);
  app.post("/api/email-processor/manual-process", handleEmailProcessorManualProcess);
  app.get("/api/email-processor/stats", handleEmailProcessorStats);
  app.get("/api/email-processor/logs", handleEmailProcessorLogs);
  app.get("/api/email-processor/logs/by-date", handleEmailProcessorLogsByDate);
  app.post("/api/email-processor/test", handleEmailProcessorTest);

  // Rotas de Demonstração
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
