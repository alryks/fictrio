import Image from "next/image";
import Link from "next/link";
import { RatingMark } from "@/components/ui/rating-mark";
import {
  Bell,
  BookOpen,
  Film,
  ListPlus,
  MessageCircle,
  Search,
  Tv,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FeedItem = {
  user: string;
  action: string;
  target: string;
  meta: string;
  rating: number;
  text: string;
  comments: number;
};

type TrendItem = {
  title: string;
  type: string;
  icon: LucideIcon;
  score: number;
  note: string;
};

const feedItems: FeedItem[] = [
  {
    user: "mira",
    action: "оценила",
    target: "Дюна: Часть вторая",
    meta: "фильм",
    rating: 3,
    text: "Большой экран, плотный звук и спокойная уверенность в каждом кадре.",
    comments: 18,
  },
  {
    user: "arseniy",
    action: "добавил отзыв",
    target: "Сегун",
    meta: "сериал",
    rating: 2.5,
    text: "Сильнее всего работает внимание к ритуалам и языку власти.",
    comments: 11,
  },
  {
    user: "lena.reads",
    action: "обновила список",
    target: "Книги на май",
    meta: "список",
    rating: 2.6,
    text: "Нон-фикшн, современная проза и две книги для долгих выходных.",
    comments: 7,
  },
  {
    user: "nikita",
    action: "оценил",
    target: "Последний город",
    meta: "книга",
    rating: 1,
    text: "Идея интересная, но темп проседает уже после первой трети.",
    comments: 3,
  },
];

const trends: TrendItem[] = [
  {
    title: "Оппенгеймер",
    type: "Фильм",
    icon: Film,
    score: 2.8,
    note: "49 новых отзывов",
  },
  {
    title: "Задача трех тел",
    type: "Сериал",
    icon: Tv,
    score: 2.4,
    note: "обсуждают финал",
  },
  {
    title: "Дом листьев",
    type: "Книга",
    icon: BookOpen,
    score: 2.7,
    note: "в 14 списках",
  },
];

const collections = [
  "Сильная научная фантастика",
  "Короткие сериалы на выходные",
  "Книги после экранизации",
  "Фильмы для обсуждения",
];

function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="flex shrink-0 items-center gap-3" href="/">
          <Image
            src="/logo.svg"
            alt="Fictrio"
            width={36}
            height={36}
            priority
          />
          <span className="text-xl font-semibold text-primary">Fictrio</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
          {["Лента", "Каталог", "Списки", "Профиль"].map((item, index) => (
            <a
              key={item}
              className={
                index === 0
                  ? "rounded-md px-3 py-2 text-primary"
                  : "rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              }
              href="#"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden min-w-0 flex-1 justify-end sm:flex">
          <label className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Поиск</span>
            <input
              className="h-10 w-full rounded-md border bg-card pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Найти фильм, сериал или книгу"
              type="search"
            />
          </label>
        </div>
        <button className="grid size-10 place-items-center rounded-md border bg-card text-muted-foreground transition hover:border-primary hover:text-primary">
          <Bell className="size-4" />
          <span className="sr-only">Уведомления</span>
        </button>
        <button className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground transition hover:bg-[var(--fictrio-accent)]">
          <UserRound className="size-4" />
          <span className="sr-only">Профиль</span>
        </button>
      </div>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <AppHeader />
      {children}
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function FeedCard({
  item,
  compact = false,
}: {
  item: FeedItem;
  compact?: boolean;
}) {
  return (
    <article className="rounded-md border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <UserAvatar name={item.user} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-semibold">{item.user}</span>
              <span className="text-muted-foreground">{item.action}</span>
              <span className="font-medium text-primary">{item.target}</span>
              <span className="rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {item.meta}
              </span>
            </div>
            <RatingMark
              value={item.rating}
              size={compact ? "md" : "lg"}
              className="shrink-0"
            />
          </div>
          <p
            className={
              compact ? "mt-2 text-sm leading-6" : "mt-3 text-base leading-7"
            }
          >
            {item.text}
          </p>
          <button className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <MessageCircle className="size-4" />
            {item.comments} комментариев
          </button>
        </div>
      </div>
    </article>
  );
}

function TrendRow({ item }: { item: TrendItem }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
        <item.icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">{item.note}</p>
      </div>
      <RatingMark value={item.score} size="sm" />
    </div>
  );
}

export function DesignVariantOne() {
  return (
    <Shell>
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:px-8">
        <aside className="hidden lg:block">
          <nav className="sticky top-20 space-y-1 text-sm font-medium">
            {["Все события", "Отзывы", "Списки", "Подписки", "Мои оценки"].map(
              (item, index) => (
                <a
                  key={item}
                  className={
                    index === 0
                      ? "block rounded-md bg-primary px-3 py-2 text-primary-foreground"
                      : "block rounded-md px-3 py-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }
                  href="#"
                >
                  {item}
                </a>
              ),
            )}
          </nav>
        </aside>

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Лента подписок</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Компактная рабочая лента для ежедневного чтения активности.
              </p>
            </div>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              <ListPlus className="size-4" />
              Новый список
            </button>
          </div>
          <div className="space-y-3">
            {feedItems.map((item) => (
              <FeedCard key={`${item.user}-${item.target}`} item={item} />
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Сейчас обсуждают</h2>
            <div className="mt-4 space-y-3">
              {trends.map((item) => (
                <TrendRow key={item.title} item={item} />
              ))}
            </div>
          </section>
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Подборки</h2>
            <div className="mt-4 space-y-2">
              {collections.map((item) => (
                <a
                  key={item}
                  className="block rounded-md border px-3 py-2 text-sm hover:border-primary"
                  href="#"
                >
                  {item}
                </a>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </Shell>
  );
}

export function DesignVariantTwo() {
  return (
    <Shell>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              <h1 className="text-3xl font-semibold">
                Найти следующее обсуждение
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Вариант делает каталог первым экраном: поиск, типы контента и
                быстрый переход к карточкам с социальной активностью.
              </p>
              <label className="relative mt-5 block max-w-2xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <span className="sr-only">Поиск</span>
                <input
                  className="h-12 w-full rounded-md border bg-background pl-12 pr-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
                  placeholder="Название, автор, режиссер или список"
                  type="search"
                />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Фильмы", icon: Film },
                { label: "Сериалы", icon: Tv },
                { label: "Книги", icon: BookOpen },
              ].map((item) => (
                <button
                  key={item.label}
                  className="grid min-h-28 place-items-center rounded-md border text-sm font-medium hover:border-primary hover:text-primary"
                >
                  <item.icon className="size-6" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trends.concat(trends).map((item, index) => (
            <article
              key={`${item.title}-${index}`}
              className="rounded-md border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid size-12 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <item.icon className="size-5" />
                </div>
                <RatingMark value={item.score - (index % 2) * 0.3} size="md" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{item.type}</p>
              <p className="mt-4 text-sm leading-6">
                {item.note}. Откройте карточку, чтобы читать отзывы и списки.
              </p>
            </article>
          ))}
        </section>
      </main>
    </Shell>
  );
}

export function DesignVariantThree() {
  return (
    <Shell>
      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,760px)_minmax(280px,1fr)] lg:px-8">
        <section className="min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Читать отзывы</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Вариант для сценария, где главное действие - читать длинные отзывы
              и отвечать.
            </p>
          </div>
          {feedItems.slice(0, 3).map((item) => (
            <article
              key={item.target}
              className="rounded-md border bg-card p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar name={item.user} />
                  <div>
                    <p className="font-semibold">{item.target}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.user} · {item.meta}
                    </p>
                  </div>
                </div>
                <RatingMark value={item.rating} size="lg" />
              </div>
              <p className="mt-5 text-lg leading-8">{item.text}</p>
              <div className="mt-5 flex items-center gap-3 border-t pt-4 text-sm text-muted-foreground">
                <button className="hover:text-primary">Ответить</button>
                <button className="hover:text-primary">В список</button>
                <button className="hover:text-primary">Скрыть</button>
              </div>
            </article>
          ))}
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Черновик отзыва</h2>
            <textarea
              className="mt-4 min-h-36 w-full resize-none rounded-md border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Что вы думаете о произведении?"
            />
            <div className="mt-3 flex items-center justify-between">
              <RatingMark value={2} size="md" />
              <button className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                Опубликовать
              </button>
            </div>
          </section>
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Темы дня</h2>
            <div className="mt-4 space-y-3">
              {trends.map((item) => (
                <TrendRow key={item.title} item={item} />
              ))}
            </div>
          </section>
        </aside>
      </main>
    </Shell>
  );
}

export function DesignVariantFour() {
  return (
    <Shell>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-md border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid size-16 place-items-center rounded-md bg-primary text-xl font-semibold text-primary-foreground">
                NS
              </div>
              <div>
                <h1 className="text-2xl font-semibold">Никита Скляр</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  128 оценок · 34 отзыва · 12 списков
                </p>
              </div>
            </div>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
              <UsersRound className="size-4" />
              Найти друзей
            </button>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-md border bg-card p-4 shadow-sm">
              <h2 className="font-semibold">Полки</h2>
              <div className="mt-4 space-y-2">
                {collections.map((item, index) => (
                  <a
                    key={item}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    href="#"
                  >
                    <span>{item}</span>
                    <span className="text-muted-foreground">
                      {8 + index * 3}
                    </span>
                  </a>
                ))}
              </div>
            </section>
            <section className="rounded-md border bg-card p-4 shadow-sm">
              <h2 className="font-semibold">Лучшие оценки</h2>
              <div className="mt-4 space-y-3">
                {trends.map((item) => (
                  <TrendRow key={item.title} item={item} />
                ))}
              </div>
            </section>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-card text-sm font-medium">
              <button className="h-11 bg-primary text-primary-foreground">
                Активность
              </button>
              <button className="h-11 border-l text-muted-foreground hover:bg-accent">
                Отзывы
              </button>
              <button className="h-11 border-l text-muted-foreground hover:bg-accent">
                Списки
              </button>
            </div>
            {feedItems.map((item) => (
              <FeedCard
                key={`${item.user}-${item.target}`}
                item={item}
                compact
              />
            ))}
          </section>
        </div>
      </main>
    </Shell>
  );
}
