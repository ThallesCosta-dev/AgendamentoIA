import "dotenv/config";
import express from "express";
import cors from "cors";
import { initializeDatabase } from "./db";
import { handleDemo } from "./routes/demo";
import {
  handleListRooms,
  handleCreateRoom,
  handleDeleteRoom,
} from "./routes/rooms";
import {
  handleListBookings,
  handleCheckAvailability,
  handleCreateBooking,
  handleGetAvailableTimes,
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

  // Rooms API
  app.get("/api/rooms", handleListRooms);
  app.post("/api/rooms", handleCreateRoom);
  app.delete("/api/rooms/:id", handleDeleteRoom);

  // Bookings API
  app.get("/api/bookings", handleListBookings);
  app.post("/api/bookings/check-availability", handleCheckAvailability);
  app.post("/api/bookings", handleCreateBooking);
  app.get("/api/bookings/available-times", handleGetAvailableTimes);

  // Chat API (AI powered)
  app.post("/api/chat", handleChat);

  // AI Database Operations API
  app.get("/api/ai/rooms", handleAIListRooms);
  app.get("/api/ai/bookings", handleAIListBookings);
  app.get("/api/ai/bookings/:id", handleAIGetBooking);
  app.post("/api/ai/bookings", handleAICreateBooking);
  app.post("/api/ai/bookings/check-availability", handleAICheckAvailability);
  app.put("/api/ai/bookings/:id", handleAIUpdateBooking);
  app.delete("/api/ai/bookings/:id", handleAICancelBooking);

  // Demo routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
