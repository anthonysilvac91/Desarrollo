import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AssetsController } from './assets.controller';

describe('AssetsController public route contract', () => {
  it('uses owner routes and does not expose companies/clients routes', () => {
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
    expect(routes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ path: ':id/companies/:companyId' }),
      expect.objectContaining({ path: ':id/clients/:clientId' }),
    ]));
  });

  it('assigns and removes owners through the canonical service calls', () => {
    const assetsService = {
      assignCompany: jest.fn().mockReturnValue({ id: 'asset-1', owner_id: 'owner-1' }),
      removeCompany: jest.fn().mockReturnValue({ id: 'asset-1', owner_id: 'owner-1' }),
    } as any;
    const controller = new AssetsController(assetsService);
    const req = { user: { role: 'ADMIN', orgId: 'org-1' } };

    expect(controller.assignOwner('asset-1', 'owner-1', req)).toEqual({ id: 'asset-1', owner_id: 'owner-1' });
    expect(controller.removeOwner('asset-1', 'owner-1', req)).toEqual({ id: 'asset-1', owner_id: 'owner-1' });
    expect(assetsService.assignCompany).toHaveBeenCalledWith('asset-1', 'owner-1', 'org-1');
    expect(assetsService.removeCompany).toHaveBeenCalledWith('asset-1', 'owner-1', 'org-1');
  });
});
