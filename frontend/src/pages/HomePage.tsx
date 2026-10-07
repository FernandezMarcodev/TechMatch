import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api/client';
import { Dropzone } from '../components/Dropzone';
import { Icon, type IconName } from '../components/Icon';
import { Page } from '../components/Layout';
import { CRITERIA } from '../components/labels';

const MAX_SIZE_MB = Number(import.meta.env.VITE_CV_MAX_SIZE_MB ?? 5);

/** Quick client-side hint only; the backend validates the actual file content. */
function precheck(file: File): string | null {
  const looksLikePdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) return 'El archivo debe estar en formato PDF.';
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `El archivo supera el tamaño máximo de ${MAX_SIZE_MB} MB.`;
  }
  return null;
}

const STEPS: { icon: IconName; title: string; text: string }[] = [
  {
    icon: 'upload',
    title: 'Subí tu CV',
    text: 'Un PDF con tu experiencia. No hace falta registrarte ni completar formularios.',
  },
  {
    icon: 'search',
    title: 'Analizamos tu perfil',
    text: 'Extraemos tecnologías, experiencia, seniority, educación, idiomas y ubicación. Lo que no está en tu CV no se inventa.',
  },
  {
    icon: 'target',
    title: 'Recibí ofertas explicadas',
    text: 'Te mostramos solo las ofertas con compatibilidad media o alta, con el porqué de cada recomendación.',
  },
];

export function HomePage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Seleccioná tu CV en formato PDF.');
      return;
    }
    const problem = precheck(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const { cvId } = await api.uploadCv(file);
      navigate(`/cv/${cvId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el CV.');
      setUploading(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <span className="eyebrow">
              <Icon name="sparkle" size={16} />
              Ofertas tech actualizadas cada 12 horas
            </span>
            <h1 className="display">Encontrá ofertas que coinciden con tu CV</h1>
            <p className="hero__lead">
              Subí tu CV y comparamos tu perfil con cientos de ofertas de tecnología. Cada
              recomendación viene con su nivel de compatibilidad y la explicación de por qué encaja
              con vos.
            </p>
            <ul className="hero__facts">
              <li>
                <Icon name="lock" size={18} /> Sin registro
              </li>
              <li>
                <Icon name="bolt" size={18} /> Resultados en segundos
              </li>
              <li>
                <Icon name="check" size={18} /> Resultados explicados
              </li>
            </ul>
          </div>

          <form className="upload-card" onSubmit={onSubmit} noValidate>
            <h2 className="title-large">Analizá tu CV</h2>
            <Dropzone
              file={file}
              disabled={uploading}
              maxSizeMb={MAX_SIZE_MB}
              onFile={(f) => {
                setFile(f);
                setError(null);
              }}
            />
            {error && (
              <p className="field-error" role="alert">
                <Icon name="alert" size={18} />
                {error}
              </p>
            )}
            <button
              type="submit"
              className="button button--filled button--block"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="spinner spinner--small" aria-hidden="true" />
                  Subiendo…
                </>
              ) : (
                'Analizar CV'
              )}
            </button>
            <p className="upload-card__note">
              <Icon name="lock" size={16} />
              Tu CV se usa solo para calcular tus recomendaciones. No se publica ni se comparte.
            </p>
          </form>
        </div>
      </section>

      <Page>
        <section id="como-funciona" className="section">
          <h2 className="headline">Cómo funciona</h2>
          <ol className="steps">
            {STEPS.map((step, i) => (
              <li key={step.title} className={`step step--${i + 1}`}>
                <span className="step__number">{i + 1}</span>
                <span className="step__icon">
                  <Icon name={step.icon} size={24} />
                </span>
                <h3 className="title-medium">{step.title}</h3>
                <p className="body-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <h2 className="headline">Qué evaluamos</h2>
          <p className="section__lead">
            La compatibilidad combina siete criterios, en este orden de importancia: tecnologías,
            seniority y experiencia primero; después educación, idiomas, ubicación y modalidad. El
            cálculo es determinístico: el mismo CV y la misma oferta siempre dan el mismo resultado.
            Si un dato no aparece en tu CV, no cuenta ni a favor ni en contra.
          </p>
          <ul className="criteria-grid">
            {Object.entries(CRITERIA).map(([key, c]) => (
              <li key={key} className="criterion-tile">
                <span className="criterion-tile__icon">
                  <Icon name={c.icon} size={22} />
                </span>
                <div>
                  <h3 className="title-small">{c.label}</h3>
                  <p className="body-muted">{c.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </Page>
    </>
  );
}
