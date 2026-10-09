import { useId, useState, type ReactNode } from 'react';
import type { CvDocument, CvEducation, CvExperience } from '../../api/client';
import { Icon } from '../Icon';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

interface CvEditorProps {
  document: CvDocument;
  onChange: (document: CvDocument) => void;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: (id: string) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {children(id)}
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="editor-section">
      <legend className="title-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  return items.map((item, i) => (i === index ? value : item));
}

function updateAt<T>(items: readonly T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

const linesOf = (text: string) => text.split('\n');

/** Section-by-section editor of the adapted CV. Pure UI: every change yields a new document. */
export function CvEditor({ document: doc, onChange }: CvEditorProps) {
  const [newSkill, setNewSkill] = useState('');
  const set = (patch: Partial<CvDocument>) => onChange({ ...doc, ...patch });
  const setPersonal = (patch: Partial<CvDocument['personal']>) =>
    set({ personal: { ...doc.personal, ...patch } });
  const setExperience = (i: number, patch: Partial<CvExperience>) =>
    set({ experiences: updateAt(doc.experiences, i, patch) });
  const setEducation = (i: number, patch: Partial<CvEducation>) =>
    set({ education: updateAt(doc.education, i, patch) });

  function addSkill() {
    const name = newSkill.trim();
    if (!name) return;
    if (!doc.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      set({ skills: [...doc.skills, { name, highlighted: false }] });
    }
    setNewSkill('');
  }

  return (
    <div className="cv-editor">
      <Section title="Datos personales">
        <p className="field__hint">
          <Icon name="lock" size={14} /> Estos datos quedan en tu navegador: no se envían al
          servidor.
        </p>
        <div className="field-grid">
          <Field label="Nombre y apellido">
            {(id) => (
              <input
                id={id}
                value={doc.personal.fullName}
                onChange={(e) => setPersonal({ fullName: e.target.value })}
                autoComplete="name"
              />
            )}
          </Field>
          <Field label="Título profesional">
            {(id) => (
              <input
                id={id}
                value={doc.personal.headline ?? ''}
                onChange={(e) => setPersonal({ headline: e.target.value || null })}
              />
            )}
          </Field>
          <Field label="Email">
            {(id) => (
              <input
                id={id}
                type="email"
                value={doc.personal.email}
                onChange={(e) => setPersonal({ email: e.target.value })}
                autoComplete="email"
              />
            )}
          </Field>
          <Field label="Teléfono">
            {(id) => (
              <input
                id={id}
                type="tel"
                value={doc.personal.phone}
                onChange={(e) => setPersonal({ phone: e.target.value })}
                autoComplete="tel"
              />
            )}
          </Field>
          <Field label="Ubicación">
            {(id) => (
              <input
                id={id}
                value={doc.personal.location ?? ''}
                onChange={(e) => setPersonal({ location: e.target.value || null })}
              />
            )}
          </Field>
          <Field label="Links" hint="Uno por línea (LinkedIn, GitHub, portfolio).">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                value={doc.personal.links.join('\n')}
                onChange={(e) => setPersonal({ links: linesOf(e.target.value) })}
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="Resumen">
        <Field label="Resumen profesional">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={doc.summary}
              onChange={(e) => set({ summary: e.target.value })}
            />
          )}
        </Field>
      </Section>

      <Section title="Experiencia">
        {doc.experiences.map((exp, i) => (
          <div key={i} className={`editor-item${exp.relevant ? ' editor-item--relevant' : ''}`}>
            {exp.relevant && (
              <span className="editor-item__badge">
                <Icon name="target" size={14} /> Relevante para la oferta
              </span>
            )}
            <div className="field-grid">
              <Field label="Puesto">
                {(id) => (
                  <input
                    id={id}
                    value={exp.position ?? ''}
                    onChange={(e) => setExperience(i, { position: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Empresa">
                {(id) => (
                  <input
                    id={id}
                    value={exp.company ?? ''}
                    onChange={(e) => setExperience(i, { company: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Desde">
                {(id) => (
                  <input
                    id={id}
                    type="month"
                    value={exp.startDate ?? ''}
                    onChange={(e) => setExperience(i, { startDate: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Hasta">
                {(id) => (
                  <div className="field-inline">
                    <input
                      id={id}
                      type="month"
                      value={exp.endDate ?? ''}
                      disabled={exp.endDate === null}
                      onChange={(e) => setExperience(i, { endDate: e.target.value || null })}
                    />
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={exp.endDate === null}
                        onChange={(e) =>
                          setExperience(i, {
                            endDate: e.target.checked ? null : (exp.startDate ?? ''),
                          })
                        }
                      />
                      Actualidad
                    </label>
                  </div>
                )}
              </Field>
            </div>
            <Field label="Logros y tareas" hint="Una viñeta por línea.">
              {(id) => (
                <textarea
                  id={id}
                  rows={Math.max(3, exp.highlights.length + 1)}
                  value={exp.highlights.join('\n')}
                  onChange={(e) => setExperience(i, { highlights: linesOf(e.target.value) })}
                />
              )}
            </Field>
            <button
              type="button"
              className="button button--text button--small"
              onClick={() => set({ experiences: removeAt(doc.experiences, i) })}
            >
              <Icon name="close" size={16} /> Quitar experiencia
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button--outlined button--small"
          onClick={() =>
            set({
              experiences: [
                ...doc.experiences,
                {
                  position: '',
                  company: '',
                  startDate: null,
                  endDate: null,
                  highlights: [],
                  relevant: false,
                },
              ],
            })
          }
        >
          Agregar experiencia
        </button>
      </Section>

      <Section title="Educación">
        {doc.education.map((edu, i) => (
          <div key={i} className="editor-item">
            <div className="field-grid">
              <Field label="Título">
                {(id) => (
                  <input
                    id={id}
                    value={edu.degree ?? ''}
                    onChange={(e) => setEducation(i, { degree: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Institución">
                {(id) => (
                  <input
                    id={id}
                    value={edu.institution ?? ''}
                    onChange={(e) => setEducation(i, { institution: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Año de inicio">
                {(id) => (
                  <input
                    id={id}
                    inputMode="numeric"
                    maxLength={4}
                    value={edu.startDate ?? ''}
                    onChange={(e) => setEducation(i, { startDate: e.target.value || null })}
                  />
                )}
              </Field>
              <Field label="Año de fin" hint="Vacío si está en curso.">
                {(id) => (
                  <input
                    id={id}
                    inputMode="numeric"
                    maxLength={4}
                    value={edu.endDate ?? ''}
                    onChange={(e) => setEducation(i, { endDate: e.target.value || null })}
                  />
                )}
              </Field>
            </div>
            <button
              type="button"
              className="button button--text button--small"
              onClick={() => set({ education: removeAt(doc.education, i) })}
            >
              <Icon name="close" size={16} /> Quitar estudio
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button--outlined button--small"
          onClick={() =>
            set({
              education: [
                ...doc.education,
                { degree: '', institution: '', startDate: null, endDate: null },
              ],
            })
          }
        >
          Agregar estudio
        </button>
      </Section>

      <Section title="Tecnologías">
        <ul className="chips" aria-label="Tecnologías del CV">
          {doc.skills.map((skill, i) => (
            <li
              key={skill.name}
              className={`input-chip${skill.highlighted ? ' input-chip--highlighted' : ''}`}
            >
              {skill.name}
              <button
                type="button"
                aria-label={`Quitar ${skill.name}`}
                onClick={() => set({ skills: removeAt(doc.skills, i) })}
              >
                <Icon name="close" size={14} />
              </button>
            </li>
          ))}
        </ul>
        <div className="field-inline">
          <Field label="Agregar tecnología">
            {(id) => (
              <input
                id={id}
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
            )}
          </Field>
          <button type="button" className="button button--tonal button--small" onClick={addSkill}>
            Agregar
          </button>
        </div>
        <p className="field__hint">Las destacadas coinciden con la oferta.</p>
      </Section>

      <Section title="Idiomas">
        {doc.languages.map((lang, i) => (
          <div key={i} className="field-inline">
            <Field label="Idioma">
              {(id) => (
                <input
                  id={id}
                  value={lang.name}
                  onChange={(e) =>
                    set({
                      languages: replaceAt(doc.languages, i, { ...lang, name: e.target.value }),
                    })
                  }
                />
              )}
            </Field>
            <Field label="Nivel">
              {(id) => (
                <select
                  id={id}
                  value={lang.level ?? ''}
                  onChange={(e) =>
                    set({
                      languages: replaceAt(doc.languages, i, {
                        ...lang,
                        level: e.target.value || null,
                      }),
                    })
                  }
                >
                  <option value="">Sin indicar</option>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <button
              type="button"
              className="button button--text button--small"
              aria-label={`Quitar ${lang.name || 'idioma'}`}
              onClick={() => set({ languages: removeAt(doc.languages, i) })}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button button--outlined button--small"
          onClick={() => set({ languages: [...doc.languages, { name: '', level: null }] })}
        >
          Agregar idioma
        </button>
      </Section>
    </div>
  );
}
