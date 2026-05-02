# Procedimiento manual: ADMIN inicial de una organizacion

Este procedimiento deja fuera de uso operativo al auto-registro (`/auth/register`) y al `initial_invitation_token`. El token puede seguir generandose al crear la organizacion, pero no se usa para dar de alta al ADMIN inicial.

## Precondiciones

- Ejecutar el flujo con un usuario autenticado con rol `SUPER_ADMIN`.
- La organizacion debe existir y estar activa.
- No usar contrasenas reales en tickets, chats, logs o documentacion.
- Entregar la contrasena inicial al ADMIN por un canal seguro y forzar rotacion operacional si aplica.

## Paso 1: crear la organizacion

Endpoint:

```http
POST /organizations
Authorization: Bearer <SUPER_ADMIN_JWT>
Content-Type: application/json
```

Payload:

```json
{
  "name": "Acme Operaciones",
  "slug": "acme-operaciones",
  "admin_email": "admin@acme.example"
}
```

Respuesta esperada:

```json
{
  "organization": {
    "id": "<organization_id>",
    "name": "Acme Operaciones",
    "slug": "acme-operaciones",
    "is_active": true
  },
  "initial_invitation_token": "<ignorar-temporalmente>"
}
```

Guardar el `organization.id`. Ignorar temporalmente `initial_invitation_token`.

## Paso 2: crear manualmente el ADMIN inicial

Endpoint:

```http
POST /users
Authorization: Bearer <SUPER_ADMIN_JWT>
Content-Type: application/json
```

Payload:

```json
{
  "email": "admin@acme.example",
  "password": "<temporary-strong-password>",
  "name": "Admin Acme",
  "role": "ADMIN",
  "organization_id": "<organization_id>"
}
```

Reglas validadas por backend:

- Solo `SUPER_ADMIN` o `ADMIN` pueden llamar `POST /users`.
- `SUPER_ADMIN` puede crear `ADMIN` con `organization_id` explicito.
- `ADMIN` no puede crear usuarios fuera de su tenant: el backend fuerza `organization_id` a su propia organizacion.
- Todo usuario que no sea `SUPER_ADMIN` debe tener `organization_id`.
- `company_id` solo se acepta con rol `CLIENT`.
- `ADMIN` y `WORKER` con `company_id` reciben `400`.
- `CLIENT` puede usar `company_id` si la company existe, esta activa y pertenece a la misma organizacion.
- `email` debe tener formato valido.
- `password` debe tener al menos 8 caracteres.
- `role` debe ser uno de `SUPER_ADMIN`, `ADMIN`, `WORKER`, `CLIENT`.
- El email no puede repetirse dentro de la misma organizacion.

Respuesta esperada:

```json
{
  "id": "<user_id>",
  "email": "admin@acme.example",
  "name": "Admin Acme",
  "role": "ADMIN",
  "organization_id": "<organization_id>",
  "company_id": null,
  "is_active": true
}
```

## Paso 3: validar login del ADMIN

Endpoint:

```http
POST /auth/login
Content-Type: application/json
```

Payload:

```json
{
  "email": "admin@acme.example",
  "password": "<temporary-strong-password>",
  "organizationId": "<organization_id>"
}
```

Respuesta esperada:

```json
{
  "access_token": "<jwt>"
}
```

## Paso 4: validar aislamiento tenant

Con el JWT del ADMIN inicial:

```http
GET /users
Authorization: Bearer <ADMIN_JWT>
```

Resultado esperado:

- Solo retorna usuarios con `organization_id` igual al de la organizacion creada.
- Si el ADMIN intenta crear un usuario enviando otro `organization_id`, el backend ignora ese valor y usa su propia organizacion.
- La creacion normal de `WORKER` por `ADMIN` sigue funcionando sin enviar `organization_id`.

## Ejemplo curl

```bash
curl -X POST "$API_URL/users" \
  -H "Authorization: Bearer $SUPER_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.example",
    "password": "<temporary-strong-password>",
    "name": "Admin Acme",
    "role": "ADMIN",
    "organization_id": "<organization_id>"
  }'
```

