"use client";
import { useState } from "react";
import { login } from "../lib/api";

export default function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      console.log("JWT accessToken:", data.access); // コンソールで確認
      console.log("JWT refreshToken:", data.refresh); // コンソールで確認
      localStorage.setItem("accessToken", data.access);
      localStorage.setItem("refreshToken", data.refresh);
    } catch {
      setError("Login failed");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Sign In</button>
      {error && <p>{error}</p>}
    </form>
  );
}
