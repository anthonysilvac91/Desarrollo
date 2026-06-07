# Auditoría de Archivos, Imágenes y Storage - Recall

**Fecha:** 2026-06-07
**Alcance:** Subida, compresión, visualización, almacenamiento y compatibilidad mobile/iPhone
**Metodología:** Revisión estática del código fuente. Sin ejecución de pruebas. Sin modificación de código.

---

## 1. Resumen ejecutivo

El sistema de archivos e imágenes de Recall tiene una arquitectura razonablemente sólida: Multer en el borde, validación por firma binaria (magic bytes), procesamiento con Sharp (EXIF-aware), rutas aisladas por organización en Supabase Storage, registro en base de datos con trazabilidad, y un servicio de gobernanza con cuotas y reconciliación de huérfanos.

Sin embargo, existen riesgos reales que afectan específicamente a iPhone/Safari y que no pueden descartarse solo desde el código.

**Riesgo global: MEDIO**

| Dimensión | Estado |
|---|---|
| Compatibilidad iPhone/Safari | ⚠️ Requiere validación manual |
| Compresión de imágenes | ✅ Implementada, con inconsistencias menores |
| Validaciones de archivos | ✅ Robustas (magic bytes + Sharp) |
| Storage y rutas | ✅ Correcto por organización |
| Asociación de archivos a entidades | ✅ Correcta con cleanup |
| Reemplazo/eliminación | ✅ Correcto con riesgo menor de huérfanos |
| Eliminación individual de adjuntos | ❌ No disponible en services |
| LocalStorage en producción | ❌ Sin control de acceso |

**Listo para demo:** Con precaución. Funciona bien en desktop Chrome. iPhone Safari requiere validación manual antes de mostrar a clientes.

**Listo para producción:** No en su estado actual. Requiere pruebas reales en iPhone/Safari y resolver al menos los hallazgos F-01, F-03 y F-04.

---

## 2. Mapa de flujos de archivos detectados

| Módulo | Tipo de archivo | Flujo | Archivos / componentes / endpoints | Estado | Observación |
|---|---|---|---|---|---|
| Assets | Thumbnail (1 por asset) | Creación con foto | `AssetModal.tsx`, `POST /assets`, `assets.service.ts create()`, `imageCompression.ts` | Parcial | `accept="image/*"` sin `.heic` en el input |
| Assets | Thumbnail | Reemplazo | `AssetDrawer.tsx`, `PATCH /assets/:id`, `assets.service.ts update()` | Correcto | Limpia archivo anterior; rollback si falla |
| Services | Adjuntos (hasta 10 imágenes) | Creación | `NewServiceForm.tsx`, `POST /services`, `services.service.ts create()` | Parcial | Quota check usa tamaño pre-compresión |
| Services | Adjuntos | Eliminación | `services.service.ts remove()` | Parcial | Solo elimina todo el service; sin endpoint para adjunto individual |
| Users | Avatar (1 por usuario) | Cambio de foto | `UserDrawer.tsx`, `PATCH /users/me`, `users.service.ts` | Correcto | Compresión frontend + Sharp backend |
| Organizations | Logo de org | Creación / cambio | `settings/page.tsx`, `PATCH /organizations/:id/settings` | Requiere validación | Múltiples inputs en settings, flujo completo no verificado |
| Owners | Logo de owner | Creación / edición | `OwnerModal.tsx`, `POST /owners`, `PATCH /owners/:id` | Requiere validación | `accept="image/*"` sin `.heic` |
| Settings | Branding / logo | Upload desde settings | `settings/page.tsx` | Requiere validación | Varios inputs en la misma página |

---

## 3. Hallazgos

