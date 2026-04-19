"use client";

import { useState } from "react";

import { ChartSurface } from "@/shared/data-display/chart-surface";
import { Button } from "@/shared/ui/button";
import { ToggleSwitch } from "@/shared/forms/toggle-switch";
import type { MyAccountNotificationPreferences } from "@/modules/my-account/index";

const preferenceLabels: Array<{
  key: keyof MyAccountNotificationPreferences;
  title: string;
  hint: string;
}> = [
  { key: "inAppTaskAssigned", title: "Asignacion de tareas", hint: "Aviso dentro de la app cuando una tarea cambie de contexto." },
  { key: "inAppTaskDue", title: "Vencimientos", hint: "Resumen en pantalla de tareas proximas a vencer." },
  { key: "inAppReminder", title: "Recordatorios internos", hint: "Alertas visuales para eventos y pendientes personales." },
  { key: "emailTaskAssigned", title: "Correo por asignacion", hint: "Persistido para una futura salida por correo, sin envio en este MVP." },
  { key: "emailTaskDue", title: "Correo por vencimiento", hint: "Persistido para una futura salida por correo, sin envio en este MVP." },
  { key: "emailReminder", title: "Correo por recordatorio", hint: "Persistido para una futura salida por correo, sin envio en este MVP." },
];

export function NotificationPreferencesForm({
  value,
  onSave,
}: {
  value: MyAccountNotificationPreferences;
  onSave: (nextValue: MyAccountNotificationPreferences) => void;
}) {
  const [draft, setDraft] = useState(value);

  function toggle(key: keyof MyAccountNotificationPreferences) {
    setDraft((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <ChartSurface title="Notificaciones" subtitle="Preferencias controladas y tipadas para alertas internas y futuras salidas por correo.">
      <div className="space-y-3">
        {preferenceLabels.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-4 rounded-[18px] border border-border/70 bg-background/70 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-sm text-muted-foreground">{item.hint}</p>
            </div>
            <ToggleSwitch checked={draft[item.key]} onCheckedChange={() => toggle(item.key)} />
          </div>
        ))}

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => onSave(draft)}>
            Guardar notificaciones
          </Button>
        </div>
      </div>
    </ChartSurface>
  );
}
