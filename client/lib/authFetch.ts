/**
 * Helper para requisições autenticadas: anexa o token de admin
 * no header Authorization (Bearer) quando disponível.
 */
export function authFetch(
  token: string | null,
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

/**
 * Extrai a mensagem de erro (campo "error") do corpo JSON de uma resposta,
 * retornando a mensagem padrão caso não exista.
 */
export async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const data = await response.json().catch(() => null);
  if (data && typeof data.error === "string" && data.error.trim()) {
    return data.error;
  }
  return fallback;
}
