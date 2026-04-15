import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/contexts/AnalysisContext";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CFPB Complaint Intelligence System",
  description:
    "Multi-Agent Complaint Intelligence with Bayesian Risk Assessment — UMD Agentic AI Challenge 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showBanner = process.env.NEXT_PUBLIC_DEMO_BANNER === "true";
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <AnalysisProvider>
          {showBanner && (
            <div className="bg-blue-50 border-b border-blue-200 text-center py-2 px-4 text-sm text-blue-700">
              Live demo on Claude API. System polls CFPB daily to conserve credits — click &quot;Poll Now&quot; or &quot;Simulate&quot; for live processing. Auto-close timer set to 10 minutes (configurable for production).
            </div>
          )}
          <Navbar />
          <main style={{ paddingTop: showBanner ? "82px" : "56px" }}>{children}</main>
        </AnalysisProvider>
      </body>
    </html>
  );
}
