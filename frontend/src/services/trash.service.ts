import api from "@/lib/api";

export interface TrashItem {
  id: string;
  entity_type: "asset" | "service" | "user" | "owner";
  name: string;
  module: string;
  deleted_at: string;
  deleted_by: { id: string; name: string } | null;
}

export interface TrashResponse {
  data: TrashItem[];
  meta: { total: number; page?: number; limit?: number; totalPages?: number };
}

export interface TrashFilterOptions {
  categories: Array<TrashItem["entity_type"]>;
  users: Array<{ id: string; name: string }>;
}

export interface RestorePreview {
  assets?: number;
  services?: number;
  users?: number;
}

export interface RestoreOptions {
  restoreAssets?: boolean;
  restoreServices?: boolean;
  restoreUsers?: boolean;
}

export const trashService = {
  findAll: async (params?: { search?: string; entity_type?: string; deleted_by_id?: string; page?: number; limit?: number }): Promise<TrashResponse> => {
    const res = await api.get("/trash", { params });
    return res.data;
  },

  getFilterOptions: async (): Promise<TrashFilterOptions> => {
    const res = await api.get("/trash/filter-options");
    return res.data;
  },

  findOneDetail: async (entityType: string, id: string): Promise<any> => {
    const res = await api.get(`/trash/${entityType}/${id}`);
    return res.data;
  },

  getRestorePreview: async (entityType: string, id: string): Promise<RestorePreview> => {
    const res = await api.get(`/trash/${entityType}/${id}/restore-preview`);
    return res.data;
  },

  restore: async (entityType: string, id: string, options?: RestoreOptions): Promise<any> => {
    const res = await api.post(`/trash/${entityType}/${id}/restore`, options);
    return res.data;
  },

  permanentDelete: async (entityType: string, id: string): Promise<any> => {
    const res = await api.delete(`/trash/${entityType}/${id}`);
    return res.data;
  },
};
