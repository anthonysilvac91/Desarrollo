import api from '@/lib/api';

export interface Company {
  id: string;
  name: string;
  organization_id: string;
  logo_url?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  logo_url?: string;
  is_active?: boolean;
}

type CompanyPayload = FormData | CompanyFormData | Partial<CompanyFormData>;

export const companiesService = {
  async findAll(params?: { page?: number; limit?: number; search?: string }) {
    const res = await api.get('/companies', { params });
    return Array.isArray(res.data) ? res.data : res.data;
  },

  async findOne(id: string) {
    const res = await api.get(`/companies/${id}`);
    return res.data;
  },

  async create(data: CompanyPayload) {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.post('/companies', data, config);
    return res.data;
  },

  async update(id: string, data: CompanyPayload) {
    const config = data instanceof FormData
      ? { headers: { "Content-Type": "multipart/form-data" } }
      : undefined;
    const res = await api.patch(`/companies/${id}`, data, config);
    return res.data;
  },

  async remove(id: string) {
    const res = await api.delete(`/companies/${id}`);
    return res.data;
  }
};
