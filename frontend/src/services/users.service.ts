import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "WORKER" | "CLIENT";
  organization_id: string;
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

  create: async (data: any) => {
    // Nota: Por ahora no hay endpoint de creación explícita en el plan previo, 
    // usualmente se hace vía Invitaciones.
    const res = await api.post("/users", data);
    return res.data;
  }
};
