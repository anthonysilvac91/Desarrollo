# Implementacion: Carga de Documentos en Servicios

## Objetivo

Extender el sistema de attachments de servicios para soportar documentos (PDF, Word, Excel) ademas de imagenes. Los documentos se suben al crear/editar un servicio y se muestran en una seccion separada debajo de la galeria de fotos en la vista de detalle.

---

## Arquitectura actual

### Backend

**Constantes** (`backend/src/services/services.service.ts`, lineas 19-26):
```typescript
const SERVICE_ATTACHMENT_MAX_FILES = 10;
const SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES = 10 * 1024 * 1024; // 10MB
const SERVICE_ATTACHMENT_MAX_TOTAL_ORIGINAL_BYTES = 40 * 1024 * 1024; // 40MB
```

**Flujo actual de attachments** (mismo archivo, lineas ~277-350):
- Todos los archivos pasan por `validateImageFile()` (solo acepta JPEG, PNG, WebP, GIF)
- Se procesan con `processUploadedImage()` (compresion, conversion a WebP via Sharp)
- Se suben con `storageService.uploadFile()` a la ruta de `buildServiceAttachmentsPath(orgId, serviceId)`
- Se registran en `StoredFile` con kind `SERVICE_ATTACHMENT`
- Se crea un registro `ServiceAttachment` vinculado al servicio

**Validacion de imagenes** (`backend/src/common/files/image-validation.ts`):
- Valida magic bytes (JPEG, PNG, WebP, GIF unicamente)
- Valida dimensiones y pixeles maximos
- No soporta documentos

**Modelo ServiceAttachment** (`backend/prisma/schema.prisma`, lineas 294-308):
```prisma
model ServiceAttachment {
  id              String  @id @default(uuid())
  service_id      String
  file_id         String? @unique
  file_type       String?   // MIME type
  file_name       String?   // nombre original
  file_size_bytes Int?
  created_at      DateTime @default(now())
  service         Service     @relation(fields: [service_id], references: [id])
  file            StoredFile? @relation("ServiceAttachmentFile", fields: [file_id], references: [id])
  @@index([service_id])
}
```

**StoredFileKind enum** (lineas 42-48):
```prisma
enum StoredFileKind {
  ORG_LOGO
  USER_AVATAR
  ASSET_THUMBNAIL
  SERVICE_ATTACHMENT
  OWNER_LOGO
}
```

**Storage paths** (`backend/src/common/files/storage-paths.ts`):
```typescript
export function buildServiceAttachmentsPath(orgId: string, serviceId: string): string {
  return `org/${orgId}/services/${serviceId}/attachments`;
}
```

### Frontend

**Formulario de servicio** (`frontend/src/components/assets/NewServiceForm.tsx`):
- `MAX_PHOTOS = 20` (linea 19)
- Input acepta solo: `image/*,.heic,.heif` (linea 304)
- Comprime imagenes con `compressImageFile()` antes de subir
- Envia como FormData multipart con campo `files`

**Vista de detalle** (`frontend/src/components/services/ServiceDetailView.tsx`):
- `AttachmentThumb` (lineas 26-64): muestra thumbnails de imagenes; para no-imagenes muestra icono FileText
- Galeria en grid de 3 columnas (lineas 284-320) con lightbox para imagenes

---

## Cambios a implementar

### 1. Backend - Validacion de documentos

