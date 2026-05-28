import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthPanel } from "@/features/auth/auth-panel";

export const metadata: Metadata = {
  title: "Вход и регистрация | Fictrio",
  description: "Вход в аккаунт Fictrio или регистрация нового пользователя.",
};

export default function AuthPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="min-w-0">
          <p className="text-sm font-medium text-primary">Fictrio</p>
          <h1 className="mt-2 text-3xl font-semibold">
            Оценки, отзывы и списки в одном профиле
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            После входа можно оценивать фильмы, сериалы и книги, писать отзывы,
            обсуждать рецензии и собирать публичные подборки для других
            пользователей.
          </p>
        </section>

        <AuthPanel redirectTo="/profile" />
      </main>
    </div>
  );
}
