import api from "@/lib/api";

export const jobsService = {
  findAll: async () => {
    const res = await api.get("/jobs");
    return res.data;
  },
  findOne: async (id: string) => {
    const res = await api.get(`/jobs/${id}`);
    return res.data;
  },
  update: async (id: string, data: any) => {
    const res = await api.patch(`/jobs/${id}`, data);
    return res.data;
  },
};
