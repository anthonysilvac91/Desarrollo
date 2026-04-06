# Recall MVP - Checklist de Prueba Manual (End-to-End)

Con el backend inicializado en `c:\Users\antho\Desktop\Proyectos\recall\Desarrollo\backend`, levanta el proyecto (`npm run start:dev`) e ingresa a `http://localhost:3000/api` para el entorno de Swagger.

*Para enviar identificadores puedes usar extensiones como ModHeader, puesto que Swagger requiere un esquema Bearer, para la prueba local inyectaremos los headers `x-user-id`, `x-org-id` y `x-role` directamente.*

### 1. Preparación de Base de Datos
- [ ] Ejecutar migraciones: `npx prisma migrate dev --name init`
- [ ] Ejecutar semilla: `npm run seed` u `npx prisma db seed`.
- [ ] Recuperar de la consola los IDs del Tenant (`x-org-id`), `Worker`, `Admin` y `Client`.

### 2. Flujo Operario (WORKER)
- [ ] Configura en tu cliente REST/Swagger los headers del `WORKER` inyectando su user_id, org_id y role.
- [ ] Realiza `POST /assets` con un nombre de Activo. (Verifica 201 Created).
- [ ] Realiza `POST /jobs` utilizando el ID del Asset creado u obtenido del DB Seed.
- [ ] (Aún no programado endpoint PATCH Asset, pero se sabe que el WORKER no podrá hacerlo).
- [ ] Realiza `GET /assets` y verifica que lista los activos (y no explota con permisos).

### 3. Flujo Supervisor (ADMIN)
- [ ] Cambia los headers por los del `ADMIN`.
- [ ] Realiza `GET /jobs?asset_id=TRACTOR_ID`.
- [ ] Comprueba que ves todos los detalles, sin exclusión por status o is_public.
- [ ] Observa el archivo DB, edita manualmente en la DB la `Organization` poniendo `auto_publish_jobs = false`, y repite el POST /jobs del operario. Luego mira en este GET si aparece el Job como `is_public: false`.

### 4. Flujo de Visibilidad/Acceso (CLIENT)
- [ ] Cambia los headers por los del `CLIENTE`.
- [ ] Realiza `GET /assets` y corrobora que **solo** retorna el "Tractor T-1000", ya que solo a ese se le incluyó en la tabla intermedia `ClientAssetAccess` de la semilla.
- [ ] Realiza `GET /jobs?asset_id=TRACTOR_ID`. Verifica que el trabajo con `is_public: true` entra, pero aquel Job que forzaste a `false` no existe en la array de respuesta, logrando el ocultamiento natural deseado.
