// frontend/app/src/components/RequireAuth.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiBase";

// HttpOnly Cookie 化により JS からトークンを直接見られないため、
// /api/accounts/profile/ を叩いて 200 が返るかでログイン状態を判断する。
// 副次的に csrftoken Cookie も発行されるため、後続 POST で CSRF ヘッダ付与可能になる。
export default function RequireAuth({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/accounts/profile/"), {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          setChecked(true);
        } else {
          router.replace("/signin");
        }
      } catch {
        if (!cancelled) router.replace("/signin");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!checked) return null;
  return <>{children}</>;
}
