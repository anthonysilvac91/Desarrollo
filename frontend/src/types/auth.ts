export type Role = "SUPER_ADMIN" | "ADMIN" | "WORKER" | "EXTERNAL";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  brand_color?: string;
  logo_url?: string;
  default_asset_icon?: string;
  show_org_name?: boolean;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  is_active: boolean;
  two_factor_enabled?: boolean;
  avatar_url?: string;
  organization_id?: string;
  organization?: Organization;
  email_notifications_enabled?: boolean;
  security_alerts_enabled?: boolean;
  impersonator?: { id: string; name: string; email: string } | null;
}
