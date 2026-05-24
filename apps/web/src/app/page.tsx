import Image from "next/image";
import Link from "next/link";
import { RatingMark } from "@/components/ui/rating-mark";
import {
  Bell,
  BookOpen,
  Film,
  MessageCircle,
  Search,
  Tv,
  UserRound,
} from "lucide-react";

type Work = {
  title: string;
  kind: string;
  year: number;
  description: string;
  icon: typeof Film;
};

type ListPreview = {
  title: string;
  description: string;
  count: number;
  items: string[];
};

type FeedItem =
  | {
      type: "rating";
      user: string;
      rating: number;
      work: Work;
    }
  | {
      type: "review";
      user: string;
      rating: number;
      work: Work;
      text: string;
      comments: number;
    }
  | {
      type: "list";
      user: string;
      list: ListPreview;
      text: string;
      comments: number;
    };

const dune: Work = {
  title: "Дюна: Часть вторая",
  kind: "фильм",
  year: 2024,
  description:
    "Политическая фантастика, песчаные планеты и большая война за власть.",
  icon: Film,
};

const shogun: Work = {
  title: "Сегун",
  kind: "сериал",
  year: 2024,
  description: "Историческая драма о власти, языке и столкновении культур.",
  icon: Tv,
};

const city: Work = {
  title: "Последний город",
  kind: "книга",
  year: 2021,
  description:
    "Мрачная городская фантастика о памяти, страхе и потерянных маршрутах.",
  icon: BookOpen,
};

const feedItems: FeedItem[] = [
  {
    type: "rating",
    user: "mira",
    rating: 3,
    work: dune,
  },
  {
    type: "review",
    user: "arseniy",
    rating: 2.5,
    work: shogun,
    text: "Сильнее всего работает внимание к ритуалам и языку власти.",
    comments: 11,
  },
  {
    type: "list",
    user: "lena.reads",
    list: {
      title: "Книги на май",
      description:
        "Нон-фикшн, современная проза и две книги для долгих выходных.",
      count: 12,
      items: [
        "Дом листьев",
        "Кlara and the Sun",
        "Последний город",
        "Piranesi",
      ],
    },
    text: "Собрала короткий список на май: без обязательной классики, зато с темами для обсуждения.",
    comments: 7,
  },
  {
    type: "rating",
    user: "nikita",
    rating: 1,
    work: city,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
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

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,760px)_minmax(280px,1fr)] lg:px-8">
        <section className="min-w-0 space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">Лента</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Оценки, отзывы и списки людей, на которых вы подписаны.
            </p>
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

          <div className="space-y-4">
            {feedItems.map((item) => (
              <FeedEvent key={`${item.type}-${item.user}`} item={item} />
            ))}
          </div>
        </section>

        <aside className="hidden lg:block" aria-hidden="true" />
      </main>
    </div>
  );
}

function FeedEvent({ item }: { item: FeedItem }) {
  if (item.type === "list") {
    return (
      <article className="rounded-md border bg-card p-5 shadow-sm">
        <ListPreviewCard list={item.list} />
        <div className="mt-5 flex gap-3 border-t pt-4">
          <UserAvatar name={item.user} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{item.user}</span>{" "}
              <span className="text-muted-foreground">создала список</span>{" "}
              <span className="font-medium text-primary">
                {item.list.title}
              </span>
            </p>
            <p className="mt-3 text-base leading-7">{item.text}</p>
            <CommentButton count={item.comments} />
          </div>
        </div>
      </article>
    );
  }

  const action = item.type === "rating" ? "поставила оценку" : "написал отзыв";

  return (
    <article className="grid gap-4 rounded-md border bg-card p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={item.user} />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold">{item.user}</span>{" "}
                <span className="text-muted-foreground">{action}</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.work.kind} · {item.work.year}
              </p>
            </div>
          </div>
          <RatingMark value={item.rating} size="lg" className="shrink-0" />
        </div>

        {item.type === "review" ? (
          <>
            <p className="mt-5 text-lg leading-8">{item.text}</p>
            <CommentButton count={item.comments} />
          </>
        ) : (
          <p className="mt-5 text-lg leading-8">
            Оценка добавлена без отзыва. Произведение можно открыть из карточки
            справа.
          </p>
        )}
      </div>

      <WorkLinkCard work={item.work} />
    </article>
  );
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function WorkLinkCard({ work }: { work: Work }) {
  return (
    <a
      className="group block rounded-md border bg-background p-4 transition hover:border-primary hover:shadow-sm"
      href="#"
      aria-label={`Открыть карточку: ${work.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground transition group-hover:bg-accent">
          <work.icon className="size-5" />
        </div>
        <span className="rounded-sm bg-card px-2 py-1 text-xs text-muted-foreground">
          открыть
        </span>
      </div>
      <h2 className="mt-4 text-base font-semibold text-primary">
        {work.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {work.kind} · {work.year}
      </p>
      <p className="mt-3 line-clamp-3 text-sm leading-6">{work.description}</p>
    </a>
  );
}

function ListPreviewCard({ list }: { list: ListPreview }) {
  return (
    <a
      className="block rounded-md border bg-background p-4 transition hover:border-primary hover:shadow-sm"
      href="#"
      aria-label={`Открыть список: ${list.title}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Пользовательский список
          </p>
          <h2 className="mt-1 text-lg font-semibold text-primary">
            {list.title}
          </h2>
        </div>
        <span className="rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground">
          {list.count} позиций
        </span>
      </div>
      <p className="mt-3 text-sm leading-6">{list.description}</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {list.items.map((title) => (
          <span
            key={title}
            className="shrink-0 rounded-md border bg-card px-3 py-2 text-sm text-card-foreground"
          >
            {title}
          </span>
        ))}
      </div>
    </a>
  );
}

function CommentButton({ count }: { count: number }) {
  return (
    <button className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
      <MessageCircle className="size-4" />
      {count} комментариев
    </button>
  );
}
