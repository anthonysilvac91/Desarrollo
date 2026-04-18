import api from "@/lib/api";
import { LoginFormData } from "@/types/schemas";

export const authService = {
  login: async (credentials: LoginFormData) => {
    // Ajustar la ruta si el backend tiene un prefijo de api diferente
    const res = await api.post<{ access_token: string }>("/auth/login", credentials);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data;
  },
};
