# Recall — Migración a Cloudflare Stream + Images

> **Versión 1.0 — Junio 2026**
> Reemplaza el flujo de video TUS → Supabase Storage por Cloudflare Stream.
> Agrega Cloudflare Images para imágenes (reemplaza Supabase Storage para ese tipo).
> Los documentos PDF continúan en Supabase Storage sin cambios.

---

## Contexto: qué hay construido y qué cambia

### Lo que existe hoy (mantener la estructura, cambiar el destino)

El módulo `backend/src/uploads/` ya tiene una arquitectura sólida:

- Máquina de estados `FileUpload` (PENDING → UPLOADING → UPLOADED → CONFIRMED / FAILED / EXPIRED / CANCELLED)
- Control de cuota por organización (`OrganizationStorageUsage`)
- Snapshot de estado en `Service` (`attachment_upload_status`, conteos, bytes)
- Endpoints completos: intent → start → progress → confirm → retry → cancel → playback
- Jobs de mantenimiento y reconciliación

**Nada de eso se elimina.** Solo cambia el destino de los bytes y cómo se obtienen las URLs de reproducción.

### El problema con la implementación actual

- `UploadsService.createIntent()` llama a `storageService.createSignedUploadIntent()` que genera un token TUS hacia Supabase Storage.
- `UploadsService.getPlaybackUrl()` genera una URL firmada de Supabase Storage con TTL.
- Supabase Storage **no transcodifica video** → no hay HLS → el browser descarga el archivo completo antes de reproducir.
- El egress de Supabase cobra por GB transferido → cada reproducción de video tiene costo.

### Lo que cambia con Cloudflare Stream

- El backend pide a Cloudflare una **direct upload URL** (no TUS a Supabase).
- El frontend sube el video **directo a Cloudflare** sin pasar por Railway ni Supabase.
- Cloudflare transcodifica automáticamente a HLS/DASH.
- La reproducción usa el **player de Cloudflare** (iframe o HLS.js) con su propia CDN.
- El egress se cobra por minuto reproducido, no por GB.

### Lo que cambia con Cloudflare Images

- Las imágenes de `ServiceAttachment` (fotos de evidencia) van a Cloudflare Images en lugar de Supabase Storage.
- Logos, avatares, thumbnails de `StoredFile` **no cambian** — siguen en Supabase Storage (están integrados con RLS).
- El beneficio: transformaciones de imagen gratuitas (resize, webp, calidad) y CDN global sin egress.

---

## Regla simple para el desarrollador

```
mime_type.startsWith('video/')  → Cloudflare Stream
mime_type.startsWith('image/')  → Cloudflare Images   (solo en ServiceAttachment)
todo lo demás (PDF, etc.)       → Supabase Storage (sin cambios)
```

Las imágenes en `StoredFile` (logos, avatares, thumbnails) **no cambian** — siguen en Supabase con RLS.

---

## 1. Variables de entorno

### Backend (Railway)

Agregar en el panel de variables de Railway:

```env
CLOUDFLARE_ACCOUNT_ID=5cb6884a00fb221b498acea14ba8f5f1
CLOUDFLARE_API_TOKEN=<token Fentri-Stream-Images — no incluir en el repo>
CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN=customer-yrufylz27agxoaqz.cloudflarestream.com

# Stream
CLOUDFLARE_STREAM_SIGNED_URLS=true
CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS=3600
CLOUDFLARE_STREAM_WEBHOOK_SECRET=<secret generado en Cloudflare Stream → Settings → Webhooks>

# Images (activar en iteración siguiente)
CLOUDFLARE_IMAGES_DELIVERY_URL=https://imagedelivery.net/<account hash — ver Cloudflare Images → Overview>

# Feature flags (mantener en false hasta validar en staging)
SERVICE_VIDEO_UPLOADS_ENABLED=false
SERVICE_IMAGE_UPLOADS_CF_ENABLED=false
```

> El `account hash` de Images es diferente al `account id`. Lo encuentras en Cloudflare Dashboard → Images → Overview → tu URL de entrega.

