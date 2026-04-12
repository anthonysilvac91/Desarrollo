import api from "@/lib/api";

export interface JobAttachment {
  id: string;
  file_url: string;
  file_type?: string;
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  attachments: JobAttachment[];
  worker: { name: string; id: string };
}

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
  jobs?: Job[];
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
