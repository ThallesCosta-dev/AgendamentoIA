import { getConnection } from "../db";
import { RowDataPacket, ResultSetHeader } from "mysql2/promise";

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

export async function logEmailProcessing(data: EmailLogData): Promise<number> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO email_logs (
        email_id, sender_email, subject, received_at, processed_at,
        classification, confidence, extracted_data, action_taken,
        booking_id, processing_time_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.emailId,
        data.senderEmail,
        data.subject || null,
        data.receivedAt,
        data.processedAt || null,
        data.classification,
        data.confidence || null,
        data.extractedData ? JSON.stringify(data.extractedData) : null,
        data.actionTaken,
        data.bookingId || null,
        data.processingTime || null,
      ]
    );

    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function logEmailResponse(data: EmailResponseData): Promise<number> {
  const connection = await getConnection();
  try {
    const [result] = await connection.execute<ResultSetHeader>(
      `INSERT INTO email_responses (
        email_log_id, response_type, response_content,
        successfully_sent, error_message, sent_at
      ) VALUES (?, ?, ?, ?, ?, NOW())`,
      [
        data.emailLogId,
        data.responseType,
        data.responseContent,
        data.successfullySent !== undefined ? data.successfullySent : true,
        data.errorMessage || null,
      ]
    );

    return result.insertId;
  } finally {
    connection.release();
  }
}

export async function getEmailProcessingStats(days: number = 7) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT
        classification,
        action_taken,
        COUNT(*) as count,
        AVG(confidence) as avg_confidence,
        AVG(processing_time_ms) as avg_processing_time
      FROM email_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY classification, action_taken
      ORDER BY created_at DESC
      `,
      [days]
    );

    return rows;
  } finally {
    connection.release();
  }
}

export async function getEmailLogsByDateRange(startDate: Date, endDate: Date) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT
        id, email_id, sender_email, subject, received_at, processed_at,
        classification, confidence, extracted_data, action_taken,
        booking_id, processing_time_ms, created_at
      FROM email_logs
      WHERE received_at BETWEEN ? AND ?
      ORDER BY received_at DESC
      `,
      [startDate, endDate]
    );

    return rows.map(row => ({
      ...row,
      extractedData: row.extracted_data ? JSON.parse(row.extracted_data) : null,
    }));
  } finally {
    connection.release();
  }
}

export async function getRecentEmailLogs(limit: number = 50) {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute<RowDataPacket[]>(
      `
      SELECT
        id, email_id, sender_email, subject, received_at, processed_at,
        classification, confidence, action_taken, booking_id,
        processing_time_ms, created_at
      FROM email_logs
      ORDER BY received_at DESC
      LIMIT ?
      `,
      [limit]
    );

    return rows;
  } finally {
    connection.release();
  }
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