import { ForbiddenException } from '@nestjs/common';
import { ServicesController } from './services.controller';

describe('ServicesController contract', () => {
  it('EXTERNAL recibe ForbiddenException al intentar registrar un servicio', () => {
    const servicesService = { create: jest.fn() } as any;
    const controller = new ServicesController(servicesService);
    const req = { user: { role: 'EXTERNAL', orgId: 'org-1' } };

    expect(() => controller.create({} as any, req as any, [])).toThrow(ForbiddenException);
    expect(servicesService.create).not.toHaveBeenCalled();
  });

  it('WORKER puede llamar create() sin error de rol', () => {
    const servicesService = { create: jest.fn().mockReturnValue({}) } as any;
    const controller = new ServicesController(servicesService);
    const req = { user: { role: 'WORKER', orgId: 'org-1', id: 'worker-1' } };

    expect(() => controller.create({} as any, req as any, [])).not.toThrow();
    expect(servicesService.create).toHaveBeenCalled();
  });

  it('ADMIN puede llamar create() sin error de rol', () => {
    const servicesService = { create: jest.fn().mockReturnValue({}) } as any;
    const controller = new ServicesController(servicesService);
    const req = { user: { role: 'ADMIN', orgId: 'org-1', id: 'admin-1' } };

    expect(() => controller.create({} as any, req as any, [])).not.toThrow();
    expect(servicesService.create).toHaveBeenCalled();
  });

  it('SUPER_ADMIN puede llamar create() sin error de rol', () => {
    const servicesService = { create: jest.fn().mockReturnValue({}) } as any;
    const controller = new ServicesController(servicesService);
    const req = { user: { role: 'SUPER_ADMIN', orgId: null, id: 'sa-1' } };

    expect(() => controller.create({} as any, req as any, [])).not.toThrow();
    expect(servicesService.create).toHaveBeenCalled();
  });
});
