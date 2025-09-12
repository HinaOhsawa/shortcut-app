"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/signup";
import { SignupErrors } from "@/types/auth";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({}); // 前回のエラーをクリア
    try {
      const data = await signup(name, email, password);
      console.log("登録成功", data);

      // 登録成功 → マイページへリダイレクト
      // router.push("/mypage");
      router.push("/profilepage");
    } catch (err) {
      if (err && typeof err === "object") {
        setErrors(err as SignupErrors);
      } else {
        setErrors({ non_field_errors: ["予期せぬエラーが発生しました"] });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <input
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.name && <p style={{ color: "red" }}>{errors.name[0]}</p>}
      </div>

      <div>
        <input
          placeholder="メール"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {errors.email && <p style={{ color: "red" }}>{errors.email[0]}</p>}
      </div>

      <div>
        <input
          placeholder="パスワード"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.password && (
          <p style={{ color: "red" }}>{errors.password[0]}</p>
        )}
      </div>

      <button type="submit">サインアップ</button>
    </form>
  );
}
