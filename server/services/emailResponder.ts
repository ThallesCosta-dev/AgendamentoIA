import nodemailer from "nodemailer";
import { Booking } from "@shared/api";
import { getRooms } from "../data";
import { logEmailResponse } from "../utils/emailLogger";
import { ExtractedBookingData, EmailClassificationResult } from "./emailClassifier";
import { createEmailLogger } from "../utils/emailLogger";

const logger = createEmailLogger("EmailResponder");

// Configure email transporter using existing email service configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "atendimentoia.naoresponda@gmail.com",
    pass: process.env.EMAIL_PASSWORD || "uxfc dpsn rnbs clpn",
  },
});

export interface ResponseData {
  to: string;
  subject: string;
  htmlContent: string;
  type: "INFORMATION" | "INCOMPLETE_BOOKING" | "CONFIRMATION" | "ERROR";
  originalSubject?: string;
}

export async function generateInformationRequestResponse(
  senderEmail: string,
  originalSubject?: string
): Promise<ResponseData> {
  const rooms = await getRooms();
  const roomsList = rooms.map(room => `- ${room.name} (capacidade: ${room.capacity} pessoas)`).join("\\n");

  const subject = originalSubject ? `Re: ${originalSubject}` : "Informações sobre Reservas - IOC Fiocruz";

  const htmlContent = `
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
          .info-box {
            background: #e0e7ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .section {
            margin: 25px 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .list {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
          }
          .list-item {
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .list-item:last-child {
            border-bottom: none;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📋 Sistema de Reservas IOC-Fiocruz</h1>
          </div>

          <div class="content">
            <p>Prezado(a) Solicitante,</p>

            <p>Agradecemos seu contato com o sistema de reservas do IOC-Fiocruz.</p>

            <div class="section">
              <div class="section-title">Como Solicitar uma Reserva</div>
              <p>Para solicitar uma reserva de sala, envie um email com as seguintes informações:</p>

              <div class="list">
                <div class="list-item"><strong>Nome completo:</strong> Seu nome completo</div>
                <div class="list-item"><strong>Email institucional:</strong> Seu email .edu.br</div>
                <div class="list-item"><strong>Sala desejada:</strong> Nome da sala</div>
                <div class="list-item"><strong>Data:</strong> Data da reserva (DD/MM/AAAA)</div>
                <div class="list-item"><strong>Horário:</strong> Início - Término</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Salas Disponíveis</div>
              <div class="list">
                ${roomsList.split("\\n").map(item => `<div class="list-item">${item}</div>`).join("")}
              </div>
            </div>

            <div class="info-box">
              <strong>💡 Dica importante:</strong> Se você já tem todas as informações acima, pode responder a este email diretamente com os dados e processaremos sua reserva automaticamente.
            </div>

            <div class="section">
              <div class="section-title">Outras Formas de Contato</div>
              <p>• <strong>Chatbot:</strong> Disponível 24/7 em nosso sistema</p>
              <p>• <strong>Email:</strong> atendimentoia.naoresponda@gmail.com</p>
              <p>• <strong>Horário de atendimento:</strong> Segunda a Sexta, 8h às 18h</p>
            </div>

            <p>Atenciosamente,</p>
            <p><strong>Equipe de Reservas IOC-Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um email automático. Responda diretamente a este email para solicitar sua reserva.</p>
              <p>&copy; 2024 IOC-Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    to: senderEmail,
    subject,
    htmlContent,
    type: "INFORMATION",
    originalSubject
  };
}

export async function generateIncompleteBookingResponse(
  senderEmail: string,
  extractedData: ExtractedBookingData,
  missingFields: string[],
  originalSubject?: string
): Promise<ResponseData> {
  const providedInfo = [];

  if (extractedData.clientName) providedInfo.push(`Nome: ${extractedData.clientName}`);
  if (extractedData.clientEmail) providedInfo.push(`Email: ${extractedData.clientEmail}`);
  if (extractedData.roomName) providedInfo.push(`Sala: ${extractedData.roomName}`);
  if (extractedData.date) {
    const [year, month, day] = extractedData.date.split("-");
    providedInfo.push(`Data: ${day}/${month}/${year}`);
  }
  if (extractedData.startTime && extractedData.endTime) {
    providedInfo.push(`Horário: ${extractedData.startTime} - ${extractedData.endTime}`);
  }

  const subject = originalSubject ? `Re: ${originalSubject}` : "Informações Adicionais Necessárias - Reserva IOC Fiocruz";

  const htmlContent = `
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
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
          .info-box {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .section {
            margin: 25px 0;
          }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            margin-bottom: 15px;
            border-bottom: 2px solid #f59e0b;
            padding-bottom: 8px;
          }
          .list {
            background: #f3f4f6;
            padding: 20px;
            border-radius: 8px;
            margin: 15px 0;
          }
          .list-item {
            margin: 8px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .list-item:last-child {
            border-bottom: none;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
          .missing-field {
            color: #dc2626;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Informações Adicionais Necessárias</h1>
          </div>

          <div class="content">
            <p>Prezado(a) ${extractedData.clientName || "Solicitante"},</p>

            <p>Recebemos sua solicitação de reserva e precisamos de algumas informações adicionais:</p>

            ${providedInfo.length > 0 ? `
            <div class="section">
              <div class="section-title">Informações Já Fornecidas</div>
              <div class="list">
                ${providedInfo.map(info => `<div class="list-item">✅ ${info}</div>`).join("")}
              </div>
            </div>
            ` : ""}

            <div class="section">
              <div class="section-title">Informações Pendentes</div>
              <div class="list">
                ${missingFields.map(field => `<div class="list-item"><span class="missing-field">❌ ${field}</span></div>`).join("")}
              </div>
            </div>

            <div class="info-box">
              <strong>📝 Como completar sua reserva:</strong> Responda a este email com as informações que faltam. Exemplo:<br><br>
              <em>Nome: João da Silva<br>
              Email: joao@universidade.edu.br<br>
              Sala: Sala 101<br>
              Data: 15/02/2025<br>
              Horário: 14:00 - 16:00</em>
            </div>

            <div class="section">
              <div class="section-title">Requisitos Importantes</div>
              <div class="list">
                <div class="list-item">• Utilize email institucional (.edu.br)</div>
                <div class="list-item">• A data deve ser hoje ou futura</div>
                <div class="list-item">• O horário final deve ser após o inicial</div>
                <div class="list-item">• Verifique a disponibilidade da sala desejada</div>
              </div>
            </div>

            <p>Após receber todas as informações, processaremos sua reserva automaticamente e enviaremos a confirmação.</p>

            <p>Atenciosamente,</p>
            <p><strong>Equipe de Reservas IOC-Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um email automático. Responda diretamente a este email com as informações adicionais.</p>
              <p>&copy; 2024 IOC-Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    to: senderEmail,
    subject,
    htmlContent,
    type: "INCOMPLETE_BOOKING",
    originalSubject
  };
}

export async function generateBookingConfirmationResponse(
  senderEmail: string,
  booking: Booking,
  originalSubject?: string
): Promise<ResponseData> {
  const formattedDate = new Date(booking.date).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Confirmação de Reserva - ID: #${booking.id}`;

  const htmlContent = `
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
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
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
            background: #d1fae5;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #10b981;
          }
          .detail-row {
            margin: 12px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .detail-label {
            font-weight: 600;
            color: #10b981;
            min-width: 150px;
          }
          .detail-value {
            color: #333;
            font-size: 16px;
          }
          .info-box {
            background: #d1fae5;
            border-left: 4px solid #10b981;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .info-box strong {
            color: #10b981;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Reserva Confirmada!</h1>
          </div>

          <div class="content">
            <p>Prezado(a) <strong>${booking.clientName}</strong>,</p>

            <p>Sua reserva foi processada automaticamente a partir do seu email e confirmada com sucesso!</p>

            <div class="booking-details">
              <div class="detail-row">
                <span class="detail-label">ID da Reserva:</span>
                <span class="detail-value"><strong>#${booking.id}</strong></span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Sala:</span>
                <span class="detail-value">${booking.roomName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Data:</span>
                <span class="detail-value">${formattedDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Horário:</span>
                <span class="detail-value">${booking.startTime} - ${booking.endTime}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">E-mail:</span>
                <span class="detail-value">${booking.clientEmail}</span>
              </div>
            </div>

            <div class="info-box">
              <strong>💡 Informações Importantes:</strong>
              <ul>
                <li>Guarde o ID da reserva (<strong>#${booking.id}</strong>) para referência</li>
                <li>Chegue 10 minutos antes do horário agendado</li>
                <li>Para cancelar ou modificar, responda a este email</li>
                <li>O sistema enviará um lembrete 24h antes do evento</li>
              </ul>
            </div>

            <p>Sua reserva foi registrada em nosso sistema e já está confirmada. Não há necessidade de nenhuma ação adicional.</p>

            <p>Atenciosamente,</p>
            <p><strong>Equipe de Reservas IOC-Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um email automático. Para cancelar ou modificar, responda a este email.</p>
              <p>&copy; 2024 IOC-Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    to: senderEmail,
    subject,
    htmlContent,
    type: "CONFIRMATION",
    originalSubject
  };
}

export async function generateErrorResponse(
  senderEmail: string,
  errorMessage: string,
  originalSubject?: string
): Promise<ResponseData> {
  const subject = originalSubject ? `Re: ${originalSubject}` : "Erro no Processamento - Reserva IOC Fiocruz";

  const htmlContent = `
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
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
          .error-box {
            background: #fee2e2;
            border-left: 4px solid #ef4444;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .error-box strong {
            color: #ef4444;
          }
          .info-box {
            background: #f3f4f6;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .footer {
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Erro no Processamento</h1>
          </div>

          <div class="content">
            <p>Prezado(a) Solicitante,</p>

            <p>Encontramos um problema ao processar sua solicitação de reserva:</p>

            <div class="error-box">
              <strong>❌ Erro:</strong> ${errorMessage}
            </div>

            <div class="info-box">
              <strong>📞 O que fazer agora:</strong>
              <ul>
                <li>Verifique se todas as informações estão corretas</li>
                <li>Confirme que o email é institucional (.edu.br)</li>
                <li>Tente enviar a solicitação novamente</li>
                <li>Se o problema persistir, contate nosso suporte</li>
              </ul>
            </div>

            <p>Para ajudar-nos a resolver o problema, você pode:</p>
            <ul>
              <li>Responder este email com a solicitação corrigida</li>
              <li>Entrar em contato diretamente: atendimentoia.naoresponda@gmail.com</li>
              <li>Usar nosso sistema de reservas online</li>
            </ul>

            <p>Lamentamos o inconveniente e agradecemos sua compreensão.</p>

            <p>Atenciosamente,</p>
            <p><strong>Equipe de Suporte IOC-Fiocruz</strong></p>

            <div class="footer">
              <p>Este é um email automático. Responda para obter ajuda adicional.</p>
              <p>&copy; 2024 IOC-Fiocruz. Todos os direitos reservados.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    to: senderEmail,
    subject,
    htmlContent,
    type: "ERROR",
    originalSubject
  };
}

export async function sendEmailResponse(responseData: ResponseData, emailLogId?: number): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || "atendimentoia.naoresponda@gmail.com",
      to: responseData.to,
      subject: responseData.subject,
      html: responseData.htmlContent,
      replyTo: process.env.EMAIL_USER || "atendimentoia.naoresponda@gmail.com"
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info("Email response sent successfully", {
      messageId: info.messageId,
      to: responseData.to,
      type: responseData.type
    });

    // Log the response if we have an emailLogId
    if (emailLogId) {
      try {
        await logEmailResponse({
          emailLogId,
          responseType: responseData.type,
          responseContent: responseData.htmlContent,
          successfullySent: true
        });
      } catch (logError) {
        logger.error("Failed to log email response", logError);
      }
    }

    return true;
  } catch (error) {
    logger.error("Failed to send email response", error);

    // Log the failed response if we have an emailLogId
    if (emailLogId) {
      try {
        await logEmailResponse({
          emailLogId,
          responseType: responseData.type,
          responseContent: responseData.htmlContent,
          successfullySent: false,
          errorMessage: error instanceof Error ? error.message : "Unknown error"
        });
      } catch (logError) {
        logger.error("Failed to log failed email response", logError);
      }
    }

    return false;
  }
}