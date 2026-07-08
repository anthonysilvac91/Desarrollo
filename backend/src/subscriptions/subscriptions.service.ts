import { Injectable, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PlanTier, SubscriptionStatus } from '@prisma/client';
import { PLAN_LIMITS, suggestUpgrade } from './plan-limits';
import { EmailService } from '../email/email.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /** Notifica a todos los admins activos de una organizacion. Nunca lanza. */
  private async notifyOrgAdmins(
    orgId: string,
    send: (admin: {
      email: string;
      name: string;
      language: string;
    }) => Promise<void>,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          organization_id: orgId,
          role: 'ADMIN',
          is_active: true,
          email_notifications_enabled: true,
        },
        select: { email: true, name: true, language: true },
      });
      await Promise.all(
        admins.map((admin) =>
          send(admin).catch((err) =>
            this.logger.error(
              `Failed to notify admin ${admin.email} (org ${orgId})`,
              err,
            ),
          ),
        ),
      );
    } catch (err) {
      this.logger.error(`Failed to load admins for org ${orgId}`, err);
    }
  }

  async createForOrganization(orgId: string, plan: PlanTier = 'DEMO') {
    const limits = PLAN_LIMITS[plan];
    const isDemoTrialing = plan === 'DEMO';

    return this.prisma.subscription.create({
      data: {
        organization_id: orgId,
        plan,
        status: isDemoTrialing ? 'TRIALING' : 'ACTIVE',
        max_users: limits.max_users,
        max_assets: limits.max_assets,
        max_storage_gb: limits.max_storage_gb,
        max_video_hours: limits.max_video_hours,
        allow_external: limits.allow_external,
        allow_branding: limits.allow_branding,
        allow_ai_translation: limits.allow_ai_translation,
        demo_expires_at: limits.demo_duration_days
          ? new Date(Date.now() + limits.demo_duration_days * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }

  async findByOrg(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organization_id: orgId },
      include: { organization: { select: { id: true, name: true, slug: true, is_active: true } } },
    });

    if (!subscription) {
      throw new NotFoundException('No se encontró la suscripción para esta organización');
    }

    const [userCount, assetCount, storageUsage] = await Promise.all([
      this.prisma.user.count({
        where: {
          organization_id: orgId,
          role: { in: ['ADMIN', 'WORKER'] },
          deleted_at: null,
        },
      }),
      this.prisma.asset.count({
        where: { organization_id: orgId, deleted_at: null },
      }),
      this.prisma.organizationStorageUsage.findUnique({
        where: { organization_id: orgId },
      }),
    ]);

    const readyBytes = Number(storageUsage?.ready_bytes ?? 0);
    const storageGb = readyBytes / (1024 * 1024 * 1024);

    return {
      subscription,
      usage: {
        users: userCount,
        assets: assetCount,
        storage_gb: Math.round(storageGb * 100) / 100,
        video_hours: 0,
      },
      organization: subscription.organization,
    };
  }

  async findAll(filters?: { plan?: PlanTier; status?: SubscriptionStatus }) {
    const where: any = {};
    if (filters?.plan) where.plan = filters.plan;
    if (filters?.status) where.status = filters.status;

    const subscriptions = await this.prisma.subscription.findMany({
      where,
      include: { organization: { select: { id: true, name: true, slug: true, is_active: true } } },
      orderBy: { created_at: 'desc' },
    });

    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        const [userCount, assetCount, storageUsage] = await Promise.all([
          this.prisma.user.count({
            where: {
              organization_id: sub.organization_id,
              role: { in: ['ADMIN', 'WORKER'] },
              deleted_at: null,
            },
          }),
          this.prisma.asset.count({
            where: { organization_id: sub.organization_id, deleted_at: null },
          }),
          this.prisma.organizationStorageUsage.findUnique({
            where: { organization_id: sub.organization_id },
          }),
        ]);

        const readyBytes = Number(storageUsage?.ready_bytes ?? 0);
        const storageGb = readyBytes / (1024 * 1024 * 1024);

        return {
          subscription: sub,
          usage: {
            users: userCount,
            assets: assetCount,
            storage_gb: Math.round(storageGb * 100) / 100,
            video_hours: 0,
          },
          organization: sub.organization,
        };
      }),
    );

    return results;
  }

  async updatePlan(
    orgId: string,
    plan: PlanTier,
    overrides?: Partial<{
      max_users: number;
      max_assets: number;
      max_storage_gb: number;
      max_video_hours: number;
      allow_external: boolean;
      allow_branding: boolean;
      allow_ai_translation: boolean;
    }>,
    notes?: string,
  ) {
    const limits = PLAN_LIMITS[plan];

    const data: any = {
      plan,
      status: 'ACTIVE' as SubscriptionStatus,
      max_users: overrides?.max_users ?? limits.max_users,
      max_assets: overrides?.max_assets ?? limits.max_assets,
      max_storage_gb: overrides?.max_storage_gb ?? limits.max_storage_gb,
      max_video_hours: overrides?.max_video_hours ?? limits.max_video_hours,
      allow_external: overrides?.allow_external ?? limits.allow_external,
      allow_branding: overrides?.allow_branding ?? limits.allow_branding,
      allow_ai_translation: overrides?.allow_ai_translation ?? limits.allow_ai_translation,
      pending_plan: null,
      pending_plan_requested_at: null,
      pending_plan_requested_by: null,
      demo_expires_at: null,
    };

    if (notes !== undefined) data.notes = notes;

    const subscription = await this.prisma.subscription.upsert({
      where: { organization_id: orgId },
      update: data,
      create: { organization_id: orgId, ...data },
    });

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { is_active: true },
    });

    this.logger.log(`Plan updated for org ${orgId}: ${plan}`);
    return subscription;
  }

  async requestPlanChange(orgId: string, requestedPlan: PlanTier, userId: string) {
    return this.prisma.subscription.update({
      where: { organization_id: orgId },
      data: {
        pending_plan: requestedPlan,
        pending_plan_requested_at: new Date(),
        pending_plan_requested_by: userId,
      },
    });
  }

  async approvePlanChange(orgId: string, approved: boolean) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organization_id: orgId },
    });

    if (!subscription?.pending_plan) {
      throw new NotFoundException('No hay solicitud de cambio pendiente');
    }

    const requestedPlan = subscription.pending_plan;
    const requester = subscription.pending_plan_requested_by
      ? await this.prisma.user.findUnique({
          where: { id: subscription.pending_plan_requested_by },
          select: {
            email: true,
            name: true,
            language: true,
            email_notifications_enabled: true,
          },
        })
      : null;
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });

    if (requester && org && requester.email_notifications_enabled) {
      const emailSend = approved
        ? this.emailService.sendPlanChangeApproved(
            requester.email,
            requester.name,
            org.name,
            requestedPlan,
            requester.language as 'en' | 'es',
          )
        : this.emailService.sendPlanChangeRejected(
            requester.email,
            requester.name,
            org.name,
            requestedPlan,
            requester.language as 'en' | 'es',
          );
      emailSend.catch((err) =>
        this.logger.error(
          `Failed to send plan-change notice to ${requester.email}`,
          err,
        ),
      );
    }

    if (approved) {
      return this.updatePlan(orgId, subscription.pending_plan);
    }

    return this.prisma.subscription.update({
      where: { organization_id: orgId },
      data: {
        pending_plan: null,
        pending_plan_requested_at: null,
        pending_plan_requested_by: null,
      },
    });
  }

  async checkLimit(orgId: string, resource: 'assets' | 'users' | 'services' | 'storage' | 'video') {
    const subscription = await this.prisma.subscription.findUnique({
      where: { organization_id: orgId },
    });

    if (!subscription) return;

    if (
      subscription.plan === 'DEMO' &&
      subscription.demo_expires_at &&
      subscription.demo_expires_at < new Date()
    ) {
      throw new ForbiddenException({
        error: 'DEMO_EXPIRED',
        expired_at: subscription.demo_expires_at.toISOString(),
      });
    }

    if (subscription.status === 'SUSPENDED') {
      throw new ForbiddenException({
        error: 'DEMO_EXPIRED',
        expired_at: subscription.demo_expires_at?.toISOString() ?? new Date().toISOString(),
      });
    }

    if (resource === 'services') return;

    if (resource === 'assets') {
      const count = await this.prisma.asset.count({
        where: { organization_id: orgId, deleted_at: null },
      });
      if (count >= subscription.max_assets) {
        throw new ForbiddenException({
          error: 'PLAN_LIMIT_EXCEEDED',
          resource: 'assets',
          current: count,
          limit: subscription.max_assets,
          plan: subscription.plan,
          upgrade_to: suggestUpgrade(subscription.plan),
        });
      }
    }

    if (resource === 'users') {
      const count = await this.prisma.user.count({
        where: {
          organization_id: orgId,
          role: { in: ['ADMIN', 'WORKER'] },
          deleted_at: null,
        },
      });
      if (count >= subscription.max_users) {
        throw new ForbiddenException({
          error: 'PLAN_LIMIT_EXCEEDED',
          resource: 'users',
          current: count,
          limit: subscription.max_users,
          plan: subscription.plan,
          upgrade_to: suggestUpgrade(subscription.plan),
        });
      }
    }
  }

  async getSubscription(orgId: string) {
    return this.prisma.subscription.findUnique({
      where: { organization_id: orgId },
    });
  }

  async toggleStatus(orgId: string, status: 'ACTIVE' | 'SUSPENDED') {
    const subscription = await this.prisma.subscription.update({
      where: { organization_id: orgId },
      data: { status },
    });

    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: { is_active: status === 'ACTIVE' },
      select: { name: true },
    });

    void this.notifyOrgAdmins(orgId, (admin) =>
      this.emailService.sendSubscriptionStatusChanged(
        admin.email,
        admin.name,
        org.name,
        status === 'ACTIVE',
        admin.language as 'en' | 'es',
      ),
    );

    this.logger.log(`Subscription status for org ${orgId}: ${status}`);
    return subscription;
  }

  async backfillMissing(): Promise<{ created: number; orgIds: string[] }> {
    const orgsWithout = await this.prisma.organization.findMany({
      where: { subscription: null },
      select: { id: true },
    });

    const createdIds: string[] = [];
    for (const org of orgsWithout) {
      await this.createForOrganization(org.id, 'DEMO');
      createdIds.push(org.id);
    }

    if (createdIds.length > 0) {
      this.logger.log(`Backfilled ${createdIds.length} subscription(s): ${createdIds.join(', ')}`);
    }

    return { created: createdIds.length, orgIds: createdIds };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async suspendExpiredDemos() {
    const expired = await this.prisma.subscription.findMany({
      where: {
        plan: 'DEMO',
        demo_expires_at: { lt: new Date() },
        status: { in: ['ACTIVE', 'TRIALING'] },
      },
      include: { organization: { select: { name: true } } },
    });

    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'SUSPENDED' },
      });

      await this.prisma.organization.update({
        where: { id: sub.organization_id },
        data: { is_active: false },
      });

      void this.notifyOrgAdmins(sub.organization_id, (admin) =>
        this.emailService.sendSubscriptionStatusChanged(
          admin.email,
          admin.name,
          sub.organization.name,
          false,
          admin.language as 'en' | 'es',
        ),
      );

      this.logger.warn(`Demo expired and suspended: org ${sub.organization_id}`);
    }

    if (expired.length > 0) {
      this.logger.log(`Suspended ${expired.length} expired demo(s)`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async warnExpiringDemos() {
    const now = new Date();
    const in5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

    const expiringSoon = await this.prisma.subscription.findMany({
      where: {
        plan: 'DEMO',
        status: { in: ['ACTIVE', 'TRIALING'] },
        demo_expires_at: { gt: now, lte: in5Days },
      },
      include: { organization: { select: { name: true } } },
    });

    let warned = 0;
    for (const sub of expiringSoon) {
      if (!sub.demo_expires_at) continue;
      const daysLeft = Math.ceil(
        (sub.demo_expires_at.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      if (daysLeft !== 5 && daysLeft !== 1) continue;

      void this.notifyOrgAdmins(sub.organization_id, (admin) =>
        this.emailService.sendDemoExpiringSoon(
          admin.email,
          admin.name,
          sub.organization.name,
          daysLeft,
          admin.language as 'en' | 'es',
        ),
      );
      warned += 1;
    }

    if (warned > 0) {
      this.logger.log(`Warned admins of ${warned} soon-to-expire demo(s)`);
    }
  }
}
