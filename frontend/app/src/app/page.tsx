// frontend/app/src/app/page.tsx
import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1 className="font-bold text-2xl sm:text-xl">
        Welcome to the Shortcut App
      </h1>

      <p className="mb-4 ">
        このアプリはショートカットキーを登録してメモするアプリです。
      </p>

      <Link className="link" href="/signin">
        サインイン
      </Link>
    </div>
  );
}
