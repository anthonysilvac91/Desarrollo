# Guía de QA - Recall SaaS MVP

Este documento detalla cómo ejecutar la suite de validación funcional.

## 1. Backend (Pruebas Unitarias e Integración)

### Pruebas Unitarias
Validan la lógica de negocio aislada.
```bash
npm run test
```

### Pruebas E2E (Integración)
Validan flujos completos (Auth, Assets, Visibilidad B2B).
**Requisito:** Tener una base de datos de prueba accesible en `.env.test`.
```bash
npm run test:e2e
```

## 2. Frontend (E2E con Playwright)

He instalado Playwright para validar flujos de usuario reales y comportamiento móvil.

### Ejecutar tests
```bash
npx playwright test
```

### Abrir interfaz de Playwright (Recomendado para Debug)
```bash
npx playwright test --ui
```

## 3. Cobertura Crítica Validada
- **Tenant Isolation:** Un cliente no puede ver activos ni reportes de otra empresa.
- **Role Scoping:** Los Workers solo ven lo asignado si la organización es restrictiva.
- **Auth Cycle:** Login -> Redirección -> Acceso a rutas protegidas.
- **B2B Structure:** Los usuarios ahora pertenecen a un `Customer` y no solo a la organización global.
