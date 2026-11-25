import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { appearance, localization } from "@/lib/clerk";
import { SIGN_IN_PATH } from "@/lib/routes";
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
        <ClerkProvider
          signInUrl={SIGN_IN_PATH}
          afterSignOutUrl={SIGN_IN_PATH}
          appearance={appearance}
          localization={localization}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
