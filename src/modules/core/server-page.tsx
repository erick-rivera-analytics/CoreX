import type { ReactNode } from "react";

import { requirePageAccess } from "@/lib/api-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

type LoaderOptions<T> = {
  resourceKey: string;
  loader: () => Promise<T>;
  fallbackMessage: string;
  fallbackData?: T | ((error: unknown) => T);
};

export async function loadProtectedPageData<T>({
  resourceKey,
  loader,
  fallbackMessage,
  fallbackData,
}: LoaderOptions<T>) {
  await requirePageAccess(resourceKey);

  try {
    return {
      data: await loader(),
      error: null as string | null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    const resolvedData = typeof fallbackData === "function"
      ? (fallbackData as (error: unknown) => T)(error)
      : fallbackData ?? null;

    return {
      data: resolvedData as T | null,
      error: message,
    };
  }
}

export function DashboardRouteError({
  title,
  error,
  children,
}: {
  title: string;
  error: string | null;
  children?: ReactNode;
}) {
  return (
    <Card className="starter-panel border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{error ?? "No se pudo cargar esta pantalla."}</p>
        {children}
      </CardContent>
    </Card>
  );
}
