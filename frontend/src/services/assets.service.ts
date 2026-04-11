import api from "@/lib/api";

export interface Asset {
  id: string;
  name: string;
  description?: string;
  category?: string;
  location?: string;
  thumbnail_url?: string;
  client?: {
    name: string;
    action_type?: string; // Subtext for client column in Figma
  };
  last_job?: {
    date: string;
    type?: string;
  };
}

export const assetsService = {
  findAll: async (): Promise<Asset[]> => {
    const res = await api.get("/assets");
    return res.data;
  },
  
  findOne: async (id: string): Promise<Asset> => {
    const res = await api.get(`/assets/${id}`);
    return res.data;
  },

  create: async (data: Partial<Asset>) => {
    const res = await api.post("/assets", data);
    return res.data;
  }
};
