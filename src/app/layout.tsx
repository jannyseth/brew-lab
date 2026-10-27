import type { Metadata } from "next";
import { Fraunces, Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { CartProvider } from "@/components/cart";
import { SiteFooter } from "@/components/site-footer";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Brew Lab", template: "%s · Brew Lab" },
  description: "Pick a favorite from the menu or build your own coffee, exactly how you like it.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <CartProvider>
          <header className="border-b border-line print:hidden">
            <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4">
              <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
                Brew Lab
              </Link>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium">
                <Suspense fallback={null}>
                  <UserMenu />
                </Suspense>
              </div>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </CartProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
