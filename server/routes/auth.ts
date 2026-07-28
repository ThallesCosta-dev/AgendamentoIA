import { createHash, timingSafeEqual } from "crypto";
import { RequestHandler } from "express";
import { AdminLoginRequest, AdminLoginResponse } from "@shared/api";
import {
  createAdminToken,
  extractBearerToken,
  revokeAdminToken,
} from "../middleware/auth";

let warnedMissingAdminPassword = false;

/**
 * Comparação em tempo constante: compara os digests SHA-256 dos dois lados
 * (tamanhos iguais), evitando vazar informação por tempo de resposta.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a, "utf8").digest();
  const digestB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(digestA, digestB);
}

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Sucesso: { success: true, token, expiresAt }
 * Falha:   401 { success: false, error: "Usuário ou senha inválidos" }
 */
export const handleLogin: RequestHandler = (req, res) => {
  const { username, password } = (req.body ?? {}) as Partial<AdminLoginRequest>;

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  let adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    if (process.env.NODE_ENV === "production") {
      res.status(503).json({
        success: false,
        error:
          "Autenticação não configurada no servidor. Defina a variável ADMIN_PASSWORD.",
      } satisfies AdminLoginResponse);
      return;
    }

    if (!warnedMissingAdminPassword) {
      console.warn(
        '[Auth] ADMIN_PASSWORD não definido — usando a senha padrão de desenvolvimento "admin123". Defina ADMIN_PASSWORD em produção.',
      );
      warnedMissingAdminPassword = true;
    }
    adminPassword = "admin123";
  }

  // Avalia as duas comparações sempre (sem curto-circuito), para não vazar
  // por tempo de resposta qual dos campos está incorreto.
  const usernameOk =
    typeof username === "string" && constantTimeEquals(username, adminUsername);
  const passwordOk =
    typeof password === "string" && constantTimeEquals(password, adminPassword);

  if (!usernameOk || !passwordOk) {
    res.status(401).json({
      success: false,
      error: "Usuário ou senha inválidos",
    } satisfies AdminLoginResponse);
    return;
  }

  const { token, expiresAt } = createAdminToken();
  res.json({ success: true, token, expiresAt } satisfies AdminLoginResponse);
};

/**
 * POST /api/auth/logout
 * Invalida o token enviado em `Authorization: Bearer <token>`.
 */
export const handleLogout: RequestHandler = (req, res) => {
  const token = extractBearerToken(req.headers.authorization);
  if (token) {
    revokeAdminToken(token);
  }
  res.json({ success: true });
};
