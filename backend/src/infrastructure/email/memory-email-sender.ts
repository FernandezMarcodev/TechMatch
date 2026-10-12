import type { EmailMessage, EmailSender } from '../../application/ports.js';

/** Keeps sent emails in memory instead of sending them. For tests. */
export class MemoryEmailSender implements EmailSender {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }
}
