import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

/** "Iniciar sesión" for visitors; the account (email) for logged-in users. */
function AccountLink() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <NavLink
        to="/ingresar"
        className="button button--text button--small"
        aria-label="Iniciar sesión"
      >
        <Icon name="user" size={18} />
        <span className="top-app-bar__label">Iniciar sesión</span>
      </NavLink>
    );
  }
  return (
    <NavLink
      to="/cuenta"
      className="button button--text button--small account-link"
      aria-label={`Mi cuenta (${user.email})`}
    >
      <Icon name="user" size={18} />
      <span className="top-app-bar__label account-link__email">{user.email}</span>
    </NavLink>
  );
}

export function TopAppBar() {
  return (
    <header className="top-app-bar">
      <div className="top-app-bar__inner">
        <Link to="/" className="brand" aria-label="TechMatch, inicio">
          <span className="brand__mark" aria-hidden="true">
            <Icon name="target" size={18} />
          </span>
          TechMatch
        </Link>
        <nav className="top-app-bar__nav" aria-label="Principal">
          <a href="/#como-funciona" className="nav-link">
            Cómo funciona
          </a>
          <NavLink to="/" end className="button button--tonal button--small">
            <Icon name="upload" size={18} />
            Analizar CV
          </NavLink>
          <AccountLink />
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div>
          <p className="footer__brand">TechMatch</p>
          <p className="footer__text">
            Recomendaciones explicadas a partir de tu CV. La cuenta es opcional y tus datos no se
            publican.
          </p>
        </div>
        <p className="footer__text">
          Ofertas provistas por{' '}
          <a href="https://www.getonbrd.com" target="_blank" rel="noopener noreferrer">
            Get on Board
          </a>
          .
        </p>
      </div>
    </footer>
  );
}

export function Page({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  return <div className={narrow ? 'page page--narrow' : 'page'}>{children}</div>;
}
