"use client";

import { FormEvent, useState } from "react";
import { LogIn, LogOut, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
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
      <Card className="h-[232px] p-4">
        <p className="text-sm text-muted-foreground">Загрузка сессии...</p>
      </Card>
    );
  }

  if (user) {
    return (
      <Card className="p-4">
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
        <Button
          variant="outline"
          className="mt-4 h-10 w-full"
          onClick={handleLogout}
          type="button"
        >
          <LogOut className="size-4" />
          Выйти
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
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
        <FormField label="Имя пользователя" error={fieldErrors.username}>
          {(field) => (
            <Input
              {...field}
              minLength={3}
              onChange={(event) => setUsername(event.target.value)}
              required
              value={username}
            />
          )}
        </FormField>
        {mode === "register" ? (
          <>
            <FormField label="Почта" error={fieldErrors.email}>
              {(field) => (
                <Input
                  {...field}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              )}
            </FormField>
            <FormField label="Отображаемое имя" error={fieldErrors.displayName}>
              {(field) => (
                <Input
                  {...field}
                  onChange={(event) => setDisplayName(event.target.value)}
                  value={displayName}
                />
              )}
            </FormField>
          </>
        ) : null}
        <FormField label="Пароль" error={fieldErrors.password}>
          {(field) => (
            <Input
              {...field}
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          )}
        </FormField>
        {message ? (
          <p className="text-sm text-muted-foreground">{message}</p>
        ) : null}
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting
            ? "Отправка..."
            : mode === "login"
              ? "Войти"
              : "Создать аккаунт"}
        </Button>
      </form>
      <Button
        variant="link"
        className="mt-3 h-auto p-0"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setMessage(null);
          setFieldErrors({});
        }}
        type="button"
      >
        {mode === "login" ? "Создать новый аккаунт" : "У меня уже есть аккаунт"}
      </Button>
    </Card>
  );
}
