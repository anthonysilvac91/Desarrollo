import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER" | "CLIENT";
  organization_id: string | null;
  company_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  company?: { id?: string; name: string } | null;
  customer?: { id?: string; name: string } | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

type UserUpdatePayload = FormData | Partial<Pick<User, "name" | "email" | "phone">>;

export const usersService = {
  findAll: async (params?: { role?: string, page?: number, limit?: number, search?: string }): Promise<any> => {
    const res = await api.get("/users", { params });
    return res.data;
  },

  findOne: async (id: string): Promise<User> => {
    const res = await api.get(`/users/${id}`);
    return res.data;
  },

  create: async (data: any): Promise<User> => {
    const res = await api.post("/users", data);
    return res.data;
  },

  update: async (id: string, data: UserUpdatePayload): Promise<User> => {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.patch(`/users/${id}`, data, config);
    return res.data;
  },

  toggleStatus: async (id: string): Promise<User> => {
    const res = await api.patch(`/users/${id}/status`);
    return res.data;
  }
};
