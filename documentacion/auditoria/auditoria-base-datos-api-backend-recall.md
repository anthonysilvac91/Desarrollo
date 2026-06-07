# Auditoría de Base de Datos, API y Backend - Recall

## 1. Resumen ejecutivo

El backend de Recall está construido con una arquitectura NestJS razonablemente modular: controladores por dominio, servicios con lógica de negocio, DTOs con `class-validator`, Prisma como capa de acceso a datos y una abstracción de storage para local/Supabase. La base de datos tiene modelos centrales claros para `Organization`, `User`, `UserSession`, `Owner`, `Asset`, `Service`, `ServiceAttachment`, `StoredFile`, `Invitation` y `EmailToken`.

**Riesgo técnico general: Medio.**

Actualización: la base de datos y el backend ya incluyen `UserSession`, 2FA TOTP, sesiones reales por dispositivo, `sid/jti` en JWT, revocación server-side y endpoints para listar/cerrar sesiones.

Está **suficientemente preparado para una demo controlada**, especialmente si se usan flujos estándar: login, seguridad de cuenta, assets, services, users, owners y dashboard. Para producción aún requiere endurecer varios puntos: consistencia de respuestas, validaciones de fechas/IDs, manejo transaccional en operaciones con storage, normalización de endpoints/legacy naming y revisión de performance en dashboard/reportes.

Principales debilidades encontradas:

* Respuestas API no son completamente consistentes: algunos listados devuelven array o `{ data, meta }` según paginación.
* Validaciones de fechas y algunos filtros son débiles o dependen de strings específicos.
* `User.email` es único global en DB, pero parte del servicio aún razona como si fuera único por organización.
* Storage local expone `/uploads` públicamente; correcto para desarrollo, riesgoso si se usa fuera de local.
* `StoredFile` usa `entity_type/entity_id` polimórfico sin FK real hacia la entidad final.
* Dashboard ejecuta muchas queries por request y rankings requieren queries adicionales.
* Persisten nombres legacy `companies`, `company`, `customer` en carpetas, DTOs, migraciones y documentación Swagger.
* Hay endpoints técnicamente correctos, pero con comportamiento semántico discutible: `DELETE /assets/:id` y `DELETE /owners/:id` son soft delete, mientras `DELETE /services/:id` es delete físico.

## 2. Mapa de endpoints detectados

