import api from "@/lib/api";

export interface Service {
  id: string;
  title: string;
  description: string;
  asset_id: string;
  asset?: {
    id: string;
    name: string;
    location?: string;
  };
  worker?: {
    id: string;
    name: string;
  };
  attachments?: {
    file_url: string;
    file_type?: string;
  }[];
  is_public: boolean;
  status: string;
  created_at: string;
}

export const servicesService = {
  findAll: async () => {
    const res = await api.get<Service[]>("/services");
    return res.data;
  },
  findOne: async (id: string) => {
    const res = await api.get<Service>(`/services/${id}`);
    return res.data;
  },
  create: async (data: FormData) => {
    const res = await api.post<Service>("/services", data, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },
  update: async (id: string, data: any) => {
    const res = await api.patch<Service>(`/services/${id}`, data);
    return res.data;
  },
  delete: async (id: string) => {
    const res = await api.delete(`/services/${id}`);
    return res.data;
  }
};
