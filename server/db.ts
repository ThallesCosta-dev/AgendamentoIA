import { initializeStore } from "./store";

/**
 * Camada fina de compatibilidade: a aplicação não usa mais um servidor de
 * banco de dados — os dados vivem em um arquivo JSON (ver ./store.ts).
 * `initializeDatabase()` é mantida porque server/index.ts e vite.config.ts
 * a importam.
 */
export async function initializeDatabase(): Promise<void> {
  await initializeStore();
  console.log("✅ Armazenamento de dados (JSON) inicializado com sucesso");
}
