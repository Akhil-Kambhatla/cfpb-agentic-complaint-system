import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CFPB Complaint Intelligence System",
  description: "Multi-Agent AI with Causal Counterfactual Analysis — UMD Agentic AI Challenge 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-950 text-white antialiased`}>
        <Navbar />
        <main className="pt-14 min-h-screen">{children}</main>
      </body>
    </html>
  );
}