**Crear** `backend/src/common/files/document-validation.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';

const ALLOWED_DOCUMENT_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const DOCUMENT_SIGNATURES = [
  {
    mime: 'application/pdf',
    matches: (buffer: Buffer) =>
      buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    // ZIP-based (DOCX, XLSX)
    mime: 'application/zip',
    matches: (buffer: Buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x50 && buffer[1] === 0x4b &&
      buffer[2] === 0x03 && buffer[3] === 0x04,
  },
  {
    // Legacy DOC/XLS (OLE2 compound document)
    mime: 'application/msword',
    matches: (buffer: Buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0xd0 && buffer[1] === 0xcf &&
      buffer[2] === 0x11 && buffer[3] === 0xe0 &&
      buffer[4] === 0xa1 && buffer[5] === 0xb1 &&
      buffer[6] === 0x1a && buffer[7] === 0xe1,
  },
];

export interface DocumentValidationOptions {
  maxBytes: number;
  label: string;
}

export function validateDocumentFile(file: Express.Multer.File, options: DocumentValidationOptions) {
  if (!file) {
    throw new BadRequestException(`${options.label}: archivo requerido`);
  }

  if (file.size > options.maxBytes) {
    const maxMB = Math.round(options.maxBytes / (1024 * 1024));
    throw new BadRequestException(`${options.label}: el archivo excede ${maxMB} MB`);
  }

  const buffer = file.buffer;
  const detected = DOCUMENT_SIGNATURES.find((sig) => sig.matches(buffer));

  if (!detected) {
    throw new BadRequestException(
      `${options.label}: tipo de archivo no permitido. Solo se aceptan PDF, Word y Excel`,
    );
  }

  // Para archivos ZIP-based, confiar en la extension para determinar MIME exacto
  let finalMime = detected.mime;
  if (detected.mime === 'application/zip') {
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (ext === 'docx') finalMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'xlsx') finalMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else throw new BadRequestException(`${options.label}: tipo de archivo no permitido`);
  }

  if (!ALLOWED_DOCUMENT_MIMES.includes(finalMime)) {
    throw new BadRequestException(`${options.label}: tipo de archivo no permitido`);
  }

  return { mime: finalMime };
}

export function isDocumentMime(mime: string): boolean {
  return ALLOWED_DOCUMENT_MIMES.includes(mime);
}

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}
```

### 2. Backend - Modificar services.service.ts

En el metodo `create()` y `update()`, donde se procesan los attachments, cambiar la logica para bifurcar segun tipo de archivo:

```typescript
import { validateDocumentFile, isImageMime } from '../common/files/document-validation';

// Dentro del loop de archivos (donde se procesa cada file):
for (const file of files) {
  const mimeFromExtension = file.mimetype?.toLowerCase() || '';
  
  if (isImageMime(mimeFromExtension)) {
    // Flujo existente: validateImageFile() + processUploadedImage()
    const imageInfo = validateImageFile(file, { /* opciones actuales */ });
    file.mimetype = imageInfo.mime;
    await processUploadedImage(file, { /* opciones actuales */ });
  } else {
    // Flujo nuevo: solo validar, NO procesar
    const docInfo = validateDocumentFile(file, {
      maxBytes: SERVICE_ATTACHMENT_MAX_ORIGINAL_BYTES,
      label: 'Documento adjunto',
    });
    file.mimetype = docInfo.mime;
    // No se procesa (no sharp), se sube tal cual
  }
  
  // El resto del flujo es igual: upload + StoredFile + ServiceAttachment
}
```

**Importante**: No cambiar el `StoredFileKind` ni la estructura del modelo. Usar `SERVICE_ATTACHMENT` para ambos. El campo `file_type` en `ServiceAttachment` ya almacena el MIME type, lo que permite distinguir imagenes de documentos.

### 3. Backend - Endpoint de descarga

Agregar al controlador de servicios un endpoint para descargar attachments:

```typescript
@Get(':id/attachments/:attachmentId/download')
@ApiOperation({ summary: 'Descargar un adjunto de servicio' })
async downloadAttachment(
  @Param('id') serviceId: string,
  @Param('attachmentId') attachmentId: string,
  @Request() req,
) {
  return this.servicesService.getAttachmentDownloadUrl(serviceId, attachmentId, req.user.orgId);
}
```

En el servicio, resolver la URL firmada del StoredFile y devolverla.

### 4. Frontend - Ampliar NewServiceForm.tsx

**Cambios:**
- Agregar constante `MAX_DOCUMENTS = 5`
- Agregar estado `documents` separado de `photos`
- Agregar segundo input de archivos para documentos:

