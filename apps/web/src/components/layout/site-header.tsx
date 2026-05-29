import { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeaderAuthActions } from "@/components/layout/header-auth-actions";
import { cn } from "@/lib/utils";

type NavKey = "feed" | "catalog" | "lists" | "people";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { key: "feed", label: "Лента", href: "/" },
  { key: "catalog", label: "Каталог", href: "/catalog" },
  { key: "lists", label: "Списки", href: "/lists" },
  { key: "people", label: "Люди", href: "/users" },
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
      <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
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

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto text-sm font-medium text-muted-foreground lg:order-none lg:w-auto">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 transition",
                "flex h-10 items-center",
                active === item.key
                  ? "text-primary"
                  : "hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-3">
          {rightSlot ? (
            <div className="hidden min-w-0 sm:flex">{rightSlot}</div>
          ) : null}
          <HeaderAuthActions />
        </div>
      </div>
    </header>
  );
}
