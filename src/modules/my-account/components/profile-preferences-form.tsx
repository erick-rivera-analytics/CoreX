"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { MyAccountProfile } from "@/modules/my-account/index";

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
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Preferencias basicas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField id="display-name" label="Nombre completo">
          <Input
            id="display-name"
            value={draft.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            placeholder="Como quieres que te llamen"
          />
        </FormField>

        <FormField id="contact-email" label="Correo de contacto">
          <Input
            id="contact-email"
            type="email"
            value={draft.contactEmail}
            onChange={(event) => updateField("contactEmail", event.target.value)}
            placeholder="ejemplo@dominio.com"
          />
        </FormField>

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => onSave(draft)}>
            Guardar cambios
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FormField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
