import { UploadReconciliationService } from './upload-reconciliation.service';

describe('UploadReconciliationService', () => {
  const prisma: any = {
    organization: { findMany: jest.fn() },
    storedFile: {
      aggregate: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    fileUpload: { findMany: jest.fn() },
    service: { findMany: jest.fn() },
    organizationStorageUsage: { upsert: jest.fn() },
    storageReconciliationIssue: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };
  const storage: any = { listFileRefs: jest.fn() };
  const uploads: any = { refreshServiceAttachmentSnapshot: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.storedFile.aggregate.mockResolvedValue({
      _sum: { size_bytes: 200 },
    });
    prisma.storedFile.count.mockResolvedValue(2);
    prisma.fileUpload.findMany.mockResolvedValue([
      {
        id: 'u1',
        storage_ref:
          'private://bucket/organizations/org-1/services/s1/attachments/u1/a.mp4',
        declared_size_bytes: 100n,
        service_id: 's1',
        status: 'UPLOADED',
      },
    ]);
    prisma.service.findMany.mockResolvedValue([{ id: 's1' }]);
    prisma.storedFile.findMany.mockResolvedValue([
      {
        id: 'f1',
        storage_ref:
          'private://bucket/organizations/org-1/services/s1/attachments/u0/ready.mp4',
        entity_type: 'SERVICE',
        entity_id: 's1',
      },
    ]);
    storage.listFileRefs
      .mockResolvedValueOnce([
        'private://bucket/organizations/org-1/services/s1/attachments/u0/ready.mp4',
        'private://bucket/organizations/org-1/orphan.bin',
      ])
      .mockResolvedValueOnce([]);
    prisma.storageReconciliationIssue.findFirst.mockResolvedValue(null);
  });

  it('reconcilia contadores y registra discrepancias sin borrar ambiguos', async () => {
    const service = new UploadReconciliationService(prisma, storage, uploads);
    const result = await service.reconcileOrganization('org-1');

    expect(result.readyBytes).toBe(200n);
    expect(result.reservedBytes).toBe(100n);
    expect(prisma.organizationStorageUsage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organization_id: 'org-1' },
        update: expect.objectContaining({
          ready_bytes: 200n,
          reserved_bytes: 100n,
          ready_file_count: 2,
          pending_upload_count: 1,
        }),
      }),
    );
    expect(prisma.storageReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          issue_type: 'UPLOADED_INTENT_MISSING_OBJECT',
        }),
      }),
    );
    expect(prisma.storageReconciliationIssue.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ issue_type: 'OBJECT_WITHOUT_RECORD' }),
      }),
    );
    expect(uploads.refreshServiceAttachmentSnapshot).toHaveBeenCalledWith('s1');
  });
});
