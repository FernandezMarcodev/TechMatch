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
 * Trimmed: a stray space pasted into the hosting panel would break every request.
 */
export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

export function normalizeApiUrl(value: string | undefined): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

const GENERIC_ERROR = 'No pudimos comunicarnos con el servidor. Intentá nuevamente.';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: User;
}

const TOKEN_KEY = 'techmatch.session';

/**
 * Session token (docs/17-CUENTAS-DE-USUARIO.md). Frontend and API live on different domains,
 * so the session travels in the Authorization header instead of a cookie. Storage can be
 * unavailable (private mode, blocked site data): then the session lasts until the tab closes.
 */
let memoryToken: string | null = null;

export const sessionToken = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY) ?? memoryToken;
    } catch {
      return memoryToken;
    }
  },
  set(token: string): void {
    memoryToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Kept in memory only.
    }
  },
  clear(): void {
    memoryToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Nothing stored.
    }
  },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionToken.get();
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, { ...init, headers });
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
  // 204 No Content (logout) has no body.
  return (body as { data: T } | null)?.data as T;
}

function postJson<T>(path: string, body: unknown, method: 'POST' | 'DELETE' = 'POST'): Promise<T> {
  return request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Public market trends over the active offers (docs/18-PANEL-DE-TENDENCIAS.md). */
/** A technology the offers require and the CV does not show, with the % of offers. */
export interface MissingSkill {
  name: string;
  percent: number;
}

export type SkillArea =
  'LANGUAGES' | 'FRONTEND' | 'BACKEND' | 'DATA' | 'CLOUD_DEVOPS' | 'PRACTICES';

export interface OfferStats {
  generatedAt: string;
  totals: { offers: number; companies: number; remotePercent: number; englishPercent: number };
  topSkills: { name: string; count: number; percent: number }[];
  skillAreas: { area: SkillArea; count: number; percent: number }[];
  seniority: {
    level: string;
    count: number;
    avgExperienceYears: number | null;
    englishPercent: number;
  }[];
  modality: { modality: Modality; count: number }[];
  sources: { source: string; count: number }[];
  topCompanies: { name: string; count: number }[];
}

/** A CV the user chose to save in their account. */
export interface SavedCv {
  id: string;
  originalFilename: string;
  createdAt: string;
  savedAt: string;
  recommendationCount: number;
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
  /**
   * Without a session the API returns only the first recommendations and counts the rest in
   * `hiddenCount` (an account privilege); with a session, all of them. `saved`: the CV is in
   * the user's account.
   */
  getRecommendations(cvId: string): Promise<{
    cvId: string;
    recommendations: Recommendation[];
    hiddenCount: number;
    saved: boolean;
  }> {
    return request(`/recommendations/${encodeURIComponent(cvId)}`);
  },
  /** "Qué te falta": in-demand technologies not found in the CV. */
  getMissingSkills(cvId: string): Promise<{ cvId: string; skills: MissingSkill[] }> {
    return request(`/cvs/${encodeURIComponent(cvId)}/missing-skills`);
  },
  /** "Guardar en mi cuenta": saving is the user's choice; unsaved CVs expire. */
  saveCv(cvId: string): Promise<{ id: string; saved: boolean }> {
    return request(`/cvs/${encodeURIComponent(cvId)}/save`, { method: 'POST' });
  },
  deleteCv(cvId: string): Promise<void> {
    return request(`/cvs/${encodeURIComponent(cvId)}`, { method: 'DELETE' });
  },
  getOfferStats(): Promise<OfferStats> {
    return request('/stats/offers');
  },
  getMyCvs(): Promise<{ cvs: SavedCv[] }> {
    return request('/me/cvs');
  },
  /** Irreversible: deletes the account and its saved CVs. The password confirms it. */
  deleteAccount(password: string): Promise<void> {
    return postJson('/auth/account', { password }, 'DELETE');
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
  register(email: string, password: string): Promise<{ user: User }> {
    return postJson('/auth/register', { email, password });
  },
  login(email: string, password: string): Promise<LoginResult> {
    return postJson('/auth/login', { email, password });
  },
  logout(): Promise<void> {
    return request('/auth/logout', { method: 'POST' });
  },
  me(): Promise<{ user: User }> {
    return request('/auth/me');
  },
  verifyEmail(token: string): Promise<{ user: User }> {
    return postJson('/auth/verify-email', { token });
  },
  /** Always succeeds for a well-formed email: the API does not reveal which ones have an account. */
  resendVerification(email: string): Promise<void> {
    return postJson('/auth/verify-email/resend', { email });
  },
  /** Always succeeds for a well-formed email: the API does not reveal which ones have an account. */
  requestPasswordReset(email: string): Promise<void> {
    return postJson('/auth/password-reset', { email });
  },
  resetPassword(token: string, password: string): Promise<void> {
    return postJson('/auth/password-reset/confirm', { token, password });
  },
};
