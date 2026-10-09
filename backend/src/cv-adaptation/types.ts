/**
 * Editable CV document (docs/15-ADAPTACION-DE-CV.md). Dates are `YYYY-MM` or `YYYY`;
 * a null `endDate` means "Actualidad".
 */
export interface CvDocument {
  readonly personal: {
    readonly fullName: string;
    readonly headline: string | null;
    readonly email: string;
    readonly phone: string;
    readonly location: string | null;
    readonly links: readonly string[];
  };
  readonly summary: string;
  readonly experiences: readonly CvDocumentExperience[];
  readonly education: readonly CvDocumentEducation[];
  readonly skills: readonly { readonly name: string; readonly highlighted: boolean }[];
  readonly languages: readonly { readonly name: string; readonly level: string | null }[];
}

export interface CvDocumentExperience {
  readonly position: string | null;
  readonly company: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly highlights: readonly string[];
  readonly relevant: boolean;
}

export interface CvDocumentEducation {
  readonly degree: string | null;
  readonly institution: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export type SuggestionType =
  'MISSING_REQUIRED_SKILL' | 'MISSING_OPTIONAL_SKILL' | 'LANGUAGE' | 'EXPERIENCE' | 'MISSING_DATA';

/** Something the offer asks for that the CV does not show. Never added automatically. */
export interface AdaptationSuggestion {
  readonly type: SuggestionType;
  readonly message: string;
  /** Present for skill suggestions, so the editor can offer "La tengo, agregar". */
  readonly skill?: string;
}

export interface AdaptedDraft {
  readonly document: CvDocument;
  readonly suggestions: readonly AdaptationSuggestion[];
}
