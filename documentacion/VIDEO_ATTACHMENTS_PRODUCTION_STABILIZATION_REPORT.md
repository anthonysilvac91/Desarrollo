# Cierre de estabilizacion de attachments desacoplados

Fecha: 2026-06-22

## Estado ejecutivo

No se puede marcar la funcionalidad como lista para activar en produccion.

Se estabilizaron piezas criticas del backend/frontend ya existentes, se agrego mantenimiento programable, lock distribuido, reconciliacion, endurecimiento de cuotas, snapshots de estados y pruebas unitarias. Sin embargo, quedan criterios de aceptacion no verificados o no cubiertos por la arquitectura actual:

- `documentacion/VIDEO_ATTACHMENTS_IMPL_PRODUCTION_V2.md` no existe en el workspace.
- No hay variables de entorno Supabase/DATABASE cargadas en esta sesion para validar contra staging real.
- El flujo desacoplado sigue limitado a `VIDEO`; imagenes y documentos continuan usando el flujo multipart existente.
- No se ejecutaron pruebas reales en iPhone/Safari/PWA, Android/Chrome/PWA, desktop Safari ni E2E criticos.
- `npm run lint` global falla por deuda amplia ya presente en backend/frontend.

## Matriz de cumplimiento

| Requisito | Estado verificado | Archivos implicados | Prueba/evidencia |
|---|---|---|---|
| Feature flag global apagado | Cumple | `UploadPolicyService`, docs | `SERVICE_VIDEO_UPLOADS_ENABLED=false` en docs; no se cambio a true |
| Videos no pasan por Railway/Vercel | Cumple para videos directos | `SupabaseStorageService`, `UploadsService`, `tusUploader` | flujo usa signed upload token + TUS |
| Multer memoryStorage no usado para videos grandes | Cumple para videos directos | `NewServiceForm`, `uploads/*` | videos no se agregan al multipart |
| Cleanup real idempotente | Implementado | `upload-cleanup.service.ts`, `upload-maintenance.service.ts`, `maintenance-lock.service.ts` | `upload-cleanup.service.spec.ts` |
| Job horario persistente | Parcial | `railway.json`, `backend/scripts/upload-maintenance.ts` | configurado como cron horario; no validado contra Railway real |
| Lock distribuido | Implementado | `MaintenanceJobLock`, `maintenance-lock.service.ts` | cubierto por doble ejecucion de cleanup |
| Reconciliacion storage | Implementado backend | `upload-reconciliation.service.ts`, schema | `upload-reconciliation.service.spec.ts` |
| Ejecucion manual admin | Implementado | `uploads.controller.ts` | endpoints `POST /uploads/reconcile`, `POST /uploads/maintenance/run` |
| Estados NONE/UPLOADING/PARTIALLY_READY/READY/FAILED | Implementado en snapshot | `uploads.service.ts`, `services.service.ts` | backend tests y build |
| Listado/detalle con pendientes/fallidos | Implementado | `services.service.ts`, `ServiceDrawer`, `ServiceDetailView`, service page | frontend build |
| Otro dispositivo ve backend canonico | Parcial | `services.service.ts`, realtime emit | requiere E2E multi-dispositivo |
| EXTERNAL solo READY | Parcial | `services.service.ts`, `uploads.service.ts` | requiere tests multitenant completos |
| Persistencia/reanudacion TUS | Parcial | `UploadQueueProvider`, `tusUploader` | build; falta prueba browser real |
| needs_file y reseleccion | Implementado UI | `UploadQueueProvider`, `UploadQueueItem` | frontend build |
| Seguridad multitenant | Parcial | `uploads.service.ts`, controllers | faltan specs obligatorias por rol/tenant |
| Cuotas transaccionales | Implementado backend | `uploads.service.ts`, schema | backend tests; falta test concurrente DB real |
| Confirmacion idempotente | Implementado defensivo | `ServiceAttachment.upload_id @unique`, `uploads.service.ts` | backend tests pasan |
| Validacion MP4/MOV/WebM parcial | Implementado | `video-signature-validation.ts`, `upload-verification.service.ts` | `video-signature-validation.spec.ts` |
| Eliminacion de objeto invalido | Implementado | `uploads.service.ts` | backend tests pasan |
| Rate limits por endpoint | Parcial | `uploads.controller.ts` | decoradores `@Throttle`; falta clave org/uploadId |
| Playback bajo demanda | Implementado | `VideoAttachmentCard`, `VideoPlayerModal`, `uploads.service.ts` | frontend/backend build |
| Supabase real staging | No verificado | entorno externo | sin credenciales ni env cargadas |
| Imagenes/documentos desacoplados | No cumple | `uploads.service.ts`, `NewServiceForm` | endpoint rechaza no-VIDEO |
| Observabilidad | Parcial | `uploads/*` | logs JSON; faltan dashboard/alertas reales |
| Rollback/activacion | Documentado parcialmente | este documento y summary | falta validacion operativa real |

