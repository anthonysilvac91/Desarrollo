import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';

export type RealtimeModule = 'assets' | 'services' | 'users';
export type RealtimeAction = 'created' | 'updated' | 'deleted';

export interface RealtimeEvent {
  module: RealtimeModule;
  action: RealtimeAction;
  entityId: string;
  organizationId: string | null;
  actorUserId?: string | null;
  emittedAt: string;
}

interface RealtimeSubscriber {
  role: string;
  orgId?: string | null;
}

@Injectable()
export class RealtimeService {
  private readonly events$ = new Subject<RealtimeEvent>();

  emit(event: Omit<RealtimeEvent, 'emittedAt'>) {
    this.events$.next({
      ...event,
      emittedAt: new Date().toISOString(),
    });
  }

  subscribe(user: RealtimeSubscriber): Observable<MessageEvent> {
    return this.events$.pipe(
      filter((event) => this.canReceiveEvent(event, user)),
      map((event) => ({ data: event })),
    );
  }

  private canReceiveEvent(
    event: RealtimeEvent,
    user: RealtimeSubscriber,
  ): boolean {
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    return !!user.orgId && event.organizationId === user.orgId;
  }
}
