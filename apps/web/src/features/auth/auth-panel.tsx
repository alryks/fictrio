"use client";

import { FormEvent, useState } from "react";
import { LogIn, LogOut, UserRoundPlus } from "lucide-react";
import { UserBadge } from "@/components/user-badge";
import { ApiError } from "@/lib/api";
import { login, logout, register } from "./auth-api";
import { useAuthStore } from "./auth-store";

type AuthMode = "login" | "register";
type FieldErrors = Record<string, string>;

export function AuthPanel() {
  const { user, isHydrated, setUser } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setFieldErrors({});

    try {
      const response =
        mode === "login"
          ? await login({ username, password })
          : await register({
              username,
              email,
              password,
              displayName: displayName || undefined,
            });

      setUser(response.user);
      setPassword("");
      setMessage(mode === "login" ? "Вы вошли в аккаунт" : "Аккаунт создан");
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            error.issues.map((issue) => [issue.path, issue.message]),
          ),
        );
        setMessage(null);
      } else {
        setMessage(
          error instanceof Error ? error.message : "Ошибка авторизации",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Even if the server call fails we clear the local user so the UI
      // reflects the user's intent.
    }
    setUser(null);
  }

  if (!isHydrated) {
    return (
      <div className="h-[232px] rounded-md border bg-card p-4 shadow-sm">
        <p className="text-sm text-muted-foreground">Загрузка сессии...</p>
      </div>
    );
  }

  if (user) {
    return (
      <section className="rounded-md border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <UserBadge name={user.username} size="md" tone="primary" />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{user.displayName}</h2>
            <p className="truncate text-sm text-muted-foreground">
              @{user.username}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {user.roles.map((role) => (
            <span
              className="rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground"
              key={role}
            >
              {role}
            </span>
          ))}
        </div>
        <button
          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition hover:border-primary hover:text-primary"
          onClick={handleLogout}
          type="button"
        >
          <LogOut className="size-4" />
          Выйти
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          {mode === "login" ? "Вход" : "Регистрация"}
        </h2>
        {mode === "login" ? (
          <LogIn className="size-4 text-primary" />
        ) : (
          <UserRoundPlus className="size-4 text-primary" />
        )}
      </div>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit} noValidate>
        <label className="block">
          <span className="text-sm font-medium">Имя пользователя</span>
          <input
            aria-invalid={Boolean(fieldErrors.username)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
          {fieldErrors.username ? (
            <span className="mt-1 block text-xs text-destructive">
              {fieldErrors.username}
            </span>
          ) : null}
        </label>
        {mode === "register" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium">Почта</span>
              <input
                aria-invalid={Boolean(fieldErrors.email)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              {fieldErrors.email ? (
                <span className="mt-1 block text-xs text-destructive">
                  {fieldErrors.email}
                </span>
              ) : null}
            </label>
            <label className="block">
              <span className="text-sm font-medium">Отображаемое имя</span>
              <input
                aria-invalid={Boolean(fieldErrors.displayName)}
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
              {fieldErrors.displayName ? (
                <span className="mt-1 block text-xs text-destructive">
                  {fieldErrors.displayName}
                </span>
              ) : null}
            </label>
          </>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium">Пароль</span>
          <input
            aria-invalid={Boolean(fieldErrors.password)}
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-destructive"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {fieldErrors.password ? (
            <span className="mt-1 block text-xs text-destructive">
              {fieldErrors.password}
            </span>
          ) : null}
        </label>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        <button
          className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)] disabled:opacity-60"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? "Отправка..."
            : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
        </button>
      </form>
      <button
        className="mt-3 text-sm text-primary hover:underline"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setMessage(null);
          setFieldErrors({});
        }}
        type="button"
      >
        {mode === "login" ? "Создать новый аккаунт" : "У меня уже есть аккаунт"}
      </button>
    </section>
  );
}
