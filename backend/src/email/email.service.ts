import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private from: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    this.from = config.get<string>('EMAIL_FROM') || 'Recall <noreply@recall.app>';
  }

  async sendPasswordReset(to: string, name: string, resetUrl: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Restablece tu contraseña — Recall',
        html: this.passwordResetTemplate(name, resetUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset to ${to}`, err);
      throw err;
    }
  }

  async sendEmailVerification(to: string, name: string, verifyUrl: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: 'Verifica tu correo — Recall',
        html: this.emailVerificationTemplate(name, verifyUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }

  async sendInvitation(to: string, inviterName: string, orgName: string, inviteUrl: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `Te invitaron a ${orgName} en Recall`,
        html: this.invitationTemplate(inviterName, orgName, inviteUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send invitation to ${to}`, err);
      throw err;
    }
  }

  private base(content: string): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recall</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#000000;padding:28px 40px;">
              <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:-0.5px;">Recall</span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f0f0f0;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">Este correo fue enviado automáticamente. Si no lo solicitaste, puedes ignorarlo.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private btn(url: string, label: string): string {
    return `<a href="${url}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#000000;color:#ffffff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.2px;">${label}</a>`;
  }

  private passwordResetTemplate(name: string, resetUrl: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111827;">Restablecer contraseña</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#6b7280;">Hola ${name}, recibimos una solicitud para restablecer tu contraseña.</p>
      <p style="margin:0;font-size:15px;color:#6b7280;">Haz clic en el botón para crear una nueva. El enlace expira en <strong>15 minutos</strong>.</p>
      ${this.btn(resetUrl, 'Restablecer contraseña')}
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">O copia este enlace en tu navegador:<br/><span style="word-break:break-all;color:#6b7280;">${resetUrl}</span></p>
    `);
  }

  private emailVerificationTemplate(name: string, verifyUrl: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111827;">Verifica tu correo</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#6b7280;">Hola ${name}, confirma tu dirección de correo para activar tu cuenta en Recall.</p>
      ${this.btn(verifyUrl, 'Verificar correo')}
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">El enlace expira en <strong>24 horas</strong>.</p>
    `);
  }

  private invitationTemplate(inviterName: string, orgName: string, inviteUrl: string): string {
    return this.base(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#111827;">Te invitaron a ${orgName}</h2>
      <p style="margin:0 0 16px;font-size:15px;color:#6b7280;"><strong>${inviterName}</strong> te ha invitado a unirte a <strong>${orgName}</strong> en Recall.</p>
      <p style="margin:0;font-size:15px;color:#6b7280;">Acepta la invitación para crear tu cuenta y empezar a trabajar.</p>
      ${this.btn(inviteUrl, 'Aceptar invitación')}
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">La invitación expira en <strong>7 días</strong>.</p>
    `);
  }
}
