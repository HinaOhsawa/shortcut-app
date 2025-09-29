// frontend/app/src/app/context/UserContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types/auth";

type UserContextType = {
  user: User | null;
  setUser: (user: User | null) => void;
};

// Contextの作成
const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  // 初期読み込み（localStorage から復元）
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
}
