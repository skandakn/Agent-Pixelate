import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/jetbrains-mono/700.css";
import "./globals.css";
import { ClerkAuthProvider } from "@/components/ClerkAuthProvider";

export const metadata: Metadata = {
  title: "Agent Pixelate — Multi-Agent AI Marketing Campaign Studio",
  description:
    "Obsidian Canvas studio for orchestrating @VisualAgent and @CopyAgent inside a real-time BAND shared room.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090B] font-sans text-zinc-100 antialiased">
        <ClerkAuthProvider>{children}</ClerkAuthProvider>
      </body>
    </html>
  );
}
