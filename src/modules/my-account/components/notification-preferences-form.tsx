"use client";

import { useState } from "react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ToggleSwitch } from "@/shared/forms/toggle-switch";
import type { MyAccountNotificationPreferences } from "@/modules/my-account/index";

type PreferenceItem = {
  key: keyof MyAccountNotificationPreferences;
  title: string;
  group: "in_app" | "email";
};

const PREFERENCE_ITEMS: PreferenceItem[] = [
  { key: "inAppTaskAssigned", title: "Tareas asignadas", group: "in_app" },
  { key: "inAppTaskDue", title: "Vencimientos", group: "in_app" },
  { key: "inAppReminder", title: "Recordatorios", group: "in_app" },
  { key: "emailTaskAssigned", title: "Correo por tarea", group: "email" },
  { key: "emailTaskDue", title: "Correo por vencimiento", group: "email" },
  { key: "emailReminder", title: "Correo por recordatorio", group: "email" },
];

export function NotificationPreferencesForm({
  value,
  onSave,
  emailDisabled = true,
}: {
  value: MyAccountNotificationPreferences;
  onSave: (nextValue: MyAccountNotificationPreferences) => void;
  emailDisabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);

  function toggle(key: keyof MyAccountNotificationPreferences) {
    setDraft((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Notificaciones</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {PREFERENCE_ITEMS.map((item) => {
          const disabled = emailDisabled && item.group === "email";
          return (
            <div
              key={item.key}
              className={
                "flex items-center justify-between gap-3 rounded-[14px] border border-border/50 bg-background/60 px-3 py-2.5 " +
                (disabled ? "opacity-70" : "")
              }
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm">{item.title}</span>
                {disabled ? (
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                    Proximamente
                  </Badge>
                ) : null}
              </div>
              <ToggleSwitch
                checked={draft[item.key]}
                disabled={disabled}
                onCheckedChange={() => toggle(item.key)}
              />
            </div>
          );
        })}

        <div className="flex justify-end pt-2">
          <Button type="button" onClick={() => onSave(draft)}>
            Guardar notificaciones
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