### URLs de Stream generadas por el backend

```
HLS:       https://customer-yrufylz27agxoaqz.cloudflarestream.com/{uid}/manifest/video.m3u8
Iframe:    https://iframe.videodelivery.net/{uid}
Thumbnail: https://customer-yrufylz27agxoaqz.cloudflarestream.com/{uid}/thumbnails/thumbnail.jpg
```

### Frontend (Vercel)

No se agregan variables de Cloudflare al frontend. Las credenciales **nunca van al browser**. El frontend solo recibe URLs de Cloudflare que el backend genera.

---

## 2. Schema de Prisma

**Archivo:** `backend/prisma/schema.prisma`

### 2.1 Modificar modelo `FileUpload`

Agregar campos para Cloudflare Stream:

```prisma
model FileUpload {
  // ... campos existentes se mantienen todos ...

  // Cloudflare Stream (solo para media_type = 'VIDEO')
  cf_stream_uid          String?   // ID del video en Cloudflare Stream
  cf_stream_upload_url   String?   // URL de upload directo (expira)
  cf_stream_status       String?   // 'pendingupload' | 'uploading' | 'ready' | 'error'
  cf_stream_ready_to_stream Boolean @default(false)
  cf_stream_duration     Float?    // duración en segundos (disponible tras transcoding)
  cf_stream_thumbnail    String?   // URL del thumbnail generado por CF

  // ... resto de campos existentes ...
}
```

### 2.2 Modificar modelo `ServiceAttachment`

Agregar campos para Cloudflare Images:

```prisma
model ServiceAttachment {
  // ... campos existentes se mantienen todos ...

  // Cloudflare Images (solo para media_type = 'IMAGE' vía CF)
  cf_image_id            String?   // ID de la imagen en Cloudflare Images
  cf_image_variant       String?   // variante default (ej. 'public')

  // ... resto de campos existentes ...
}
```

### 2.3 Migración

```bash
npx prisma migrate dev --name add_cloudflare_stream_images_fields
```

---

## 3. Nuevo servicio: `CloudflareService`

**Archivo:** `backend/src/cloudflare/cloudflare.service.ts`

Crear módulo `backend/src/cloudflare/` con:

```
backend/src/cloudflare/
  cloudflare.module.ts
  cloudflare.service.ts
```

### 3.1 Métodos de Stream

```typescript
// Pedir URL de upload directo a Cloudflare Stream
async createStreamDirectUpload(opts: {
  maxDurationSeconds: number;  // límite según el plan (ej. 600 = 10 min)
  organizationId: string;
  serviceId: string;
  uploadId: string;
}): Promise<{
  uid: string;           // cf_stream_uid — guardar en FileUpload
  uploadUrl: string;     // URL a la que el frontend sube el video
  expiresAt: string;
}>

// Consultar estado del video en Stream
async getStreamStatus(uid: string): Promise<{
  status: 'pendingupload' | 'uploading' | 'ready' | 'error';
  readyToStream: boolean;
  duration: number | null;
  thumbnail: string | null;
}>

// Generar signed URL para reproducción (si Signed URLs está activado)
async getStreamSignedToken(uid: string, ttlSeconds: number): Promise<string>

// Eliminar video de Stream
async deleteStreamVideo(uid: string): Promise<void>
```

**Llamadas a la API de Cloudflare Stream:**

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/direct_upload
GET  https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{uid}
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{uid}/token
DELETE https://api.cloudflare.com/client/v4/accounts/{account_id}/stream/{uid}
```

Header en todas las llamadas:
```
Authorization: Bearer {CLOUDFLARE_API_TOKEN}
```

### 3.2 Métodos de Images

```typescript
// Subir imagen a Cloudflare Images desde buffer
async uploadImage(opts: {
  buffer: Buffer;
  mimeType: string;
  organizationId: string;
  serviceId: string;
  attachmentId: string;
}): Promise<{
  id: string;          // cf_image_id — guardar en ServiceAttachment
  variants: string[];  // URLs de las variantes
}>

