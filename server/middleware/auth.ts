import crypto from "crypto";
import { RequestHandler } from "express";

/** Duração do token de sessão administrativa: 8 horas. */
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

/** token -> expiração (epoch ms). Armazenamento em memória. */
const adminTokens = new Map<string, number>();

function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, expiresAt] of adminTokens) {
    if (expiresAt <= now) {
      adminTokens.delete(token);
    }
  }
}

/** Cria e registra um novo token de administrador. */
export function createAdminToken(): { token: string; expiresAt: string } {
  cleanupExpiredTokens();

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAtMs = Date.now() + TOKEN_TTL_MS;
  adminTokens.set(token, expiresAtMs);

  return { token, expiresAt: new Date(expiresAtMs).toISOString() };
}

/** Invalida um token de administrador. Retorna true se o token existia. */
export function revokeAdminToken(token: string): boolean {
  return adminTokens.delete(token);
}

/** Verifica se o token é válido e não expirou. */
export function isValidAdminToken(token: string): boolean {
  cleanupExpiredTokens();

  const expiresAt = adminTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

/** Extrai o token Bearer do header Authorization. */
export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

/**
 * Middleware: exige um token de administrador válido em
 * `Authorization: Bearer <token>`. Caso contrário responde 401.
 */
export const requireAdmin: RequestHandler = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (token && isValidAdminToken(token)) {
    next();
    return;
  }

  res.status(401).json({ error: "Não autorizado" });
};
