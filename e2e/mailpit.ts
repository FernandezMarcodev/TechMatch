/** Reads the emails the backend sent to Mailpit (docker-compose / CI service) through its API. */
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';

interface MailpitSummary {
  ID: string;
}

/** The first link in the latest email sent to `to` (waits up to ~10 s for it to arrive). */
export async function latestLinkTo(to: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    if (messages[0]) {
      const message = await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`);
      const { Text } = (await message.json()) as { Text: string };
      const link = /https?:\/\/\S+/.exec(Text)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No email with a link reached Mailpit for ${to}`);
}
