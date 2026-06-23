import { Injectable, CanActivate, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionsService } from './subscriptions.service';

export const PLAN_LIMIT_KEY = 'plan_limit_resource';

export const CheckPlanLimit = (resource: 'assets' | 'users' | 'services') =>
  SetMetadata(PLAN_LIMIT_KEY, resource);

@Injectable()
export class PlanLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionsService: SubscriptionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(PLAN_LIMIT_KEY, context.getHandler());
    if (!resource) return true;

    const request = context.switchToHttp().getRequest();
    const orgId = request.user?.orgId;
    if (!orgId) return true;

    await this.subscriptionsService.checkLimit(
      orgId,
      resource as 'assets' | 'users' | 'services',
    );
    return true;
  }
}
