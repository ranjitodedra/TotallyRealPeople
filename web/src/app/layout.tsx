import type { Metadata } from "next";
import { Geist_Mono, Rubik } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/brand";
import "./globals.css";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trust Me Bro",
  description: "Your reference is ready to take the call. An AI reference simulation built from your résumé.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${rubik.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="mx-auto w-full max-w-5xl px-4 pt-6 pb-2 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-[var(--on-page)]">
            <Logo size={28} /> Trust Me Bro
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-xs text-[var(--on-page-2)] text-center">
          Every reference here is an AI simulation built from candidate-provided documents. It doesn&apos;t verify
          employment.
        </footer>
      </body>
    </html>
  );
}
