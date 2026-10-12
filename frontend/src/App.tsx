import { Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { Icon } from './components/Icon';
import { Footer, Page, TopAppBar } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { StateView } from './components/StateView';
import { AccountPage } from './pages/AccountPage';
import { AdaptCvPage } from './pages/AdaptCvPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { LoginPage, RegisterPage } from './pages/LoginPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

export function App() {
  return (
    <AuthProvider>
      <div className="app">
        <TopAppBar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/cv/:cvId" element={<ProcessingPage />} />
            <Route path="/cv/:cvId/recomendaciones" element={<RecommendationsPage />} />
            <Route path="/ofertas/:jobId" element={<JobDetailPage />} />
            <Route path="/cv/:cvId/adaptar/:jobId" element={<AdaptCvPage />} />
            <Route path="/ingresar" element={<LoginPage />} />
            <Route path="/crear-cuenta" element={<RegisterPage />} />
            <Route path="/verificar-email" element={<VerifyEmailPage />} />
            <Route
              path="/cuenta"
              element={
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <Page narrow>
                  <StateView
                    icon="search"
                    title="Página no encontrada"
                    actions={
                      <Link to="/" className="button button--filled">
                        <Icon name="back" size={18} />
                        Ir al inicio
                      </Link>
                    }
                  />
                </Page>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
