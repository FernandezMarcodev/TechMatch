import { createTransport } from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../../config/env.js';
import { BrevoEmailSender } from './brevo-email-sender.js';
import { createEmailSender } from './create-email-sender.js';
import { MemoryEmailSender } from './memory-email-sender.js';
import { SmtpEmailSender } from './smtp-email-sender.js';

const from = { email: 'no-reply@techmatch.local', name: 'TechMatch' };
const message = { to: 'ana@example.com', subject: 'Asunto', text: 'Hola, Ana.' };

afterEach(() => vi.unstubAllGlobals());

describe('SmtpEmailSender', () => {
  it('builds the email with Nodemailer (sender, recipient, subject and text)', async () => {
    // jsonTransport renders the message instead of connecting to a server.
    const transporter = createTransport({ jsonTransport: true });
    const sendMail = vi.spyOn(transporter, 'sendMail');
    await new SmtpEmailSender(transporter, from).send(message);

    const info = (await sendMail.mock.results[0]?.value) as { message: string };
    const sent = JSON.parse(info.message) as Record<string, unknown>;
    expect(sent).toMatchObject({
      from: { address: 'no-reply@techmatch.local', name: 'TechMatch' },
      to: [{ address: 'ana@example.com' }],
      subject: 'Asunto',
      text: 'Hola, Ana.',
    });
  });
});

describe('BrevoEmailSender', () => {
  const sender = new BrevoEmailSender({
    apiUrl: 'https://api.brevo.test/v3',
    apiKey: 'clave-api',
    from,
    timeoutMs: 1000,
  });

  it("calls Brevo's transactional email API with the key in the header", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response('{"messageId":"1"}', { status: 201 })),
    );
    vi.stubGlobal('fetch', fetchFn);
    await sender.send(message);

    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.test/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe('clave-api');
    expect(JSON.parse(String(init.body))).toEqual({
      sender: { name: 'TechMatch', email: 'no-reply@techmatch.local' },
      to: [{ email: 'ana@example.com' }],
      subject: 'Asunto',
      textContent: 'Hola, Ana.',
    });
  });

  it("fails with Brevo's explanation when the email is rejected", async () => {
    vi.stubGlobal('fetch', () =>
      Promise.resolve(new Response('{"message":"Key not found"}', { status: 401 })),
    );
    await expect(sender.send(message)).rejects.toThrow('HTTP 401): Key not found');
  });
});

describe('createEmailSender', () => {
  const env = (overrides: Record<string, string>) =>
    loadEnv({ DATABASE_URL: 'postgres://x', ...overrides });

  it('uses SMTP (Mailpit) by default and Brevo when EMAIL_PROVIDER=brevo', () => {
    expect(createEmailSender(env({}))).toBeInstanceOf(SmtpEmailSender);
    expect(
      createEmailSender(env({ EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'clave' })),
    ).toBeInstanceOf(BrevoEmailSender);
  });

  it('requires BREVO_API_KEY with Brevo', () => {
    expect(() => createEmailSender(env({ EMAIL_PROVIDER: 'brevo' }))).toThrow(/BREVO_API_KEY/);
  });

  it('rejects an invalid sender address', () => {
    expect(() => env({ EMAIL_FROM: 'no-es-un-email' })).toThrow(/EMAIL_FROM/);
  });
});

describe('MemoryEmailSender', () => {
  it('keeps the emails instead of sending them', async () => {
    const sender = new MemoryEmailSender();
    await sender.send(message);
    expect(sender.sent).toEqual([message]);
  });
});
