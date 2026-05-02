import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  it('pasa company_id/customer_id del JWT al servicio', () => {
    const dashboardService = {
      getStats: jest.fn(),
    } as unknown as DashboardService;
    const controller = new DashboardController(dashboardService);

    controller.getStats(
      undefined as any,
      undefined as any,
      undefined as any,
      {
        user: {
          id: 'client-1',
          role: 'CLIENT',
          orgId: 'org-1',
          company_id: 'company-1',
          customer_id: 'company-1',
        },
      },
    );

    expect(dashboardService.getStats).toHaveBeenCalledWith(
      {
        id: 'client-1',
        role: 'CLIENT',
        orgId: 'org-1',
        company_id: 'company-1',
        customer_id: 'company-1',
      },
      undefined,
      { startDate: undefined, endDate: undefined },
    );
  });
});
