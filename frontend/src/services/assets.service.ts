import api from "@/lib/api";

export interface ServiceAttachment {
  id: string;
  file_url: string;
  file_type?: string;
}

export interface Service {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  attachments: ServiceAttachment[];
  worker: { name: string; id: string };
  asset?: {
    name: string;
    id: string;
    category?: string;
    location?: string;
    company_id?: string | null;
    company?: { id: string; name: string } | null;
    customer?: { id: string; name: string } | null;
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
  client_access?: {
    client: { id: string; name: string };
  }[];
  company_id?: string | null;
  company?: {
    id: string;
    name: string;
    action_type?: string;
  } | null;
  customer?: {
    id: string;
    name: string;
    action_type?: string;
  } | null;
  last_service?: {
    date: string;
    type?: string;
  };
  _count?: {
    services: number;
  };
  services?: Service[];
}

export const assetsService = {
  findAll: async (params?: { page?: number, limit?: number, search?: string }): Promise<any> => {
    const res = await api.get("/assets", { params });
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

  assignCompany: async (assetId: string, companyId: string) => {
    const res = await api.post(`/assets/${assetId}/companies/${companyId}`);
    return res.data;
  },

  createService: async (formData: FormData): Promise<Service> => {
    const res = await api.post("/services", formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  delete: async (id: string) => {
    const res = await api.delete(`/assets/${id}`);
    return res.data;
  },

  update: async (id: string, data: FormData | Partial<Asset>) => {
    const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
    const res = await api.patch(`/assets/${id}`, data, { headers });
    return res.data;
  },

  assignClient: async (assetId: string, clientId: string) => {
    return assetsService.assignCompany(assetId, clientId);
  },
};
