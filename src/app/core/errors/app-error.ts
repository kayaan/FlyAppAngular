export type AppErrorType =
  | 'network'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'server'
  | 'unknown';

export interface AppErrorOptions {
  type: AppErrorType;
  message: string;
  status?: number;
  code?: string | null;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly type: AppErrorType;
  readonly status: number | null;
  readonly code: string | null;
  readonly details: unknown;
  override readonly cause: unknown;

  constructor(options: AppErrorOptions) {
    super(options.message);

    this.name = 'AppError';
    this.type = options.type;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
    this.details = options.details;
    this.cause = options.cause;
  }
}