import { RequestHandler } from "express";
import { CreateRoomRequest, ListRoomsResponse, Room } from "@shared/api";
import { createRoom, deleteRoom, getRooms } from "../data";

export const handleListRooms: RequestHandler = async (_req, res) => {
  try {
    const rooms = await getRooms();
    const response: ListRoomsResponse = { rooms };
    res.json(response);
  } catch (error) {
    console.error("Error listing rooms:", error);
    res.status(500).json({ error: "Failed to list rooms" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  try {
    const { name, capacity } = req.body as CreateRoomRequest;

    if (!name || !capacity || capacity <= 0) {
      res.status(400).json({ error: "Invalid room data" });
      return;
    }

    const room = await createRoom({ name, capacity });
    res.status(201).json(room);
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
};

export const handleDeleteRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await deleteRoom(id);
    if (!success) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
};
