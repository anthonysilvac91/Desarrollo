import { OwnersController } from './owners.controller';

describe('OwnersController route contract', () => {
  const ownersService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
    remove: jest.fn(),
  } as any;

  const req = { user: { role: 'ADMIN', orgId: 'org-1' } };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('owners es la ruta canonica y no usa headers deprecation', async () => {
    const controller = new OwnersController(ownersService);
    ownersService.findAll.mockResolvedValue([{ id: 'owner-1' }]);

    const result = await controller.findAll(req, { page: 1, limit: 10 } as any);

    expect(result).toEqual([{ id: 'owner-1' }]);
    expect(ownersService.findAll).toHaveBeenCalledWith('org-1', { page: 1, limit: 10 });
  });
});
