"use client";

import * as React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Plus,
  Search,
  Building2,
  Phone,
  Mail,
  FileText,
  MapPin,
  CheckCircle2,
  XCircle,
  Edit2,
  AlertCircle,
  Filter,
} from "lucide-react";

const VENDOR_CATEGORIES = [
  "Cement & RMC",
  "Steel & Rebar",
  "Aggregates & Sand",
  "Masonry & Blocks",
  "Electrical & Lighting",
  "Plumbing & Sanitary",
  "Finishing & Paints",
  "Doors & Windows",
  "Safety & Tools",
  "General Hardware",
];

export default function ProcurementVendorsPage() {
  const { token } = useSession();

  const vendors = useQuery(
    api.vendors.listVendors,
    token ? { includeInactive: true, token } : "skip"
  );
  const createVendorMutation = useMutation(api.vendors.createVendor);
  const updateVendorMutation = useMutation(api.vendors.updateVendor);
  const deactivateVendorMutation = useMutation(api.vendors.deactivateVendor);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingVendorId, setEditingVendorId] = React.useState<Id<"vendors"> | null>(null);
  const [vendorForm, setVendorForm] = React.useState({
    name: "",
    contactPerson: "",
    phone: "",
    email: "",
    gstNo: "",
    address: "",
    category: "Cement & RMC",
    isActive: true,
  });
  const [formSaving, setFormSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const openCreateModal = () => {
    setEditingVendorId(null);
    setVendorForm({
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      gstNo: "",
      address: "",
      category: "Cement & RMC",
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: any) => {
    setEditingVendorId(vendor._id);
    setVendorForm({
      name: vendor.name,
      contactPerson: vendor.contactPerson || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      gstNo: vendor.gstNo || "",
      address: vendor.address || "",
      category: vendor.category || "Cement & RMC",
      isActive: vendor.isActive ?? true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorForm.name.trim()) {
      setFormError("Vendor name is required.");
      return;
    }
    if (!vendorForm.phone.trim()) {
      setFormError("Vendor contact phone number is required.");
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      if (editingVendorId) {
        await updateVendorMutation({
          id: editingVendorId,
          name: vendorForm.name,
          contactPerson: vendorForm.contactPerson || undefined,
          phone: vendorForm.phone,
          email: vendorForm.email || undefined,
          gstNo: vendorForm.gstNo || undefined,
          address: vendorForm.address || undefined,
          category: vendorForm.category || undefined,
          isActive: vendorForm.isActive,
          token: token || undefined,
        });
      } else {
        await createVendorMutation({
          name: vendorForm.name,
          contactPerson: vendorForm.contactPerson || undefined,
          phone: vendorForm.phone,
          email: vendorForm.email || undefined,
          gstNo: vendorForm.gstNo || undefined,
          address: vendorForm.address || undefined,
          category: vendorForm.category || undefined,
          isActive: vendorForm.isActive,
          token: token || undefined,
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || "Failed to save vendor.");
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggleActive = async (vendor: any) => {
    try {
      await updateVendorMutation({
        id: vendor._id,
        isActive: !vendor.isActive,
        token: token || undefined,
      });
    } catch (err: any) {
      alert(err.message || "Failed to update vendor status");
    }
  };

  const filteredVendors = (vendors || []).filter((v) => {
    if (statusFilter === "active" && !v.isActive) return false;
    if (statusFilter === "inactive" && v.isActive) return false;
    if (selectedCategory !== "all" && v.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(q) ||
      (v.contactPerson && v.contactPerson.toLowerCase().includes(q)) ||
      (v.phone && v.phone.includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q)) ||
      (v.gstNo && v.gstNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Vendor Master Management</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Maintain approved suppliers, registered billing addresses, GSTIN tax identifiers, and commercial contacts.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          size="sm"
          className="gap-1.5 text-xs font-semibold self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          Add New Vendor
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search vendors by name, GST, phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="flex h-8 rounded-md border border-border bg-input px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="all">All Categories</option>
            {VENDOR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === "all"
                ? "bg-surface text-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({vendors?.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === "active"
                ? "bg-surface text-emerald-500 font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({vendors?.filter((v) => v.isActive).length || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-surface text-muted-foreground font-bold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Inactive ({vendors?.filter((v) => !v.isActive).length || 0})
          </button>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                <th className="py-3 px-3.5 w-10 text-center">#</th>
                <th className="py-3 px-3.5">Vendor Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Phone & Email</th>
                <th className="py-3 px-3">GSTIN</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors === undefined ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span>Loading vendors…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="space-y-1">
                      <Users className="h-8 w-8 mx-auto text-muted-foreground/60" />
                      <p className="text-xs font-semibold text-foreground">No vendors found</p>
                      <p className="text-[11px]">
                        {searchQuery ? "Try refining your search keywords." : "Add your first vendor to start sourcing quotes."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVendors.map((vendor, idx) => (
                  <tr key={vendor._id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3.5 text-center text-muted-foreground font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-foreground">{vendor.name}</div>
                      {vendor.address && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs" title={vendor.address}>
                          {vendor.address}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-muted border border-border">
                        {vendor.category || "General"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-foreground">
                      {vendor.contactPerson || "—"}
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <div className="font-mono text-foreground">{vendor.phone}</div>
                      {vendor.email && (
                        <div className="text-[11px] text-muted-foreground">{vendor.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground">
                      {vendor.gstNo || "—"}
                    </td>
                    <td className="py-3 px-3">
                      {vendor.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          <XCircle className="h-2.5 w-2.5" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(vendor)}
                          className="h-7 text-xs px-2 gap-1 text-foreground"
                          title="Edit Vendor"
                        >
                          <Edit2 className="h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleActive(vendor)}
                          className={`h-7 text-xs px-2 ${
                            vendor.isActive
                              ? "text-destructive hover:text-destructive hover:bg-destructive/10"
                              : "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                          }`}
                        >
                          {vendor.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground">
                  {editingVendorId ? "Edit Vendor Profile" : "Register New Vendor"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveVendor} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  Vendor / Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  required
                  value={vendorForm.name}
                  onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                  placeholder="e.g. UltraTech Cement Agency"
                  className="text-xs h-8"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Category</Label>
                  <select
                    value={vendorForm.category}
                    onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                    className="flex h-8 w-full rounded-md border border-border bg-input px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {VENDOR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Contact Person Name</Label>
                  <Input
                    value={vendorForm.contactPerson}
                    onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                    placeholder="e.g. Rajesh Sharma"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Phone Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    required
                    value={vendorForm.phone}
                    onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                    placeholder="e.g. +91 98200 12345"
                    className="text-xs h-8 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Email Address</Label>
                  <Input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                    placeholder="sales@vendor.com"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">GSTIN / Tax ID</Label>
                <Input
                  value={vendorForm.gstNo}
                  onChange={(e) => setVendorForm({ ...vendorForm, gstNo: e.target.value.toUpperCase() })}
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  className="text-xs h-8 font-mono uppercase"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Registered Address</Label>
                <textarea
                  rows={2}
                  value={vendorForm.address}
                  onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
                  placeholder="Factory/office registered address..."
                  className="flex w-full rounded-md border border-border bg-input px-3 py-1.5 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={vendorForm.isActive}
                  onChange={(e) => setVendorForm({ ...vendorForm, isActive: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-ring cursor-pointer"
                />
                <Label htmlFor="isActiveToggle" className="text-xs cursor-pointer">
                  Vendor is active and available for quote selection
                </Label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={formSaving}
                  className="text-xs font-semibold"
                >
                  {formSaving ? "Saving…" : editingVendorId ? "Update Vendor" : "Save Vendor"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
