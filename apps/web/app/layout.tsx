import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "GasFlow",
  description: "Where every cylinder is: at the shop, with a customer, or at a refiller.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-white">
                <path d="M10 2h4v3h-4zM12 6a5 5 0 0 1 5 5v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a5 5 0 0 1 5-5Z" />
              </svg>
            </span>
            <span className="font-semibold">GasFlow</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
