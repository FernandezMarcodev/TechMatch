/**
 * Sends one test email with the configured provider, to check the email setup.
 *   npm run send-test-email -w backend -- vos@example.com
 * Locally it lands in Mailpit (http://localhost:8025); with EMAIL_PROVIDER=brevo, in the inbox.
 */
import { getEnv } from '../config/env.js';
import { createEmailSender } from '../infrastructure/email/create-email-sender.js';
import { createLogger } from '../infrastructure/logging/logger.js';

const env = getEnv();
const logger = createLogger(env.LOG_LEVEL);
const to = process.argv[2];

if (!to) {
  logger.error('Usage: npm run send-test-email -w backend -- <email>');
  process.exitCode = 1;
} else {
  try {
    await createEmailSender(env).send({
      to,
      subject: 'TechMatch: email de prueba',
      text: [
        'Hola:',
        '',
        'Este es un email de prueba de TechMatch. Si lo recibiste, el envío de emails está bien configurado.',
        '',
        'El equipo de TechMatch',
      ].join('\n'),
    });
    logger.info({ provider: env.EMAIL_PROVIDER }, 'Test email sent');
  } catch (err) {
    logger.error({ err, provider: env.EMAIL_PROVIDER }, 'Test email failed');
    process.exitCode = 1;
  }
}
