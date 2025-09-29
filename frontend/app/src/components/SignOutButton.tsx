// frontend/app/src/components/SignOutButton.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useUser } from "@/app/context/UserContext";

export default function SignOutButton() {
  const router = useRouter();
  const { setUser } = useUser();

  const handleSignOut = () => {
    // ローカルストレージから削除
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    setUser(null); // Contextのuserを更新
    // リダイレクト
    router.push("/");
  };

  return (
    <button onClick={handleSignOut} className="cursor-pointer">
      <LogOut />
    </button>
  );
}
