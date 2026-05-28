import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type NavKey = "feed" | "catalog" | "lists" | "profile";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { key: "feed", label: "Лента", href: "/" },
  { key: "catalog", label: "Каталог", href: "/catalog" },
  { key: "lists", label: "Списки", href: "/lists" },
  { key: "profile", label: "Профиль", href: "#" },
];

type SiteHeaderProps = {
  /** Highlights the matching nav item. */
  active?: NavKey;
  /** Extra content pinned to the right (e.g. search box on the feed). */
  rightSlot?: ReactNode;
};

export function SiteHeader({ active, rightSlot }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="flex shrink-0 items-center gap-3" href="/">
          <Image src="/logo.svg" alt="Fictrio" width={36} height={36} priority />
          <span className="text-xl font-semibold text-primary">Fictrio</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm font-medium text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 transition",
                active === item.key
                  ? "text-primary"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {rightSlot ? <div className="ml-auto flex min-w-0">{rightSlot}</div> : null}
      </div>
    </header>
  );
}
