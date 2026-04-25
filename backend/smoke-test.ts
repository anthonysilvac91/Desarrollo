async function runTests() {
  const API_URL = process.env.API_URL || 'http://localhost:3001';
  console.log('🚀 Iniciando Smoke Test de Backend (Fetch Nativo)...\n');

  try {
    // 1. TEST LOGIN
    console.log('🔹 Probando Login de Super Admin (sys@recall.app)...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'sys@recall.app',
        password: 'password123'
      })
    });

    if (!loginRes.ok) {
      const errorData = await loginRes.json();
      throw new Error(`Login fallido: ${JSON.stringify(errorData)}`);
    }

    const loginData: any = await loginRes.json();
    const token = loginData.access_token;
    console.log(' ✅ Login exitoso. Token recibido.\n');

    const authHeaders = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. TEST LISTAR ACTIVOS
    console.log('🔹 Probando listado global de activos...');
    const assetsRes = await fetch(`${API_URL}/assets`, { headers: authHeaders });
    
    if (!assetsRes.ok) throw new Error('No se pudo obtener el listado de activos');
    
    const assets: any = await assetsRes.json();
    console.log(` ✅ Listado obtenido: ${assets.length} activos encontrados.\n`);

    if (assets.length > 0) {
      const firstAssetId = assets[0].id;
      const firstAssetName = assets[0].name;

      // 3. TEST DETALLE DE ACTIVO (BUG-002 CHECK)
      console.log(`🔹 Probando acceso a detalle de activo: "${firstAssetName}" (${firstAssetId})...`);
      const detailRes = await fetch(`${API_URL}/assets/${firstAssetId}`, { headers: authHeaders });
      
      if (!detailRes.ok) {
        const errorData = await detailRes.json();
        throw new Error(`FALLO en detalle de activo: ${detailRes.status} - ${JSON.stringify(errorData)}`);
      }
      
      const detailData: any = await detailRes.json();
      console.log(' ✅ Acceso a detalle EXITOSO (BUG-002 resuelto).');
      console.log(`    Nombre: ${detailData.name}`);
      console.log(`    Organización: ${detailData.organization_id}\n`);

      // 4. TEST LISTAR CLIENTES
      console.log('🔹 Probando listado de Clientes (Rol CLIENT)...');
      const clientsRes = await fetch(`${API_URL}/users?role=CLIENT`, { headers: authHeaders });
      if (!clientsRes.ok) throw new Error('No se pudo obtener el listado de clientes');
      const clients: any = await clientsRes.json();
      console.log(` ✅ Listado de clientes obtenido: ${clients.length} encontrados.`);
    } else {
      console.log(' ⚠️ No hay activos para probar el detalle. Corre el seed primero.');
    }

    console.log('\n✨ TODOS LOS TESTS PASARON CORRECTAMENTE.');

  } catch (error: any) {
    console.error('\n❌ ERROR CRÍTICO EN EL TEST:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

runTests();
