import { authService } from "./auth.service";

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
}

export const dashboardService = {
  async getStats(organizationId?: string): Promise<DashboardStats> {
    const query = organizationId ? `?organizationId=${organizationId}` : "";
    const response = await authService.fetchWithAuth(`/dashboard${query}`);
    if (!response.ok) {
      throw new Error("Failed to fetch dashboard stats");
    }
    return response.json();
  },
};
