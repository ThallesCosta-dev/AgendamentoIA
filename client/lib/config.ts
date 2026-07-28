/**
 * Configuração pública do aplicativo (GET /api/config), com cache em nível
 * de módulo e fallback caso a requisição falhe.
 */

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["fiocruz.br", "edu.br"];

interface AppConfig {
  allowedEmailDomains: string[];
}

let cachedConfig: AppConfig | null = null;
let pendingConfig: Promise<AppConfig> | null = null;

export function getAppConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return Promise.resolve(cachedConfig);
  }

  if (!pendingConfig) {
    pendingConfig = fetch("/api/config")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Falha ao carregar configuração (${response.status})`);
        }
        const data = await response.json();
        const domains = Array.isArray(data?.allowedEmailDomains)
          ? data.allowedEmailDomains.filter(
              (d: unknown): d is string =>
                typeof d === "string" && d.trim().length > 0,
            )
          : [];
        const config: AppConfig = {
          allowedEmailDomains:
            domains.length > 0 ? domains : DEFAULT_ALLOWED_EMAIL_DOMAINS,
        };
        cachedConfig = config;
        return config;
      })
      .catch(() => {
        // Fallback: mantém os domínios padrão e permite nova tentativa depois
        pendingConfig = null;
        return { allowedEmailDomains: DEFAULT_ALLOWED_EMAIL_DOMAINS };
      });
  }

  return pendingConfig;
}

/**
 * Verifica se o domínio do e-mail é igual a um dos domínios permitidos
 * ou termina com "." + domínio (subdomínios institucionais).
 */
export function isEmailDomainAllowed(
  email: string,
  allowedDomains: string[],
): boolean {
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0 || atIndex === email.length - 1) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  return allowedDomains.some((allowed) => {
    const normalized = allowed.toLowerCase();
    return domain === normalized || domain.endsWith(`.${normalized}`);
  });
}
