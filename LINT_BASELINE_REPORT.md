# Lint Baseline — Informe de Implementación

**Fecha:** 2026-06-29
**Rama:** `fix/pr1-followup-corrections`
**Commit:** `25a9c12`

---

## Contexto

El PR `fix/pr1-followup-corrections` introduce correcciones de seguridad y calidad
sobre la rama base `fix/auth-critical-hardening`. Ambas ramas acumulan deuda técnica
de lint preexistente que impediría que el CI pasara con las reglas actuales.

El objetivo de este mecanismo es permitir que el PR sea validado en CI sin ocultar
esa deuda ni rebajar permanentemente las reglas de ESLint.

---

## Estado confirmado antes de implementar

| Área     | Errores | Warnings | Método de medición |
|----------|--------:|--------:|---------------------|
| Backend  | 2053    | 254      | `npx eslint "{src,apps,libs,test}/**/*.ts"` (sin `--fix`, igual que CI) |
| Frontend | 100     | 87       | `npm run lint` |

El PR redujo los errores de backend de **2090 → 2053** (−37) respecto a la base.
Ningún cambio de frontend fue introducido por el PR.

---

## A. Archivos creados / modificados

| Archivo | Operación | Propósito |
|---|---|---|
| `.github/lint-baseline.json` | Creado | Umbrales máximos versionados por área |
| `.github/LINT_DEBT.md` | Creado | Documentación temporal + TODOs de limpieza |
| `.github/scripts/lint-check.sh` | Creado | Script de verificación de baseline |
| `.github/workflows/ci.yml` | Modificado | Pasos de lint reemplazados con el script |

---

## B. Baselines configurados

```json
{
  "_doc": "TEMPORARY — ver .github/LINT_DEBT.md. No aumentar estos valores.",
  "_created": "2026-06-29",
  "backend":  { "max_errors": 2053, "max_warnings": 254 },
  "frontend": { "max_errors": 100,  "max_warnings": 87  }
}
```

El archivo `.github/lint-baseline.json` está versionado en git. Cualquier intento
de aumentar los valores es visible en la PR review y va en contra de la política
documentada en `LINT_DEBT.md`.

---

## C. Cómo falla ante una regresión

El script `.github/scripts/lint-check.sh`:

1. Ejecuta lint completo y transmite **toda la salida** a los logs de CI.
2. Parsea la línea de resumen estándar de ESLint:
   `✖ N problems (E errors, W warnings)`
3. Compara contra el baseline:
   - `actual_errors > max_errors` → **FAIL**
   - `actual_warnings > max_warnings` → **FAIL**
4. Retorna `exit 1` si cualquiera de las dos condiciones se cumple.
5. Retorna `exit 2+` si el tool de lint falla por error de configuración
   (no confunde un error de herramienta con hallazgos de lint).

**Ejemplo de salida ante una regresión (simulado con baseline en 2050):**

```
Actual   : 2053 errors, 254 warnings
Baseline : 2050 errors (max), 254 warnings (max)

FAIL: errors regressed — 2053 > 2050 (baseline)
OK  : warnings 254 <= 254

================================================================
LINT BASELINE EXCEEDED
Fix the regressions in this PR before merging.
Do NOT increase values in lint-baseline.json to hide new debt.
See .github/LINT_DEBT.md for the cleanup plan.
================================================================
```

**El CI no usa `|| true`, `continue-on-error`, ni ninguna forma de suprimir el exit code.**

---

## D. Resultado de pruebas locales

### Lint baseline — backend

```
================================================================
Lint baseline check — backend
Threshold : <= 2053 errors, <= 254 warnings
================================================================

[... salida completa de ESLint con todos los hallazgos ...]

Summary : ✖ 2307 problems (2053 errors, 254 warnings)

Actual   : 2053 errors, 254 warnings
Baseline : 2053 errors (max), 254 warnings (max)

OK  : errors 2053 <= 2053
OK  : warnings 254 <= 254

================================================================
Lint baseline check passed.
Note: preexisting lint debt is visible in the output above.
================================================================
```

**Exit code: 0**

### Lint baseline — frontend

