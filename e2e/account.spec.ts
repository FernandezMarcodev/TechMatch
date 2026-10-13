import { expect, test } from '@playwright/test';
import { latestLinkTo } from './mailpit';

// Unique per run: the E2E database is emptied when the backend starts, not between tests.
const email = `e2e-${Date.now()}@example.com`;
const password = 'clave-segura-123';

test('create an account, confirm the email, log out and log in again', async ({ page }) => {
  // The front page is the login screen.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await page.getByRole('link', { name: 'Creá una' }).click();
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu email' })).toBeVisible();

  // Without confirming the email, logging in is refused (and offers to resend the link).
  await page.goto('/ingresar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toContainText('Todavía no confirmaste tu email');
  await expect(page.getByRole('button', { name: 'Reenviar email de verificación' })).toBeVisible();

  // The real email, caught by Mailpit, carries the link to the web app.
  const link = await latestLinkTo(email, '/verificar-email');
  expect(link).toContain('/verificar-email?token=');
  await page.goto(link);
  await expect(page.getByRole('heading', { name: '¡Email confirmado!' })).toBeVisible();

  await page.getByRole('main').getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // After logging in, straight to the CV upload; the account is in the top bar.
  await expect(page.getByRole('heading', { name: 'Analizá tu CV' })).toBeVisible();
  await page.getByRole('link', { name: `Mi cuenta (${email})` }).click();
  await expect(page.getByRole('heading', { name: 'Mi cuenta' })).toBeVisible();

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

test('recover the password with the link sent by email', async ({ page }) => {
  const resetEmail = `e2e-reset-${Date.now()}@example.com`;
  await page.goto('/crear-cuenta');
  await page.getByLabel('Email').fill(resetEmail);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { name: 'Revisá tu email' })).toBeVisible();

  await page.goto('/ingresar');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  // Both pages have an "Email" field: wait for the new one before typing.
  await expect(page.getByRole('heading', { name: '¿Olvidaste tu contraseña?' })).toBeVisible();
  await page.getByLabel('Email').fill(resetEmail);
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText(/Si existe una cuenta con/)).toBeVisible();

  const link = await latestLinkTo(resetEmail, '/restablecer');
  expect(link).toContain('/restablecer?token=');
  await page.goto(link);
  await page.getByLabel(/^Nueva contraseña/).fill('nueva-clave-456');
  await page.getByLabel('Repetir contraseña').fill('nueva-clave-456');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await expect(page.getByRole('heading', { name: 'Contraseña actualizada' })).toBeVisible();

  // The link proved the email is theirs, so the account is verified too.
  await page.getByRole('main').getByRole('link', { name: 'Iniciar sesión' }).click();
  await page.getByLabel('Email').fill(resetEmail);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
  await page.getByLabel('Contraseña').fill('nueva-clave-456');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Analizá tu CV' })).toBeVisible();
});

test('the anonymous flow does not need an account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Continuar sin cuenta' }).click();
  await expect(page.getByRole('button', { name: 'Analizar CV' })).toBeVisible();
});
