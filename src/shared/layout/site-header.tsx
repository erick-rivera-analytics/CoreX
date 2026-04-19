"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserCircle2 } from "lucide-react";

import { DashboardScaleToggle } from "@/shared/layout/dashboard-scale-toggle";
import {
  filterMobileNavigationByAccess,
  getPageContext,
  isPathActive,
  mobileNavigation,
} from "@/config/dashboard";
import { ModeToggle } from "@/shared/layout/mode-toggle";
import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const page = getPageContext(pathname);
  const { data: access } = useCurrentUserAccess();
  const visibleMobileNavigation = access
    ? filterMobileNavigationByAccess(mobileNavigation, access.allowedResources, access.isSuperadmin)
    : [];

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
              {page.eyebrow}
            </p>
            <h1 className="mt-1 text-[26px] font-medium tracking-tight">{page.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <DashboardScaleToggle />
            <ModeToggle />
            {access && (access.isSuperadmin || access.allowedResources.includes("/dashboard/mi-cuenta")) ? (
              <Link
                href="/dashboard/mi-cuenta"
                title="Mi cuenta"
                aria-label="Mi cuenta"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted/70 hover:text-foreground",
                  pathname === "/dashboard/mi-cuenta" && "border-primary text-primary",
                )}
              >
                <UserCircle2 className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
          {visibleMobileNavigation.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  active
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
