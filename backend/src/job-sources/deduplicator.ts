import type { NormalizedJobOffer } from '../application/ports.js';
import { foldText } from '../domain/text.js';

/** Keys in dedup priority order (docs/05-FUENTES-DE-OFERTAS.md § Deduplicación). */
export function dedupKeys(offer: NormalizedJobOffer): string[] {
  const keys: string[] = [];
  if (offer.externalId) keys.push(`id:${offer.source}:${offer.externalId}`);
  keys.push(`url:${offer.sourceUrl}`);
  keys.push(
    `fields:${offer.source}:${foldText(offer.title)}|${foldText(offer.company)}|${foldText(offer.location ?? '')}`,
  );
  return keys;
}

/** Removes duplicates within one sync batch; the first occurrence wins. */
export function deduplicate(offers: readonly NormalizedJobOffer[]): {
  unique: NormalizedJobOffer[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const unique: NormalizedJobOffer[] = [];
  for (const offer of offers) {
    const keys = dedupKeys(offer);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    unique.push(offer);
  }
  return { unique, duplicates: offers.length - unique.length };
}
