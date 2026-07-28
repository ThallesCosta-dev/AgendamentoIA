import {
  EmailLogRecord,
  EmailResponseRecord,
  allocateId,
  getStore,
  persistStore,
} from "../store";

/** Mantém apenas os N registros de email mais recentes no armazenamento. */
const MAX_EMAIL_LOGS = 1000;

/**
 * Erro tipado para email já registrado (email_id é único). Permite ao
 * processador detectar re-processamento de um email já respondido
 * (ex.: quando a marcação \Seen falhou) e NÃO responder de novo.
 */
export class DuplicateEmailLogError extends Error {
  constructor(emailId: string) {
    super(`Já existe um registro de processamento para o email "${emailId}"`);
    this.name = "DuplicateEmailLogError";
  }
}

export interface EmailLogData {
  emailId: string;
  senderEmail: string;
  subject?: string;
  receivedAt: Date;
  processedAt?: Date;
  classification: "INFORMATION_REQUEST" | "BOOKING_REQUEST" | "UNCLEAR";
  confidence?: number;
  extractedData?: any;
  actionTaken: "PROCESSED_BOOKING" | "SENT_RESPONSE" | "FAILED";
  bookingId?: string;
  processingTime?: number;
}

export interface EmailResponseData {
  emailLogId: number;
  responseType: "INFORMATION" | "INCOMPLETE_BOOKING" | "CONFIRMATION" | "ERROR";
  responseContent: string;
  successfullySent?: boolean;
  errorMessage?: string;
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function logEmailProcessing(data: EmailLogData): Promise<number> {
  const store = getStore();

  // email_id era UNIQUE no armazenamento original — mantém a mesma garantia.
  // Verificação e inserção síncronas (sem await entre elas).
  if (store.emailLogs.some((log) => log.emailId === data.emailId)) {
    throw new DuplicateEmailLogError(data.emailId);
  }

  const record: EmailLogRecord = {
    id: allocateId("emailLogs"),
    emailId: data.emailId,
    senderEmail: data.senderEmail,
    subject: data.subject || null,
    receivedAt: toIsoString(data.receivedAt),
    processedAt: data.processedAt ? toIsoString(data.processedAt) : null,
    classification: data.classification,
    confidence: data.confidence ?? null,
    extractedData: data.extractedData ?? null,
    actionTaken: data.actionTaken,
    bookingId: data.bookingId || null,
    processingTimeMs: data.processingTime ?? null,
    createdAt: new Date().toISOString(),
  };
  store.emailLogs.push(record);

  // Poda: mantém apenas os 1000 registros mais recentes (e remove as
  // respostas associadas aos registros descartados).
  if (store.emailLogs.length > MAX_EMAIL_LOGS) {
    const removed = store.emailLogs.splice(
      0,
      store.emailLogs.length - MAX_EMAIL_LOGS,
    );
    const removedIds = new Set(removed.map((log) => log.id));
    store.emailResponses = store.emailResponses.filter(
      (response) => !removedIds.has(response.emailLogId),
    );
  }

  await persistStore();
  return record.id;
}

export interface EmailLogUpdate {
  processedAt?: Date;
  classification?: "INFORMATION_REQUEST" | "BOOKING_REQUEST" | "UNCLEAR";
  confidence?: number;
  extractedData?: any;
  actionTaken?: "PROCESSED_BOOKING" | "SENT_RESPONSE" | "FAILED";
  bookingId?: string;
  processingTime?: number;
}

/**
 * Atualiza um registro existente de email (email_id é único — a segunda
 * escrita do processamento deve ser uma atualização, nunca um novo registro).
 */
export async function updateEmailLog(
  emailLogId: number,
  updates: EmailLogUpdate,
): Promise<void> {
  const store = getStore();
  const record = store.emailLogs.find((log) => log.id === emailLogId);
  if (!record) return;

  let changed = false;

  if (updates.processedAt !== undefined) {
    record.processedAt = toIsoString(updates.processedAt);
    changed = true;
  }
  if (updates.classification !== undefined) {
    record.classification = updates.classification;
    changed = true;
  }
  if (updates.confidence !== undefined) {
    record.confidence = updates.confidence;
    changed = true;
  }
  if (updates.extractedData !== undefined) {
    record.extractedData = updates.extractedData ?? null;
    changed = true;
  }
  if (updates.actionTaken !== undefined) {
    record.actionTaken = updates.actionTaken;
    changed = true;
  }
  if (updates.bookingId !== undefined) {
    record.bookingId = updates.bookingId;
    changed = true;
  }
  if (updates.processingTime !== undefined) {
    record.processingTimeMs = updates.processingTime;
    changed = true;
  }

  if (!changed) return;

  await persistStore();
}

export async function logEmailResponse(
  data: EmailResponseData,
): Promise<number> {
  const store = getStore();

  const record: EmailResponseRecord = {
    id: allocateId("emailResponses"),
    emailLogId: data.emailLogId,
    responseType: data.responseType,
    responseContent: data.responseContent,
    sentAt: new Date().toISOString(),
    successfullySent:
      data.successfullySent !== undefined ? data.successfullySent : true,
    errorMessage: data.errorMessage || null,
  };
  store.emailResponses.push(record);

  await persistStore();
  return record.id;
}

/**
 * Estatísticas de processamento agrupadas por classificação + ação, no mesmo
 * formato de linhas que a consulta agregada original retornava.
 */
export async function getEmailProcessingStats(days: number = 7) {
  const store = getStore();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  interface StatsAccumulator {
    classification: string;
    action_taken: string;
    count: number;
    confidenceSum: number;
    confidenceCount: number;
    timeSum: number;
    timeCount: number;
  }

  const groups = new Map<string, StatsAccumulator>();

  for (const log of store.emailLogs) {
    if (new Date(log.createdAt).getTime() < cutoff) continue;

    const key = `${log.classification}|${log.actionTaken}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        classification: log.classification,
        action_taken: log.actionTaken,
        count: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        timeSum: 0,
        timeCount: 0,
      };
      groups.set(key, group);
    }

    group.count += 1;
    if (log.confidence !== null && log.confidence !== undefined) {
      group.confidenceSum += Number(log.confidence);
      group.confidenceCount += 1;
    }
    if (log.processingTimeMs !== null && log.processingTimeMs !== undefined) {
      group.timeSum += Number(log.processingTimeMs);
      group.timeCount += 1;
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      classification: group.classification,
      action_taken: group.action_taken,
      count: group.count,
      avg_confidence:
        group.confidenceCount > 0
          ? group.confidenceSum / group.confidenceCount
          : null,
      avg_processing_time:
        group.timeCount > 0 ? group.timeSum / group.timeCount : null,
    }))
    .sort((a, b) => b.count - a.count);
}

/** Linha no formato snake_case que as rotas de logs retornavam originalmente. */
function mapLogRow(log: EmailLogRecord) {
  return {
    id: log.id,
    email_id: log.emailId,
    sender_email: log.senderEmail,
    subject: log.subject,
    received_at: log.receivedAt,
    processed_at: log.processedAt,
    classification: log.classification,
    confidence: log.confidence,
    action_taken: log.actionTaken,
    booking_id: log.bookingId,
    processing_time_ms: log.processingTimeMs,
    created_at: log.createdAt,
  };
}

export async function getEmailLogsByDateRange(startDate: Date, endDate: Date) {
  const store = getStore();
  const start = startDate.getTime();
  const end = endDate.getTime();

  return store.emailLogs
    .filter((log) => {
      const receivedAt = new Date(log.receivedAt).getTime();
      return receivedAt >= start && receivedAt <= end;
    })
    .sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    )
    .map((log) => ({
      ...mapLogRow(log),
      extracted_data: log.extractedData ?? null,
      extractedData: log.extractedData ?? null,
    }));
}

export async function getRecentEmailLogs(limit: number = 50) {
  const safeLimit = Math.min(
    500,
    Math.max(1, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 50),
  );

  const store = getStore();

  return [...store.emailLogs]
    .sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime(),
    )
    .slice(0, safeLimit)
    .map(mapLogRow);
}

export function createEmailLogger(context: string) {
  return {
    info: (message: string, data?: any) => {
      console.log(`[EmailProcessor:${context}] ${message}`, data || "");
    },
    error: (message: string, error?: any) => {
      console.error(`[EmailProcessor:${context}] ${message}`, error || "");
    },
    warn: (message: string, data?: any) => {
      console.warn(`[EmailProcessor:${context}] ${message}`, data || "");
    },
    debug: (message: string, data?: any) => {
      if (process.env.NODE_ENV === "development") {
        console.log(`[EmailProcessor:${context}:DEBUG] ${message}`, data || "");
      }
    },
  };
}
