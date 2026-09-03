"use client";
import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Collapsible/Responsive Left Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Right Area content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-[1200px] mx-auto px-4 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
