/**
 * Builds a minimal, valid single-page PDF with one text line per entry (Helvetica,
 * WinAnsi encoding). Test-only helper so fixtures need no binary files or dependencies.
 */
export function makePdf(lines: readonly string[]): Buffer {
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = lines
    .map((line, i) => `BT /F1 10 Tf 50 ${800 - i * 14} Td (${escape(line)}) Tj ET`)
    .join('\n');
  const contentBytes = Buffer.from(content, 'latin1');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n', 'latin1')];
  const offsets: number[] = [];
  let length = chunks[0]!.length;
  const push = (buf: Buffer) => {
    chunks.push(buf);
    length += buf.length;
  };

  objects.forEach((body, i) => {
    offsets.push(length);
    push(Buffer.from(`${i + 1} 0 obj\n${body}\nendobj\n`, 'latin1'));
  });
  offsets.push(length);
  push(Buffer.from(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`, 'latin1'));
  push(contentBytes);
  push(Buffer.from('\nendstream\nendobj\n', 'latin1'));

  const xrefOffset = length;
  const xref = [
    'xref',
    `0 ${offsets.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${offsets.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
  ].join('\n');
  push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}

export const SAMPLE_CV_LINES: readonly string[] = [
  'María Fernández',
  'Desarrolladora Backend Semi Senior',
  'maria.fernandez@example.com | +54 11 5555-5555 | Capital Federal, Buenos Aires',
  'Perfil',
  'Desarrolladora backend con foco en APIs REST y microservicios.',
  'Experiencia laboral',
  'Desarrolladora Backend Semi Senior - Acme S.A.',
  'Marzo 2021 - Actualidad',
  'Desarrollo de microservicios con Java, Spring Boot y PostgreSQL.',
  'Despliegues con Docker en AWS.',
  'Desarrolladora Junior | Globant',
  'Enero 2019 - Febrero 2021',
  'Mantenimiento de aplicaciones Node.js y MySQL.',
  'Educación',
  'Ingeniería en Sistemas de Información - Universidad Tecnológica Nacional',
  '2013 - 2019',
  'Proyectos personales',
  'TechMatch - Plataforma de búsqueda de empleo',
  '2024 - 2025',
  'Matching de CVs con ofertas usando Node.js y PostgreSQL.',
  'API REST documentada y pruebas automatizadas.',
  'Bot de recordatorios',
  'Bot de Telegram en JavaScript para recordar vencimientos.',
  'Idiomas',
  'Inglés: avanzado (C1)',
  'Portugués: básico',
  'Habilidades',
  'Java, Spring, SQL, Git, JS, Scrum',
];
