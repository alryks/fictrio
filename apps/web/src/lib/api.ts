export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

const CSRF_COOKIE_NAME = "fictrio_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type ApiErrorBody = {
  message?: unknown;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const method = (options.method ?? "GET").toUpperCase();
  if (!SAFE_METHODS.has(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = getCsrfTokenFromCookie();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Bootstraps the CSRF cookie on app load. The server sets a cookie that is
 * not HttpOnly so the client can echo it back in the X-CSRF-Token header on
 * mutations (double-submit cookie pattern).
 */
export async function bootstrapCsrfToken(): Promise<void> {
  await apiRequest<{ csrfToken: string }>("/auth/csrf");
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`),
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return typeof body.message === "string" ? body.message : "Ошибка запроса";
  } catch {
    return "Ошибка запроса";
  }
}
