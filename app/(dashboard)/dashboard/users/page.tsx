"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useSession } from "@/components/providers/auth-provider";
import { useRole } from "@/hooks/use-role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  UserCog,
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  Building2,
  HardHat,
  Briefcase,
  ShoppingBag,
  MapPin,
  Edit2,
  ShieldAlert,
  Loader2,
  AlertCircle,
  Sliders,
} from "lucide-react";

export default function UsersPage() {
  const { role } = useRole();
  const { token } = useSession();

  const [searchQuery, setSearchQuery] = React.useState("");

  // Scoping Dialog State
  const [isScopingOpen, setIsScopingOpen] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<any | null>(null);
  const [assignedProjectIds, setAssignedProjectIds] = React.useState<string[]>([]);
  const [assignedSiteIds, setAssignedSiteIds] = React.useState<string[]>([]);
  const [scopingError, setScopingError] = React.useState<string | null>(null);
  const [isSavingScoping, setIsSavingScoping] = React.useState(false);

  // Role Change Dialog State
  const [isRoleDialogOpen, setIsRoleDialogOpen] = React.useState(false);
  const [newRole, setNewRole] = React.useState<string>("site_supervisor");
  const [roleError, setRoleError] = React.useState<string | null>(null);
  const [isSavingRole, setIsSavingRole] = React.useState(false);

  // Edit Profile Dialog State
  const [isProfileDialogOpen, setIsProfileDialogOpen] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editIsActive, setEditIsActive] = React.useState(true);
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);

  // Queries
  const users = useQuery(api.users.list, token ? { token } : "skip");
  const allProjects = useQuery(api.projects.listAllProjects, token && role === "admin" ? { token } : "skip");
  const allSites = useQuery(api.sites.listAllSites, token && role === "admin" ? { token } : "skip");

  // Mutations
  const updateUserAssignments = useMutation(api.users.updateUserAssignments);
  const updateUser = useMutation(api.users.updateUser);
  const changeUserRole = useMutation(api.users.changeUserRole);

  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const getRoleIcon = (userRole: string) => {
    switch (userRole) {
      case "site_supervisor":
        return <HardHat className="h-4 w-4 text-blue-500" />;
      case "project_manager":
        return <Briefcase className="h-4 w-4 text-purple-500" />;
      case "procurement_officer":
        return <ShoppingBag className="h-4 w-4 text-amber-500" />;
      case "admin":
        return <ShieldCheck className="h-4 w-4 text-emerald-500" />;
      default:
        return <Users className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (userRole: string) => {
    switch (userRole) {
      case "site_supervisor":
        return "processing";
      case "project_manager":
        return "pending";
      case "procurement_officer":
        return "delivery";
      case "admin":
        return "success";
      default:
        return "draft";
    }
  };

  // Open Scoping Dialog
  const openScopingDialog = (u: any) => {
    setSelectedUser(u);
    setAssignedProjectIds(u.assignedProjectIds || []);
    setAssignedSiteIds(u.assignedSiteIds || []);
    setScopingError(null);
    setIsScopingOpen(true);
  };

  const handleToggleProject = (projectId: string) => {
    setAssignedProjectIds((prev) => {
      const exists = prev.includes(projectId);
      if (exists) {
        // Remove project and its sites
        const projectSites = (allSites || []).filter((s) => s.projectId === projectId).map((s) => s._id);
        setAssignedSiteIds((sites) => sites.filter((id) => !projectSites.includes(id as any)));
        return prev.filter((id) => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleToggleSite = (siteId: string, parentProjectId: string) => {
    setAssignedSiteIds((prev) => {
      const exists = prev.includes(siteId);
      if (exists) {
        return prev.filter((id) => id !== siteId);
      } else {
        // Auto-include parent project if not already selected
        if (!assignedProjectIds.includes(parentProjectId)) {
          setAssignedProjectIds((projects) => [...projects, parentProjectId]);
        }
        return [...prev, siteId];
      }
    });
  };

  const handleSaveScoping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;

    setScopingError(null);
    setIsSavingScoping(true);

    try {
      await updateUserAssignments({
        userId: selectedUser._id,
        assignedProjectIds: assignedProjectIds as Id<"projects">[],
        assignedSiteIds: assignedSiteIds as Id<"sites">[],
        token,
      });
      setIsScopingOpen(false);
    } catch (err: any) {
      setScopingError(err.message || "Failed to update assignments.");
    } finally {
      setIsSavingScoping(false);
    }
  };

  // Open Role Dialog
  const openRoleDialog = (u: any) => {
    setSelectedUser(u);
    setNewRole(u.role);
    setRoleError(null);
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;

    setRoleError(null);
    setIsSavingRole(true);

    try {
      await changeUserRole({
        userId: selectedUser._id,
        newRole: newRole as any,
        token,
      });
      setIsRoleDialogOpen(false);
    } catch (err: any) {
      setRoleError(err.message || "Failed to change user role.");
    } finally {
      setIsSavingRole(false);
    }
  };

  // Open Profile Dialog
  const openProfileDialog = (u: any) => {
    setSelectedUser(u);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
    setEditPhone(u.phone || "");
    setEditIsActive(u.isActive !== false);
    setProfileError(null);
    setIsProfileDialogOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedUser) return;

    setProfileError(null);
    setIsSavingProfile(true);

    try {
      await updateUser({
        userId: selectedUser._id,
        name: editName.trim(),
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        isActive: editIsActive,
        token,
      });
      setIsProfileDialogOpen(false);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground select-none">
              User & Access Control
            </h1>
            <Badge variant="success">RBAC & Scoping</Badge>
          </div>
          <p className="text-xs text-muted-foreground select-none mt-1">
            Manage user identities, security roles, and project/site assignment boundaries.
          </p>
        </div>
      </div>

      {/* Role Matrix Quick Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider">
              Site Supervisor
            </span>
            <HardHat className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Raises MRs & Signs GRNs</p>
          <p className="text-[10px] text-muted-foreground font-mono">Scoped to assigned sites</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider">
              Project Manager
            </span>
            <Briefcase className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Approves MR, CC & PO</p>
          <p className="text-[10px] text-muted-foreground font-mono">Scoped to assigned projects</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider">
              Procurement Officer
            </span>
            <ShoppingBag className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Creates CC, PO & DC</p>
          <p className="text-[10px] text-muted-foreground font-mono">Commercial execution</p>
        </div>

        <div className="p-3 bg-card border border-border rounded-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-500 uppercase tracking-wider">
              System Admin
            </span>
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xs font-semibold text-foreground">Master Control & Config</p>
          <p className="text-[10px] text-muted-foreground font-mono">Global Unrestricted Access</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
        <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            System User Directory ({users?.length || 0})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search users by name, role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>
        </div>

        {users === undefined ? (
          <div className="p-6 space-y-2">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted/60 animate-pulse rounded" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            No system accounts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">User & Profile</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Project / Site Scoping</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u) => {
                  const isAdmin = u.role === "admin";
                  const projectCount = u.assignedProjectIds?.length || 0;
                  const siteCount = u.assignedSiteIds?.length || 0;

                  return (
                    <tr key={u._id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-accent text-accent-foreground font-bold text-xs flex items-center justify-center shrink-0">
                            {u.name?.substring(0, 2).toUpperCase() || "US"}
                          </div>
                          <div>
                            <span className="font-semibold text-foreground block">{u.name}</span>
                            {u.email && (
                              <span className="text-[10px] text-muted-foreground block">{u.email}</span>
                            )}
                            {u.phone && (
                              <span className="text-[10px] text-muted-foreground font-mono">{u.phone}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono font-medium text-foreground">
                        {u.username || "—"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {getRoleIcon(u.role)}
                          <Badge variant={getRoleBadgeVariant(u.role) as any}>
                            {u.role.replace("_", " ")}
                          </Badge>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" /> Global Access (All Sites)
                          </span>
                        ) : projectCount > 0 || siteCount > 0 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                              <Building2 className="h-3 w-3" /> {projectCount} project(s)
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                              <MapPin className="h-3 w-3" /> {siteCount} site(s)
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Unassigned (Cannot view scoped docs)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {u.isActive !== false ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {role === "admin" && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScopingDialog(u)}
                              className="h-7 text-[11px] gap-1 text-blue-600 hover:text-blue-700"
                              title="Assign Projects and Sites"
                            >
                              <Sliders className="h-3 w-3" /> Scoping
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRoleDialog(u)}
                              className="h-7 text-[11px] gap-1"
                              title="Change Role"
                            >
                              <ShieldCheck className="h-3 w-3" /> Role
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openProfileDialog(u)}
                              className="h-7 text-[11px] gap-1"
                              title="Edit Profile"
                            >
                              <Edit2 className="h-3 w-3" /> Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN SCOPING DIALOG */}
      <Dialog open={isScopingOpen} onOpenChange={setIsScopingOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-500" />
              Scoping Access: {selectedUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign target projects and sites. Scoped queries (S1-04) will restrict this user&apos;s visibility exclusively to documents within these locations.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveScoping} className="space-y-4 py-2 overflow-y-auto pr-1 flex-1">
            {scopingError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{scopingError}</span>
              </div>
            )}

            {selectedUser?.role === "admin" && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-300 text-xs">
                <strong>Note:</strong> System Administrators have global access to all projects and sites by default. Scoping rules are evaluated but will never block an Admin.
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Select Projects & Sites
                </h4>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {assignedProjectIds.length} projects, {assignedSiteIds.length} sites selected
                </span>
              </div>

              {allProjects === undefined || allSites === undefined ? (
                <div className="p-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading projects & sites...
                </div>
              ) : allProjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No projects configured yet. Create a project in the Projects master first.
                </div>
              ) : (
                <div className="space-y-3">
                  {allProjects.map((project) => {
                    const isProjectSelected = assignedProjectIds.includes(project._id);
                    const projectSites = allSites.filter((s) => s.projectId === project._id);

                    return (
                      <div
                        key={project._id}
                        className={`border rounded-xl p-3 transition-colors ${
                          isProjectSelected
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-card"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isProjectSelected}
                              onChange={() => handleToggleProject(project._id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="font-bold text-xs text-foreground">{project.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {project.code}
                            </span>
                          </label>
                          <Badge variant={project.status === "active" ? "success" : "draft"}>
                            {project.status}
                          </Badge>
                        </div>

                        {/* Sites under this project */}
                        <div className="pt-2 pl-6 space-y-1.5">
                          {projectSites.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground italic">
                              No sites defined under this project.
                            </span>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {projectSites.map((site) => {
                                const isSiteSelected = assignedSiteIds.includes(site._id);
                                return (
                                  <label
                                    key={site._id}
                                    className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                                      isSiteSelected
                                        ? "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                        : "border-transparent hover:bg-muted/40 text-foreground"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSiteSelected}
                                      onChange={() => handleToggleSite(site._id, project._id)}
                                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="truncate">
                                      <span className="font-medium">{site.name}</span>
                                      <span className="font-mono text-[10px] text-muted-foreground ml-1">
                                        ({site.code})
                                      </span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-border mt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsScopingOpen(false)}
                disabled={isSavingScoping}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingScoping}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                {isSavingScoping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Scoping Assignments
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CHANGE ROLE DIALOG */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Change Role: {selectedUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Reassign security permissions. Lockout protection prevents demoting the last Administrator.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveRole} className="space-y-4 py-2">
            {roleError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{roleError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Select New Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full h-9 text-xs px-3 rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="site_supervisor">Site Supervisor (MRs & GRNs on site)</option>
                <option value="project_manager">Project Manager (Approvals & Budgets)</option>
                <option value="procurement_officer">Procurement Officer (Vendor Quotations & POs)</option>
                <option value="admin">System Administrator (Master Controls)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRoleDialogOpen(false)}
                disabled={isSavingRole}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingRole}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                {isSavingRole && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Role Change
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PROFILE DIALOG */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="h-4 w-4" />
              Edit User: {selectedUser?.name}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update personal details and active account access.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveProfile} className="space-y-4 py-2">
            {profileError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Full Name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Email Address</label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Phone Number</label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="editIsActive"
                checked={editIsActive}
                onChange={(e) => setEditIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="editIsActive" className="text-xs font-medium text-foreground cursor-pointer select-none">
                Account is Active (Uncheck to deactivate access)
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProfileDialogOpen(false)}
                disabled={isSavingProfile}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSavingProfile}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                {isSavingProfile && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Profile Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
