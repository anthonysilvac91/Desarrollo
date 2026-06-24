export type StorageVisibility = 'public' | 'private';

export interface UploadFileOptions {
  folder?: string;
  visibility?: StorageVisibility;
}

export interface SignedUploadIntent {
  bucket: string;
  objectPath: string;
  storageRef: string;
  signedUploadToken: string;
  tusEndpoint: string;
}

export interface StorageObjectMetadata {
  bucket: string;
  objectPath: string;
  sizeBytes: number | null;
  mimeType: string | null;
}

export abstract class StorageService {
  /**
   * Sube un archivo al almacenamiento y retorna una referencia persistible.
   */
  abstract uploadFile(
    file: Express.Multer.File,
    options?: UploadFileOptions,
  ): Promise<string>;

  /**
   * Resuelve una referencia persistida a una URL consumible por el frontend.
   */
  abstract resolveFileUrl(fileRef: string): Promise<string>;

  /**
   * Elimina un archivo del almacenamiento.
   */
  abstract deleteFile(fileRef: string): Promise<void>;

  /**
   * Indica si la referencia pertenece al backend de storage actual.
   */
  abstract canHandleFileRef(fileRef: string): boolean;

  /**
   * Obtiene el tamaño del archivo en bytes, si puede resolverse.
   */
  abstract getFileSize(fileRef: string): Promise<number | null>;

  /**
   * Lista referencias persistibles de archivos gestionados por storage.
   */
  abstract listFileRefs(prefix?: string): Promise<string[]>;

  createSignedUploadIntent(_objectPath: string): Promise<SignedUploadIntent> {
    throw new Error('Signed uploads are not supported by this storage backend');
  }

  getObjectMetadata(_fileRef: string): Promise<StorageObjectMetadata | null> {
    throw new Error(
      'Object metadata lookup is not supported by this storage backend',
    );
  }

  readObjectRange(
    _fileRef: string,
    _start: number,
    _end: number,
  ): Promise<Buffer> {
    throw new Error('Range reads are not supported by this storage backend');
  }

  async resolveFileUrlWithTtl(
    fileRef: string,
    _ttlSeconds: number,
  ): Promise<string> {
    return this.resolveFileUrl(fileRef);
  }

  /**
   * Invalida la entrada de caché de signed URL para la referencia dada.
   * Las implementaciones que usan caché deben sobrescribir este método.
   */
  invalidateSignedUrlCache(_fileRef: string): void {
    // no-op por defecto
  }
}
