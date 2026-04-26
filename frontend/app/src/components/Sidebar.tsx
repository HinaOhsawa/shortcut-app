// frontend/app/src/components/Sidebar.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AppWindow,
  ChevronDown,
  ChevronRight,
  Folder,
  Home,
  Keyboard,
  LogOut,
  Settings,
  UserRound,
} from "lucide-react";
import { useNavData } from "@/app/context/NavDataContext";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { apps, categories } = useNavData();
  const router = useRouter();
  const { setUser } = useUser();
  const [appsOpen, setAppsOpen] = useState(true);
  const [catsOpen, setCatsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(
    pathname === "/profile" || pathname.startsWith("/profile/")
  );

  const currentAppId = searchParams.get("app");
  const currentCategoryId = searchParams.get("category");
  const onShortcutsRoot =
    pathname === "/shortcuts" && !currentAppId && !currentCategoryId;

  const handleSignOut = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setUser(null);
    router.push("/");
  };

  const itemClass = (active: boolean) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
      active
        ? "bg-primary-soft text-primary-soft-fg font-medium"
        : "text-muted hover:bg-surface-2 hover:text-fg"
    }`;

  const subItemClass = (active: boolean) =>
    `block px-3 py-1.5 text-sm rounded-md transition truncate ${
      active
        ? "bg-primary-soft text-primary-soft-fg font-medium"
        : "text-muted hover:bg-surface-2 hover:text-fg"
    }`;

  return (
    <aside className="w-56 shrink-0 border-r border-line py-4 pr-2">
      <nav className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className={itemClass(pathname === "/dashboard")}
        >
          <Home size={16} />
          ダッシュボード
        </Link>

        <Link href="/shortcuts" className={itemClass(onShortcutsRoot)}>
          <Keyboard size={16} />
          ショートカット
        </Link>

        <div>
          <div className="flex items-center">
            <Link
              href="/applications"
              className={`flex-1 ${itemClass(pathname === "/applications")}`}
            >
              <AppWindow size={16} />
              アプリ
            </Link>
            <button
              type="button"
              aria-label={appsOpen ? "アプリ一覧を閉じる" : "アプリ一覧を開く"}
              onClick={() => setAppsOpen((v) => !v)}
              className="p-1 rounded hover:bg-surface-2 text-subtle"
            >
              {appsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
          {appsOpen && (
            <div className="ml-6 mt-1 flex flex-col gap-0.5">
              {apps.length === 0 ? (
                <span className="px-3 py-1 text-xs text-subtle">
                  登録なし
                </span>
              ) : (
                apps.map((a) => (
                  <Link
                    key={a.id}
                    href={`/shortcuts?app=${a.id}`}
                    className={subItemClass(
                      pathname === "/shortcuts" && currentAppId === a.id
                    )}
                  >
                    {a.name}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center">
            <Link
              href="/categories"
              className={`flex-1 ${itemClass(pathname === "/categories")}`}
            >
              <Folder size={16} />
              カテゴリ
            </Link>
            <button
              type="button"
              aria-label={
                catsOpen ? "カテゴリ一覧を閉じる" : "カテゴリ一覧を開く"
              }
              onClick={() => setCatsOpen((v) => !v)}
              className="p-1 rounded hover:bg-surface-2 text-subtle"
            >
              {catsOpen ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
          {catsOpen && (
            <div className="ml-6 mt-1 flex flex-col gap-0.5">
              {categories.length === 0 ? (
                <span className="px-3 py-1 text-xs text-subtle">
                  登録なし
                </span>
              ) : (
                categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/shortcuts?category=${c.id}`}
                    className={subItemClass(
                      pathname === "/shortcuts" && currentCategoryId === c.id
                    )}
                  >
                    {c.name}
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            aria-expanded={settingsOpen}
            className={`w-full ${itemClass(false)}`}
          >
            <Settings size={16} />
            <span className="flex-1 text-left">設定</span>
            {settingsOpen ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
          </button>
          {settingsOpen && (
            <div className="ml-6 mt-1 flex flex-col gap-0.5">
              <Link
                href="/profile"
                className={`${subItemClass(pathname === "/profile")} flex items-center gap-2`}
              >
                <UserRound size={14} />
                プロフィール
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className={`${subItemClass(false)} flex items-center gap-2 w-full text-left cursor-pointer`}
              >
                <LogOut size={14} />
                ログアウト
              </button>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
