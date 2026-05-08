// frontend/app/src/app/forgot-password/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { apiUrl } from "@/lib/apiBase";

const schema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しい形式で入力してください"),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [genericMessage, setGenericMessage] = useState<string>("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: "onBlur",
  });

  const onSubmit = async (values: FormData) => {
    try {
      const res = await fetch(apiUrl("/api/accounts/password-reset/request/"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setGenericMessage("しばらく時間をおいてから再度お試しください。");
      } else {
        // 成功 / 失敗どちらも同じ表示にする（列挙攻撃対策）
        setGenericMessage(
          data.detail ?? "リセットメールを送信した可能性があります。受信箱をご確認ください。"
        );
      }
      setDone(true);
    } catch {
      setGenericMessage("ネットワークエラーが発生しました。");
      setDone(true);
    }
  };

  return (
    <div className="form-card">
      <h2>パスワードを再設定</h2>
      {done ? (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm">{genericMessage}</p>
          <Link href="/signin" className="link">
            サインインに戻る
          </Link>
        </div>
      ) : (
        <>
          <p>登録したメールアドレスを入力してください。再設定 URL をお送りします。</p>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="mt-4">
              <label htmlFor="email">メールアドレス</label>
              <div className="relative">
                <Mail className="input-icon" />
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className={errors.email ? "input-error" : ""}
                  {...register("email")}
                  disabled={isSubmitting}
                />
              </div>
              {errors.email && (
                <p className="error-message">{errors.email.message}</p>
              )}
            </div>
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? "送信中..." : "送信"}
            </button>
          </form>
          <p className="mt-2">
            <Link href="/signin" className="link">
              サインインに戻る
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
