import * as Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import * as cron from "node-cron";
import { Booking } from "@shared/api";
import { getRooms, createBooking, validateInstitutionalEmail } from "../data";
import { classifyEmail } from "./emailClassifier";
import {
  sendEmailResponse,
  generateInformationRequestResponse,
  generateIncompleteBookingResponse,
  generateBookingConfirmationResponse,
  generateErrorResponse
} from "./emailResponder";
import { logEmailProcessing } from "../utils/emailLogger";
import { createEmailLogger } from "../utils/emailLogger";

const logger = createEmailLogger("EmailProcessor");

interface EmailProcessingConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  folder: string;
  checkIntervalMinutes: number;
  enabled: boolean;
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

class EmailProcessor {
  private config: EmailProcessingConfig;
  private imap: Imap | null = null;
  private isRunning: boolean = false;
  private cronJob: cron.ScheduledTask | null = null;

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

      // Start cron job
      this.cronJob = cron.schedule(
        `*/${this.config.checkIntervalMinutes} * * * *`,
        () => this.processEmails()
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
      this.imap = null;
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

  private async testConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const testImap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
      });

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
      const imap = new Imap({
        user: this.config.user,
        password: this.config.password,
        host: this.config.host,
        port: this.config.port,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
      });

      const timeout = setTimeout(() => {
        imap.end();
        reject(new Error("IMAP connection timeout"));
      }, 60000);

      imap.once("ready", () => {
        clearTimeout(timeout);
        logger.info("IMAP connection established");
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
    if (this.imap) {
      return new Promise((resolve) => {
        this.imap!.once("close", () => {
          resolve();
        });
        this.imap!.end();
      });
    }
  }

  private async processEmails(): Promise<void> {
    const startTime = Date.now();
    logger.info("Starting email processing cycle");

    try {
      this.imap = await this.connectImap();

      const emails = await this.fetchUnreadEmails();
      logger.info(`Found ${emails.length} unread emails to process`);

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
    }
  }

  private async fetchUnreadEmails(): Promise<RawEmailData[]> {
    return new Promise((resolve, reject) => {
      this.imap!.openBox(this.config.folder, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        const emails: RawEmailData[] = [];

        // Search for unseen emails
        this.imap!.search(["UNSEEN"], (searchErr, results) => {
          if (searchErr) {
            reject(searchErr);
            return;
          }

          if (results.length === 0) {
            resolve(emails);
            return;
          }

          const fetch = this.imap!.fetch(results, {
            bodies: "HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID)",
            struct: true
          });

          fetch.on("message", (msg, seqno) => {
            let buffer = Buffer.alloc(0);

            msg.on("body", (stream, info) => {
              stream.on("data", (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
              });

              stream.once("end", async () => {
                try {
                  const header = Imap.parseHeader(buffer.toString());
                  const messageId = header["message-id"]?.[0] || `msg-${Date.now()}-${seqno}`;

                  // Fetch full email body
                  const fullFetch = this.imap!.fetch([seqno], {
                    bodies: ""
                  });

                  fullFetch.on("message", (fullMsg) => {
                    fullMsg.on("body", (fullStream) => {
                      let fullBuffer = Buffer.alloc(0);
                      fullStream.on("data", (chunk) => {
                        fullBuffer = Buffer.concat([fullBuffer, chunk]);
                      });

                      fullStream.once("end", async () => {
                        try {
                          const parsed = await simpleParser(fullBuffer);

                          emails.push({
                            uid: seqno.toString(),
                            messageId: messageId,
                            from: this.extractEmailAddress(parsed.from?.text || ""),
                            subject: parsed.subject || "",
                            date: parsed.date || new Date(),
                            text: parsed.text || "",
                            html: parsed.html || undefined
                          });
                        } catch (parseError) {
                          logger.error("Failed to parse email", { seqno, error: parseError });
                        }
                      });
                    });
                  });
                } catch (error) {
                  logger.error("Failed to process email header", { seqno, error });
                }
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            reject(fetchErr);
          });

          fetch.once("end", () => {
            resolve(emails);
          });
        });
      });
    });
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
        from: emailData.from,
        subject: emailData.subject
      });

      // Validate sender email
      if (!emailData.from || !this.isValidEmail(emailData.from)) {
        logger.warn("Invalid sender email", { from: emailData.from });
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
          const booking = await this.createBookingFromExtractedData(
            classification.extractedData,
            emailData.from
          );

          if (booking) {
            // Update log with booking info
            if (emailLogId) {
              try {
                await logEmailProcessing({
                  emailId: emailData.messageId,
                  senderEmail: emailData.from,
                  subject: emailData.subject,
                  receivedAt: emailData.date,
                  processedAt: new Date(),
                  classification: classification.type,
                  confidence: classification.confidence,
                  extractedData: classification.extractedData,
                  actionTaken: "PROCESSED_BOOKING",
                  bookingId: booking.id,
                  processingTime: 0
                });
              } catch (logError) {
                logger.error("Failed to update email log", logError);
              }
            }

            const responseData = await generateBookingConfirmationResponse(
              emailData.from,
              booking,
              emailData.subject
            );
            responseSent = await sendEmailResponse(responseData, emailLogId || undefined);
          } else {
            // Failed to create booking
            const responseData = await generateErrorResponse(
              emailData.from,
              "Não foi possível criar a reserva. A sala pode não estar disponível no horário solicitado ou os dados podem ser inválidos.",
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

      // Mark email as read if response was sent successfully
      if (responseSent) {
        await this.markEmailAsRead(emailData.uid);
        logger.info("Email processed successfully", {
          messageId: emailData.messageId,
          classification: classification.type,
          responseSent
        });
      }

    } catch (error) {
      logger.error("Failed to process email", {
        messageId: emailData.messageId,
        from: emailData.from,
        error
      });

      // Try to send error response
      try {
        const responseData = await generateErrorResponse(
          emailData.from,
          "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente ou contate nosso suporte.",
          emailData.subject
        );
        await sendEmailResponse(responseData, emailLogId || undefined);
      } catch (responseError) {
        logger.error("Failed to send error response", responseError);
      }
    } finally {
      // Update processing time
      const processingTime = Date.now() - processingStartTime;
      if (emailLogId) {
        try {
          // This would require an update function in the logger
          logger.debug("Processing completed", { processingTimeMs: processingTime });
        } catch (error) {
          logger.error("Failed to update processing time", error);
        }
      }
    }
  }

  private async createBookingFromExtractedData(
    extractedData: any,
    senderEmail: string
  ): Promise<Booking | null> {
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
      if (!clientName || !clientEmail || !roomName || !date || !startTime || !endTime) {
        logger.warn("Missing required booking data", extractedData);
        return null;
      }

      // Validate email (use extracted email or sender email)
      const bookingEmail = clientEmail || senderEmail;
      if (!validateInstitutionalEmail(bookingEmail)) {
        logger.warn("Invalid institutional email", bookingEmail);
        return null;
      }

      // Find room by name
      const rooms = await getRooms();
      const room = rooms.find(r =>
        r.name.toLowerCase().trim() === roomName.toLowerCase().trim()
      );

      if (!room) {
        logger.warn("Room not found", roomName);
        return null;
      }

      // Create booking
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

      return booking;

    } catch (error) {
      logger.error("Failed to create booking from extracted data", error);
      return null;
    }
  }

  private async markEmailAsRead(uid: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imap!.addFlags([uid], ["\\Seen"], (err) => {
        if (err) {
          logger.error("Failed to mark email as read", { uid, error: err });
          reject(err);
        } else {
          logger.debug("Email marked as read", { uid });
          resolve();
        }
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

export function initializeEmailProcessor(): EmailProcessor | null {
  if (!process.env.IOC_EMAIL_USER || !process.env.IOC_EMAIL_PASSWORD) {
    logger.warn("Email processor configuration missing. Email processing disabled.");
    return null;
  }

  const config: EmailProcessingConfig = {
    host: process.env.IOC_EMAIL_HOST || "imap.gmail.com",
    port: parseInt(process.env.IOC_EMAIL_PORT || "993"),
    user: process.env.IOC_EMAIL_USER,
    password: process.env.IOC_EMAIL_PASSWORD,
    folder: process.env.IOC_EMAIL_FOLDER || "INBOX",
    checkIntervalMinutes: parseInt(process.env.IOC_EMAIL_CHECK_INTERVAL || "5"),
    enabled: process.env.IOC_EMAIL_PROCESSING_ENABLED === "true"
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