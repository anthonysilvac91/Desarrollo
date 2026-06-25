import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_LIMITS } from './plan-limits';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: any;

  beforeEach(async () => {
    const prismaMock = {
      subscription: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      user: { count: jest.fn().mockResolvedValue(0) },
      asset: { count: jest.fn().mockResolvedValue(0) },
      organizationStorageUsage: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SchedulerRegistry, useValue: {} },
      ],
    }).compile();

    service = module.get(SubscriptionsService);
    prisma = module.get(PrismaService);
  });

  describe('updatePlan (upsert)', () => {
    it('asignar BUSINESS sin Subscription previa crea la fila con límites oficiales', async () => {
      const createdSub = {
        id: 'sub-1',
        organization_id: 'org-1',
        plan: 'BUSINESS',
        max_storage_gb: 200,
        max_users: 999999,
        max_assets: 999999,
        max_video_hours: 50,
      };
      prisma.subscription.upsert.mockResolvedValue(createdSub);
      prisma.organization.update.mockResolvedValue({});

      const result = await service.updatePlan('org-1', 'BUSINESS');

      expect(prisma.subscription.upsert).toHaveBeenCalledWith({
        where: { organization_id: 'org-1' },
        update: expect.objectContaining({
          plan: 'BUSINESS',
          status: 'ACTIVE',
          max_storage_gb: PLAN_LIMITS.BUSINESS.max_storage_gb,
          max_users: PLAN_LIMITS.BUSINESS.max_users,
          max_assets: PLAN_LIMITS.BUSINESS.max_assets,
          max_video_hours: PLAN_LIMITS.BUSINESS.max_video_hours,
          allow_external: PLAN_LIMITS.BUSINESS.allow_external,
          allow_branding: PLAN_LIMITS.BUSINESS.allow_branding,
          allow_ai_translation: PLAN_LIMITS.BUSINESS.allow_ai_translation,
        }),
        create: expect.objectContaining({
          organization_id: 'org-1',
          plan: 'BUSINESS',
          max_storage_gb: 200,
        }),
      });
      expect(result.max_storage_gb).toBe(200);
    });

    it('actualizar Subscription existente reutiliza la misma fila (sin duplicados)', async () => {
      const existingSub = {
        id: 'sub-1',
        organization_id: 'org-1',
        plan: 'PRO',
        max_storage_gb: 50,
      };
      prisma.subscription.upsert.mockResolvedValue({
        ...existingSub,
        plan: 'BUSINESS',
        max_storage_gb: 200,
      });
      prisma.organization.update.mockResolvedValue({});

      const result = await service.updatePlan('org-1', 'BUSINESS');

      expect(prisma.subscription.upsert).toHaveBeenCalledTimes(1);
      expect(result.plan).toBe('BUSINESS');
      expect(result.max_storage_gb).toBe(200);
    });

    it('BUSINESS sin overrides obtiene exactamente PLAN_LIMITS.BUSINESS', async () => {
      prisma.subscription.upsert.mockResolvedValue({
        plan: 'BUSINESS',
        ...PLAN_LIMITS.BUSINESS,
      });
      prisma.organization.update.mockResolvedValue({});

      await service.updatePlan('org-1', 'BUSINESS');

      const upsertCall = prisma.subscription.upsert.mock.calls[0][0];
      const updateData = upsertCall.update;
      expect(updateData.max_storage_gb).toBe(200);
      expect(updateData.max_users).toBe(999999);
      expect(updateData.max_assets).toBe(999999);
      expect(updateData.max_video_hours).toBe(50);
      expect(updateData.allow_external).toBe(true);
      expect(updateData.allow_branding).toBe(true);
      expect(updateData.allow_ai_translation).toBe(true);
    });

    it('ENTERPRISE con overrides usa los overrides en vez de PLAN_LIMITS', async () => {
      prisma.subscription.upsert.mockResolvedValue({
        plan: 'ENTERPRISE',
        max_storage_gb: 500,
      });
      prisma.organization.update.mockResolvedValue({});

      await service.updatePlan('org-1', 'ENTERPRISE', { max_storage_gb: 500 });

      const upsertCall = prisma.subscription.upsert.mock.calls[0][0];
      expect(upsertCall.update.max_storage_gb).toBe(500);
    });

    it('activa la organización después del upsert', async () => {
      prisma.subscription.upsert.mockResolvedValue({ plan: 'BUSINESS' });
      prisma.organization.update.mockResolvedValue({});

      await service.updatePlan('org-1', 'BUSINESS');

      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { is_active: true },
      });
    });

    it('limpia campos pending al asignar plan', async () => {
      prisma.subscription.upsert.mockResolvedValue({ plan: 'BUSINESS' });
      prisma.organization.update.mockResolvedValue({});

      await service.updatePlan('org-1', 'BUSINESS');

      const upsertCall = prisma.subscription.upsert.mock.calls[0][0];
      expect(upsertCall.update.pending_plan).toBeNull();
      expect(upsertCall.update.pending_plan_requested_at).toBeNull();
      expect(upsertCall.update.pending_plan_requested_by).toBeNull();
      expect(upsertCall.update.demo_expires_at).toBeNull();
    });
  });

  describe('createForOrganization', () => {
    it('DEMO crea subscription con status TRIALING y max_storage_gb=1', async () => {
      prisma.subscription.create.mockResolvedValue({ plan: 'DEMO' });

      await service.createForOrganization('org-1', 'DEMO');

      const createCall = prisma.subscription.create.mock.calls[0][0];
      expect(createCall.data.plan).toBe('DEMO');
      expect(createCall.data.status).toBe('TRIALING');
      expect(createCall.data.max_storage_gb).toBe(1);
      expect(createCall.data.demo_expires_at).toBeInstanceOf(Date);
    });
  });
});
