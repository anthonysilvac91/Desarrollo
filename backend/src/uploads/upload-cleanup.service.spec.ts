import { UploadCleanupService } from './upload-cleanup.service';

describe('UploadCleanupService', () => {
  const prisma: any = {
    fileUpload: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };
  const storage: any = { deleteFile: jest.fn() };
  const uploads: any = { refreshServiceAttachmentSnapshot: jest.fn() };
  const config: any = { get: jest.fn().mockReturnValue('true') };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expira uploads vencidos, elimina objeto y libera reserva una sola vez', async () => {
    prisma.fileUpload.findMany.mockResolvedValue([
      {
        id: 'upload-1',
        organization_id: 'org-1',
        service_id: 'service-1',
        storage_ref: 'private://bucket/path/video.mp4',
        declared_size_bytes: 100n,
      },
    ]);
    prisma.fileUpload.updateMany.mockResolvedValue({ count: 1 });

    const service = new UploadCleanupService(prisma, storage, uploads, config);
    const result = await service.expireStaleUploads();

    expect(result).toEqual({ expired: 1 });
    expect(storage.deleteFile).toHaveBeenCalledWith(
      'private://bucket/path/video.mp4',
    );
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(uploads.refreshServiceAttachmentSnapshot).toHaveBeenCalledWith(
      'service-1',
    );
  });

  it('es idempotente cuando otra ejecucion ya cambio el estado', async () => {
    prisma.fileUpload.findMany.mockResolvedValue([
      {
        id: 'upload-1',
        organization_id: 'org-1',
        service_id: 'service-1',
        storage_ref: 'private://bucket/path/video.mp4',
        declared_size_bytes: 100n,
      },
    ]);
    prisma.fileUpload.updateMany.mockResolvedValue({ count: 0 });

    const service = new UploadCleanupService(prisma, storage, uploads, config);
    const result = await service.expireStaleUploads();

    expect(result).toEqual({ expired: 0 });
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });
});