| Método | Ruta | Módulo | Propósito | Estado | Observación |
|---|---|---|---|---|---|
| GET | `/` | App | Health básico / hello world | Parcial | Retorna `Hello World!`; útil en dev, pobre como healthcheck productivo. |
| POST | `/auth/login` | Auth | Login y emisión JWT | Correcto | Usa throttling, bcrypt y valida usuario/org activos. |
| POST | `/auth/register` | Auth | Registro mediante invitación | Correcto | Usa transacción usuario + invitación usada. |
| POST | `/auth/forgot-password` | Auth | Solicitud de reset password | Correcto | Respuesta genérica; depende de email provider. |
| POST | `/auth/reset-password` | Auth | Cambio de contraseña por token | Correcto | Valida expiración/uso de token. |
| GET | `/auth/me` | Auth | Perfil autenticado | Correcto | Resuelve avatar/logo desde `StoredFile`. |
| GET | `/auth/2fa/status` | Auth | Estado 2FA usuario actual | Correcto | Requiere JWT; devuelve estado y backup codes restantes. |
| POST | `/auth/2fa/setup` | Auth | Iniciar configuración TOTP | Correcto | Genera secreto, otpauth URL y token temporal de setup. |
| POST | `/auth/2fa/verify-setup` | Auth | Confirmar TOTP | Correcto | Activa 2FA y entrega backup codes. |
| POST | `/auth/2fa/disable` | Auth | Desactivar 2FA | Correcto | Exige código TOTP o backup code válido. |
| POST | `/auth/2fa/login` | Auth | Completar login con 2FA | Correcto | Usa token temporal de login y crea sesión real al completar. |
| GET | `/auth/sessions` | Auth | Listar sesiones/dispositivos | Correcto | Lista sesiones activas y marca sesión actual. |
| DELETE | `/auth/sessions/:id` | Auth | Revocar sesión/dispositivo | Correcto | Revoca otra sesión del usuario; no permite cerrar la actual por esta acción. |
| POST | `/auth/sessions/revoke-others` | Auth | Cerrar otras sesiones | Correcto | Revoca todas las sesiones activas excepto la actual. |
| POST | `/auth/logout` | Auth | Cerrar sesión actual | Correcto | Revoca la sesión actual y permite limpieza cliente. |
| POST | `/invitations` | Invitations | Crear invitación | Parcial | Valida rol y org, pero no confirma que `owner_id` EXTERNAL pertenezca a la organización. |
| POST | `/invitations/validate` | Invitations | Validar token público | Correcto | Público por diseño. |
| GET | `/dashboard` | Dashboard | Métricas agregadas | Parcial | Muchas queries por request; fechas con parsing débil. |
| POST | `/assets` | Assets | Crear asset | Correcto | Valida owner/org y archivo. |
| GET | `/assets` | Assets | Listar assets | Parcial | Respuesta cambia entre array y `{ data, meta }`. |
| GET | `/assets/stats` | Assets | KPIs de assets | Correcto | Filtra por rol/owner. |
| GET | `/assets/:id` | Assets | Detalle asset + services | Correcto | Incluye historial y resuelve adjuntos. |
| POST | `/assets/:id/owners/:ownerId` | Assets | Asignar owner | Parcial | Conceptualmente legacy: asset tiene un solo `owner_id`. |
| DELETE | `/assets/:id/owners/:ownerId` | Assets | Remover owner | Riesgoso | Siempre rechaza porque asset debe mantener owner; endpoint confuso. |
| PATCH | `/assets/:id/status` | Assets | Activar/desactivar asset | Correcto | Valida rol y tenant. |
| DELETE | `/assets/:id` | Assets | Eliminar asset | Parcial | Es soft delete, pero además borra thumbnail asociado. |
| PATCH | `/assets/:id` | Assets | Actualizar asset | Correcto | Worker solo puede actualizar foto. |
| POST | `/services` | Services | Crear service con adjuntos | Correcto | Valida asset activo, archivos y cuota. |
| GET | `/services` | Services | Listar historial | Parcial | Respuesta cambia según paginación. |
| GET | `/services/stats` | Services | KPIs de services | Correcto | Usa `groupBy` para assets/operators. |
| PATCH | `/services/:id` | Services | Editar service/status/visibilidad | Parcial | Solo ADMIN; API existe aunque frontend no lo explota. |
| GET | `/services/:id` | Services | Detalle service | Correcto | Valida visibilidad para EXTERNAL. |
| DELETE | `/services/:id` | Services | Eliminar service | Correcto | Delete físico con borrado de attachments/blob. |
| GET | `/users/stats` | Users | KPIs usuarios | Correcto | Admin/super admin. |
| GET | `/users` | Users | Listado usuarios | Parcial | Controller bloquea WORKER aunque service tiene rama legacy para WORKER. |
| POST | `/users` | Users | Crear usuario manual | Correcto | Valida roles, org, owner, password. |
| PATCH | `/users/me` | Users | Actualizar perfil propio | Parcial | No guarda `phone` aunque frontend lo envía; requiere validación. |
| PATCH | `/users/:id` | Users | Actualizar usuario | Parcial | No permite cambiar rol; validación de email global puede generar conflicto distinto. |
| PATCH | `/users/:id/status` | Users | Activar/desactivar usuario | Correcto | Evita desactivar usuario propio. |
| GET | `/users/:id` | Users | Detalle usuario | Correcto | Admin/super admin. |
| POST | `/owners` | Owners | Crear owner | Correcto | Admin, logo opcional. |
| GET | `/owners` | Owners | Listar owners | Parcial | Solo ADMIN; response array o paginada. |
| GET | `/owners/:id` | Owners | Detalle owner | Correcto | Incluye users/assets activos. |
| PATCH | `/owners/:id` | Owners | Actualizar owner | Correcto | Logo con storage. |
| PATCH | `/owners/:id/status` | Owners | Desactivar owner y assets | Correcto | Soft deactivate transaccional owner + assets. |
| DELETE | `/owners/:id` | Owners | Eliminar owner | Parcial | Es alias de deactivate, no delete real. |
| GET | `/organizations` | Organizations | Listar organizaciones | Correcto | Solo SUPER_ADMIN. |
| GET | `/organizations/me` | Organizations | Organización actual | Correcto | Requiere `orgId`. |
| GET | `/organizations/me/storage` | Organizations | Uso storage org | Correcto | Solo ADMIN. |
| POST | `/organizations/me/storage/reconcile` | Organizations | Reconciliar huérfanos storage | Correcto | Útil, pero peligroso si se usa con `delete_orphans`. |
| POST | `/organizations` | Organizations | Crear organización | Correcto | Solo SUPER_ADMIN. |
| PATCH | `/organizations/:id/status` | Organizations | Activar/desactivar organización | Correcto | Valida boolean estricto. |
| PATCH | `/organizations/settings` | Organizations | Settings de organización | Correcto | Admin, logo, branding y flags. |

