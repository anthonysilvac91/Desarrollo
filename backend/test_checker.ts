// LEGACY: este script no representa la API actual y se conserva solo como referencia historica.
// Si se ejecuta manualmente en local, el backend oficial corre en http://localhost:3001.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const API_URL = process.env.API_URL || 'http://localhost:3001';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }});
  const worker = await prisma.user.findFirst({ where: { role: 'WORKER' }});
  const client = await prisma.user.findFirst({ where: { role: 'CLIENT' }});
  const org = await prisma.organization.findFirst();
  const asset = await prisma.asset.findFirst();

  console.log('\n--- DB State Loaded ---');
  console.log('Admin:', admin?.id);
  console.log('Worker:', worker?.id);
  console.log('Client:', client?.id);
  console.log('Org:', org?.id);
  console.log('Asset:', asset?.id);
  
  // Swagger Check
  try {
     const swRes = await fetch(`${API_URL}/api-json`);
     console.log('✅ Swagger status:', swRes.status);
  } catch(e) { console.error('❌ Swagger failed', e.message); }

  console.log('\n--- Testing WORKER creating a new Asset ---');
  let res = await fetch(`${API_URL}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': worker!.id, 'x-org-id': org!.id, 'x-role': 'WORKER' },
    body: JSON.stringify({ name: 'Generador Alpha' })
  });
  console.log('Status:', res.status, await res.json());

  console.log('\n--- Testing WORKER creating a Job ---');
  res = await fetch(`${API_URL}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': worker!.id, 'x-org-id': org!.id, 'x-role': 'WORKER' },
    body: JSON.stringify({ asset_id: asset!.id, title: 'Limpieza de filtro' })
  });
  console.log('Status:', res.status, await res.json());

  // Wait 1 second just in case DB needs a moment (it doesn't, but still)
  await new Promise(r => setTimeout(r, 1000));

  console.log('\n--- Testing ADMIN Listing Jobs ---');
  res = await fetch(`${API_URL}/jobs?asset_id=` + asset!.id, {
    method: 'GET',
    headers: { 'x-user-id': admin!.id, 'x-org-id': org!.id, 'x-role': 'ADMIN' }
  });
  const adminJobs = await res.json();
  console.log('Status:', res.status, 'Count:', adminJobs.length, adminJobs.map((j:any)=>j.title));

  console.log('\n--- Testing CLIENT Listing Jobs ---');
  res = await fetch(`${API_URL}/jobs?asset_id=` + asset!.id, {
    method: 'GET',
    headers: { 'x-user-id': client!.id, 'x-org-id': org!.id, 'x-role': 'CLIENT' }
  });
  const clientJobs = await res.json();
  console.log('Status:', res.status, 'Count:', clientJobs.length, clientJobs.map((j:any)=>j.title));
  
  console.log('\n[E2E Checklist Simulation Complete]');
}

main().finally(() => prisma.$disconnect());
