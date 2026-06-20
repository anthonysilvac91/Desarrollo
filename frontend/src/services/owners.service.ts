import api from '@/lib/api';

export interface Owner {
  id: string;
  name: string;
  organization_id: string;
  logo_url?: string | null;
  is_active: boolean;
  assets_count?: number;
  services_count?: number;
  assets?: OwnerAsset[];
  owner_assets?: OwnerAsset[];
  created_at: string;
  updated_at: string;
}

export interface OwnerAsset {
  id: string;
  name: string;
  category?: string | null;
  location?: string | null;
  is_active?: boolean;
  thumbnail_url?: string | null;
}

export interface OwnerFormData {
  name: string;
  is_active?: boolean;
}

type OwnerPayload = FormData | OwnerFormData | Partial<OwnerFormData>;

export const ownersService = {
  async findAll(params?: { page?: number; limit?: number; search?: string; is_active?: string }) {
    const res = await api.get('/owners', { params });
    return Array.isArray(res.data) ? res.data : res.data;
  },

  async findOne(id: string) {
    const res = await api.get(`/owners/${id}`);
    return res.data;
  },

  async create(data: OwnerPayload) {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.post('/owners', data, config);
    return res.data;
  },

  async update(id: string, data: OwnerPayload) {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.patch(`/owners/${id}`, data, config);
    return res.data;
  },

  async deactivate(id: string) {
    const res = await api.patch(`/owners/${id}/status`);
    return res.data;
  },

  async remove(id: string, options?: { deleteAssets?: boolean; deleteServices?: boolean }) {
    const res = await api.delete(`/owners/${id}`, { data: options });
    return res.data;
  }
};
