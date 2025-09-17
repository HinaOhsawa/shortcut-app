// frontend/app/src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1 className="font-bold text-2xl sm:text-xl">
        Welcome to the Shortcut App
      </h1>
      <p>このアプリはショートカットキーを登録してメモするアプリです。</p>
      <Link href="/signin">サインイン</Link>
    </div>
  );
}
