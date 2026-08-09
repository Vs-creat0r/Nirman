import Link from "next/link";
import { ArrowRight, FileSignature, CheckCircle, Truck, Package, Shield } from "lucide-react";
import { Button } from "../components/ui/button";

export default function MarketingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background select-none font-sans">
      {/* 1. Header */}
      <header className="sticky top-0 z-40 w-full h-16 border-b border-border bg-surface/90 backdrop-blur-md flex items-center justify-between px-6 md:px-12 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm shadow-sm">
            N
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Nirman ERP
          </span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>
        <Link href="/dashboard">
          <Button size="sm" variant="primary">
            Launch Platform
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="py-20 md:py-28 text-center max-w-[900px] mx-auto px-6 space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.15]">
            Eliminate manual paperwork in site procurement.
          </h1>
          <p className="text-base text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Nirman is a minimal, high-trust Construction ERP running procurement end-to-end. Sync site supervisor requests, approvals, and deliveries automatically.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button size="lg" variant="primary">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#workflow">
              <Button size="lg" variant="outline">
                See How It Works
              </Button>
            </a>
          </div>
        </section>

        {/* 3. Trust logobar */}
        <section className="border-t border-b border-border bg-surface py-8 text-center select-none">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
            Trusted by construction teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 opacity-40 grayscale font-semibold text-xs text-foreground">
            <span>DELTA STRUCTURES</span>
            <span>APEX CONTRACTING</span>
            <span>VERTEX BUILDERS</span>
            <span>HORIZON BOQ</span>
          </div>
        </section>

        {/* 4. Workflow flow */}
        <section id="workflow" className="py-20 max-w-[1000px] mx-auto px-6 space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">The Nirman Procurement Pipeline</h2>
            <p className="text-xs text-muted-foreground">From material requirement to receipt confirmation in three simple stages.</p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-3 relative">
            <div className="space-y-3 p-6 rounded-md border border-border bg-surface shadow-sm">
              <div className="h-8 w-8 rounded bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="font-semibold text-sm">Request & Sync</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Site supervisors log requests directly from their mobile portal. BOQ balances update instantly.
              </p>
            </div>
            
            <div className="space-y-3 p-6 rounded-md border border-border bg-surface shadow-sm">
              <div className="h-8 w-8 rounded bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="font-semibold text-sm">Review & Compare</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Project managers compare vendor quotes side-by-side on a clean, single-screen cost comparison matrix.
              </p>
            </div>
            
            <div className="space-y-3 p-6 rounded-md border border-border bg-surface shadow-sm">
              <div className="h-8 w-8 rounded bg-primary-subtle text-primary flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="font-semibold text-sm">Approve & Deliver</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tenders convert to Purchase Orders in one click. Receive delivery logs on site with instant Challan entry.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Features lists */}
        <section id="features" className="py-20 border-t border-border bg-surface/50">
          <div className="max-w-[1000px] mx-auto px-6 space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight">Engineered for absolute control</h2>
              <p className="text-xs text-muted-foreground">Say goodbye to spreadsheets, WhatsApp trails, and double orders.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex gap-4 p-4">
                <FileSignature className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Universal Document Layout</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A single unified document design framework serving Requests, RFQs, POs, and Receipts. Consistent, clean, and intuitive.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4">
                <Shield className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Role-Gated Dashboards</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Secure permissions for Site Supervisors, Project Managers, and Procurement Officers. Every user sees only what they need.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4">
                <Package className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Live Inventory Levels</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Auto-updating ledger catalogs based on delivered materials. Guardrails alert you if orders exceed project BOQ limits.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4">
                <CheckCircle className="h-6 w-6 text-primary flex-shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Audit Trails & Logs</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Immutable history records documenting the exact timestamp, user ID, and action taken for every line item purchase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-10 text-center text-[11px] text-muted-foreground select-none">
        <p>© {new Date().getFullYear()} Nirman ERP. All rights reserved.</p>
        <p className="mt-1">Built to professional design system tokens.</p>
      </footer>
    </div>
  );
}
