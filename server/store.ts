/**
 * Armazenamento de dados em arquivo JSON — sem servidor de banco de dados.
 *
 * Todos os dados vivem em memória (objeto `data`) e são gravados em
 * `DATA_DIR/db.json` após cada mutação, com escrita atômica (arquivo
 * temporário + rename) serializada por uma fila de promises.
 *
 * REGRA DE CONCORRÊNCIA: como o Node é single-threaded, qualquer par
 * "verificar → gravar" (conflito de agendamento, nome de sala duplicado)
 * permanece atômico DESDE QUE não haja `await` entre a verificação e a
 * mutação em memória. As funções da camada de dados seguem essa regra e
 * só aguardam a persistência DEPOIS de mutar o estado.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Tipos dos registros persistidos
// ---------------------------------------------------------------------------

export type EmailClassification =
  | "INFORMATION_REQUEST"
  | "BOOKING_REQUEST"
  | "UNCLEAR";

export type EmailActionTaken = "PROCESSED_BOOKING" | "SENT_RESPONSE" | "FAILED";

export type EmailResponseType =
  | "INFORMATION"
  | "INCOMPLETE_BOOKING"
  | "CONFIRMATION"
  | "ERROR";

export interface RoomRecord {
  id: number;
  name: string;
  capacity: number;
  /** ISO date string */
  createdAt: string;
}

export interface BookingRecord {
  id: number;
  roomId: number;
  roomName: string;
  clientName: string;
  clientEmail: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  startTime: string;
  /** "HH:MM" */
  endTime: string;
  /** ISO date string */
  createdAt: string;
}

export interface EmailLogRecord {
  id: number;
  emailId: string;
  senderEmail: string;
  subject: string | null;
  /** ISO date string */
  receivedAt: string;
  /** ISO date string */
  processedAt: string | null;
  classification: EmailClassification;
  confidence: number | null;
  extractedData: unknown;
  actionTaken: EmailActionTaken;
  bookingId: string | null;
  processingTimeMs: number | null;
  /** ISO date string */
  createdAt: string;
}

export interface EmailResponseRecord {
  id: number;
  emailLogId: number;
  responseType: EmailResponseType;
  responseContent: string;
  /** ISO date string */
  sentAt: string;
  successfullySent: boolean;
  errorMessage: string | null;
}

export interface StoreData {
  rooms: RoomRecord[];
  bookings: BookingRecord[];
  emailLogs: EmailLogRecord[];
  emailResponses: EmailResponseRecord[];
  nextIds: {
    rooms: number;
    bookings: number;
    emailLogs: number;
    emailResponses: number;
  };
}

/** Erro lançado ao tentar criar/renomear uma sala com nome já existente. */
export class DuplicateRoomError extends Error {
  constructor(message = "Já existe uma sala com esse nome") {
    super(message);
    this.name = "DuplicateRoomError";
  }
}

// ---------------------------------------------------------------------------
// Estado do módulo
// ---------------------------------------------------------------------------

const DB_FILE_NAME = "db.json";

const DEFAULT_ROOMS: Array<{ name: string; capacity: number }> = [
  { name: "Sala 101", capacity: 30 },
  { name: "Auditório Principal", capacity: 100 },
  { name: "Sala de Conferência A", capacity: 20 },
];

let data: StoreData | null = null;
let dbFilePath: string | null = null;
let writeQueue: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// Inicialização e carga do arquivo
// ---------------------------------------------------------------------------

function resolveDataDir(): string {
  if (process.env.DATA_DIR) {
    return path.resolve(process.cwd(), process.env.DATA_DIR);
  }

  // Em ambientes serverless (Netlify/Lambda) o diretório do projeto é somente
  // leitura — usa o diretório temporário (armazenamento EFÊMERO: os dados não
  // sobrevivem entre instâncias da função).
  if (process.env.LAMBDA_TASK_ROOT || process.env.NETLIFY) {
    return path.join(os.tmpdir(), "salaagenda-data");
  }

  return path.resolve(process.cwd(), "data");
}

function seedStore(): StoreData {
  const now = new Date().toISOString();
  return {
    rooms: DEFAULT_ROOMS.map((room, index) => ({
      id: index + 1,
      name: room.name,
      capacity: room.capacity,
      createdAt: now,
    })),
    bookings: [],
    emailLogs: [],
    emailResponses: [],
    nextIds: {
      rooms: DEFAULT_ROOMS.length + 1,
      bookings: 1,
      emailLogs: 1,
      emailResponses: 1,
    },
  };
}

function isValidStore(value: unknown): value is StoreData {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.rooms) &&
    Array.isArray(candidate.bookings) &&
    Array.isArray(candidate.emailLogs) &&
    Array.isArray(candidate.emailResponses) &&
    typeof candidate.nextIds === "object" &&
    candidate.nextIds !== null
  );
}

