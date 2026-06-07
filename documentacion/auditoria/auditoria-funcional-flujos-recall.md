# Auditoría Funcional por Flujos - Recall

## 1. Resumen ejecutivo

Estado funcional general: **parcialmente listo para demo controlada**, pero no para una demo abierta con cliente sin preparar el recorrido.

Los flujos más sólidos son:

* Login, registro por invitación, reset de contraseña.
* Dashboard básico con KPIs y tarjetas.
* Listado, creación, detalle, edición básica e imagen de assets.
* Creación de servicios desde un asset.
* Listado, creación manual/invitación y activación/desactivación de usuarios admin.

Los riesgos funcionales principales son:

* Hay pantallas con acciones visibles que no ejecutan nada real.
* Settings ya tiene seguridad real para 2FA y dispositivos/sesiones; notificaciones y planes siguen sin operación real.
* Algunos botones aparecen para roles que luego fallan contra backend.
* Services tiene API de edición/status, pero no flujo frontend completo.
* La experiencia de archivos es inconsistente entre assets, services y users.

Conclusión ejecutiva: **sirve para demo si se limita el recorrido**, especialmente auth, dashboard, assets, creación de services desde asset, seguridad de cuenta y users admin. **No conviene mostrar planes, edición de services ni acciones móviles de users sin corregir.**

## 2. Mapa de flujos revisados