| ID | Severidad | Área | Archivo / componente / endpoint | Problema | Impacto para el usuario | Riesgo técnico | Recomendación |
|---|---|---|---|---|---|---|---|
| F-01 | Alta | Compatibilidad iPhone/Safari | `AssetModal.tsx:206` | `accept="image/*"` sin `.heic`/`.heif` en AssetModal y OwnerModal. En algunos dispositivos/versiones iOS esto puede impedir que el selector muestre fotos HEIC de la galería, o puede mostrarlas pero luego enviar el archivo con MIME vacío. | Usuario en iPhone no puede subir fotos de la cámara o galería desde los modales afectados. | El comportamiento real depende de la versión iOS/Safari: puede fallar silenciosamente o enviar un archivo que el backend rechaza. | Agregar `.heic,.heif` al atributo `accept` en todos los inputs de imagen para garantizar que iOS los incluya en el selector. |
| F-02 | Alta | Compatibilidad iPhone/Safari | `ImageCropModal.tsx`, `LogoCropModal.tsx` | El crop modal recibe un `imageSrc` (object URL del archivo original). Si el archivo es HEIC y la conversión con `heic2any` no ocurrió antes de abrir el modal, el `<img>` tag del cropper no puede renderizar HEIC nativo en Safari. El resultado es imagen en blanco o error al renderizar. | El usuario selecciona una foto, ve el modal de recorte, pero la imagen no aparece o aparece rota. | Dependiente de la versión iOS: en iOS 13+ Safari puede decodificar HEIC en `<img>` tags en algunos casos, en versiones anteriores no. Requiere validación manual. | Verificar que la conversión HEIC→JPEG (`normalizeHeicFile`) siempre ocurra **antes** de generar el object URL que se pasa al modal de recorte. |
| F-03 | Media | Compresión / Storage | `services.service.ts:120-121` | `assertCanStore` se llama con `totalIncomingBytes` **antes** de `processUploadedImage`. El quota check usa los tamaños originales (sin comprimir), que pueden ser hasta 5-10x mayores que los tamaños finales WebP procesados por Sharp. | Uploads de services que cabrían dentro de la cuota son rechazados falsamente con error 413. | Las organizaciones que están cerca del límite de cuota reciben errores aunque sus archivos comprimidos sí cabrían. | Mover `assertCanStore` para después del procesamiento, o usar un factor de estimación. |
| F-04 | Media | Backend / API | `services.service.ts`, `services.controller.ts` | No existe endpoint para eliminar un adjunto individual de un servicio. El único mecanismo de limpieza es eliminar el servicio completo (`DELETE /services/:id`). | Un técnico que sube 10 fotos y quiere quitar una no puede hacerlo. Tampoco hay UI para esta acción. | Los adjuntos no deseados quedan permanentemente asociados al servicio. Aumenta uso de storage sin control. | Crear `DELETE /services/:serviceId/attachments/:attachmentId` con limpieza de blob y registro en DB. |
| F-05 | Alta | Storage / Acceso | `local-storage.service.ts` | `LocalStorageService` retorna URLs relativas tipo `/uploads/org/{orgId}/...` sin ningún mecanismo de autenticación. Cualquiera que conozca o deduzca la URL puede acceder al archivo directamente. | Si el backend se despliega con `STORAGE=local` en producción, archivos privados de clientes quedan expuestos públicamente. | Cross-tenant data exposure. Un usuario de otra organización puede acceder a fotos de assets o avatares si adivina o deduce la ruta. | Nunca usar `LocalStorageService` en producción. Documentar que es solo para desarrollo local. Agregar guardia en el arranque que lo impida si `NODE_ENV=production`. |
| F-06 | Media | UX / Estados | `imageCompression.ts:104-107` | Si `heic2any` falla al convertir una imagen HEIC, el mensaje de error es: `"No se pudo convertir la imagen HEIC/HEIF. Prueba seleccionarla como JPEG desde el iPhone."`. La instrucción es ambigua: los usuarios promedio no saben cómo "seleccionarla como JPEG". | El usuario no entiende qué hacer y abandona la subida. Genera soporte innecesario. | Bajo en riesgo técnico, alto en impacto UX. | Cambiar a: `"Tu dispositivo usa un formato de imagen no compatible. Prueba tomar una nueva foto o compartirla desde la galería como JPEG."` |
| F-07 | Baja | Storage / Datos | `supabase-storage.service.ts:136-162` | `deleteFile` en Supabase logea el error pero **no lanza excepción**. Si la eliminación del blob falla, `deleteStoredFileAndBlob` continúa y elimina el registro de DB. El blob queda huérfano en Supabase sin referencia en DB. | El usuario no nota nada. El blob huérfano consume cuota de storage. | Bajo: el `StorageGovernanceService` tiene `reconcileOrganizationFiles()` que detecta y limpia huérfanos. Pero la reconciliación no es automática ni periódica. | Documentar que reconciliación debe ejecutarse periódicamente. Considerar un cron job o endpoint admin. |
| F-08 | Baja | Compresión | `image-processing.ts:29` | `sharp(file.buffer, { animated: false })` descarta todos los frames de GIFs animados. El resultado es un GIF estático. No hay advertencia al usuario. | Si un usuario sube un GIF animado esperando que quede animado, verá solo el primer frame estático. | Bajo. GIFs animados son un caso de uso poco probable en un SaaS de gestión de activos. | Agregar validación que rechace GIFs o que advierta al usuario que la animación se perderá. |
| F-09 | Baja | Storage | `supabase-storage.service.ts:26` | `SIGNED_URL_TTL_SECONDS` default de 3600 segundos (1 hora). Las URLs firmadas expiran mientras el usuario tiene la app abierta, por ejemplo en una vista de detalle de asset o en un listado. | Imágenes que cargaron bien al principio de la sesión aparecen rotas después de 1 hora sin recargar. | Bajo. El backend requiere mínimo 600s. Se genera signed URL al resolver, no al listar. Si el listado es reciente, las URLs tienen vida completa. | Aumentar a 86400s (24h) para reducir esta fricción. O implementar refresh automático de signed URLs en el frontend. |
| F-10 | Baja | Backend / Validación | `multer-image-options.ts:4-9` | Multer permite solo `image/jpeg`, `image/png`, `image/webp`, `image/gif`. No permite `image/heic`/`image/heif`. En la práctica el frontend convierte HEIC a JPEG antes de enviar, por lo que Multer nunca ve el HEIC. Pero si el frontend falla o si se llama la API directamente, el error 400 del backend es confuso ("Formato de imagen no permitido") sin mencionar HEIC. | Desarrolladores o integraciones que envían HEIC directamente a la API reciben error sin contexto claro. | Bajo en producción con frontend. Medio si hay integraciones API. | El filtro de Multer está correcto para la arquitectura actual. Mejorar solo el mensaje de error para indicar los formatos aceptados explícitamente. |
| F-11 | Baja | Compresión | `imageCompression.ts:41-43` | Si `canvas.toBlob` con tipo `image/webp` falla (Safari < 16 no soporta `canvas.toBlob` con WebP), el fallback a JPEG es correcto. Pero si ambos fallan (error interno del canvas), el error que ve el usuario es genérico: `"No se pudo comprimir la imagen seleccionada."` Sin saber si fue OOM, canvas no disponible, etc. | Usuario no sabe si reintentar o si hay un problema con su dispositivo. | Bajo. Los browsers modernos soportan `canvas.toBlob`. | Añadir contexto al error: si canvas no está disponible vs si la imagen es muy grande para la memoria del dispositivo. |
| F-12 | Baja | UX / Estados | `NewServiceForm.tsx`, `AssetDrawer.tsx` | No hay indicador de progreso de subida por archivo individual al subir múltiples adjuntos. El botón se deshabilita durante la subida, pero el usuario no ve qué está pasando con archivos de 10MB en conexión lenta. | El usuario puede pensar que la app se colgó. Potencial de cancelar el navegador y reintentar. | Bajo. No causa pérdida de datos, solo mala experiencia en conexión lenta. | Agregar estado `uploading` con feedback visual (spinner, texto "Subiendo X de Y"). |