## 3. Mapa de modelos/tablas detectadas

| Tabla/modelo | Propósito | Relaciones principales | Riesgos detectados | Observación |
|---|---|---|---|---|
| `Organization` | Tenant principal | Users, assets, services, owners, invitations, stored_files | Settings mezclados en tabla principal; sin tabla dedicada de configuración/versionado. | Tiene índices por `is_active` y `created_at`. |
| `User` | Usuarios y roles | Organization opcional, Owner opcional, services_created, email_tokens, sessions, files | `email` único global contradice mensajes/validación por organización; `organization_id` nullable permite solo SUPER_ADMIN por lógica, no por FK/check explícito; `two_factor_secret` queda en DB y debe protegerse operacionalmente. | Tiene check de owner/role en migración y campos `two_factor_*`. |
| `UserSession` | Sesiones/dispositivos autenticados | User, organization_id, token_jti | Geolocalización por IP es estimada y depende de proveedor externo/headers; no hay refresh token. | Permite revocar JWT por `sid/jti`, deduplicar dispositivo y cerrar otras sesiones. |
| `Owner` | Empresa/cliente propietario | Organization, users, assets, logo_file | Soft delete por `is_active`; no hay unique por nombre dentro de org. | Tiene unique compuesto `(id, organization_id)` para FKs compuestas. |
| `Asset` | Activo mantenible | Organization, Owner, thumbnail, services | `DELETE` soft-deactiva pero elimina thumbnail; sin unique por serial dentro de org. | `owner_id` requerido y FK compuesta owner/org. |
| `Service` | Trabajo/historial | Organization, Asset, Worker, attachments | Delete físico; `worker_id` referencia User sin constraint de misma organización en DB. | Tiene FK compuesta asset/org. |
| `ServiceAttachment` | Adjuntos de service | Service, StoredFile | `file_id` nullable puede permitir attachments sin archivo. | Delete de service borra attachments manualmente. |
| `StoredFile` | Registro de archivo en storage | Organization, uploaded_by, relaciones 1:1 opcionales | `entity_type/entity_id` polimórfico sin FK real; puede quedar apuntando a entidad inexistente. | Tiene check de `entity_type` permitido. |
| `WorkerAssetAccess` | Acceso granular worker/asset | User worker, Asset, admin granted_by | Existe modelo pero no se vio uso fuerte en endpoints principales. | Preparado para policy futura. |
| `Invitation` | Invitaciones de registro | Organization, invited_by | `owner_id` no tiene relación FK explícita con Owner. | Riesgo para EXTERNAL si se invita con owner inválido. |
| `EmailToken` | Password reset / email verification | User | Correcto, con cascade al borrar User. | Tokens únicos y expiración indexada. |

## 4. Hallazgos técnicos

