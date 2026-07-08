import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

export interface DeviceLoginInfo {
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  city?: string | null;
  country?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null;
  private from: string;
  private frontendUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY not set — EmailService disabled, emails will be skipped',
      );
      this.resend = null;
    } else {
      this.resend = new Resend(apiKey);
    }

    const fromEmail =
      config.get<string>('EMAIL_FROM') || 'noreply@localhost.dev';
    const fromName = config.get<string>('EMAIL_FROM_NAME') || 'Fentri';
    this.from = `${fromName} <${fromEmail}>`;
    this.frontendUrl = (config.get<string>('FRONTEND_URL') || '').replace(
      /\/$/,
      '',
    );
  }

  isEnabled(): boolean {
    return this.resend !== null;
  }

  /** true si no hay fila explicita para la key (habilitada por defecto). */
  async isTemplateEnabled(key: string): Promise<boolean> {
    const setting = await this.prisma.emailTemplateSetting.findUnique({
      where: { key },
    });
    return setting?.enabled ?? true;
  }

  async setTemplateEnabled(key: string, enabled: boolean): Promise<void> {
    await this.prisma.emailTemplateSetting.upsert({
      where: { key },
      update: { enabled },
      create: { key, enabled },
    });
  }

  async listTemplates(): Promise<
    {
      key: string;
      name: string;
      subject: string;
      trigger: string;
      connected: boolean;
      implemented: boolean;
      enabled: boolean;
    }[]
  > {
    const metadata = [
      {
        key: 'password_reset',
        name: 'Restablecer contraseña',
        subject: 'Restablece tu contraseña — Fentri',
        trigger: 'Solicitud de "olvidé mi contraseña"',
        connected: true,
        implemented: true,
      },
      {
        key: 'email_verification',
        name: 'Verificación de correo',
        subject: 'Verifica tu correo — Fentri',
        trigger: 'No conectada a ningún flujo actualmente',
        connected: false,
        implemented: true,
      },
      {
        key: 'two_factor_code',
        name: 'Código de verificación (2FA)',
        subject: 'Tu código de verificación — Fentri',
        trigger: 'Inicio de sesión con 2FA por email',
        connected: true,
        implemented: true,
      },
      {
        key: 'invitation',
        name: 'Invitación a la organización',
        subject: 'Te invitaron a {orgName} en Fentri',
        trigger: 'Crear invitación de usuario',
        connected: true,
        implemented: true,
      },
      {
        key: 'welcome',
        name: 'Bienvenida',
        subject: 'Bienvenido a Fentri',
        trigger: 'Registro completado (invitación o alta de organización)',
        connected: true,
        implemented: true,
      },
      {
        key: 'service_completed_admin',
        name: 'Servicio completado (admin)',
        subject: 'Nuevo servicio registrado en {assetName}',
        trigger: 'Un worker registra/publica un servicio',
        connected: true,
        implemented: true,
      },
      {
        key: 'service_completed_external',
        name: 'Servicio completado (cliente externo)',
        subject: 'Se registró un servicio en {assetName}',
        trigger: 'Servicio publicado en un activo con owner externo vinculado',
        connected: true,
        implemented: true,
      },
      {
        key: 'new_device_login',
        name: 'Nuevo dispositivo detectado',
        subject: 'Nuevo inicio de sesión en tu cuenta — Fentri',
        trigger: 'Login desde un dispositivo/ubicación no reconocido',
        connected: true,
        implemented: true,
      },
      {
        key: 'password_changed',
        name: 'Contraseña actualizada',
        subject: 'Tu contraseña fue actualizada — Fentri',
        trigger: 'Cambio de contraseña (perfil o recuperación)',
        connected: true,
        implemented: true,
      },
      {
        key: 'two_factor_status_changed',
        name: '2FA activado/desactivado',
        subject: 'Verificación en dos pasos actualizada — Fentri',
        trigger: 'Activar o desactivar 2FA',
        connected: true,
        implemented: true,
      },
      {
        key: 'plan_change_approved',
        name: 'Cambio de plan aprobado',
        subject: 'Tu cambio de plan fue aprobado — Fentri',
        trigger: 'SUPER_ADMIN aprueba una solicitud de cambio de plan',
        connected: true,
        implemented: true,
      },
      {
        key: 'plan_change_rejected',
        name: 'Cambio de plan rechazado',
        subject: 'Tu solicitud de cambio de plan fue rechazada — Fentri',
        trigger: 'SUPER_ADMIN rechaza una solicitud de cambio de plan',
        connected: true,
        implemented: true,
      },
      {
        key: 'subscription_status_changed',
        name: 'Cuenta suspendida/reactivada',
        subject: 'El estado de tu cuenta cambió — Fentri',
        trigger: 'Suspensión manual (SUPER_ADMIN) o automática (demo vencida)',
        connected: true,
        implemented: true,
      },
      {
        key: 'demo_expiring_soon',
        name: 'Demo por expirar',
        subject: 'Tu demo de Fentri está por expirar',
        trigger: 'Cron diario — quedan 5 o 1 día(s) para que expire la demo',
        connected: true,
        implemented: true,
      },
      {
        key: 'invitation_accepted',
        name: 'Invitación aceptada',
        subject: '{accepteeName} se unió a tu organización — Fentri',
        trigger: 'Alguien acepta una invitación',
        connected: true,
        implemented: true,
      },
      {
        key: 'user_status_changed',
        name: 'Usuario desactivado/reactivado',
        subject: 'Tu acceso a {orgName} cambió — Fentri',
        trigger: 'Un admin activa o desactiva a un usuario',
        connected: true,
        implemented: true,
      },
      {
        key: 'service_edited',
        name: 'Servicio editado',
        subject: 'Se editó un servicio de {assetName} — Fentri',
        trigger: 'Un admin edita un servicio ya publicado',
        connected: true,
        implemented: true,
      },
      {
        key: 'video_processing_failed',
        name: 'Video con error de procesamiento',
        subject: 'Un video no pudo procesarse — Fentri',
        trigger: 'Cloudflare Stream reporta un error al procesar un video',
        connected: true,
        implemented: true,
      },
      {
        key: 'storage_near_limit',
        name: 'Almacenamiento cerca del límite',
        subject: 'Tu almacenamiento está casi lleno — Fentri',
        trigger: 'Cron diario — uso de almacenamiento alcanza 80% o 100% de la cuota',
        connected: true,
        implemented: true,
      },
    ];

    const settings = await this.prisma.emailTemplateSetting.findMany({
      where: { key: { in: metadata.map((m) => m.key) } },
    });
    const enabledMap = new Map(settings.map((s) => [s.key, s.enabled]));

    return metadata.map((m) => ({
      ...m,
      enabled: enabledMap.get(m.key) ?? true,
    }));
  }

  renderPreview(
    key: string,
    lang: 'en' | 'es' = 'es',
  ): { subject: string; html: string } | null {
    switch (key) {
      case 'password_reset':
        return {
          subject:
            lang === 'en'
              ? 'Reset your password — Fentri'
              : 'Restablece tu contraseña — Fentri',
          html: this.passwordResetTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'https://app.fentri.com/reset-password?token=sample-token',
          ),
        };
      case 'email_verification':
        return {
          subject:
            lang === 'en'
              ? 'Verify your email — Fentri'
              : 'Verifica tu correo — Fentri',
          html: this.emailVerificationTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'https://app.fentri.com/verify-email?token=sample-token',
          ),
        };
      case 'two_factor_code':
        return {
          subject:
            lang === 'en'
              ? 'Your verification code — Fentri'
              : 'Tu código de verificación — Fentri',
          html: this.twoFactorCodeTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            '482913',
          ),
        };
      case 'invitation':
        return {
          subject:
            lang === 'en'
              ? "You've been invited to Yates Alejandro on Fentri"
              : 'Te invitaron a Yates Alejandro en Fentri',
          html: this.invitationTemplate(
            lang,
            lang === 'en' ? 'Jane Smith' : 'María González',
            'Yates Alejandro',
            'https://app.fentri.com/register?token=sample-token',
          ),
        };
      case 'welcome':
        return {
          subject: lang === 'en' ? 'Welcome to Fentri' : 'Bienvenido a Fentri',
          html: this.welcomeTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
          ),
        };
      case 'service_completed_admin':
        return {
          subject:
            lang === 'en'
              ? 'New service logged for Poniente'
              : 'Nuevo servicio registrado en Poniente',
          html: this.serviceCompletedAdminTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            lang === 'en' ? 'Carlos Ruiz' : 'Carlos Ruiz',
            'Poniente',
            'Yates Alejandro',
            'https://app.fentri.com/service?id=sample-service',
          ),
        };
      case 'service_completed_external':
        return {
          subject:
            lang === 'en'
              ? 'A service was logged for Poniente'
              : 'Se registró un servicio en Poniente',
          html: this.serviceCompletedExternalTemplate(
            lang,
            lang === 'en' ? 'Jane Smith' : 'María González',
            'Poniente',
            'Yates Alejandro',
            'https://app.fentri.com/service?id=sample-service',
          ),
        };
      case 'new_device_login':
        return {
          subject:
            lang === 'en'
              ? 'New sign-in to your account — Fentri'
              : 'Nuevo inicio de sesión en tu cuenta — Fentri',
          html: this.newDeviceLoginTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            {
              browser: 'Chrome 126',
              os: 'Windows 10/11',
              deviceType: 'desktop',
              city: 'Ciudad de México',
              country: 'México',
              ipAddress: '187.190.12.34',
            },
          ),
        };
      case 'password_changed':
        return {
          subject:
            lang === 'en'
              ? 'Your password was changed — Fentri'
              : 'Tu contraseña fue actualizada — Fentri',
          html: this.passwordChangedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
          ),
        };
      case 'two_factor_status_changed':
        return {
          subject:
            lang === 'en'
              ? 'Two-factor authentication updated — Fentri'
              : 'Verificación en dos pasos actualizada — Fentri',
          html: this.twoFactorStatusChangedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            true,
          ),
        };
      case 'plan_change_approved':
        return {
          subject:
            lang === 'en'
              ? 'Your plan change was approved — Fentri'
              : 'Tu cambio de plan fue aprobado — Fentri',
          html: this.planChangeApprovedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            'PRO',
          ),
        };
      case 'plan_change_rejected':
        return {
          subject:
            lang === 'en'
              ? 'Your plan change request was declined — Fentri'
              : 'Tu solicitud de cambio de plan fue rechazada — Fentri',
          html: this.planChangeRejectedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            'PRO',
          ),
        };
      case 'subscription_status_changed':
        return {
          subject:
            lang === 'en'
              ? 'Your account status changed — Fentri'
              : 'El estado de tu cuenta cambió — Fentri',
          html: this.subscriptionStatusChangedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            false,
          ),
        };
      case 'demo_expiring_soon':
        return {
          subject:
            lang === 'en'
              ? 'Your Fentri demo is about to expire'
              : 'Tu demo de Fentri está por expirar',
          html: this.demoExpiringSoonTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            5,
          ),
        };
      case 'invitation_accepted':
        return {
          subject:
            lang === 'en'
              ? 'Jane Smith joined your organization — Fentri'
              : 'Jane Smith se unió a tu organización — Fentri',
          html: this.invitationAcceptedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Jane Smith',
            'jane.smith@example.com',
            'Yates Alejandro',
          ),
        };
      case 'user_status_changed':
        return {
          subject:
            lang === 'en'
              ? 'Your access to Yates Alejandro changed — Fentri'
              : 'Tu acceso a Yates Alejandro cambió — Fentri',
          html: this.userStatusChangedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            false,
          ),
        };
      case 'service_edited':
        return {
          subject:
            lang === 'en'
              ? 'A service for Poniente was edited — Fentri'
              : 'Se editó un servicio de Poniente — Fentri',
          html: this.serviceEditedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            lang === 'en' ? 'Jane Smith' : 'María González',
            'Poniente',
            'Yates Alejandro',
            'https://app.fentri.com/service?id=sample-service',
          ),
        };
      case 'video_processing_failed':
        return {
          subject:
            lang === 'en'
              ? 'A video could not be processed — Fentri'
              : 'Un video no pudo procesarse — Fentri',
          html: this.videoProcessingFailedTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Poniente',
            lang === 'en' ? 'Engine inspection' : 'Inspección de motor',
            'Yates Alejandro',
            'https://app.fentri.com/service?id=sample-service',
          ),
        };
      case 'storage_near_limit':
        return {
          subject:
            lang === 'en'
              ? 'Your storage is almost full — Fentri'
              : 'Tu almacenamiento está casi lleno — Fentri',
          html: this.storageNearLimitTemplate(
            lang,
            lang === 'en' ? 'John Doe' : 'Juan Pérez',
            'Yates Alejandro',
            8.2,
            10,
            80,
          ),
        };
      default:
        return null;
    }
  }

  /**
   * Envia una plantilla renderizada con datos de ejemplo a una casilla real,
   * para validacion manual desde la galeria de plantillas (Solo SUPER_ADMIN).
   */
  async sendTestEmail(
    key: string,
    to: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<boolean> {
    if (!this.resend) {
      this.logger.warn(
        `Test email skipped (RESEND_API_KEY not set): ${key} for ${to}`,
      );
      return false;
    }

    const preview = this.renderPreview(key, lang);
    if (!preview) {
      return false;
    }

    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: `[TEST] ${preview.subject}`,
        html: preview.html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send test email (${key}) to ${to}`, err);
      throw err;
    }
  }

  async sendPasswordReset(
    to: string,
    name: string,
    resetUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): password reset for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('password_reset'))) {
      this.logger.log(`Email skipped (template disabled): password_reset for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Reset your password — Fentri'
            : 'Restablece tu contraseña — Fentri',
        html: this.passwordResetTemplate(lang, name, resetUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset to ${to}`, err);
      throw err;
    }
  }

  async sendEmailVerification(
    to: string,
    name: string,
    verifyUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): email verification for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('email_verification'))) {
      this.logger.log(`Email skipped (template disabled): email_verification for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Verify your email — Fentri'
            : 'Verifica tu correo — Fentri',
        html: this.emailVerificationTemplate(lang, name, verifyUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }

  async sendTwoFactorCode(
    to: string,
    name: string,
    code: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): 2FA code for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('two_factor_code'))) {
      this.logger.log(`Email skipped (template disabled): two_factor_code for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your verification code — Fentri'
            : 'Tu código de verificación — Fentri',
        html: this.twoFactorCodeTemplate(lang, name, code),
      });
    } catch (err) {
      this.logger.error(`Failed to send 2FA code to ${to}`, err);
      throw err;
    }
  }

  async sendInvitation(
    to: string,
    inviterName: string,
    orgName: string,
    inviteUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): invitation for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('invitation'))) {
      this.logger.log(`Email skipped (template disabled): invitation for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `You've been invited to ${orgName} on Fentri`
            : `Te invitaron a ${orgName} en Fentri`,
        html: this.invitationTemplate(lang, inviterName, orgName, inviteUrl),
      });
    } catch (err) {
      this.logger.error(`Failed to send invitation to ${to}`, err);
      throw err;
    }
  }

  async sendWelcome(
    to: string,
    name: string,
    orgName: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): welcome email for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('welcome'))) {
      this.logger.log(`Email skipped (template disabled): welcome for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: lang === 'en' ? 'Welcome to Fentri' : 'Bienvenido a Fentri',
        html: this.welcomeTemplate(lang, name, orgName),
      });
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${to}`, err);
      throw err;
    }
  }

  async sendServiceCompletedAdmin(
    to: string,
    adminName: string,
    workerName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): service-completed admin notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('service_completed_admin'))) {
      this.logger.log(`Email skipped (template disabled): service_completed_admin for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `New service logged for ${assetName}`
            : `Nuevo servicio registrado en ${assetName}`,
        html: this.serviceCompletedAdminTemplate(
          lang,
          adminName,
          workerName,
          assetName,
          orgName,
          serviceUrl,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send service-completed admin notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendServiceCompletedExternal(
    to: string,
    externalName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): service-completed external notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('service_completed_external'))) {
      this.logger.log(`Email skipped (template disabled): service_completed_external for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `A service was logged for ${assetName}`
            : `Se registró un servicio en ${assetName}`,
        html: this.serviceCompletedExternalTemplate(
          lang,
          externalName,
          assetName,
          orgName,
          serviceUrl,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send service-completed external notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendNewDeviceLogin(
    to: string,
    name: string,
    device: DeviceLoginInfo,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): new-device login notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('new_device_login'))) {
      this.logger.log(`Email skipped (template disabled): new_device_login for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'New sign-in to your account — Fentri'
            : 'Nuevo inicio de sesión en tu cuenta — Fentri',
        html: this.newDeviceLoginTemplate(lang, name, device),
      });
    } catch (err) {
      this.logger.error(`Failed to send new-device login notice to ${to}`, err);
      throw err;
    }
  }

  async sendPasswordChanged(
    to: string,
    name: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): password-changed notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('password_changed'))) {
      this.logger.log(`Email skipped (template disabled): password_changed for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your password was changed — Fentri'
            : 'Tu contraseña fue actualizada — Fentri',
        html: this.passwordChangedTemplate(lang, name),
      });
    } catch (err) {
      this.logger.error(`Failed to send password-changed notice to ${to}`, err);
      throw err;
    }
  }

  async sendTwoFactorStatusChanged(
    to: string,
    name: string,
    enabled: boolean,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): 2FA-status notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('two_factor_status_changed'))) {
      this.logger.log(`Email skipped (template disabled): two_factor_status_changed for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Two-factor authentication updated — Fentri'
            : 'Verificación en dos pasos actualizada — Fentri',
        html: this.twoFactorStatusChangedTemplate(lang, name, enabled),
      });
    } catch (err) {
      this.logger.error(`Failed to send 2FA-status notice to ${to}`, err);
      throw err;
    }
  }

  async sendPlanChangeApproved(
    to: string,
    name: string,
    orgName: string,
    plan: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): plan-change-approved notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('plan_change_approved'))) {
      this.logger.log(`Email skipped (template disabled): plan_change_approved for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your plan change was approved — Fentri'
            : 'Tu cambio de plan fue aprobado — Fentri',
        html: this.planChangeApprovedTemplate(lang, name, orgName, plan),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send plan-change-approved notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendPlanChangeRejected(
    to: string,
    name: string,
    orgName: string,
    requestedPlan: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): plan-change-rejected notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('plan_change_rejected'))) {
      this.logger.log(`Email skipped (template disabled): plan_change_rejected for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your plan change request was declined — Fentri'
            : 'Tu solicitud de cambio de plan fue rechazada — Fentri',
        html: this.planChangeRejectedTemplate(
          lang,
          name,
          orgName,
          requestedPlan,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send plan-change-rejected notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendSubscriptionStatusChanged(
    to: string,
    name: string,
    orgName: string,
    active: boolean,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): subscription-status notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('subscription_status_changed'))) {
      this.logger.log(`Email skipped (template disabled): subscription_status_changed for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your account status changed — Fentri'
            : 'El estado de tu cuenta cambió — Fentri',
        html: this.subscriptionStatusChangedTemplate(
          lang,
          name,
          orgName,
          active,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send subscription-status notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendDemoExpiringSoon(
    to: string,
    name: string,
    orgName: string,
    daysLeft: number,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): demo-expiring notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('demo_expiring_soon'))) {
      this.logger.log(`Email skipped (template disabled): demo_expiring_soon for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your Fentri demo is about to expire'
            : 'Tu demo de Fentri está por expirar',
        html: this.demoExpiringSoonTemplate(lang, name, orgName, daysLeft),
      });
    } catch (err) {
      this.logger.error(`Failed to send demo-expiring notice to ${to}`, err);
      throw err;
    }
  }

  async sendStorageNearLimit(
    to: string,
    name: string,
    orgName: string,
    usedGb: number,
    quotaGb: number,
    thresholdPct: number,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): storage-near-limit notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('storage_near_limit'))) {
      this.logger.log(`Email skipped (template disabled): storage_near_limit for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'Your storage is almost full — Fentri'
            : 'Tu almacenamiento está casi lleno — Fentri',
        html: this.storageNearLimitTemplate(
          lang,
          name,
          orgName,
          usedGb,
          quotaGb,
          thresholdPct,
        ),
      });
    } catch (err) {
      this.logger.error(`Failed to send storage-near-limit notice to ${to}`, err);
      throw err;
    }
  }

  async sendInvitationAccepted(
    to: string,
    inviterName: string,
    accepteeName: string,
    accepteeEmail: string,
    orgName: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): invitation-accepted notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('invitation_accepted'))) {
      this.logger.log(`Email skipped (template disabled): invitation_accepted for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `${accepteeName} joined your organization — Fentri`
            : `${accepteeName} se unió a tu organización — Fentri`,
        html: this.invitationAcceptedTemplate(
          lang,
          inviterName,
          accepteeName,
          accepteeEmail,
          orgName,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send invitation-accepted notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  async sendUserStatusChanged(
    to: string,
    name: string,
    orgName: string,
    active: boolean,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): user-status notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('user_status_changed'))) {
      this.logger.log(`Email skipped (template disabled): user_status_changed for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `Your access to ${orgName} changed — Fentri`
            : `Tu acceso a ${orgName} cambió — Fentri`,
        html: this.userStatusChangedTemplate(lang, name, orgName, active),
      });
    } catch (err) {
      this.logger.error(`Failed to send user-status notice to ${to}`, err);
      throw err;
    }
  }

  async sendServiceEdited(
    to: string,
    adminName: string,
    editorName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): service-edited notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('service_edited'))) {
      this.logger.log(`Email skipped (template disabled): service_edited for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? `A service for ${assetName} was edited — Fentri`
            : `Se editó un servicio de ${assetName} — Fentri`,
        html: this.serviceEditedTemplate(
          lang,
          adminName,
          editorName,
          assetName,
          orgName,
          serviceUrl,
        ),
      });
    } catch (err) {
      this.logger.error(`Failed to send service-edited notice to ${to}`, err);
      throw err;
    }
  }

  async sendVideoProcessingFailed(
    to: string,
    workerName: string,
    assetName: string,
    serviceTitle: string,
    orgName: string,
    serviceUrl: string,
    lang: 'en' | 'es' = 'es',
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        `Email skipped (RESEND_API_KEY not set): video-processing-failed notice for ${to}`,
      );
      return;
    }
    if (!(await this.isTemplateEnabled('video_processing_failed'))) {
      this.logger.log(`Email skipped (template disabled): video_processing_failed for ${to}`);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject:
          lang === 'en'
            ? 'A video could not be processed — Fentri'
            : 'Un video no pudo procesarse — Fentri',
        html: this.videoProcessingFailedTemplate(
          lang,
          workerName,
          assetName,
          serviceTitle,
          orgName,
          serviceUrl,
        ),
      });
    } catch (err) {
      this.logger.error(
        `Failed to send video-processing-failed notice to ${to}`,
        err,
      );
      throw err;
    }
  }

  private isotipoUrl(): string {
    return this.frontendUrl ? `${this.frontendUrl}/brand/isotipo.png` : '';
  }

  private baseV2(
    content: string,
    lang: 'en' | 'es' = 'es',
    preheader = '',
  ): string {
    const icon = this.isotipoUrl();
    const footerText =
      lang === 'en'
        ? 'This email was sent automatically by <strong style="color:#0D6EFD;">Fentri</strong>. If you didn\'t request this, you can safely ignore it.'
        : 'Este correo fue enviado automáticamente por <strong style="color:#0D6EFD;">Fentri</strong>. Si no lo solicitaste, puedes ignorarlo.';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fentri</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ''}
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:48px 0;">
    <tr>
      <td align="center">
        <table width="540" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(6,15,41,0.10);">
          <tr>
            <td style="padding:0;background:#0A1B3D;background:radial-gradient(circle at 50% 15%, #163873 0%, #0A1B3D 55%);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:32px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        ${
                          icon
                            ? `<td style="vertical-align:middle;padding-right:11px;"><img src="${icon}" alt="Fentri" width="30" height="30" style="width:30px;height:30px;display:block;border:0;" /></td>`
                            : ''
                        }
                        <td style="vertical-align:middle;">
                          <span style="color:#ffffff;font-size:24px;font-weight:900;letter-spacing:-0.3px;">Fentri</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:22px 40px 30px;border-top:1px solid #f0f2f5;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="30" style="vertical-align:top;padding-right:10px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr><td width="30" height="30" style="width:30px;height:30px;border-radius:9px;background:#eef2ff;text-align:center;vertical-align:middle;font-size:13px;">🛡️</td></tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;">
                    <p style="margin:0;font-size:12px;color:#9aa3b2;">${footerText}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private btnV2(url: string, label: string): string {
    return `<a href="${url}" style="display:inline-block;margin-top:4px;padding:15px 32px;background:#0D6EFD;color:#ffffff;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.2px;box-shadow:0 8px 20px rgba(13,110,253,0.35);">${label}</a>`;
  }

  private passwordResetTemplate(
    lang: 'en' | 'es',
    name: string,
    resetUrl: string,
  ): string {
    const copy =
      lang === 'en'
        ? {
            heading: 'Reset your password',
            line1: `Hi ${name}, we received a request to reset your password.`,
            line2:
              'Click the button below to set a new one. The link expires in <strong style="color:#111827;">15 minutes</strong>.',
            button: 'Reset password',
            copyIntro: 'Or copy this link into your browser:',
            preheader:
              'Reset your Fentri password — the link expires in 15 minutes.',
          }
        : {
            heading: 'Restablecer contraseña',
            line1: `Hola ${name}, recibimos una solicitud para restablecer tu contraseña.`,
            line2:
              'Haz clic en el botón para crear una nueva. El enlace expira en <strong style="color:#111827;">15 minutos</strong>.',
            button: 'Restablecer contraseña',
            copyIntro: 'O copia este enlace en tu navegador:',
            preheader:
              'Restablece tu contraseña de Fentri — el enlace expira en 15 minutos.',
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(resetUrl, copy.button)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f7f9fc;border:1px solid #eef1f6;border-radius:16px;">
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" style="vertical-align:top;padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr><td width="36" height="36" style="width:36px;height:36px;border-radius:10px;background:#e8f0fe;text-align:center;vertical-align:middle;font-size:15px;">🔗</td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:13px;color:#6b7280;">${copy.copyIntro}</p>
                  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${resetUrl}" style="color:#0D6EFD;text-decoration:none;">${resetUrl}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
      lang,
      copy.preheader,
    );
  }

  private emailVerificationTemplate(
    lang: 'en' | 'es',
    name: string,
    verifyUrl: string,
  ): string {
    const copy =
      lang === 'en'
        ? {
            heading: 'Verify your email',
            line1: `Hi ${name}, confirm your email address to activate your Fentri account.`,
            line2:
              'Click the button below to verify it. The link expires in <strong style="color:#111827;">24 hours</strong>.',
            button: 'Verify email',
            copyIntro: 'Or copy this link into your browser:',
            preheader:
              'Verify your Fentri email — the link expires in 24 hours.',
          }
        : {
            heading: 'Verifica tu correo',
            line1: `Hola ${name}, confirma tu dirección de correo para activar tu cuenta en Fentri.`,
            line2:
              'Haz clic en el botón para verificarlo. El enlace expira en <strong style="color:#111827;">24 horas</strong>.',
            button: 'Verificar correo',
            copyIntro: 'O copia este enlace en tu navegador:',
            preheader: 'Verifica tu correo en Fentri — el enlace expira en 24 horas.',
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(verifyUrl, copy.button)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f7f9fc;border:1px solid #eef1f6;border-radius:16px;">
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" style="vertical-align:top;padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr><td width="36" height="36" style="width:36px;height:36px;border-radius:10px;background:#e8f0fe;text-align:center;vertical-align:middle;font-size:15px;">🔗</td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:13px;color:#6b7280;">${copy.copyIntro}</p>
                  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${verifyUrl}" style="color:#0D6EFD;text-decoration:none;">${verifyUrl}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
      lang,
      copy.preheader,
    );
  }

  private twoFactorCodeTemplate(
    lang: 'en' | 'es',
    name: string,
    code: string,
  ): string {
    const copy =
      lang === 'en'
        ? {
            heading: 'Verification code',
            line1: `Hi ${name}, use the following code to verify your identity on Fentri.`,
            note: 'The code expires in <strong style="color:#111827;">10 minutes</strong>. Don\'t share it with anyone.',
            preheader: 'Your Fentri verification code — expires in 10 minutes.',
          }
        : {
            heading: 'Código de verificación',
            line1: `Hola ${name}, usa el siguiente código para verificar tu identidad en Fentri.`,
            note: 'El código expira en <strong style="color:#111827;">10 minutos</strong>. No lo compartas con nadie.',
            preheader: 'Tu código de verificación de Fentri — expira en 10 minutos.',
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:20px auto;">
        <tr>
          <td style="padding:20px 40px;background:#eef2ff;border:1px solid #e0e7ff;border-radius:16px;text-align:center;">
            <span style="font-size:36px;font-weight:900;letter-spacing:0.4em;color:#0D6EFD;font-family:'Courier New',monospace;">${code}</span>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">${copy.note}</p>
    `,
      lang,
      copy.preheader,
    );
  }

  private invitationTemplate(
    lang: 'en' | 'es',
    inviterName: string,
    orgName: string,
    inviteUrl: string,
  ): string {
    const copy =
      lang === 'en'
        ? {
            heading: `You've been invited to ${orgName}`,
            line1: `<strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on Fentri.`,
            line2:
              'Accept the invitation to create your account and get started. This invitation expires in <strong style="color:#111827;">7 days</strong>.',
            button: 'Accept invitation',
            copyIntro: 'Or copy this link into your browser:',
            preheader: `${inviterName} invited you to join ${orgName} on Fentri.`,
          }
        : {
            heading: `Te invitaron a ${orgName}`,
            line1: `<strong>${inviterName}</strong> te ha invitado a unirte a <strong>${orgName}</strong> en Fentri.`,
            line2:
              'Acepta la invitación para crear tu cuenta y empezar a trabajar. La invitación expira en <strong style="color:#111827;">7 días</strong>.',
            button: 'Aceptar invitación',
            copyIntro: 'O copia este enlace en tu navegador:',
            preheader: `${inviterName} te invitó a unirte a ${orgName} en Fentri.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(inviteUrl, copy.button)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f7f9fc;border:1px solid #eef1f6;border-radius:16px;">
        <tr>
          <td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td width="36" style="vertical-align:top;padding-right:12px;">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr><td width="36" height="36" style="width:36px;height:36px;border-radius:10px;background:#e8f0fe;text-align:center;vertical-align:middle;font-size:15px;">🔗</td></tr>
                  </table>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 2px;font-size:13px;color:#6b7280;">${copy.copyIntro}</p>
                  <p style="margin:0;font-size:13px;word-break:break-all;"><a href="${inviteUrl}" style="color:#0D6EFD;text-decoration:none;">${inviteUrl}</a></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `,
      lang,
      copy.preheader,
    );
  }

  private welcomeTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const dashboardUrl = this.frontendUrl
      ? `${this.frontendUrl}/dashboard`
      : '#';
    const copy =
      lang === 'en'
        ? {
            heading: `Welcome, ${firstName}!`,
            line1: `Your account is ready — you're now part of <strong>${orgName}</strong> on Fentri.`,
            line2:
              'From your dashboard you can start managing assets, logging services, and keeping your team in sync.',
            button: 'Go to dashboard',
            preheader: `Welcome to Fentri — your ${orgName} account is ready.`,
          }
        : {
            heading: `¡Bienvenido, ${firstName}!`,
            line1: `Tu cuenta ya está lista — ahora formas parte de <strong>${orgName}</strong> en Fentri.`,
            line2:
              'Desde tu panel puedes empezar a gestionar activos, registrar servicios y mantener a tu equipo sincronizado.',
            button: 'Ir al panel',
            preheader: `Bienvenido a Fentri — tu cuenta de ${orgName} ya está lista.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(dashboardUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private serviceCompletedAdminTemplate(
    lang: 'en' | 'es',
    adminName: string,
    workerName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
  ): string {
    const firstName = adminName.trim().split(' ')[0] || adminName;
    const copy =
      lang === 'en'
        ? {
            heading: 'New service completed',
            line1: `Hi ${firstName}, <strong>${workerName}</strong> logged a new service for <strong>${assetName}</strong>.`,
            line2: `You can review the details and attached photos from the ${orgName} dashboard.`,
            button: 'View service',
            preheader: `${workerName} logged a service for ${assetName}.`,
          }
        : {
            heading: 'Nuevo servicio completado',
            line1: `Hola ${firstName}, <strong>${workerName}</strong> registró un nuevo servicio en <strong>${assetName}</strong>.`,
            line2: `Puedes revisar los detalles y las fotos adjuntas desde el panel de ${orgName}.`,
            button: 'Ver servicio',
            preheader: `${workerName} registró un servicio en ${assetName}.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(serviceUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private serviceCompletedExternalTemplate(
    lang: 'en' | 'es',
    externalName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
  ): string {
    const firstName = externalName.trim().split(' ')[0] || externalName;
    const copy =
      lang === 'en'
        ? {
            heading: `New service for ${assetName}`,
            line1: `Hi ${firstName}, a new service was just completed for <strong>${assetName}</strong>.`,
            line2: `You can view the details and photos from your ${orgName} dashboard on Fentri.`,
            button: 'View service',
            preheader: `New service logged for ${assetName}.`,
          }
        : {
            heading: `Nuevo servicio en ${assetName}`,
            line1: `Hola ${firstName}, se acaba de completar un nuevo servicio en <strong>${assetName}</strong>.`,
            line2: `Puedes ver el detalle y las fotos desde tu panel de ${orgName} en Fentri.`,
            button: 'Ver servicio',
            preheader: `Nuevo servicio registrado en ${assetName}.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(serviceUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private newDeviceLoginTemplate(
    lang: 'en' | 'es',
    name: string,
    device: DeviceLoginInfo,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const deviceLabel = [device.browser, device.os]
      .filter(Boolean)
      .join(' · ');
    const locationLabel = [device.city, device.country]
      .filter(Boolean)
      .join(', ');
    const copy =
      lang === 'en'
        ? {
            heading: 'New sign-in detected',
            line1: `Hi ${firstName}, we noticed a sign-in to your account from a device or location we didn't recognize.`,
            line2:
              "If this was you, no action is needed. If you don't recognize this activity, we recommend changing your password right away.",
            button: 'Review my sessions',
            deviceRow: 'Device',
            locationRow: 'Location',
            ipRow: 'IP address',
            unknown: 'Unknown',
            preheader: 'New sign-in detected on your Fentri account.',
          }
        : {
            heading: 'Nuevo inicio de sesión detectado',
            line1: `Hola ${firstName}, detectamos un inicio de sesión en tu cuenta desde un dispositivo o ubicación que no reconocíamos.`,
            line2:
              'Si fuiste tú, no necesitas hacer nada. Si no reconoces esta actividad, te recomendamos cambiar tu contraseña de inmediato.',
            button: 'Revisar mis sesiones',
            deviceRow: 'Dispositivo',
            locationRow: 'Ubicación',
            ipRow: 'Dirección IP',
            unknown: 'Desconocido',
            preheader: 'Detectamos un nuevo inicio de sesión en tu cuenta de Fentri.',
          };

    const rows: [string, string][] = [
      [copy.deviceRow, deviceLabel || copy.unknown],
      [copy.locationRow, locationLabel || copy.unknown],
      [copy.ipRow, device.ipAddress || copy.unknown],
    ];

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;background:#f7f9fc;border:1px solid #eef1f6;border-radius:16px;">
        <tr>
          <td style="padding:18px 20px;">
            ${rows
              .map(
                ([label, value]) => `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:6px;">
                <tr>
                  <td style="font-size:12px;color:#9ca3af;padding:4px 0;width:110px;">${label}</td>
                  <td style="font-size:13px;color:#111827;font-weight:700;padding:4px 0;">${value}</td>
                </tr>
              </table>
            `,
              )
              .join('')}
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private passwordChangedTemplate(lang: 'en' | 'es', name: string): string {
    const firstName = name.trim().split(' ')[0] || name;
    const resetUrl = this.frontendUrl
      ? `${this.frontendUrl}/forgot-password`
      : '#';
    const copy =
      lang === 'en'
        ? {
            heading: 'Your password was changed',
            line1: `Hi ${firstName}, this confirms your account password was successfully updated.`,
            line2:
              "If you didn't make this change, reset your password right away.",
            button: 'Reset password',
            preheader: 'Your Fentri password was just changed.',
          }
        : {
            heading: 'Tu contraseña fue actualizada',
            line1: `Hola ${firstName}, confirmamos que la contraseña de tu cuenta fue actualizada correctamente.`,
            line2:
              'Si no realizaste este cambio, restablece tu contraseña de inmediato.',
            button: 'Restablecer contraseña',
            preheader: 'Tu contraseña de Fentri fue actualizada.',
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(resetUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private twoFactorStatusChangedTemplate(
    lang: 'en' | 'es',
    name: string,
    enabled: boolean,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const copy =
      lang === 'en'
        ? {
            heading: enabled
              ? 'Two-factor authentication enabled'
              : 'Two-factor authentication disabled',
            line1: enabled
              ? `Hi ${firstName}, two-factor authentication (2FA) was just enabled on your account. Your account now has an extra layer of security.`
              : `Hi ${firstName}, two-factor authentication (2FA) was just disabled on your account.`,
            line2:
              "If you didn't make this change, review your account security right away.",
            button: 'Review security settings',
            preheader: enabled
              ? '2FA was enabled on your Fentri account.'
              : '2FA was disabled on your Fentri account.',
          }
        : {
            heading: enabled
              ? 'Verificación en dos pasos activada'
              : 'Verificación en dos pasos desactivada',
            line1: enabled
              ? `Hola ${firstName}, la verificación en dos pasos (2FA) fue activada en tu cuenta. Ahora tienes una capa adicional de seguridad.`
              : `Hola ${firstName}, la verificación en dos pasos (2FA) fue desactivada en tu cuenta.`,
            line2:
              'Si no realizaste este cambio, revisa la seguridad de tu cuenta de inmediato.',
            button: 'Revisar configuración de seguridad',
            preheader: enabled
              ? 'Se activó la verificación en dos pasos en tu cuenta de Fentri.'
              : 'Se desactivó la verificación en dos pasos en tu cuenta de Fentri.',
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private planChangeApprovedTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    plan: string,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const planLabel = plan.charAt(0) + plan.slice(1).toLowerCase();
    const copy =
      lang === 'en'
        ? {
            heading: 'Your plan change was approved',
            line1: `Hi ${firstName}, your request to switch <strong>${orgName}</strong> to the <strong>${planLabel}</strong> plan was approved.`,
            line2: 'You can now enjoy your new plan limits and features.',
            button: 'View my plan',
            preheader: `${orgName} is now on the ${planLabel} plan.`,
          }
        : {
            heading: 'Tu cambio de plan fue aprobado',
            line1: `Hola ${firstName}, tu solicitud para cambiar <strong>${orgName}</strong> al plan <strong>${planLabel}</strong> fue aprobada.`,
            line2: 'Ya puedes disfrutar de los nuevos límites y funciones de tu plan.',
            button: 'Ver mi plan',
            preheader: `${orgName} ya está en el plan ${planLabel}.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private planChangeRejectedTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    requestedPlan: string,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const planLabel =
      requestedPlan.charAt(0) + requestedPlan.slice(1).toLowerCase();
    const copy =
      lang === 'en'
        ? {
            heading: 'Your plan change request was declined',
            line1: `Hi ${firstName}, your request to switch <strong>${orgName}</strong> to the <strong>${planLabel}</strong> plan wasn't approved.`,
            line2: 'If you have questions, reach out to support for more details.',
            button: 'View my plan',
            preheader: `Your ${planLabel} plan request for ${orgName} was declined.`,
          }
        : {
            heading: 'Tu solicitud de cambio de plan fue rechazada',
            line1: `Hola ${firstName}, tu solicitud para cambiar <strong>${orgName}</strong> al plan <strong>${planLabel}</strong> no fue aprobada.`,
            line2: 'Si tienes dudas, contacta a soporte para más información.',
            button: 'Ver mi plan',
            preheader: `Tu solicitud de plan ${planLabel} para ${orgName} fue rechazada.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private subscriptionStatusChangedTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    active: boolean,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const copy =
      lang === 'en'
        ? {
            heading: active ? 'Your account was reactivated' : 'Your account was suspended',
            line1: active
              ? `Hi ${firstName}, the <strong>${orgName}</strong> account was reactivated. You can access it normally again.`
              : `Hi ${firstName}, the <strong>${orgName}</strong> account was suspended. Access is temporarily restricted.`,
            line2: active
              ? 'Thanks for staying with us.'
              : "If you think this is a mistake, please contact support.",
            button: active ? 'Go to dashboard' : 'View my account',
            preheader: active
              ? `${orgName} was reactivated on Fentri.`
              : `${orgName} was suspended on Fentri.`,
          }
        : {
            heading: active ? 'Tu cuenta fue reactivada' : 'Tu cuenta fue suspendida',
            line1: active
              ? `Hola ${firstName}, la cuenta de <strong>${orgName}</strong> fue reactivada. Ya puedes acceder con normalidad.`
              : `Hola ${firstName}, la cuenta de <strong>${orgName}</strong> fue suspendida. El acceso está temporalmente restringido.`,
            line2: active
              ? 'Gracias por seguir con nosotros.'
              : 'Si crees que esto es un error, contacta a soporte.',
            button: active ? 'Ir al panel' : 'Ver mi cuenta',
            preheader: active
              ? `${orgName} fue reactivada en Fentri.`
              : `${orgName} fue suspendida en Fentri.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private demoExpiringSoonTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    daysLeft: number,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const copy =
      lang === 'en'
        ? {
            heading:
              daysLeft <= 1
                ? 'Your demo expires tomorrow'
                : `Your demo expires in ${daysLeft} days`,
            line1: `Hi ${firstName}, the <strong>${orgName}</strong> demo on Fentri is about to expire.`,
            line2: 'Upgrade your plan to keep enjoying all features without interruption.',
            button: 'Upgrade plan',
            preheader: `${orgName}'s Fentri demo expires in ${daysLeft} day(s).`,
          }
        : {
            heading:
              daysLeft <= 1
                ? 'Tu demo expira mañana'
                : `Tu demo expira en ${daysLeft} días`,
            line1: `Hola ${firstName}, la demo de <strong>${orgName}</strong> en Fentri está por expirar.`,
            line2: 'Actualiza tu plan para seguir disfrutando de todas las funciones sin interrupciones.',
            button: 'Actualizar plan',
            preheader: `La demo de ${orgName} en Fentri expira en ${daysLeft} día(s).`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private storageNearLimitTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    usedGb: number,
    quotaGb: number,
    thresholdPct: number,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const settingsUrl = this.frontendUrl
      ? `${this.frontendUrl}/settings`
      : '#';
    const isFull = thresholdPct >= 100;
    const copy =
      lang === 'en'
        ? {
            heading: isFull
              ? 'Your storage limit was reached'
              : 'Your storage is almost full',
            line1: `Hi ${firstName}, <strong>${orgName}</strong> has used <strong>${usedGb} GB</strong> of its <strong>${quotaGb} GB</strong> storage quota (${thresholdPct}%).`,
            line2: isFull
              ? 'New uploads may be blocked until you free up space or upgrade your plan.'
              : 'Consider freeing up space or upgrading your plan to avoid interruptions.',
            button: 'Review storage',
            preheader: `${orgName} has used ${thresholdPct}% of its storage quota on Fentri.`,
          }
        : {
            heading: isFull
              ? 'Se alcanzó el límite de almacenamiento'
              : 'Tu almacenamiento está casi lleno',
            line1: `Hola ${firstName}, <strong>${orgName}</strong> ha usado <strong>${usedGb} GB</strong> de su cuota de <strong>${quotaGb} GB</strong> (${thresholdPct}%).`,
            line2: isFull
              ? 'Las nuevas cargas podrían bloquearse hasta liberar espacio o actualizar el plan.'
              : 'Considera liberar espacio o actualizar tu plan para evitar interrupciones.',
            button: 'Revisar almacenamiento',
            preheader: `${orgName} ha usado el ${thresholdPct}% de su cuota de almacenamiento en Fentri.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(settingsUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private invitationAcceptedTemplate(
    lang: 'en' | 'es',
    inviterName: string,
    accepteeName: string,
    accepteeEmail: string,
    orgName: string,
  ): string {
    const firstName = inviterName.trim().split(' ')[0] || inviterName;
    const usersUrl = this.frontendUrl ? `${this.frontendUrl}/users` : '#';
    const copy =
      lang === 'en'
        ? {
            heading: 'Your invitation was accepted',
            line1: `Hi ${firstName}, <strong>${accepteeName}</strong> (${accepteeEmail}) accepted your invitation and is now part of <strong>${orgName}</strong>.`,
            line2: 'You can review your team from the dashboard.',
            button: 'View team',
            preheader: `${accepteeName} joined ${orgName} on Fentri.`,
          }
        : {
            heading: 'Tu invitación fue aceptada',
            line1: `Hola ${firstName}, <strong>${accepteeName}</strong> (${accepteeEmail}) aceptó tu invitación y ya es parte de <strong>${orgName}</strong>.`,
            line2: 'Puedes revisar tu equipo desde el panel.',
            button: 'Ver equipo',
            preheader: `${accepteeName} se unió a ${orgName} en Fentri.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(usersUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private userStatusChangedTemplate(
    lang: 'en' | 'es',
    name: string,
    orgName: string,
    active: boolean,
  ): string {
    const firstName = name.trim().split(' ')[0] || name;
    const loginUrl = this.frontendUrl ? `${this.frontendUrl}/login` : '#';
    const homeUrl = this.frontendUrl || '#';
    const copy =
      lang === 'en'
        ? {
            heading: active ? 'Your access was reactivated' : 'Your access was deactivated',
            line1: active
              ? `Hi ${firstName}, your access to <strong>${orgName}</strong> on Fentri was reactivated. You can sign in normally again.`
              : `Hi ${firstName}, your access to <strong>${orgName}</strong> on Fentri was deactivated.`,
            line2: active
              ? 'Welcome back.'
              : 'If you think this is a mistake, contact an admin in your organization.',
            button: active ? 'Sign in' : 'Go to Fentri',
            preheader: active
              ? `Your access to ${orgName} was reactivated.`
              : `Your access to ${orgName} was deactivated.`,
          }
        : {
            heading: active ? 'Tu acceso fue reactivado' : 'Tu acceso fue desactivado',
            line1: active
              ? `Hola ${firstName}, tu acceso a <strong>${orgName}</strong> en Fentri fue reactivado. Ya puedes iniciar sesión con normalidad.`
              : `Hola ${firstName}, tu acceso a <strong>${orgName}</strong> en Fentri fue desactivado.`,
            line2: active
              ? 'Que bueno tenerte de vuelta.'
              : 'Si crees que esto es un error, contacta a un administrador de tu organización.',
            button: active ? 'Iniciar sesión' : 'Ir a Fentri',
            preheader: active
              ? `Tu acceso a ${orgName} fue reactivado.`
              : `Tu acceso a ${orgName} fue desactivado.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 6px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(active ? loginUrl : homeUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private serviceEditedTemplate(
    lang: 'en' | 'es',
    adminName: string,
    editorName: string,
    assetName: string,
    orgName: string,
    serviceUrl: string,
  ): string {
    const firstName = adminName.trim().split(' ')[0] || adminName;
    const copy =
      lang === 'en'
        ? {
            heading: 'Service edited',
            line1: `Hi ${firstName}, <strong>${editorName}</strong> edited a service for <strong>${assetName}</strong>.`,
            line2: `You can review the changes from the ${orgName} dashboard.`,
            button: 'View service',
            preheader: `${editorName} edited a service for ${assetName}.`,
          }
        : {
            heading: 'Servicio editado',
            line1: `Hola ${firstName}, <strong>${editorName}</strong> editó un servicio de <strong>${assetName}</strong>.`,
            line2: `Puedes revisar los cambios desde el panel de ${orgName}.`,
            button: 'Ver servicio',
            preheader: `${editorName} editó un servicio de ${assetName}.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(serviceUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }

  private videoProcessingFailedTemplate(
    lang: 'en' | 'es',
    workerName: string,
    assetName: string,
    serviceTitle: string,
    orgName: string,
    serviceUrl: string,
  ): string {
    const firstName = workerName.trim().split(' ')[0] || workerName;
    const copy =
      lang === 'en'
        ? {
            heading: 'A video could not be processed',
            line1: `Hi ${firstName}, the video you uploaded for <strong>${serviceTitle}</strong> (${assetName}) could not be processed.`,
            line2: `Try uploading it again from the service in ${orgName}.`,
            button: 'View service',
            preheader: `Video processing failed for ${serviceTitle}.`,
          }
        : {
            heading: 'Un video no pudo procesarse',
            line1: `Hola ${firstName}, el video que subiste para <strong>${serviceTitle}</strong> (${assetName}) no pudo procesarse correctamente.`,
            line2: `Intenta subirlo de nuevo desde el servicio en ${orgName}.`,
            button: 'Ver servicio',
            preheader: `Falló el procesamiento de un video en ${serviceTitle}.`,
          };

    return this.baseV2(
      `
      <h2 style="margin:0 0 10px;font-size:22px;font-weight:900;color:#111827;">${copy.heading}</h2>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line1}</p>
      <p style="margin:0 0 4px;font-size:15px;color:#6b7280;">${copy.line2}</p>
      <div style="text-align:center;margin-top:20px;">${this.btnV2(serviceUrl, copy.button)}</div>
    `,
      lang,
      copy.preheader,
    );
  }
}