---

## 4. Revisión por área

### 4.1 Subida de archivos

**Qué está bien:**
- Todos los módulos principales (assets, services, users, owners) tienen endpoints de subida funcionando con Multer.
- Se usa `memory storage` en Multer: el archivo vive en RAM y se pasa a Sharp sin tocar disco.
- El payload se valida en tamaño antes de procesarse (límite Multer).
- El frontend pre-comprime las imágenes antes de enviar, reduciendo el tamaño del payload significativamente.

**Qué está incompleto:**
- `AssetModal.tsx` usa `accept="image/*"` sin `.heic`/`.heif`. En iOS este atributo puede limitar qué archivos muestra el selector nativo.
- `OwnerModal.tsx` tiene la misma limitación.
- No hay endpoint de subida de adjuntos separado del de creación de service: los archivos se suben siempre junto con la creación del registro.

**Qué es riesgoso:**
- Si el servidor está bajo carga y el procesamiento Sharp tarda, todos los buffers de imagen viven en RAM simultáneamente. Con 10 archivos de 10MB cada uno, eso son 100MB de RAM solo para un request. El límite de 10 archivos mitiga esto, pero no elimina el riesgo con alta concurrencia.

**Qué debería corregirse primero:**
- Agregar `.heic,.heif` al atributo `accept` de todos los inputs de imagen (F-01).

