import { RequestHandler } from "express";

interface RateLimiterOptions {
  /** Janela de tempo em milissegundos (padrão: 60s). */
  windowMs?: number;
  /** Máximo de requisições por janela (padrão: 20). */
  max?: number;
  /** Mensagem de erro (PT-BR) retornada com status 429. */
  message?: string;
}

/**
 * Rate limiter simples em memória (Map de IP -> timestamps).
 * Sem dependências externas; adequado para uma única instância.
 */
export function createRateLimiter(
  options: RateLimiterOptions = {},
): RequestHandler {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 20;
  const message =
    options.message ??
    "Muitas requisições em pouco tempo. Aguarde um instante e tente novamente.";

  const hits = new Map<string, number[]>();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || "unknown";

    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      hits.set(ip, recent);
      res.status(429).json({ error: message });
      return;
    }

    recent.push(now);
    hits.set(ip, recent);

    // Limpeza ocasional para evitar crescimento sem limite do Map
    if (hits.size > 1000) {
      for (const [key, timestamps] of hits) {
        const alive = timestamps.filter((t) => now - t < windowMs);
        if (alive.length === 0) {
          hits.delete(key);
        } else {
          hits.set(key, alive);
        }
      }
    }

    next();
  };
}
