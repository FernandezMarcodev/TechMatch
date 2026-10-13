import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createPool } from '../backend/src/infrastructure/db/pool.js';
import { ScryptPasswordHasher } from '../backend/src/infrastructure/security/scrypt-password-hasher.js';
import { PgUserRepository } from '../backend/src/persistence/pg-user-repository.js';
import { SAMPLE_CV_LINES, makePdf } from '../backend/test/support/make-pdf.js';
import { E2E_DATABASE_URL } from './e2e-env.js';

const email = `e2e-saved-${Date.now()}@example.com`;
const password = 'clave-segura-123';

test.beforeAll(async () => {
  // A verified account, created straight in the database.
  const pool = createPool(E2E_DATABASE_URL);
  const now = new Date();
  await new PgUserRepository(pool).create({
    id: randomUUID(),
    email,
    passwordHash: await new ScryptPasswordHasher().hash(password),
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await pool.end();
});

test('save a CV in the account, find it in "Mi cuenta", delete it and delete the account', async ({
  page,
}) => {
  await page.goto('/ingresar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Analizá tu CV' })).toBeVisible();

  await page.getByLabel(/CV en PDF/).setInputFiles({
    name: 'cv-guardado.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(SAMPLE_CV_LINES),
  });
  await page.getByRole('button', { name: 'Analizar CV' }).click();
  await expect(page.getByRole('heading', { name: 'Ofertas recomendadas' })).toBeVisible({
    timeout: 20_000,
  });

  // Saving is the user's choice.
  await page.getByRole('button', { name: 'Guardar en mi cuenta' }).click();
  await page.getByRole('link', { name: 'Guardado en tu cuenta' }).click();

  const saved = page.getByRole('list').filter({ hasText: 'cv-guardado.pdf' });
  await expect(saved).toBeVisible();
  await saved.getByRole('link', { name: 'Ver recomendaciones' }).click();
  await expect(page.getByRole('link', { name: 'Guardado en tu cuenta' })).toBeVisible();

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Borrar cv-guardado.pdf' }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.getByText(/Todavía no guardaste ningún CV/)).toBeVisible();

  await page.getByRole('button', { name: 'Borrar mi cuenta' }).click();
  await page.getByLabel('Tu contraseña, para confirmar').fill(password);
  await page.getByRole('button', { name: 'Borrar definitivamente' }).click();
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();

  // The account no longer exists.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos.');
});