| Módulo | Flujo | Estado | Archivos relacionados | Comentario breve |
|---|---|---:|---|---|
| Auth | Login | Completo | `frontend/src/app/(auth)/login/page.tsx`, `backend/src/auth/auth.controller.ts` | Login real, guarda token, refresca usuario y redirige. |
| Auth | Registro por invitación | Completo | `frontend/src/app/(auth)/register/page.tsx`, `frontend/src/services/invitations.service.ts`, `backend/src/auth/auth.controller.ts` | Valida token y registra usuario. |
| Auth | Forgot password | Parcial | `frontend/src/app/(auth)/forgot-password/page.tsx` | Si falla la request no muestra error claro. |
| Auth | Reset password | Completo | `frontend/src/app/(auth)/reset-password/page.tsx` | Valida token/password y redirige a login. |
| Dashboard | KPIs y cards | Parcial | `frontend/src/app/(main)/dashboard/page.tsx`, `frontend/src/services/dashboard.service.ts` | Carga real; estado vacío global débil. |
| Assets | Crear/listar/detalle | Completo | `frontend/src/app/(main)/assets/page.tsx`, `frontend/src/components/assets/AssetModal.tsx`, `frontend/src/components/assets/AssetDrawer.tsx` | Flujo principal funcional. |
| Assets | Editar/eliminar/activar | Parcial | `frontend/src/app/(main)/assets/page.tsx`, `backend/src/assets/assets.controller.ts` | Acciones visibles para roles que backend puede rechazar. |
| Assets | Exportar PDF | No implementado | `frontend/src/app/(main)/assets/[id]/page.tsx` | Botón visible sin `onClick`. |
| Services | Crear desde asset | Completo | `frontend/src/components/assets/NewServiceForm.tsx`, `frontend/src/app/(main)/assets/[id]/new-service/page.tsx` | Asociado al asset correcto y refetch posterior. |
| Services | Crear desde listado | Parcial | `frontend/src/app/(main)/service/page.tsx`, `frontend/src/components/services/ServiceModal.tsx` | Funciona, pero validación/archivos menos robustos. |
| Services | Editar/cambiar estado | No implementado | `frontend/src/services/services.service.ts`, `backend/src/services/services.controller.ts` | API existe, pero no hay flujo UI claro. |
| Users | Listar/crear/invitar | Completo | `frontend/src/app/(main)/users/page.tsx`, `frontend/src/components/users/UserModal.tsx`, `frontend/src/components/users/InvitationModal.tsx` | Flujo admin funcional. |
| Users | Drawer móvil acciones | Roto | `frontend/src/components/users/UserDrawer.tsx` | Editar, reset password y eliminar solo cierran menú. |
| Users | Detalle/historial | Parcial | `frontend/src/app/(main)/users/[id]/page.tsx` | Historial carga real; varios textos hardcodeados/encoding roto. |
| Settings | Organización/branding | Parcial | `frontend/src/app/(main)/settings/page.tsx`, `backend/src/organizations/organizations.controller.ts` | Guarda logo/color/icono/org name para admin. |
| Settings | Perfil propio | Parcial | `frontend/src/app/(main)/settings/page.tsx`, `backend/src/users/users.controller.ts` | Guarda perfil/password/avatar, pero timezone no se envía. |
| Settings | Planes | No implementado | `frontend/src/app/(main)/settings/page.tsx` | Visual sin operación real confirmada. |
| Settings | Seguridad/2FA/dispositivos | Completo | `frontend/src/app/(main)/settings/page.tsx`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts` | 2FA TOTP real, sesiones en backend, revocación por dispositivo y cierre de otras sesiones. |
| Settings | Notificaciones | No implementado | `frontend/src/app/(main)/settings/page.tsx` | Todas las opciones están apagadas, deshabilitadas y marcadas como `Proximamente`. |
| Archivos/imágenes | Assets imágenes | Completo | `AssetModal.tsx`, `AssetDrawer.tsx`, `imageCompression.ts` | Compresión, crop y validación cliente. |
| Archivos/imágenes | Services imágenes | Parcial | `NewServiceForm.tsx`, `ServiceModal.tsx` | Buen flujo desde asset; modal general menos consistente. |
| Navegación | Guards/rutas | Parcial | `AuthContext.tsx`, `proxy.ts`, `Sidebar.tsx`, `BottomNav.tsx` | Cliente valida roles; proxy solo valida cookie. |

## 3. Hallazgos funcionales

| ID | Severidad | Módulo | Flujo afectado | Archivo o componente relacionado | Problema encontrado | Impacto para el usuario | Recomendación |
|---|---|---|---|---|---|---|---|
| F-01 | Baja | Settings | Notificaciones | `settings/page.tsx` | No hay persistencia ni envío real de notificaciones. | Bajo impacto porque las opciones están apagadas, deshabilitadas y marcadas como `Proximamente`. | Mantener desactivado hasta implementar backend real. |
| F-02 | Baja | Settings | Planes | `settings/page.tsx` | Visual sin operación real confirmada. | Puede generar expectativa comercial no disponible. | Ocultar, marcar como próximo o conectar flujo real. |
| F-03 | Alta | Users | Acciones móviles | `UserDrawer.tsx` | Editar, reset password y eliminar solo cierran el menú. | Botones aparentes sin efecto. | Conectar acciones reales o eliminarlas. |
| F-04 | Alta | Assets | Acciones por rol | `assets/page.tsx`, `AssetModal.tsx` | Crear/editar puede mostrarse a roles que luego fallan en backend. | Flujo termina en error evitable. | Alinear visibilidad de botones con permisos reales. |
| F-05 | Media | Services | Eliminar servicio | `service/page.tsx` | Delete aparece para WORKER, pero backend lo rechaza. | Error funcional al intentar borrar. | Mostrar delete solo a ADMIN/SUPER_ADMIN. |
| F-06 | Media | Services | Crear servicio | `service/page.tsx` | `SUPER_ADMIN` no tiene botón de crear en listado, aunque backend permite crear. | Experiencia inconsistente por rol. | Corregir `canCreate`. |
| F-07 | Media | Services | Editar/status | `services.service.ts`, `services.controller.ts` | API existe para update/status, pero no hay flujo frontend completo. | No se puede editar servicio desde UI. | Crear flujo o retirar expectativa visual. |
| F-08 | Media | Assets | Export PDF | `assets/[id]/page.tsx` | Botón visible sin acción. | Acción rota en detalle de asset. | Implementar export o remover botón. |
| F-09 | Media | Auth | Forgot password | `forgot-password/page.tsx` | Fallo de request no muestra mensaje claro. | Usuario no sabe si el correo se envió o falló. | Agregar catch/toast de error. |
| F-10 | Media | Archivos/imágenes | Services desde modal general | `ServiceModal.tsx` | No aplica la misma compresión/límite visible que `NewServiceForm`. | Errores por tamaño/cantidad pueden aparecer tarde y genéricos. | Unificar manejo de imágenes. |
| F-11 | Media | Dashboard | Estado sin datos | `dashboard/page.tsx` | No hay empty state global claro cuando todo está en cero. | Demo con tenant nuevo se ve vacía sin guía. | Agregar estado vacío orientado a crear asset/service. |
| F-12 | Baja | UI general | Textos | Varios archivos | Hay mojibake/textos hardcodeados: `AÃ±o`, `contraseÃ±a`, etc. | Mala percepción en demo. | Normalizar encoding y traducciones. |

## 4. Revisión por módulo

### Auth

Qué funciona:

* Login con validación de formulario.
* Login con 2FA TOTP cuando el usuario lo tiene activo.
* Registro por invitación con validación de token.
* Reset de contraseña con token.
* Logout limpia token, cookie, cache, revoca la sesión actual en backend y redirige a `/login`.
* Sesión expirada termina limpiando sesión vía interceptor/`refreshUser`.

Qué está incompleto:

* Forgot password no informa bien errores de backend/red.

Qué parece estar simulado o solo visual:

* No se detectó simulación principal en auth.

Qué está roto:

* No hay roto crítico confirmado, pero forgot password requiere prueba manual de error.

Qué debería corregirse primero:

* Manejo visible de errores en recuperación de contraseña.

### Dashboard

Qué funciona:

* KPIs cargan desde `dashboardService.getStats`.
* Cards de servicios recientes, cobertura, operadores y resumen.
* Filtros de fecha conectados a query.
* Loading/error con retry.

Qué está incompleto:

* Estado vacío global pobre para organizaciones sin datos.
* Validar manualmente que métricas coincidan con listados reales.

Qué parece estar simulado o solo visual:

* No se detectó simulación clara.

Qué está roto:

* No hay roto confirmado desde código.

Qué debería corregirse primero:

* Empty state para tenant nuevo y prueba de consistencia de contadores.

### Assets

Qué funciona:

* Crear asset.
* Listar con paginación, búsqueda y filtros.
* Ver drawer y detalle completo.
* Editar datos e imagen.
* Activar/desactivar y eliminar con confirmación.
* Crear service asociado desde asset.
* Imágenes con compresión/crop y soporte HEIC/HEIF en algunos flujos.

Qué está incompleto:

* Filtro por categorías parece tener estado interno pero no UI clara.
* Export PDF no implementado.

Qué parece estar simulado o solo visual:

* Botón de exportar PDF en detalle.

Qué está roto:

* Acciones visibles para roles que no deberían poder completarlas.

Qué debería corregirse primero:

* Permisos visibles por rol y retirar/implementar export PDF.

### Services

Qué funciona:

* Crear service dentro de asset.
* Crear service desde listado seleccionando asset.
* Listar historial.
* Ver detalle con adjuntos.
* Filtrar por fecha, worker, asset y búsqueda.
* El historial del asset se invalida/refresca al crear desde asset.

Qué está incompleto:

* No hay flujo frontend claro para editar service.
* No hay flujo claro para cambiar status/publicación.
* Modal general de creación tiene manejo de imágenes menos robusto que `NewServiceForm`.

Qué parece estar simulado o solo visual:

* No hay botón simulado principal, pero sí capacidad backend no expuesta.

Qué está roto:

* Delete visible para WORKER aunque backend lo rechaza.
* `SUPER_ADMIN` puede crear por backend pero no desde el listado.

Qué debería corregirse primero:

* Alinear roles, decidir si edición/status se muestra o se oculta.

### Users

Qué funciona:

* Listado admin/super admin.
* KPIs de usuarios.
* Crear usuario manual.
* Invitar usuario.
* Editar nombre/email/avatar.
* Activar/desactivar.
* Eliminar lógico vía desactivación.
* Ver historial de services por usuario.

Qué está incompleto:

* Edición no parece permitir cambiar rol desde el modal.
* No hay flujo real de reset password para un usuario desde drawer.
* Historial limita a 50/100 services según pantalla; requiere validación si hay más.

Qué parece estar simulado o solo visual:

* Menú móvil de `UserDrawer`: editar, restablecer contraseña y eliminar.

Qué está roto:

* Acciones del menú móvil no hacen nada real.

Qué debería corregirse primero:

* Conectar o remover acciones móviles del drawer.

### Settings

Qué funciona:

* Admin puede guardar datos de organización: nombre, logo, color, icono default, mostrar nombre.
* Perfil propio guarda nombre, email, teléfono, avatar y password.
* Tabs y navegación por query param funcionan.
* 2FA TOTP funciona con setup, verificación, backup codes y login en dos pasos.
* Manage Access & Devices lista sesiones reales, muestra dispositivo actual y permite revocar otros dispositivos.
* Cerrar sesión y cerrar todas las demás sesiones revocan sesiones en backend.

Qué está incompleto:

* Timezone se selecciona pero no se envía en `handleProfileSave`.
* Planes no tiene operación real confirmada.
* Storage usage/reconcile existe en backend, pero no se vio flujo claro en UI principal.
* Notificaciones no tienen backend real; se muestran apagadas, deshabilitadas y como `Proximamente`.

Qué parece estar simulado o solo visual:

* Planes.
* Notificaciones, pero mitigadas porque no son interactivas.

Qué está roto:

* No hay roto crítico confirmado en seguridad de cuenta; requiere prueba funcional en producción para GeoIP de sesiones.

Qué debería corregirse primero:

* Mantener planes/notificaciones no implementados como próximos o conectarlos a backend antes de demo libre.

### Archivos/imágenes

Qué funciona:

* Assets: subida, crop, compresión, reemplazo.
* User avatar en drawer/modal/settings.
* Services desde asset: compresión, límite de 8 fotos en frontend.
* Backend limita imágenes y MIME type.

Qué está incompleto:

* `ServiceModal` general permite múltiples imágenes sin la misma UX de límite/compresión.
* Logos de owners no usan crop/compresión equivalente.
* Eliminación de imagen individual ya subida no se confirmó en UI.

Qué parece estar simulado o solo visual:

* No aplica, pero algunos errores son genéricos.

Qué está roto:

* No roto confirmado, requiere pruebas manuales con iPhone/HEIC y archivos grandes.

Qué debería corregirse primero:

* Unificar componente de carga de imágenes para services.

### Navegación general

Qué funciona:

* Sidebar y bottom nav filtran por `canAccess`.
* Layout protegido muestra loading.
* Redirección cliente para rutas no permitidas.
* Botones volver existen en detalles relevantes.

Qué está incompleto:

* Proxy solo valida cookie, no rol; desde UX puede haber breve carga/redirección cliente.
* `/owners` no está en `proxy.ts`, aunque sí está en `canAccess`.

Qué parece estar simulado o solo visual:

* No principal.

Qué está roto:

* Requiere validación manual abrir rutas por URL directa para cada rol.

Qué debería corregirse primero:

* Incluir `/owners` en protección proxy y validar navegación directa.

### Estados de UI

Qué funciona:

* Hay loading/error/empty states en assets, users, dashboard parcial y services.
* Hay confirmaciones destructivas para assets/users/owners/services.
* Formularios principales tienen disabled/loading.

Qué está incompleto:

* Algunos errores muestran mensajes genéricos.
* Estados vacíos no siempre guían al siguiente paso.
* Textos hardcodeados y encoding roto afectan percepción.

Qué parece estar simulado o solo visual:

* Planes y notificaciones en Settings.

Qué está roto:

* Botones sin acción real ya listados.

Qué debería corregirse primero:

* Botones sin acción y errores silenciosos.

## 5. Pruebas manuales recomendadas

1. Login con credenciales válidas y verificar redirección según rol.
2. Login con credenciales inválidas y verificar mensaje visible.
3. Solicitar recuperación de contraseña con red desconectada/backend caído y verificar error visible.
4. Registrar usuario desde token de invitación válido.
5. Abrir `/dashboard` con organización sin datos y verificar estado visual.
6. Crear asset y confirmar que aparece en listado, drawer y detalle.
7. Editar asset y confirmar que listado/detalle reflejan cambios.
8. Subir imagen de asset desde desktop y desde iPhone/HEIC.
9. Crear service desde detalle de asset y confirmar que aparece en historial del asset y en `/service`.
10. Crear service desde `/service` seleccionando asset y confirmar asociación correcta.
11. Intentar crear service sin título y confirmar validación visible.
12. Subir más de 8 o 10 imágenes en service y revisar mensaje.
13. Como WORKER, intentar borrar service y verificar que el botón no debería estar visible.
14. Como EXTERNAL, validar que no aparezcan acciones de crear/editar asset si no puede completarlas.
15. Crear usuario manual con password inválida y verificar mensaje.
16. Invitar usuario externo sin owner y verificar validación.
17. Abrir drawer de usuario en móvil y probar Editar/Reset/Eliminar.
18. Cambiar avatar de usuario y verificar persistencia tras recargar.
19. Entrar a settings, cambiar logo/color/icono y confirmar que se refleja en sidebar/topbar.
20. Confirmar que notificaciones aparecen apagadas, deshabilitadas y marcadas como `Proximamente`.
21. Probar botón “Actualizar contraseña” en tab security móvil/desktop.
22. Activar 2FA TOTP, cerrar sesión, iniciar login con código 2FA y probar un backup code.
23. Abrir dos sesiones en navegadores/dispositivos distintos y revocar una desde Manage Access & Devices.
24. Usar “Cerrar sesión en todos los demás dispositivos” y validar que las otras sesiones vuelvan a login al refrescar.
25. Cerrar sesión e intentar entrar directo a `/assets`, `/service`, `/users`, `/owners`, `/settings`.
26. Abrir un ID inexistente de asset/user/service y verificar estado de error/not found.

## 6. Prioridad de corrección

### Bloqueantes para demo

* Mantener notificaciones y planes como no interactivos/`Proximamente` o conectarlos a backend real.
* Conectar o remover acciones móviles de `UserDrawer`.
* Ocultar botones por rol que terminan en error: assets y services.
* Remover o implementar Export PDF en asset detail.
* Corregir error silencioso de forgot password.

### Importantes antes de producción

* Implementar edición/status de services o retirar la expectativa del flujo.
* Unificar upload de imágenes entre `NewServiceForm` y `ServiceModal`.
* Mejorar estados vacíos en dashboard y módulos.
* Validar métricas dashboard contra datos reales.
* Proteger `/owners` también en proxy.
* Corregir textos con encoding roto y hardcodeados.

### Mejoras posteriores

* Mejorar UX de filtros móviles/desktop.
* Persistir timezone de perfil o retirarlo.
* Agregar breadcrumbs si se considera necesario.
* Agregar manejo de archivos huérfanos desde UI si se usará storage reconcile.
* Ampliar reportabilidad/exportaciones.

## 7. Archivos que requieren revisión/corrección

* `frontend/src/app/(main)/settings/page.tsx`: concentra flujos reales y secciones proximamente; revisar planes/notificaciones antes de demo libre.
* `frontend/src/components/users/UserDrawer.tsx`: acciones móviles sin efecto real.
* `frontend/src/app/(main)/assets/page.tsx`: visibilidad de crear/editar/eliminar por rol.
* `frontend/src/app/(main)/assets/[id]/page.tsx`: botón Export PDF sin acción.
* `frontend/src/app/(main)/service/page.tsx`: `canCreate` inconsistente y delete visible para roles no autorizados.
* `frontend/src/components/services/ServiceModal.tsx`: upload y validaciones menos completas.
* `frontend/src/components/assets/NewServiceForm.tsx`: buen patrón para reutilizar en services.
* `frontend/src/app/(auth)/forgot-password/page.tsx`: falta feedback de error.
* `frontend/src/lib/AuthContext.tsx`: permisos de rutas en cliente.
* `frontend/src/proxy.ts`: protección incompleta de rutas como `/owners`.
* `backend/src/services/services.controller.ts`: API de update/status existe, pero falta flujo frontend.
* `backend/src/organizations/organizations.controller.ts`: storage/settings disponibles parcialmente en UI.

## 8. Conclusión

Recall está **funcionalmente presentable solo con una demo guiada**: login, dashboard, assets, creación de services desde asset y users admin pueden mostrarse con cuidado.

No lo mostraría todavía como demo libre a cliente porque hay acciones visibles sin implementación real, especialmente en users móvil, planes/notificaciones y algunas acciones de assets/services, además de inconsistencias de permisos que pueden producir errores durante el recorrido.

Antes de demo real conviene corregir u ocultar lo no implementado, alinear botones con permisos reales y cerrar los flujos rotos evidentes.
