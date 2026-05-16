import { UsersController } from './users.controller';

describe('UsersController contract', () => {
  const usersService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    toggleStatus: jest.fn(),
    findOne: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acepta el filtro EXTERNAL y lo pasa al servicio', async () => {
    const controller = new UsersController(usersService);
    const req = { user: { role: 'ADMIN', id: 'u-1', orgId: 'org-1' } };
    usersService.findAll.mockResolvedValue([]);

    const result = await controller.findAll(
      req,
      'EXTERNAL' as any,
      undefined,
      { search: 'ana', page: 1, limit: 10 } as any,
    );

    expect(result).toEqual([]);
    expect(usersService.findAll).toHaveBeenCalledWith(
      { role: 'EXTERNAL', organizationId: undefined, search: 'ana', page: 1, limit: 10 },
      { id: 'u-1', role: 'ADMIN', orgId: 'org-1' },
    );
  });
});
