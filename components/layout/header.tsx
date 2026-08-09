"use client";
import * as React from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Menu, Bell, Sparkles } from "lucide-react";
import { Button } from "../ui/button";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full h-16 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6 shadow-sm select-none">
      {/* Left side: Hamburger (mobile) & Brand */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-8 w-8"
          onClick={onMenuToggle}
        >
          <Menu className="h-4.5 w-4.5" />
          <span className="sr-only">Toggle Sidebar</span>
        </Button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shadow-sm">
            N
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground hidden sm:inline-block">
            Nirman ERP
          </span>
        </Link>
      </div>

      {/* Middle side: AI Command Bar Trigger */}
      <div className="flex-1 max-width-[480px] mx-4 hidden md:block">
        <button
          onClick={() => {}} // Command palette placeholder
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground rounded-md border border-border bg-background hover:bg-muted hover:text-foreground transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ask AI to create anything...</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-surface px-1.5 font-mono text-[9px] font-medium text-muted-foreground">
            <span className="text-[10px]">⌘</span>K
          </kbd>
        </button>
      </div>

      {/* Right side: Alert & Profile UserButton */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="sr-only">Notifications</span>
        </Button>

        {/* User Avatar with Profile Manager Dropdown */}
        <div className="flex items-center pl-1 border-l border-border h-6">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-7 w-7 rounded-full border border-border shadow-sm",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
