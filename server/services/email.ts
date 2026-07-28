import { Booking } from "@shared/api";
import { escapeHtml, formatDateBR } from "../utils/validation";
import {
  getMailTransport,
  getSenderAddress,
  getSenderEmail,
} from "./mailTransport";

function getTransporter() {
  return getMailTransport();
}

function getAppUrl(): string {
  return process.env.APP_URL || "http://localhost:8080";
}

function contactEmailLine(): string {
  const email = getSenderEmail();
  if (!email) return "";
  return `, ou entre em contato pelo e-mail <strong>${escapeHtml(email)}</strong>`;
}

export function getEmailTemplate(booking: Booking): string {
  const formattedDate = formatDateBR(booking.date);

  const clientName = escapeHtml(booking.clientName);
  const roomName = escapeHtml(booking.roomName);
  const clientEmail = escapeHtml(booking.clientEmail);
  const bookingId = escapeHtml(booking.id);
  const startTime = escapeHtml(booking.startTime);
  const endTime = escapeHtml(booking.endTime);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .booking-details {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .detail-row {
            margin: 12px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .detail-label {
            font-weight: 600;
            color: #667eea;
            min-width: 150px;
          }
          .detail-value {
            color: #333;
            font-size: 16px;
          }
          .section {
            margin: 25px 0;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 12px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .info-box {
            background: #e0e7ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #667eea;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          ul {
            margin: 15px 0;
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Agendamento Confirmado!</h1>
          </div>

          <div class="content">
            <p>Olá <strong>${clientName}</strong>,</p>

            <p>Seu agendamento foi confirmado com sucesso! Abaixo estão os detalhes da sua reserva:</p>

            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">ID da Reserva:</span>
                <span class="detail-value"><strong>#${bookingId}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Sala:</span>
                <span class="detail-value">${roomName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário:</span>
                <span class="detail-value">${startTime} - ${endTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${clientEmail}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Próximos Passos</div>
              <p>Certifique-se de chegar alguns minutos antes da hora marcada. Se precisar alterar ou cancelar a reserva, utilize o chatbot disponível em <a href="${getAppUrl()}">${getAppUrl()}</a>.</p>
            </div>

            <div class="info-box">
              <strong>💡 Dica importante:</strong> Guarde este e-mail. Você precisará do ID da reserva (${bookingId}) para fazer qualquer alteração.
            </div>

            <div class="section">
              <div class="section-title">Como Modificar ou Cancelar sua Reserva</div>
              <p>Para modificar ou cancelar seu agendamento, basta conversar com nosso <strong>Assistente de Agendamento</strong>. Ele está disponível 24/7 para ajudá-lo.</p>
              <ul>
                <li><strong>Para modificar:</strong> Converse com o assistente e informe o ID da sua reserva (<strong>#${bookingId}</strong>). Você pode alterar a data, hora ou sala conforme necessário.</li>
                <li><strong>Para cancelar:</strong> Converse com o assistente e solicite o cancelamento. Informe o ID da sua reserva (<strong>#${bookingId}</strong>) para que ele identifique seu agendamento.</li>
                <li><strong>Cancelamentos:</strong> Você pode cancelar sua reserva a qualquer momento sem nenhuma penalidade.</li>
              </ul>
            </div>

            <div class="info-box">
              <strong>📞 Precisa de ajuda?</strong> Converse com nosso Assistente de Agendamento disponível em <a href="${getAppUrl()}">${getAppUrl()}</a>${contactEmailLine()}.
            </div>

            <p>Agradecemos por escolher nossos serviços!</p>
            <p><strong>Equipe SalaAgenda — IOC/Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um e-mail automático. Por favor, não responda diretamente a este e-mail.</p>
              <p>&copy; SalaAgenda — IOC/Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function getCancellationEmailTemplate(booking: Booking): string {
  const formattedDate = formatDateBR(booking.date);

  const clientName = escapeHtml(booking.clientName);
  const roomName = escapeHtml(booking.roomName);
  const clientEmail = escapeHtml(booking.clientEmail);
  const bookingId = escapeHtml(booking.id);
  const startTime = escapeHtml(booking.startTime);
  const endTime = escapeHtml(booking.endTime);

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #f9fafb;
            border-radius: 8px;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            background: white;
            padding: 30px;
            border-radius: 0 0 8px 8px;
          }
          .booking-details {
            background: #fef2f2;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #dc2626;
          }
          .detail-row {
            margin: 12px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .detail-label {
            font-weight: 600;
            color: #dc2626;
            min-width: 150px;
          }
          .detail-value {
            color: #333;
            font-size: 16px;
          }
          .section {
            margin: 25px 0;
          }
          .section-title {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin-bottom: 12px;
            border-bottom: 2px solid #dc2626;
            padding-bottom: 8px;
          }
          .info-box {
            background: #fee2e2;
            border-left: 4px solid #dc2626;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #dc2626;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          ul {
            margin: 15px 0;
            padding-left: 20px;
          }
          li {
            margin: 8px 0;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Agendamento Cancelado</h1>
          </div>

          <div class="content">
            <p>Olá <strong>${clientName}</strong>,</p>

            <p>Seu agendamento foi <strong>cancelado com sucesso</strong>. Abaixo estão os detalhes da reserva que foi cancelada:</p>

            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">ID da Reserva:</span>
                <span class="detail-value"><strong>#${bookingId}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Sala:</span>
                <span class="detail-value">${roomName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário:</span>
                <span class="detail-value">${startTime} - ${endTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${clientEmail}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Status do Cancelamento</div>
              <p>Seu agendamento foi cancelado sem nenhuma penalidade. A sala está novamente disponível para outras reservas.</p>
            </div>

            <div class="info-box">
              <strong>📌 Informação importante:</strong> A sala <strong>${roomName}</strong> agora está disponível novamente para a data <strong>${formattedDate}</strong> das <strong>${startTime} às ${endTime}</strong>.
            </div>

            <div class="section">
              <div class="section-title">Precisa Reagendar?</div>
              <p>Se você deseja fazer um novo agendamento para outra data ou hora, basta conversar com nosso <strong>Assistente de Agendamento</strong>. Ele está disponível 24/7 para ajudá-lo a encontrar o melhor horário.</p>
            </div>

            <div class="info-box">
              <strong>📞 Precisa de ajuda?</strong> Converse com nosso Assistente de Agendamento disponível em <a href="${getAppUrl()}">${getAppUrl()}</a>${contactEmailLine()}.
            </div>

            <p>Obrigado por utilizar nossos serviços!</p>
            <p><strong>Equipe SalaAgenda — IOC/Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um e-mail automático. Por favor, não responda diretamente a este e-mail.</p>
              <p>&copy; SalaAgenda — IOC/Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Envia o email de confirmação. Falhas são apenas registradas em log —
 * nunca devem impedir a criação do agendamento.
 */
export async function sendBookingConfirmationEmail(
  booking: Booking,
): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) {
    return;
  }

  try {
    const htmlContent = getEmailTemplate(booking);

    await mailer.sendMail({
      from: getSenderAddress() ?? undefined,
      to: booking.clientEmail,
      subject: `Agendamento Confirmado - ID: #${booking.id}`,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Erro ao enviar email de confirmação:", error);
  }
}

/**
 * Envia o email de cancelamento. Falhas são apenas registradas em log.
 */
export async function sendBookingCancellationEmail(
  booking: Booking,
): Promise<void> {
  const mailer = getTransporter();
  if (!mailer) {
    return;
  }

  try {
    const htmlContent = getCancellationEmailTemplate(booking);

    await mailer.sendMail({
      from: getSenderAddress() ?? undefined,
      to: booking.clientEmail,
      subject: `Agendamento Cancelado - ID: #${booking.id}`,
      html: htmlContent,
    });
  } catch (error) {
    console.error("Erro ao enviar email de cancelamento:", error);
  }
}
