"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Briefcase, Settings, ChevronDown, Check, FolderKanban } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSession } from "../providers/auth-provider";
import { useRole } from "../../hooks/use-role";
import { cn } from "../../lib/cn";

export function ProjectSelector() {
  const { token } = useSession();
  const { role } = useRole();
  const [isOpen, setIsOpen] = React.useState(false);

  const projects = useQuery(
    api.projects.listProjects,
    token ? { token } : "skip"
  );

  const [selectedProjectId, setSelectedProjectId] = React.useState<string | "all">("all");

  // Load selection from localStorage if present
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("nirman_selected_project_id");
      if (saved) {
        setSelectedProjectId(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleSelect = (id: string | "all") => {
    setSelectedProjectId(id);
    try {
      localStorage.setItem("nirman_selected_project_id", id);
    } catch {
      // ignore storage errors
    }
    setIsOpen(false);
  };

  const selectedProject = React.useMemo(() => {
    if (selectedProjectId === "all" || !projects) return null;
    return projects.find((p) => p._id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  const displayName = selectedProject
    ? `${selectedProject.name}`
    : projects && projects.length > 0
    ? "All Scoped Projects"
    : "Projects";

  const isManagementRole = role === "admin" || role === "project_manager";

  const targetHref = React.useMemo(() => {
    if (role === "admin") {
      return "/dashboard/admin/projects";
    }
    if (role === "project_manager") {
      if (selectedProject) return `/dashboard/admin/projects/${selectedProject._id}`;
      if (projects && projects.length > 0) return `/dashboard/admin/projects/${projects[0]._id}`;
    }
    return null;
  }, [role, selectedProject, projects]);

  return (
    <div className="relative w-full flex items-center gap-1.5 px-1 py-1.5">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left text-sm font-semibold rounded-md border border-border bg-surface text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer select-none"
      >
        <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate flex-1" title={displayName}>
          {displayName}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Settings / Projects Management Hub Link */}
      {targetHref && (
        <Link
          href={targetHref}
          className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-sm flex-shrink-0"
          title={role === "admin" ? "Projects & Sites Management" : "Project BOQ & Ledger"}
        >
          <Settings className="h-4 w-4" />
        </Link>
      )}

      {/* Popover list */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-1 right-0 mt-1 z-50 rounded-md border border-border bg-surface p-1 shadow-md animate-in fade-in slide-in-from-top-1 min-w-[220px]">
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider select-none border-b border-border mb-1">
              <span>Select Project</span>
              {projects && (
                <span className="text-[9px] font-normal lowercase">
                  ({projects.length} available)
                </span>
              )}
            </div>

            {/* All Projects Option */}
            <button
              onClick={() => handleSelect("all")}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded hover:bg-muted transition-colors cursor-pointer select-none",
                selectedProjectId === "all" ? "text-primary bg-primary/10" : "text-muted-foreground"
              )}
            >
              {selectedProjectId === "all" ? (
                <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="truncate">All Scoped Projects</span>
            </button>

            {/* Real Projects from Backend */}
            {projects && projects.length > 0 ? (
              projects.map((proj) => (
                <button
                  key={proj._id}
                  onClick={() => handleSelect(proj._id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded hover:bg-muted transition-colors cursor-pointer select-none",
                    selectedProjectId === proj._id ? "text-primary bg-primary/10" : "text-foreground"
                  )}
                >
                  {selectedProjectId === proj._id ? (
                    <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  ) : (
                    <span className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <div className="truncate flex-1 flex items-center justify-between gap-1.5">
                    <span className="truncate">{proj.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono uppercase shrink-0">
                      {proj.code}
                    </span>
                  </div>
                </button>
              ))
            ) : projects === undefined ? (
              <div className="px-2.5 py-2 text-xs text-muted-foreground italic">
                Loading projects...
              </div>
            ) : (
              <div className="px-2.5 py-2 text-xs text-muted-foreground italic">
                No active projects assigned.
              </div>
            )}

            {/* Quick Link to Project Hub */}
            {targetHref && (
              <div className="mt-1 pt-1 border-t border-border">
                <Link
                  href={targetHref}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold text-primary rounded hover:bg-muted transition-colors select-none"
                >
                  <FolderKanban className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">
                    {role === "admin" ? "Manage Projects & Sites →" : "Open BOQ & Ledger →"}
                  </span>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
