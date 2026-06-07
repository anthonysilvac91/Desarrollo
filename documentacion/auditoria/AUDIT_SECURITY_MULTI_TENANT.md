# Auditoría de Seguridad y Multi-tenant - Recall

  ## 1. Resumen ejecutivo

  Riesgo general: Medio-Alto.

  Recall tiene una base razonable para SaaS multi-tenant: el backend usa JWT, revalida usuario contra DB en cada request, fuerza
  organization_id en listados principales y separa roles (SUPER_ADMIN, ADMIN, WORKER, EXTERNAL). Los módulos assets, services, users, owners,
  dashboard y settings aplican filtros de tenant en varias lecturas.

  No lo consideraría listo para una demo real con cliente sin corregir primero algunos puntos. El riesgo principal no está en que el frontend
  oculte botones, sino en mutaciones backend que aceptan campos sensibles o relaciones cruzadas. La base de datos tiene una migración con
  constraints multi-tenant importantes, pero hay que validar que esté aplicada en producción.

  Principales hallazgos:

  - PATCH /assets/:id recibe any y puede aceptar campos no esperados como organization_id.
  - PATCH /services/:id permite potencialmente cambiar asset_id sin validar que el nuevo asset pertenezca al mismo tenant.
  - Invitaciones EXTERNAL no validan que owner_id pertenezca a la organización invitada.
  - Swagger /api queda público.
  - Tokens en frontend están en localStorage y cookie JS, lo que aumenta impacto ante XSS.
  - Settings ya tiene 2FA TOTP y sesiones/dispositivos reales con revocacion server-side; notificaciones queda desactivado y marcado como "Proximamente".
  - Supabase/DB no usa RLS visible; el aislamiento depende de backend y constraints.

  ## 2. Hallazgos críticos

   ID                   SEC-01
   Severidad            Alta
   Área                 Assets / Multi-tenant
   Archivo o endpoint   PATCH /assets/:id, backend/src/assets/assets.controller.ts, backend/src/assets/assets.service.ts
   Problema encontrado  El controller recibe updateAssetDto: any y el service propaga campos no filtrados en updatePayload.
   Riesgo               Un ADMIN podría intentar enviar campos sensibles como organization_id, thumbnail_file_id o datos no esperados. Si las
                        constraints DB no están aplicadas, puede mover/corromper recursos entre tenants.
   Recomendación        Crear UpdateAssetDto estricto, prohibir organization_id, validar whitelist real y actualizar solo campos permitidos.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-02
   Severidad            Alta
   Área                 Services / Multi-tenant
   Archivo o endpoint   PATCH /services/:id, backend/src/services/dto/update-service.dto.ts, backend/src/services/services.service.ts
   Problema encontrado  UpdateServiceDto extiende PartialType(CreateServiceDto), por lo que acepta asset_id. El update no valida que el nuevo
                        asset pertenezca a la misma organización.
   Riesgo               Reasignación cross-tenant de un servicio a un asset de otra organización si la DB no bloquea. Puede filtrar nombre/
                        thumbnail/owner de otro tenant.
   Recomendación        Si asset_id debe ser editable, validar asset.organization_id === service.organization_id. Si no, remover asset_id del
                        DTO de update.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-03
   Severidad            Alta
   Área                 Invitaciones / External users
   Archivo o endpoint   POST /invitations, backend/src/invitations/invitations.service.ts
   Problema encontrado  Para rol EXTERNAL se exige owner_id, pero no se valida que ese owner pertenezca a organizationId.
   Riesgo               Usuario externo puede quedar asociado a un owner de otro tenant o a un owner inexistente a nivel lógico.
   Recomendación        Validar owner.id + organization_id antes de crear invitación. Idealmente agregar FK/constraint o relación explícita.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-04
   Severidad            Media-Alta
   Área                 Base de datos
   Archivo o endpoint   backend/prisma/schema.prisma, migración 20260517000100_phase7_integrity_constraints
   Problema encontrado  La migración agrega constraints cross-tenant importantes, pero schema.prisma no expresa todas las relaciones
                        compuestas. Estado en producción requiere validación.
   Riesgo               Si producción no tiene esa migración aplicada, el backend queda como única barrera en mutaciones críticas.
   Recomendación        Verificar constraints en DB productiva: Asset_owner_same_organization_fkey, Service_asset_same_organization_fkey,
                        checks de roles.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-05
   Severidad            Media
   Área                 Auth / sesión
   Archivo o endpoint   frontend/src/lib/AuthContext.tsx, frontend/src/lib/api.ts
   Problema encontrado  JWT guardado en localStorage y cookie accesible por JS.
   Riesgo               XSS permitiría robo de token y acceso completo hasta expiración.
   Recomendación        Migrar a cookie HttpOnly, Secure, SameSite, o reducir TTL y endurecer CSP.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-06
   Severidad            Media
   Área                 API pública
   Archivo o endpoint   backend/src/main.ts
   Problema encontrado  Swagger se monta siempre en /api.
   Riesgo               Exposición de endpoints, DTOs y rutas internas en producción.
   Recomendación        Deshabilitar Swagger en producción o protegerlo con auth/IP allowlist.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-07
   Severidad            Media
   Área                 Storage
   Archivo o endpoint   backend/src/app.module.ts, ServeStaticModule
   Problema encontrado  /uploads estático siempre está montado. Producción exige Supabase, pero la ruta pública sigue existiendo.
   Riesgo               Si existen archivos locales residuales o deploy no esperado, quedan públicos sin auth.
   Recomendación        Montar /uploads solo en desarrollo. En producción, no servir storage local.
  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   ID                   SEC-08
   Severidad            Baja
   Área                 Settings / Notificaciones
   Archivo o endpoint   frontend/src/app/(main)/settings/page.tsx
   Problema encontrado  Las preferencias de notificaciones no tienen persistencia backend ni envio real implementado.
   Estado actual        Mitigado visualmente: todos los switches estan apagados, deshabilitados y marcados como "Proximamente".
   Riesgo               Bajo mientras permanezcan deshabilitadas; subiria si se muestran como funcionales sin backend.
   Recomendación        Mantenerlas desactivadas hasta implementar persistencia y envio real de notificaciones.

  ## 3. Revisión por módulo

  ### Auth

  Qué está bien:

  - JwtStrategy no confía ciegamente en el payload: busca el usuario en DB y usa rol/organización reales.
  - Bloquea usuarios inactivos y organizaciones inactivas.
  - SUPER_ADMIN debe tener organization_id = null.
  - EXTERNAL debe tener owner_id.
  - Login, register, forgot/reset tienen throttling.
  - 2FA TOTP esta implementado con setup, verificacion, backup codes y login en dos pasos.
  - Las sesiones reales se guardan en UserSession con sid/jti en el JWT, datos de dispositivo/IP, revocacion por dispositivo, cierre de otras sesiones y logout server-side.

  Qué está incompleto o riesgoso:

  - LoginDto solo usa email/password. Además User.email es @unique global, contrario a documentación que habla de email por tenant.
  - forgot-password también resuelve por email global.
  - Tokens en frontend están en localStorage.
  - No se observó refresh token; se usa access token de 12h asociado a sesion revocable.
  - Password reset marca token usado y cambia password en Promise.all, no en transacción.

  Corregir primero:

  - Definir si email será global o por organización. Si será SaaS multi-tenant real, login debe resolver tenant.
  - Mover sesión a cookie HttpOnly o endurecer mucho contra XSS.

  ### Assets

  Qué está bien:

  - findAll, getStats, findOne, assignOwner, remove, toggleStatus filtran por organization_id.
  - EXTERNAL solo ve assets activos de su owner_id.
  - create fuerza organization_id desde sesión para usuarios normales.
  - create valida que owner_id pertenezca a la organización.

  Riesgoso:

  - PATCH /assets/:id usa any.
  - update no elimina organization_id ni otros campos sensibles del payload.
  - WORKER puede actualizar foto de cualquier asset de su organización, incluso si worker_restricted_access existe pero no se aplica.
  - worker_restricted_access está en DB/settings, pero el código explícitamente permite que WORKER vea todos los assets del tenant.

  Corregir primero:

  - DTO estricto de update.
  - Aplicar o eliminar temporalmente worker_restricted_access para no prometer una política no implementada.

  ### Services

  Qué está bien:

  - create valida que el asset pertenezca al tenant para no SUPER_ADMIN.
  - findAll, findOne, getStats filtran por organization_id.
  - EXTERNAL solo ve servicios is_public, COMPLETED y de su owner.
  - is_public y status enviados por create quedan sobreescritos por backend.

  Riesgoso:

  - PATCH /services/:id acepta asset_id por herencia del DTO y no valida ownership del nuevo asset.
  - ADMIN puede editar status e is_public, correcto, pero debe evitar editar relaciones sensibles sin validación.
  - SUPER_ADMIN puede crear service sobre cualquier asset; esto parece intencional, pero requiere auditoría operacional.

  Corregir primero:

  - Bloquear asset_id en update o validar tenant.
  - Agregar test e2e de intento cross-tenant con asset_id ajeno.

  ### Users

  Qué está bien:

  - ADMIN queda forzado a su propia organización en create/list/update.
  - ADMIN no puede crear SUPER_ADMIN.
  - SUPER_ADMIN puede filtrar globalmente.
  - owner_id para usuarios externos se valida en create/update manual.

  Riesgoso:

  - updateOwnProfile valida email duplicado globalmente, consistente con @unique, pero no con documentación multi-tenant por email.
  - No hay eliminación de usuarios, solo status.
  - findOne devuelve email y datos de usuarios del tenant a ADMIN, correcto para admin pero sensible.

  Corregir primero:

  - Decidir regla definitiva de email global vs email por tenant.
  - Agregar pruebas de update cross-tenant y self-profile.

  ### Settings

  Qué está bien:

  - PATCH /organizations/settings usa req.user.orgId, no recibe organizationId del frontend.
  - Solo ADMIN puede cambiar settings de organización.
  - Logo se sube como archivo, no por URL manual.
  - Seguridad ya usa 2FA TOTP real contra backend.
  - Manage Access & Devices ya lista sesiones reales desde /auth/sessions y permite revocar otros dispositivos.
  - Logout revoca la sesion actual en backend.

  Incompleto/riesgoso:

  - Settings permite a WORKER y EXTERNAL entrar a la ruta, aunque solo ven perfil propio/secciones no administrativas.
  - Notificaciones no tienen backend; estan apagadas, deshabilitadas y marcadas como "Proximamente".
  - worker_restricted_access existe en DTO/modelo, pero no se aplica en assets/services/dashboard.

  Corregir primero:

  - Mantener notificaciones desactivadas hasta implementar persistencia y envio real.
  - No activar worker_restricted_access hasta implementarlo en backend.

  ### Dashboard

  Qué está bien:

  - Dashboard filtra por organization_id.
  - EXTERNAL filtra por owner_id, is_public y servicios completados.
  - WORKER ve métricas de sus propios servicios para servicios, aunque assets count muestra assets del tenant.

  Riesgoso:

  - El controller dice “Solo ADMIN/SUPER_ADMIN”, pero service permite WORKER y EXTERNAL. Puede ser decisión de producto, pero documentación
    inconsistente.

  - SUPER_ADMIN puede consultar global si no manda organizationId.

  Corregir primero:

  - Alinear documentación y permisos reales.
  - Validar si WORKER debe ver total de assets del tenant o solo assets asignados.

  ### Archivos/storage

  Qué está bien:

  - Producción exige STORAGE_TYPE=supabase.
  - Archivos privados se guardan con private:// y se resuelven con signed URLs.
  - Paths incluyen org/{orgId}/....
  - Validación de MIME por firma real, tamaño, dimensiones y píxeles.
  - Limpieza de archivos si falla registro DB o reemplazo.

  Riesgoso:

  - StoredFilesService.resolveFileUrl(storedFileId) no recibe usuario/tenant; si un endpoint trae un storedFileId ajeno por relación corrupta,
    emitirá URL firmada.

  - /uploads local público sigue montado.
  - No hay endpoint directo de descarga con autorización propia; se depende de signed URLs emitidas por endpoints de negocio.
  - Orphans tienen reconciliación admin, pero no limpieza automática programada.

  Corregir primero:

  - No montar /uploads en producción.
  - Considerar resolver archivos con contexto de tenant: resolveFileUrlForOrg(storedFileId, orgId).

  ### API/backend

  Qué está bien:

  - La mayoría de controllers críticos usan @UseGuards(AuthGuard).
  - Roles sensibles se validan en backend, no solo frontend.
  - ValidationPipe con whitelist global existe.
  - Errores 500 no exponen stack al cliente.

  Riesgoso:

  - Swagger público.
  - Algunos controllers hacen validación de rol manual repetida, propensa a omisiones.
  - assets.update usa any, saltándose DTO/whitelist.
  - No hay un guard/decorator central tipo RolesGuard.

  Corregir primero:

  - Implementar DTOs estrictos donde falta.
  - Centralizar autorización por roles para reducir drift.

  ### Base de datos/Supabase

  Qué está bien:

  - Tablas principales tienen organization_id.
  - Índices por organization_id existen.
  - Migración 20260517000100_phase7_integrity_constraints agrega constraints importantes:
      - Asset_owner_same_organization_fkey
      - Service_asset_same_organization_fkey
      - User_role_owner_consistency_chk
      - StoredFile_entity_type_chk

  Riesgoso / requiere validación:

  - No se observan RLS policies ni ENABLE ROW LEVEL SECURITY.
  - Prisma usa backend como capa de aislamiento; Supabase no está haciendo enforcement de tenant por usuario.
  - Invitation.owner_id no tiene FK a Owner.
  - StoredFile.entity_type/entity_id es polimórfico y no garantiza por FK que el archivo pertenezca a la entidad correcta.
  - User.email @unique global contradice documentación anterior de unicidad por tenant.

  Corregir primero:

  - Confirmar constraints aplicadas en producción.
  - Agregar constraint o validación fuerte para invitaciones externas.
  - Decidir si se implementará RLS o se documentará formalmente que aislamiento es app-level + DB constraints.

  ### Frontend/rutas

  Qué está bien:

  - Hay guard de rutas en proxy.ts.
  - AuthContext llama /auth/me; no confía solo en decodificar JWT.
  - UI oculta acciones según rol en varios módulos.

  Riesgoso:

  - Guards frontend no validan rol en middleware, solo presencia de cookie.
  - El control real está en backend, lo cual está bien, pero rutas pueden renderizar algo hasta que cargue auth.
  - Token en localStorage.
  - Algunas acciones visibles/permitidas no coinciden del todo con backend o documentación, especialmente settings/security.

  Corregir primero:

  - Mantener backend como fuente de verdad.
  - Mejorar sesión/token.
  - Mantener features sin backend real deshabilitadas y marcadas como "Proximamente".

  ## 4. Pruebas manuales recomendadas

  - Usuario ADMIN de Organización A intenta GET /assets/:id con asset de Organización B.
  - Usuario ADMIN de Organización A intenta PATCH /assets/:id enviando organization_id de Organización B.
  - Usuario ADMIN de Organización A intenta PATCH /services/:id enviando asset_id de Organización B.
  - Usuario ADMIN de Organización A intenta crear asset con owner_id de Organización B.
  - Usuario ADMIN de Organización A invita EXTERNAL usando owner_id de Organización B.
  - Usuario EXTERNAL de Owner A intenta abrir asset de Owner B del mismo tenant.
  - Usuario EXTERNAL intenta abrir servicio privado o ARCHIVED.
  - Usuario WORKER intenta editar metadata de asset, no solo foto.
  - Usuario WORKER intenta acceder a /users, /owners, /organizations.
  - Usuario sin token llama /assets, /services, /users, /dashboard, /organizations/settings.
  - Usuario con token de organización inactiva intenta /auth/me.
  - Abrir URL firmada de archivo privado después de expirar TTL.
  - Intentar acceder directamente a /uploads/... en ambiente productivo.
  - Validar que Swagger /api no esté disponible públicamente en producción.
  - Confirmar constraints en DB productiva con inspección SQL.
  - Activar 2FA TOTP, cerrar sesión, iniciar login con 2FA y validar un backup code.
  - Abrir dos sesiones del mismo usuario en navegadores distintos y revocar una desde Settings > Security.
  - Usar "Cerrar sesión en todos los demás dispositivos" y validar que los otros tokens reciban 401 en el siguiente request.

  ## 5. Recomendaciones priorizadas

  ### Corregir antes de mostrar a cliente

  - Bloquear campos sensibles en PATCH /assets/:id.
  - Bloquear o validar asset_id en PATCH /services/:id.
  - Validar owner_id contra organización en invitaciones.
  - Mantener notificaciones de settings como "Proximamente" hasta implementar backend real.
  - Deshabilitar Swagger público en producción.
  - Confirmar que la migración de integrity constraints está aplicada en producción.

  ### Corregir antes de producción

  - Migrar JWT desde localStorage a cookie HttpOnly o reducir exposición.
  - Montar /uploads solo en desarrollo.
  - Definir modelo definitivo de email: global o por tenant.
  - Agregar tests e2e cross-tenant para create/update/delete/list/detail.
  - Resolver archivos con contexto de tenant.
  - Transaccionar reset password.

  ### Mejoras posteriores

  - Implementar RolesGuard central.
  - Evaluar RLS en Supabase si se expondrá Supabase directamente o si se quiere defensa en profundidad.
  - Agregar auditoria/logs de cambios de 2FA y revocacion de sesiones.
  - Mejorar geolocalizacion de sesiones con proveedor confiable/configurado para produccion si se requiere precision.
  - Limpieza automática de archivos huérfanos.
  - Auditoría/logs de acciones sensibles por tenant.

  ## 6. Archivos que requieren revisión/corrección

  - backend/src/assets/assets.controller.ts: updateAssetDto: any en PATCH /assets/:id.
  - backend/src/assets/assets.service.ts: updatePayload permite campos no filtrados.
  - backend/src/services/dto/update-service.dto.ts: hereda asset_id desde CreateServiceDto.
  - backend/src/services/services.service.ts: update no valida nuevo asset_id.
  - backend/src/invitations/invitations.service.ts: falta validar owner_id contra organización.
  - backend/prisma/schema.prisma: revisar consistencia entre modelo Prisma, migraciones y constraints reales.
  - backend/prisma/migrations/20260517000100_phase7_integrity_constraints/migration.sql: validar aplicada en producción.
  - backend/src/main.ts: Swagger público.
  - backend/src/app.module.ts: /uploads estático siempre montado.
  - backend/src/storage/stored-files.service.ts: resolución de URL sin contexto de tenant.
  - frontend/src/lib/AuthContext.tsx: token en localStorage y cookie JS.
  - frontend/src/proxy.ts: middleware solo valida presencia de token, no rol.
  - frontend/src/app/(main)/settings/page.tsx: notificaciones deshabilitadas como "Proximamente"; 2FA y dispositivos ya no son mock.

  ## 7. Conclusión

  Desde seguridad y aislamiento de datos, no lo marcaría listo para una demo real con cliente sin correcciones previas.

  La arquitectura va en buena dirección y los listados/detalles principales están bastante protegidos por organization_id. Pero las mutaciones
  de assets/services, la validación incompleta de invitaciones externas, la exposición de Swagger y las features sin backend real que deben permanecer deshabilitadas
  son riesgos reales para una demo seria. La prioridad es cerrar esas rutas de escritura y confirmar constraints productivas antes de mostrar
  datos reales de más de una organización.
