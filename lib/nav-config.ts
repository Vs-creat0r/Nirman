import { 
  Home, 
  FileText, 
  FileSignature, 
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
        { title: "RFQs", href: "/dashboard/rfq", icon: FileSignature },
        { title: "Purchase Orders", href: "/dashboard/po", icon: ShoppingBag },
        { title: "Deliveries", href: "/dashboard/deliveries", icon: Truck },
      ]
    },
    {
      label: "Supply",
      items: [
        { title: "Vendors", href: "/dashboard/vendors", icon: Users },
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
        { title: "RFQs", href: "/dashboard/rfq", icon: FileSignature },
        { title: "Purchase Orders", href: "/dashboard/po", icon: ShoppingBag },
        { title: "Deliveries", href: "/dashboard/deliveries", icon: Truck },
      ]
    },
    {
      label: "Supply",
      items: [
        { title: "Vendors", href: "/dashboard/vendors", icon: Users },
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
        { title: "System Logs", href: "/dashboard/logs", icon: Activity },
      ]
    }
  ]
};
