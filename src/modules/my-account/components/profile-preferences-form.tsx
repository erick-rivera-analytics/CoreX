"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/shared/ui/button";
import { ChartSurface } from "@/shared/data-display/chart-surface";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { MyAccountProfile } from "@/modules/my-account/index";

const fieldClassName =
  "h-11 w-full rounded-[16px] border border-input bg-background px-4 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";
const textareaClassName =
  "flex min-h-[120px] w-full rounded-[16px] border border-input bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export function ProfilePreferencesForm({
  value,
  onSave,
}: {
  value: MyAccountProfile;
  onSave: (nextValue: MyAccountProfile) => void;
}) {
  const [draft, setDraft] = useState(value);

  function updateField<Key extends keyof MyAccountProfile>(key: Key, nextValue: MyAccountProfile[Key]) {
    setDraft((current) => ({ ...current, [key]: nextValue }));
  }

  return (
    <ChartSurface title="Preferencias generales" subtitle="Ajusta como quieres ver y abrir tu espacio personal dentro del dashboard.">
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField id="display-name" label="Nombre visible">
            <Input id="display-name" value={draft.displayName} onChange={(event) => updateField("displayName", event.target.value)} />
          </FormField>
          <FormField id="avatar-url" label="URL del avatar">
            <Input id="avatar-url" value={draft.avatarUrl} onChange={(event) => updateField("avatarUrl", event.target.value)} />
          </FormField>
          <FormField id="locale-code" label="Idioma">
            <Input id="locale-code" value={draft.localeCode} onChange={(event) => updateField("localeCode", event.target.value)} />
          </FormField>
          <FormField id="timezone-name" label="Zona horaria">
            <Input id="timezone-name" value={draft.timezoneName} onChange={(event) => updateField("timezoneName", event.target.value)} />
          </FormField>
          <FormField id="theme-code" label="Tema">
            <select id="theme-code" className={fieldClassName} value={draft.themeCode} onChange={(event) => updateField("themeCode", event.target.value)}>
              <option value="system">Sistema</option>
              <option value="light">Claro</option>
              <option value="dark">Oscuro</option>
            </select>
          </FormField>
          <FormField id="default-route" label="Ruta inicial">
            <Input id="default-route" value={draft.defaultRoute} onChange={(event) => updateField("defaultRoute", event.target.value)} />
          </FormField>
          <FormField id="default-calendar-view" label="Vista calendario">
            <select
              id="default-calendar-view"
              className={fieldClassName}
              value={draft.defaultCalendarViewCode}
              onChange={(event) => updateField("defaultCalendarViewCode", event.target.value)}
            >
              <option value="month">Mes</option>
              <option value="agenda">Agenda</option>
            </select>
          </FormField>
          <FormField id="default-task-view" label="Vista de tareas">
            <select
              id="default-task-view"
              className={fieldClassName}
              value={draft.defaultTaskViewCode}
              onChange={(event) => updateField("defaultTaskViewCode", event.target.value)}
            >
              <option value="today">Hoy</option>
              <option value="list">Lista</option>
            </select>
          </FormField>
          <FormField id="week-start" label="Inicio de semana">
            <select
              id="week-start"
              className={fieldClassName}
              value={String(draft.weekStartIso)}
              onChange={(event) => updateField("weekStartIso", Number(event.target.value) as 1 | 7)}
            >
              <option value="1">Lunes</option>
              <option value="7">Domingo</option>
            </select>
          </FormField>
        </div>

        <FormField id="bio-text" label="Biografia corta">
          <textarea
            id="bio-text"
            className={textareaClassName}
            value={draft.bioText}
            onChange={(event) => updateField("bioText", event.target.value)}
          />
        </FormField>

        <div className="flex justify-end">
          <Button type="button" onClick={() => onSave(draft)}>
            Guardar preferencias
          </Button>
        </div>
      </div>
    </ChartSurface>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
