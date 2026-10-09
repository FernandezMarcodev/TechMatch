import { Link, Route, Routes } from 'react-router-dom';
import { Icon } from './components/Icon';
import { Footer, Page, TopAppBar } from './components/Layout';
import { StateView } from './components/StateView';
import { AdaptCvPage } from './pages/AdaptCvPage';
import { HomePage } from './pages/HomePage';
import { JobDetailPage } from './pages/JobDetailPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { RecommendationsPage } from './pages/RecommendationsPage';

export function App() {
  return (
    <div className="app">
      <TopAppBar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cv/:cvId" element={<ProcessingPage />} />
          <Route path="/cv/:cvId/recomendaciones" element={<RecommendationsPage />} />
          <Route path="/ofertas/:jobId" element={<JobDetailPage />} />
          <Route path="/cv/:cvId/adaptar/:jobId" element={<AdaptCvPage />} />
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
  );
}
