"use client";
import * as React from "react";
import Link from "next/link";
import { Briefcase, Settings, ChevronDown, Check } from "lucide-react";
import { cn } from "../../lib/cn";

export function ProjectSelector() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedProject, setSelectedProject] = React.useState("Project Alpha");
  
  const projects = ["Project Alpha", "Project Beta", "All Projects"];

  return (
    <div className="relative w-full flex items-center gap-1.5 px-1 py-1.5">
      {/* Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex-1 flex items-center gap-2 px-2.5 py-2 text-left text-sm font-semibold rounded-md border border-border bg-surface text-foreground hover:bg-muted transition-colors shadow-sm cursor-pointer select-none"
      >
        <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="truncate flex-1">{selectedProject}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      </button>

      {/* Settings Link */}
      <Link
        href="/dashboard/settings/project"
        className="h-9 w-9 flex items-center justify-center rounded-md border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shadow-sm flex-shrink-0"
        title="Project Settings"
      >
        <Settings className="h-4 w-4" />
      </Link>

      {/* Popover list */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-1 right-10 mt-1 z-50 rounded-md border border-border bg-surface p-1 shadow-md animate-in fade-in slide-in-from-top-1">
            <div className="text-[10px] font-bold text-muted-foreground px-2.5 py-1.5 uppercase tracking-wider select-none">
              Select Project
            </div>
            {projects.map((proj) => (
              <button
                key={proj}
                onClick={() => {
                  setSelectedProject(proj);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-semibold rounded hover:bg-muted transition-colors cursor-pointer select-none",
                  selectedProject === proj ? "text-primary" : "text-muted-foreground"
                )}
              >
                {selectedProject === proj ? (
                  <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="truncate">{proj}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