// Eliminar imagen de Cloudflare Images
async deleteImage(imageId: string): Promise<void>
```

**Llamadas a la API de Cloudflare Images:**

```
POST https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1
DELETE https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1/{image_id}
```

### 3.3 Registrar en AppModule

```typescript
// AppModule.imports[]
CloudflareModule,
```

---

## 4. Modificar `UploadsService`

**Archivo:** `backend/src/uploads/uploads.service.ts`

Inyectar `CloudflareService` en el constructor.

### 4.1 Modificar `createIntent()` para video

**Antes:** llamaba a `storageService.createSignedUploadIntent(objectPath)` que generaba un token TUS hacia Supabase.

**Después:** según `dto.mediaType`:

```typescript
if (dto.mediaType === 'VIDEO') {
  // Pedir direct upload URL a Cloudflare Stream
  const streamUpload = await this.cloudflareService.createStreamDirectUpload({
    maxDurationSeconds: 600, // ajustar según plan
    organizationId: service.organization_id,
    serviceId,
    uploadId,
  });

  await this.prisma.fileUpload.create({
    data: {
      // ... campos existentes ...
      cf_stream_uid: streamUpload.uid,
      cf_stream_upload_url: streamUpload.uploadUrl,
      cf_stream_status: 'pendingupload',
      expires_at: new Date(streamUpload.expiresAt),
      // storage_ref ya no aplica para video → dejar null o usar cf_stream_uid
      storage_ref: `cf-stream://${streamUpload.uid}`,
    }
  });

  return {
    uploadId,
    mediaType: 'VIDEO',
    // El frontend usa esta URL directamente con fetch/XHR (no TUS)
    cfStreamUploadUrl: streamUpload.uploadUrl,
    cfStreamUid: streamUpload.uid,
    expiresAt: streamUpload.expiresAt,
  };
}
```

> Cloudflare Stream acepta uploads con un simple `POST` o `TUS`. El frontend puede seguir usando TUS si lo prefiere — la URL de Stream es compatible. Lo más simple es un `fetch` con el archivo como body.

### 4.2 Modificar `confirm()` para video

**Antes:** verificaba el objeto en Supabase Storage y creaba `StoredFile`.

**Después:** para `media_type === 'VIDEO'`:

```typescript
// Consultar estado en Cloudflare Stream
const streamStatus = await this.cloudflareService.getStreamStatus(upload.cf_stream_uid);

if (!streamStatus.readyToStream) {
  // El video todavía está siendo procesado — responder con estado intermedio
  // No lanzar error, el frontend puede reintentar
  return {
    status: 'PROCESSING',
    message: 'El video está siendo procesado. Vuelve a intentar en unos segundos.',
    cfStreamUid: upload.cf_stream_uid,
  };
}

