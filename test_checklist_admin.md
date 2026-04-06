# Recall MVP - Checklist de Prueba Manual (End-to-End)

Con el backend inicializado en `c:\Users\antho\Desktop\Proyectos\recall\Desarrollo\backend`, levanta el proyecto (`npm run start:dev`) e ingresa a `http://localhost:3000/api` para el entorno de Swagger.

*Para probar la API en local sin Frontend, usamos inyección directa de headers (`x-user-id`, `x-org-id` y `x-role`) mientras integramos JWT real en la próxima fase.*

### 1. Preparación de Base de Datos
- [ ] Ejecutar SQLite push: `npx prisma db push --accept-data-loss`
- [ ] Sembrar datos: `npm run seed`
- [ ] Recuperar los IDs (Impresos en consola al sembrar) del Tenant (`x-org-id`), `Worker`, `Admin` y `Client`.

### 2. Flujo Operario (WORKER)
- [ ] Configura en tu cliente REST los headers con rol `WORKER`.
- [ ] **Crear Activo**: Construye uno mediante `POST /assets`. (Verifica recibo de 201 Created).
- [ ] **Crear Trabajo**: Publica el esfuerzo `POST /jobs` utilizando el UUID del asset recién instanciado.

### 3. Flujo Supervisor (ADMIN) - Operativa Plena
- [ ] Cambia los headers adoptando el rol `ADMIN`.
- [ ] **Cambiar Política:** Pega en `PATCH /organizations/settings` un flag `auto_publish_jobs: false`. *(Pídele al Worker simulado crear otro Job y verás que nace inhabilitado para clientes).*
- [ ] **Control QA:** Usufructa el `PATCH /jobs/{id}` y modifícale `title`, y el `status` a `"ARCHIVED"`.
- [ ] **Gestión de Visibilidad:** Realiza `POST /assets/{id}/clients/{clientId}` para abrirle un canal al `Client` en el Activo que creó el Operario.
- [ ] *(Opcional)* Revertir revocando con un `DELETE /assets/{id}/clients/{clientId}`.

### 4. Flujo de Cliente Final (CLIENT)
- [ ] Cambia los headers para tu `CLIENT`.
- [ ] Solicita los activos vía `GET /assets` y confirma la total exclusión de elementos no designados por el Admin.
- [ ] Audita la cronología ejecutando `GET /jobs?asset_id={id}` sobre el Activo válido. El Job que el Admin archivó se esfuma del radar exitosamente.
