# Matriz de cierre de produccion: attachments desacoplados

Fecha: 2026-06-22

Nota de inspeccion: `documentacion/VIDEO_ATTACHMENTS_IMPL_PRODUCTION_V2.md` no existe en el workspace. Esta matriz compara la implementacion actual contra `VIDEO_ATTACHMENTS_IMPLEMENTATION_SUMMARY.md`, `VIDEO_ATTACHMENTS_IMPL.md` y los requisitos operativos solicitados.

| Requisito | Estado actual | Archivo implicado | Cambio necesario | Prueba que lo valida |
|---|---|---|---|---|
| Cleanup horario persistente | Existe servicio no programado | `backend/src/uploads/upload-cleanup.service.ts` | CLI cron con lock DB, backoff, metricas, Railway cron | spec de expiracion y doble ejecucion |
| Reconciliacion storage | No existe reconciliacion completa de snapshots | `backend/src/storage/storage-governance.service.ts`, `backend/src/uploads/*` | Servicio de reconciliacion por org, lock DB, ejecucion manual y cron | spec de desincronizacion READY/reservas/orfanos |
| Lock distribuido | No existe | `backend/prisma/schema.prisma` | Tabla `MaintenanceJobLock` y adquisicion transaccional | spec de doble ejecucion |
| Estados ServiceAttachmentUploadStatus | Parcial, calculo duplica attachments confirmados | `backend/src/uploads/uploads.service.ts`, `backend/src/services/services.service.ts` | Snapshot reconstruido desde `FileUpload` + `ServiceAttachment` sin doble conteo | spec de NONE/UPLOADING/PARTIALLY_READY/READY/FAILED |
| Placeholders de pendientes | Backend no serializa uploads pendientes con attachments | `services.service.ts`, frontend detalle/drawer | Incluir `pendingAttachments` derivados de `FileUpload` | tests detalle/listado |
| EXTERNAL solo READY | Parcial: servicios filtran owner, attachments no se reducen por estado pendiente | `services.service.ts`, `uploads.service.ts` | Ocultar uploads no confirmados y validar playback READY/owner/public | tests permisos EXTERNAL |
| WORKER acceso restringido | No se aplica en uploads | `uploads.service.ts`, `assets.service.ts` | Validar `worker_restricted_access`/`WorkerAssetAccess` | tests permisos worker |
| Cuota concurrente | Parcial: valida antes de transaccion y reserva despues | `upload-policy.service.ts`, `uploads.service.ts` | Recalculo y reserva dentro de transaccion serializable, clamps no negativos | test intents concurrentes |
| Diferencia declarado/real | No libera diferencia; solo libera reserva completa y usa StoredFile | `uploads.service.ts` | Confirmacion ajusta contadores ready/reserved con real bytes | test tamano real distinto |
| Confirmacion idempotente | Parcial; carrera puede crear duplicado antes de unique | `uploads.service.ts`, schema | `FileUpload.confirmed_attachment_id` o consulta transaccional con unique manejado | test doble confirmacion concurrente |
| Validacion falsa e invalida | Parcial; no elimina objeto invalido | `upload-verification.service.ts` | Borrar objeto al fallar verificacion y marcar FAILED | tests MIME/ext/tamano/truncado |
| Rate limits especificos | No existen | `uploads.controller.ts` | Guards/throttles por endpoint y claves user/org/upload | tests throttling |
| Playback bajo demanda | Parcial OK; sin evento de observabilidad | `uploads.service.ts` | Log/evento sin URL, TTL corto, permisos descarga | tests playback |
| TUS reanudable robusto | Parcial, localStorage sin re-seleccion | `UploadQueueProvider.tsx` | IndexedDB metadata, reattach file, fingerprint validation, reconcile backend | tests frontend refresh/needs_file |
| Imagenes/documentos desacoplados | No implementado; siguen por Multer | `NewServiceForm.tsx`, `uploads.service.ts` | Extender intents a IMAGE/DOCUMENT pequenos/grandes, mantener compatibilidad | e2e imagen/documento/video |
| Observabilidad | Logs basicos | `uploads/*`, logger | Eventos estructurados y metricas persistibles | specs/log assertions y doc queries |
| Supabase staging real | No ejecutado en workspace | scripts de prueba | Script de integracion real con env staging | resultado documentado del script |
| Rollback/activacion | Resumen parcial | documentacion | Runbook completo activacion/desactivacion/rollback | revision documental |
| Calidad | Builds pasan, unit tests fallan por contratos previos | specs existentes | Ajustar specs impactadas y agregar nuevas | `npm run test`, lint, build, e2e |

