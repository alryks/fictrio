import type { ApiErrorBody, FieldIssue } from "@fictrio/contracts";

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

const CSRF_COOKIE_NAME = "fictrio_csrf";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues: FieldIssue[] = [],
  ) {
    super(message);
  }

  /** Returns the first validation message for a given field, if any. */
  fieldError(path: string): string | undefined {
    return this.issues.find((issue) => issue.path === path)?.message;
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
    const { message, issues } = await getErrorDetails(response);
    throw new ApiError(message, response.status, issues);
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

async function getErrorDetails(
  response: Response,
): Promise<{ message: string; issues: FieldIssue[] }> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    const issues = body.details ?? [];
    const message =
      typeof body.message === "string"
        ? body.message
        : (issues[0]?.message ?? "Ошибка запроса");
    return { message, issues };
  } catch {
    return { message: "Ошибка запроса", issues: [] };
  }
}
