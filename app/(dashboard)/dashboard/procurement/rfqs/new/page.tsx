"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/components/providers/auth-provider";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Building, AlertTriangle, Send } from "lucide-react";

const UNITS = ["bags", "MT", "kg", "nos", "cum", "brass", "sqm", "ltr", "rmt"] as const;

interface ItemRow {
  itemName: string;
  category?: string;
  quantity: number;
  unit: (typeof UNITS)[number];
  description?: string;
  projectItemId?: string;
}

export default function NewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromMrId = searchParams.get("fromMr") as Id<"material_request"> | null;
  const { token } = useSession();

  const projects = useQuery(api.projects.listAllProjects, token ? { token } : "skip");
  const vendors = useQuery(api.vendors.listVendors, token ? { token } : "skip");
  const sourceMr = useQuery(api.material_requests.getMR, token && fromMrId ? { id: fromMrId, token } : "skip");
  const createRfqMutation = useMutation(api.rfqs.createRfq);

  const [projectId, setProjectId] = React.useState<string>("");
  const [siteId, setSiteId] = React.useState<string>("");
  const [selectedVendorIds, setSelectedVendorIds] = React.useState<string[]>([]);
  const [dueDate, setDueDate] = React.useState("");
  const [sentVia, setSentVia] = React.useState<"whatsapp" | "email" | "manual">("whatsapp");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<ItemRow[]>([{ itemName: "", quantity: 1, unit: "bags" }]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (sourceMr) {
      if (sourceMr.projectId) setProjectId(sourceMr.projectId);
      if (sourceMr.siteId) setSiteId(sourceMr.siteId);
      if (sourceMr.items && sourceMr.items.length > 0) {
        setItems(sourceMr.items.map((it) => ({
          itemName: it.itemName,
          category: it.category,
          quantity: it.quantity,
          unit: (UNITS.includes(it.unit as (typeof UNITS)[number]) ? it.unit : "bags") as (typeof UNITS)[number],
          projectItemId: it.projectItemId,
        })));
      }
    }
  }, [sourceMr]);

  const sites = useQuery(api.sites.listAllSites, token && projectId ? { projectId: projectId as Id<"projects">, token } : "skip");

  const handleAddItem = () => setItems((prev) => [...prev, { itemName: "", quantity: 1, unit: "bags" }]);
  const handleRemoveItem = (idx: number) => items.length > 1 && setItems((prev) => prev.filter((_, i) => i !== idx));
  const handleItemChange = (idx: number, field: keyof ItemRow, value: string | number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const toggleVendor = (vid: string) => {
    setSelectedVendorIds((prev) => (prev.includes(vid) ? prev.filter((id) => id !== vid) : [...prev, vid]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!projectId) return setError("Please select a project.");
    if (selectedVendorIds.length === 0) return setError("Please select at least one vendor to invite.");
    const validItems = items.filter((it) => it.itemName.trim().length > 0);
    if (validItems.length === 0) return setError("Please provide at least one valid item.");

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await createRfqMutation({
        projectId: projectId as Id<"projects">,
        siteId: siteId ? (siteId as Id<"sites">) : undefined,
        sourceMrId: fromMrId || undefined,
        vendorIds: selectedVendorIds as Id<"vendors">[],
        requestedItems: validItems.map((it) => ({
          itemName: it.itemName.trim(),
          category: it.category?.trim(),
          quantity: it.quantity,
          unit: it.unit,
          projectItemId: it.projectItemId ? (it.projectItemId as Id<"project_items">) : undefined,
          description: it.description?.trim(),
        })),
        dueDate: dueDate || undefined,
        sentVia,
        notes: notes.trim() || undefined,
        token,
      });
      router.push(`/dashboard/procurement/rfqs/${res.rfqId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create RFQ.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/procurement/rfqs" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to RFQs
        </Link>
        {fromMrId && sourceMr && <Badge variant="outline" className="text-xs">From MR: {sourceMr.refNo}</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2"><Building className="h-5 w-5 text-primary" /> Create RFQ</CardTitle>
          <CardDescription className="text-xs">Draft a Request for Quotation to collect vendor quotes.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-2.5 bg-destructive/10 text-destructive text-xs rounded-lg flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Project *</Label>
                <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setSiteId(""); }} disabled={Boolean(fromMrId)} className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs" required>
                  <option value="">Select Project</option>
                  {projects?.map((p) => <option key={p._id} value={p._id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Site (Optional)</Label>
                <select value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={Boolean(fromMrId) || !projectId} className="w-full h-8.5 rounded-md border border-input bg-background px-2.5 text-xs">
                  <option value="">All Sites</option>
                  {sites?.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Invited Vendors *</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 border rounded-lg bg-muted/20 max-h-32 overflow-y-auto">
                {vendors?.map((v) => (
                  <label key={v._id} className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer ${selectedVendorIds.includes(v._id) ? "bg-primary/10 border-primary font-semibold" : "bg-background"}`}>
                    <input type="checkbox" checked={selectedVendorIds.includes(v._id)} onChange={() => toggleVendor(v._id)} className="rounded h-3.5 w-3.5" />
                    <span className="truncate">{v.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Requested Items *</Label>
                <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="text-xs h-6 gap-1"><Plus className="h-3 w-3" /> Add Item</Button>
              </div>
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                  <Input placeholder="Item name *" value={it.itemName} onChange={(e) => handleItemChange(idx, "itemName", e.target.value)} className="text-xs h-7.5 flex-1" required />
                  <Input type="number" min="0.001" step="0.001" placeholder="Qty" value={it.quantity} onChange={(e) => handleItemChange(idx, "quantity", Math.max(0.001, parseFloat(e.target.value) || 0))} onWheel={(e) => (e.target as HTMLElement).blur()} className="text-xs h-7.5 w-20 text-right" required />
                  <select value={it.unit} onChange={(e) => handleItemChange(idx, "unit", e.target.value)} className="h-7.5 rounded border bg-background px-1.5 text-xs w-20">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(idx)} disabled={items.length <= 1} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs font-semibold">Due Date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs font-semibold">Sent Via</Label><select value={sentVia} onChange={(e) => setSentVia(e.target.value as "whatsapp" | "email" | "manual")} className="w-full h-8 rounded border bg-background px-2 text-xs"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="manual">Manual</option></select></div>
            </div>

            <div className="space-y-1"><Label className="text-xs font-semibold">Notes</Label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terms, delivery time..." rows={2} className="w-full rounded border bg-background p-2 text-xs" /></div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Link href="/dashboard/procurement/rfqs"><Button type="button" variant="outline" size="sm" className="text-xs">Cancel</Button></Link>
              <Button type="submit" size="sm" disabled={isSubmitting} className="text-xs font-semibold gap-1.5"><Send className="h-3.5 w-3.5" />{isSubmitting ? "Creating..." : "Create RFQ"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
