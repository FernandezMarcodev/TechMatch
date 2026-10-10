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

/** Harvard-style CV: one column, serif, fixed section order. Also the printable page. */
export function CvPreview({ document: doc }: { document: CvDocument }) {
  const { personal } = doc;
  const contact = [personal.location, personal.email, personal.phone, ...personal.links].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  const experiences = doc.experiences.filter((e) => e.position || e.company);
  const education = doc.education.filter((e) => e.degree || e.institution);

  return (
    <article className="cv-paper" aria-label="Vista previa del CV">
      <header className="cv-paper__header">
        <h1 className="cv-paper__name">{personal.fullName.trim() || 'Tu nombre'}</h1>
        {personal.headline && <p className="cv-paper__headline">{personal.headline}</p>}
        {contact.length > 0 && <p className="cv-paper__contact">{contact.join(' · ')}</p>}
      </header>

      {doc.summary.trim() && (
        <section className="cv-paper__section">
          <h2>Resumen</h2>
          <p>{doc.summary}</p>
        </section>
      )}

      {experiences.length > 0 && (
        <section className="cv-paper__section">
          <h2>Experiencia</h2>
          {experiences.map((e, i) => (
            <div key={i} className="cv-paper__entry">
              <div className="cv-paper__entry-head">
                <strong>{[e.position, e.company].filter(Boolean).join(' — ')}</strong>
                <span>{formatRange(e.startDate, e.endDate, 'Actualidad')}</span>
              </div>
              {e.highlights.filter((h) => h.trim()).length > 0 && (
                <ul>
                  {e.highlights
                    .filter((h) => h.trim())
                    .map((h, j) => (
                      <li key={j}>{h}</li>
                    ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}

      {education.length > 0 && (
        <section className="cv-paper__section">
          <h2>Educación</h2>
          {education.map((e, i) => (
            <div key={i} className="cv-paper__entry">
              <div className="cv-paper__entry-head">
                <strong>{e.degree}</strong>
                <span>
                  {e.startDate || e.endDate ? formatRange(e.startDate, e.endDate, 'En curso') : ''}
                </span>
              </div>
              {e.institution && <p className="cv-paper__muted">{e.institution}</p>}
            </div>
          ))}
        </section>
      )}

      {doc.skills.length > 0 && (
        <section className="cv-paper__section">
          <h2>Tecnologías</h2>
          <p>{doc.skills.map((s) => s.name).join(' · ')}</p>
        </section>
      )}

      {doc.languages.length > 0 && (
        <section className="cv-paper__section">
          <h2>Idiomas</h2>
          <p>
            {doc.languages
              .map((l) => (l.level ? `${l.name} (${languageLevelLabel(l.level)})` : l.name))
              .join(' · ')}
          </p>
        </section>
      )}
    </article>
  );
}
