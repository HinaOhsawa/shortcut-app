// frontend/app/src/app/password-reset/confirm/page.tsx
"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";

const schema = z
  .object({
    new_password: z.string().min(8, "パスワードは8文字以上で入力してください"),
    confirm_password: z.string(),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    path: ["confirm_password"],
    message: "確認用パスワードが一致しません",
  });

type FormData = z.infer<typeof schema>;

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  if (!token) {
    return (
      <div className="form-card">
        <h2>パスワード再設定</h2>
        <p className="mt-4 error-message">
          トークンが指定されていません。再度メールのリンクからアクセスしてください。
        </p>
        <Link href="/forgot-password" className="link">
          リセットを再要求
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: FormData) => {
    try {
      const res = await fetch(apiUrl("/api/accounts/password-reset/confirm/"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          new_password: values.new_password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
        return;
      }
      // サーバ側のフィールドエラー（new_password: [...]）か、detail エラー
      if (Array.isArray(data.new_password) && data.new_password.length > 0) {
        setError("new_password", { message: data.new_password.join(" / ") });
      } else if (data.detail) {
        setError("root.serverError", { message: data.detail });
      } else if (res.status === 429) {
        setError("root.serverError", {
          message: "しばらく時間をおいてから再度お試しください。",
        });
      } else {
        setError("root.serverError", { message: "更新に失敗しました。" });
      }
    } catch {
      setError("root.serverError", { message: "ネットワークエラーが発生しました。" });
    }
  };

  return (
    <div className="form-card">
      <h2>新しいパスワードを設定</h2>
      {done ? (
        <div className="mt-4 flex flex-col gap-3">
          <p>パスワードを更新しました。新しいパスワードでサインインしてください。</p>
          <Link href="/signin" className="link">
            サインインへ
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="mt-4">
            <label htmlFor="new_password">新しいパスワード</label>
            <div className="relative">
              <Lock className="input-icon" />
              <input
                id="new_password"
                type={showPassword ? "text" : "password"}
                placeholder="新しいパスワード"
                className={errors.new_password ? "input-error" : ""}
                {...register("new_password")}
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="show-password-btn"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.new_password && (
              <p className="error-message">{errors.new_password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="confirm_password">確認用</label>
            <div className="relative">
              <Lock className="input-icon" />
              <input
                id="confirm_password"
                type={showPassword ? "text" : "password"}
                placeholder="もう一度入力"
                className={errors.confirm_password ? "input-error" : ""}
                {...register("confirm_password")}
                disabled={isSubmitting}
              />
            </div>
            {errors.confirm_password && (
              <p className="error-message">{errors.confirm_password.message}</p>
            )}
          </div>

          {errors.root?.serverError && (
            <p className="error-message">{errors.root.serverError.message}</p>
          )}

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? "更新中..." : "パスワードを更新"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function PasswordResetConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="form-card">
          <h2>パスワード再設定</h2>
          <p className="mt-4 text-muted">読み込み中...</p>
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  );
}
