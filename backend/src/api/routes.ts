import { Router, type Request } from 'express';
import multer from 'multer';
import type { AdaptationService } from '../application/adaptation-service.js';
import type { CvService } from '../application/cv-service.js';
import { AppError } from '../application/errors.js';
import { evaluationDocumentSchema } from '../cv-adaptation/document-schema.js';
import type { QueryService } from '../application/query-service.js';
import {
  toAdaptationEvaluationDto,
  toAdaptedDraftDto,
  toCvStatusDto,
  toJobDetailDto,
  toRecommendationDto,
} from './dto.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idParam(req: Request, name: string, notFound: AppError): string {
  const value = req.params[name];
  // Malformed ids cannot exist, so they are reported as not found.
  if (typeof value !== 'string' || !UUID.test(value)) throw notFound;
  return value;
}

const cvNotFound = () => new AppError('CV_NOT_FOUND', 'No se encontró el CV solicitado.');
const jobNotFound = () => new AppError('JOB_NOT_FOUND', 'No se encontró la oferta solicitada.');

export interface RouteDeps {
  cvService: CvService;
  queries: QueryService;
  adaptation: AdaptationService;
  maxUploadBytes: number;
}

export function createRoutes({
  cvService,
  queries,
  adaptation,
  maxUploadBytes,
}: RouteDeps): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxUploadBytes, files: 1, fields: 0, parts: 2 },
  });

  router.post('/cvs', upload.single('file'), async (req, res) => {
    if (!req.file) {
      throw new AppError('INVALID_FILE', 'Debe enviarse un archivo PDF en el campo "file".');
    }
    const result = await cvService.upload({
      originalName: req.file.originalname,
      declaredMimeType: req.file.mimetype,
      content: req.file.buffer,
    });
    res.status(201).json({ data: { cvId: result.cvId, status: toCvStatusDto(result.status) } });
  });

  router.get('/cvs/:cvId', async (req, res) => {
    const cvId = idParam(req, 'cvId', cvNotFound());
    const status = await cvService.getStatus(cvId);
    res.json({ data: { id: cvId, status: toCvStatusDto(status) } });
  });

  router.get('/recommendations/:cvId', async (req, res) => {
    const cvId = idParam(req, 'cvId', cvNotFound());
    const recommendations = await queries.getRecommendations(cvId);
    res.json({ data: { cvId, recommendations: recommendations.map(toRecommendationDto) } });
  });

  // CV adaptation to an offer (docs/15-ADAPTACION-DE-CV.md).
  router.get('/cvs/:cvId/adaptations/:jobId', async (req, res) => {
    const cvId = idParam(req, 'cvId', cvNotFound());
    const jobId = idParam(req, 'jobId', jobNotFound());
    const draft = await adaptation.getDraft(cvId, jobId);
    res.json({ data: toAdaptedDraftDto(draft) });
  });

  router.post('/cvs/:cvId/adaptations/:jobId/evaluation', async (req, res) => {
    const cvId = idParam(req, 'cvId', cvNotFound());
    const jobId = idParam(req, 'jobId', jobNotFound());
    const parsed = evaluationDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('INVALID_CV_DOCUMENT', 'El CV enviado no tiene un formato válido.', {
        issues: parsed.error.issues.slice(0, 10).map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const evaluation = await adaptation.evaluate(cvId, jobId, parsed.data);
    res.json({ data: toAdaptationEvaluationDto(evaluation) });
  });

  router.get('/jobs/:jobId', async (req, res) => {
    const jobId = idParam(req, 'jobId', jobNotFound());
    const job = await queries.getJob(jobId);
    res.json({ data: toJobDetailDto(job) });
  });

  return router;
}