// Video listo — crear ServiceAttachment con datos de CF Stream
await this.prisma.$transaction(async (tx) => {
  const attachment = await tx.serviceAttachment.create({
    data: {
      service_id: serviceId,
      upload_id: uploadId,
      file_type: upload.declared_mime_type,
      file_name: upload.original_name,
      file_size_bytes: Number(upload.actual_size_bytes ?? upload.declared_size_bytes),
      media_type: 'VIDEO',
      // No hay file_id para videos de CF Stream (no pasan por StoredFile)
    }
  });

  await tx.fileUpload.update({
    where: { id: uploadId },
    data: {
      status: 'CONFIRMED',
      cf_stream_status: streamStatus.status,
      cf_stream_ready_to_stream: true,
      cf_stream_duration: streamStatus.duration,
      cf_stream_thumbnail: streamStatus.thumbnail,
      confirmed_at: new Date(),
      local_progress: 100,
    }
  });
  // ... mover reserva a ready en cuota ...
});
```

### 4.3 Modificar `getPlaybackUrl()` para video

**Antes:** generaba URL firmada de Supabase Storage.

**Después:**

```typescript
async getPlaybackUrl(serviceId: string, attachmentId: string, user: any) {
  // ... assertServiceAccess existente ...

  const upload = await this.prisma.fileUpload.findFirst({
    where: { service_id: serviceId, status: 'CONFIRMED', media_type: 'VIDEO' }
    // buscar por attachmentId correlacionado
  });

  if (!upload?.cf_stream_uid || !upload.cf_stream_ready_to_stream) {
    throw new NotFoundException('Video no disponible');
  }

  const ttl = Number(this.configService.get('CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS', '3600'));

  if (this.configService.get('CLOUDFLARE_STREAM_SIGNED_URLS') === 'true') {
    // Generar token firmado
    const token = await this.cloudflareService.getStreamSignedToken(upload.cf_stream_uid, ttl);
    return {
      // URL del iframe de Cloudflare Stream con token
      embedUrl: `https://iframe.videodelivery.net/${uid}`,
      // URL HLS para reproductores custom
      hlsUrl: `https://customer-yrufylz27agxoaqz.cloudflarestream.com/${token}/manifest/video.m3u8`,
      cfStreamUid: upload.cf_stream_uid,
      duration: upload.cf_stream_duration,
      thumbnail: upload.cf_stream_thumbnail,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    };
  }

  // Sin signed URLs (para desarrollo)
  return {
    embedUrl: `https://iframe.videodelivery.net/${upload.cf_stream_uid}`,
    hlsUrl: `https://customer-yrufylz27agxoaqz.cloudflarestream.com/${upload.cf_stream_uid}/manifest/video.m3u8`,
    cfStreamUid: upload.cf_stream_uid,
    duration: upload.cf_stream_duration,
    thumbnail: upload.cf_stream_thumbnail,
  };
}
```

### 4.4 Modificar `cancel()` para video

Al cancelar un upload de video, eliminar el video de Cloudflare Stream si ya fue subido:

```typescript
if (upload.media_type === 'VIDEO' && upload.cf_stream_uid) {
  try {
    await this.cloudflareService.deleteStreamVideo(upload.cf_stream_uid);
  } catch (e) {
    this.logger.warn(`No se pudo eliminar video CF Stream ${upload.cf_stream_uid}: ${e.message}`);
  }
}
// ... resto del cancel existente (liberar cuota, etc.) ...
```

---

## 5. Webhook de Cloudflare Stream (nuevo endpoint)

Cloudflare Stream puede notificar al backend cuando un video termina de procesar. Esto evita que el frontend haga polling.

**Nuevo endpoint:** `POST /webhooks/cloudflare/stream`

**Archivo:** `backend/src/cloudflare/cloudflare-webhook.controller.ts`

```typescript
@Post('webhooks/cloudflare/stream')
async streamWebhook(@Body() body: any, @Headers('webhook-signature') sig: string) {
  // Validar firma del webhook (secret configurado en Cloudflare Stream → Webhooks)
  // body.uid = cf_stream_uid
  // body.status.state = 'ready' | 'error'

  if (body.status?.state === 'ready') {
    const upload = await this.prisma.fileUpload.findFirst({
      where: { cf_stream_uid: body.uid }
    });
    if (upload) {
      await this.uploadsService.markStreamReady(upload.id, {
        duration: body.duration,
        thumbnail: body.thumbnail?.uri,
      });
    }
  }
}
```

Agregar `CLOUDFLARE_STREAM_WEBHOOK_SECRET` a las variables de entorno.

Configurar el webhook en Cloudflare: Stream → Settings → Webhooks → Add endpoint → `https://tu-backend.railway.app/webhooks/cloudflare/stream`.

---

## 6. Modificar `UploadMaintenanceService`

**Archivo:** `backend/src/uploads/upload-maintenance.service.ts`

El job horario existente limpia uploads expirados. Agregar:

