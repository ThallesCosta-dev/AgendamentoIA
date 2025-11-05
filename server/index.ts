import "dotenv/config";
import express from "express";
import cors from "cors";
import { initializeDatabase } from "./db";
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
} from "./routes/ai";

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

  // Rotas de Demonstração
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
