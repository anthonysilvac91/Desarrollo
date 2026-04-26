export type StorageVisibility = 'public' | 'private';

export interface UploadFileOptions {
  folder?: string;
  visibility?: StorageVisibility;
}

export abstract class StorageService {
  /**
   * Sube un archivo al almacenamiento y retorna una referencia persistible.
   */
  abstract uploadFile(file: Express.Multer.File, options?: UploadFileOptions): Promise<string>;

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
}
