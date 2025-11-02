import "dotenv/config";
import express from "express";
import cors from "cors";
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

  // Demo routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  return app;
}