---

### 4.2 Compatibilidad iPhone/Safari

**Qué está bien:**
- `isImageFile()` en `imageCompression.ts:76-82` maneja correctamente `file.type` vacío usando fallback por extensión.
- `isHeicFile()` detecta HEIC por MIME type O por extensión de nombre de archivo (incluyendo mayúsculas por el `.toLowerCase()`).
- `normalizeHeicFile()` usa `heic2any` (carga lazy con `import()`) para convertir HEIC→JPEG antes de enviar al backend.
- `canvas.toBlob` con fallback a JPEG si WebP no está soportado.
- `toDataURL` NO se usa (correcto: `toBlob` es más eficiente en memoria).
- EXIF orientation manejado por Sharp `.rotate()` en el backend.

**Qué está incompleto:**
- No está validado si el objeto URL generado por `URL.createObjectURL(heicFile)` puede ser renderizado por el `<img>` tag del cropper en Safari sin conversión previa (F-02). El `loadImage()` en `imageCompression.ts:59-74` depende de que el browser pueda decodificar el formato del archivo como imagen HTML.
- `heic2any` es pesado. En dispositivos con poca RAM (iPhone SE, modelos anteriores), la conversión en memoria puede fallar con un error de OOM antes de que el usuario vea algo.

**Qué es riesgoso:**
- El flujo que pasa imágenes HEIC directamente a un modal de recorte (crop modal) antes de conversión es el mayor riesgo de Safari no confirmado (F-02). Requiere prueba manual.
- El atributo `accept="image/*"` en algunos inputs: en iOS 14 y anteriores este atributo puede comportarse diferente para HEIC.

**Qué debería corregirse primero:**
- Verificar (prueba manual, F-02) que `normalizeHeicFile` se llama antes de generar el object URL para el crop modal.
- Agregar `.heic,.heif` a todos los inputs (F-01).

---

### 4.3 Compresión de imágenes

**Qué está bien:**
- Compresión en dos etapas: frontend (`canvas.toBlob`) + backend (Sharp). Si el frontend falla, Sharp igual procesa.
- Sharp usa `{ animated: false }` para estabilidad, `.rotate()` para EXIF, `.resize({ fit: 'inside', withoutEnlargement: true })` para preservar aspecto.
- Formatos de salida configurables: WebP (preferido), JPEG, PNG.
- Calidades razonables: WebP 82-84 para assets/services, 82 para avatares.
- Dimensiones máximas razonables: 1600px para thumbnails, 2400px para adjuntos de services.

**Qué está incompleto:**
- GIFs animados se procesan como estáticos sin aviso (F-08).
- No hay compresión estimada mostrada al usuario antes de subir.
- Los quality values entre frontend y backend no están centralizados: `imageCompression.ts` tiene valores distintos a `image-processing.ts`.

**Qué es riesgoso:**
- Compresión cliente en dispositivos con poca RAM: `canvas.drawImage` de una imagen de 24 megapíxeles puede consumir más de 96MB de RAM en el canvas solo (4 bytes por píxel × 24M píxeles). En iPhone SE de primera generación (1GB RAM), esto puede causar tab crash.

**Qué debería corregirse primero:**
- Agregar validación de `maxPixels` en el frontend antes de intentar dibujar en canvas, similar a la validación que tiene el backend.

---

### 4.4 Validaciones

**Qué está bien:**
- Detección de formato por firma binaria (magic bytes) en `image-validation.ts`: no confía en el MIME type reportado por el cliente.
- Validación de tamaño, dimensiones y píxeles totales.
- `ensureNoManualFileUrl` impide que se envíen URLs arbitrarias en lugar de archivos.
- Límites diferentes por tipo de archivo: assets/services 10MB, avatares/logos 2MB.
- Validación de buffer vacío.

