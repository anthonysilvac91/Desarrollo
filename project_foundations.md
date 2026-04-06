# Foundations: Proyecto Recall (Flexible Core)

Documento final de definiciones estructurales para el MVP. Las reglas se han diseñado previniendo lógicas "hardcodeadas" en los procesos operativos críticos (edición y visibilidad), permitiendo que el sistema se adapte nativamente al comportamiento de distintas organizaciones/rubros sin perder su simplicidad.

## 1. Roles Definitivos (Hardcoded)

*   **ADMINISTRADOR (Admin):** Gestión integral. Control remoto opcional y sin cuellos de botella obligatorios. Potestad global e ilimitada para corregir, asignar, publicar/ocultar o archivar la información de toda su organización.
*   **OPERARIO (Worker):** Ejecutor autónomo. Puede crear Activos libremente (si no los encuentra) y registrar Trabajos adjuntando su evidencia. 
*   **CLIENTE (Viewer):** Usuario pasivo de consulta. Accede exclusivamente al historial de Trabajos publicados (`is_public=true`) dentro de los Activos donde se le haya asignado permiso.

## 2. Entidades Definitivas y Relaciones Flexibles

Se prioriza el uso de la bandera lógica `is_active` para data maestra y se inyectan las opciones de flexibilidad a nivel de Organización.

1.  **Organization**
    *   Campos: `id`, `name`, `is_active`.
    *   *Configuraciones (Flexibilidad delegada):* **`auto_publish_jobs`** (boolean), **`worker_edit_policy`** (Enum).
2.  **User** 
    *   Campos: `id`, `organization_id`, `role` (ADMIN | WORKER | CLIENT), `email`, `password_hash`, `name`, `is_active`.
    *   *Regla:* Si `is_active=false`, se deniega autenticación sin necesidad de borrar los Trabajos vinculados al usuario (conservación de historia).
3.  **Asset**
    *   Campos: `id`, `organization_id`, `name`, `description`, `is_active`.
4.  **ClientAssetAccess** (Tabla de Vinculación N:M)
    *   Campos: `client_id`, `asset_id`, `granted_by` (opcional).
    *   *Regla:* Sistema "desacoplado". Permite registrar Clientes sin Activos, Activos sin Clientes, o mallas complejas (ej. socios compartiendo visibilidad de una flota) asignadas a posteriori por el Admin.
5.  **Job**
    *   Campos: `id`, `asset_id`, `worker_id`, `title`, `description`, `status` (Enum), `is_public` (boolean), `created_at`, `updated_at`.
6.  **JobAttachment**
    *   Campos: `id`, `job_id`, `file_url`, `file_type`.

## 3. Parametrización por Organización (Sin motores complejos)
Se integran dos configuraciones simples a nivel `Organization` que actúan en la capa de servicios (backend) usando lógicas de control elementales *if/else*, protegiendo el MVP de herramientas externas o sobreingeniería de workflows.

### A. Visibilidad al Cliente Configurabe
Regulada por el flag **`auto_publish_jobs` (boolean)**:
*   **True (Autónoma):** Al crear un Job, su estado nace como `is_public = true`. La información llega visiblemente al Cliente apenas el Operario guarda. 
*   **False (Conservadora/Controlada):** Al crear un Job, nace operativo pero con `is_public = false`. Fluye en backoffice, pero el cliente no lo ve hasta que el Administrador voluntariamente decida publicarlo.

### B. Lógica de Edición para el Operario
Remplazamos la ventana rígida de 24h por la **`worker_edit_policy` (Enum)**, la cual define qué regla se cumple cuando un Operario quiere editar un Job propio:
1.  `ALWAYS_OPEN`: Editables perpetuamente (ideal si solo se usa a nivel registro interno flexible).
2.  `UNTIL_ADMIN_INTERVENES`: Editables libremente *hasta que* el Admin entre y modifique el Job (un cambio rinde "sello" o bloque de seguridad).
3.  `UNTIL_PUBLISHED`: Editables *mientras* `Job.is_public == false`. Ideal para quienes revisan sus borradores antes que el cliente los vea. Al ser público, se inmoviliza para el operario.
4.  `TIME_WINDOW`: Retiene la regla por base de tiempo estricto (ej. 24 hs o configurable).

## 4. Estado Definitivo del Job
*   `COMPLETED`: Estado que define que el registro se cerró operativamente. Nunca dictamina ni bloquea la visibilidad; ambas cosas conviven y se leen por separado.
*   `ARCHIVED`: Anulación absoluta. Solo el Admin tiene el permiso de devaluar un trabajo enviándolo a este pozo ciego.

## 5. Criterios Permanentes 
*   **Corrección (Admin):** Modificación de textos/fotos de cualquier Trabajo, ilimitadamente en el tiempo.
*   **Ocultamiento (Admin):** Revocación manual de visibilidad a un Trabajo pasándolo localmente a `is_public=false`, resguardándolo pero no eliminándolo.
*   **Desactivación (Entidades Base):** Apagar `is_active` retira usuarios/activos de la circulación futura (listados/comboboxes) sin corchetear a nulo las FKs del pasado.
