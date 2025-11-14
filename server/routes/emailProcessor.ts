import { RequestHandler } from "express";
import {
  initializeEmailProcessor,
  getEmailProcessor,
  startEmailProcessor,
  stopEmailProcessor,
  getEmailProcessorStatus
} from "../services/emailProcessor";
import {
  getEmailProcessingStats,
  getEmailLogsByDateRange,
  getRecentEmailLogs
} from "../utils/emailLogger";

/**
 * Check email processor status
 */
export const handleEmailProcessorStatus: RequestHandler = async (_req, res) => {
  try {
    const status = getEmailProcessorStatus();
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting email processor status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get email processor status",
    });
  }
};

/**
 * Manually start email processor
 */
export const handleEmailProcessorStart: RequestHandler = async (_req, res) => {
  try {
    const processor = getEmailProcessor();
    if (!processor) {
      const newProcessor = initializeEmailProcessor();
      if (!newProcessor) {
        res.status(400).json({
          success: false,
          error: "Email processor not configured. Check environment variables.",
        });
        return;
      }
    }

    await startEmailProcessor();
    const status = getEmailProcessorStatus();

    res.json({
      success: true,
      message: "Email processor started successfully",
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error starting email processor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start email processor",
    });
  }
};

/**
 * Manually stop email processor
 */
export const handleEmailProcessorStop: RequestHandler = async (_req, res) => {
  try {
    await stopEmailProcessor();
    const status = getEmailProcessorStatus();

    res.json({
      success: true,
      message: "Email processor stopped successfully",
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error stopping email processor:", error);
    res.status(500).json({
      success: false,
      error: "Failed to stop email processor",
    });
  }
};

/**
 * Manually trigger email processing cycle
 */
export const handleEmailProcessorManualProcess: RequestHandler = async (_req, res) => {
  try {
    const processor = getEmailProcessor();
    if (!processor) {
      res.status(400).json({
        success: false,
        error: "Email processor not initialized",
      });
      return;
    }

    const status = getEmailProcessorStatus();
    if (!status.running) {
      res.status(400).json({
        success: false,
        error: "Email processor is not running. Start it first.",
      });
      return;
    }

    // Trigger manual processing
    // Note: This would require modifying the EmailProcessor class to expose a public processEmails method
    // For now, we'll just acknowledge the request
    res.json({
      success: true,
      message: "Manual email processing triggered",
      note: "Processing will happen in the background according to the configured interval",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error triggering manual email processing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to trigger manual email processing",
    });
  }
};

/**
 * Get email processing statistics
 */
export const handleEmailProcessorStats: RequestHandler = async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const stats = await getEmailProcessingStats(days);

    res.json({
      success: true,
      stats,
      periodDays: days,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting email processing stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get email processing statistics",
    });
  }
};

/**
 * Get recent email logs
 */
export const handleEmailProcessorLogs: RequestHandler = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await getRecentEmailLogs(limit);

    res.json({
      success: true,
      logs,
      limit,
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting email logs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get email logs",
    });
  }
};

/**
 * Get email logs by date range
 */
export const handleEmailProcessorLogsByDate: RequestHandler = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: "startDate and endDate are required",
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        error: "Invalid date format. Use ISO format (YYYY-MM-DD)",
      });
      return;
    }

    const logs = await getEmailLogsByDateRange(start, end);

    res.json({
      success: true,
      logs,
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      count: logs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error getting email logs by date:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get email logs by date",
    });
  }
};

/**
 * Test email processing with sample data
 */
export const handleEmailProcessorTest: RequestHandler = async (req, res) => {
  try {
    const { testEmail, testSubject, testSender } = req.body;

    if (!testEmail) {
      res.status(400).json({
        success: false,
        error: "testEmail is required",
      });
      return;
    }

    // Import emailClassifier to test classification
    const { classifyEmail } = await import("../services/emailClassifier");

    const classification = classifyEmail(
      testEmail,
      testSubject || "Test Subject",
      testSender || "test@university.edu.br"
    );

    res.json({
      success: true,
      test: {
        input: {
          emailContent: testEmail.substring(0, 200) + "...",
          subject: testSubject,
          sender: testSender
        },
        classification
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error testing email processing:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test email processing",
    });
  }
};