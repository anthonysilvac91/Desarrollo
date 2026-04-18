export abstract class StorageService {
  /**
   * Sube un archivo al almacenamiento y retorna la URL pública resultante.
   * @param file El archivo cargado mediante Multer.
   * @param folder Carpeta o prefijo opcional para organizar los archivos.
   */
  abstract uploadFile(file: Express.Multer.File, folder?: string): Promise<string>;

  /**
   * Elimina un archivo del almacenamiento.
   * @param fileUrl URL completa del archivo a eliminar.
   */
  abstract deleteFile(fileUrl: string): Promise<void>;
}
