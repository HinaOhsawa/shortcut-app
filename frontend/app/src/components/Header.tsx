// frontend/app/src/components/Header.tsx
"use client";
import { CircleUserRound, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import SignOutButton from "./SignOutButton";
import ThemeToggle from "./ThemeToggle";
import { useUser } from "@/app/context/UserContext";

export default function Header() {
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(pathname === "/shortcuts" ? searchParams.get("q") ?? "" : "");
  }, [pathname, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const params = new URLSearchParams();
    if (trimmed) params.set("q", trimmed);
    router.push(`/shortcuts${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <div className="py-2 px-4 bg-surface border-b border-line flex justify-between items-center gap-4">
      <Link href={"/"}>
        <h1 className="text-lg font-bold text-fg whitespace-nowrap">
          Shortcut App
        </h1>
      </Link>

      {user && (
        <form
          onSubmit={handleSubmit}
          className="flex-1 max-w-md relative"
          role="search"
        >
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ショートカットを検索"
            aria-label="ショートカット検索"
            className="!pl-9 !py-1.5 !text-sm"
          />
        </form>
      )}

      <div className="flex items-center gap-1">
        <ThemeToggle />
        {user ? (
          <div className="flex items-center gap-1 text-muted">
            <Link
              href="/profile"
              className="flex items-center gap-1 hover:text-primary transition px-2 py-1 rounded-md hover:bg-surface-2"
              aria-label="プロフィール"
            >
              <CircleUserRound size={20} />
              <span className="font-medium text-fg">{user.name}</span>
            </Link>
            <SignOutButton />
          </div>
        ) : (
          <Link href={"/signin"} className="btn">
            サインイン
          </Link>
        )}
      </div>
    </div>
  );
}
