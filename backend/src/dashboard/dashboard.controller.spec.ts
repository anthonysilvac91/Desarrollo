import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  it('pasa owner_id del JWT al servicio', () => {
    const dashboardService = {
      getStats: jest.fn(),
    } as unknown as DashboardService;
    const controller = new DashboardController(dashboardService);

    controller.getStats(undefined as any, undefined as any, undefined as any, {
      user: {
        id: 'external-1',
        role: 'EXTERNAL',
        orgId: 'org-1',
        owner_id: 'owner-1',
      },
    });

    expect(dashboardService.getStats).toHaveBeenCalledWith(
      {
        id: 'external-1',
        role: 'EXTERNAL',
        orgId: 'org-1',
        owner_id: 'owner-1',
      },
      undefined,
      { startDate: undefined, endDate: undefined },
    );
  });
});
