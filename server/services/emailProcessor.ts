import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import * as cron from "node-cron";
import { Booking } from "@shared/api";
import { getRooms, createBooking, BookingConflictError } from "../data";
import {
  validateDate,
  validateTime,
  validateTimeRange,
  validateInstitutionalEmail,
  institutionalEmailErrorMessage,
  maskEmail,
} from "../utils/validation";
import { classifyEmail } from "./emailClassifier";
import {
  sendEmailResponse,
  generateInformationRequestResponse,
  generateIncompleteBookingResponse,
  generateBookingConfirmationResponse,
  generateErrorResponse
} from "./emailResponder";
import {
  logEmailProcessing,
  updateEmailLog,
  DuplicateEmailLogError,
} from "../utils/emailLogger";
import { createEmailLogger } from "../utils/emailLogger";
import { getSenderEmail } from "./mailTransport";

const logger = createEmailLogger("EmailProcessor");

interface EmailProcessingConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  folder: string;
  checkIntervalMinutes: number;
  enabled: boolean;
  allowSelfSignedTls: boolean;
}

export interface RawEmailData {
  uid: string;
  messageId: string;
  from: string;
  subject: string;
  date: Date;
  text: string;
  html?: string;
}

type BookingCreationResult =
  | { status: "created"; booking: Booking }
  | { status: "conflict" }
  | { status: "invalid"; reason: string };

export interface ProcessCycleResult {
  /** false quando o ciclo foi pulado (outro ciclo em andamento). */
  ran: boolean;
  /** false quando o ciclo executou mas terminou com erro. */
  ok: boolean;
  /** Mensagem do erro quando ok === false. */
  error?: string;
}

class EmailProcessor {
  private config: EmailProcessingConfig;
  private imap: Imap | null = null;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;
  private isProcessingCycle: boolean = false;

  constructor(config: EmailProcessingConfig) {
    this.config = config;
  }

