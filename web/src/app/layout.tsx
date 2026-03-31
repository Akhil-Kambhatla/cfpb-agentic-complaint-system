import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CFPB Complaint Intelligence System",
  description:
    "Multi-Agent AI with Causal Counterfactual Analysis — UMD Agentic AI Challenge 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased`}
        style={{ background: "#030712", color: "#f1f5f9", minHeight: "100vh" }}
      >
        <AnalysisProvider>
          <Navbar />
          <main style={{ paddingTop: "56px" }}>{children}</main>
        </AnalysisProvider>
      </body>
    </html>
  );
}
