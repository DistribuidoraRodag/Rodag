"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Plus,
  History,
  LogOut,
  Zap,
  Shield,
  AlertTriangle,
  ScrollText,
  Sparkles,
  CheckSquare,
  BookOpen,
  BarChart3,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
  SidebarSeparator,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";
import type { Tables } from "@/types/database";

// Role-based navigation
const commonItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
];

const mktItems = [
  { title: "Gerar Conteudo", href: "/gerar", icon: Sparkles },
  { title: "Aprovacao", href: "/aprovacao", icon: CheckSquare },
  { title: "Biblioteca", href: "/biblioteca", icon: BookOpen },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
];

const clientItems = [
  { title: "Biblioteca", href: "/biblioteca", icon: BookOpen },
  { title: "Nova Solicitacao", href: "/chat/novo", icon: Plus },
  { title: "Historico", href: "/historico", icon: History },
];

function getNavItems(role: string) {
  if (role === "admin" || role === "manager") return [...commonItems, ...mktItems];
  return [...commonItems, ...clientItems];
}

const adminNavItems = [
  {
    title: "Painel Admin",
    href: "/admin",
    icon: Shield,
  },
  {
    title: "Revisao Humana",
    href: "/admin/revisao",
    icon: AlertTriangle,
  },
  {
    title: "Auditoria",
    href: "/admin/auditoria",
    icon: ScrollText,
  },
];

export function DashboardShell({
  profile,
  children,
}: {
  profile: Tables<"profiles"> | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const role = profile?.role || "client";
  const navItems = getNavItems(role);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">RODAG</span>
          </Link>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {role === "admin" && <>
          <SidebarSeparator />

          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          </>}
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
              {profile?.name?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {profile?.name ?? "Usuario"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <Button
              variant="ghost"
              size="sm"
              type="submit"
              className="w-full justify-start gap-2 text-muted-foreground mt-1"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-bold text-sm">RODAG</span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