**Qué está incompleto:**
- No hay validación de nombre de archivo (caracteres especiales, longitud). En la práctica el nombre original se guarda en `original_name` pero no se sanitiza.
- No hay validación de archivos duplicados (mismo contenido subido dos veces).

**Qué es riesgoso:**
- El backend no valida HEIC porque Multer lo bloquea antes. Si en algún futuro se agrega HEIC a la allowlist de Multer sin agregar detección binaria de HEIC en `image-validation.ts`, archivos HEIC pasarían la validación de magic bytes incorrectamente (serían marcados como formato inválido).

**Qué debería corregirse primero:**
- Nada crítico en esta área. La validación es sólida.

---

### 4.5 Storage / Buckets

**Qué está bien:**
- Estructura de rutas consistente: `org/{orgId}/{entidad}/{entityId}/{tipo}/{uuid}.{ext}`.
- UUID aleatorio por archivo: evita colisiones de nombre.
- Separación clara entre bucket público (logos) y privado (avatares, thumbnails, adjuntos).
- Archivos privados accesibles solo por signed URLs con TTL mínimo de 600s.
- `getExtensionForMime` asigna extensión correcta desde el MIME type real procesado por Sharp.

**Qué está incompleto:**
- TTL default de 3600s para signed URLs puede causar imágenes rotas en sesiones largas (F-09).
- No hay mecanismo automático (cron) para ejecutar `reconcileOrganizationFiles` y limpiar blobs huérfanos.

**Qué es riesgoso:**
- `LocalStorageService` expone archivos sin autenticación (F-05). Si se usa en producción accidentalmente, todos los archivos de todos los clientes son públicamente accesibles por URL.

**Qué debería corregirse primero:**
- Bloquear uso de LocalStorage en producción (F-05).
- Aumentar TTL de signed URLs a 86400s (F-09).

---

### 4.6 Asociación con datos

**Qué está bien:**
- Todo archivo queda registrado en `StoredFile` con `organization_id`, `entity_type`, `entity_id`, `kind`, `visibility` y `uploaded_by_user_id`.
- Los registros de `StoredFile` están atados a la organización: no hay forma de registrar un archivo de una org bajo otra.
- Las rutas en storage incluyen `orgId` y `entityId` como prefijos: un archivo de un asset está siempre bajo `org/{orgId}/assets/{assetId}/`.

**Qué está incompleto:**
- No hay validación explícita de que el `entityId` pasado al registrar un archivo corresponda a una entidad existente en la base de datos. Si `assetId` es un UUID inválido, el `StoredFile` se crea igual y luego no puede asociarse a nada.

**Qué es riesgoso:**
- En `assets.service.ts create()`: si la subida de archivo tiene éxito pero la creación del asset falla (líneas 147-160), el rollback borra correctamente el archivo. Este flujo está bien manejado.
- En `services.service.ts create()`: si un archivo individual falla durante el loop de procesamiento, el catch block borra todos los `storedFileIds` acumulados hasta ese punto. Correcto.

**Qué debería corregirse primero:**
- Agregar validación de existencia de entidad antes de registrar el StoredFile (mejora de consistencia, no urgente).

---

### 4.7 Reemplazo y eliminación

**Qué está bien:**
- En `assets.service.ts update()`: el flujo es (1) sube nuevo archivo, (2) registra en DB, (3) actualiza asset, (4) borra archivo anterior. El rollback en el catch borra el nuevo archivo si el update falla.
- En `services.service.ts remove()`: antes de eliminar el service, primero obtiene todos los `file_id` de adjuntos, elimina los registros de `ServiceAttachment`, luego limpia los blobs via `deleteStoredFileAndBlob`.
- En `users.service.ts` (verificado por el Explore agent): el avatar anterior se limpia al cambiar foto.

**Qué está incompleto:**
- No hay endpoint para eliminar un adjunto individual de un service sin eliminar el service completo (F-04).
- No hay cron ni endpoint admin para ejecutar `reconcileOrganizationFiles` periódicamente y limpiar blobs huérfanos de deleciones fallidas.

