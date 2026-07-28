import path from "path";
import { createServer, initializeApp } from "./index";
import * as express from "express";

const app = createServer();
const port = process.env.PORT || 3000;

// Em produção, servir os arquivos SPA construídos
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Servir arquivos estáticos
app.use(express.static(distPath));

// Lidar com React Router - servir index.html para todas as rotas não-API
app.use((req, res, next) => {
  // Não servir index.html para rotas de API
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // Se for um arquivo estático, continua para o next
  if (req.path.includes('.')) {
    return next();
  }

  res.sendFile(path.join(distPath, "index.html"));
});

async function startServer() {
  try {
    // Inicializar banco de dados e email processor
    await initializeApp();
    console.log("✅ App initialized");

    app.listen(port, () => {
      console.log(`🚀 SalaAgenda — servidor rodando na porta ${port}`);
      console.log(`📱 Frontend: http://localhost:${port}`);
      console.log(`🔧 API: http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

// Logging de erros em nível de processo — evita que rejeições não tratadas
// derrubem o servidor silenciosamente
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled promise rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught exception:", error);
});

// Desligamento gracioso
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
