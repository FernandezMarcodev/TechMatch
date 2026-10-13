import type { CvRepository } from '../application/ports.js';
import type { Cv, SavedCv } from '../domain/entities.js';
import type { CvStatus } from '../domain/enums.js';
import type { Queryable } from '../infrastructure/db/pool.js';

interface CvRow {
  id: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  processing_status: CvStatus;
  user_id: string | null;
  saved_at: Date | null;
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
    processingStatus: row.processing_status,
    userId: row.user_id,
    savedAt: row.saved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgCvRepository implements CvRepository {
  constructor(private readonly db: Queryable) {}

  async create(cv: Cv): Promise<void> {
    await this.db.query(
      `INSERT INTO cvs (id, original_filename, storage_path, mime_type, size_bytes,
                        processing_status, user_id, saved_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        cv.id,
        cv.originalFilename,
        cv.storagePath,
        cv.mimeType,
        cv.sizeBytes,
        cv.processingStatus,
        cv.userId,
        cv.savedAt,
        cv.createdAt,
        cv.updatedAt,
      ],
    );
  }

  async findById(id: string): Promise<Cv | null> {
    const { rows } = await this.db.query<CvRow>('SELECT * FROM cvs WHERE id = $1', [id]);
    return rows[0] ? toCv(rows[0]) : null;
  }

  async updateStatus(id: string, status: CvStatus): Promise<void> {
    await this.db.query('UPDATE cvs SET processing_status = $2, updated_at = now() WHERE id = $1', [
      id,
      status,
    ]);
  }

  async failInterrupted(): Promise<number> {
    const result = await this.db.query(
      `UPDATE cvs SET processing_status = 'FAILED', updated_at = now()
       WHERE processing_status IN ('UPLOADED', 'PROCESSING')`,
    );
    return result.rowCount ?? 0;
  }

  async deleteCreatedBefore(cutoff: Date): Promise<number> {
    // ON DELETE CASCADE removes the candidate profile and the match results too.
    // Saved CVs belong to their owner: they live until the owner deletes them.
    const result = await this.db.query(
      'DELETE FROM cvs WHERE created_at < $1 AND user_id IS NULL',
      [cutoff],
    );
    return result.rowCount ?? 0;
  }

  async saveForUser(cvId: string, userId: string, now: Date): Promise<void> {
    await this.db.query(
      `UPDATE cvs SET user_id = $2, saved_at = COALESCE(saved_at, $3), updated_at = $3
       WHERE id = $1`,
      [cvId, userId, now],
    );
  }

  async findSavedByUser(userId: string): Promise<SavedCv[]> {
    const { rows } = await this.db.query<{
      id: string;
      original_filename: string;
      created_at: Date;
      saved_at: Date;
      recommendation_count: string;
    }>(
      `SELECT c.id, c.original_filename, c.created_at, c.saved_at,
              COUNT(jo.id) AS recommendation_count
       FROM cvs c
       LEFT JOIN match_results mr ON mr.cv_id = c.id AND mr.level IN ('MEDIUM', 'HIGH')
       LEFT JOIN job_offers jo ON jo.id = mr.job_offer_id AND jo.is_active
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.saved_at DESC, c.id`,
      [userId],
    );
    return rows.map((row) => ({
      id: row.id,
      originalFilename: row.original_filename,
      createdAt: row.created_at,
      savedAt: row.saved_at,
      recommendationCount: Number(row.recommendation_count),
    }));
  }

  async delete(cvId: string): Promise<void> {
    await this.db.query('DELETE FROM cvs WHERE id = $1', [cvId]);
  }
}
