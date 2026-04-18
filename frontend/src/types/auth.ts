export type Role = "SUPER_ADMIN" | "ADMIN" | "WORKER" | "CLIENT";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  brand_color?: string;
  logo_url?: string;
}

export interface User {
  id: string;
  email: string;
  role: Role;
  name: string;
  is_active: boolean;
  organization_id?: string;
  organization?: Organization;
}
