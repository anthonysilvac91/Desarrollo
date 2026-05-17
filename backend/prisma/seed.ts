import { PrismaClient, Role, ServiceStatus, WorkerEditPolicy } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando DB Seed para modelo Owner/EXTERNAL...');

  // Limpieza en cascada inversa a dependencias.
  await prisma.serviceAttachment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.workerAssetAccess.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.organization.deleteMany();

  const hashedPwd = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      role: Role.SUPER_ADMIN,
      email: 'sys@recall.app',
      password_hash: hashedPwd,
      name: 'Sistema Recall',
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: 'Oceanic Yacht Management',
      slug: 'oceanic-yachts',
      auto_publish_services: true,
      worker_edit_policy: WorkerEditPolicy.TIME_WINDOW,
    },
  });

  const charterOwner = await prisma.owner.create({
    data: {
      organization_id: organization.id,
      name: 'Empresa Charter Balear',
    },
  });

  const privateOwner = await prisma.owner.create({
    data: {
      organization_id: organization.id,
      name: 'Yacht Owners Group',
    },
  });

  await prisma.user.create({
    data: {
      organization_id: organization.id,
      role: Role.ADMIN,
      email: 'admin@oceanic.app',
      password_hash: hashedPwd,
      name: 'Marina Admin',
    },
  });

  const workerA = await prisma.user.create({
    data: {
      organization_id: organization.id,
      role: Role.WORKER,
      email: 'roberto@oceanic.app',
      password_hash: hashedPwd,
      name: 'Roberto Mecanico',
    },
  });

  const workerB = await prisma.user.create({
    data: {
      organization_id: organization.id,
      role: Role.WORKER,
      email: 'carlos@oceanic.app',
      password_hash: hashedPwd,
      name: 'Carlos Detailing',
    },
  });

  await prisma.user.create({
    data: {
      organization_id: organization.id,
      owner_id: charterOwner.id,
      role: Role.EXTERNAL,
      email: 'gestor.charter@mail.com',
      password_hash: hashedPwd,
      name: 'Eduardo Gestor Charter',
    },
  });

  await prisma.user.create({
    data: {
      organization_id: organization.id,
      owner_id: privateOwner.id,
      role: Role.EXTERNAL,
      email: 'propietario@mail.com',
      password_hash: hashedPwd,
      name: 'Andres Owner Naomi',
    },
  });

  const assets = await Promise.all([
    prisma.asset.create({
      data: { organization_id: organization.id, owner_id: privateOwner.id, name: 'Lady Nelly' },
    }),
    prisma.asset.create({
      data: { organization_id: organization.id, owner_id: charterOwner.id, name: 'Azimut 58' },
    }),
    prisma.asset.create({
      data: { organization_id: organization.id, owner_id: charterOwner.id, name: 'Naomi' },
    }),
    prisma.asset.create({
      data: { organization_id: organization.id, owner_id: privateOwner.id, name: 'Verve 42' },
    }),
  ]);

  const serviceTemplates = [
    { title: 'Lavado general exterior', desc: 'Lavado con jabon marino, teca y secado total', isPublic: true },
    { title: 'Mantenimiento preventivo', desc: 'Revision mensual de liquidos y encendido', isPublic: true },
    { title: 'Pulido parcial', desc: 'Detallado en proa y costado de estribor', isPublic: true },
    { title: 'Falla bomba reportada', desc: 'Bomba de sentina bloqueada, requiere cotizacion de repuesto', isPublic: false },
    { title: 'Inspeccion de sistemas', desc: 'Sistemas ok, baterias a 12.8v', isPublic: true },
  ];

  const workers = [workerA, workerB];

  for (let i = 0; i < 20; i++) {
    const template = serviceTemplates[i % serviceTemplates.length];
    const asset = assets[i % assets.length];
    const worker = workers[i % workers.length];
    const createdAt = new Date(Date.now() - i * 24 * 60 * 60 * 1000);

    await prisma.service.create({
      data: {
        organization_id: organization.id,
        asset_id: asset.id,
        worker_id: worker.id,
        title: template.title,
        description: template.desc,
        is_public: template.isPublic,
        status: ServiceStatus.COMPLETED,
        created_at: createdAt,
      },
    });
  }

  console.log('=========================================');
  console.log(' SEED OWNER/EXTERNAL COMPLETADO CON EXITO');
  console.log('=========================================');
  console.log('Password global: password123');
  console.log(' [SUPER ADMIN]: sys@recall.app');
  console.log(' [ADMIN OCEANIC]: admin@oceanic.app');
  console.log(' [WORKER OCEANIC]: roberto@oceanic.app');
  console.log(' [EXTERNAL CHARTER]: gestor.charter@mail.com');
  console.log(' [EXTERNAL OWNER]: propietario@mail.com');
  console.log('=========================================');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
