import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FileStorage } from '../../application/ports.js';

const SAFE_NAME = /^[0-9a-f-]{36}\.pdf$/;

/**
 * Stores uploaded CVs in a private directory (not served over HTTP). Files are named by
 * their UUID only; the stored path is relative and validated on read to prevent traversal.
 */
export class LocalFileStorage implements FileStorage {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir);
  }

  async save(id: string, content: Buffer): Promise<string> {
    const name = `${id}.pdf`;
    const target = this.resolve(name);
    await mkdir(this.baseDir, { recursive: true });
    await writeFile(target, content, { flag: 'wx', mode: 0o600 });
    return name;
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(this.resolve(storagePath));
  }

  private resolve(name: string): string {
    if (!SAFE_NAME.test(name)) throw new Error('Invalid storage path');
    const full = path.resolve(this.baseDir, name);
    if (path.dirname(full) !== this.baseDir) throw new Error('Invalid storage path');
    return full;
  }
}
