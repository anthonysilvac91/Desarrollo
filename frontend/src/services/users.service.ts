import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER" | "CLIENT";
  organization_id: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  created_at: string;
}

export const usersService = {
  findAll: async (role?: string): Promise<User[]> => {
    const query = role ? `?role=${role}` : "";
    const res = await api.get(`/users${query}`);
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