| ID | Severidad | Área | Archivo, endpoint o tabla relacionada | Problema encontrado | Riesgo técnico | Recomendación |
|---|---|---|---|---|---|---|
| B-01 | Alta | API/contratos | `findAll` de assets/services/users/owners | Los listados devuelven array si no hay paginación y `{ data, meta }` si hay paginación. | Clientes API frágiles, lógica duplicada en frontend, riesgo de errores al cambiar params. | Normalizar todos los listados a `{ data, meta }` o documentar contrato único. |
| B-02 | Alta | Integridad DB | `StoredFile` | `entity_type/entity_id` es polimórfico y no tiene FK real hacia asset/user/service/owner/org. | Archivos huérfanos o apuntando a recursos inexistentes. | Mantener reconcile periódico y agregar validaciones/constraints lógicas por `kind`. |
| B-03 | Alta | Integridad invitaciones | `InvitationsService.create`, `Invitation.owner_id` | Para invitaciones EXTERNAL se exige `owner_id`, pero no se valida que exista y pertenezca a la organización. | Registro puede fallar por FK/check o crear relación inválida si DB no lo impide. | Validar owner activo de la misma organización antes de crear invitación. |
| B-04 | Alta | Storage | `AppModule`, `LocalStorageService`, `/uploads` | `ServeStaticModule` expone `/uploads`; local storage retorna URLs públicas. | Si `STORAGE_TYPE=local` se usa fuera de dev, archivos privados quedan accesibles. | Garantizar `STORAGE_TYPE=supabase` en producción y bloquear local storage públicamente fuera de dev. |
| B-05 | Media | Validaciones | DTOs de services/dashboard | `startDate`, `endDate`, `preset` no usan `IsDateString` ni enum controlado. | Fechas inválidas producen filtros inesperados o resultados inconsistentes. | Validar fechas con `IsDateString` y presets con enum. |
| B-06 | Media | Validaciones | `CreateAssetDto`, `AssetQueryDto` | `owner_id`, `organization_id` en asset DTO son `IsString`, no `IsUUID`. | Payloads inválidos llegan a lógica/DB y devuelven errores menos claros. | Usar `IsUUID` en IDs. |
| B-07 | Media | Consistencia DB/API | `User.email`, `UsersService.create`, `AuthService.register` | DB tiene email único global, pero algunos mensajes/queries hablan de duplicado por organización. | Errores Prisma P2002 pueden aparecer donde se espera conflicto controlado por tenant. | Alinear reglas: email global en todos los mensajes/validaciones o volver a unique compuesto si se desea multi-tenant por email. |
| B-08 | Media | API semántica | `DELETE /assets/:id`, `DELETE /owners/:id`, `DELETE /services/:id` | `assets` y `owners` hacen soft delete; `services` hace delete físico. | Contrato API inconsistente y riesgo de pérdida de historial. | Definir política única: soft delete o hard delete por recurso, documentada. |
| B-09 | Media | Data consistency | `AssetsService.remove` | Soft delete de asset elimina thumbnail blob/registro. | Asset inactivo queda sin imagen si se reactiva o se audita luego. | No borrar archivos en soft delete; borrar solo en purga física. |
| B-10 | Media | Performance | `DashboardService.getStats` | Ejecuta muchas queries en paralelo y luego queries extra para rankings. | Puede degradarse con alto volumen o muchos tenants. | Agregar índices revisados, materialización/caching o endpoint agregado optimizado. |
| B-11 | Media | Performance/storage | `resolveFileUrl` en loops | Listados resuelven URLs una por una, generando N llamadas DB/storage por página. | Latencia alta en assets/services/users con imágenes/adjuntos. | Resolver archivos en batch o incluir `StoredFile.storage_ref` en query principal. |
| B-12 | Media | Legacy/deuda | `companies/*`, `customers/`, DTOs `company_id/customer_id` | Módulo owners vive en carpeta `companies`; hay carpeta `customers` vacía y aliases legacy en DTOs. | Confusión de mantenimiento y riesgo de endpoints/contratos viejos. | Renombrar módulo internamente cuando sea seguro y eliminar carpetas vacías. |
| B-13 | Media | Validaciones archivos | `multer-image-options.ts`, frontend HEIC | Backend solo permite jpeg/png/webp/gif; frontend intenta soportar HEIC en algunos flujos. | Upload desde iPhone puede fallar si llega HEIC sin conversión previa. | Confirmar conversión frontend o soportar HEIC explícitamente en backend. |
| B-14 | Baja | Observabilidad | `AuthService`, `EmailService`, logs | Se loggean emails en fallos/login y envío de correos. | PII en logs operacionales. | Reducir PII o hashear/maskear emails en producción. |
| B-15 | Baja | API docs/health | `AppController` | `/` retorna `Hello World!`. | Healthcheck poco informativo. | Crear `/health` con estado DB/storage/email si aplica. |
| B-16 | Baja | Settings | `UpdateOrganizationSettingsDto` | Campos worker policy/storage existen en modelo, pero no todos se usan en lógica de services. | Configuración persistida puede no tener efecto funcional. | Conectar policies a flujos o marcar como preparadas/no activas. |
| B-17 | Baja | Auth / 2FA | `User.two_factor_secret`, `AuthService` | El secreto TOTP queda persistido en DB en texto recuperable. | Si se compromete la DB, un atacante puede reconstruir códigos TOTP. | Considerar cifrado a nivel aplicación/KMS para secretos 2FA y rotación segura. |
| B-18 | Baja | Auth / sesiones | `UserSession`, `AuthService.resolveIpLocation` | Ubicación de sesión depende de headers/proveedor GeoIP externo y puede quedar incompleta. | UX inconsistente en ubicación estimada; no afecta autorización. | Configurar proveedor GeoIP confiable en producción o mostrar ubicación como opcional. |

