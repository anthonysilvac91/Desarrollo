import { UsersController } from './users.controller';

describe('UsersController contract', () => {
  const usersService = {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateOwnProfile: jest.fn(),
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
      'EXTERNAL',
      undefined,
      undefined,
      { search: 'ana', page: 1, limit: 10 },
    );

    expect(result).toEqual([]);
    expect(usersService.findAll).toHaveBeenCalledWith(
      {
        role: 'EXTERNAL',
        organizationId: undefined,
        search: 'ana',
        page: 1,
        limit: 10,
      },
      { id: 'u-1', role: 'ADMIN', orgId: 'org-1' },
    );
  });

  it('permite actualizar el perfil propio sin exigir rol admin', async () => {
    const controller = new UsersController(usersService);
    const req = { user: { role: 'WORKER', id: 'u-1', orgId: 'org-1' } };
    const dto = { name: 'Ana', email: 'ana@test.com' };
    usersService.updateOwnProfile.mockResolvedValue({ id: 'u-1', ...dto });

    const result = await controller.updateMe(dto, req);

    expect(result).toEqual({ id: 'u-1', ...dto });
    expect(usersService.updateOwnProfile).toHaveBeenCalledWith(
      { id: 'u-1', role: 'WORKER', orgId: 'org-1' },
      dto,
      undefined,
    );
  });
});
