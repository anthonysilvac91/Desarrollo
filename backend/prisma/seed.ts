import { PrismaClient, Role, WorkerEditPolicy } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando DB Seed para MVP (Autenticado Real)...');
  
  // Limpiamos base para que el db push reset fluya limpio con la seed
  await prisma.clientAssetAccess.deleteMany();
  await prisma.jobAttachment.deleteMany();
  await prisma.job.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: 'Empresa Test',
      auto_publish_jobs: true, 
      worker_edit_policy: WorkerEditPolicy.TIME_WINDOW,
    },
  });

  const hashedPwd = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: { organization_id: org.id, role: Role.ADMIN, email: 'admin@test.com', password_hash: hashedPwd, name: 'Alfonso Admin' },
  });

  const worker = await prisma.user.create({
    data: { organization_id: org.id, role: Role.WORKER, email: 'worker@test.com', password_hash: hashedPwd, name: 'Omar Operario' },
  });

  const client = await prisma.user.create({
    data: { organization_id: org.id, role: Role.CLIENT, email: 'client@test.com', password_hash: hashedPwd, name: 'Carlos Cliente' },
  });

  const asset = await prisma.asset.create({
    data: { organization_id: org.id, name: 'Tractor T-1000' },
  });
  
  await prisma.clientAssetAccess.create({
    data: { client_id: client.id, asset_id: asset.id, granted_by_id: admin.id }
  });

  console.log('\n--- RECALL MVP SEED Completado ---');
  console.log(`organizationId universal: "${org.id}"\n`);
  console.log(`ADMIN  -> admin@test.com  | 123456`);
  console.log(`WORKER -> worker@test.com | 123456`);
  console.log(`CLIENT -> client@test.com | 123456\n`);
  console.log('Ingresa estos datos en POST /auth/login para obtener tu Token y usar el botón "Authorize" en Swagger.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
