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
}

export const organizationsService = {
  async getMyOrganization(): Promise<Organization> {
    const response = await api.get<Organization>("/organizations/me");
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
};