**Qué es riesgoso:**
- Si `deleteFile` en Supabase falla silenciosamente (F-07), el blob queda huérfano. Esto puede pasar si Supabase está temporalmente no disponible durante una eliminación. La frecuencia real de este escenario es desconocida sin datos de producción.

**Qué debería corregirse primero:**
- Implementar endpoint de eliminación de adjunto individual (F-04).

---

### 4.8 Visualización y descarga

**Qué está bien:**
- Las URLs de archivos privados son signed URLs de Supabase (no exponen el path real del bucket).
- Las URL se resuelven al momento de servir la respuesta, no se persisten en DB (la DB guarda `storage_ref` y el backend la transforma a URL en cada request).
- `resolveFileUrlOrRef` en `stored-files.service.ts:67-80` maneja tanto el formato nuevo (storedFileId) como referencias legacy.

**Qué está incompleto:**
- No hay manejo frontend explícito de errores "imagen no encontrada" o "URL expirada" (requiere validación manual en componentes de imagen).
- No hay placeholder visual mientras carga la imagen firmada (requiere validación manual).

**Qué es riesgoso:**
- Signed URLs de 1 hora: si una página muestra 50 assets y el usuario la deja abierta más de 1 hora, las imágenes aparecerán rotas al hacer scroll. Esto es un riesgo real en demo.

**Qué debería corregirse primero:**
- Aumentar TTL de signed URLs (F-09).
- Validar manualmente que los componentes de imagen tienen fallback visual.

---

### 4.9 UX y estados

**Qué está bien:**
- Los crop modals (`ImageCropModal`, `LogoCropModal`) tienen interfaz táctil-friendly con soporte de zoom y pan.
- La compresión en frontend ocurre antes de la subida, dando feedback implícito de que "algo está pasando".

**Qué está incompleto:**
- No hay progreso de subida por archivo individual en `NewServiceForm` al subir múltiples imágenes (F-12).
- Los mensajes de error de conversión HEIC son confusos (F-06).
- No hay mecanismo de reintento automático si la subida falla por conexión inestable.

**Qué es riesgoso:**
- En conexión móvil lenta (3G), subir 10 imágenes de 10MB (sin comprimir) puede tardar varios minutos. Si el usuario cierra el tab, pierde todo. El frontend comprime antes de enviar, pero no muestra progreso real.

**Qué debería corregirse primero:**
- Mejorar mensaje de error HEIC (F-06, fácil de implementar).
- Agregar feedback visual durante subida (F-12).

---

### 4.10 Backend / API

**Qué está bien:**
- Todos los endpoints de subida usan `FileInterceptor` o `FilesInterceptor` con `imageUploadOptions` que incluye el limit de tamaño.
- Separación de responsabilidades: Multer → `validateImageFile` → `processUploadedImage` → `StorageService` → `StoredFilesService` → Prisma.
- Sharp usa `mozjpeg: true` para JPEG (mejor compresión sin pérdida perceptible de calidad).
- Los controllers verifican autenticación y pertenencia a organización antes de procesar archivos.

**Qué está incompleto:**
- No hay endpoint para listar o auditar archivos de una organización desde la UI (solo existe `getOrganizationUsage` para stats).
- No hay endpoint de eliminación de adjunto individual de service.
- El error que devuelve Multer cuando el archivo excede el límite (`PayloadTooLargeException`) podría ser más descriptivo.

**Qué es riesgoso:**
- `assertCanStore` en services usa tamaño pre-compresión (F-03). Esto puede rechazar uploads válidos.
- La clave `SUPABASE_SERVICE_ROLE_KEY` (con permisos totales en Supabase) es la que usa el backend. Si hubiera un SSRF o injection, el atacante tendría acceso a todos los buckets. Esto es una consideración de seguridad general, no específica de este flujo, pero vale mencionarlo.

**Qué debería corregirse primero:**
- Mover `assertCanStore` para después de procesar archivos en services (F-03).

---

## 5. Pruebas manuales recomendadas

Las siguientes pruebas deben ejecutarse antes de cualquier demo o producción. Marcadas con prioridad.