  public async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info("Email processing is disabled in configuration");
      return;
    }

    if (this.isRunning) {
      logger.warn("Email processor is already running");
      return;
    }

    try {
      logger.info("Starting email processor", {
        host: this.config.host,
        folder: this.config.folder,
        interval: `${this.config.checkIntervalMinutes} minutes`
      });

      // Test connection first
      await this.testConnection();

      // Start cron job — o callback é envolvido para que rejeições nunca
      // escapem como unhandled rejection
      this.cronJob = cron.schedule(
        `*/${this.config.checkIntervalMinutes} * * * *`,
        () => {
          this.processEmails().catch((error) => {
            logger.error("Unhandled error in scheduled email processing", error);
          });
        }
      );

      this.cronJob.start();
      this.isRunning = true;

      // Process emails immediately on startup
      await this.processEmails();

      logger.info("Email processor started successfully");
    } catch (error) {
      logger.error("Failed to start email processor", error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping email processor");

    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    if (this.imap) {
      await this.disconnectImap();
    }

    this.isRunning = false;
    logger.info("Email processor stopped");
  }

  public getStatus() {
    return {
      running: this.isRunning,
      config: {
        enabled: this.config.enabled,
        host: this.config.host,
        folder: this.config.folder,
        interval: `${this.config.checkIntervalMinutes} minutes`
      }
    };
  }

  /**
   * Dispara um ciclo de processamento imediatamente (uso pela rota
   * /api/email-processor/manual-process). Retorna se o ciclo executou
   * (ran), se terminou sem erro (ok) e a mensagem de erro quando falhou.
   */
  public async processNow(): Promise<ProcessCycleResult> {
    return this.processEmails();
  }

  private buildImapOptions() {
    return {
      user: this.config.user,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      tls: true,
      // Certificados são validados por padrão; a validação só é desligada
      // explicitamente via IOC_EMAIL_ALLOW_SELF_SIGNED=true
      tlsOptions: { rejectUnauthorized: !this.config.allowSelfSignedTls }
    };
  }

  private async testConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const testImap = new Imap(this.buildImapOptions());

      const timeout = setTimeout(() => {
        testImap.end();
        reject(new Error("Connection test timeout"));
      }, 30000);

      testImap.once("ready", () => {
        clearTimeout(timeout);
        testImap.end();
        resolve();
      });

      testImap.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      testImap.connect();
    });
  }

  private async connectImap(): Promise<Imap> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.buildImapOptions());

      const timeout = setTimeout(() => {
        imap.end();
        reject(new Error("IMAP connection timeout"));
      }, 60000);

      imap.once("ready", () => {
        clearTimeout(timeout);
        resolve(imap);
      });

      imap.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      imap.connect();
    });
  }

  private async disconnectImap(): Promise<void> {
    const imap = this.imap;
    if (!imap) return;
    this.imap = null;

    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      // Nunca fica pendurado: encerra após no máximo 10s
      const timeout = setTimeout(() => {
        logger.warn("IMAP disconnect timed out — continuing anyway");
        finish();
      }, 10000);

      imap.once("close", finish);
      imap.once("end", finish);

      try {
        imap.end();
      } catch (error) {
        logger.error("Error while closing IMAP connection", error);
        finish();
      }
    });
  }

  private async processEmails(): Promise<ProcessCycleResult> {
    // Guarda de reentrância: pula o ciclo se o anterior ainda está rodando
    if (this.isProcessingCycle) {
      logger.warn("Previous email processing cycle still running — skipping");
      return { ran: false, ok: true };
    }

    this.isProcessingCycle = true;
    const startTime = Date.now();

    try {
      this.imap = await this.connectImap();

      const { emails, skippedUids } = await this.fetchUnreadEmails();
      logger.info(`Found ${emails.length} unread emails to process`);

      // Emails pulados (auto-gerados/próprio endereço) também são marcados
      // como lidos — senão seriam rebuscados a cada ciclo. NUNCA respondê-los.
      for (const uid of skippedUids) {
        await this.markEmailAsRead(uid);
      }

      for (const emailData of emails) {
        await this.processSingleEmail(emailData);
        // Small delay between processing emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      await this.disconnectImap();

      const processingTime = Date.now() - startTime;
      logger.info(`Email processing cycle completed`, {
        emailsProcessed: emails.length,
        processingTimeMs: processingTime
      });
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error("Email processing cycle failed", {
        error,
        processingTimeMs: processingTime
      });

      if (this.imap) {
        try {
          await this.disconnectImap();
        } catch (disconnectError) {
          logger.error("Failed to disconnect IMAP after error", disconnectError);
        }
      }

      return {
        ran: true,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      this.isProcessingCycle = false;
    }

    return { ran: true, ok: true };
  }

  /**
   * Busca os emails não lidos. Cada mensagem gera uma promise própria e o
   * resultado só resolve após TODAS as mensagens terem sido baixadas e
   * parseadas (corrige o bug em que o "end" do fetch externo resolvia antes
   * dos corpos chegarem, retornando uma lista vazia/parcial).
   * Também retorna os UIDs dos emails pulados (auto-gerados/próprio
   * endereço), para que o chamador possa marcá-los como lidos.
   */
  private async fetchUnreadEmails(): Promise<{
    emails: RawEmailData[];
    skippedUids: string[];
  }> {
    return new Promise((resolve, reject) => {
      this.imap!.openBox(this.config.folder, false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        // imap.search (não-seq) retorna UIDs reais
        this.imap!.search(["UNSEEN"], (searchErr, results) => {
          if (searchErr) {
            reject(searchErr);
            return;
          }

          if (!results || results.length === 0) {
            resolve({ emails: [], skippedUids: [] });
            return;
          }

          const emails: RawEmailData[] = [];
          const skippedUids: string[] = [];
          const messagePromises: Promise<void>[] = [];

          const fetch = this.imap!.fetch(results, {
            bodies: "",
            struct: true
          });

          fetch.on("message", (msg) => {
            const messagePromise = new Promise<void>((resolveMessage) => {
              let uid: number | null = null;
              let bodyPromise: Promise<Buffer> = Promise.resolve(
                Buffer.alloc(0)
              );

              msg.once("attributes", (attrs) => {
                uid = attrs.uid;
              });

              msg.on("body", (stream) => {
                bodyPromise = new Promise<Buffer>((resolveBody) => {
                  const chunks: Buffer[] = [];
                  stream.on("data", (chunk: Buffer) => {
                    chunks.push(chunk);
                  });
                  stream.once("end", () => resolveBody(Buffer.concat(chunks)));
                  stream.once("error", () =>
                    resolveBody(Buffer.concat(chunks))
                  );
                });
              });

              msg.once("end", async () => {
                try {
                  const raw = await bodyPromise;
                  const parsed = await simpleParser(raw);

                  if (this.shouldSkipEmail(parsed)) {
                    // Não loga assunto/remetente (PII) — apenas o UID
                    logger.info("Skipping auto-generated or own email", {
                      uid
                    });
                    if (uid !== null) {
                      skippedUids.push(String(uid));
                    }
                  } else {
                    emails.push({
                      uid: uid !== null ? String(uid) : "",
                      messageId:
                        parsed.messageId || `msg-${Date.now()}-${uid ?? "?"}`,
                      from: this.extractEmailAddress(parsed.from?.text || ""),
                      subject: parsed.subject || "",
                      date: parsed.date || new Date(),
                      text: parsed.text || "",
                      html:
                        typeof parsed.html === "string"
                          ? parsed.html
                          : undefined
                    });
                  }
                } catch (parseError) {
                  logger.error("Failed to parse email", {
                    uid,
                    error: parseError
                  });
                }
                resolveMessage();
              });
            });

            messagePromises.push(messagePromise);
          });

          fetch.once("error", (fetchErr) => {
            reject(fetchErr);
          });

          fetch.once("end", () => {
            // Aguarda todas as mensagens serem baixadas/parseadas
            Promise.all(messagePromises)
              .then(() => resolve({ emails, skippedUids }))
              .catch((error) => reject(error));
          });
        });
      });
    });
  }

  /**
   * Evita loops de auto-resposta: ignora mensagens automáticas
   * (Auto-Submitted, Precedence: bulk/junk, List-Id) e mensagens enviadas
   * pelo nosso próprio endereço.
   */
  private shouldSkipEmail(parsed: ParsedMail): boolean {
    const headerValue = (name: string): string => {
      const value = parsed.headers?.get?.(name);
      if (value === undefined || value === null) return "";
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return value.join(" ");
      if (typeof value === "object" && "value" in (value as any)) {
        return String((value as any).value ?? "");
      }
      return String(value);
    };

    const autoSubmitted = headerValue("auto-submitted").toLowerCase();
    if (autoSubmitted && autoSubmitted !== "no") return true;

    const precedence = headerValue("precedence").toLowerCase();
    if (
      precedence.includes("bulk") ||
      precedence.includes("junk") ||
      precedence.includes("auto_reply") ||
      precedence.includes("list")
    ) {
      return true;
    }

    if (headerValue("list-id")) return true;

    const from = this.extractEmailAddress(
      parsed.from?.text || ""
    ).toLowerCase();
    const ownAddresses = [
      getSenderEmail(),
      process.env.SMTP_USER,
      process.env.EMAIL_USER,
      this.config.user,
    ]
      .filter(Boolean)
      .map((a) => String(a).toLowerCase());
    if (from && ownAddresses.includes(from)) return true;

    return false;
  }

  private extractEmailAddress(fromHeader: string): string {
    // Extract email address from "Name <email@domain.com>" format
    const match = fromHeader.match(/<([^>]+)>/);
    return match ? match[1] : fromHeader.trim();
  }

  private async processSingleEmail(emailData: RawEmailData): Promise<void> {
    const processingStartTime = Date.now();
    let emailLogId: number | null = null;

    try {
      logger.info("Processing email", {
        messageId: emailData.messageId,
        from: maskEmail(emailData.from)
      });

      // Validate sender email
      if (!emailData.from || !this.isValidEmail(emailData.from)) {
        logger.warn("Invalid sender email — skipping");
        return;
      }

      // Classify email
      const classification = classifyEmail(emailData.text, emailData.subject, emailData.from);

      // Log email processing
      try {
        emailLogId = await logEmailProcessing({
          emailId: emailData.messageId,
          senderEmail: emailData.from,
          subject: emailData.subject,
          receivedAt: emailData.date,
          processedAt: new Date(),
          classification: classification.type,
          confidence: classification.confidence,
          extractedData: classification.extractedData,
          actionTaken: "SENT_RESPONSE",
          processingTime: 0 // Will be updated at the end
        });
      } catch (logError) {
        if (logError instanceof DuplicateEmailLogError) {
          // Email já processado em um ciclo anterior (a marcação \Seen deve
          // ter falhado). NÃO responder de novo — apenas remarcar como lido.
          logger.warn(
            "Email already processed before — skipping response and re-marking as read",
            { messageId: emailData.messageId }
          );
          await this.markEmailAsRead(emailData.uid);
          return;
        }
        logger.error("Failed to log email processing", logError);
      }

      // Process based on classification
      let responseSent = false;

      if (classification.type === "INFORMATION_REQUEST") {
        const responseData = await generateInformationRequestResponse(
          emailData.from,
          emailData.subject
        );
        responseSent = await sendEmailResponse(responseData, emailLogId || undefined);

      } else if (classification.type === "BOOKING_REQUEST") {
        if (classification.missingFields.length === 0) {
          // Complete booking request - try to create booking
          const result = await this.createBookingFromExtractedData(
            classification.extractedData,
            emailData.from
          );

          if (result.status === "created") {
            // Atualiza o registro existente (email_id é UNIQUE — não inserir de novo)
            if (emailLogId) {
              try {
                await updateEmailLog(emailLogId, {
                  actionTaken: "PROCESSED_BOOKING",
                  bookingId: result.booking.id
                });
              } catch (logError) {
                logger.error("Failed to update email log", logError);
              }
            }

            const responseData = await generateBookingConfirmationResponse(
              emailData.from,
              result.booking,
              emailData.subject
            );
            responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
          } else if (result.status === "conflict") {
            // Sala indisponível — envia o template de indisponibilidade
            const responseData = await generateErrorResponse(
              emailData.from,
              "A sala solicitada não está disponível no horário desejado. Por favor, escolha outro horário ou outra sala e envie uma nova solicitação.",
              emailData.subject
            );
            responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
          } else {
            // Dados inválidos
            const responseData = await generateErrorResponse(
              emailData.from,
              result.reason,
              emailData.subject
            );
            responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
          }
        } else {
          // Incomplete booking request
          const responseData = await generateIncompleteBookingResponse(
            emailData.from,
            classification.extractedData,
            classification.missingFields,
            emailData.subject
          );
          responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
        }
      } else {
        // Unclear classification - send general information response
        const responseData = await generateInformationRequestResponse(
          emailData.from,
          emailData.subject
        );
        responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
      }

      // Mark email as read if response was sent successfully.
      // Falha ao marcar como lida apenas gera log — nunca dispara o email de erro.
      if (responseSent) {
        await this.markEmailAsRead(emailData.uid);
        logger.info("Email processed successfully", {
          messageId: emailData.messageId,
          classification: classification.type,
          responseSent
        });
      } else if (emailLogId) {
        // O registro foi criado otimisticamente como "SENT_RESPONSE" —
        // rebaixa para "FAILED" quando o envio de fato falhou.
        try {
          await updateEmailLog(emailLogId, { actionTaken: "FAILED" });
        } catch (logError) {
          logger.error("Failed to mark email log as FAILED", logError);
        }
      }

    } catch (error) {
      logger.error("Failed to process email", {
        messageId: emailData.messageId,
        error
      });

      // Try to send error response
      let errorResponseSent = false;
      try {
        const responseData = await generateErrorResponse(
          emailData.from,
          "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente ou contate nosso suporte.",
          emailData.subject
        );
        errorResponseSent = await sendEmailResponse(
          responseData,
          emailLogId || undefined
        );
      } catch (responseError) {
        logger.error("Failed to send error response", responseError);
      }

      if (!errorResponseSent && emailLogId) {
        try {
          await updateEmailLog(emailLogId, { actionTaken: "FAILED" });
        } catch (logError) {
          logger.error("Failed to mark email log as FAILED", logError);
        }
      }
    } finally {
      // Update processing time no registro existente
      const processingTime = Date.now() - processingStartTime;
      if (emailLogId) {
        try {
          await updateEmailLog(emailLogId, { processingTime });
        } catch (error) {
          logger.error("Failed to update processing time", error);
        }
      }
    }
  }

  private async createBookingFromExtractedData(
    extractedData: any,
    senderEmail: string
  ): Promise<BookingCreationResult> {
    try {
      const {
        clientName,
        clientEmail,
        roomName,
        date,
        startTime,
        endTime
      } = extractedData;

      // Validate required fields
      if (!clientName || !roomName || !date || !startTime || !endTime) {
        logger.warn("Missing required booking data");
        return {
          status: "invalid",
          reason:
            "Faltam informações obrigatórias para a reserva (nome, sala, data ou horários)."
        };
      }

      // Validate email (use extracted email or sender email)
      const bookingEmail = clientEmail || senderEmail;
      if (!validateInstitutionalEmail(bookingEmail)) {
        logger.warn("Invalid institutional email");
        return {
          status: "invalid",
          reason: institutionalEmailErrorMessage()
        };
      }

      // Valida data e horários
      if (!validateDate(date)) {
        return {
          status: "invalid",
          reason:
            "Data inválida. A data deve ser hoje ou no futuro (formato: YYYY-MM-DD ou DD/MM/AAAA)."
        };
      }

      if (!validateTime(startTime) || !validateTime(endTime)) {
        return {
          status: "invalid",
          reason: "Horário inválido. Use o formato HH:mm (ex.: 14:00)."
        };
      }

      if (!validateTimeRange(startTime, endTime)) {
        return {
          status: "invalid",
          reason: "O horário de término deve ser depois do horário de início."
        };
      }

      // Find room by name
      const rooms = await getRooms();
      const room = rooms.find(r =>
        r.name.toLowerCase().trim() === roomName.toLowerCase().trim()
      );

      if (!room) {
        logger.warn("Room not found", { roomName });
        return {
          status: "invalid",
          reason: `Sala "${roomName}" não encontrada. Verifique o nome da sala e tente novamente.`
        };
      }

      // Create booking — a checagem de disponibilidade acontece atomicamente
      // dentro de createBooking (lança BookingConflictError em conflito)
      const booking = await createBooking({
        roomId: room.id,
        roomName: room.name,
        clientName,
        clientEmail: bookingEmail,
        date,
        startTime,
        endTime
      });

      logger.info("Booking created successfully", {
        bookingId: booking.id,
        roomName: room.name,
        date,
        startTime,
        endTime
      });

      return { status: "created", booking };

    } catch (error) {
      if (error instanceof BookingConflictError) {
        return { status: "conflict" };
      }
      logger.error("Failed to create booking from extracted data", error);
      return {
        status: "invalid",
        reason:
          "Não foi possível criar a reserva. Verifique os dados informados e tente novamente."
      };
    }
  }

  /**
   * Marca o email como lido usando o UID real. Falhas são apenas registradas
   * em log — nunca propagadas (para não disparar email de erro ao usuário).
   */
  private async markEmailAsRead(uid: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.imap || !uid) {
        resolve();
        return;
      }

      this.imap.addFlags([uid], ["\\Seen"], (err) => {
        if (err) {
          logger.error("Failed to mark email as read", { uid, error: err });
        }
        resolve();
      });
    });
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Global email processor instance
let globalEmailProcessor: EmailProcessor | null = null;

