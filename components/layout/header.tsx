"use client";
import * as React from "react";
import Link from "next/link";
import { Menu, Bell, Sparkles, LogOut, UserCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/components/providers/auth-provider";
import { ProfileDialog } from "@/components/profile/profile-dialog";

interface HeaderProps {
  onMenuToggle?: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
  const { user, role } = useRole();
  const { logout } = useSession();
  const [profileOpen, setProfileOpen] = React.useState(false);

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

      {/* Right side: Alert & Profile */}
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

        {/* User Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity cursor-pointer outline-none">
              <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground font-bold text-xs flex items-center justify-center select-none shadow-sm">
                {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-none truncate max-w-[120px]">
                  {user?.name || "User"}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize leading-none mt-0.5">
                  {(role || "guest").replace("_", " ")}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-muted-foreground hidden lg:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-xs font-semibold text-foreground leading-none">{user?.name || "User"}</p>
                <p className="text-[10px] text-muted-foreground leading-none capitalize">{(role || "guest").replace("_", " ")}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setProfileOpen(true)} className="gap-2 cursor-pointer">
              <UserCircle className="h-3.5 w-3.5 text-primary" />
              <span>My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="gap-2 text-destructive focus:text-destructive cursor-pointer">
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      </div>
    </header>
  );
}
