export const ASSET_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SERVICE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

interface CompressImageOptions {
  maxDimension: number;
  quality: number;
  maxBytes: number;
  fileNamePrefix: string;
}

const PREFERRED_OUTPUT_TYPE = "image/webp";
const FALLBACK_OUTPUT_TYPE = "image/jpeg";
const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

export function formatBytes(bytes: number) {
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}

export async function compressImageFile(file: File, options: CompressImageOptions): Promise<File> {
  if (!isImageFile(file)) {
    throw new Error("El archivo seleccionado no es una imagen.");
  }

  const imageFile = await normalizeHeicFile(file);
  const image = await loadImage(imageFile);
  const scale = Math.min(1, options.maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("No se pudo procesar la imagen en este navegador.");
  }

  ctx.drawImage(image, 0, 0, width, height);

  const blob =
    (await canvasToBlob(canvas, PREFERRED_OUTPUT_TYPE, options.quality)) ??
    (await canvasToBlob(canvas, FALLBACK_OUTPUT_TYPE, options.quality));

  if (!blob) {
    throw new Error("No se pudo comprimir la imagen seleccionada.");
  }

  if (blob.size > options.maxBytes) {
    throw new Error(`La imagen comprimida pesa ${formatBytes(blob.size)}. El maximo permitido es ${formatBytes(options.maxBytes)}.`);
  }

  const typeToExt: Record<string, string> = { "image/webp": "webp", "image/png": "png" };
  const extension = typeToExt[blob.type] ?? "jpg";
  const fileType = blob.type || FALLBACK_OUTPUT_TYPE;
  return new File([blob], `${options.fileNamePrefix}.${extension}`, { type: fileType });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };
    image.src = url;
  });
}

function isImageFile(file: File) {
  if (!file.type) {
    const ext = file.name.toLowerCase().split(".").pop() ?? "";
    return ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"].includes(ext);
  }
  return file.type.startsWith("image/") || isHeicFile(file);
}

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  return HEIC_MIME_TYPES.has(file.type.toLowerCase()) || name.endsWith(".heic") || name.endsWith(".heif");
}

async function normalizeHeicFile(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      toType: FALLBACK_OUTPUT_TYPE,
      quality: 0.9,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;

    return new File([blob], replaceExtension(file.name, "jpg"), { type: FALLBACK_OUTPUT_TYPE });
  } catch (error) {
    console.error("HEIC conversion failed:", error);
    throw new Error("No se pudo convertir la imagen HEIC/HEIF. Prueba seleccionarla como JPEG desde el iPhone.");
  }
}

function replaceExtension(fileName: string, extension: string) {
  return fileName.replace(/\.[^.]+$/, "") + `.${extension}`;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? null), type, quality);
  });
}
