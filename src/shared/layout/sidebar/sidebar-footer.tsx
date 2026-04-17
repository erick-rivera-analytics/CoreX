"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DatabaseZap, LogOut } from "lucide-react";

import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { cn } from "@/lib/utils";

type SidebarFooterProps = {
  collapsed: boolean;
};

export function SidebarFooter({ collapsed }: SidebarFooterProps) {
  const router = useRouter();
  const { data: access } = useCurrentUserAccess();
  const canViewDatabaseHealth = Boolean(access?.isSuperadmin);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="space-y-1 border-t border-border/50 pt-3">
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