```
================================================================
Lint baseline check — frontend
Threshold : <= 100 errors, <= 87 warnings
================================================================

[... salida completa de ESLint ...]

Summary : ✖ 187 problems (100 errors, 87 warnings)

Actual   : 100 errors, 87 warnings
Baseline : 100 errors (max), 87 warnings (max)

OK  : errors 100 <= 100
OK  : warnings 87 <= 87

================================================================
Lint baseline check passed.
================================================================
```

**Exit code: 0**

### Regresión simulada (baseline bajado a 2050 para la prueba)

```
FAIL: errors regressed — 2053 > 2050 (baseline)
Exit code: 1 (esperado: 1) ✓
```

### Otras verificaciones

| Verificación | Resultado |
|---|---|
| `npx jest --no-coverage` (backend) | 242 passed, 0 failed |
| `npx tsc --noEmit` (backend) | Sin errores |
| `npm run build` (backend) | `dist/main.js` generado — sin errores |
| `npm run build` (frontend, local) | Falla por `NEXT_PUBLIC_API_URL` no seteada localmente — preexistente; el step de CI ya tiene `env: NEXT_PUBLIC_API_URL: http://localhost:3001` |

---

## E. Commit creado

```
25a9c12  ci(lint): agregar baseline temporal de lint para validar PR sin ocultar deuda
```

Pusheado a `origin/fix/pr1-followup-corrections`.

**Archivos incluidos en el commit:**

```
A  .github/LINT_DEBT.md
A  .github/lint-baseline.json
A  .github/scripts/lint-check.sh (chmod +x)
M  .github/workflows/ci.yml
```

**No se modificó ningún archivo de código de producción ni de tests.**

---

## F. Riesgos de esta estrategia

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Alguien sube el baseline en lugar de corregir código | Media | El archivo está versionado; un PR que suba los números es visible en review y explícitamente prohibido en `LINT_DEBT.md` |
| El parsing de grep falla si ESLint cambia el formato del summary | Muy baja | **Mitigado (2026-06-29):** el script es ahora fail-closed. Si lint termina con exit 1 sin línea de resumen reconocible, el CI falla con mensaje explícito mostrando las últimas 20 líneas del log. Se incluye suite de tests automáticos en `.github/scripts/test-lint-check.sh` que verifica este escenario. |
| `jq` no disponible en un runner custom | Muy baja | GitHub Actions ubuntu-latest tiene `jq` preinstalado; el script valida su presencia y falla con mensaje claro si no lo encuentra |
| La deuda no se limpia y el baseline se vuelve permanente | Media | Los TODOs en `LINT_DEBT.md`, el comentario en `ci.yml` y el nombre del step crean presión visible. Siguiente paso recomendado: crear issues en el tracker |

---

## TODOs versionados

Ambos TODOs están documentados en `.github/LINT_DEBT.md`:

### Backend lint cleanup
```
TODO(lint-debt/backend): ~2053 errores en backend.
Categorías principales:
  1. @typescript-eslint/no-unsafe-assignment
  2. @typescript-eslint/no-unsafe-member-access
  3. @typescript-eslint/no-unsafe-return
  4. @typescript-eslint/no-explicit-any
  5. @typescript-eslint/unbound-method
Estrategia: migrar servicio por servicio en PRs atómicos (~8-12 PRs)
```

### Frontend lint cleanup
```
TODO(lint-debt/frontend): ~100 errores en frontend.
Categorías principales:
  1. @typescript-eslint/no-explicit-any
  2. react-hooks/exhaustive-deps
  3. @next/next/no-img-element
Estrategia: limpiar por feature area (~4-6 PRs)
```

---

## Cómo eliminar esta medida temporal

Una vez que ambas áreas lleguen a 0 errores:

1. Eliminar `.github/scripts/lint-check.sh`
2. Eliminar `.github/lint-baseline.json`
3. Restaurar en `.github/workflows/ci.yml`:
   - Backend: `run: npx eslint "{src,apps,libs,test}/**/*.ts"`
   - Frontend: `run: npm run lint`
4. Eliminar `.github/LINT_DEBT.md` y este documento.

---

*Informe generado el 2026-06-29. No se modificó código de producción ni de tests.*