```tsx
// Nuevo accept para documentos
const DOCUMENT_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx";

// Nuevo input
<input
  ref={docInputRef}
  type="file"
  accept={DOCUMENT_ACCEPT}
  multiple
  className="hidden"
  onChange={handleDocumentChange}
/>
```

- En `handleDocumentChange`: NO comprimir, solo validar tamanio (10MB max) y cantidad
- Al enviar el FormData, agregar los documentos al mismo campo `files` (el backend distingue por MIME type)
- Mostrar los documentos seleccionados debajo del area de fotos con icono segun tipo + nombre + boton para eliminar

**Iconos por tipo de archivo:**
- PDF: `FileText` con color rojo
- Word (doc/docx): `FileText` con color azul
- Excel (xls/xlsx): `FileSpreadsheet` o `FileText` con color verde

### 5. Frontend - Seccion de documentos en ServiceDetailView.tsx

Debajo de la galeria de fotos existente, agregar seccion "Documentos adjuntos":

```tsx
// Filtrar attachments
const imageAttachments = attachments.filter(a => a.file_type?.startsWith('image/'));
const documentAttachments = attachments.filter(a => !a.file_type?.startsWith('image/'));

// Seccion de documentos (despues de la galeria de imagenes)
{documentAttachments.length > 0 && (
  <div className="mt-6">
    <h3 className="text-sm font-medium text-secondary mb-3">
      {t('documents_attached')} ({documentAttachments.length})
    </h3>
    <div className="space-y-2">
      {documentAttachments.map((doc) => (
        <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-border">
          <DocumentIcon mimeType={doc.file_type} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{doc.file_name}</p>
            <p className="text-xs text-secondary">{formatFileSize(doc.file_size_bytes)}</p>
          </div>
          <button onClick={() => handleDownload(doc)}>
            <Download className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  </div>
)}
```

### 6. Frontend - Traducciones

Agregar en `frontend/src/lib/translations.ts`:

```typescript
// EN
documents_attached: "Attached documents",
add_documents: "Add documents",
document_max_size: "Max 10MB per file",
document_types_allowed: "PDF, Word, Excel",
download_document: "Download",

// ES
documents_attached: "Documentos adjuntos",
add_documents: "Agregar documentos",
document_max_size: "Maximo 10MB por archivo",
document_types_allowed: "PDF, Word, Excel",
download_document: "Descargar",
```

---

## Resumen de archivos a modificar

| Archivo | Accion |
|---------|--------|
| `backend/src/common/files/document-validation.ts` | **CREAR** - Validacion de documentos |
| `backend/src/services/services.service.ts` | **MODIFICAR** - Bifurcar flujo imagen/documento |
| `backend/src/services/services.controller.ts` | **MODIFICAR** - Agregar endpoint de descarga |
| `frontend/src/components/assets/NewServiceForm.tsx` | **MODIFICAR** - Input de documentos + preview |
| `frontend/src/components/services/ServiceDetailView.tsx` | **MODIFICAR** - Seccion documentos adjuntos |
| `frontend/src/components/services/ServiceDrawer.tsx` | **MODIFICAR** - Seccion documentos adjuntos |
| `frontend/src/lib/translations.ts` | **MODIFICAR** - Claves EN/ES |

## Restricciones

- NO crear migraciones de base de datos (el modelo ServiceAttachment ya tiene los campos necesarios: file_type, file_name, file_size_bytes)
- NO agregar nuevos valores al enum StoredFileKind (usar SERVICE_ATTACHMENT para todo)
- Mantener los limites actuales: 10 archivos, 10MB por archivo, 40MB total (compartido entre fotos y documentos)
- Los documentos NO se procesan (no sharp), se suben tal cual al storage
- Usar URLs firmadas temporales para descarga (el StoredFilesService ya tiene resolveFileUrlForOrg)
- Respetar el patron de i18n existente usando useLanguage() y el objeto t
- Respetar el diseno visual existente (Tailwind, colores del tema: bg-surface, border-border, text-secondary, etc.)
