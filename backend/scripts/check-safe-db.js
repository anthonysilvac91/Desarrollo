require('dotenv').config();
const url = process.env.DATABASE_URL || '';

if (url.includes('supabase') || url.includes('pooler.supabase')) {
  console.error('\x1b[41m%s\x1b[0m', '🛑 ERROR DE SEGURIDAD: Estás intentando ejecutar un comando destructivo contra SUPABASE (Producción).');
  console.error('DATABASE_URL detectada: ' + url.split('@')[1]); // Solo mostramos el host por seguridad
  console.error('Por favor, cambia tu DATABASE_URL en el archivo .env a una base de datos local.');
  process.exit(1);
}

console.log('✅ Base de datos local detectada (o host seguro). Procediendo...');
