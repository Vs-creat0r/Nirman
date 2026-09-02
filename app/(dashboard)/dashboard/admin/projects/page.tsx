"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  MapPin,
  Plus,
  Search,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  ShieldAlert,
  Loader2,
} from "lucide-react";

type ProjectStatus = "active" | "on_hold" | "closed";

export default function ProjectsSitesManagementPage() {
  const { role } = useRole();
  const { token } = useSession();

  const [activeTab, setActiveTab] = React.useState<"projects" | "sites">("projects");
  const [projectSearch, setProjectSearch] = React.useState("");
  const [siteSearch, setSiteSearch] = React.useState("");
  const [siteProjectFilter, setSiteProjectFilter] = React.useState<string>("all");

  // Project Dialog State
  const [isProjectDialogOpen, setIsProjectDialogOpen] = React.useState(false);
  const [editingProjectId, setEditingProjectId] = React.useState<Id<"projects"> | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [projectCode, setProjectCode] = React.useState("");
  const [projectClient, setProjectClient] = React.useState("");
  const [projectStartDate, setProjectStartDate] = React.useState("");
  const [projectEndDate, setProjectEndDate] = React.useState("");
  const [projectStatus, setProjectStatus] = React.useState<ProjectStatus>("active");
  const [projectError, setProjectError] = React.useState<string | null>(null);
  const [isSubmittingProject, setIsSubmittingProject] = React.useState(false);

  // Site Dialog State
  const [isSiteDialogOpen, setIsSiteDialogOpen] = React.useState(false);
  const [editingSiteId, setEditingSiteId] = React.useState<Id<"sites"> | null>(null);
  const [siteProjectId, setSiteProjectId] = React.useState<string>("");
  const [siteName, setSiteName] = React.useState("");
  const [siteCode, setSiteCode] = React.useState("");
  const [siteAddress, setSiteAddress] = React.useState("");
  const [siteIsActive, setSiteIsActive] = React.useState(true);
  const [siteError, setSiteError] = React.useState<string | null>(null);
  const [isSubmittingSite, setIsSubmittingSite] = React.useState(false);

  // Queries (guarded for admin role to prevent unauthorized hook execution)
  const isAdmin = role === "admin";
  const allProjects = useQuery(api.projects.listAllProjects, token && isAdmin ? { token } : "skip");
  const allSites = useQuery(api.sites.listAllSites, token && isAdmin ? { token } : "skip");

  // Mutations
  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);
  const createSite = useMutation(api.sites.createSite);
  const updateSite = useMutation(api.sites.updateSite);

  // Access check
  if (role && role !== "admin") {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Access Denied</h2>
        <p className="text-xs text-muted-foreground">
          Projects and Sites master configuration is restricted to System Administrators.
        </p>
      </div>
    );
  }

  // Filtered lists
  const filteredProjects = (allProjects || []).filter((p) => {
    if (!projectSearch.trim()) return true;
    const q = projectSearch.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.client && p.client.toLowerCase().includes(q))
    );
  });

  const filteredSites = (allSites || []).filter((s) => {
    const matchesProject =
      siteProjectFilter === "all" || s.projectId === (siteProjectFilter as Id<"projects">);
    if (!matchesProject) return false;

    if (!siteSearch.trim()) return true;
    const q = siteSearch.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.projectName.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q))
    );
  });

  // Project Handlers
  const openCreateProjectDialog = () => {
    setEditingProjectId(null);
    setProjectName("");
    setProjectCode("");
    setProjectClient("");
    setProjectStartDate("");
    setProjectEndDate("");
    setProjectStatus("active");
    setProjectError(null);
    setIsProjectDialogOpen(true);
  };

  const openEditProjectDialog = (p: NonNullable<typeof allProjects>[number]) => {
    setEditingProjectId(p._id);
    setProjectName(p.name);
    setProjectCode(p.code);
    setProjectClient(p.client || "");
    setProjectStartDate(p.startDate || "");
    setProjectEndDate(p.endDate || "");
    setProjectStatus((p.status as ProjectStatus) || "active");
    setProjectError(null);
    setIsProjectDialogOpen(true);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setProjectError(null);
    setIsSubmittingProject(true);

    try {
      if (editingProjectId) {
        await updateProject({
          id: editingProjectId,
          name: projectName.trim(),
          code: projectCode.trim().toUpperCase(),
          client: projectClient.trim() || undefined,
          startDate: projectStartDate || undefined,
          endDate: projectEndDate || undefined,
          status: projectStatus,
          token,
        });
      } else {
        await createProject({
          name: projectName.trim(),
          code: projectCode.trim().toUpperCase(),
          client: projectClient.trim() || undefined,
          startDate: projectStartDate || undefined,
          endDate: projectEndDate || undefined,
          status: projectStatus,
          token,
        });
      }
      setIsProjectDialogOpen(false);
    } catch (err: any) {
      setProjectError(err.message || "Failed to save project.");
    } finally {
      setIsSubmittingProject(false);
    }
  };

  // Site Handlers
  const openCreateSiteDialog = (defaultProjectId?: string) => {
    setEditingSiteId(null);
    setSiteProjectId(defaultProjectId || (allProjects && allProjects.length > 0 ? allProjects[0]._id : ""));
    setSiteName("");
    setSiteCode("");
    setSiteAddress("");
    setSiteIsActive(true);
    setSiteError(null);
    setIsSiteDialogOpen(true);
  };

  const openEditSiteDialog = (s: NonNullable<typeof allSites>[number]) => {
    setEditingSiteId(s._id);
    setSiteProjectId(s.projectId);
    setSiteName(s.name);
    setSiteCode(s.code);
    setSiteAddress(s.address || "");
    setSiteIsActive(s.isActive);
    setSiteError(null);
    setIsSiteDialogOpen(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!siteProjectId) {
      setSiteError("Please select a parent project.");
      return;
    }

    setSiteError(null);
    setIsSubmittingSite(true);

    try {
      if (editingSiteId) {
        await updateSite({
          id: editingSiteId,
          name: siteName.trim(),
          code: siteCode.trim().toUpperCase(),
          address: siteAddress.trim() || undefined,
          isActive: siteIsActive,
          token,
        });
      } else {
        await createSite({
          projectId: siteProjectId as Id<"projects">,
          name: siteName.trim(),
          code: siteCode.trim().toUpperCase(),
          address: siteAddress.trim() || undefined,
          isActive: siteIsActive,
          token,
        });
      }
      setIsSiteDialogOpen(false);
    } catch (err: any) {
      setSiteError(err.message || "Failed to save site.");
    } finally {
      setIsSubmittingSite(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              Projects & Sites Master
            </h1>
            <Badge variant="success">Admin Master</Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Configure capital tender projects and assignable construction site locations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={openCreateProjectDialog}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openCreateSiteDialog()}
            disabled={!allProjects || allProjects.length === 0}
            className="text-xs h-8 gap-1.5 font-semibold"
          >
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            New Site
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Projects
          </span>
          <div className="text-2xl font-bold text-foreground">
            {allProjects?.length ?? "—"}
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            Active Projects
          </span>
          <div className="text-2xl font-bold text-foreground">
            {allProjects?.filter((p) => p.status === "active").length ?? "—"}
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
            Total Sites
          </span>
          <div className="text-2xl font-bold text-foreground">
            {allSites?.length ?? "—"}
          </div>
        </div>

        <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Sites
          </span>
          <div className="text-2xl font-bold text-foreground">
            {allSites?.filter((s) => s.isActive).length ?? "—"}
          </div>
        </div>
      </div>

      {/* Tabs Control */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("projects")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "projects"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Projects ({allProjects?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("sites")}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "sites"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MapPin className="h-4 w-4" />
          Sites ({allSites?.length || 0})
        </button>
      </div>

      {/* TAB 1: PROJECTS */}
      {activeTab === "projects" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Projects Master Directory
            </h3>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search projects by name, code..."
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
          </div>

          {allProjects === undefined ? (
            <div className="p-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading projects...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <Building2 className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p>No projects match your search criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Project Name & Code</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Sites</th>
                    <th className="px-4 py-3">Timeline</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProjects.map((p) => (
                    <tr key={p._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-bold text-foreground block">{p.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {p.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-foreground font-medium">
                        {p.client || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                          <MapPin className="h-3 w-3" />
                          {p.activeSiteCount} active / {p.siteCount} total
                        </span>
                      </td>

                      <td className="px-4 py-3 text-[11px] text-muted-foreground font-mono">
                        {p.startDate || p.endDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {p.startDate || "—"} → {p.endDate || "—"}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.status === "active"
                              ? "success"
                              : p.status === "on_hold"
                              ? "pending"
                              : "draft"
                          }
                        >
                          {p.status.replace("_", " ")}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/dashboard/admin/projects/${p._id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] gap-1 text-primary hover:underline"
                            >
                              <Layers className="h-3 w-3" /> BOQ & Detail
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCreateSiteDialog(p._id)}
                            className="h-7 text-[11px] gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          >
                            <Plus className="h-3 w-3" /> Add Site
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditProjectDialog(p)}
                            className="h-7 text-[11px] gap-1"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SITES */}
      {activeTab === "sites" && (
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
              Construction Sites Directory
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={siteProjectFilter}
                onChange={(e) => setSiteProjectFilter(e.target.value)}
                className="h-8 text-xs px-2.5 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Projects</option>
                {(allProjects || []).map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search sites..."
                  value={siteSearch}
                  onChange={(e) => setSiteSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
            </div>
          </div>

          {allSites === undefined ? (
            <div className="p-8 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading sites...
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground space-y-2">
              <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p>No construction sites found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Site Name & Code</th>
                    <th className="px-4 py-3">Parent Project</th>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSites.map((s) => (
                    <tr key={s._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="font-bold text-foreground block">{s.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {s.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="font-semibold text-foreground">{s.projectName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            ({s.projectCode})
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                        {s.address || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <Badge variant={s.isActive ? "success" : "draft"}>
                          {s.isActive ? "Active Site" : "Inactive"}
                        </Badge>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSiteDialog(s)}
                          className="h-7 text-[11px] gap-1"
                        >
                          <Edit2 className="h-3 w-3" /> Edit Site
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PROJECT DIALOG */}
      <Dialog open={isProjectDialogOpen} onOpenChange={setIsProjectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingProjectId ? "Edit Project" : "Create New Project"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure tender metadata and reference code for commercial procurement.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProject} className="space-y-4 py-2">
            {projectError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{projectError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. Metro Line 4 Station Works"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Project Code <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. ML4-STN"
                  value={projectCode}
                  onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
                  required
                  className="text-xs h-9 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Uppercase alphanumeric code</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Client Name</label>
                <Input
                  placeholder="e.g. MMRDA Authority"
                  value={projectClient}
                  onChange={(e) => setProjectClient(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Start Date</label>
                <Input
                  type="date"
                  value={projectStartDate}
                  onChange={(e) => setProjectStartDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Target Completion</label>
                <Input
                  type="date"
                  value={projectEndDate}
                  onChange={(e) => setProjectEndDate(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Project Status</label>
              <select
                value={projectStatus}
                onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)}
                className="w-full h-9 text-xs px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="active">Active (Open for procurement)</option>
                <option value="on_hold">On Hold</option>
                <option value="closed">Closed / Completed</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProjectDialogOpen(false)}
                disabled={isSubmittingProject}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingProject}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                {isSubmittingProject && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingProjectId ? "Update Project" : "Create Project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT SITE DIALOG */}
      <Dialog open={isSiteDialogOpen} onOpenChange={setIsSiteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingSiteId ? "Edit Construction Site" : "Create Construction Site"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a physical site location linked to a parent capital project.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSite} className="space-y-4 py-2">
            {siteError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{siteError}</span>
              </div>
            )}

            {!editingSiteId && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Parent Project <span className="text-destructive">*</span>
                </label>
                <select
                  value={siteProjectId}
                  onChange={(e) => setSiteProjectId(e.target.value)}
                  required
                  className="w-full h-9 text-xs px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="" disabled>Select parent project</option>
                  {(allProjects || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Site Name <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. North Gate Batching Plant"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Site Code <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder="e.g. N-PLANT"
                value={siteCode}
                onChange={(e) => setSiteCode(e.target.value.toUpperCase())}
                required
                className="text-xs h-9 font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Unique uppercase site identifier (1-12 chars)</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Site Address / Landmark</label>
              <Input
                placeholder="e.g. Sector 21, Near Western Express Highway"
                value={siteAddress}
                onChange={(e) => setSiteAddress(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="siteIsActive"
                checked={siteIsActive}
                onChange={(e) => setSiteIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="siteIsActive" className="text-xs font-medium text-foreground cursor-pointer select-none">
                Site is active and receiving material dispatches
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsSiteDialogOpen(false)}
                disabled={isSubmittingSite}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingSite}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                {isSubmittingSite && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingSiteId ? "Update Site" : "Create Site"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
