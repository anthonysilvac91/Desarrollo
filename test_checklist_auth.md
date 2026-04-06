# Recall MVP - Checklist de Prueba Manual (Auth Real)

El Backend ahora está protegido criptográficamente mediante tokens JWT firmados, habiendo destruido los mocks previos.

### 1. Inicialización
- [ ] Base de datos limpia: `npx prisma db push --accept-data-loss`
- [ ] Lanzar semilla: `npm run seed`. 
- [ ] Ejecutar el server: `npm run start:dev`. (Guarda el `organization_id` que se imprime en consola o la salida de la terminal).

### 2. Autenticación Continua
- [ ] Ingresa en tu navegador a Swagger `http://localhost:3000/api`.
- [ ] Despliega la pestaña global de [Auth](file:///c:/Users/antho/Desktop/Proyectos/recall/Desarrollo/backend/src/auth/auth.guard.ts#4-8) y lanza al endpoint `POST /auth/login` con tus credenciales:
  * `email`: *worker@test.com* (o el que quieras probar)
  * `password`: *123456*
  * `organizationId`: *El UUID impreso en consola por la semilla*
- [ ] Copia el `access_token` retornado.
- [ ] Sube al botón verde y general de Swagger llamado **"Authorize"**, pega el token allí y acepta. *(Ahora todas tus consiguientes requests irán firmadas criptográficamente como ese usuario en la Organization indicada)*.

### 3. Testing Real Multi-capa
- **Worker Flow (Operario):** Pide el token con `worker@test.com`. Lanza `POST /assets` o `POST /jobs`. Verás tu autoría y la validación de policies sucediendo en background de modo fluido sin requerir que mandes un id en el Request payload.
- **Admin Flow (Supervisor):** Usa `admin@test.com`. Dirígete a `PATCH /organizations/settings` o intenta hacer `GET /jobs` viendo todo el abánico de respuestas de tu staff bajo ese único tenant.
- **Seguridad Comprobada:** Desconéctate en el "Authorize" y envía un GET. El servidor te devolverá al instante Código 401 (Unauthorized) previniendo acceso civil, ratificando nuestra barrera Passport total en el MVP.
