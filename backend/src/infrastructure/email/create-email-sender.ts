import type { EmailSender } from '../../application/ports.js';
import type { Env } from '../../config/env.js';
import { BrevoEmailSender } from './brevo-email-sender.js';
import { SmtpEmailSender } from './smtp-email-sender.js';

export type EmailEnv = Pick<
  Env,
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'EMAIL_FROM_NAME'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'BREVO_API_URL'
  | 'BREVO_API_KEY'
  | 'HTTP_TIMEOUT_MS'
>;

/** EMAIL_PROVIDER picks the implementation: the rest of the app does not know which one. */
export function createEmailSender(env: EmailEnv): EmailSender {
  const from = { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME };
  if (env.EMAIL_PROVIDER === 'brevo') {
    if (!env.BREVO_API_KEY) throw new Error('BREVO_API_KEY is required with EMAIL_PROVIDER=brevo');
    return new BrevoEmailSender({
      apiUrl: env.BREVO_API_URL,
      apiKey: env.BREVO_API_KEY,
      from,
      timeoutMs: env.HTTP_TIMEOUT_MS,
    });
  }
  return new SmtpEmailSender({ host: env.SMTP_HOST, port: env.SMTP_PORT }, from);
}
