import serverless from "serverless-http";

import { createServer, initializeApp } from "../../server";

const serverlessHandler = serverless(createServer());

// Inicialização preguiçosa (uma única vez por instância da função):
// garante que o armazenamento de dados (arquivo JSON) esteja carregado antes
// de atender a primeira requisição. Atenção: em ambiente serverless o sistema
// de arquivos é EFÊMERO — os dados não persistem entre instâncias da função.
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (!initPromise) {
    initPromise = initializeApp().catch((error) => {
      // Permite nova tentativa na próxima requisição em caso de falha
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export const handler = async (event: unknown, context: unknown) => {
  await ensureInitialized();
  return serverlessHandler(event as any, context as any);
};
