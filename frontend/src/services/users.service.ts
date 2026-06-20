import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER" | "EXTERNAL";
  organization_id: string | null;
  owner_id?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  organization?: { id?: string; name: string; slug?: string; logo_url?: string | null; show_org_name?: boolean } | null;
  owner?: { id?: string; name: string } | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface UserStats {
  total_users: number;
  super_admins: number;
  admins: number;
  workers: number;
  external_users: number;
}

type UserUpdatePayload = FormData | Partial<Pick<User, "name" | "email" | "phone">>;
type OwnProfileUpdatePayload = FormData | {
  name?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
};

export const usersService = {
  findAll: async (params?: { role?: string, isActive?: string, page?: number, limit?: number, search?: string }): Promise<any> => {
    const res = await api.get("/users", { params });
    return res.data;
  },

  getStats: async (): Promise<UserStats> => {
    const res = await api.get("/users/stats");
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

  updateMe: async (data: OwnProfileUpdatePayload): Promise<User> => {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.patch("/users/me", data, config);
    return res.data;
  },

  toggleStatus: async (id: string): Promise<User> => {
    const res = await api.patch(`/users/${id}/status`);
    return res.data;
  },

  delete: async (id: string): Promise<User> => {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  }
};
