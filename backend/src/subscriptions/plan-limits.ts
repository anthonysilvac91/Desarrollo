export interface PlanLimits {
  max_users: number;
  max_assets: number;
  max_storage_gb: number;
  max_video_hours: number;
  allow_external: boolean;
  allow_branding: boolean;
  allow_ai_translation: boolean;
  demo_duration_days: number | null;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  DEMO: {
    max_users: 3,
    max_assets: 20,
    max_storage_gb: 1,
    max_video_hours: 0,
    allow_external: false,
    allow_branding: false,
    allow_ai_translation: false,
    demo_duration_days: 14,
  },
  STARTER: {
    max_users: 3,
    max_assets: 100,
    max_storage_gb: 5,
    max_video_hours: 0,
    allow_external: false,
    allow_branding: false,
    allow_ai_translation: false,
    demo_duration_days: null,
  },
  PRO: {
    max_users: 10,
    max_assets: 500,
    max_storage_gb: 50,
    max_video_hours: 10,
    allow_external: true,
    allow_branding: false,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
  BUSINESS: {
    max_users: 999999,
    max_assets: 999999,
    max_storage_gb: 200,
    max_video_hours: 50,
    allow_external: true,
    allow_branding: true,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
  ENTERPRISE: {
    max_users: 999999,
    max_assets: 999999,
    max_storage_gb: 999999,
    max_video_hours: 999999,
    allow_external: true,
    allow_branding: true,
    allow_ai_translation: true,
    demo_duration_days: null,
  },
};

const UPGRADE_PATH: Record<string, string> = {
  DEMO: 'STARTER',
  STARTER: 'PRO',
  PRO: 'BUSINESS',
  BUSINESS: 'ENTERPRISE',
};

export function suggestUpgrade(currentPlan: string): string | null {
  return UPGRADE_PATH[currentPlan] ?? null;
}
