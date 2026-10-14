import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "쿠팡 고객탄식센터 CS 콘솔 - 상담원 모의 응대 시스템",
  description: "쿠팡 고객탄식센터 상담원 교육 및 시뮬레이션을 위한 챗봇 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F4F6F9] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100">{children}</body>
    </html>
  );
}
