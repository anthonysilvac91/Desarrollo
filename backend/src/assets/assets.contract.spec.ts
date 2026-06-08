import { ForbiddenException, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AssetsController } from './assets.controller';

describe('AssetsController public route contract', () => {
  it('uses owner routes and does not expose legacy routes', () => {
    const controllerPath = Reflect.getMetadata(PATH_METADATA, AssetsController);
    const routes = Object.getOwnPropertyNames(AssetsController.prototype)
      .filter((name) => name !== 'constructor')
      .map((name) => ({
        path: Reflect.getMetadata(PATH_METADATA, AssetsController.prototype[name]),
        method: Reflect.getMetadata(METHOD_METADATA, AssetsController.prototype[name]),
      }))
      .filter((route) => route.path);

    expect(controllerPath).toBe('assets');
    expect(routes).toEqual(expect.arrayContaining([
      { path: ':id/owners/:ownerId', method: RequestMethod.POST },
      { path: ':id/owners/:ownerId', method: RequestMethod.DELETE },
    ]));
  });

  it('EXTERNAL recibe ForbiddenException al intentar crear activo', () => {
    const assetsService = { create: jest.fn() } as any;
    const controller = new AssetsController(assetsService);
    const req = { user: { role: 'EXTERNAL', orgId: 'org-1' } };

    expect(() => controller.create({} as any, req as any, undefined)).toThrow(ForbiddenException);
    expect(assetsService.create).not.toHaveBeenCalled();
  });

  it('assigns and removes owners through the canonical service calls', () => {
    const assetsService = {
      assignOwner: jest.fn().mockReturnValue({ id: 'asset-1', owner_id: 'owner-1' }),
      removeOwner: jest.fn().mockReturnValue({ id: 'asset-1', owner_id: 'owner-1' }),
    } as any;
    const controller = new AssetsController(assetsService);
    const req = { user: { role: 'ADMIN', orgId: 'org-1' } };

    expect(controller.assignOwner('asset-1', 'owner-1', req)).toEqual({ id: 'asset-1', owner_id: 'owner-1' });
    expect(controller.removeOwner('asset-1', 'owner-1', req)).toEqual({ id: 'asset-1', owner_id: 'owner-1' });
    expect(assetsService.assignOwner).toHaveBeenCalledWith('asset-1', 'owner-1', 'org-1');
    expect(assetsService.removeOwner).toHaveBeenCalledWith('asset-1', 'owner-1', 'org-1');
  });

  it('delega filter-options al servicio con tenant y rol', () => {
    const assetsService = {
      getFilterOptions: jest.fn().mockReturnValue({ owners: [] }),
    } as any;
    const controller = new AssetsController(assetsService);
    const req = { user: { role: 'WORKER', orgId: 'org-1', owner_id: undefined } };

    expect(controller.getFilterOptions(req)).toEqual({ owners: [] });
    expect(assetsService.getFilterOptions).toHaveBeenCalledWith('org-1', 'WORKER', undefined);
  });
});
