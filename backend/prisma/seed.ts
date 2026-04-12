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

  const asset1 = await prisma.asset.create({ data: { organization_id: org.id, name: 'Lady Nelly' } });
  const asset2 = await prisma.asset.create({ data: { organization_id: org.id, name: 'Azimut 58' } });
  const asset3 = await prisma.asset.create({ data: { organization_id: org.id, name: 'Naomi' } });
  const asset4 = await prisma.asset.create({ data: { organization_id: org.id, name: 'Verve 42' } });
  
  await prisma.clientAssetAccess.create({ data: { client_id: client.id, asset_id: asset1.id, granted_by_id: admin.id } });
  await prisma.clientAssetAccess.create({ data: { client_id: client.id, asset_id: asset2.id, granted_by_id: admin.id } });

  // Crear algunos trabajos viejos
  await prisma.job.createMany({
    data: [
      { organization_id: org.id, asset_id: asset1.id, worker_id: worker.id, title: 'Mantenimiento Motor', description: 'Revisión mensual realizada sin problemas.', is_public: true, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      { organization_id: org.id, asset_id: asset1.id, worker_id: worker.id, title: 'Limpieza Teca', description: 'Se lavó la teca completa del exterior.', is_public: true, created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { organization_id: org.id, asset_id: asset2.id, worker_id: worker.id, title: 'Cambio baterias', is_public: true, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
      { organization_id: org.id, asset_id: asset3.id, worker_id: worker.id, title: 'Lavada barco', is_public: true, created_at: new Date(Date.now() - 12 * 60 * 60 * 1000) },
    ]
  });

  console.log('\n--- RECALL MVP SEED Completado ---');
  console.log(`organizationId universal: "${org.id}"\n`);
  console.log(`ADMIN  -> admin@test.com  | 123456`);
  console.log(`WORKER -> worker@test.com | 123456`);
  console.log(`CLIENT -> client@test.com | 123456\n`);
  console.log('Ingresa estos datos en POST /auth/login para obtener tu Token y usar el botón "Authorize" en Swagger.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
