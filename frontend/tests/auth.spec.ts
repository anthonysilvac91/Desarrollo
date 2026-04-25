import { test, expect } from '@playwright/test';

test.describe('Flujo de Autenticación', () => {
  test('debería mostrar error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'fake@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Esperar mensaje de error (ajustar según el componente Toast/Error real)
    const error = page.locator('text=Credenciales inválidas');
    await expect(error).toBeVisible();
  });

  test('debería loguearse correctamente y redirigir al dashboard', async ({ page }) => {
    // Nota: Este test asume que existe el usuario admin@test.com / 123456 en la DB local/dev
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('aside')).toBeVisible(); // Sidebar debe aparecer
  });

  test('no debería permitir acceso a /dashboard sin estar logueado', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Responsive / Mobile Check', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone 8 size

  test('sidebar debería estar oculta por defecto en móvil', async ({ page }) => {
    await page.goto('/login');
    // Login rápido
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', '123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    
    const sidebar = page.locator('aside');
    // En móvil el sidebar suele tener clases CSS que lo ocultan (ej: -translate-x-full)
    await expect(sidebar).toHaveClass(/translate-x-full/); 
  });
});
