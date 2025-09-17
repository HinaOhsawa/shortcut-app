// frontend/app/src/app/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/signup";
import { SignupErrors } from "@/types/auth";
import { Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useUser } from "@/app/context/UserContext";

// -------------------------------------------
// Zodスキーマ定義
// -------------------------------------------
const signupSchema = z.object({
  name: z.string().min(1, "ユーザーネームを入力してください"),
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("正しいメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
});

type SignupFormData = z.infer<typeof signupSchema>;

// -------------------------------------------
// サインアップページ
// -------------------------------------------

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { setUser } = useUser();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur", // 入力が終わった時点でバリデーション
  });

  const onSubmit = async (values: SignupFormData) => {
    try {
      // サインアップ API 呼び出し
      const data = await signup(values.name, values.email, values.password);
      console.log("登録成功", data);

      // --- localStorage に保存 ---
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));

      // --- Context に反映 ---
      setUser(data.user);

      // 登録成功 → マイページへリダイレクト
      router.push("/profilepage");
    } catch (err: unknown) {
      const errorObj = err as SignupErrors;
      if (errorObj.name) {
        setError("name", { message: errorObj.name[0] });
      }
      if (errorObj.email) {
        setError("email", { message: errorObj.email[0] });
      }
      if (errorObj.password) {
        setError("password", { message: errorObj.password[0] });
      }
      if (errorObj.non_field_errors) {
        setError("root.serverError", { message: errorObj.non_field_errors[0] });
      }
      if (errorObj.detail) {
        setError("root.serverError", { message: errorObj.detail });
      }
    }
  };

  return (
    <div className="form-card">
      <h2>サインアップ</h2>
      <p>アカウントを新規登録して始めよう。</p>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* UserName Field */}
        <div className="mt-4">
          <label htmlFor="name">ユーザーネーム</label>
          <div className="relative">
            <User className="input-icon" />
            <input
              className={errors.name ? "input-error" : ""}
              type="text"
              id="name"
              placeholder="Name"
              {...register("name")}
              disabled={isSubmitting}
            />
          </div>
          {errors.name && (
            <p className="error-message">{errors.name.message}</p>
          )}
        </div>

        {/* Email Field */}
        <div className="mt-4">
          <label htmlFor="email">メールアドレス</label>
          <div className="relative">
            <Mail className="input-icon" />
            <input
              className={errors.email ? "input-error" : ""}
              type="email"
              id="email"
              placeholder="your@email.com"
              {...register("email")}
              disabled={isSubmitting}
            />
          </div>
          {errors.email && (
            <p className="error-message">{errors.email.message}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="mt-4">
          <label htmlFor="password">パスワード</label>
          <div className="relative">
            <Lock className="input-icon" />
            <input
              className={errors.password ? "input-error" : ""}
              id="password"
              placeholder="Password"
              type={showPassword ? "text" : "password"}
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
        {errors.root && (
          <p className="error-message">{errors.root.serverError.message}</p>
        )}

        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "送信中..." : "サインアップ"}
        </button>
      </form>
      <p className="text-slate-600 mt-4">
        アカウントをお持ちの方はこちらから
        <Link href="/signin" className="link">
          サインイン
        </Link>
      </p>
    </div>
  );
}
