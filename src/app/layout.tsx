import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { CartProvider } from "@/components/cart";
import { CartDrawer } from "@/components/cart-drawer";
import { HeaderHeight } from "@/components/header-height";
import { HelpDrawer } from "@/components/help-drawer";
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
  // Opens full screen as its own app when added to the iPhone home screen.
  appleWebApp: { capable: true, title: "Brew Lab", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17110d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <CartProvider>
          <header id="site-header" className="border-b border-line print:hidden">
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
          {/* Both read the current page address, which is only known at request time. */}
          <Suspense fallback={null}>
            <CartDrawer />
            <HelpDrawer />
          </Suspense>
        </CartProvider>
        <SiteFooter />
        <HeaderHeight />
      </body>
    </html>
  );
}
