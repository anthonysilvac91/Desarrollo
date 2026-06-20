import api from "@/lib/api";

export interface ServiceAttachment {
  id: string;
  file_url?: string | null;
  file_type?: string;
}

export interface Service {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  attachments: ServiceAttachment[];
  worker: { name: string; id: string; deleted_at?: string | null; purged_at?: string | null };
  asset?: {
    name: string;
    id: string;
    category?: string;
    location?: string;
    owner_id?: string | null;
    owner?: { id: string; name: string } | null;
  };
}

export interface Asset {
  id: string;
  name: string;
  description?: string;
  category?: string;
  location?: string;
  thumbnail_url?: string;
  serial_number?: string;
  is_active: boolean;
  owner_id?: string | null;
  owner?: {
    id: string;
    name: string;
    deleted_at?: string | null;
    purged_at?: string | null;
    action_type?: string;
  } | null;
  last_service?: {
    date: string;
    type?: string;
  } | null;
  _count?: {
    services: number;
  };
  services?: Service[];
}

export interface AssetStats {
  total_assets: number;
  active_assets: number;
  inactive_assets: number;
  assets_with_services: number;
}

export interface AssetFilterOptions {
  owners: Array<{ id: string; name: string }>;
}

export const assetsService = {
  getStats: async (): Promise<AssetStats> => {
    const res = await api.get("/assets/stats");
    return res.data;
  },

  findAll: async (params?: { page?: number, limit?: number, search?: string, owner_id?: string, is_active?: string }): Promise<any> => {
    const res = await api.get("/assets", { params });
    return res.data;
  },

  getFilterOptions: async (): Promise<AssetFilterOptions> => {
    const res = await api.get<AssetFilterOptions>("/assets/filter-options");
    return res.data;
  },
  
  findOne: async (id: string): Promise<Asset> => {
    const res = await api.get(`/assets/${id}`);
    return res.data;
  },

  getService: async (id: string): Promise<Service> => {
    const res = await api.get(`/services/${id}`);
    return res.data;
  },

  create: async (data: FormData | Partial<Asset>) => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const res = await api.post("/assets", data, { headers });
    return res.data;
  },

  assignOwner: async (assetId: string, ownerId: string) => {
    const res = await api.post(`/assets/${assetId}/owners/${ownerId}`);
    return res.data;
  },

  removeOwner: async (assetId: string, ownerId: string) => {
    const res = await api.delete(`/assets/${assetId}/owners/${ownerId}`);
    return res.data;
  },

  createService: async (formData: FormData): Promise<Service> => {
    const res = await api.post("/services", formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  toggleStatus: async (id: string, is_active: boolean) => {
    const res = await api.patch(`/assets/${id}/status`, { is_active });
    return res.data;
  },

  delete: async (id: string, options?: { deleteServices?: boolean }) => {
    const res = await api.delete(`/assets/${id}`, { data: options });
    return res.data;
  },

  update: async (id: string, data: FormData | Partial<Asset>) => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const res = await api.patch(`/assets/${id}`, data, { headers });
    return res.data;
  },

};
