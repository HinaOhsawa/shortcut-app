import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import { UserProvider } from "@/app/context/UserContext";
import { ThemeProvider } from "@/app/context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shortcut App",
  description: "ショートカットキーを管理・共有できるアプリケーション",
};

// ハイドレーション前に <html> へ .dark を付与してテーマちらつきを防ぐ
const themeInitScript = `
(function(){
  try {
    var s = localStorage.getItem('theme');
    var d = s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (d) document.documentElement.classList.add('dark');
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg text-fg`}
      >
        <ThemeProvider>
          <UserProvider>
            {/* Header は useSearchParams を使うため、本番ビルド時の prerender で
                Suspense 境界を要求される。SSR 中は空にして遅延ハイドレートする。 */}
            <Suspense fallback={null}>
              <Header />
            </Suspense>
            <main className="mx-auto max-w-5xl py-8 px-4 sm:px-6">
              {children}
            </main>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