```typescript
// En el ciclo de mantenimiento, para FileUploads en estado UPLOADING con cf_stream_uid:
// Consultar estado en CF Stream y actualizar si ya está ready
async syncStreamStatuses() {
  const pendingStreamUploads = await this.prisma.fileUpload.findMany({
    where: {
      media_type: 'VIDEO',
      cf_stream_uid: { not: null },
      cf_stream_ready_to_stream: false,
      status: { in: ['UPLOADING', 'UPLOADED'] },
    },
    take: 50, // procesar en lotes
  });

  for (const upload of pendingStreamUploads) {
    try {
      const status = await this.cloudflareService.getStreamStatus(upload.cf_stream_uid);
      if (status.readyToStream) {
        await this.uploadsService.markStreamReady(upload.id, {
          duration: status.duration,
          thumbnail: status.thumbnail,
        });
      } else if (status.status === 'error') {
        await this.uploadsService.markStreamFailed(upload.id, 'cloudflare_processing_error');
      }
    } catch (e) {
      this.logger.warn(`Error syncing CF Stream status for ${upload.cf_stream_uid}: ${e.message}`);
    }
  }
}
```

---

## 7. Frontend — modificaciones

### 7.1 Modificar `tusUploader.ts` para video

**Archivo:** `frontend/src/lib/uploads/tusUploader.ts`

El uploader actual usa TUS hacia Supabase. Para Cloudflare Stream, el upload es más simple:

```typescript
// Para videos con cfStreamUploadUrl (viene en la respuesta de createIntent):
export async function uploadToCloudflareStream(
  file: File,
  uploadUrl: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  // Cloudflare Stream acepta TUS en la misma URL
  // Reutilizar el cliente TUS existente apuntando a cfStreamUploadUrl
  // La diferencia es que no hay signed token — la URL ya es el endpoint de upload

  const upload = new tus.Upload(file, {
    endpoint: uploadUrl,  // URL de CF Stream directo
    retryDelays: [0, 3000, 5000, 10000],
    metadata: {
      name: file.name,
      type: file.type,
    },
    onProgress: (bytesUploaded, bytesTotal) => {
      onProgress(Math.round((bytesUploaded / bytesTotal) * 100));
    },
  });

  upload.start();
}
```

> Cloudflare Stream soporta TUS nativo. La `cfStreamUploadUrl` que devuelve el backend ES el endpoint TUS de Cloudflare. No se necesita ningún token adicional.

### 7.2 Modificar `UploadQueueProvider`

**Archivo:** `frontend/src/providers/UploadQueueProvider.tsx`

En el método que procesa el intent y lanza el upload:

```typescript
// Antes:
// usaba tusEndpoint + signedUploadToken de Supabase

// Después:
if (intent.mediaType === 'VIDEO' && intent.cfStreamUploadUrl) {
  await uploadToCloudflareStream(file, intent.cfStreamUploadUrl, (pct) => {
    updateProgress(intent.uploadId, pct);
  });
} else {
  // imágenes y documentos: flujo existente a Supabase
  await uploadToSupabase(file, intent, (pct) => {
    updateProgress(intent.uploadId, pct);
  });
}
```

### 7.3 Modificar `VideoAttachmentCard` / `VideoPlayerModal`

**Archivos:**
- `frontend/src/components/services/VideoAttachmentCard.tsx`
- `frontend/src/components/services/VideoPlayerModal.tsx`

**Antes:** mostraba un `<video>` tag con la URL firmada de Supabase (descarga completa antes de reproducir).

**Después:** usar el iframe de Cloudflare Stream o HLS.js:

```tsx
// Opción A — Iframe de Cloudflare (más simple, player incluido):
<iframe
  src={playbackData.embedUrl}
  style={{ border: 'none', width: '100%', aspectRatio: '16/9' }}
  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
  allowFullScreen
/>

// Opción B — HLS.js para control total del player:
// Instalar: npm install hls.js
import Hls from 'hls.js';

useEffect(() => {
  if (Hls.isSupported() && videoRef.current) {
    const hls = new Hls();
    hls.loadSource(playbackData.hlsUrl);
    hls.attachMedia(videoRef.current);
  }
}, [playbackData.hlsUrl]);
```

