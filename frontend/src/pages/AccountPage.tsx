import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';

const dateFormat = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long' });

/** "Mi cuenta": only for logged-in users (wrapped in RequireAuth). */
export function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <Page narrow>
      <section className="upload-card auth-card">
        <div>
          <h1 className="auth-card__title">Mi cuenta</h1>
          <p className="body-muted">
            Más adelante vas a poder guardar acá tus CVs y tus CVs adaptados.
          </p>
        </div>
        <dl className="account-data">
          <dt>Email</dt>
          <dd>{user.email}</dd>
          <dt>Cuenta creada</dt>
          <dd>{dateFormat.format(new Date(user.createdAt))}</dd>
        </dl>
        <button
          type="button"
          className="button button--outlined button--block"
          onClick={() => {
            void logout().then(() => navigate('/'));
          }}
        >
          <Icon name="logout" size={18} />
          Cerrar sesión
        </button>
      </section>
    </Page>
  );
}
