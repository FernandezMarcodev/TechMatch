import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon } from './Icon';

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
            Recomendaciones explicadas a partir de tu CV. Sin registro y sin publicar tus datos.
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
