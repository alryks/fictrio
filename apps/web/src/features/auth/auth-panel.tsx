"use client";

import { FormEvent, useState } from "react";
import { LogIn, LogOut, UserRoundPlus } from "lucide-react";
import { login, logout, register } from "./auth-api";
import { useAuthStore } from "./auth-store";

type AuthMode = "login" | "register";

export function AuthPanel() {
  const { user, isHydrated, setUser } = useAuthStore();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

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
      setMessage(error instanceof Error ? error.message : "Ошибка авторизации");
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
          <div className="grid size-11 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            {user.username.slice(0, 2).toUpperCase()}
          </div>
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
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-medium">Имя пользователя</span>
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            required
            value={username}
          />
        </label>
        {mode === "register" ? (
          <>
            <label className="block">
              <span className="text-sm font-medium">Почта</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Отображаемое имя</span>
              <input
                className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                onChange={(event) => setDisplayName(event.target.value)}
                value={displayName}
              />
            </label>
          </>
        ) : null}
        <label className="block">
          <span className="text-sm font-medium">Пароль</span>
          <input
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
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
        }}
        type="button"
      >
        {mode === "login" ? "Создать новый аккаунт" : "У меня уже есть аккаунт"}
      </button>
    </section>
  );
}
