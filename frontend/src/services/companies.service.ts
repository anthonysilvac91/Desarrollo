import api from '@/lib/api';

export interface Company {
  id: string;
  name: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanyFormData {
  name: string;
  is_active?: boolean;
}

export const companiesService = {
  async findAll(params?: { page?: number; limit?: number; search?: string }) {
    const res = await api.get('/companies', { params });
    return Array.isArray(res.data) ? res.data : res.data;
  },

  async findOne(id: string) {
    const res = await api.get(`/companies/${id}`);
    return res.data;
  },

  async create(data: CompanyFormData) {
    const res = await api.post('/companies', data);
    return res.data;
  },

  async update(id: string, data: Partial<CompanyFormData>) {
    const res = await api.patch(`/companies/${id}`, data);
    return res.data;
  },

  async remove(id: string) {
    const res = await api.delete(`/companies/${id}`);
    return res.data;
  }
};
