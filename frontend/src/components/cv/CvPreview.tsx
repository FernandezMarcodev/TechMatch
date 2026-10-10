import type { ReactNode } from 'react';
import type { CvDocument } from '../../api/client';
import { languageLevelLabel } from '../labels';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2021-03" → "mar 2021"; "2019" → "2019". */
export function formatCvDate(date: string | null): string {
  if (!date) return '';
  const [year, month] = date.split('-');
  const name = month ? MONTHS[Number(month) - 1] : undefined;
  return name ? `${name} ${year}` : (year ?? '');
}

export function formatRange(
  start: string | null,
  end: string | null,
  ongoingLabel: string,
): string {
  const from = formatCvDate(start);
  const to = end ? formatCvDate(end) : ongoingLabel;
  return from ? `${from} – ${to}` : to;
}

/** Dates only when at least one is known: an undated entry shows none (never "En curso"). */
function optionalRange(start: string | null, end: string | null, ongoingLabel: string): string {
  return start || end ? formatRange(start, end, ongoingLabel) : '';
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cv-paper__section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/**
 * Harvard entry: organization in bold on the first line; role in italics on the second, with
 * the dates aligned right on the last line. Then one bullet per highlight.
 */
function Entry({
  title,
  subtitle,
  dates,
  highlights = [],
}: {
  title: string | null;
  subtitle?: string | null;
  dates: string;
  highlights?: readonly string[];
}) {
  const bullets = highlights.filter((h) => h.trim());
  const heading = title || subtitle;
  const role = title ? subtitle : null;
  return (
    <div className="cv-paper__entry">
      <div className="cv-paper__row">
        <strong>{heading}</strong>
        {!role && dates && <span>{dates}</span>}
      </div>
      {role && (
        <div className="cv-paper__row">
          <em>{role}</em>
          {dates && <span>{dates}</span>}
        </div>
      )}
      {bullets.length > 0 && (
        <ul>
          {bullets.map((h, i) => (
            <li key={i}>{h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * CV in the Harvard format (Harvard Office of Career Services): one column, serif, name and
 * contact centered, then Education, Experience, Projects and Skills, each entry with the
 * organization in bold, the role in italics, dates aligned right and bullets. The optional
 * profile on top keeps the summary adapted to the offer. Also the printable page.
 */
export function CvPreview({ document: doc }: { document: CvDocument }) {
  const { personal } = doc;
  const contact = [personal.location, personal.email, personal.phone, ...personal.links].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  const experiences = doc.experiences.filter((e) => e.position || e.company);
  const education = doc.education.filter((e) => e.degree || e.institution);
  const projects = doc.projects.filter((p) => p.name || p.highlights.some((h) => h.trim()));
  const languages = doc.languages
    .filter((l) => l.name.trim())
    .map((l) => (l.level ? `${l.name} (${languageLevelLabel(l.level)})` : l.name));

  return (
    <article className="cv-paper" aria-label="Vista previa del CV">
      <header className="cv-paper__header">
        <h1 className="cv-paper__name">{personal.fullName.trim() || 'Tu nombre'}</h1>
        {personal.headline && <p className="cv-paper__headline">{personal.headline}</p>}
        {contact.length > 0 && <p className="cv-paper__contact">{contact.join(' • ')}</p>}
      </header>

      {doc.summary.trim() && (
        <Section title="Perfil">
          <p>{doc.summary}</p>
        </Section>
      )}

      {education.length > 0 && (
        <Section title="Educación">
          {education.map((e, i) => (
            <Entry
              key={i}
              title={e.institution}
              subtitle={e.degree}
              dates={optionalRange(e.startDate, e.endDate, 'En curso')}
            />
          ))}
        </Section>
      )}

      {experiences.length > 0 && (
        <Section title="Experiencia">
          {experiences.map((e, i) => (
            <Entry
              key={i}
              title={e.company}
              subtitle={e.position}
              dates={formatRange(e.startDate, e.endDate, 'Actualidad')}
              highlights={e.highlights}
            />
          ))}
        </Section>
      )}

      {projects.length > 0 && (
        <Section title="Proyectos">
          {projects.map((p, i) => (
            <Entry
              key={i}
              title={p.name}
              dates={optionalRange(p.startDate, p.endDate, 'En curso')}
              highlights={p.highlights}
            />
          ))}
        </Section>
      )}

      {(doc.skills.length > 0 || languages.length > 0) && (
        <Section title="Habilidades">
          {doc.skills.length > 0 && (
            <p>
              <strong>Tecnologías:</strong> <span>{doc.skills.map((s) => s.name).join(', ')}</span>
            </p>
          )}
          {languages.length > 0 && (
            <p>
              <strong>Idiomas:</strong> <span>{languages.join(', ')}</span>
            </p>
          )}
        </Section>
      )}
    </article>
  );
}
