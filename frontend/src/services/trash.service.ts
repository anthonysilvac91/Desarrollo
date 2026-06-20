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

export const trashService = {
  findAll: async (params?: { search?: string; entity_type?: string; page?: number; limit?: number }): Promise<TrashResponse> => {
    const res = await api.get("/trash", { params });
    return res.data;
  },

  restore: async (entityType: string, id: string): Promise<any> => {
    const res = await api.post(`/trash/${entityType}/${id}/restore`);
    return res.data;
  },

  permanentDelete: async (entityType: string, id: string): Promise<any> => {
    const res = await api.delete(`/trash/${entityType}/${id}`);
    return res.data;
  },
};
