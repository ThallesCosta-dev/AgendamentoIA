import { Room, Booking } from "@shared/api";
import {
  BookingRecord,
  DuplicateRoomError,
  RoomRecord,
  StoreData,
  allocateId,
  assertRoomNameAvailable,
  getStore,
  persistStore,
} from "./store";
import {
  normalizeTimeToHHMM,
  timeToMinutes,
  validateInstitutionalEmail,
} from "./utils/validation";

// Reexporta validadores puros para manter compatibilidade com os módulos
// que importavam de "./data".
export { validateInstitutionalEmail, timeToMinutes };

// Reexporta o erro tipado de nome de sala duplicado (definido no store).
export { DuplicateRoomError };

/** Erro lançado quando o horário solicitado já está reservado. */
export class BookingConflictError extends Error {
  constructor(message = "A sala não está disponível no horário solicitado") {
    super(message);
    this.name = "BookingConflictError";
  }
}

// ---------------------------------------------------------------------------
// Mapeadores registro (armazenamento) → tipo da API
// ---------------------------------------------------------------------------

function mapRoom(record: RoomRecord): Room {
  return {
    id: String(record.id),
    name: record.name,
    capacity: record.capacity,
    createdAt: record.createdAt,
  };
}

function mapBooking(record: BookingRecord): Booking {
  return {
    id: String(record.id),
    roomId: String(record.roomId),
    roomName: record.roomName,
    clientName: record.clientName,
    clientEmail: record.clientEmail,
    date: record.date,
    startTime: normalizeTimeToHHMM(record.startTime),
    endTime: normalizeTimeToHHMM(record.endTime),
    createdAt: record.createdAt,
  };
}

/** Normaliza a data para "YYYY-MM-DD" (aceita strings ISO completas). */
function normalizeDate(date: string): string {
  return String(date).slice(0, 10);
}

/**
 * Verificação de sobreposição de horários — mesma semântica do SQL original
 * (`start_time < fim AND end_time > início`): intervalos adjacentes NÃO
 * conflitam. Função síncrona de propósito: é usada dentro de pares
 * "verificar → gravar" que precisam ser atômicos.
 */
function hasBookingConflict(
  store: StoreData,
  roomId: number,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: number,
): boolean {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  return store.bookings.some(
    (booking) =>
      booking.roomId === roomId &&
      booking.date === date &&
      (excludeBookingId === undefined || booking.id !== excludeBookingId) &&
      timeToMinutes(booking.startTime) < end &&
      timeToMinutes(booking.endTime) > start,
  );
}

// ---------------------------------------------------------------------------
// Salas
// ---------------------------------------------------------------------------

/**
 * Cria uma sala. A verificação de nome duplicado e a inserção em memória são
 * síncronas (sem await entre elas) — equivalente à restrição UNIQUE original.
 *
 * @throws {DuplicateRoomError} se já existir sala com o mesmo nome.
 */
export async function createRoom(
  room: Omit<Room, "id" | "createdAt">,
): Promise<Room> {
  const store = getStore();

  assertRoomNameAvailable(room.name);

  const record: RoomRecord = {
    id: allocateId("rooms"),
    name: room.name,
    capacity: room.capacity,
    createdAt: new Date().toISOString(),
  };
  store.rooms.push(record);

  await persistStore();
  return mapRoom(record);
}

/** Exclui a sala e, em cascata, todos os agendamentos dela. */
export async function deleteRoom(roomId: string): Promise<boolean> {
  const store = getStore();
  const id = Number(roomId);

  const index = store.rooms.findIndex((room) => room.id === id);
  if (index === -1) return false;

  // Exclui os agendamentos desta sala primeiro (cascata)
  store.bookings = store.bookings.filter((booking) => booking.roomId !== id);
  store.rooms.splice(index, 1);

  await persistStore();
  return true;
}

export async function getRooms(): Promise<Room[]> {
  const store = getStore();
  return [...store.rooms]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(mapRoom);
}

export async function getRoomById(id: string): Promise<Room | null> {
  const store = getStore();
  const record = store.rooms.find((room) => room.id === Number(id));
  return record ? mapRoom(record) : null;
}

/**
 * Atualiza nome/capacidade da sala.
 *
 * @throws {DuplicateRoomError} se o novo nome já pertencer a outra sala.
 */
export async function updateRoomById(
  id: string,
  updates: {
    name?: string;
    capacity?: number;
  },
): Promise<Room> {
  const store = getStore();
  const record = store.rooms.find((room) => room.id === Number(id));
  if (!record) {
    throw new Error(`Room with ID ${id} not found`);
  }

  const updateName = updates.name ?? record.name;
  const updateCapacity = updates.capacity ?? record.capacity;

  // Verificação + mutação síncronas (sem await entre elas)
  assertRoomNameAvailable(updateName, record.id);
  record.name = updateName;
  record.capacity = updateCapacity;

  await persistStore();
  return mapRoom(record);
}

