import { createTransport, type Transporter } from 'nodemailer';
import type { EmailMessage, EmailSender } from '../../application/ports.js';

export interface EmailSenderAddress {
  readonly email: string;
  readonly name: string;
}

/**
 * Sends through an SMTP server with Nodemailer. In development the server is Mailpit
 * (docker-compose), which catches every email and shows it at http://localhost:8025 without
 * delivering anything. Not usable on Render free: it blocks the SMTP ports.
 */
export class SmtpEmailSender implements EmailSender {
  private readonly transporter: Transporter;

  constructor(
    target: { host: string; port: number } | Transporter,
    private readonly from: EmailSenderAddress,
  ) {
    this.transporter =
      'sendMail' in target
        ? target
        : createTransport({ host: target.host, port: target.port, secure: false });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: { name: this.from.name, address: this.from.email },
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
