import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import type { MyAccountRecentAccess } from "@/modules/my-account/index";

/**
 * Card de "Accesos recientes" con punto de extensión documentado.
 *
 * Hoy renderiza la lista que reciba en `items`. Cuando exista una tabla
 * de auditoría de sesiones HTTP (candidato: `auth_session_audit_cur`),
 * el loader del `page.tsx` deberá poblar `items`; mientras tanto la UI
 * muestra `EmptyState` canon "Sin registros de acceso disponibles".
 *
 * No hay TODO bloqueante: la carencia es de origen de datos, no de UI.
 */
export function RecentAccessCard({ items }: { items: MyAccountRecentAccess[] }) {
  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Accesos recientes</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border/60 bg-background/40 px-4 py-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">Sin registros de acceso disponibles.</p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Pendiente de fuente de auditoria de sesiones.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-border/50 bg-background/60 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.deviceKind === "desktop"
                      ? "Web escritorio"
                      : item.deviceKind === "mobile"
                        ? "Web movil"
                        : "Otro"}{" "}
                    · {item.browser}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.osName} · {item.occurredAt}
                  </p>
                </div>
                {item.isCurrentSession ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Actual
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
