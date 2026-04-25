import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER" | "CLIENT";
  organization_id: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  customer?: { name: string };
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

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

  update: async (id: string, data: any): Promise<User> => {
    const res = await api.patch(`/users/${id}`, data);
    return res.data;
  },

  toggleStatus: async (id: string): Promise<User> => {
    const res = await api.patch(`/users/${id}/status`);
    return res.data;
  }
};