function sanitizeCheckInterval(raw: string | undefined): number {
  const parsed = parseInt(raw || "5", 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 59) {
    return 5;
  }
  return parsed;
}

export function initializeEmailProcessor(): EmailProcessor | null {
  if (!process.env.IOC_EMAIL_USER || !process.env.IOC_EMAIL_PASSWORD) {
    logger.warn("Email processor configuration missing. Email processing disabled.");
    return null;
  }

  const config: EmailProcessingConfig = {
    host: process.env.IOC_EMAIL_HOST || "imap.gmail.com",
    port: parseInt(process.env.IOC_EMAIL_PORT || "993", 10),
    user: process.env.IOC_EMAIL_USER,
    password: process.env.IOC_EMAIL_PASSWORD,
    folder: process.env.IOC_EMAIL_FOLDER || "INBOX",
    checkIntervalMinutes: sanitizeCheckInterval(
      process.env.IOC_EMAIL_CHECK_INTERVAL
    ),
    enabled: process.env.IOC_EMAIL_PROCESSING_ENABLED === "true",
    allowSelfSignedTls: process.env.IOC_EMAIL_ALLOW_SELF_SIGNED === "true"
  };

  globalEmailProcessor = new EmailProcessor(config);
  return globalEmailProcessor;
}

export function getEmailProcessor(): EmailProcessor | null {
  return globalEmailProcessor;
}

export async function startEmailProcessor(): Promise<void> {
  const processor = getEmailProcessor();
  if (processor) {
    await processor.start();
  } else {
    logger.warn("Email processor not initialized");
  }
}

export async function stopEmailProcessor(): Promise<void> {
  const processor = getEmailProcessor();
  if (processor) {
    await processor.stop();
  }
}

export function getEmailProcessorStatus() {
  const processor = getEmailProcessor();
  return processor ? processor.getStatus() : { running: false, message: "Not initialized" };
}
