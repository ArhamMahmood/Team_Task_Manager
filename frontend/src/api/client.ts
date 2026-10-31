import type { ValidationDetail } from './types';

type ApiErrorPayload = {
  error?: {
    message?: string;
    code?: string;
    details?: ValidationDetail[];
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ValidationDetail[];

  constructor(status: number, payload: ApiErrorPayload | null) {
    super(payload?.error?.message ?? 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload?.error?.code ?? 'UNKNOWN';
    this.details = payload?.error?.details ?? [];
  }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';
const UNAUTHORIZED_EVENT = 'app:unauthorized';

/** Lets the auth context react when any request returns 401. */
export function onUnauthorized(handler: () => void) {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
