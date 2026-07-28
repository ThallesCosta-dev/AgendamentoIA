import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { initializeStore, DuplicateRoomError } from "./store";
import {
  createRoom,
  getRooms,
  getRoomById,
  updateRoomById,
  deleteRoom,
  createBooking,
  getBookings,
  getBookingsByRoom,
  getBookingById,
  updateBookingById,
  deleteBookingById,
  bookingExists,
  BookingConflictError,
} from "./data";

// Todos os testes usam um DATA_DIR temporário (fora do repositório),
// removido ao final de cada teste.

let tempDir: string;
let previousDataDir: string | undefined;

function dbFilePath(): string {
  return path.join(tempDir, "db.json");
}

beforeEach(async () => {
  previousDataDir = process.env.DATA_DIR;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "salaagenda-store-"));
  process.env.DATA_DIR = tempDir;
  await initializeStore();
});

afterEach(() => {
  if (previousDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = previousDataDir;
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

const BOOKING_BASE = {
  clientName: "Maria Silva",
  clientEmail: "maria@ioc.fiocruz.br",
  date: "2030-03-15",
  startTime: "14:00",
  endTime: "16:00",
};

async function firstRoom() {
  const rooms = await getRooms();
  return rooms[0];
}

describe("store — inicialização", () => {
  it("cria as 3 salas padrão na primeira execução e grava o db.json", async () => {
    const rooms = await getRooms();

    expect(rooms).toHaveLength(3);
    expect(rooms.map((room) => room.name).sort()).toEqual(
      ["Auditório Principal", "Sala 101", "Sala de Conferência A"].sort(),
    );
    expect(fs.existsSync(dbFilePath())).toBe(true);

    const persisted = JSON.parse(fs.readFileSync(dbFilePath(), "utf8"));
    expect(persisted.rooms).toHaveLength(3);
    expect(persisted.nextIds.rooms).toBe(4);
  });

  it("recupera de um db.json corrompido preservando um backup", async () => {
    fs.writeFileSync(dbFilePath(), "isto não é JSON {{{", "utf8");

    await initializeStore();

    const rooms = await getRooms();
    expect(rooms).toHaveLength(3);
    expect(fs.existsSync(`${dbFilePath()}.corrupt-1`)).toBe(true);
  });
});

describe("store — salas", () => {
  it("cria e lista salas com ids inteiros sequenciais", async () => {
    const room = await createRoom({ name: "Sala Nova", capacity: 12 });

    expect(room.id).toBe("4"); // seed usa ids 1..3
    expect(room.name).toBe("Sala Nova");
    expect(room.capacity).toBe(12);

    const rooms = await getRooms();
    expect(rooms).toHaveLength(4);
    expect(await getRoomById(room.id)).toMatchObject({ name: "Sala Nova" });
  });

  it("rejeita nome de sala duplicado (case-insensitive) com DuplicateRoomError", async () => {
    await expect(
      createRoom({ name: "sala 101", capacity: 10 }),
    ).rejects.toBeInstanceOf(DuplicateRoomError);

    const rooms = await getRooms();
    const sala101 = rooms.find((room) => room.name === "Sala 101")!;

    // Renomear para o nome de OUTRA sala também é rejeitado…
    await expect(
      updateRoomById(sala101.id, { name: "AUDITÓRIO PRINCIPAL" }),
    ).rejects.toBeInstanceOf(DuplicateRoomError);

    // …mas manter o próprio nome (alterando só a capacidade) é permitido
    const updated = await updateRoomById(sala101.id, {
      name: "Sala 101",
      capacity: 45,
    });
    expect(updated.capacity).toBe(45);
  });

  it("exclui a sala em cascata com seus agendamentos", async () => {
    const room = await firstRoom();
    await createBooking({ ...BOOKING_BASE, roomId: room.id, roomName: room.name });

    expect(await deleteRoom(room.id)).toBe(true);
    expect(await getRoomById(room.id)).toBeNull();
    expect(await getBookingsByRoom(room.id)).toHaveLength(0);
    expect(await getBookings()).toHaveLength(0);

    expect(await deleteRoom("9999")).toBe(false);
  });
});

describe("store — agendamentos", () => {
  it("cria agendamento e devolve data YYYY-MM-DD e horários HH:MM", async () => {
    const room = await firstRoom();
    const booking = await createBooking({
      ...BOOKING_BASE,
      roomId: room.id,
      roomName: room.name,
    });

    expect(booking.id).toBe("1");
    expect(booking.roomId).toBe(room.id);
    expect(booking.date).toBe("2030-03-15");
    expect(booking.startTime).toBe("14:00");
    expect(booking.endTime).toBe("16:00");

    expect(await getBookingById(booking.id)).toMatchObject({
      clientName: "Maria Silva",
    });
  });

  it("lança BookingConflictError em horários sobrepostos (adjacentes são permitidos)", async () => {
    const room = await firstRoom();
    await createBooking({ ...BOOKING_BASE, roomId: room.id, roomName: room.name });

    // Sobreposição parcial → conflito
    await expect(
      createBooking({
        ...BOOKING_BASE,
        roomId: room.id,
        roomName: room.name,
        startTime: "15:00",
        endTime: "17:00",
      }),
    ).rejects.toBeInstanceOf(BookingConflictError);

    // Intervalo adjacente (16:00 em diante) → permitido
    const adjacent = await createBooking({
      ...BOOKING_BASE,
      roomId: room.id,
      roomName: room.name,
      startTime: "16:00",
      endTime: "17:00",
    });
    expect(adjacent.startTime).toBe("16:00");

    // Mesma faixa em OUTRA sala → permitido
    const rooms = await getRooms();
    const otherRoom = rooms.find((r) => r.id !== room.id)!;
    await expect(
      createBooking({
        ...BOOKING_BASE,
        roomId: otherRoom.id,
        roomName: otherRoom.name,
      }),
    ).resolves.toBeTruthy();
  });

  it("bookingExists respeita excludeBookingId", async () => {
    const room = await firstRoom();
    const booking = await createBooking({
      ...BOOKING_BASE,
      roomId: room.id,
      roomName: room.name,
    });

    expect(
      await bookingExists(room.id, BOOKING_BASE.date, "14:00", "16:00"),
    ).toBe(true);
    expect(
      await bookingExists(
        room.id,
        BOOKING_BASE.date,
        "14:00",
        "16:00",
        booking.id,
      ),
    ).toBe(false);
  });

  it("updateBookingById atualiza o roomName quando a sala muda", async () => {
    const rooms = await getRooms();
    const [roomA, roomB] = rooms;

    const booking = await createBooking({
      ...BOOKING_BASE,
      roomId: roomA.id,
      roomName: roomA.name,
    });

    const updated = await updateBookingById(booking.id, { roomId: roomB.id });
    expect(updated.roomId).toBe(roomB.id);
    expect(updated.roomName).toBe(roomB.name);

    expect(await deleteBookingById(booking.id)).toBe(true);
    expect(await deleteBookingById(booking.id)).toBe(false);
  });
});

describe("store — persistência", () => {
  it("mantém os dados após reinicializar a partir do mesmo diretório", async () => {
    const room = await createRoom({ name: "Sala Persistente", capacity: 8 });
    await createBooking({
      ...BOOKING_BASE,
      roomId: room.id,
      roomName: room.name,
    });

    // Simula reinício do processo: recarrega o estado do disco
    await initializeStore();

    const rooms = await getRooms();
    expect(rooms.map((r) => r.name)).toContain("Sala Persistente");

    const bookings = await getBookingsByRoom(room.id);
    expect(bookings).toHaveLength(1);
    expect(bookings[0].clientName).toBe("Maria Silva");

    // Os ids continuam do ponto em que pararam (sem colisão)
    const another = await createRoom({ name: "Sala Pós-Reinício", capacity: 5 });
    expect(Number(another.id)).toBeGreaterThan(Number(room.id));
  });
});