## 5. Revisión por área

### Arquitectura backend

Qué está bien:

* Backend modular por dominio: `auth`, `assets`, `services`, `users`, `organizations`, `dashboard`, `storage`, `invitations`.
* Controladores delegan la mayoría de lógica a services.
* DTOs aplican validación global con `ValidationPipe`, `whitelist` y `transform`.
* Storage está abstraído detrás de `StorageService` con implementación local y Supabase.
* Hay tests contractuales y specs de integridad para partes críticas.

Qué está incompleto:

* `PrismaService` no implementa shutdown hook (`beforeApplicationShutdown`/`enableShutdownHooks`).
* El endpoint raíz no es un healthcheck real.
* Carpetas legacy (`companies`, `customers`) mantienen deuda conceptual.

Qué es riesgoso:

* Algunas reglas de negocio están duplicadas entre controller y service.
* Algunos endpoints legacy o semánticamente confusos siguen expuestos, como remover owner de asset.

Qué debería corregirse primero:

* Normalizar nombres internos `owners` vs `companies`.
* Agregar healthcheck técnico.

### API/endpoints

Qué está bien:

* Métodos HTTP principales están razonablemente usados.
* Auth, 2FA, sesiones, users, assets, services, owners, organizations y dashboard tienen endpoints claros.
* Swagger está configurado.
* Throttling global y específico en auth/invitations.

Qué está incompleto:

* Estructura de respuesta no es uniforme en listados.
* Soft delete/hard delete no está homogeneizado.
* No todos los endpoints tienen contratos de respuesta DTO explícitos.

Qué es riesgoso:

* Cambiar `page/limit` cambia la forma de respuesta.
* `DELETE /assets/:id` y `DELETE /owners/:id` no eliminan físicamente, pero `DELETE /services/:id` sí.

Qué debería corregirse primero:

* Definir contrato API único para listados y delete semantics.

### Validaciones

Qué está bien:

* Hay `ValidationPipe` global con whitelist.
* Password, email, roles y enum de status tienen validación.
* Archivos se validan por MIME declarado, firma real, dimensiones, tamaño y píxeles.
* Se bloquean URLs manuales para avatar/logo/thumbnail.

Qué está incompleto:

* Fechas no usan `IsDateString`.
* Presets de fecha no usan enum.
* Algunos IDs son `IsString` en vez de `IsUUID`.
* `UpdateOwnProfileDto` no incluye `phone`, aunque frontend lo envía.

Qué es riesgoso:

* Payloads inválidos pueden terminar como filtros silenciosamente vacíos o fechas `Invalid Date`.
* Inconsistencia HEIC frontend/backend.

Qué debería corregirse primero:

* Validar fechas, presets e IDs de filtros/mutaciones.

### Base de datos/Supabase

Qué está bien:

* Prisma schema define relaciones principales.
* Hay constraints importantes: owner requerido en asset, role/owner consistency, FK compuesta owner-org y asset-org.
* Índices por `organization_id`, `created_at`, `owner_id`, `asset_id`, `worker_id`, `status/kind`.
* `UserSession` tiene índices por `user_id/revoked_at`, `user_id/last_seen_at`, `organization_id` y `expires_at`.
* Supabase storage usa signed URLs para referencias privadas.

