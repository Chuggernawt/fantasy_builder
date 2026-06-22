import type { Metadata } from "next";
import "./globals.css";
import { SoundEffectsProvider } from "@/components/SoundEffectsProvider";
import { AccountProgressProvider } from "@/components/AccountProgressProvider";

export const metadata: Metadata = {
  title: "Fantasy Build — Universe Draft & Simulator",
  description: "Draft fictional squads and simulate head-to-head football matches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stadium font-mono text-broadcast-text antialiased">
        <SoundEffectsProvider />
        <AccountProgressProvider />
        {children}
      </body>
    </html>
  );
}
