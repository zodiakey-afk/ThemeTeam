import type { Snapshot } from './types';

export function validateSnapshot(data: unknown): data is Snapshot;
export function validateError(data: unknown): data is { error: { code: string; message: string } };