## Archivos funcionales agregados o modificados

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260622000100_service_video_uploads/migration.sql`
- `backend/package.json`
- `backend/scripts/upload-maintenance.ts`
- `backend/src/uploads/*`
- `backend/src/common/files/video-signature-validation.ts`
- `backend/src/common/files/video-signature-validation.spec.ts`
- `backend/src/services/services.service.ts`
- `backend/src/services/services.controller.ts`
- `backend/src/services/dto/create-service.dto.ts`
- `backend/src/organizations/organizations.service.spec.ts`
- `backend/src/services/services.service.spec.ts`
- `backend/src/dashboard/dashboard.service.spec.ts`
- `backend/src/users/users.controller.spec.ts`
- `frontend/src/providers/UploadQueueProvider.tsx`
- `frontend/src/components/uploads/*`
- `frontend/src/components/services/ServiceDetailView.tsx`
- `frontend/src/components/services/ServiceDrawer.tsx`
- `frontend/src/components/services/VideoAttachmentCard.tsx`
- `frontend/src/components/services/VideoPlayerModal.tsx`
- `frontend/src/components/assets/NewServiceForm.tsx`
- `frontend/src/app/(main)/service/page.tsx`
- `frontend/src/lib/uploads/tusUploader.ts`
- `frontend/src/services/uploadService.ts`
- `frontend/src/services/services.service.ts`
- `frontend/src/types/uploads.ts`
- `frontend/src/lib/translations.ts`
- `railway.json`

## Migraciones creadas

- `20260622000100_service_video_uploads`

Incluye modelos/columnas para `FileUpload`, `OrganizationStorageUsage`, snapshots de attachments, flags por organizacion, `MaintenanceJobLock`, `UploadMaintenanceRun`, `StorageReconciliationIssue` y unicidad `ServiceAttachment.upload_id`.

## Variables de entorno

```env
SERVICE_VIDEO_UPLOADS_ENABLED=false
SERVICE_VIDEO_MAX_FILE_BYTES=524288000
SERVICE_UPLOAD_INTENT_TTL_MINUTES=1440
SERVICE_UPLOAD_MAX_BATCH_SIZE=20
SERVICE_UPLOAD_DEFAULT_CONCURRENCY=2
SERVICE_UPLOAD_ALLOWED_VIDEO_MIMES=video/mp4,video/webm,video/quicktime
SERVICE_UPLOAD_CLEANUP_ENABLED=true
SERVICE_MEDIA_SIGNED_URL_TTL_SECONDS=600
ORG_STORAGE_QUOTA_BYTES=104857600
```

En esta sesion no habia variables de entorno `SUPABASE`, `DATABASE` o `STAGING` exportadas en el proceso.

## Jobs y frecuencia

- `npm run uploads:maintenance`
- Frecuencia configurada: cada hora (`0 * * * *`)
- Ejecuta `UploadMaintenanceService.runHourlyMaintenance()`
- Usa lock distribuido `upload-maintenance-hourly`
- Ejecuta cleanup y reconciliacion bajo el mismo ciclo

## Tests agregados

- `backend/src/uploads/upload-cleanup.service.spec.ts`
- `backend/src/uploads/upload-reconciliation.service.spec.ts`
- `backend/src/common/files/video-signature-validation.spec.ts`

## Comandos ejecutados

| Comando | Resultado |
|---|---|
| `npx prisma validate` | OK |
| `npx prisma generate` | OK |
| `npm run build` backend | OK |
| `npx tsc --noEmit` backend | OK |
| `npm run test` backend | OK, 22 suites, 128 tests |
| `npm run build` frontend | OK |
| `npm run lint` backend | Falla global: 1708 errores, 233 warnings, principalmente deuda `no-unsafe-*` en multiples modulos |
| `npm run lint` frontend | Falla global: 98 errores, 81 warnings, deuda React/any en multiples modulos |
| `npx eslint` frontend acotado a cola/uploads/service client | OK |
| `npx eslint` backend acotado a uploads/services | Falla por reglas `no-unsafe-*` en servicios existentes y nuevos |

## Evidencia Supabase real

No ejecutada. El proceso actual no tiene credenciales ni variables de staging cargadas, y no existe evidencia local de bucket privado/TUS/pausa/reanudacion/cancelacion/expiracion/playback contra Supabase real.

## Riesgos que bloquean produccion

- Falta validacion Supabase staging real.
- Falta cobertura completa multitenant ADMIN/WORKER/EXTERNAL/otro tenant.
- Imagenes y documentos no usan aun la ruta desacoplada directa.
- Rate limit por organizacion/uploadId no esta probado.
- Lint global no pasa.
- E2E y dispositivos reales no ejecutados.

## Despliegue

1. Aplicar migracion `20260622000100_service_video_uploads`.
2. Desplegar backend con `SERVICE_VIDEO_UPLOADS_ENABLED=false`.
3. Desplegar frontend.
4. Crear o verificar el servicio cron horario `npm run uploads:maintenance`.
5. Habilitar por organizacion solo con `Organization.video_uploads_enabled=true`.
6. Validar una organizacion piloto con bucket privado Supabase y TUS.

## Rollback

1. Poner `SERVICE_VIDEO_UPLOADS_ENABLED=false`.
2. Poner `Organization.video_uploads_enabled=false` para organizaciones piloto.
3. Mantener tablas y datos creados por la migracion.
4. Detener el job `uploads:maintenance` si genera impacto operativo.
5. Seguir usando el flujo multipart existente para imagenes/documentos.
6. No borrar objetos ni tablas durante rollback.

## Confirmaciones

- El feature flag global permanece apagado por configuracion documentada.
- No hay evidencia suficiente para confirmar que no queden pendientes tecnicos relacionados.
- No hay evidencia suficiente para confirmar riesgo residual cero.
