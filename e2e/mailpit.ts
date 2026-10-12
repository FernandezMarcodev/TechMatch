/** Reads the emails the backend sent to Mailpit (docker-compose / CI service) through its API. */
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitSummary {
  ID: string;
}

/**
 * The link to `path` (e.g. "/restablecer") in the latest email sent to `to`. Waits up to
 * ~10 s: the email may not have reached Mailpit yet, and an older email to the same address
 * (the verification one) must not be taken for it.
 */
export async function latestLinkTo(to: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    if (messages[0]) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
      const { Text } = (await message.json()) as { Text: string };
      const link = /https?:\/\/\S+/.exec(Text)?.[0];
      if (link && new URL(link).pathname === path) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email with a link to ${path} reached Mailpit for ${to}`);
}
