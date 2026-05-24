import Image from "next/image";
import {
  Bell,
  BookOpen,
  Film,
  Library,
  ListPlus,
  MessageCircle,
  Search,
  Star,
  Tv,
  UserRound,
} from "lucide-react";

const feedItems = [
  {
    user: "mira",
    action: "оценила",
    target: "Дюна: Часть вторая",
    meta: "фильм",
    rating: "3.0",
    text: "Большой экран, плотный звук и спокойная уверенность в каждом кадре.",
  },
  {
    user: "arseniy",
    action: "добавил отзыв",
    target: "Сегун",
    meta: "сериал",
    rating: "2.5",
    text: "Сильнее всего работает внимание к ритуалам и языку власти.",
  },
  {
    user: "lena.reads",
    action: "обновила список",
    target: "Книги на май",
    meta: "список",
    rating: "12",
    text: "Нон-фикшн, современная проза и две книги для долгих выходных.",
  },
];

const trends = [
  { title: "Оппенгеймер", type: "Фильм", icon: Film, score: "2.8" },
  { title: "Задача трех тел", type: "Сериал", icon: Tv, score: "2.4" },
  { title: "Дом листьев", type: "Книга", icon: BookOpen, score: "2.7" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <a className="flex shrink-0 items-center gap-3" href="#">
            <Image
              src="/logo.svg"
              alt="Fictrio"
              width={36}
              height={36}
              priority
            />
            <span className="text-xl font-semibold text-primary">Fictrio</span>
          </a>
          <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
            <a className="rounded-md px-3 py-2 text-primary" href="#">
              Лента
            </a>
            <a
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="#"
            >
              Каталог
            </a>
            <a
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="#"
            >
              Списки
            </a>
            <a
              className="rounded-md px-3 py-2 hover:bg-accent hover:text-accent-foreground"
              href="#"
            >
              Профиль
            </a>
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

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-8">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Лента</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Отзывы, оценки и списки людей, на которых вы подписаны.
              </p>
            </div>
            <button className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-[var(--fictrio-accent)]">
              <ListPlus className="size-4" />
              Новый список
            </button>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-md border bg-card text-sm font-medium">
            <button className="h-11 bg-primary text-primary-foreground">
              Все
            </button>
            <button className="h-11 border-l text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              Отзывы
            </button>
            <button className="h-11 border-l text-muted-foreground hover:bg-accent hover:text-accent-foreground">
              Списки
            </button>
          </div>

          <div className="space-y-3">
            {feedItems.map((item) => (
              <article
                key={`${item.user}-${item.target}`}
                className="rounded-md border bg-card p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
                    {item.user.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <span className="font-semibold">{item.user}</span>
                      <span className="text-muted-foreground">
                        {item.action}
                      </span>
                      <span className="font-medium text-primary">
                        {item.target}
                      </span>
                      <span className="rounded-sm bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        {item.meta}
                      </span>
                    </div>
                    <p className="mt-3 text-base leading-7">{item.text}</p>
                    <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-primary">
                        <Star className="size-4 fill-current" />
                        {item.rating}
                      </span>
                      <button className="inline-flex items-center gap-1 hover:text-primary">
                        <MessageCircle className="size-4" />
                        Комментировать
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">Сейчас обсуждают</h2>
              <Library className="size-4 text-primary" />
            </div>
            <div className="mt-4 space-y-3">
              {trends.map((item) => (
                <div key={item.title} className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                    <item.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                    <Star className="size-4 fill-current" />
                    {item.score}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-md border bg-card p-4 shadow-sm">
            <h2 className="font-semibold">Быстрые фильтры</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button className="grid h-20 place-items-center rounded-md border text-sm font-medium hover:border-primary hover:text-primary">
                <Film className="size-5" />
                Фильмы
              </button>
              <button className="grid h-20 place-items-center rounded-md border text-sm font-medium hover:border-primary hover:text-primary">
                <Tv className="size-5" />
                Сериалы
              </button>
              <button className="grid h-20 place-items-center rounded-md border text-sm font-medium hover:border-primary hover:text-primary">
                <BookOpen className="size-5" />
                Книги
              </button>
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
