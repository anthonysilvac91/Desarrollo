import { PrismaClient, Role, WorkerEditPolicy } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando DB Seed para MVP (Autenticado Real)...');
  
  // Limpieza en cascada (inverso a dependencias)
  await prisma.clientAssetAccess.deleteMany();
  await prisma.serviceAttachment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const hashedPwd = await bcrypt.hash('password123', 10);

  // 1. SUPER ADMIN GLOBAL
  const superAdmin = await prisma.user.create({
    data: { role: Role.SUPER_ADMIN, email: 'sys@recall.app', password_hash: hashedPwd, name: 'Sistema Recall' },
  });
  console.log(`[SYS] Creado Super Admin (sys@recall.app)`);

  // --- ORGANIZACIÓN 1: OCEANIC YACHTS ---
  const orgOceanic = await prisma.organization.create({
    data: {
      name: 'Oceanic Yacht Management',
      slug: 'oceanic-yachts',
      auto_publish_services: true, 
      worker_edit_policy: WorkerEditPolicy.TIME_WINDOW,
    },
  });

  const oAdmin = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.ADMIN, email: 'admin@oceanic.app', password_hash: hashedPwd, name: 'Marina Admin' },
  });
  const oWorker1 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.WORKER, email: 'roberto@oceanic.app', password_hash: hashedPwd, name: 'Roberto (Mecánico)' },
  });
  const oWorker2 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.WORKER, email: 'carlos@oceanic.app', password_hash: hashedPwd, name: 'Carlos (Detailing)' },
  });
  const oClient1 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.CLIENT, email: 'owner.a@mail.com', password_hash: hashedPwd, name: 'Eduardo Dueño A' },
  });
  const oClient2 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.CLIENT, email: 'owner.b@mail.com', password_hash: hashedPwd, name: 'Andrés Dueño B' },
  });

  const oAsset1 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Lady Nelly' } });
  const oAsset2 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Azimut 58' } });
  const oAsset3 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Naomi' } });
  const oAsset4 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Verve 42' } });
  const oAsset5 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Sea Ray 320' } });

  // Asignaciones
  await prisma.clientAssetAccess.create({ data: { client_id: oClient1.id, asset_id: oAsset2.id, granted_by_id: oAdmin.id } });
  await prisma.clientAssetAccess.create({ data: { client_id: oClient1.id, asset_id: oAsset4.id, granted_by_id: oAdmin.id } });
  await prisma.clientAssetAccess.create({ data: { client_id: oClient2.id, asset_id: oAsset1.id, granted_by_id: oAdmin.id } });

  console.log(`[ORG] Creada Org 1: Oceanic Yachts (5 yates, 5 usuarios)`);

  // --- ORGANIZACIÓN 2: HORIZON BOAT SERVICES ---
  const orgHorizon = await prisma.organization.create({
    data: {
      name: 'Horizon Boat Services',
      slug: 'horizon-services',
      auto_publish_services: false, 
      worker_edit_policy: WorkerEditPolicy.UNTIL_PUBLISHED,
    },
  });

  const hAdmin = await prisma.user.create({
    data: { organization_id: orgHorizon.id, role: Role.ADMIN, email: 'admin@horizon.app', password_hash: hashedPwd, name: 'Gerente Horizon' },
  });
  const hWorker1 = await prisma.user.create({
    data: { organization_id: orgHorizon.id, role: Role.WORKER, email: 'felipe@horizon.app', password_hash: hashedPwd, name: 'Felipe (Inspector)' },
  });
  const hWorker2 = await prisma.user.create({
    data: { organization_id: orgHorizon.id, role: Role.WORKER, email: 'miguel@horizon.app', password_hash: hashedPwd, name: 'Miguel (Técnico)' },
  });
  const hClient1 = await prisma.user.create({
    data: { organization_id: orgHorizon.id, role: Role.CLIENT, email: 'fleet@charter.com', password_hash: hashedPwd, name: 'Empresa Charter A' },
  });
  const hClient2 = await prisma.user.create({
    data: { organization_id: orgHorizon.id, role: Role.CLIENT, email: 'owner@mail.com', password_hash: hashedPwd, name: 'Dueño Independiente' },
  });

  const hAsset1 = await prisma.asset.create({ data: { organization_id: orgHorizon.id, name: 'Boston Whaler 28' } });
  const hAsset2 = await prisma.asset.create({ data: { organization_id: orgHorizon.id, name: 'Regulator 31' } });
  const hAsset3 = await prisma.asset.create({ data: { organization_id: orgHorizon.id, name: 'Contender 39' } });

  await prisma.clientAssetAccess.create({ data: { client_id: hClient1.id, asset_id: hAsset1.id, granted_by_id: hAdmin.id } });
  await prisma.clientAssetAccess.create({ data: { client_id: hClient1.id, asset_id: hAsset2.id, granted_by_id: hAdmin.id } });
  await prisma.clientAssetAccess.create({ data: { client_id: hClient1.id, asset_id: hAsset3.id, granted_by_id: hAdmin.id } });
  
  console.log(`[ORG] Creada Org 2: Horizon Services (3 lanchas, 5 usuarios)`);

  // --- HISTORIAL DE SERVICIOS (DATA SINTÉTICA DISTRIBUIDA EN 45 DIAS) ---
  const serviceTemplates = [
    { title: 'Lavado General exterior', desc: 'Lavado con jabón marino, teca y secado total', isPublic: true },
    { title: 'Mantenimiento Preventivo', desc: 'Revisión mensual de líquidos y encendido', isPublic: true },
    { title: 'Pulido parcial', desc: 'Detallado en proa y costado de estribor', isPublic: true },
    { title: 'Falla bomba reportada', desc: 'Bomba de sentina bloqueada, requiere cotización repuesto', isPublic: false },
    { title: 'Inspección de sistemas', desc: 'Sistemas ok, baterías a 12.8v', isPublic: true },
    { title: 'Limpieza de interiores', desc: 'Aspirado y desinfección de cabinas', isPublic: true },
    { title: 'Anotación Facturación', desc: 'Se gastaron 2 galones de desengrasante, facturar 1 hora extra', isPublic: false },
    { title: 'Arrancada de prueba', desc: 'Calentamiento de máquinas sin ruidos extraños', isPublic: true },
  ];

  const createRandomServices = async (orgId: string, assets: any[], workers: any[], count: number) => {
    for (let i = 0; i < count; i++) {
        const randTemplate = serviceTemplates[Math.floor(Math.random() * serviceTemplates.length)];
        const randAsset = assets[Math.floor(Math.random() * assets.length)];
        const randWorker = workers[Math.floor(Math.random() * workers.length)];
        
        // Random past 45 days
        const randomDaysAgo = Math.floor(Math.random() * 45); 
        const date = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);

        await prisma.service.create({
            data: {
                organization_id: orgId,
                asset_id: randAsset.id,
                worker_id: randWorker.id,
                title: randTemplate.title,
                description: randTemplate.desc,
                is_public: randTemplate.isPublic,
                created_at: date
            }
        });
    }
  };

  await createRandomServices(orgOceanic.id, [oAsset1, oAsset2, oAsset3, oAsset4, oAsset5], [oWorker1, oWorker2], 25);
  await createRandomServices(orgHorizon.id, [hAsset1, hAsset2, hAsset3], [hWorker1, hWorker2], 15);

  console.log(`[DATA] Inyectados 40 servicios históricos aleatorios a lo largo de 45 días\n`);

  console.log('\n=========================================');
  console.log(' SEED MVP COMPLETADO CON EXITO');
  console.log('=========================================');
  console.log('=== CREDENCIALES DE ACCESO GLOBALES ===');
  console.log('Password para todas las cuentas: password123\n');
  console.log(' [SUPER ADMIN]');
  console.log(' sys@recall.app\n');
  console.log(' [OCEANIC YACHTS]');
  console.log(' admin@oceanic.app');
  console.log(' roberto@oceanic.app (Worker)');
  console.log(' owner.a@mail.com (Client)\n');
  console.log(' [HORIZON SERVICES]');
  console.log(' admin@horizon.app');
  console.log(' felipe@horizon.app (Worker)');
  console.log(' fleet@charter.com (Client)');
  console.log('=========================================\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
