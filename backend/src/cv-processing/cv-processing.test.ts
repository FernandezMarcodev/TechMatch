import { describe, expect, it } from 'vitest';
import { SAMPLE_CV_LINES, makePdf } from '../../test/support/make-pdf.js';
import { AppError } from '../application/errors.js';
import { CvProcessor } from './cv-processor.js';
import { findDateRanges, totalMonths } from './dates.js';
import { sanitizeFilename, validatePdfUpload } from './pdf-validation.js';
import { extractProfile } from './profile-extractor.js';
import { segment } from './sections.js';
import { cleanText } from './text-cleanup.js';
import { PdfTextExtractor, disabledOcr } from './text-extraction.js';

const REFERENCE_DATE = new Date('2026-03-01T00:00:00Z');
const MB = 1024 * 1024;

function upload(content: Buffer, declaredMimeType = 'application/pdf') {
  return { originalName: 'cv.pdf', declaredMimeType, content };
}

describe('validatePdfUpload', () => {
  it('accepts a real PDF', () => {
    expect(() => validatePdfUpload(upload(makePdf(['hola'])), MB)).not.toThrow();
  });

  it('rejects non-PDF content even when the client claims application/pdf', () => {
    const fake = Buffer.from('MZ\x90\x00 this is an executable');
    expect(() => validatePdfUpload(upload(fake), MB)).toThrow(
      expect.objectContaining({ code: 'INVALID_FILE' }),
    );
  });

  it('rejects empty and oversized files', () => {
    expect(() => validatePdfUpload(upload(Buffer.alloc(0)), MB)).toThrow(
      expect.objectContaining({ code: 'INVALID_FILE' }),
    );
    expect(() => validatePdfUpload(upload(makePdf(['x'])), 10)).toThrow(
      expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
    );
  });

  it('sanitizes file names (no paths, no control chars)', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('C:\\Users\\x\\mi cv.pdf')).toBe('mi cv.pdf');
    expect(sanitizeFilename('\u0000')).toBe('cv.pdf');
  });
});

describe('dates', () => {
  it.each([
    ['Marzo 2021 - Actualidad', { year: 2021, month: 3 }, null],
    ['ene. 2019 – dic. 2020', { year: 2019, month: 1 }, { year: 2020, month: 12 }],
    ['01/2018 a 06/2019', { year: 2018, month: 1 }, { year: 2019, month: 6 }],
    ['2013 - 2019', { year: 2013, month: 6 }, { year: 2019, month: 6 }],
  ])('parses "%s"', (line, start, end) => {
    const [range] = findDateRanges(line);
    expect(range?.start).toEqual(start);
    expect(range?.end).toEqual(end);
  });

  it('ignores reversed ranges and plain numbers', () => {
    expect(findDateRanges('2020 - 2018')).toEqual([]);
    expect(findDateRanges('Tel 1155552020')).toEqual([]);
  });

  it('counts overlapping periods once', () => {
    const ranges = [
      ...findDateRanges('Ene 2020 - Dic 2020'),
      ...findDateRanges('Jun 2020 - Jun 2021'),
    ];
    expect(totalMonths(ranges, { year: 2026, month: 1 })).toBe(17);
  });
});

describe('cleanText', () => {
  it('normalizes bullets, whitespace and hyphenation', () => {
    const raw = '• Java\u00a0\u00a0y   Spring\r\n\n\n- desa-\nrrollo\u0007';
    expect(cleanText(raw)).toBe('Java y Spring\n\ndesarrollo');
  });
});

describe('segment', () => {
  it('splits by known headings', () => {
    const s = segment('Juan\nEXPERIENCIA LABORAL:\nDev\nEducación\nUTN\nIdiomas\nInglés');
    expect(s.header).toEqual(['Juan']);
    expect(s.experience).toEqual(['Dev']);
    expect(s.education).toEqual(['UTN']);
    expect(s.languages).toEqual(['Inglés']);
  });
});

