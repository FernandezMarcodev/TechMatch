import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './Icon';

const ACCOUNT_PERKS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'trending',
    title: 'Todas tus recomendaciones',
    text: 'Sin cuenta ves las primeras; con cuenta, la lista completa.',
  },
  {
    icon: 'file',
    title: 'Tu CV adaptado a cada oferta',
    text: 'Editalo, recalculá la compatibilidad y descargalo en formato Harvard.',
  },
  {
    icon: 'briefcase',
    title: 'Tus CVs guardados',
    text: 'Volvé a tus análisis cuando quieras, sin subir el CV de nuevo.',
  },
];

/**
 * Login and sign-up screen: what TechMatch does and what an account adds on one side, the
 * form on the other. On phones the form comes first.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <section className="auth-layout">
      <div className="auth-layout__inner">
        <div className="auth-layout__form">{children}</div>
        <aside className="auth-showcase" aria-label="Qué es TechMatch">
          <span className="eyebrow">
            <Icon name="sparkle" size={16} />
            Ofertas tech actualizadas cada 12 horas
          </span>
          {/* h2: the page's h1 is the form title ("Iniciar sesión", "Crear cuenta"). */}
          <h2 className="display auth-showcase__title">Encontrá ofertas que coinciden con tu CV</h2>
          <p className="hero__lead">
            Subí tu CV y lo comparamos con cientos de ofertas de tecnología. Cada recomendación
            viene con su nivel de compatibilidad y el porqué.
          </p>
          <h3 className="auth-showcase__subtitle">Con tu cuenta, además:</h3>
          <ul className="auth-perks">
            {ACCOUNT_PERKS.map((perk) => (
              <li key={perk.title} className="auth-perk">
                <span className="auth-perk__icon">
                  <Icon name={perk.icon} size={22} />
                </span>
                <div>
                  <p className="auth-perk__title">{perk.title}</p>
                  <p className="body-muted">{perk.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}

/** "Continuar sin cuenta": the anonymous flow stays one click away. */
export function GuestAccess() {
  return (
    <div className="auth-guest">
      <span className="auth-guest__divider">o</span>
      <Link to="/analizar" className="button button--tonal button--block">
        <Icon name="upload" size={18} />
        Continuar sin cuenta
      </Link>
      <p className="auth-guest__hint">
        Analizá tu CV y mirá tus primeras recomendaciones sin registrarte.
      </p>
    </div>
  );
}
