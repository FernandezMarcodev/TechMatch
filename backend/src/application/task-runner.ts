import type { Logger } from '../infrastructure/logging/logger.js';

/**
 * Runs work in the background of the API process (CV processing). Keeps track of pending
 * tasks so shutdown and tests can wait for them.
 */
export class TaskRunner {
  private readonly pending = new Set<Promise<void>>();

  constructor(private readonly logger: Logger) {}

  run(name: string, task: () => Promise<void>): void {
    const promise = task()
      .catch((err: unknown) => {
        this.logger.error({ err, task: name }, 'Background task failed');
      })
      .finally(() => {
        this.pending.delete(promise);
      });
    this.pending.add(promise);
  }

  async whenIdle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }
}
