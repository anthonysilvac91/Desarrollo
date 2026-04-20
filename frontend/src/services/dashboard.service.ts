import api from "@/lib/api";

export interface DashboardStats {
  total_assets: number;
  total_services: number;
  total_workers: number;
  total_clients: number;
  total_admins: number;
  public_services: number;
  private_services: number;
  recent_services: Array<{
    id: string;
    title: string;
    created_at: string;
    asset_name: string;
    worker_name: string;
  }>;
  evolution: Array<{ name: string; value: number }>;
  top_assets: Array<{ id: string; name: string; metric: number }>;
  top_workers: Array<{ id: string; name: string; metric: number; avatar_url?: string }>;
}

export const dashboardService = {
  async getStats(args?: { organizationId?: string; startDate?: string; endDate?: string }): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (args?.organizationId) params.append("organizationId", args.organizationId);
    if (args?.startDate) params.append("startDate", args.startDate);
    if (args?.endDate) params.append("endDate", args.endDate);
    
    const response = await api.get<DashboardStats>(`/dashboard?${params.toString()}`);
    return response.data;
  },
};
