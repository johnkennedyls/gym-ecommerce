const STORAGE_KEY = 'gymsoftware.session';

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: import('../types/api').PublicUser;
};

export function readSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed?.accessToken && parsed?.refreshToken ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSession(session: StoredSession | null): void {
  if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(STORAGE_KEY);
}

// Vite sustituye `import.meta.env` al compilar; el cast permite analizar el archivo sin los tipos de `vite/client`.
const API_BASE =
  (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL?.replace(/\/$/, '') ??
  '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: string[];

  constructor(status: number, message: string, fieldErrors: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/** La API responde con 401 cuando el access token expira: se renueva una sola vez por petición. */
let refreshPromise: Promise<StoredSession | null> | null = null;

async function refreshSession(): Promise<StoredSession | null> {
  const current = readSession();
  if (!current) return null;
  refreshPromise ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!response.ok) {
        writeSession(null);
        return null;
      }
      const data = await response.json();
      const next: StoredSession = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      };
      writeSession(next);
      window.dispatchEvent(new CustomEvent('gymsoftware:session-changed'));
      return next;
    } catch {
      writeSession(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

function parseMessage(payload: unknown, status: number): ApiError {
  const raw = (payload as { message?: string | string[] } | undefined)?.message;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const fallback =
    status === 401
      ? 'Tu sesión expiró. Inicia sesión nuevamente.'
      : status === 403
        ? 'No tienes permisos para ejecutar esta operación.'
        : status === 429
          ? 'Demasiados intentos en poco tiempo. Espera un momento.'
          : 'No fue posible completar la operación.';
  return new ApiError(status, list[0] ?? fallback, list);
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Envía el token de sesión; las rutas públicas lo omiten para no renovarse. */
  auth?: boolean;
};

async function send(url: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = options;
  const url = buildUrl(path, query);
  const token = auth ? readSession()?.accessToken : undefined;

  const init: RequestInit = {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response = await send(url, init, token);

  if (response.status === 401 && auth && readSession()?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) response = await send(url, init, renewed.accessToken);
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw parseMessage(payload, response.status);
  return payload as T;
}

export async function postSession(path: string, body: unknown): Promise<StoredSession> {
  const data = await request<import('../types/api').Session>(path, { method: 'POST', body, auth: false });
  const session: StoredSession = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
  writeSession(session);
  window.dispatchEvent(new CustomEvent('gymsoftware:session-changed'));
  return session;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>(path, { query }),
  post: <T>(path: string, body?: unknown, query?: Query) =>
    request<T>(path, { method: 'POST', body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
