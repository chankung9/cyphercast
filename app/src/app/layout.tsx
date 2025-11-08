import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";

import { AppWalletProvider } from "@/components/providers/wallet-provider";
import { ConnectWalletButton } from "@/components/wallet/connect-button";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/stake", label: "Stake" },
];

export const metadata: Metadata = {
  title: "Cyphercast",
  description: "Interactive streaming on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background text-foreground antialiased`}>
        <AppWalletProvider>
          <div className="flex min-h-screen flex-col">
          <header className="border-b border-border/60 bg-background/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Cyphercast
              </Link>
              <nav className="flex gap-3 text-sm font-medium text-muted-foreground">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-3 py-1 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              <ConnectWalletButton />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
          <footer className="border-t border-border/60 bg-background/70">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} Cyphercast</span>
              <span>Asia/Bangkok · Solana Localnet</span>
            </div>
          </footer>
          </div>
        </AppWalletProvider>
      </body>
    </html>
  );
}