describe('extractProfile', () => {
  const profile = extractProfile(SAMPLE_CV_LINES.join('\n'), REFERENCE_DATE);

  it('extracts skills with aliases normalized', () => {
    const names = profile.skills.map((s) => s.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Java',
        'Spring',
        'Spring Boot',
        'SQL',
        'PostgreSQL',
        'Docker',
        'AWS',
        'Node.js',
        'MySQL',
        'Git',
        'JavaScript',
        'Scrum',
      ]),
    );
  });

  it('extracts experiences and total years without double counting', () => {
    expect(profile.experiences).toHaveLength(2);
    expect(profile.experiences[0]).toMatchObject({
      position: 'Desarrolladora Backend Semi Senior',
      company: 'Acme S.A.',
      startDate: '2021-03-01',
      endDate: null,
    });
    expect(profile.experiences[1]).toMatchObject({
      position: 'Desarrolladora Junior',
      company: 'Globant',
    });
    // Jan 2019 → Feb 2021 (25 months) + Mar 2021 → Mar 2026 (60 months) = 85 months
    expect(profile.totalExperienceYears).toBe(7.1);
  });

  it('detects seniority from the most recent position', () => {
    expect(profile.seniority).toBe('SEMI_SENIOR');
  });

  it('extracts education with level and field', () => {
    expect(profile.education).toEqual([
      expect.objectContaining({
        level: 'UNIVERSITY',
        degree: 'Ingeniería en Sistemas de Información',
        field: 'Sistemas de Información',
        institution: 'Universidad Tecnológica Nacional',
      }),
    ]);
  });

  it('extracts languages with levels', () => {
    expect(profile.languages).toEqual([
      { name: 'English', level: 'C1' },
      { name: 'Portuguese', level: 'A2' },
    ]);
  });

  it('extracts location from the header', () => {
    expect(profile.location).toBe('Capital Federal, Buenos Aires');
  });

  it('does not invent missing information', () => {
    const minimal = extractProfile(
      'Juan Pérez\nProgramador\nConocimientos de Python',
      REFERENCE_DATE,
    );
    expect(minimal).toMatchObject({
      seniority: 'UNKNOWN',
      totalExperienceYears: null,
      location: null,
      experiences: [],
      education: [],
      languages: [],
      summary: null,
    });
    expect(minimal.skills.map((s) => s.name)).toEqual(['Python']);
  });

  it('uses explicitly stated years when there are no dated experiences', () => {
    const p = extractProfile(
      'Perfil\nDesarrollador con 4 años de experiencia en React',
      REFERENCE_DATE,
    );
    expect(p.totalExperienceYears).toBe(4);
  });

  it('is deterministic', () => {
    expect(extractProfile(SAMPLE_CV_LINES.join('\n'), REFERENCE_DATE)).toEqual(profile);
  });
});

describe('CvProcessor with real PDFs', () => {
  const processor = new CvProcessor(new PdfTextExtractor(), disabledOcr, 50);

  it('extracts text and builds a profile from a PDF', async () => {
    const result = await processor.process(makePdf(SAMPLE_CV_LINES), REFERENCE_DATE);
    expect(result.text.split('\n')[0]).toBe('María Fernández');
    expect(result.profile.seniority).toBe('SEMI_SENIOR');
    expect(result.profile.languages[0]).toEqual({ name: 'English', level: 'C1' });
  });

  it('fails clearly when the PDF has no usable text and OCR is unavailable', async () => {
    await expect(processor.process(makePdf([]), REFERENCE_DATE)).rejects.toMatchObject({
      code: 'PDF_NOT_PROCESSABLE',
    });
  });

  it('rejects corrupt PDFs', async () => {
    const corrupt = Buffer.from('%PDF-1.4\nthis is not really a pdf');
    await expect(new PdfTextExtractor().assertReadable(corrupt)).rejects.toBeInstanceOf(AppError);
  });
});
