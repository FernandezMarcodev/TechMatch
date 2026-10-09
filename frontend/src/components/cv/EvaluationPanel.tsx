import { useState } from 'react';
import { ApiError, api, type AdaptationEvaluation, type CvDocument } from '../../api/client';
import { Icon } from '../Icon';
import { LevelChip } from '../MatchBadge';
import { ReasonList } from '../ReasonList';

const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

interface EvaluationPanelProps {
  cvId: string;
  jobId: string;
  document: CvDocument;
}

/**
 * "¿Cómo queda con esta oferta?": re-evaluates the edited CV with the same matching engine
 * and compares it with the original. Results become stale as soon as the CV changes.
 */
export function EvaluationPanel({ cvId, jobId, document }: EvaluationPanelProps) {
  const [result, setResult] = useState<{ evaluation: AdaptationEvaluation; of: CvDocument } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stale = result !== null && result.of !== document;

  async function evaluate() {
    setLoading(true);
    setError(null);
    try {
      setResult({ evaluation: await api.evaluateAdaptation(cvId, jobId, document), of: document });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo calcular la compatibilidad.');
    } finally {
      setLoading(false);
    }
  }

  const evaluation = result?.evaluation;
  const delta = evaluation ? RANK[evaluation.adapted.level] - RANK[evaluation.original.level] : 0;

  return (
    <section className="card card--outlined evaluation" aria-labelledby="evaluation-title">
      <div className="evaluation__head">
        <div>
          <h2 id="evaluation-title" className="title-medium">
            <Icon name="target" size={18} /> ¿Cómo queda con esta oferta?
          </h2>
          <p className="field__hint">
            Usamos el mismo cálculo que en tus recomendaciones. No guardamos nada.
          </p>
        </div>
        <button
          type="button"
          className="button button--filled button--small"
          onClick={() => void evaluate()}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner spinner--small" aria-hidden="true" /> Calculando…
            </>
          ) : result ? (
            'Volver a calcular'
          ) : (
            'Calcular compatibilidad'
          )}
        </button>
      </div>

      {error && (
        <p className="field-error" role="alert">
          <Icon name="alert" size={18} />
          {error}
        </p>
      )}

      {evaluation && (
        <div
          className={stale ? 'evaluation__result evaluation__result--stale' : 'evaluation__result'}
        >
          <p className="evaluation__compare" aria-live="polite">
            <span>Antes</span>
            <LevelChip level={evaluation.original.level} />
            <Icon name="back" size={16} className="evaluation__arrow" />
            <span>Ahora</span>
            <LevelChip level={evaluation.adapted.level} />
          </p>
          <p className="body-muted">
            {delta > 0
              ? 'Tu CV adaptado encaja mejor con esta oferta.'
              : delta < 0
                ? 'Con estos cambios encaja menos: revisá lo que quitaste.'
                : 'La compatibilidad se mantiene. Revisá las razones para ver qué cambió.'}
          </p>
          {stale && (
            <p className="field__hint">
              <Icon name="alert" size={14} /> Hiciste cambios después de calcular: volvé a calcular.
            </p>
          )}
          <ReasonList reasons={evaluation.adapted.reasons} />
        </div>
      )}
    </section>
  );
}