| # | Prioridad | Prueba | Resultado esperado |
|---|---|---|---|
| P-01 | **Crítica** | Subir foto desde iPhone Safari usando **cámara** (modo creación de asset) | La foto se sube correctamente. La imagen aparece en el asset. |
| P-02 | **Crítica** | Subir foto desde iPhone Safari usando **galería** (foto HEIC nativa) | La foto se convierte a JPEG automáticamente y se sube sin error. |
| P-03 | **Crítica** | Subir foto HEIC desde iPhone Safari hacia `AssetModal` (que tiene `accept="image/*"` sin `.heic`) | Verificar si el selector nativo de iOS muestra la galería completa o solo JPEG/PNG. |
| P-04 | **Crítica** | Abrir el modal de recorte de imagen con una foto HEIC seleccionada desde iPhone Safari | La imagen debe renderizarse correctamente en el cropper, no en blanco. |
| P-05 | Alta | Subir foto desde desktop Chrome (asset, service, usuario, owner) | Todos los flujos funcionan sin error. |
| P-06 | Alta | Subir 10 imágenes simultáneamente en `NewServiceForm` desde mobile | Las 10 imágenes se adjuntan correctamente al servicio. |
| P-07 | Alta | Subir imagen que supere el límite de tamaño (>10MB para assets, >2MB para avatar) | El sistema muestra error claro antes de intentar subir. |
| P-08 | Alta | Subir imagen con extensión `.txt` renombrada a `.jpg` | El backend debe rechazarla (falla en magic bytes). |
| P-09 | Alta | Reemplazar thumbnail de un asset existente | La imagen anterior desaparece. La nueva imagen aparece. No quedan imágenes viejas visibles. |
| P-10 | Alta | Reemplazar avatar de usuario | El avatar anterior desaparece. El nuevo aparece. |
| P-11 | Alta | Dejar la app abierta más de 1 hora y verificar si las imágenes siguen mostrándose | Con TTL default de 1h, es posible que aparezcan imágenes rotas. |
| P-12 | Media | Subir imagen GIF animada | Verificar si el sistema avisa que la animación se perderá, o si sube un GIF estático sin advertencia. |
| P-13 | Media | Eliminar un servicio con adjuntos y verificar en Supabase que los blobs se eliminaron | Los archivos no deben quedar en el bucket después de eliminar el service. |
| P-14 | Media | Subir imagen en conexión 3G simulada (Chrome DevTools) | La UI debe mostrar estado de carga. No debe parecer que se colgó. |
| P-15 | Media | Intentar acceder directamente a una signed URL después de hacer logout | La URL debe expirar correctamente. No debe devolver el archivo. |
| P-16 | Media | Subir imagen PNG muy grande (6000x6000 px, que pasa validación de dimensiones pero es grande) | El backend debe comprimir a 1600x1600 WebP sin error. |
| P-17 | Baja | Subir imagen con nombre que contiene caracteres especiales: `foto (1) cámara.jpg` | El archivo debe subirse sin romper rutas ni nombres en storage. |
| P-18 | Baja | Verificar que al cambiar logo de organización en settings, el logo anterior ya no se sirve | Sin blobs huérfanos ni URLs rotas. |

---

## 6. Recomendaciones priorizadas

### Corregir antes de demo

| # | Hallazgo | Acción | Dificultad |
|---|---|---|---|
| R-01 | F-01 | Agregar `.heic,.heif` a todos los inputs `accept` de imagen en `AssetModal.tsx`, `OwnerModal.tsx` y cualquier otro que use solo `accept="image/*"`. | Baja |
| R-02 | F-02 | Verificar (prueba manual P-04) que `normalizeHeicFile` se ejecuta antes de generar el object URL del crop modal. Si no, mover la conversión al handler del `onChange` del input, antes de abrir el modal. | Media |
| R-03 | F-06 | Mejorar el mensaje de error de conversión HEIC a algo entendible por usuarios sin conocimiento técnico. | Baja |
| R-04 | F-09 | Aumentar `SIGNED_URL_TTL_SECONDS` a 86400 en el archivo de configuración de producción para evitar imágenes rotas en demos largas. | Baja |

### Corregir antes de producción