Qué está incompleto:

* `StoredFile.entity_id` no tiene FK real.
* `Invitation.owner_id` no aparece como relación formal con Owner.
* `Service.worker_id` no tiene constraint DB de misma organización que el service.
* Settings están en `Organization`, no en tabla separada versionable.

Qué es riesgoso:

* Datos huérfanos de archivos o invitations con owner inválido.
* Migraciones legacy muestran transición `company/customer` que debe mantenerse limpia.

Qué debería corregirse primero:

* Reforzar integridad de `Invitation.owner_id` y `StoredFile`.

### Integridad de datos

Qué está bien:

* Asset no puede existir sin organization ni owner.
* Service no puede existir sin organization, asset ni worker.
* User externo requiere owner según constraint de migración.
* Owner de asset se valida contra organización en servicio y DB.
* Service y asset tienen FK compuesta para evitar mezclar asset/org.
* Sesiones quedan asociadas a usuario y token_jti único, lo que permite invalidación server-side de JWT.

Qué está incompleto:

* No hay constraint explícito para que worker del service pertenezca a la misma organización.
* Users no SUPER_ADMIN pueden tener `organization_id` nullable a nivel schema; se controla en servicio/auth.
* Stored files pueden quedar sin entidad real.

Qué es riesgoso:

* Soft delete de assets/owners puede dejar histórico activo según queries si no filtran estado.
* Borrar físicamente services elimina historial.

Qué debería corregirse primero:

* Definir política de eliminación y reforzar constraints faltantes.

### Queries/performance backend

Qué está bien:

* Listados principales usan `skip/take` cuando hay paginación.
* Hay índices para queries frecuentes por tenant/fecha.
* Dashboard usa `Promise.all` para paralelizar.

Qué está incompleto:

* Dashboard no usa cache ni agregados materializados.
* Resolución de URLs se hace por item/attachment.
* Owners calcula service counts con groupBy + findMany adicional.

Qué es riesgoso:

* Alto número de queries por dashboard y listados con imágenes.
* GroupBy de dashboard puede crecer con volumen histórico.

Qué debería corregirse primero:

* Medir dashboard con datos reales y optimizar resolución de archivos en batch.

### Archivos/storage

Qué está bien:

* `StoredFile` centraliza metadata.
* Supabase privado usa refs `private://` y signed URLs.
* Al fallar creación de entidad se intenta limpiar archivo registrado.
* Hay endpoint de reconcile para huérfanos.
* Hay cuota por organización.

Qué está incompleto:

* Reconcile no está automatizado.
* `StoredFile` no garantiza por FK que `entity_id` exista.
* Local storage no distingue privacidad real si se sirve `/uploads`.

Qué es riesgoso:

* Archivos públicos en local.
* Deletes parciales si falla storage después de DB o viceversa.

Qué debería corregirse primero:

* No usar local storage en producción y planificar job de reconcile/auditoría.

### Settings

Qué está bien:

* Settings de organización están centralizados en `Organization`.
* Endpoint `PATCH /organizations/settings` valida rol admin y archivo logo.
* Campos como `auto_publish_services`, `worker_edit_policy`, `worker_restricted_access`, `default_asset_icon` existen.
* Seguridad de cuenta no depende de settings de organización: 2FA y sesiones viven en Auth/User/UserSession.

Qué está incompleto:

* No se confirmó que todas las policies de worker se apliquen en lógica de services/assets.
* No hay tabla separada para settings avanzados, auditoría o histórico.

Qué es riesgoso:

* Configuración persistida puede no tener efecto si no está conectada a lógica de negocio.

Qué debería corregirse primero:

* Revisar cada setting persistido y mapearlo a comportamiento backend real.

### Dashboard/reportabilidad

Qué está bien:

* Filtra por organización, rol y owner para externos.
* Calcula KPIs con Prisma count/groupBy.
* Evita métricas para EXTERNAL sin owner.

Qué está incompleto:

* Fechas sin validación estricta.
* Ranking de owners queda vacío (`top_owners: []`).
* No hay cache ni materialización.

