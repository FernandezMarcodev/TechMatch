export type CvStatus = 'uploaded' | 'processing' | 'processed' | 'failed';
export type MatchLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Modality = 'REMOTE' | 'HYBRID' | 'ONSITE' | null;

export interface MatchReason {
  criterion: string;
  status: 'positive' | 'negative' | 'neutral';
  message: string;
}

export interface Recommendation {
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    modality: Modality;
    source: string;
    sourceUrl: string;
  };
  match: { level: MatchLevel; reasons: MatchReason[] };
}

export interface JobDetail {
  id: string;
  title: string;
  company: string;
  location: string | null;
  modality: Modality;
  description: string;
  requirements: string[];
  skills: string[];
  source: { name: string; url: string };
  isActive: boolean;
}

/** Editable CV document (docs/15-ADAPTACION-DE-CV.md). Dates: "YYYY-MM" or "YYYY"; null end = "Actualidad". */
export interface CvDocument {
  personal: {
    fullName: string;
    headline: string | null;
    email: string;
    phone: string;
    location: string | null;
    links: string[];
  };
  summary: string;
  experiences: CvExperience[];
  education: CvEducation[];
  projects: CvProject[];
  skills: { name: string; highlighted: boolean }[];
  languages: { name: string; level: string | null }[];
}

export interface CvExperience {
  position: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  highlights: string[];
  relevant: boolean;
}

export interface CvEducation {
  degree: string | null;
  institution: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Personal or academic project. Dates are years ("YYYY"); null end = "En curso". */
export interface CvProject {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  highlights: string[];
  relevant: boolean;
}

export type SuggestionType =
  'MISSING_REQUIRED_SKILL' | 'MISSING_OPTIONAL_SKILL' | 'LANGUAGE' | 'EXPERIENCE' | 'MISSING_DATA';

export interface AdaptationSuggestion {
  type: SuggestionType;
  message: string;
  skill?: string;
}

export interface AdaptedDraft {
  job: { id: string; title: string; company: string };
  document: CvDocument;
  suggestions: AdaptationSuggestion[];
}

export interface AdaptationEvaluation {
  original: { level: MatchLevel };
  adapted: { level: MatchLevel; reasons: MatchReason[] };
}

/** Error following the backend contract: { error: { code, message, details } }. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Where the API lives. Empty: same origin (Vite proxy in development, or the backend serving
 * the frontend). In production on Cloudflare Pages it is the Render URL (docs/16-DESPLIEGUE.md).
 */
const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

const GENERIC_ERROR = 'No pudimos comunicarnos con el servidor. Intentá nuevamente.';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', GENERIC_ERROR, 0);
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? GENERIC_ERROR,
      res.status,
    );
  }
  return (body as { data: T }).data;
}

export const api = {
  /**
   * Wakes the backend up: on the free plan it sleeps when idle and takes about a minute to
   * start, so the home page calls this while the user picks a CV. Errors are ignored.
   */
  wakeUp(): void {
    void fetch(`${API_URL}/api/health`).catch(() => undefined);
  },
  uploadCv(file: File): Promise<{ cvId: string; status: CvStatus }> {
    const form = new FormData();
    form.append('file', file);
    return request('/cvs', { method: 'POST', body: form });
  },
  getCvStatus(cvId: string): Promise<{ id: string; status: CvStatus }> {
    return request(`/cvs/${encodeURIComponent(cvId)}`);
  },
  getRecommendations(cvId: string): Promise<{ cvId: string; recommendations: Recommendation[] }> {
    return request(`/recommendations/${encodeURIComponent(cvId)}`);
  },
  getJob(jobId: string): Promise<JobDetail> {
    return request(`/jobs/${encodeURIComponent(jobId)}`);
  },
  /**
   * Re-evaluates the edited CV. Name, email, phone and links are removed here: personal data
   * never leaves the browser.
   */
  evaluateAdaptation(
    cvId: string,
    jobId: string,
    document: CvDocument,
  ): Promise<AdaptationEvaluation> {
    const { headline, location } = document.personal;
    const body = { ...document, personal: { headline, location } };
    return request(
      `/cvs/${encodeURIComponent(cvId)}/adaptations/${encodeURIComponent(jobId)}/evaluation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  },
  getAdaptation(cvId: string, jobId: string): Promise<AdaptedDraft> {
    return request(`/cvs/${encodeURIComponent(cvId)}/adaptations/${encodeURIComponent(jobId)}`);
  },
};