// ---------------------------------------------------------------------------
// Agendamentos
// ---------------------------------------------------------------------------

/**
 * Cria um agendamento de forma atômica: a verificação de conflito e a inserção
 * em memória acontecem de forma síncrona (sem await entre elas), o que — com o
 * Node single-threaded — dá a mesma garantia contra reservas duplicadas que a
 * transação SELECT ... FOR UPDATE dava no banco original.
 *
 * @throws {BookingConflictError} se o horário já estiver reservado.
 */
export async function createBooking(
  booking: Omit<Booking, "id" | "createdAt">,
): Promise<Booking> {
  const store = getStore();

  const roomId = Number(booking.roomId);
  const date = normalizeDate(booking.date);
  const startTime = normalizeTimeToHHMM(booking.startTime);
  const endTime = normalizeTimeToHHMM(booking.endTime);

  if (hasBookingConflict(store, roomId, date, startTime, endTime)) {
    throw new BookingConflictError();
  }

  const record: BookingRecord = {
    id: allocateId("bookings"),
    roomId,
    roomName: booking.roomName,
    clientName: booking.clientName,
    clientEmail: booking.clientEmail,
    date,
    startTime,
    endTime,
    createdAt: new Date().toISOString(),
  };
  store.bookings.push(record);

  await persistStore();
  return mapBooking(record);
}

export async function getBookings(): Promise<Booking[]> {
  const store = getStore();
  return [...store.bookings]
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    )
    .map(mapBooking);
}

export async function getBookingsByRoom(roomId: string): Promise<Booking[]> {
  const store = getStore();
  const id = Number(roomId);
  return store.bookings
    .filter((booking) => booking.roomId === id)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
    )
    .map(mapBooking);
}

/**
 * Verifica se já existe agendamento conflitante para a sala/data/horário.
 * `excludeBookingId` permite ignorar o próprio agendamento em atualizações.
 */
export async function bookingExists(
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId?: string,
): Promise<boolean> {
  const store = getStore();
  const exclude =
    excludeBookingId !== undefined && excludeBookingId !== null
      ? Number(excludeBookingId)
      : undefined;

  return hasBookingConflict(
    store,
    Number(roomId),
    normalizeDate(date),
    normalizeTimeToHHMM(startTime),
    normalizeTimeToHHMM(endTime),
    exclude,
  );
}

export async function getBookingById(id: string): Promise<Booking | null> {
  const store = getStore();
  const record = store.bookings.find((booking) => booking.id === Number(id));
  return record ? mapBooking(record) : null;
}

export async function updateBookingById(
  id: string,
  updates: {
    clientName?: string;
    clientEmail?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    roomId?: string;
    roomName?: string;
  },
): Promise<Booking> {
  const store = getStore();
  const record = store.bookings.find((booking) => booking.id === Number(id));
  if (!record) {
    throw new Error(`Booking with ID ${id} not found`);
  }

  // Se a sala mudou e o nome não foi informado, busca o nome atualizado da sala
  let roomName = updates.roomName;
  if (
    !roomName &&
    updates.roomId &&
    String(updates.roomId) !== String(record.roomId)
  ) {
    const room = store.rooms.find((r) => r.id === Number(updates.roomId));
    if (!room) {
      throw new Error(`Room with ID ${updates.roomId} not found`);
    }
    roomName = room.name;
  }

  let changed = false;

  if (updates.clientName) {
    record.clientName = updates.clientName;
    changed = true;
  }
  if (updates.clientEmail) {
    record.clientEmail = updates.clientEmail;
    changed = true;
  }
  if (updates.date) {
    record.date = normalizeDate(updates.date);
    changed = true;
  }
  if (updates.startTime) {
    record.startTime = normalizeTimeToHHMM(updates.startTime);
    changed = true;
  }
  if (updates.endTime) {
    record.endTime = normalizeTimeToHHMM(updates.endTime);
    changed = true;
  }
  if (updates.roomId) {
    record.roomId = Number(updates.roomId);
    changed = true;
  }
  if (roomName) {
    record.roomName = roomName;
    changed = true;
  }

  if (!changed) {
    return mapBooking(record);
  }

  await persistStore();
  return mapBooking(record);
}

export async function deleteBookingById(id: string): Promise<boolean> {
  const store = getStore();
  const index = store.bookings.findIndex(
    (booking) => booking.id === Number(id),
  );
  if (index === -1) return false;

  store.bookings.splice(index, 1);
  await persistStore();
  return true;
}
