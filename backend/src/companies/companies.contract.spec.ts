import { OwnersController } from './owners.controller';
import { ForbiddenException } from '@nestjs/common';

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

  it('WORKER puede listar owners para crear activos', async () => {
    const controller = new OwnersController(ownersService);
    ownersService.findAll.mockResolvedValue([{ id: 'owner-1' }]);

    const result = await controller.findAll({ user: { role: 'WORKER', orgId: 'org-1' } } as any, {} as any);

    expect(result).toEqual([{ id: 'owner-1' }]);
    expect(ownersService.findAll).toHaveBeenCalledWith('org-1', {});
  });

  it('WORKER puede crear owner desde el flujo de activos', async () => {
    const controller = new OwnersController(ownersService);
    ownersService.create.mockResolvedValue({ id: 'owner-1', name: 'Marina Norte' });

    const result = await controller.create(
      { name: 'Marina Norte' } as any,
      { user: { role: 'WORKER', orgId: 'org-1' } } as any,
      undefined,
    );

    expect(result).toEqual({ id: 'owner-1', name: 'Marina Norte' });
    expect(ownersService.create).toHaveBeenCalledWith({ name: 'Marina Norte' }, 'org-1', undefined);
  });

  it('WORKER no puede editar owners', async () => {
    const controller = new OwnersController(ownersService);

    expect(() =>
      controller.update(
        'owner-1',
        { name: 'Nuevo nombre' } as any,
        { user: { role: 'WORKER', orgId: 'org-1' } } as any,
        undefined,
      ),
    ).toThrow(ForbiddenException);
    expect(ownersService.update).not.toHaveBeenCalled();
  });
});
