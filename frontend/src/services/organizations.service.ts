import api from "@/lib/api";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  brand_color?: string;
  default_asset_icon?: string;
  auto_publish_services: boolean;
  worker_edit_policy: string;
  worker_edit_window_hours?: number;
  worker_restricted_access: boolean;
  is_active: boolean;
  created_at: string;
  initial_invitation_token?: string;
}

export const organizationsService = {
  async findAll(): Promise<Organization[]> {
    const response = await api.get<Organization[]>("/organizations");
    return response.data;
  },

  async getMyOrganization(): Promise<Organization> {
    const response = await api.get<Organization>("/organizations/me");
    return response.data;
  },

  async create(data: any): Promise<Organization> {
    const response = await api.post<Organization>("/organizations", data);
    return response.data;
  },

  async updateSettings(formData: FormData): Promise<Organization> {
    const response = await api.patch<Organization>("/organizations/settings", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async toggleStatus(id: string, active: boolean): Promise<Organization> {
    const response = await api.patch<Organization>(`/organizations/${id}/status`, { is_active: active });
    return response.data;
  },
};
