import type { EmailMessage, EmailSender } from '../../application/ports.js';
import type { EmailSenderAddress } from './smtp-email-sender.js';

export interface BrevoOptions {
  readonly apiUrl: string;
  readonly apiKey: string;
  readonly from: EmailSenderAddress;
  readonly timeoutMs: number;
}

/**
 * Sends through Brevo's HTTP API (free plan: 300 emails a day). Used in production because
 * Render free blocks the SMTP ports, so Nodemailer cannot connect from there; an HTTPS
 * request is allowed. Docs: https://developers.brevo.com/reference/sendtransacemail
 */
export class BrevoEmailSender implements EmailSender {
  constructor(private readonly options: BrevoOptions) {}

  async send(message: EmailMessage): Promise<void> {
    const { apiUrl, apiKey, from, timeoutMs } = this.options;
    const res = await fetch(`${apiUrl}/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: from.name, email: from.email },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      // Brevo explains the problem (bad key, unverified sender...) in `message`.
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new Error(
        `Brevo rejected the email (HTTP ${res.status}): ${body?.message ?? 'no details'}`,
      );
    }
  }
}
