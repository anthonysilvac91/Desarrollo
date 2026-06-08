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
    thumbnail_url?: string | null;
    owner?: { id: string; name: string };
  };
  worker?: {
    id: string;
    name: string;
  };
  attachments?: {
    file_url?: string | null;
    file_type?: string;
  }[];
  is_public: boolean;
  status: string;
  created_at: string;
}

export interface ServiceStats {
  total_services: number;
  period_services: number;
  assets_serviced: number;
  active_operators: number;
}

export interface ServiceFilterOptions {
  workers: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string }>;
}

export const servicesService = {
  findAll: async (params?: { page?: number; limit?: number; search?: string; worker_id?: string; asset_id?: string; preset?: string; startDate?: string; endDate?: string }): Promise<any> => {
    const res = await api.get("/services", { params });
    return res.data;
  },

  getStats: async (params?: { preset?: string; startDate?: string; endDate?: string }): Promise<ServiceStats> => {
    const res = await api.get<ServiceStats>("/services/stats", { params });
    return res.data;
  },
  getFilterOptions: async (): Promise<ServiceFilterOptions> => {
    const res = await api.get<ServiceFilterOptions>("/services/filter-options");
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
