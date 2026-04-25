import api from '@/lib/api';

export interface Customer {
  id: string;
  name: string;
  organization_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerFormData {
  name: string;
}

export const customersService = {
  async findAll(params?: { page?: number; limit?: number; search?: string }) {
    const res = await api.get('/customers', { params });
    // Soporta respuesta paginada { data, meta } o un array directo
    return Array.isArray(res.data) ? res.data : res.data;
  },

  async findOne(id: string) {
    const res = await api.get(`/customers/${id}`);
    return res.data;
  },

  async create(data: CustomerFormData) {
    const res = await api.post('/customers', data);
    return res.data;
  },

  async update(id: string, data: Partial<CustomerFormData>) {
    const res = await api.patch(`/customers/${id}`, data);
    return res.data;
  },

  async remove(id: string) {
    const res = await api.delete(`/customers/${id}`);
    return res.data;
  }
};
