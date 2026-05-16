import { CompaniesController } from './companies.controller';
import { CustomersLegacyController } from './customers-legacy.controller';
import { OwnersController } from './owners.controller';
import { LEGACY_SUNSET } from '../common/http/legacy-api';

describe('Company route contract', () => {
  const companiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  } as any;

  const req = { user: { role: 'ADMIN', orgId: 'org-1' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owners es la ruta canonica y no usa headers deprecation', async () => {
    const controller = new OwnersController(companiesService);
    companiesService.findAll.mockResolvedValue([{ id: 'owner-1' }]);

    const result = await controller.findAll(req, { page: 1, limit: 10 } as any);

    expect(result).toEqual([{ id: 'owner-1' }]);
    expect(companiesService.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });

  it('companies legacy marca deprecation y sunset', async () => {
    const controller = new CompaniesController(companiesService);
    companiesService.findAll.mockResolvedValue([{ id: 'company-1' }]);
    const res = { setHeader: jest.fn() } as any;

    const result = await controller.findAll(req, { page: 1, limit: 10 } as any, res);

    expect(result).toEqual([{ id: 'company-1' }]);
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', LEGACY_SUNSET);
  });

  it('customers legacy marca deprecation y sunset', async () => {
    const controller = new CustomersLegacyController(companiesService);
    companiesService.findAll.mockResolvedValue([{ id: 'customer-1' }]);
    const res = { setHeader: jest.fn() } as any;

    const result = await controller.findAll(req, { page: 1, limit: 10 } as any, res);

    expect(result).toEqual([{ id: 'customer-1' }]);
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', LEGACY_SUNSET);
  });
});
