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
}
