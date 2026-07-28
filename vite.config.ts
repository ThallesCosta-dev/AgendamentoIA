import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";
import { initializeDatabase } from "./server/db";

// https://vitejs.dev/config/ (Configuração do Vite)
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["./", "./client", "./shared"],
      // Padrões com "/" são comparados contra o caminho ABSOLUTO do arquivo
      // sem prefixo automático "**/" — por isso "server/**" sozinho não
      // casaria nada; é preciso "**/server/**". "data/**" protege o db.json
      // (contém PII).
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/server/**",
        "**/data/**",
      ],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  let initialized = false;

  return {
    name: "express-plugin",
    apply: "serve", // Aplicar apenas durante o desenvolvimento (modo serve)
    async configureServer(server) {
      // Não inicializar o app durante os testes (vitest) — os testes usam
      // um diretório de dados temporário próprio e não devem escrever no repo
      if (process.env.VITEST) {
        return;
      }

      // Inicializar banco de dados apenas uma vez
      if (!initialized) {
        try {
          await initializeDatabase();
          console.log("✅ Database initialized");
          initialized = true;
        } catch (error) {
          console.error("❌ Failed to initialize database:", error);
        }
      }

      const app = createServer();

      // Adicionar aplicativo Express como middleware ao servidor de desenvolvimento Vite
      server.middlewares.use(app);
    },
  };
}
