"use client";

import { useState, type ReactNode } from "react";
import { SWRConfig } from "swr";
import { AppSidebar } from "@/shared/layout/app-sidebar";
import { SiteFooter } from "@/shared/layout/site-footer";
import { SiteHeader } from "@/shared/layout/site-header";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <SWRConfig
      value={{
        onError: (error) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("[SWR]", error);
          }
        },
        revalidateOnFocus: false,
        dedupingInterval: 30_000,
      }}
    >
      <div className="h-screen overflow-hidden bg-background">
        <div className="flex h-full w-full">
          <aside
            className={cn(
              "hidden shrink-0 border-r border-border/70 bg-card/95 lg:block",
              sidebarCollapsed ? "w-[6rem]" : "w-[18rem]",
            )}
          >
            <div className="sticky top-0 h-screen overflow-hidden">
              <AppSidebar collapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <div className="flex h-screen flex-col overflow-hidden">
              <SiteHeader />
              <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-6 sm:px-6 lg:px-8">
                {children}
              </main>
              <SiteFooter />
            </div>
          </div>
        </div>
      </div>
    </SWRConfig>
  );
}
