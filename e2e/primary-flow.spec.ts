import { expect, test } from '@playwright/test';
import { createPool } from '../backend/src/infrastructure/db/pool.js';
import { PgJobOfferRepository } from '../backend/src/persistence/pg-job-offer-repository.js';
import { normalizeJobOffer } from '../backend/src/job-sources/normalizer.js';
import { SAMPLE_CV_LINES, makePdf } from '../backend/test/support/make-pdf.js';
import { E2E_DATABASE_URL } from './e2e-env.js';

const SEEN_AT = new Date();

test.beforeAll(async () => {
  // Offers go through the same normalizer the source connectors use.
  const pool = createPool(E2E_DATABASE_URL);
  const jobs = new PgJobOfferRepository(pool);
  const offers = [
    {
      title: 'Desarrollador Backend Java Semi Senior',
      company: 'Empresa E2E',
      location: 'Capital Federal, Buenos Aires',
      modality: 'Híbrido',
      description:
        'Requisitos:\n3 años de experiencia con Java, Spring Boot y PostgreSQL\nInglés intermedio\nDeseable: Docker',
      url: 'https://example.com/ofertas/backend-java',
    },
    {
      title: 'Desarrollador iOS Senior',
      company: 'Otra Empresa',
      location: 'Córdoba, Córdoba',
      modality: 'Presencial',
      description: 'Requisitos:\n8 años de experiencia con Swift y Kotlin',
      url: 'https://example.com/ofertas/ios',
    },
  ];
  for (const [i, o] of offers.entries()) {
    await jobs.upsert(
      normalizeJobOffer({
        source: 'getonboard',
        sourceUrl: o.url,
        externalId: `e2e-${i}`,
        title: o.title,
        company: o.company,
        location: o.location,
        modality: o.modality,
        description: o.description,
        fetchedAt: SEEN_AT,
      }),
      SEEN_AT,
    );
  }
  await pool.end();
});

test('upload PDF → process → recommendations → open job, without login', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Encontrá ofertas');

  await page.getByLabel(/CV en PDF/).setInputFiles({
    name: 'maria-fernandez.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(SAMPLE_CV_LINES),
  });
  await page.getByRole('button', { name: 'Analizar CV' }).click();

  await expect(page.getByRole('heading', { name: 'Ofertas recomendadas' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page).toHaveURL(/\/cv\/[0-9a-f-]+\/recomendaciones$/);

  // Only the compatible offer is recommended; the LOW one is filtered out.
  const cards = page.locator('.recommendation');
  await expect(cards).toHaveCount(1);
  const card = cards.first();
  await expect(
    card.getByRole('link', { name: 'Desarrollador Backend Java Semi Senior' }),
  ).toBeVisible();
  await expect(card).toContainText('Empresa E2E');
  await expect(card).toContainText('Híbrido');
  await expect(card.getByText('Alta compatibilidad')).toBeVisible();
  await expect(card).toContainText('tecnologías requeridas');
  await expect(card.getByRole('link', { name: 'Ver oferta original' })).toHaveAttribute(
    'href',
    'https://example.com/ofertas/backend-java',
  );
  await expect(page.getByText('Desarrollador iOS Senior')).toHaveCount(0);

  await card.getByRole('link', { name: 'Ver detalle' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Desarrollador Backend Java Semi Senior',
  );
  await expect(page.locator('.chips')).toContainText('PostgreSQL');
  await expect(
    page.getByRole('link', { name: 'Ver oferta original en Get on Board' }),
  ).toHaveAttribute('href', 'https://example.com/ofertas/backend-java');

  await page.getByRole('link', { name: /Volver a las recomendaciones/ }).click();
  await expect(page.getByRole('heading', { name: 'Ofertas recomendadas' })).toBeVisible();

  await page.getByRole('link', { name: 'Cargar otro CV' }).click();
  await expect(page.getByRole('button', { name: 'Analizar CV' })).toBeVisible();
});

test('rejects a non-PDF file with a clear message', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel(/CV en PDF/).setInputFiles({
    name: 'cv.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('esto no es un pdf'),
  });
  await page.getByRole('button', { name: 'Analizar CV' }).click();
  await expect(page.getByRole('alert')).toHaveText('El archivo debe estar en formato PDF.');
});

test('adapt the CV to an offer → edit → re-evaluate → download as PDF', async ({ page }) => {
  // Record the print request instead of opening the browser dialog.
  await page.addInitScript(() => {
    window.print = () => {
      (window as unknown as { printedTitle: string }).printedTitle = document.title;
    };
  });

  await page.goto('/');
  await page.getByLabel(/CV en PDF/).setInputFiles({
    name: 'maria-fernandez.pdf',
    mimeType: 'application/pdf',
    buffer: makePdf(SAMPLE_CV_LINES),
  });
  await page.getByRole('button', { name: 'Analizar CV' }).click();
  await expect(page.getByRole('heading', { name: 'Ofertas recomendadas' })).toBeVisible({
    timeout: 20_000,
  });

  await page
    .locator('.recommendation')
    .first()
    .getByRole('link', { name: 'Adaptar mi CV' })
    .click();
  await expect(page.getByRole('heading', { name: 'Adaptá tu CV' })).toBeVisible();

  // The draft only contains what the CV has, with the offer's technologies first.
  const preview = page.getByRole('article', { name: 'Vista previa del CV' });
  await expect(preview).toContainText('Acme S.A.');
  await expect(preview).toContainText('Java');

  await page.getByLabel('Nombre y apellido').fill('María Fernández');
  await expect(preview.getByRole('heading', { name: 'María Fernández' })).toBeVisible();

  await page.getByRole('button', { name: 'Calcular compatibilidad' }).click();
  await expect(page.getByText('Antes', { exact: true })).toBeVisible();
  await expect(page.getByText('Ahora', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Descargar PDF' }).click();
  expect(
    await page.evaluate(() => (window as unknown as { printedTitle: string }).printedTitle),
  ).toBe('CV - María Fernández - Empresa E2E');

  // In print media only the Harvard CV is visible.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByLabel('Nombre y apellido')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Descargar PDF' })).toBeHidden();
  await expect(preview.getByRole('heading', { name: 'María Fernández' })).toBeVisible();
});
