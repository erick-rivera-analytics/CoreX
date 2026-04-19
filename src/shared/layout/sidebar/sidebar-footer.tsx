"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BriefcaseBusiness, DatabaseZap, LogOut } from "lucide-react";

import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { cn } from "@/lib/utils";

type SidebarFooterProps = {
  collapsed: boolean;
};

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: access } = useCurrentUserAccess();
  const canViewDatabaseHealth = Boolean(access?.isSuperadmin);
  const canViewWorkspace = Boolean(
    access && (access.isSuperadmin || access.allowedResources.includes("/dashboard/mi-trabajo")),
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="space-y-1 border-t border-border/50 pt-3">
      {canViewWorkspace ? (
        <Link
          href="/dashboard/mi-trabajo"
          title="Workspace"
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
            collapsed && "justify-center px-2",
            pathname === "/dashboard/mi-trabajo" && "bg-primary/10 text-primary",
          )}
        >
          <BriefcaseBusiness className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span>Workspace</span> : null}
        </Link>
      ) : null}

      {canViewDatabaseHealth ? (
        <Link
          href="/api/health/db"
          title="Estado DB"
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
            collapsed && "justify-center px-2",
          )}
        >
          <DatabaseZap className="size-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span>Estado DB</span> : null}
        </Link>
      ) : null}

      <button
        type="button"
        onClick={handleLogout}
        title="Salir"
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-[14px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
          collapsed && "justify-center px-2",
        )}
      >
        <LogOut className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed ? <span>Salir</span> : null}
      </button>
    </div>
  );
}