| # | Hallazgo | Acción | Dificultad |
|---|---|---|---|
| R-05 | F-03 | Mover `assertCanStore` en `services.service.ts` para después de `processUploadedImage`, usando el tamaño post-compresión. | Baja |
| R-06 | F-04 | Crear endpoint `DELETE /services/:serviceId/attachments/:attachmentId` con limpieza de blob y StoredFile. | Media |
| R-07 | F-05 | Agregar guardia en el arranque que impida usar `LocalStorageService` si `NODE_ENV=production`. Documentar en README de deployment. | Baja |
| R-08 | F-07 | Implementar cron o endpoint admin para ejecutar `reconcileOrganizationFiles` periódicamente y limpiar blobs huérfanos. | Media |
| R-09 | F-11 | Agregar validación de `maxPixels` en el frontend antes de intentar dibujar en canvas, para evitar OOM en dispositivos con poca RAM. | Media |

### Mejoras posteriores

| # | Hallazgo | Acción | Dificultad |
|---|---|---|---|
| R-10 | F-08 | Agregar advertencia cuando se sube un GIF que la animación se perderá. O bloquear GIFs si no son un caso de uso válido. | Baja |
| R-11 | F-12 | Agregar indicador de progreso por archivo en la subida múltiple de adjuntos en services. | Media |
| R-12 | — | Implementar refresh automático de signed URLs en el frontend cuando expiran (sin recargar la página). | Alta |
| R-13 | — | Centralizar los valores de `quality` de compresión en constantes compartidas entre frontend y backend. | Baja |
| R-14 | — | Validar y sanitizar el nombre de archivo original (`original_name`) antes de guardarlo en DB. | Baja |

---

## 7. Archivos que requieren revisión o corrección

| Archivo | Ruta | Razón |
|---|---|---|
| `AssetModal.tsx` | `frontend/src/components/assets/` | `accept="image/*"` sin `.heic`/`.heif` — puede bloquear selección de fotos HEIC en iOS |
| `OwnerModal.tsx` | `frontend/src/components/owners/` | Misma limitación que AssetModal |
| `imageCompression.ts` | `frontend/src/lib/` | Mensaje de error HEIC confuso; sin validación de maxPixels en canvas |
| `ImageCropModal.tsx` | `frontend/src/components/ui/` | Verificar que recibe imagen ya convertida desde HEIC, no el archivo raw |
| `LogoCropModal.tsx` | `frontend/src/components/ui/` | Misma verificación que ImageCropModal |
| `services.service.ts` | `backend/src/services/` | `assertCanStore` usa tamaño pre-compresión; sin endpoint de eliminación de adjunto individual |
| `supabase-storage.service.ts` | `backend/src/storage/` | `deleteFile` falla silenciosamente; TTL default 3600s puede ser corto |
| `local-storage.service.ts` | `backend/src/storage/` | Sin autenticación, no usar en producción |
| `multer-image-options.ts` | `backend/src/common/files/` | Mensaje de error no especifica formatos aceptados |
| `image-processing.ts` | `backend/src/common/files/` | GIFs animados descartados sin advertencia |
| `storage-governance.service.ts` | `backend/src/storage/` | Reconciliación no se ejecuta automáticamente |

---

## 8. Conclusión

El sistema de archivos e imágenes de Recall está construido con buenas prácticas en su núcleo: validación por firma binaria, procesamiento server-side con Sharp, rutas aisladas por organización, registro trazable en base de datos y rollback ante fallos. Para un SaaS en etapa temprana, esta arquitectura es adecuada.

**Para una demo real con cliente el riesgo principal es iPhone/Safari.** El flujo HEIC en el frontend tiene lógica de conversión implementada, pero hay al menos un escenario sin validar (F-02: crop modal recibiendo HEIC antes de conversión) que en Safari puede hacer que la imagen de recorte aparezca en blanco. Esto es visible, reproducible y potencialmente embarazoso en una demo.

Los demás riesgos (quota check pre-compresión, blobs huérfanos, signed URLs de 1 hora) son menores para una demo pero deben resolverse antes de poner clientes reales.

**Recomendación inmediata:** Ejecutar las pruebas P-01 a P-04 en un iPhone real con Safari antes de cualquier demo. Los hallazgos F-01 y F-06 (accept de HEIC y mensaje de error) pueden corregirse en menos de 30 minutos y eliminan los riesgos más visibles.
