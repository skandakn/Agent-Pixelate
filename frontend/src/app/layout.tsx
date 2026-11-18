import type { Metadata } from "next";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./globals.css";
import { ClerkAuthProvider } from "@/components/ClerkAuthProvider";

export const metadata: Metadata = {
  title: "Agent Pixelate — Multi-Agent Campaign Studio",
  description:
    "Clean, precision multi-agent studio for orchestrating @VisualAgent and @CopyAgent inside a real-time BAND shared room.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F5F7] font-sans text-[#1D1D1F] antialiased">
        <ClerkAuthProvider>{children}</ClerkAuthProvider>
      </body>
    </html>
  );
}
