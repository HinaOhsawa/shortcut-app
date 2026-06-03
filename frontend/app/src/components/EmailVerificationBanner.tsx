// frontend/app/src/components/EmailVerificationBanner.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";
import { readCsrfToken } from "@/lib/csrf";

type Profile = {
  is_email_verified: boolean;
};

export default function EmailVerificationBanner() {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/api/accounts/profile/"), {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          const data: Profile = await res.json();
          setVerified(data.is_email_verified);
        }
      } catch {
        // 取得失敗時は何も表示しない
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleResend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const csrf = readCsrfToken();
      const res = await fetch(apiUrl("/api/accounts/resend-verification/"), {
        method: "POST",
        credentials: "same-origin",
        headers: csrf ? { "X-CSRFToken": csrf } : {},
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(data.detail ?? "確認メールを送信しました。");
      } else if (res.status === 429) {
        setMessage("しばらく時間をおいてから再度お試しください。");
      } else {
        setMessage(data.detail ?? "送信に失敗しました。");
      }
    } catch {
      setMessage("ネットワークエラーが発生しました。");
    } finally {
      setBusy(false);
    }
  };

  // 未取得 or 確認済みなら表示しない
  if (verified !== false) return null;

  return (
    <div className="flex items-start gap-3 p-3 mb-4 bg-info-soft border border-info-soft-border rounded-md text-info-soft-fg">
      <AlertCircle size={18} className="shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p>メールアドレスがまだ確認されていません。登録時に送信したリンクをご確認ください。</p>
        {message && <p className="mt-1 opacity-80">{message}</p>}
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={busy}
        className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
      >
        {busy ? "送信中..." : "再送する"}
      </button>
    </div>
  );
}
