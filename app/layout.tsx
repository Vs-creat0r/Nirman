import type { Metadata } from "next";
import { ClientOnlyProvider } from "../components/providers/client-only-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nirman ERP",
  description: "Construction Site ERP & Procurement Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="theme-brand h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <ClientOnlyProvider>{children}</ClientOnlyProvider>
      </body>
    </html>
  );
}
