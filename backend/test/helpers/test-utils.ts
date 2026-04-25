import { PrismaService } from '../../src/prisma/prisma.service';
import { Role, WorkerEditPolicy } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

export class TestUtils {
  constructor(private prisma: PrismaService, private jwtService?: JwtService) {}

  /**
   * Limpieza agresiva de todas las tablas dependientes en el orden inverso
   * estricto de restricciones ForeignKey (FK)
   */
  async clearDatabase() {
    await this.prisma.$transaction([
      this.prisma.serviceAttachment.deleteMany(),
      this.prisma.service.deleteMany(),
      this.prisma.workerAssetAccess.deleteMany(),
      this.prisma.invitation.deleteMany(),
      this.prisma.asset.deleteMany(),
      this.prisma.user.deleteMany(),
      this.prisma.customer.deleteMany(),
      this.prisma.organization.deleteMany(),
    ]);
  }

  /**
   * Genera una organización de prueba y retorna la entidad.
   */
  async createTestOrganization(suffix: string = '1', restrictedWorker: boolean = false) {
    return this.prisma.organization.create({
      data: {
        name: `Org Test ${suffix}`,
        slug: `org-test-${suffix.toLowerCase()}`,
        worker_restricted_access: restrictedWorker,
        worker_edit_policy: WorkerEditPolicy.TIME_WINDOW,
      }
    });
  }

  /**
   * Crea un usuario con rol específico. Si no se manda orgId asume SUPER_ADMIN
   */
  async createTestUser(role: Role, email: string, orgId?: string, customerId?: string) {
    const password_hash = await bcrypt.hash('123456', 10);
    return this.prisma.user.create({
      data: {
        role,
        email,
        password_hash,
        name: `User ${role} ${email}`,
        organization_id: orgId || null,
        customer_id: customerId || null,
      }
    });
  }

  async createTestCustomer(name: string, orgId: string) {
    return this.prisma.customer.create({
      data: {
        name,
        organization_id: orgId
      }
    });
  }

  /**
   * Obtiene un Object literal válido como Token JWT para un usuario 
   */
  getBearerToken(user: any) {
    if (!this.jwtService) throw new Error('Se requiere inyectar JwtService en TestUtils');
    const payload = { sub: user.id, orgId: user.organization_id, role: user.role, customer_id: user.customer_id };
    return this.jwtService.sign(payload, { secret: process.env.JWT_SECRET || 'RECALL_TEST_STRICT_SAFE_SECRET' });
  }

  /**
   * Generar una invitación de manera directa a la base (para saltarse endpoint de creación si hace falta probar consumos)
   */
  async seedTestInvitation(orgId: string, email: string, role: Role, inviterId: string, used: boolean = false, expired: boolean = false) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    if (expired) {
      expiresAt.setDate(expiresAt.getDate() - 2);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7);
    }

    return this.prisma.invitation.create({
      data: {
        organization_id: orgId,
        email,
        role,
        token,
        invited_by_id: inviterId,
        is_used: used,
        expires_at: expiresAt,
      }
    });
  }
}
