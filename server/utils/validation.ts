/**
 * Utilitários puros de validação e formatação (sem dependência de banco de dados).
 * Usados pelas rotas, serviços de email e testes unitários.
 */

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["fiocruz.br", "edu.br"];

/**
 * Lê a lista de domínios de email aceitos a partir de ALLOWED_EMAIL_DOMAINS
 * (separados por vírgula). Padrão: fiocruz.br, edu.br
 */
export function getAllowedEmailDomains(): string[] {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS;
  if (!raw) return [...DEFAULT_ALLOWED_EMAIL_DOMAINS];

  // Pontos iniciais são tolerados (".edu.br" equivale a "edu.br")
  const domains = raw
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^\.+/, ""))
    .filter(Boolean);

  return domains.length > 0 ? domains : [...DEFAULT_ALLOWED_EMAIL_DOMAINS];
}

/**
 * Valida se o email pertence a um dos domínios institucionais aceitos.
 * Um email é aceito se o domínio for igual a um domínio listado OU terminar
 * com "." + domínio (ex.: ioc.fiocruz.br é aceito para fiocruz.br).
 */
export function validateInstitutionalEmail(
  email: string,
  allowedDomains: string[] = getAllowedEmailDomains(),
): boolean {
  if (typeof email !== "string") return false;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return false;

  const domain = email.split("@")[1].toLowerCase();
  return allowedDomains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
}

/** Mensagem padrão (PT-BR) para email fora dos domínios aceitos. */
export function institutionalEmailErrorMessage(
  allowedDomains: string[] = getAllowedEmailDomains(),
): string {
  return `O email deve ser institucional (domínios aceitos: ${allowedDomains.join(", ")})`;
}

/** Verifica se a string está no formato YYYY-MM-DD e é uma data de calendário válida. */
export function isValidDateFormat(dateStr: string): boolean {
  if (typeof dateStr !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Verifica se a data (YYYY-MM-DD) é hoje ou está no futuro, no fuso local. */
export function isDateTodayOrFuture(dateStr: string): boolean {
  if (!isValidDateFormat(dateStr)) return false;

  const [year, month, day] = dateStr.split("-").map(Number);
  const selectedDate = new Date(year, month - 1, day);
  selectedDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate.getTime() >= today.getTime();
}

/** Data válida no formato YYYY-MM-DD, hoje ou no futuro. */
export function validateDate(dateStr: string): boolean {
  return isValidDateFormat(dateStr) && isDateTodayOrFuture(dateStr);
}

/** Valida o formato HH:mm (00:00 a 23:59). */
export function validateTime(timeStr: string): boolean {
  if (typeof timeStr !== "string" || !/^\d{2}:\d{2}$/.test(timeStr)) {
    return false;
  }

  const [hours, minutes] = timeStr.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Converte "HH:mm" ou "HH:mm:ss" em minutos desde a meia-noite.
 * Retorna NaN para entradas inválidas.
 */
export function timeToMinutes(time: string): number {
  if (typeof time !== "string") return NaN;

  const match = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return NaN;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;

  return hours * 60 + minutes;
}

/** Normaliza "HH:mm:ss" (ou "H:mm") para "HH:mm". Retorna a entrada se não reconhecer. */
export function normalizeTimeToHHMM(time: string): string {
  const totalMinutes = timeToMinutes(time);
  if (Number.isNaN(totalMinutes)) return time;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Hora de término deve ser depois da hora de início (formatos HH:mm). */
export function validateTimeRange(startTime: string, endTime: string): boolean {
  if (!validateTime(startTime) || !validateTime(endTime)) return false;
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

/**
 * Verifica sobreposição de dois intervalos de horário.
 * Aceita "HH:mm" e "HH:mm:ss" (normaliza para minutos antes de comparar).
 * Intervalos adjacentes (fim de um == início do outro) NÃO se sobrepõem.
 */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  const s1 = timeToMinutes(aStart);
  const e1 = timeToMinutes(aEnd);
  const s2 = timeToMinutes(bStart);
  const e2 = timeToMinutes(bEnd);

  if ([s1, e1, s2, e2].some(Number.isNaN)) return false;

  return s1 < e2 && e1 > s2;
}

/**
 * Mascara um email para exibição pública: mantém os 2 primeiros caracteres
 * da parte local, seguidos de "***@" e o domínio completo.
 * Ex.: "thalles.costa@ioc.fiocruz.br" → "th***@ioc.fiocruz.br".
 */
export function maskEmail(email: string): string {
  if (typeof email !== "string" || email.length === 0) return "";

  const atIndex = email.indexOf("@");
  if (atIndex === -1) return "***";

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Escapa caracteres especiais de HTML em valores derivados do usuário. */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Formata uma data "YYYY-MM-DD" para exibição em pt-BR, interpretando a data
 * no fuso horário LOCAL (evita o bug de UTC que mostra o dia anterior).
 */
export function formatDateBR(
  dateStr: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
): string {
  if (typeof dateStr !== "string") return String(dateStr ?? "");

  const datePart = dateStr.slice(0, 10);
  if (!isValidDateFormat(datePart)) return dateStr;

  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("pt-BR", options);
}
