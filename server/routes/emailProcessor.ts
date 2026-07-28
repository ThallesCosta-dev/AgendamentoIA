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
      error: "Não foi possível obter o status do processador de emails",
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
          error: "Processador de emails não configurado. Verifique as variáveis de ambiente.",
        });
        return;
      }
    }

    await startEmailProcessor();
    const status = getEmailProcessorStatus();

    // start() é um no-op quando IOC_EMAIL_PROCESSING_ENABLED !== "true" —
    // nesse caso o processador continua parado e a resposta deve ser honesta.
    if (!status.running) {
      res.status(409).json({
        success: false,
        running: false,
        error:
          "O processador de emails está desabilitado por configuração. Defina IOC_EMAIL_PROCESSING_ENABLED=true para habilitá-lo.",
        status,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      message: "Processador de emails iniciado com sucesso",
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error starting email processor:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível iniciar o processador de emails",
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
      message: "Processador de emails parado com sucesso",
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error stopping email processor:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível parar o processador de emails",
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
        error: "Processador de emails não inicializado",
      });
      return;
    }

    const status = getEmailProcessorStatus();
    if (!status.running) {
      res.status(400).json({
        success: false,
        error: "O processador de emails não está em execução. Inicie-o primeiro.",
      });
      return;
    }

    // Executa um ciclo real de processamento imediatamente
    const result = await processor.processNow();

    if (!result.ran) {
      res.status(409).json({
        success: false,
        error:
          "Já existe um ciclo de processamento em andamento. Tente novamente em instantes.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!result.ok) {
      res.status(502).json({
        success: false,
        error:
          "O ciclo de processamento de emails foi executado, mas terminou com erro. Verifique os logs do servidor.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      message: "Ciclo de processamento de emails executado com sucesso",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error triggering manual email processing:", error);
    res.status(500).json({
      success: false,
      error: "Não foi possível executar o processamento manual de emails",
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
      error: "Não foi possível obter as estatísticas de processamento de emails",
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
      error: "Não foi possível obter os logs de emails",
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
        error: "startDate e endDate são obrigatórios",
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        error: "Formato de data inválido. Use o formato ISO (YYYY-MM-DD)",
      });
      return;
    }

    // endDate sem horário ("YYYY-MM-DD") é interpretado como meia-noite —
    // estende para o fim do dia para incluir o dia final inteiro no intervalo.
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
      end.setUTCHours(23, 59, 59, 999);
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
      error: "Não foi possível obter os logs de emails por data",
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
        error: "O campo testEmail é obrigatório",
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
      error: "Não foi possível testar o processamento de emails",
    });
  }
};