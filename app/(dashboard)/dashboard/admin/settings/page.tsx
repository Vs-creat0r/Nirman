"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2,
  FileText,
  Sliders,
  CheckCircle2,
  Plus,
  Trash2,
  Edit2,
  Star,
  AlertCircle,
  Save,
} from "lucide-react";

export default function AdminSettingsPage() {
  const { token } = useSession();
  const [activeTab, setActiveTab] = React.useState<"company" | "templates" | "system">("company");

  // Company Profile state & queries
  const companyProfile = useQuery(
    api.company_settings.getCompanyProfile,
    token ? { token } : "skip"
  );
  const updateCompanyMutation = useMutation(api.company_settings.updateCompanyProfile);

  const [companyForm, setCompanyForm] = React.useState({
    companyName: "",
    companyGstNo: "",
    companyBillingAddress: "",
    companyContactPerson: "",
    companyPhone: "",
    companyEmail: "",
    requireManagerApprovalForRequests: true,
    defaultReorderLevel: 10,
    allowNegativeStock: true,
  });
  const [companySaveSuccess, setCompanySaveSuccess] = React.useState(false);
  const [companySaving, setCompanySaving] = React.useState(false);
  const [companyError, setCompanyError] = React.useState<string | null>(null);

  // Sync profile when loaded
  React.useEffect(() => {
    if (companyProfile) {
      setCompanyForm({
        companyName: companyProfile.companyName || "",
        companyGstNo: companyProfile.companyGstNo || "",
        companyBillingAddress: companyProfile.companyBillingAddress || "",
        companyContactPerson: companyProfile.companyContactPerson || "",
        companyPhone: companyProfile.companyPhone || "",
        companyEmail: companyProfile.companyEmail || "",
        requireManagerApprovalForRequests:
          companyProfile.requireManagerApprovalForRequests ?? true,
        defaultReorderLevel: companyProfile.defaultReorderLevel ?? 10,
        allowNegativeStock: companyProfile.allowNegativeStock ?? true,
      });
    }
  }, [companyProfile]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCompanyError(null);
    setCompanySaving(true);
    setCompanySaveSuccess(false);

    try {
      await updateCompanyMutation({
        companyName: companyForm.companyName,
        companyGstNo: companyForm.companyGstNo,
        companyBillingAddress: companyForm.companyBillingAddress,
        companyContactPerson: companyForm.companyContactPerson,
        companyPhone: companyForm.companyPhone,
        companyEmail: companyForm.companyEmail,
        requireManagerApprovalForRequests: companyForm.requireManagerApprovalForRequests,
        defaultReorderLevel: Number(companyForm.defaultReorderLevel) || 10,
        allowNegativeStock: companyForm.allowNegativeStock,
        token: token || undefined,
      });
      setCompanySaveSuccess(true);
      setTimeout(() => setCompanySaveSuccess(false), 3000);
    } catch (err: unknown) {
      setCompanyError(err instanceof Error ? err.message : "Failed to update company profile.");
    } finally {
      setCompanySaving(false);
    }
  };

  // T&C Templates
  const templates = useQuery(
    api.tc_templates.listTCTemplates,
    token ? { token } : "skip"
  );
  const createTemplateMutation = useMutation(api.tc_templates.createTCTemplate);
  const updateTemplateMutation = useMutation(api.tc_templates.updateTCTemplate);
  const deleteTemplateMutation = useMutation(api.tc_templates.deleteTCTemplate);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = React.useState(false);
  const [editingTemplateId, setEditingTemplateId] = React.useState<Id<"tc_templates"> | null>(null);
  const [templateForm, setTemplateForm] = React.useState({
    name: "",
    content: "",
    isDefault: false,
  });
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateError, setTemplateError] = React.useState<string | null>(null);

  const openNewTemplateModal = () => {
    setEditingTemplateId(null);
    setTemplateForm({
      name: "",
      content: `1. All materials supplied must strictly match approved technical specifications.\n2. Invoices must mention PO Reference number and GST details.\n3. Defective or non-conforming items will be returned at vendor's cost within 7 days of site delivery.\n4. Payment will be released as per agreed commercial credit terms upon physical verification of Goods Receipt Note (GRN).`,
      isDefault: templates?.length === 0,
    });
    setTemplateError(null);
    setIsTemplateModalOpen(true);
  };

  const openEditTemplateModal = (tpl: any) => {
    setEditingTemplateId(tpl._id);
    setTemplateForm({
      name: tpl.name,
      content: tpl.content,
      isDefault: !!tpl.isDefault,
    });
    setTemplateError(null);
    setIsTemplateModalOpen(true);
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.content.trim()) {
      setTemplateError("Name and content are required.");
      return;
    }
    setTemplateSaving(true);
    setTemplateError(null);

    try {
      if (editingTemplateId) {
        await updateTemplateMutation({
          id: editingTemplateId,
          name: templateForm.name,
          content: templateForm.content,
          isDefault: templateForm.isDefault,
          token: token || undefined,
        });
      } else {
        await createTemplateMutation({
          name: templateForm.name,
          content: templateForm.content,
          isDefault: templateForm.isDefault,
          token: token || undefined,
        });
      }
      setIsTemplateModalOpen(false);
    } catch (err: any) {
      setTemplateError(err.message || "Failed to save template.");
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: Id<"tc_templates">) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplateMutation({ id, token: token || undefined });
    } catch (err: any) {
      alert(err.message || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Global Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure buyer company profile, PO terms & conditions templates, and system policies.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("company")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors cursor-pointer ${
            activeTab === "company"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Building2 className="h-4 w-4" />
          Company Profile (Buyer Details)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("templates")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors cursor-pointer ${
            activeTab === "templates"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <FileText className="h-4 w-4" />
          T&C Templates
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("system")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors cursor-pointer ${
            activeTab === "system"
              ? "bg-primary text-primary-foreground font-bold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Sliders className="h-4 w-4" />
          System Preferences
        </button>
      </div>

      {/* Tab 1: Company Profile */}
      {activeTab === "company" && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Buyer Company Profile
            </CardTitle>
            <CardDescription className="text-xs">
              These details appear automatically as the Buyer / Ordering Entity on all Purchase Orders and formal documents.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSaveCompany} className="space-y-4 max-w-2xl">
              {companyError && (
                <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {companyError}
                </div>
              )}

              {companySaveSuccess && (
                <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  Company profile successfully updated!
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Legal Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    value={companyForm.companyName}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, companyName: e.target.value })
                    }
                    placeholder="e.g. Nirman Construction Pvt Ltd"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Company GST / Tax ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    value={companyForm.companyGstNo}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, companyGstNo: e.target.value })
                    }
                    placeholder="e.g. 27AABCN1234F1Z5"
                    className="text-xs h-9 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Registered Billing Address <span className="text-destructive">*</span>
                </Label>
                <textarea
                  required
                  rows={3}
                  value={companyForm.companyBillingAddress}
                  onChange={(e) =>
                    setCompanyForm({ ...companyForm, companyBillingAddress: e.target.value })
                  }
                  placeholder="Official registered company office address for invoice billing..."
                  className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Contact Person Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    value={companyForm.companyContactPerson}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, companyContactPerson: e.target.value })
                    }
                    placeholder="e.g. Head of Procurement"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Official Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    value={companyForm.companyPhone}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, companyPhone: e.target.value })
                    }
                    placeholder="e.g. +91 98765 43210"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Official Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="email"
                    required
                    value={companyForm.companyEmail}
                    onChange={(e) =>
                      setCompanyForm({ ...companyForm, companyEmail: e.target.value })
                    }
                    placeholder="e.g. procurement@nirman.infra"
                    className="text-xs h-9"
                  />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={companySaving}
                  className="gap-2 text-xs font-semibold"
                >
                  <Save className="h-4 w-4" />
                  {companySaving ? "Saving…" : "Save Company Profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab 2: T&C Templates */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Terms & Conditions Templates</h2>
              <p className="text-xs text-muted-foreground">
                Pre-configured clauses available to procurement officers during Purchase Order creation.
              </p>
            </div>
            <Button
              size="sm"
              onClick={openNewTemplateModal}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              New T&C Template
            </Button>
          </div>

          {templates === undefined ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Loading templates…
            </div>
          ) : templates.length === 0 ? (
            <Card className="p-8 text-center space-y-3">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground">
                No T&C templates configured yet. Create a standard template to streamline PO creation.
              </p>
              <Button size="sm" onClick={openNewTemplateModal} className="text-xs">
                Create First Template
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((tpl) => (
                <Card key={tpl._id} className="relative flex flex-col justify-between">
                  <CardHeader className="pb-3 border-b border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xs font-bold text-foreground">
                          {tpl.name}
                        </CardTitle>
                        {tpl.isDefault && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            <Star className="h-2.5 w-2.5 fill-amber-500" />
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditTemplateModal(tpl)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(tpl._id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-3 flex-1">
                    <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans bg-muted/30 p-3 rounded-md border border-border leading-relaxed line-clamp-6">
                      {tpl.content}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: System Preferences */}
      {activeTab === "system" && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              System Approval Policies
            </CardTitle>
            <CardDescription className="text-xs">
              Configure system-wide workflow constraints and auto-approval policies.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-4">
            {companyError && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {companyError}
              </div>
            )}

            {companySaveSuccess && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                System preferences successfully saved!
              </div>
            )}

            {/* Approval Chain Setting */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
              <div className="space-y-0.5 max-w-lg">
                <Label className="text-xs font-bold text-foreground">
                  Require Project Manager Approval for Material Requests
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, all supervisor MRs must be approved by a Project Manager before Procurement Officers can initiate Cost Comparisons.
                </p>
              </div>

              <input
                type="checkbox"
                checked={companyForm.requireManagerApprovalForRequests}
                onChange={(e) => {
                  const updated = e.target.checked;
                  setCompanyForm({ ...companyForm, requireManagerApprovalForRequests: updated });
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
              />
            </div>

            {/* Negative Stock Policy */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
              <div className="space-y-0.5 max-w-lg">
                <Label className="text-xs font-bold text-foreground">
                  Allow Negative Stock Issuance
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When enabled, site supervisors can record urgent material issues even when physical intake is pending GRN inspection. When disabled, issuance is strictly blocked when balance is 0.
                </p>
              </div>

              <input
                type="checkbox"
                checked={companyForm.allowNegativeStock}
                onChange={(e) => {
                  const updated = e.target.checked;
                  setCompanyForm({ ...companyForm, allowNegativeStock: updated });
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring cursor-pointer"
              />
            </div>

            {/* Default Reorder Level */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
              <div className="space-y-0.5 max-w-lg">
                <Label className="text-xs font-bold text-foreground">
                  Default Inventory Reorder Level
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Baseline threshold for automated low-stock warnings when creating new inventory records without a custom threshold.
                </p>
              </div>

              <div className="w-24">
                <Input
                  type="number"
                  min="0"
                  value={companyForm.defaultReorderLevel}
                  onChange={(e) => {
                    setCompanyForm({ ...companyForm, defaultReorderLevel: Number(e.target.value) || 0 });
                  }}
                  className="text-xs h-8 text-right font-mono"
                />
              </div>
            </div>

            <Button
              onClick={handleSaveCompany}
              disabled={companySaving}
              className="gap-2 text-xs font-semibold"
            >
              <Save className="h-4 w-4" />
              {companySaving ? "Saving…" : "Save Preferences"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Template Modal */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">
                {editingTemplateId ? "Edit T&C Template" : "Create T&C Template"}
              </h3>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {templateError && (
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
                {templateError}
              </div>
            )}

            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Template Name</Label>
                <Input
                  required
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="e.g. Standard Cement & Steel Terms"
                  className="text-xs h-8"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Clauses / Text Content</Label>
                <textarea
                  required
                  rows={8}
                  value={templateForm.content}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, content: e.target.value })
                  }
                  placeholder="Type legal clauses, return policies, payment terms and acceptance criteria..."
                  className="flex w-full rounded-md border border-border bg-input px-3 py-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isDefaultCheckbox"
                  checked={templateForm.isDefault}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, isDefault: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer"
                />
                <Label htmlFor="isDefaultCheckbox" className="text-xs cursor-pointer">
                  Set as default template for new Purchase Orders
                </Label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTemplateModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={templateSaving}
                  className="text-xs font-semibold"
                >
                  {templateSaving ? "Saving…" : "Save Template"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