Recomendación: usar el **iframe** para la primera iteración. Es el player oficial de Cloudflare, soporta HLS nativo en todos los browsers incluyendo Safari e iOS, y no requiere dependencias adicionales.

### 7.4 Modificar `uploadService.ts`

**Archivo:** `frontend/src/services/uploadService.ts`

Asegurarse de que `getPlaybackUrl()` espere y use los nuevos campos:

```typescript
export interface PlaybackData {
  embedUrl: string;       // iframe de Cloudflare Stream
  hlsUrl: string;         // HLS directo
  cfStreamUid: string;
  duration: number | null;
  thumbnail: string | null;
  expiresAt?: string;
}
```

---

## 8. Imágenes en `ServiceAttachment` → Cloudflare Images

> ⚠️ Esta parte es opcional para la primera iteración. Implementar después de que el video esté funcionando.

Para imágenes adjuntas a servicios (fotos de evidencia del mantenimiento), el flujo cambia:

**Antes:** imagen sube via multipart al backend → backend la guarda en Supabase Storage como `StoredFile`.

**Después:** imagen sube via multipart al backend → backend la reenvía a Cloudflare Images API → guarda `cf_image_id` en `ServiceAttachment`.

```typescript
// En el endpoint de upload de imágenes (ServicesController o AssetsController):
if (file.mimetype.startsWith('image/')) {
  const cfImage = await this.cloudflareService.uploadImage({
    buffer: file.buffer,
    mimeType: file.mimetype,
    organizationId: user.orgId,
    serviceId,
    attachmentId: newAttachmentId,
  });

  await this.prisma.serviceAttachment.create({
    data: {
      service_id: serviceId,
      file_type: file.mimetype,
      file_name: file.originalname,
      file_size_bytes: file.size,
      media_type: 'IMAGE',
      cf_image_id: cfImage.id,
      // No file_id → no StoredFile para imágenes en CF
    }
  });

  // URL de entrega:
  // https://imagedelivery.net/{account_hash}/{cf_image_id}/public
  // Con transformaciones:
  // https://imagedelivery.net/{account_hash}/{cf_image_id}/w=400,q=80
}
```

> Los `StoredFile` existentes (logos, avatares, thumbnails de activos) **no cambian**. Solo las imágenes nuevas de `ServiceAttachment` van a Cloudflare Images.

---

## 9. Checklist de implementación

### Paso 1 — Infraestructura (hacer primero)

