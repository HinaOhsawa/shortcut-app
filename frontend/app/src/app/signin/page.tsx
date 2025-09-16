// src/app/signin/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/login";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
// -------------------------------------------
// Zodスキーマ定義
// -------------------------------------------
const signinSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しい形式で入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

type SigninFormData = z.infer<typeof signinSchema>;

// -------------------------------------------
// サインインページ
// -------------------------------------------
export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SigninFormData>({
    resolver: zodResolver(signinSchema),
    mode: "onBlur",
  });

  const onSubmit = async (values: SigninFormData) => {
    try {
      const data = await login(values.email, values.password);
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      console.log("サインイン成功", data);
      router.push("/profilepage");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("root.serverError", { message: err.message });
      } else {
        setError("root.serverError", { message: "不明なエラーが発生しました" });
      }
    }
  };

  return (
    <div className="form-card">
      <h2>サインイン</h2>
      <p className="text-slate-500">アカウントにサインインしよう。</p>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
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

        {/* Password */}
        <div className="mt-4">
          <label htmlFor="password">パスワード</label>
          <div className="relative">
            <Lock className="input-icon" />
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className={errors.password ? "input-error" : ""}
              {...register("password")}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="show-password-btn"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
          {errors.password && (
            <p className="error-message">{errors.password.message}</p>
          )}
        </div>

        {/* Root-level errors */}
        {errors.root?.serverError && (
          <p className="error-message">{errors.root.serverError.message}</p>
        )}

        {/* Submit */}
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "サインイン中..." : "サインイン"}
        </button>
      </form>

      <p className="text-slate-600 mt-4">
        アカウントをお持ちでない方はこちらから
        <Link href="/signup" className="link">
          新規登録
        </Link>
      </p>
    </div>
  );
}
