import type { CvRepository } from '../application/ports.js';
import type { Cv } from '../domain/entities.js';
import type { CvStatus } from '../domain/enums.js';
import type { Queryable } from '../infrastructure/db/pool.js';

interface CvRow {
  id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  extracted_text: string | null;
  processing_status: CvStatus;
  created_at: Date;
  updated_at: Date;
}

function toCv(row: CvRow): Cv {
  return {
    id: row.id,
    originalFilename: row.original_filename,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    extractedText: row.extracted_text,
    processingStatus: row.processing_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgCvRepository implements CvRepository {
  constructor(private readonly db: Queryable) {}

  async create(cv: Cv): Promise<void> {
    await this.db.query(
      `INSERT INTO cvs (id, original_filename, storage_path, mime_type, size_bytes,
                        extracted_text, processing_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        cv.id,
        cv.originalFilename,
        cv.storagePath,
        cv.mimeType,
        cv.sizeBytes,
        cv.extractedText,
        cv.processingStatus,
        cv.createdAt,
        cv.updatedAt,
      ],
    );
  }

  async findById(id: string): Promise<Cv | null> {
    const { rows } = await this.db.query<CvRow>('SELECT * FROM cvs WHERE id = $1', [id]);
    return rows[0] ? toCv(rows[0]) : null;
  }

  async updateStatus(id: string, status: CvStatus, extractedText?: string | null): Promise<void> {
    if (extractedText === undefined) {
      await this.db.query(
        'UPDATE cvs SET processing_status = $2, updated_at = now() WHERE id = $1',
        [id, status],
      );
      return;
    }
    await this.db.query(
      `UPDATE cvs SET processing_status = $2, extracted_text = $3, updated_at = now()
       WHERE id = $1`,
      [id, status, extractedText],
    );
  }
}
