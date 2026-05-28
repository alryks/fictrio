"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FormField } from "@/components/form-field";
import { UserBadge } from "@/components/user-badge";
import { ApiError } from "@/lib/api";
import { login, logout, register } from "./auth-api";
import { useSession, useSessionActions } from "./use-session";

type AuthMode = "login" | "register";
type FieldErrors = Record<string, string>;

type AuthPanelProps = {
  defaultMode?: AuthMode;
  redirectTo?: string;
};

export function AuthPanel({
  defaultMode = "login",
  redirectTo,
}: AuthPanelProps = {}) {
  const router = useRouter();
  const { user, isLoading } = useSession();
  const { setUser } = useSessionActions();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
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
      toast.success(mode === "login" ? "Вы вошли в аккаунт" : "Аккаунт создан");

      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (error) {
      if (error instanceof ApiError && error.issues.length > 0) {
        setFieldErrors(
          Object.fromEntries(
            error.issues.map((issue) => [issue.path, issue.message]),
          ),
        );
      } else {
        toast.error(
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (user) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserBadge name={user.username} size="md" tone="primary" />
            <div className="min-w-0">
              <CardTitle className="truncate">{user.displayName}</CardTitle>
              <CardDescription className="truncate">
                @{user.username}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                className="rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                key={role}
              >
                {role}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/profile">Открыть профиль</Link>
            </Button>
            <Button variant="outline" onClick={handleLogout} type="button">
              <LogOut data-icon="inline-start" />
              Выйти
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{mode === "login" ? "Вход" : "Регистрация"}</CardTitle>
          {mode === "login" ? (
            <LogIn className="text-primary" />
          ) : (
            <UserRoundPlus className="text-primary" />
          )}
        </div>
        <CardDescription>
          {mode === "login"
            ? "Войдите, чтобы оценивать произведения, писать отзывы и вести списки."
            : "Создайте аккаунт для участия в обсуждениях Fictrio."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-3"
          onSubmit={handleSubmit}
          noValidate
        >
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
              <FormField
                label="Отображаемое имя"
                error={fieldErrors.displayName}
              >
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
            setFieldErrors({});
          }}
          type="button"
        >
          {mode === "login"
            ? "Создать новый аккаунт"
            : "У меня уже есть аккаунт"}
        </Button>
      </CardContent>
    </Card>
  );
}
