import api from "@/lib/api";

export type PlanTier = "DEMO" | "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "SUSPENDED" | "CANCELLED";

export interface Subscription {
  id: string;
  organization_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  max_users: number;
  max_assets: number;
  max_storage_gb: number;
  max_video_hours: number;
  allow_external: boolean;
  allow_branding: boolean;
  allow_ai_translation: boolean;
  demo_expires_at: string | null;
  pending_plan: PlanTier | null;
  pending_plan_requested_at: string | null;
  pending_plan_requested_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionWithUsage {
  subscription: Subscription;
  usage: {
    users: number;
    assets: number;
    storage_gb: number;
    video_hours: number;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
  };
}

export const subscriptionsService = {
  async getMyPlan(): Promise<SubscriptionWithUsage> {
    const response = await api.get<SubscriptionWithUsage>("/subscriptions/me");
    return response.data;
  },

  async requestChange(plan: PlanTier): Promise<Subscription> {
    const response = await api.post<Subscription>("/subscriptions/me/request-change", {
      requested_plan: plan,
    });
    return response.data;
  },

  async listAll(params?: { plan?: PlanTier; status?: SubscriptionStatus }): Promise<SubscriptionWithUsage[]> {
    const response = await api.get<SubscriptionWithUsage[]>("/subscriptions", { params });
    return response.data;
  },

  async assignPlan(
    orgId: string,
    data: { plan: PlanTier; overrides?: Partial<Subscription>; notes?: string },
  ): Promise<Subscription> {
    const response = await api.post<Subscription>(`/subscriptions/${orgId}/plan`, data);
    return response.data;
  },

  async approveChange(orgId: string, approved: boolean): Promise<Subscription> {
    const response = await api.post<Subscription>(`/subscriptions/${orgId}/approve-change`, {
      approved,
    });
    return response.data;
  },

  async toggleStatus(orgId: string, status: SubscriptionStatus): Promise<Subscription> {
    const response = await api.patch<Subscription>(`/subscriptions/${orgId}/status`, { status });
    return response.data;
  },
};