Qué es riesgoso:

* Conteos pueden diferir entre módulos si cada servicio aplica filtros de estado distintos.
* Performance puede caer con histórico grande.

Qué debería corregirse primero:

* Validar consistencia de KPIs contra listados y completar/retirar `top_owners`.

### Errores/logs

Qué está bien:

* Filtro global normaliza errores con `statusCode`, `timestamp`, `path`, `message`.
* 500 se loggea con stack.
* Logs de timing para requests lentas.
* Auth no expone si credencial/email existe en login/reset.

Qué está incompleto:

* Errores Prisma no se traducen sistemáticamente a mensajes de dominio.
* Logs incluyen emails en auth/email service.
* Algunos errores de Supabase devuelven detalle interno en upload.

Qué es riesgoso:

* PII en logs.
* Mensajes técnicos hacia frontend en ciertos fallos de storage.

Qué debería corregirse primero:

* Mapear Prisma errors comunes y reducir PII en logs productivos.

## 6. Pruebas técnicas recomendadas

1. Crear asset sin `owner_id` y confirmar `400`.
2. Crear asset con `owner_id` de otra organización y confirmar `400`.
3. Crear asset con `organization_id` distinto al de la sesión y confirmar rechazo.
4. Editar asset como WORKER sin foto y confirmar `403`.
5. Soft delete de asset y verificar que no aparece para WORKER/EXTERNAL.
6. Reactivar asset soft-deleted y validar si conserva o perdió thumbnail.
7. Crear service con `asset_id` inexistente y confirmar `400`.
8. Crear service con asset inactivo y confirmar rechazo.
9. Crear service con más de 10 archivos y confirmar `400`.
10. Crear service con archivo `.txt` renombrado como `.jpg` y confirmar rechazo por firma.
11. Crear service con fecha inválida en query `startDate=abc` y observar respuesta actual.
12. Probar `/services?asset_id=no-uuid` y validar error de DTO.
13. Probar `/assets?owner_id=no-uuid` y confirmar si pasa como string.
14. Crear invitación EXTERNAL con `owner_id` inexistente y verificar si falla en create/register.
15. Crear usuario con email existente en otra organización y verificar error real.
16. Crear usuario EXTERNAL sin owner y confirmar `400`.
17. Cambiar status de usuario propio y confirmar `403`.
18. Ejecutar `DELETE /services/:id` con adjuntos y verificar DB + storage sin huérfanos.
19. Ejecutar `DELETE /owners/:id` y confirmar owner/assets quedan inactivos.
20. Ejecutar reconcile storage con `delete_orphans=false` y revisar reporte.
21. Probar reconcile con `delete_orphans=true` en ambiente no productivo.
22. Comparar `dashboard.total_services` contra `/services` con mismos filtros.
23. Comparar `dashboard.total_assets` contra `/assets/stats`.
24. Medir latencia de `/dashboard` con datos de volumen alto.
25. Verificar que producción arranca solo con `STORAGE_TYPE=supabase`.
26. Activar 2FA y confirmar persistencia de `two_factor_enabled`, backup codes hasheados y login con token temporal.
27. Usar backup code una vez y confirmar que queda consumido.
28. Crear dos sesiones del mismo usuario desde navegadores distintos y confirmar dos filas activas en `UserSession`.
29. Reloguear desde el mismo navegador/IP/user-agent y confirmar que se reutiliza/actualiza la sesión en vez de crear duplicado.
30. Revocar una sesión con `DELETE /auth/sessions/:id` y confirmar que el JWT revocado recibe `401`.
31. Ejecutar `/auth/sessions/revoke-others` y confirmar que solo permanece activa la sesión actual.

## 7. Recomendaciones priorizadas

### Corregir antes de demo

* Ocultar o documentar claramente endpoints/acciones confusas: remover owner de asset, deletes soft/hard distintos.
* Validar `owner_id` en invitaciones EXTERNAL.
* Confirmar que producción/demo usa Supabase storage y no local `/uploads`.
* Corregir mensajes/encoding visibles en respuestas/documentación si se mostrarán.
* Verificar consistencia de dashboard contra listados con datos reales.

### Corregir antes de producción

