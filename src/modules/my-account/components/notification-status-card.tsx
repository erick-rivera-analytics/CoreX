import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import type { MyAccountNotificationPreferences } from "@/modules/my-account/index";

export function NotificationStatusCard({ value }: { value: MyAccountNotificationPreferences }) {
  const inAppActive = [value.inAppTaskAssigned, value.inAppTaskDue, value.inAppReminder].filter(Boolean).length;
  const inAppTotal = 3;

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Estado de notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Avisos internos</span>
          <Badge variant={inAppActive > 0 ? "success" : "outline"} className="rounded-full px-3 py-0.5 text-xs">
            {inAppActive}/{inAppTotal} activos
          </Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Correo</span>
          <Badge variant="outline" className="rounded-full px-3 py-0.5 text-xs text-muted-foreground">
            Proximamente
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
