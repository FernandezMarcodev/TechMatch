import { z } from 'zod';

const TEXT_MAX = 2_000;
const text = z.string().max(TEXT_MAX);
const nullableText = text.nullable();
/** "YYYY-MM" (experience) or "YYYY" (education); null = ongoing/unknown. */
const date = z
  .string()
  .regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, 'Fecha con formato YYYY-MM o YYYY')
  .nullable();

/**
 * Edited CV sent for re-evaluation (docs/15-ADAPTACION-DE-CV.md). Personal identifying data
 * (name, email, phone, links) is not part of the schema: zod drops unknown keys, so it never
 * reaches the matching even if a client sends it.
 */
export const evaluationDocumentSchema = z.object({
  personal: z.object({
    headline: nullableText,
    location: nullableText,
  }),
  summary: text,
  experiences: z
    .array(
      z.object({
        position: nullableText,
        company: nullableText,
        startDate: date,
        endDate: date,
        highlights: z.array(text).max(15),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({
        degree: nullableText,
        institution: nullableText,
        startDate: date,
        endDate: date,
      }),
    )
    .max(20),
  skills: z.array(z.object({ name: z.string().max(100) })).max(100),
  languages: z
    .array(z.object({ name: z.string().max(100), level: z.string().max(10).nullable() }))
    .max(15),
});

export type EvaluationDocument = z.infer<typeof evaluationDocumentSchema>;
