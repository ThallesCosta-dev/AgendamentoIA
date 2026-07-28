import nodemailer, { Transporter } from "nodemailer";

// Transporte de email compartilhado entre os serviços de envio.
// Configuração preferencial: SMTP genérico (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_TLS).
// Alternativa legada: Gmail com senha de aplicativo (EMAIL_USER/EMAIL_PASSWORD).

let transporter: Transporter | null = null;
let warnedMissingConfig = false;

function warnMissingConfigOnce(): void {
  if (!warnedMissingConfig) {
    console.warn(
      "[Email] Envio de emails desabilitado — configure SMTP_HOST/SMTP_USER/SMTP_PASS (ou EMAIL_USER/EMAIL_PASSWORD para Gmail) no ambiente.",
    );
    warnedMissingConfig = true;
  }
}

export function getMailTransport(): Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;

  if (host && smtpUser && smtpPass) {
    const port = parseInt(process.env.SMTP_PORT || "", 10) || 587;
    // Porta 465 usa TLS implícito; nas demais, SMTP_TLS=true exige STARTTLS
    const secure = port === 465;
    const requireTLS = !secure && process.env.SMTP_TLS === "true";
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user: smtpUser, pass: smtpPass },
    });
    return transporter;
  }

  const gmailUser = process.env.EMAIL_USER;
  const gmailPassword = process.env.EMAIL_PASSWORD;
  if (gmailUser && gmailPassword) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
    });
    return transporter;
  }

  warnMissingConfigOnce();
  return null;
}

// Valor para o header From — pode conter nome de exibição ("SalaAgenda <a@b.c>")
export function getSenderAddress(): string | null {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    process.env.EMAIL_USER ||
    null
  );
}

// Apenas o endereço de email, para exibição em templates e comparações
export function getSenderEmail(): string | null {
  const from = getSenderAddress();
  if (!from) return null;
  const match = from.match(/<([^>]+)>/);
  return (match ? match[1] : from).trim();
}
