import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import {
  ApiError,
  api,
  type AdaptationSuggestion,
  type AdaptedDraft,
  type CvDocument,
} from '../api/client';
import { Icon } from '../components/Icon';
import { Page } from '../components/Layout';
import { StateView } from '../components/StateView';
import { CvEditor } from '../components/cv/CvEditor';
import { EvaluationPanel } from '../components/cv/EvaluationPanel';
import { CvSheet, paginate } from '../components/cv/CvSheet';

type State =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; draft: AdaptedDraft };

const SUGGESTIONS_PREVIEW = 3;

/** The edited CV lives only in this browser (docs/15-ADAPTACION-DE-CV.md). */
export function storageKey(cvId: string, jobId: string): string {
  return `techmatch:adaptation:${cvId}:${jobId}`;
}

function loadSaved(key: string): CvDocument | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as CvDocument;
    // Drafts saved before projects existed have none.
    return { ...saved, projects: saved.projects ?? [] };
  } catch {
    return null;
  }
}

function save(key: string, document: CvDocument | null): void {
  try {
    if (document) window.localStorage.setItem(key, JSON.stringify(document));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode, quota): editing still works, it just isn't kept.
  }
}

function SuggestionList({
  suggestions,
  document,
  onAddSkill,
}: {
  suggestions: AdaptationSuggestion[];
  document: CvDocument;
  onAddSkill: (skill: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  if (suggestions.length === 0) {
    return (
      <p className="body-muted">
        <Icon name="check" size={16} /> Tu CV ya cubre lo que pide la oferta.
      </p>
    );
  }
  const has = (skill: string) =>
    document.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase());
  // Real offers can produce many suggestions: show a few so the editor stays in view.
  const visible = showAll ? suggestions : suggestions.slice(0, SUGGESTIONS_PREVIEW);
  return (
    <>
      <ul className="suggestions">
        {visible.map((s) => (
          <li
            key={`${s.type}-${s.skill ?? s.message}`}
            className={`suggestion suggestion--${s.type.toLowerCase()}`}
          >
            <span>{s.message}</span>
            {s.skill &&
              (has(s.skill) ? (
                <span className="suggestion__done">
                  <Icon name="check" size={14} /> Agregada
                </span>
              ) : confirming === s.skill ? (
                <span className="suggestion__confirm">
                  ¿Realmente sabés {s.skill}?
                  <button
                    type="button"
                    className="button button--tonal button--small"
                    onClick={() => {
                      if (s.skill) onAddSkill(s.skill);
                      setConfirming(null);
                    }}
                  >
                    Sí, agregar
                  </button>
                  <button
                    type="button"
                    className="button button--text button--small"
                    onClick={() => setConfirming(null)}
                  >
                    Cancelar
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="button button--text button--small"
                  onClick={() => setConfirming(s.skill ?? null)}
                >
                  La tengo, agregar
                </button>
              ))}
          </li>
        ))}
      </ul>
      {suggestions.length > SUGGESTIONS_PREVIEW && (
        <button
          type="button"
          className="button button--text button--small suggestions__toggle"
          aria-expanded={showAll}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Ver menos' : `Ver todas (${suggestions.length})`}
          <Icon name="chevronDown" size={18} className={showAll ? 'rotate' : undefined} />
        </button>
      )}
    </>
  );
}

export function AdaptCvPage() {
  const { cvId = '', jobId = '' } = useParams();
  const key = storageKey(cvId, jobId);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [document, setDocument] = useState<CvDocument | null>(null);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [expanded, setExpanded] = useState(false);

  // Esc closes the enlarged preview.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [nameMissing, setNameMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAdaptation(cvId, jobId)
      .then((draft) => {
        if (cancelled) return;
        setState({ kind: 'ready', draft });
        setDocument(loadSaved(key) ?? draft.document);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message: err instanceof ApiError ? err.message : 'No se pudo preparar el CV adaptado.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cvId, jobId, key]);

  function update(next: CvDocument) {
    setDocument(next);
    save(key, next);
    if (next.personal.fullName.trim()) setNameMissing(false);
  }

  const back = (
    <Link to={`/cv/${encodeURIComponent(cvId)}/recomendaciones`} className="button button--text">
      <Icon name="back" size={18} />
      Volver a las recomendaciones
    </Link>
  );

  if (state.kind === 'error') {
    return (
      <Page narrow>
        <StateView icon="alert" tone="error" title="No pudimos adaptar el CV" actions={back}>
          <p role="alert">{state.message}</p>
        </StateView>
      </Page>
    );
  }

  if (state.kind === 'loading' || !document) {
    return (
      <Page>
        <div className="loading-row">
          <span className="spinner" aria-hidden="true" />
          <p>Preparando tu CV adaptado…</p>
        </div>
      </Page>
    );
  }

  const { draft } = state;
  const doc = document;

  /**
   * Exports the Harvard preview through the browser's print dialog ("Guardar como PDF").
   * The print stylesheet hides everything else; the page title becomes the file name.
   */
  function downloadPdf() {
    const name = doc.personal.fullName.trim();
    if (!name) {
      setNameMissing(true);
      return;
    }
    const page = window.document;
    const previousTitle = page.title;
    page.title = `CV - ${name} - ${draft.job.company}`;
    window.addEventListener('afterprint', () => (page.title = previousTitle), { once: true });
    // On a phone the editor tab hides the preview, so its pages were never laid out: show it
    // and paginate it now, because the printed page breaks are the ones it marks.
    flushSync(() => setView('preview'));
    const paper = page.querySelector<HTMLElement>('.print-target .cv-paper');
    if (paper && paper.offsetHeight > 0) paginate(paper);
    window.print();
  }
  return (
    <Page>
      <nav className="detail-nav">{back}</nav>
      <header className="adapt-header">
        <div>
          <h1 className="headline-large">Adaptá tu CV</h1>
          <p className="body-muted">
            Para <strong>{draft.job.title}</strong> en {draft.job.company}. Reordenamos y destacamos
            lo que ya está en tu CV; no agregamos nada que no tengas.
          </p>
        </div>
        <div className="adapt-header__actions">
          <button type="button" className="button button--filled" onClick={downloadPdf}>
            <Icon name="file" size={18} />
            Descargar PDF
          </button>
          {confirmReset ? (
            <span className="suggestion__confirm">
              ¿Descartar tus cambios?
              <button
                type="button"
                className="button button--tonal button--small"
                onClick={() => {
                  save(key, null);
                  setDocument(draft.document);
                  setConfirmReset(false);
                }}
              >
                Sí, restablecer
              </button>
              <button
                type="button"
                className="button button--text button--small"
                onClick={() => setConfirmReset(false)}
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="button button--outlined button--small"
              onClick={() => setConfirmReset(true)}
            >
              Restablecer borrador
            </button>
          )}
        </div>
      </header>

      {nameMissing && (
        <p className="banner banner--warning adapt-banner" role="alert">
          <Icon name="alert" size={18} />
          Completá tu nombre en "Datos personales" antes de descargar el CV.
        </p>
      )}

      <section
        className="card card--outlined adapt-suggestions"
        aria-labelledby="suggestions-title"
      >
        <h2 id="suggestions-title" className="title-medium">
          <Icon name="sparkle" size={18} /> Sugerencias para esta oferta
        </h2>
        <p className="field__hint">Agregá solo lo que realmente sabés.</p>
        <SuggestionList
          suggestions={draft.suggestions}
          document={doc}
          onAddSkill={(skill) =>
            update({ ...doc, skills: [...doc.skills, { name: skill, highlighted: true }] })
          }
        />
      </section>

      <EvaluationPanel cvId={cvId} jobId={jobId} document={doc} />

      <div className="segmented" role="tablist" aria-label="Vista">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'edit'}
          onClick={() => setView('edit')}
        >
          Editar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'preview'}
          onClick={() => setView('preview')}
        >
          Vista previa
        </button>
      </div>

      <div className={`adapt-layout adapt-layout--${view}`}>
        <div className="adapt-layout__editor">
          <CvEditor document={doc} onChange={update} />
        </div>
        <div className="adapt-layout__preview print-target">
          <CvSheet document={doc} onExpand={() => setExpanded(true)} />
        </div>
      </div>

      {expanded && (
        <div
          className="cv-zoom"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa ampliada"
          onClick={(e) => e.target === e.currentTarget && setExpanded(false)}
        >
          <div className="cv-zoom__body">
            <button
              type="button"
              className="button button--filled button--small cv-zoom__close"
              onClick={() => setExpanded(false)}
              autoFocus
            >
              <Icon name="close" size={16} /> Cerrar
            </button>
            <CvSheet document={doc} />
          </div>
        </div>
      )}
    </Page>
  );
}