/** Garante que os contadores de id fiquem sempre à frente dos ids existentes. */
function reconcileNextIds(store: StoreData): void {
  const collections: Array<
    [keyof StoreData["nextIds"], Array<{ id: number }>]
  > = [
    ["rooms", store.rooms],
    ["bookings", store.bookings],
    ["emailLogs", store.emailLogs],
    ["emailResponses", store.emailResponses],
  ];

  for (const [key, records] of collections) {
    const maxId = records.reduce(
      (max, record) => (Number(record.id) > max ? Number(record.id) : max),
      0,
    );
    const current = Number(store.nextIds[key]);
    store.nextIds[key] = Math.max(
      Number.isInteger(current) && current > 0 ? current : 1,
      maxId + 1,
    );
  }
}

/** Renomeia um db.json ilegível para db.json.corrupt-<n> (sem sobrescrever). */
function backupCorruptFile(filePath: string): string {
  let n = 1;
  let target = `${filePath}.corrupt-${n}`;
  while (fs.existsSync(target)) {
    n += 1;
    target = `${filePath}.corrupt-${n}`;
  }
  fs.renameSync(filePath, target);
  return target;
}

/** Escrita atômica síncrona (usada apenas na inicialização/seed). */
function writeStoreFileSync(filePath: string, store: StoreData): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

function loadFromDiskSync(): void {
  const dataDir = resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  dbFilePath = path.join(dataDir, DB_FILE_NAME);

  if (fs.existsSync(dbFilePath)) {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(dbFilePath, "utf8"));
      if (!isValidStore(parsed)) {
        throw new Error("Estrutura do arquivo de dados inválida");
      }
      data = parsed;
      reconcileNextIds(data);
      return;
    } catch (error) {
      // Arquivo corrompido: preserva uma cópia e recomeça do zero em vez de
      // derrubar a aplicação.
      const backupPath = backupCorruptFile(dbFilePath);
      console.error(
        `⚠️ Arquivo de dados corrompido — cópia preservada em ${backupPath}. Iniciando com dados novos.`,
        error,
      );
    }
  }

  data = seedStore();
  writeStoreFileSync(dbFilePath, data);
  console.log("Default rooms created");
}

/**
 * Inicializa (ou reinicializa) o armazenamento: cria o diretório de dados,
 * carrega o db.json existente ou cria um novo com as salas padrão.
 * Chamadas repetidas recarregam o estado a partir do disco (aguardando
 * gravações pendentes antes).
 */
export async function initializeStore(): Promise<void> {
  await writeQueue.catch(() => {
    // Falhas de gravações anteriores já foram propagadas aos chamadores.
  });
  loadFromDiskSync();
}

/**
 * Acesso ao estado em memória. Se o armazenamento ainda não foi inicializado,
 * carrega de forma síncrona (não introduz await entre verificação e mutação).
 */
export function getStore(): StoreData {
  if (!data) {
    loadFromDiskSync();
  }
  return data!;
}

// ---------------------------------------------------------------------------
// Mutação e persistência
// ---------------------------------------------------------------------------

/** Aloca o próximo id inteiro auto-incremental da coleção. */
export function allocateId(collection: keyof StoreData["nextIds"]): number {
  const store = getStore();
  const id = store.nextIds[collection];
  store.nextIds[collection] = id + 1;
  return id;
}

/**
 * Garante que não exista outra sala com o mesmo nome (comparação
 * case-insensitive, como a restrição UNIQUE original).
 *
 * @throws {DuplicateRoomError} se o nome já estiver em uso.
 */
export function assertRoomNameAvailable(
  name: string,
  excludeRoomId?: number,
): void {
  const store = getStore();
  const normalized = name.trim().toLowerCase();
  const duplicate = store.rooms.some(
    (room) =>
      room.id !== excludeRoomId &&
      room.name.trim().toLowerCase() === normalized,
  );
  if (duplicate) {
    throw new DuplicateRoomError();
  }
}

/**
 * Persiste o estado atual em disco de forma atômica: serializa AGORA
 * (capturando o estado no momento da mutação), grava em db.json.tmp e
 * renomeia por cima de db.json. As escritas são serializadas por uma fila
 * de promises — nunca há duas gravações simultâneas no mesmo arquivo.
 */
export function persistStore(): Promise<void> {
  const snapshot = JSON.stringify(getStore(), null, 2);
  const filePath = dbFilePath!;

  const run = async () => {
    const tmpPath = `${filePath}.tmp`;
    await fs.promises.writeFile(tmpPath, snapshot, "utf8");
    await fs.promises.rename(tmpPath, filePath);
  };

  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => {
    // Mantém a fila viva mesmo se uma gravação falhar; o erro é propagado
    // ao chamador que aguardou `persistStore()`.
  });
  return next;
}
