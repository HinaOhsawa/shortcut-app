"use client"; // appディレクトリの場合

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

export default function HelloWorld() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/api/hello/"))
      .then((res) => res.json())
      .then((data) => {
        setMessage(data.message);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>API Response</h1>
      <p>{message}</p>
    </div>
  );
}
