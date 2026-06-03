// frontend/app/src/app/verify-email/page.tsx
"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";
import { withCsrfHeader } from "@/lib/csrf";

type Status = "pending" | "success" | "error";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<Status>("pending");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("トークンが指定されていません。");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/accounts/verify-email/"), {
          method: "POST",
          credentials: "same-origin",
          headers: withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setStatus("success");
          setMessage(data.detail ?? "確認しました。");
        } else {
          setStatus("error");
          setMessage(data.detail ?? "確認に失敗しました。");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("ネットワークエラーが発生しました。");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="form-card">
      <h2>メールアドレス確認</h2>
      {status === "pending" && (
        <div className="flex items-center gap-2 mt-4 text-muted">
          <Loader2 className="animate-spin" size={18} />
          確認中...
        </div>
      )}
      {status === "success" && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-success-soft-fg">
            <CheckCircle2 size={20} />
            <span>{message}</span>
          </div>
          <Link href="/dashboard" className="link">
            ダッシュボードへ
          </Link>
        </div>
      )}
      {status === "error" && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-danger">
            <AlertCircle size={20} />
            <span>{message}</span>
          </div>
          <p className="text-sm text-muted">
            ログイン後にダッシュボードのバナーから確認メールを再送できます。
          </p>
          <Link href="/signin" className="link">
            サインインへ
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="form-card"><h2>メールアドレス確認</h2><p className="mt-4 text-muted">読み込み中...</p></div>}>
      <VerifyEmailInner />
    </Suspense>
  );
}
