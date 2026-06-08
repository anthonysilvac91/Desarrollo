# Service Evidence Model

## Estado implementado

- Los adjuntos de services se validan en backend antes de subirlos: MIME declarado por multer, firma/magic bytes y dimensiones.
- El backend procesa imagenes compatibles con Sharp antes de storage.
- La salida persistida es WebP quality 82, maximo 2000 px en el lado mas largo, sin agrandar imagenes pequenas.
- `StoredFile.mime_type`, `StoredFile.size_bytes`, `ServiceAttachment.file_type` y `ServiceAttachment.file_size_bytes` reflejan el archivo final procesado.
- Se mantiene compatibilidad con imagenes existentes porque la lectura sigue resolviendo `StoredFile.storage_ref` y signed URLs igual que antes.
- No se agrega migracion Prisma en este cambio.

## Limites vigentes

- Maximo 10 adjuntos por service.
- Maximo 10 MB por archivo original.
- Maximo 40 MB acumulados originales por service.
- La cuota de storage de la organizacion se valida usando el tamano final procesado.

## Evolucion de producto

Para soportar bien evidencia visual como feature central, conviene ampliar `ServiceAttachment` y no sobrecargar `StoredFile`.

Campos sugeridos para una migracion futura:

- `width Int?`
- `height Int?`
- `original_size_bytes Int?`
- `sort_order Int @default(0)`
- `caption String?`
- `role ServiceAttachmentRole @default(GENERAL)` con valores `GENERAL`, `BEFORE`, `AFTER`
- `is_cover Boolean @default(false)`

Notas:

- Portada de servicio: `is_cover` o `cover_attachment_id` en `Service`.
- Orden manual: `sort_order` por `service_id`.
- Comentarios por imagen: `caption` cubre el caso simple; comentarios multiples requeririan tabla aparte.
- Reporte con evidencias: usar `ServiceAttachment` como fuente ordenada y tipada, y `StoredFile` solo como metadata de storage.
