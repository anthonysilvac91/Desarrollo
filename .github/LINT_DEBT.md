# Lint Debt — Plan de limpieza

> **MEDIDA TEMPORAL** introducida el 2026-06-29 en la rama `fix/pr1-followup-corrections`.
> Este mecanismo **no oculta** errores de lint; los muestra todos en los logs y
> falla el CI únicamente si los conteos **aumentan** por encima del baseline versionado.
> Debe eliminarse una vez que la deuda técnica esté resuelta.

---

## Baseline actual

| Área     | Errores (max) | Warnings (max) | Medido en              |
|----------|:-------------:|:--------------:|------------------------|
| backend  | 2053          | 254            | commit `ec9d8b4` — 2026-06-29 |
| frontend | 100           | 87             | commit `ec9d8b4` — 2026-06-29 |

Estos valores representan la deuda preexistente **antes** de este PR, no deuda
introducida por él. El PR `fix/pr1-followup-corrections` redujo los errores de
backend de 2090 → 2053 (−37).

---

## Cómo funciona

El script `.github/scripts/lint-check.sh`:

1. Ejecuta lint completo y transmite **toda la salida** a los logs de CI.
2. Parsea la línea de resumen (`N problems (E errors, W warnings)`).
3. Compara contra `lint-baseline.json`.
4. Falla con `exit 1` si `actual_errors > max_errors` **o** `actual_warnings > max_warnings`.
5. No usa `|| true`, `continue-on-error`, ni desactiva reglas ESLint.

---

## TODO — Backend lint cleanup

```
TODO(lint-debt/backend): Eliminar deuda de lint en backend (~2053 errores).
Categorías principales (en orden de volumen):
  1. @typescript-eslint/no-unsafe-assignment    — mocks sin tipar, as any implícito
  2. @typescript-eslint/no-unsafe-member-access — acceso a propiedades de `any`
  3. @typescript-eslint/no-unsafe-return        — retorno de `any`
  4. @typescript-eslint/no-explicit-any         — uso de `any` en producción
  5. @typescript-eslint/unbound-method          — expect(obj.method) sin spy
Estrategia recomendada:
  - Migrar servicio por servicio en PRs atómicos
  - Actualizar baseline.json con cada PR que reduce conteos
  - Cuando llegar a 0 errores: eliminar lint-check.sh y restaurar lint directo en CI
Estimación: 8-12 PRs de servicio (~5-8 archivos cada uno)
```

---

## TODO — Frontend lint cleanup

```
TODO(lint-debt/frontend): Eliminar deuda de lint en frontend (~100 errores).
Categorías principales:
  1. @typescript-eslint/no-explicit-any    — props sin tipar en componentes
  2. react-hooks/exhaustive-deps           — dependencias faltantes en useEffect
  3. @next/next/no-img-element             — <img> en lugar de <Image> de Next.js
Estrategia recomendada:
  - Limpiar por feature area (auth, dashboard, services, assets)
  - Actualizar baseline.json con cada PR que reduce conteos
  - Cuando llegar a 0 errores: eliminar lint-check.sh y restaurar lint directo en CI
Estimación: 4-6 PRs de componente
```

---

## Cómo eliminar esta medida temporal

Una vez que ambas áreas lleguen a 0 errores y 0 warnings:

1. Eliminar `.github/scripts/lint-check.sh`
2. Eliminar `.github/lint-baseline.json`
3. Restaurar en `.github/workflows/ci.yml`:
   - Backend: `run: npx eslint "{src,apps,libs,test}/**/*.ts"`
   - Frontend: `run: npm run lint`
4. Eliminar este archivo.

---

## Cómo actualizar el baseline tras un PR de limpieza

Después de que un PR de cleanup reduce conteos:

```bash
# Ejecutar desde backend/ o frontend/ según corresponda
npx eslint "{src,apps,libs,test}/**/*.ts" 2>&1 | grep "problems"
# Actualizar .github/lint-baseline.json con los nuevos valores menores
# Nunca aumentar los valores — solo reducir
```

**Regla**: el baseline solo puede moverse hacia abajo, nunca hacia arriba.
