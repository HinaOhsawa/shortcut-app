// frontend/app/src/components/SignOutButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { apiUrl } from "@/lib/apiBase";
import { readCsrfToken } from "@/lib/csrf";

export default function SignOutButton() {
  const router = useRouter();
  const { setUser } = useUser();

  const handleSignOut = async () => {
    // サーバ側で refresh をブラックリストし Cookie をクリアしてもらう
    try {
      const csrf = readCsrfToken();
      await fetch(apiUrl("/api/accounts/logout/"), {
        method: "POST",
        credentials: "same-origin",
        headers: csrf ? { "X-CSRFToken": csrf } : {},
      });
    } catch {
      // ネットワークエラーは握りつぶす（クライアント側のクリアを最優先）
    }

    // ユーザー情報のローカル状態のみクリア（トークンは Cookie 側でサーバ管理）
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
    }

    setUser(null);
    router.push("/");
  };

  return (
    <button
      onClick={handleSignOut}
      aria-label="ログアウト"
      title="ログアウト"
      className="p-2 rounded-md text-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer"
    >
      <LogOut size={18} />
    </button>
  );
}
