// frontend/app/src/app/(main)/layout.tsx
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import RequireAuth from "@/components/RequireAuth";
import { NavDataProvider } from "@/app/context/NavDataContext";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <NavDataProvider>
        <div className="flex gap-6">
          {/* Sidebar は useSearchParams 利用のため Suspense 境界が必要 */}
          <Suspense fallback={null}>
            <Sidebar />
          </Suspense>
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </NavDataProvider>
    </RequireAuth>
  );
}
