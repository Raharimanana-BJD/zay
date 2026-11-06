import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@zay-app/ui/components/sidebar";
import {
  CarFrontIcon,
  FlagIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  MapIcon,
  MapPinnedIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UserRoundCogIcon,
  UsersRoundIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { ROLE_LABELS } from "@/lib/labels";
import { useSignOut } from "@/lib/use-sign-out";

const OPERATIONS_ITEMS = [
  { to: "/admin", label: "Tableau de bord", icon: LayoutDashboardIcon },
  { to: "/admin/carte", label: "Carte", icon: MapIcon },
  { to: "/admin/reservations", label: "Réservations", icon: MapPinnedIcon },
  { to: "/admin/signalements", label: "Signalements", icon: FlagIcon },
  { to: "/admin/chauffeurs", label: "Chauffeurs", icon: CarFrontIcon },
  { to: "/admin/clients", label: "Clients", icon: UsersRoundIcon },
] as const;

const ADMIN_ITEMS = [
  { to: "/admin/reglages", label: "Réglages", icon: SettingsIcon },
  { to: "/admin/equipe", label: "Équipe", icon: ShieldCheckIcon },
  { to: "/admin/journal", label: "Journal", icon: ScrollTextIcon },
] as const;

interface NavItem {
  icon: LucideIcon;
  label: string;
  to: string;
}

function NavRow({ item }: { item: NavItem }) {
  const { setOpenMobile } = useSidebar();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const isActive =
    item.to === "/admin"
      ? pathname === "/admin" || pathname === "/admin/"
      : pathname.startsWith(item.to);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className="relative data-active:font-medium data-active:before:absolute data-active:before:inset-y-1 data-active:before:left-0 data-active:before:w-1 data-active:before:rounded-full data-active:before:bg-primary"
        isActive={isActive}
        onClick={() => setOpenMobile(false)}
        render={<Link to={item.to} />}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default function AdminShell({
  user,
  children,
}: {
  user: { name: string; role?: string | null };
  children: ReactNode;
}) {
  const signOut = useSignOut();
  const isAdmin = user.role === "admin";

  return (
    <SidebarProvider>
      <Sidebar aria-label="Navigation principale">
        <SidebarHeader className="p-4">
          <Link className="flex items-center gap-2" to="/admin">
            <img
              alt=""
              className="size-8"
              height={32}
              src="/logo.png"
              width={32}
            />
            <span className="font-bold text-xl">Zay</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Exploitation</SidebarGroupLabel>
            <SidebarMenu>
              {OPERATIONS_ITEMS.map((item) => (
                <NavRow item={item} key={item.to} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
          {isAdmin && (
            <SidebarGroup>
              <SidebarGroupLabel>Administration</SidebarGroupLabel>
              <SidebarMenu>
                {ADMIN_ITEMS.map((item) => (
                  <NavRow item={item} key={item.to} />
                ))}
              </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="gap-3 border-t p-4">
          <SidebarMenu>
            <NavRow
              item={{
                to: "/admin/compte",
                label: "Mon compte",
                icon: UserRoundCogIcon,
              }}
            />
          </SidebarMenu>
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">{user.name}</p>
              <p className="text-muted-foreground text-sm">
                {ROLE_LABELS[user.role ?? ""]}
              </p>
            </div>
            <Button
              aria-label="Se déconnecter"
              onClick={signOut}
              size="icon-sm"
              title="Se déconnecter"
              variant="secondary"
            >
              <LogOutIcon aria-hidden="true" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex items-center gap-2 border-b p-3 md:hidden">
          <SidebarTrigger />
          <img
            alt=""
            className="size-7"
            height={28}
            src="/logo.png"
            width={28}
          />
          <span className="font-bold text-lg">Zay</span>
        </header>
        <main className="mx-auto w-full max-w-6xl p-4 sm:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
