import { expect, test } from '@playwright/test';

// Unique per run: the E2E database is emptied when the backend starts, not between tests.
const email = `e2e-${Date.now()}@example.com`;
const password = 'clave-segura-123';

test('create an account, log out and log in again', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByRole('link', { name: 'Creá una' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
  await expect(page.getByRole('link', { name: `Mi cuenta (${email})` })).toBeVisible();

  // The session survives a reload (token stored in the browser, checked with /api/auth/me).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();

  await page.goto('/cuenta');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('una-clave-incorrecta');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');

  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();
});

test('the anonymous flow does not need an account', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Analizar CV' })).toBeVisible();
});
