"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, LogOut, PanelLeftClose, PanelLeft } from "lucide-react";
import { useRole } from "../../hooks/use-role";
import { navConfig, type NavItem } from "../../lib/nav-config";
import { ProjectSelector } from "./project-selector";
import { cn } from "../../lib/cn";
import { useClerk } from "@clerk/nextjs";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { role, user } = useRole();
  
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isSupplyExpanded, setIsSupplyExpanded] = React.useState(true);

  // Default to site_supervisor if loading or no user record exists yet
  const activeRole = role || "site_supervisor";
  const navGroups = navConfig[activeRole] || [];

  return (
    <TooltipProvider>
      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden animate-in fade-in"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 flex flex-col border-r border-border bg-surface select-none transition-all duration-200 ease-in-out md:sticky",
          isCollapsed ? "w-16" : "w-60",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Project Selector Bar / Brand Header */}
        <div className="h-16 flex items-center justify-between border-b border-border px-3.5">
          {!isCollapsed ? (
            <ProjectSelector />
          ) : (
            <div className="mx-auto h-7 w-7 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shadow-sm select-none">
              N
            </div>
          )}
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4">
          {navGroups.map((group) => {
            const isSupplyGroup = group.label === "Supply";

            // If it is the collapsible Supply group
            if (isSupplyGroup) {
              return (
                <div key={group.label} className="space-y-1">
                  {!isCollapsed ? (
                    <button
                      onClick={() => setIsSupplyExpanded(!isSupplyExpanded)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground cursor-pointer select-none transition-colors"
                    >
                      <span>{group.label}</span>
                      {isSupplyExpanded ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    <div className="w-full border-t border-border my-2" />
                  )}

                  {(!isCollapsed ? isSupplyExpanded : true) && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => (
                        <SidebarLink
                          key={item.title}
                          item={item}
                          isCollapsed={isCollapsed}
                          isActive={pathname === item.href}
                          onClose={onClose}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // Normal Main nav groups
            return (
              <div key={group.label} className="space-y-1">
                {!isCollapsed && (
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.title}
                      item={item}
                      isCollapsed={isCollapsed}
                      isActive={pathname === item.href}
                      onClose={onClose}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Collapse Toggle & Footer Card */}
        <div className="p-3.5 border-t border-border space-y-2 mt-auto">
          {/* Collapse Toggle button */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center md:justify-start gap-2 h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors cursor-pointer select-none"
          >
            {isCollapsed ? (
              <>
                <PanelLeft className="h-4 w-4" />
              </>
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span className="font-medium">Collapse sidebar</span>
              </>
            )}
          </button>

          {/* User Logged-in profile badge */}
          <div
            className={cn(
              "flex items-center gap-2.5 p-1 rounded-md border border-border bg-background shadow-sm",
              isCollapsed && "justify-center"
            )}
          >
            <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground font-bold text-xs flex items-center justify-center flex-shrink-0 select-none">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : "US"}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">
                  {user?.name || "Guest User"}
                </div>
                <div className="text-[10px] text-muted-foreground capitalize truncate">
                  {activeRole.replace("_", " ")}
                </div>
              </div>
            )}
            {!isCollapsed && (
              <button
                onClick={() => signOut()}
                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

interface SidebarLinkProps {
  item: NavItem;
  isCollapsed: boolean;
  isActive: boolean;
  onClose?: () => void;
}

function SidebarLink({ item, isCollapsed, isActive, onClose }: SidebarLinkProps) {
  const Icon = item.icon;

  const content = (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 text-sm font-semibold rounded-md transition-colors cursor-pointer select-none",
        isActive
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
        isCollapsed && "justify-center px-0 h-9 w-9 mx-auto"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center rounded-md p-1",
          isActive ? "bg-primary/10" : "bg-transparent"
        )}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      {!isCollapsed && <span className="truncate flex-1">{item.title}</span>}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{item.title}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
