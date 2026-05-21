import api from "@/lib/api";
import { LoginFormData } from "@/types/schemas";

export const authService = {
  login: async (credentials: LoginFormData) => {
    const res = await api.post<{ access_token: string }>("/auth/login", credentials);
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
  register: async (token: string, name: string, password: string) => {
    const res = await api.post<{ access_token: string }>("/auth/register", { token, name, password });
    return res.data;
  },
  validateInvitation: async (token: string) => {
    const res = await api.post<{ email: string; role: string; organization_name: string; brand_color: string | null }>("/invitations/validate", { token });
    return res.data;
  },
};