- [ ] Agregar variables de entorno en Railway: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`
- [ ] Agregar variables de Stream: `CLOUDFLARE_STREAM_SIGNED_URLS=true`, `CLOUDFLARE_STREAM_UPLOAD_URL_TTL_SECONDS=3600`
- [ ] Activar Signed URLs en Cloudflare Stream Dashboard → Settings
- [ ] Configurar webhook en Cloudflare Stream → Settings → Webhooks → tu backend URL

### Paso 2 — Backend

- [ ] Agregar campos `cf_stream_*` en `FileUpload` (schema.prisma)
- [ ] Agregar campos `cf_image_id` y `cf_image_variant` en `ServiceAttachment` (schema.prisma)
- [ ] `npx prisma migrate dev --name add_cloudflare_stream_images_fields`
- [ ] Crear `backend/src/cloudflare/cloudflare.module.ts` y `cloudflare.service.ts`
- [ ] Implementar `createStreamDirectUpload()`, `getStreamStatus()`, `getStreamSignedToken()`, `deleteStreamVideo()`
- [ ] Implementar `uploadImage()` y `deleteImage()` para Cloudflare Images
- [ ] Registrar `CloudflareModule` en `AppModule`
- [ ] Modificar `UploadsService.createIntent()` para usar CF Stream en videos
- [ ] Modificar `UploadsService.confirm()` para verificar estado en CF Stream
- [ ] Modificar `UploadsService.getPlaybackUrl()` para retornar `embedUrl` y `hlsUrl`
- [ ] Modificar `UploadsService.cancel()` para eliminar video en CF Stream
- [ ] Agregar `markStreamReady()` y `markStreamFailed()` en `UploadsService`
- [ ] Crear `CloudflareWebhookController` con endpoint `POST /webhooks/cloudflare/stream`
- [ ] Agregar `syncStreamStatuses()` en `UploadMaintenanceService`

### Paso 3 — Frontend

- [ ] Modificar `tusUploader.ts` para usar `uploadToCloudflareStream()` con la `cfStreamUploadUrl`
- [ ] Modificar `UploadQueueProvider` para distinguir video (CF) de imagen/doc (Supabase)
- [ ] Modificar `VideoPlayerModal` para usar iframe de Cloudflare Stream
- [ ] Modificar `VideoAttachmentCard` para mostrar thumbnail de CF y duración
- [ ] Actualizar tipo `PlaybackData` en `uploadService.ts`

### Paso 4 — Activar y validar

- [ ] Setear `SERVICE_VIDEO_UPLOADS_ENABLED=true` en una org piloto
- [ ] Subir un video de prueba y verificar que llega a Cloudflare Stream Dashboard
- [ ] Verificar que el webhook dispara y marca el video como ready
- [ ] Verificar reproducción en desktop Chrome, desktop Safari, iOS Safari, Android Chrome
- [ ] Verificar que cancelar un upload elimina el video en Cloudflare Stream
- [ ] Activar globalmente con `SERVICE_VIDEO_UPLOADS_ENABLED=true`

### Paso 5 — Imágenes (iteración siguiente)

- [ ] Agregar variables: `CLOUDFLARE_IMAGES_DELIVERY_URL`
- [ ] Implementar `uploadImage()` en `CloudflareService`
- [ ] Modificar endpoint de upload de imágenes en `ServicesController`
- [ ] Setear `SERVICE_IMAGE_UPLOADS_CF_ENABLED=true`

---

## 10. Qué NO cambia

- Todo el modelo `FileUpload` y su máquina de estados — se reutiliza completo.
- La cuota por organización (`OrganizationStorageUsage`) — se reutiliza.
- El snapshot en `Service` (`attachment_upload_status`, conteos) — se reutiliza.
- Los jobs de mantenimiento y reconciliación — se reutilizan, solo se agrega `syncStreamStatuses()`.
- Los endpoints del controller — mismas rutas, misma autenticación.
- `StoredFile` para logos, avatares y thumbnails — sin cambios.
- Documentos PDF — siguen en Supabase Storage sin cambios.
- El feature flag `SERVICE_VIDEO_UPLOADS_ENABLED` — se mantiene.

---

## 11. Notas técnicas

### Por qué TUS de Cloudflare es más simple que TUS de Supabase

Supabase TUS requiere un signed token generado por el backend y headers específicos. Cloudflare Stream TUS solo necesita la `uploadUrl` que viene en la respuesta de `direct_upload` — no hay token adicional. La URL ya es el endpoint autorizado.

### Videos durante el transcoding

Hay una ventana entre que el usuario sube el video y que CF termina de transcodar (generalmente 10-60 segundos dependiendo del tamaño). Durante ese tiempo, `confirm()` responde con `status: 'PROCESSING'`. El frontend debe mostrar un estado intermedio ("Tu video se está procesando...") y hacer polling o esperar el evento de realtime cuando el webhook dispara `markStreamReady()`.

### Signed URLs en Stream

Con `CLOUDFLARE_STREAM_SIGNED_URLS=true`, cada vez que el usuario quiere ver un video el backend genera un token JWT firmado con duración configurada. El token se incrusta en la URL del iframe. Sin esto, cualquiera con el UID del video podría verlo. Para Recall con datos de mantenimiento privados, **Signed URLs debe estar activado**.

### Account Hash vs Account ID

- `CLOUDFLARE_ACCOUNT_ID`: ID numérico de tu cuenta. Se usa en las llamadas a la API REST.
- Account Hash para Images: string alfanumérico que aparece en la URL de entrega de imágenes. Son diferentes — no confundirlos.

---

*Recall — Migración Cloudflare Stream + Images v1.0 — Junio 2026*
