import { RequestHandler } from "express";
import { CreateRoomRequest, ListRoomsResponse, Room } from "@shared/api";
import { createRoom, deleteRoom, getRooms } from "../data";

export const handleListRooms: RequestHandler = (_req, res) => {
  const rooms = getRooms();
  const response: ListRoomsResponse = { rooms };
  res.json(response);
};

export const handleCreateRoom: RequestHandler = (req, res) => {
  try {
    const { name, capacity } = req.body as CreateRoomRequest;

    if (!name || !capacity || capacity <= 0) {
      res.status(400).json({ error: "Invalid room data" });
      return;
    }

    const room = createRoom({ name, capacity });
    res.status(201).json(room);
  } catch (error) {
    res.status(500).json({ error: "Failed to create room" });
  }
};

export const handleDeleteRoom: RequestHandler = (req, res) => {
  try {
    const { id } = req.params;

    const success = deleteRoom(id);
    if (!success) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete room" });
  }
};
