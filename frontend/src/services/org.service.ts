import api from "@/lib/api";

export const orgService = {
  getSettings: async () => {
    // Asumiendo que el backend retorna los settings para la org autenticada
    // Puede variar dependiendo de la ruta en el controller
    const res = await api.get("/organizations/settings");
    return res.data;
  },
  updateSettings: async (data: any) => {
    const res = await api.patch("/organizations/settings", data);
    return res.data;
  },
};
