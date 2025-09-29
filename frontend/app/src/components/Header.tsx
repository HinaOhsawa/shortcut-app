// frontend/app/src/components/Header.tsx
"use client";
import { CircleUserRound } from "lucide-react";
import Link from "next/link";
import SignOutButton from "./SignOutButton";
import { useUser } from "@/app/context/UserContext";

export default function Header() {
  const { user } = useUser();

  return (
    <div className="py-2 px-4 bg-indigo-100 flex justify-between items-center">
      <Link href={"/"}>
        <h1 className="text-lg font-bold text-indigo-950">Shortcut App</h1>
      </Link>

      {user ? (
        <div className="flex items-center gap-1 text-indigo-400">
          <CircleUserRound className="" />
          <span className="font-medium">{user.name}</span>
          <SignOutButton />
        </div>
      ) : (
        <Link href={"/signin"} className="btn">
          サインイン
        </Link>
      )}
    </div>
  );
}
