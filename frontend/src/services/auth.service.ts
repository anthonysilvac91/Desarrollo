import api from "@/lib/api";
import { LoginFormData } from "@/types/schemas";

export type LoginResponse =
  | { access_token: string; requires_2fa?: false }
  | { requires_2fa: true; temporary_token: string };

export interface TwoFactorStatus {
  enabled: boolean;
  backup_codes_remaining: number;
}

export interface TwoFactorSetup {
  secret: string;
  otpauth_url: string;
  setup_token: string;
}

export interface AuthSession {
  id: string;
  device_name: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_current: boolean;
  user_agent: string | null;
}

export interface RegisterOrganizationData {
  organization_name: string;
  admin_name: string;
  email: string;
  password: string;
}

export const authService = {
  login: async (credentials: LoginFormData) => {
    const res = await api.post<LoginResponse>("/auth/login", credentials);
    return res.data;
  },
  loginWithTwoFactor: async (temporaryToken: string, code: string) => {
    const res = await api.post<{ access_token: string }>("/auth/2fa/login", {
      temporary_token: temporaryToken,
      code,
    });
    return res.data;
  },
  getTwoFactorStatus: async () => {
    const res = await api.get<TwoFactorStatus>("/auth/2fa/status");
    return res.data;
  },
  setupTwoFactor: async () => {
    const res = await api.post<TwoFactorSetup>("/auth/2fa/setup");
    return res.data;
  },
  verifyTwoFactorSetup: async (setupToken: string, code: string) => {
    const res = await api.post<{ enabled: boolean; backup_codes: string[] }>("/auth/2fa/verify-setup", {
      setup_token: setupToken,
      code,
    });
    return res.data;
  },
  disableTwoFactor: async (code: string) => {
    const res = await api.post<{ enabled: boolean }>("/auth/2fa/disable", { code });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data;
  },
  forgotPassword: async (email: string) => {
    const res = await api.post<{ message: string }>("/auth/forgot-password", { email });
    return res.data;
  },
  resetPassword: async (token: string, password: string) => {
    const res = await api.post<{ message: string }>("/auth/reset-password", { token, password });
    return res.data;
  },
  getSessions: async () => {
    const res = await api.get<AuthSession[]>("/auth/sessions");
    return res.data;
  },
  revokeSession: async (sessionId: string) => {
    const res = await api.delete<{ revoked: boolean }>(`/auth/sessions/${sessionId}`);
    return res.data;
  },
  revokeOtherSessions: async () => {
    const res = await api.post<{ revoked: boolean }>("/auth/sessions/revoke-others");
    return res.data;
  },
  logout: async () => {
    const res = await api.post<{ revoked: boolean }>("/auth/logout");
    return res.data;
  },
  register: async (token: string, name: string, password: string) => {
    const res = await api.post<{ access_token: string }>("/auth/register", { token, name, password });
    return res.data;
  },
  registerOrganization: async (data: RegisterOrganizationData) => {
    const res = await api.post<{ access_token: string; organization: { id: string; name: string; slug: string; is_active: boolean } }>(
      "/auth/register-organization",
      data,
    );
    return res.data;
  },
  validateInvitation: async (token: string) => {
    const res = await api.post<{ email: string; role: string; organization_name: string; brand_color: string | null }>("/invitations/validate", { token });
    return res.data;
  },
};
