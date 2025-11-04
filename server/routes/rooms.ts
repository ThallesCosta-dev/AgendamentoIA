import { RequestHandler } from "express";
import { CreateRoomRequest, ListRoomsResponse, Room } from "@shared/api";
import { createRoom, deleteRoom, getRooms, getRoomById, updateRoomById } from "../data";

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

export const handleGetRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await getRoomById(id);

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json(room);
  } catch (error) {
    console.error("Error getting room:", error);
    res.status(500).json({ error: "Failed to get room" });
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

export const handleUpdateRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, capacity } = req.body;

    if (!name || !capacity || capacity <= 0) {
      res.status(400).json({ error: "Invalid room data" });
      return;
    }

    const room = await updateRoomById(id, { name, capacity });
    res.json(room);
  } catch (error) {
    console.error("Error updating room:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: "Room not found" });
    } else {
      res.status(500).json({ error: "Failed to update room" });
    }
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
