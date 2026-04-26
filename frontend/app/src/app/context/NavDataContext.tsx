// frontend/app/src/app/context/NavDataContext.tsx
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Application, Category } from "@/types/shortcut";

type NavDataValue = {
  apps: Application[];
  categories: Category[];
  refreshApps: () => Promise<void>;
  refreshCategories: () => Promise<void>;
};

const NavDataContext = createContext<NavDataValue | null>(null);

export function NavDataProvider({ children }: { children: React.ReactNode }) {
  const [apps, setApps] = useState<Application[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const refreshApps = useCallback(async () => {
    try {
      const data = await fetchWithAuth(
        "http://localhost:8000/api/shortcuts/applications/"
      );
      setApps(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("アプリ取得失敗:", err);
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      const data = await fetchWithAuth(
        "http://localhost:8000/api/shortcuts/categories/"
      );
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("カテゴリ取得失敗:", err);
    }
  }, []);

  useEffect(() => {
    refreshApps();
    refreshCategories();
  }, [refreshApps, refreshCategories]);

  return (
    <NavDataContext.Provider
      value={{ apps, categories, refreshApps, refreshCategories }}
    >
      {children}
    </NavDataContext.Provider>
  );
}

export function useNavData() {
  const ctx = useContext(NavDataContext);
  if (!ctx) throw new Error("useNavData must be used within NavDataProvider");
  return ctx;
}
