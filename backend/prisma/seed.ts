import { PrismaClient, Role, WorkerEditPolicy } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando DB Seed para MVP (Estructura B2B)...');
  
  // Limpieza en cascada (inverso a dependencias)
  await prisma.serviceAttachment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
  await prisma.organization.deleteMany();

  const hashedPwd = await bcrypt.hash('password123', 10);

  // 1. SUPER ADMIN GLOBAL
  await prisma.user.create({
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

  // Clientes Corporativos de Oceanic
  const oceanicCompanyA = await prisma.company.create({
    data: { name: 'Empresa Charter Balear', organization_id: orgOceanic.id }
  });
  const oceanicCompanyB = await prisma.company.create({
    data: { name: 'Yacht Owners Group', organization_id: orgOceanic.id }
  });

  // Usuarios de Oceanic
  await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.ADMIN, email: 'admin@oceanic.app', password_hash: hashedPwd, name: 'Marina Admin' },
  });
  const oWorker1 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.WORKER, email: 'roberto@oceanic.app', password_hash: hashedPwd, name: 'Roberto (Mecánico)' },
  });
  const oWorker2 = await prisma.user.create({
    data: { organization_id: orgOceanic.id, role: Role.WORKER, email: 'carlos@oceanic.app', password_hash: hashedPwd, name: 'Carlos (Detailing)' },
  });

  // Usuarios Clientes vinculados a Empresa
  await prisma.user.create({
    data: { 
      organization_id: orgOceanic.id, 
      company_id: oceanicCompanyA.id, 
      role: Role.CLIENT, 
      email: 'gestor.charter@mail.com', 
      password_hash: hashedPwd, 
      name: 'Eduardo (Gestor Charter)' 
    },
  });
  await prisma.user.create({
    data: { 
      organization_id: orgOceanic.id, 
      company_id: oceanicCompanyB.id, 
      role: Role.CLIENT, 
      email: 'propietario@mail.com', 
      password_hash: hashedPwd, 
      name: 'Andrés (Dueño Naomi)' 
    },
  });

  // Activos vinculados a Empresa
  const oAsset1 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, company_id: oceanicCompanyB.id, name: 'Lady Nelly' } });
  const oAsset2 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, company_id: oceanicCompanyA.id, name: 'Azimut 58' } });
  const oAsset3 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, company_id: oceanicCompanyA.id, name: 'Naomi' } });
  const oAsset4 = await prisma.asset.create({ data: { organization_id: orgOceanic.id, name: 'Verve 42' } }); // Sin empresa asignada (Stock)

  console.log(`[ORG] Creada Org 1: Oceanic Yachts (4 yates, 2 empresas clientes)`);

  // --- HISTORIAL DE SERVICIOS ---
  const serviceTemplates = [
    { title: 'Lavado General exterior', desc: 'Lavado con jabón marino, teca y secado total', isPublic: true },
    { title: 'Mantenimiento Preventivo', desc: 'Revisión mensual de líquidos y encendido', isPublic: true },
    { title: 'Pulido parcial', desc: 'Detallado en proa y costado de estribor', isPublic: true },
    { title: 'Falla bomba reportada', desc: 'Bomba de sentina bloqueada, requiere cotización repuesto', isPublic: false },
    { title: 'Inspección de sistemas', desc: 'Sistemas ok, baterías a 12.8v', isPublic: true },
  ];

  const createRandomServices = async (orgId: string, assets: any[], workers: any[], count: number) => {
    for (let i = 0; i < count; i++) {
        const randTemplate = serviceTemplates[Math.floor(Math.random() * serviceTemplates.length)];
        const randAsset = assets[Math.floor(Math.random() * assets.length)];
        const randWorker = workers[Math.floor(Math.random() * workers.length)];
        const randomDaysAgo = Math.floor(Math.random() * 30); 
        const date = new Date(Date.now() - randomDaysAgo * 24 * 60 * 60 * 1000);

        await prisma.service.create({
            data: {
                organization_id: orgId,
                asset_id: randAsset.id,
                worker_id: randWorker.id,
                title: randTemplate.title,
                description: randTemplate.desc,
                is_public: randTemplate.isPublic,
                status: 'COMPLETED',
                created_at: date
            }
        });
    }
  };

  await createRandomServices(orgOceanic.id, [oAsset1, oAsset2, oAsset3, oAsset4], [oWorker1, oWorker2], 20);

  console.log(`[DATA] Inyectados servicios históricos\n`);

  console.log('=========================================');
  console.log(' SEED B2B COMPLETADO CON EXITO');
  console.log('=========================================');
  console.log('Password global: password123\n');
  console.log(' [ADMIN OCEANIC]: admin@oceanic.app');
  console.log(' [CLIENTE CHARTER]: gestor.charter@mail.com');
  console.log(' [CLIENTE OWNERS]: propietario@mail.com');
  console.log('=========================================\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
