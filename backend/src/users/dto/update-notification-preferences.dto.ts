import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({
    description: 'Recibir notificaciones operativas por correo (servicio completado/editado, plan, suscripcion, almacenamiento, etc.).',
  })
  @IsOptional()
  @IsBoolean()
  email_notifications_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Recibir alertas de seguridad de la cuenta (nuevo dispositivo, contraseña cambiada, 2FA, acceso cambiado).',
  })
  @IsOptional()
  @IsBoolean()
  security_alerts_enabled?: boolean;
}
