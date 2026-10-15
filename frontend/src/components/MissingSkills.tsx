import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type MissingSkill } from '../api/client';
import { Icon } from './Icon';

/**
 * "Qué te falta": the technologies the active offers require most that were not found in the
 * CV. Optional extra: if it cannot be loaded or there is nothing missing, it is not shown.
 */
export function MissingSkills({ cvId }: { cvId: string }) {
  const [skills, setSkills] = useState<MissingSkill[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getMissingSkills(cvId)
      .then((data) => {
        // Optional extra: anything unexpected just hides the card.
        if (!cancelled) setSkills(Array.isArray(data.skills) ? data.skills : []);
      })
      .catch(() => {
        if (!cancelled) setSkills([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cvId]);

  if (skills.length === 0) return null;
  return (
    <section className="missing-skills" aria-labelledby="missing-skills-title">
      <div className="missing-skills__header">
        <span className="missing-skills__icon">
          <Icon name="target" size={20} />
        </span>
        <div>
          <h2 id="missing-skills-title" className="title-medium">
            Qué te falta
          </h2>
          <p className="body-muted">
            Las tecnologías que más piden las ofertas activas y que no encontramos en tu CV. Si ya
            las manejás, sumalas a tu CV.
          </p>
        </div>
      </div>
      <ul className="missing-skills__list">
        {skills.map((skill) => (
          <li key={skill.name} className="missing-skills__item">
            <span className="missing-skills__name">{skill.name}</span>
            <span className="missing-skills__track" aria-hidden="true">
              <span className="missing-skills__bar" style={{ width: `${skill.percent}%` }} />
            </span>
            <span className="missing-skills__value">{skill.percent} % de las ofertas</span>
          </li>
        ))}
      </ul>
      <Link to="/tendencias" className="missing-skills__link">
        Ver las tendencias del mercado
      </Link>
    </section>
  );
}
