import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { FloatingRouletteButton } from "@/components/FloatingRouletteButton";
import { NotificationModal } from "@/components/NotificationModal";
import { Footer } from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

import { constructMetadata } from "@/lib/metadata";

export const metadata: Metadata = constructMetadata();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Poetsen+One&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-950 flex flex-col">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <BottomNav />
            <FloatingRouletteButton />
            <NotificationModal />
          </div>
        </Providers>
      </body>
    </html>
  );
}