* Normalizar estructura de respuestas de listados.
* Validar fechas con `IsDateString` y presets con enum.
* Cambiar IDs `IsString` a `IsUUID` donde corresponde.
* Alinear regla de email global vs email por organización.
* Reducir PII en logs.
* Cifrar o proteger operacionalmente secretos TOTP si se eleva el nivel de seguridad requerido.
* Batch resolver para URLs de archivos.
* Definir política formal de soft/hard delete por modelo.
* Agregar jobs o procedimientos operativos para storage reconcile.
* Revisar constraints faltantes: worker/service organization, invitation owner/org.

### Mejoras técnicas posteriores

* Renombrar módulo `companies` a `owners` internamente.
* Eliminar carpeta vacía `customers`.
* Crear tabla separada para settings avanzados si crecerá la configuración.
* Agregar healthcheck real.
* Evaluar cache/materialized views para dashboard/reportabilidad.
* Agregar DTOs de respuesta para Swagger y contratos API.
* Agregar auditoría de eventos sensibles: cambios 2FA, revocación de sesiones y resets de password.

## 8. Archivos que requieren revisión/corrección

* `backend/prisma/schema.prisma`: revisar unicidad de email, relaciones nullable, `StoredFile` polimórfico e integridad de invitations.
* `backend/prisma/migrations/20260517000100_phase7_integrity_constraints/migration.sql`: buena base de constraints; extender con constraints faltantes.
* `backend/src/main.ts`: configuración global correcta; revisar CORS, health y logging para producción.
* `backend/src/app.module.ts`: `ServeStaticModule` para `/uploads`; confirmar solo desarrollo.
* `backend/src/assets/assets.service.ts`: soft delete borra thumbnail; validaciones y response shape.
* `backend/src/assets/assets.controller.ts`: endpoints assign/remove owner confusos.
* `backend/src/services/services.service.ts`: fechas, delete físico, resolución de URLs y queries.
* `backend/src/services/dto/list-services-query.dto.ts`: validar fechas/preset.
* `backend/src/dashboard/dashboard.service.ts`: performance, filtros y `top_owners` vacío.
* `backend/src/users/users.service.ts`: email global vs tenant, update profile no guarda phone, validaciones owner/org.
* `backend/src/users/dto/update-own-profile.dto.ts`: falta `phone` si el endpoint debe aceptarlo.
* `backend/src/auth/auth.service.ts`: 2FA, sesiones, GeoIP y revocación; revisar cifrado de secretos y observabilidad.
* `backend/src/auth/jwt.strategy.ts`: validación de `sid/jti` contra `UserSession`.
* `backend/src/invitations/invitations.service.ts`: validar owner de invitación EXTERNAL.
* `backend/src/companies/*`: deuda de naming; módulo real es owners.
* `backend/src/storage/stored-files.service.ts`: operaciones DB/storage no son atómicas; revisar estrategia de recuperación.
* `backend/src/storage/storage-governance.service.ts`: reconcile útil; considerar job/operación segura.
* `backend/src/common/files/multer-image-options.ts`: MIME permitidos no incluyen HEIC.
* `backend/src/common/filters/all-exceptions.filter.ts`: mapear errores Prisma y revisar exposición de mensajes.
* `backend/src/email/email.service.ts`: logs contienen emails y el error se relanza.

## 9. Conclusión

El backend y la base de datos de Recall están **en un estado razonable para una demo real controlada**, con una estructura modular y varias defensas importantes ya presentes: validación global, guards JWT, constraints de tenant, storage abstraído, registro de archivos y límites de upload.

No lo consideraría completamente listo para producción sin cerrar los puntos de consistencia API, validación estricta de filtros/fechas/IDs, política de deletes, integridad de `StoredFile`/invitaciones y performance del dashboard. El riesgo técnico más relevante si se usa tal como está es que algunos casos borde generen datos inconsistentes, respuestas no uniformes o archivos huérfanos, especialmente cuando se prueban flujos fuera del camino feliz.

La recomendación práctica es mantener el backend para demo con datos controlados, pero ejecutar las pruebas técnicas de integridad y corregir los hallazgos de severidad alta antes de exponerlo a uso productivo o a clientes con datos reales.
