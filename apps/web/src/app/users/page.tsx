"use client";

import { SiteHeader } from "@/components/layout/site-header";
import { qk } from "@/lib/query-keys";
import { UserList } from "@/features/users/user-list";
import { searchUsers } from "@/features/users/users-api";

export default function UsersSearchPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader active="people" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 className="text-2xl font-semibold">Люди</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Найдите пользователей по имени и подпишитесь, чтобы видеть их
            активность в ленте.
          </p>
        </div>

        <div className="mt-5">
          <UserList
            queryKey={(search) => qk.users.search(search)}
            fetchPage={(search, offset) => searchUsers(search, offset)}
            emptyTitle="Пользователи не найдены"
            emptyText="Попробуйте изменить запрос."
          />
        </div>
      </main>
    </div>
  );
}
