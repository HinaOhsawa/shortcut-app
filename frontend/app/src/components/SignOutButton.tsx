// frontend/app/src/components/SignOutButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { apiUrl } from "@/lib/apiBase";

export default function SignOutButton() {
  const router = useRouter();
  const { setUser } = useUser();

  const handleSignOut = async () => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");

    // サーバ側で refresh をブラックリストに登録（失敗してもクライアント側はクリアする）
    if (accessToken && refreshToken) {
      try {
        await fetch(apiUrl("/api/accounts/logout/"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      } catch {
        // ネットワークエラーは握りつぶす（クライアント側のクリアを最優先）
      }
    }

    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

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
