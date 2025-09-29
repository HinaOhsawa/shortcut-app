"use client";

import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Profile {
  name: string;
  email: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    console.log(localStorage.getItem("accessToken"));
    async function loadProfile() {
      try {
        const data = await fetchWithAuth(
          "http://localhost:8000/api/accounts/profile/"
        );
        setProfile(data);
      } catch (err) {
        console.error("認証エラー:", err);
      }
    }
    loadProfile();
  }, []);

  if (!profile) return <p>Loading...</p>;

  return (
    <div>
      <h1>{profile.name} さん</h1>
      <p>Email: {profile.email}</p>
    </div>
  );
}
