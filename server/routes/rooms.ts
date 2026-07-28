import { RequestHandler } from "express";
import { z } from "zod";
import { ListRoomsResponse } from "@shared/api";
import {
  createRoom,
  deleteRoom,
  getRooms,
  getRoomById,
  updateRoomById,
  DuplicateRoomError,
} from "../data";

const roomSchema = z.object({
  name: z
    .string({ required_error: "O nome da sala é obrigatório" })
    .trim()
    .min(1, "O nome da sala é obrigatório")
    .max(100, "O nome da sala deve ter no máximo 100 caracteres"),
  capacity: z
    .number({ required_error: "A capacidade é obrigatória" })
    .int("A capacidade deve ser um número inteiro")
    .min(1, "A capacidade deve ser no mínimo 1")
    .max(1000, "A capacidade deve ser no máximo 1000"),
});

export const handleListRooms: RequestHandler = async (_req, res) => {
  try {
    const rooms = await getRooms();
    const response: ListRoomsResponse = { rooms };
    res.json(response);
  } catch (error) {
    console.error("Error listing rooms:", error);
    res.status(500).json({ error: "Não foi possível listar as salas" });
  }
};

export const handleGetRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await getRoomById(id);

    if (!room) {
      res.status(404).json({ error: "Sala não encontrada" });
      return;
    }

    res.json(room);
  } catch (error) {
    console.error("Error getting room:", error);
    res.status(500).json({ error: "Não foi possível obter a sala" });
  }
};

export const handleCreateRoom: RequestHandler = async (req, res) => {
  try {
    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Dados da sala inválidos",
      });
      return;
    }

    const room = await createRoom({
      name: parsed.data.name,
      capacity: parsed.data.capacity,
    });
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof DuplicateRoomError) {
      res.status(409).json({ error: "Já existe uma sala com esse nome" });
      return;
    }
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Não foi possível criar a sala" });
  }
};

export const handleUpdateRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error:
          parsed.error.issues[0]?.message ?? "Dados da sala inválidos",
      });
      return;
    }

    const room = await updateRoomById(id, parsed.data);
    res.json(room);
  } catch (error) {
    if (error instanceof DuplicateRoomError) {
      res.status(409).json({ error: "Já existe uma sala com esse nome" });
      return;
    }
    console.error("Error updating room:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: "Sala não encontrada" });
    } else {
      res.status(500).json({ error: "Não foi possível atualizar a sala" });
    }
  }
};

export const handleDeleteRoom: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    const success = await deleteRoom(id);
    if (!success) {
      res.status(404).json({ error: "Sala não encontrada" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({ error: "Não foi possível excluir a sala" });
  }
};
