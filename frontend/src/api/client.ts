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

const GENERIC_ERROR = 'No pudimos comunicarnos con el servidor. Intentá nuevamente.';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, init);
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
};
