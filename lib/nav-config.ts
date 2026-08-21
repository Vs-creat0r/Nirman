import { 
  Home, 
  FileText, 
  FileSignature, 
  FileBarChart2,
  ShoppingBag, 
  Truck, 
  Users, 
  Package, 
  ClipboardCheck, 
  Activity, 
  UserCog,
  Settings,
  type LucideIcon 
} from "lucide-react";

export type UserRole = "site_supervisor" | "project_manager" | "procurement_officer" | "admin";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navConfig: Record<UserRole, NavGroup[]> = {
  site_supervisor: [
    {
      label: "Main",
      items: [
        { title: "Dashboard", href: "/dashboard/supervisor", icon: Home },
        { title: "Material Requests", href: "/dashboard/supervisor/material-requests", icon: FileText },
        { title: "Deliveries", href: "/dashboard/deliveries", icon: Truck },
      ]
    },
    {
      label: "Supply",
      items: [
        { title: "Inventory", href: "/dashboard/inventory", icon: Package },
        { title: "GRN Logs", href: "/dashboard/grn", icon: ClipboardCheck },
        { title: "System Logs", href: "/dashboard/logs", icon: Activity },
      ]
    }
  ],
  project_manager: [
    {
      label: "Main",
      items: [
        { title: "Dashboard", href: "/dashboard/manager", icon: Home },
        { title: "Material Requests", href: "/dashboard/manager/material-requests", icon: FileText },
        { title: "Cost Comparisons", href: "/dashboard/manager/cost-comparisons", icon: FileBarChart2 },
        { title: "Purchase Orders", href: "/dashboard/manager/purchase-orders", icon: ShoppingBag },
        { title: "Deliveries", href: "/dashboard/deliveries", icon: Truck },
      ]
    },
    {
      label: "Supply",
      items: [
        { title: "Vendors", href: "/dashboard/procurement/vendors", icon: Users },
        { title: "Inventory", href: "/dashboard/inventory", icon: Package },
        { title: "GRN Receipts", href: "/dashboard/grn", icon: ClipboardCheck },
        { title: "System Logs", href: "/dashboard/logs", icon: Activity },
      ]
    }
  ],
  procurement_officer: [
    {
      label: "Main",
      items: [
        { title: "Dashboard", href: "/dashboard/procurement", icon: Home },
        { title: "Cost Comparisons", href: "/dashboard/procurement/cost-comparisons", icon: FileBarChart2 },
        { title: "Purchase Orders", href: "/dashboard/procurement/purchase-orders", icon: ShoppingBag },
        { title: "Deliveries", href: "/dashboard/deliveries", icon: Truck },
      ]
    },
    {
      label: "Supply",
      items: [
        { title: "Vendors", href: "/dashboard/procurement/vendors", icon: Users },
        { title: "Inventory", href: "/dashboard/inventory", icon: Package },
        { title: "GRN Logs", href: "/dashboard/grn", icon: ClipboardCheck },
        { title: "System Logs", href: "/dashboard/logs", icon: Activity },
      ]
    }
  ],
  admin: [
    {
      label: "Main",
      items: [
        { title: "Dashboard", href: "/dashboard/admin", icon: Home },
        { title: "User Control", href: "/dashboard/users", icon: UserCog },
      ]
    },
    {
      label: "System",
      items: [
        { title: "Settings", href: "/dashboard/admin/settings", icon: Settings },
        { title: "System Logs", href: "/dashboard/logs", icon: Activity },
      ]
    }

  ]
};

