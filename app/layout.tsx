import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import A11yDevAudit from "./_components/A11yDevAudit";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DetailAdvisor · 细节审查工作台",
  description: "细节决定成败 · 工程化细节审查 Web App · Phase 0 起步",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {process.env.NODE_ENV === "development" && <A11yDevAudit />}
      </body>
    </html>
  );
}
