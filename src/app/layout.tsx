import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { EnvBanner } from "@/components/EnvBanner";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { getDocumentTitle, getEnvBannerText } from "@/lib/app-env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  return {
    title: getDocumentTitle(),
    description: "ระบบตรวจนับสต็อก",
  };
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  const banner = getEnvBannerText();

  return (
    <html
      lang="th"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={
        banner
          ? ({ "--env-banner-h": "2.75rem" } as React.CSSProperties)
          : undefined
      }
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <EnvBanner />
        <PresenceHeartbeat />
        {children}
      </body>
    </html>
  );
}
