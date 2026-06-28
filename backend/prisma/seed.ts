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
  await prisma.subscription.deleteMany();
  await prisma.organization.deleteMany();

  const hashedPwd = await bcrypt.hash('password123', 10);

  await prisma.user.create({
    data: {
      role: Role.SUPER_ADMIN,
      email: 'sys@fentri.app',
      password_hash: hashedPwd,
      name: 'Sistema Fentri',
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

  await prisma.subscription.create({
    data: {
      organization_id: organization.id,
      plan: 'PRO',
      status: 'ACTIVE',
      max_users: 10,
      max_assets: 500,
      max_storage_gb: 50,
      max_video_hours: 10,
      allow_external: true,
      allow_branding: false,
      allow_ai_translation: true,
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

  // ── Yates Alejandro ────────────────────────────────────────────────────────

  const orgYates = await prisma.organization.create({
    data: {
      name: 'Yates Alejandro',
      slug: 'yates-alejandro',
      auto_publish_services: true,
      worker_edit_policy: WorkerEditPolicy.TIME_WINDOW,
    },
  });

  await prisma.subscription.create({
    data: {
      organization_id: orgYates.id,
      plan: 'PRO',
      status: 'ACTIVE',
      max_users: 10,
      max_assets: 500,
      max_storage_gb: 50,
      max_video_hours: 10,
      allow_external: true,
      allow_branding: false,
      allow_ai_translation: true,
    },
  });

  const ownerYatesA = await prisma.owner.create({
    data: { organization_id: orgYates.id, name: 'Flota Privada Alejandro' },
  });

  const ownerYatesB = await prisma.owner.create({
    data: { organization_id: orgYates.id, name: 'Charter del Mediterráneo' },
  });

  await prisma.user.create({
    data: {
      organization_id: orgYates.id,
      role: Role.ADMIN,
      email: 'admin@yatesalejandro.app',
      password_hash: hashedPwd,
      name: 'Alejandro Admin',
    },
  });

  const yatesWorkerA = await prisma.user.create({
    data: {
      organization_id: orgYates.id,
      role: Role.WORKER,
      email: 'miguel@yatesalejandro.app',
      password_hash: hashedPwd,
      name: 'Miguel Técnico',
    },
  });

  const yatesWorkerB = await prisma.user.create({
    data: {
      organization_id: orgYates.id,
      role: Role.WORKER,
      email: 'pedro@yatesalejandro.app',
      password_hash: hashedPwd,
      name: 'Pedro Limpieza',
    },
  });

  const yatesWorkerC = await prisma.user.create({
    data: {
      organization_id: orgYates.id,
      role: Role.WORKER,
      email: 'lucia@yatesalejandro.app',
      password_hash: hashedPwd,
      name: 'Lucía Mecánica',
    },
  });

  const yatesBoatNames = [
    'Alba Marina', 'Tramontana', 'Levante', 'Sol de Ibiza', 'Brisa del Sur',
    'Estrella del Mar', 'Dos Mares', 'Viento Norte', 'La Sultana', 'Sirocco',
    'Coral Blue', 'Mediterráneo', 'Santa Clara', 'Isla Bonita', 'Mar Abierto',
    'Bahía Grande', 'Poniente', 'El Mirador', 'Luna de Plata', 'Altamar',
  ];

  const ownersYates = [ownerYatesA, ownerYatesB];

  const yatesAssets = await Promise.all(
    yatesBoatNames.map((name, i) =>
      prisma.asset.create({
        data: {
          organization_id: orgYates.id,
          owner_id: ownersYates[i % ownersYates.length].id,
          name,
        },
      })
    )
  );

  const yatesServiceTemplates = [
    { title: 'Lavado exterior completo',      desc: 'Lavado con jabón marino, aclarado y secado de casco y cubierta', isPublic: true },
    { title: 'Mantenimiento motor',            desc: 'Cambio de aceite, filtros y revisión de correas', isPublic: true },
    { title: 'Pulido y encerado de casco',    desc: 'Pulido en dos pasadas y aplicación de cera náutica', isPublic: true },
    { title: 'Revisión de electrónica',       desc: 'Comprobación de VHF, GPS y panel eléctrico', isPublic: true },
    { title: 'Limpieza interior cabinas',      desc: 'Limpieza profunda de camarotes, cocina y baños', isPublic: true },
    { title: 'Inspección de líneas y velas',  desc: 'Revisión de jarcias, drizas y estado general de velas', isPublic: true },
    { title: 'Antifouling',                   desc: 'Aplicación de pintura antiincrustante en obra viva', isPublic: false },
    { title: 'Falla motor reportada',         desc: 'Motor no arranca, requiere diagnóstico urgente', isPublic: false },
  ];

  const yatesWorkers = [yatesWorkerA, yatesWorkerB, yatesWorkerC];

  for (let i = 0; i < 40; i++) {
    const template = yatesServiceTemplates[i % yatesServiceTemplates.length];
    const asset    = yatesAssets[i % yatesAssets.length];
    const worker   = yatesWorkers[i % yatesWorkers.length];
    const createdAt = new Date(Date.now() - i * 18 * 60 * 60 * 1000);

    await prisma.service.create({
      data: {
        organization_id: orgYates.id,
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
  console.log(' SEED COMPLETADO CON EXITO');
  console.log('=========================================');
  console.log('Password global: password123');
  console.log(' [SUPER ADMIN]:          sys@fentri.app');
  console.log(' ── Oceanic Yacht Management ──');
  console.log(' [ADMIN]:                admin@oceanic.app');
  console.log(' [WORKER]:               roberto@oceanic.app');
  console.log(' [EXTERNAL CHARTER]:     gestor.charter@mail.com');
  console.log(' [EXTERNAL OWNER]:       propietario@mail.com');
  console.log(' ── Yates Alejandro ──');
  console.log(' [ADMIN]:                admin@yatesalejandro.app');
  console.log(' [WORKER]:               miguel@yatesalejandro.app');
  console.log(' [WORKER]:               pedro@yatesalejandro.app');
  console.log(' [WORKER]:               lucia@yatesalejandro.app');
  console.log('=========================================');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
