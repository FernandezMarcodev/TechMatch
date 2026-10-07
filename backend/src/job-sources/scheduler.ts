import type { Logger } from '../infrastructure/logging/logger.js';

/** Runs a job every `intervalHours`, never overlapping runs. */
export class IntervalScheduler {
  private timer: NodeJS.Timeout | undefined;
  private running: Promise<void> | undefined;

  constructor(
    private readonly task: () => Promise<unknown>,
    private readonly intervalHours: number,
    private readonly logger: Logger,
  ) {}

  start(runImmediately: boolean): void {
    this.timer = setInterval(() => this.tick(), this.intervalHours * 60 * 60 * 1000);
    this.timer.unref();
    if (runImmediately) this.tick();
    this.logger.info({ intervalHours: this.intervalHours }, 'Job sync scheduler started');
  }

  async stop(): Promise<void> {
    clearInterval(this.timer);
    await this.running;
  }

  private tick(): void {
    if (this.running) {
      this.logger.warn('Previous job sync still in progress; skipping this tick');
      return;
    }
    this.running = this.task()
      .then(() => undefined)
      .catch((err: unknown) => {
        this.logger.error({ err }, 'Scheduled job sync failed');
      })
      .finally(() => {
        this.running = undefined;
      });
  }
}
