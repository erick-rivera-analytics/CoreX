"use client";

import { type ReactNode, useMemo, useState } from "react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { MyAccountProfile } from "@/modules/my-account/index";

type ProfileDraftState = {
  sourceSignature: string | null;
  draft: MyAccountProfile | null;
};

export function ProfilePreferencesForm({
  value,
  onSave,
}: {
  value: MyAccountProfile;
  onSave: (nextValue: MyAccountProfile) => void;
}) {
  const [state, setState] = useState<ProfileDraftState>({
    sourceSignature: null,
    draft: null,
  });
  const valueSignature = useMemo(
    () => `${value.displayName}\u0000${value.contactEmail}`,
    [value.contactEmail, value.displayName],
  );
  const currentValue = state.draft ?? value;

  if (state.sourceSignature !== valueSignature) {
    setState({
      sourceSignature: valueSignature,
      draft: null,
    });
  }

  function updateField<Key extends keyof MyAccountProfile>(key: Key, nextValue: MyAccountProfile[Key]) {
    setState((currentState) => ({
      sourceSignature: valueSignature,
      draft: {
        ...(currentState.draft ?? value),
        [key]: nextValue,
      },
    }));
  }

  return (
    <Card className="bg-card/90">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Preferencias básicas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField id="display-name" label="Nombre completo">
          <Input
            id="display-name"
            value={currentValue.displayName}
            onChange={(event) => updateField("displayName", event.target.value)}
            placeholder="Como quieres que te llamen"
          />
        </FormField>

        <FormField id="contact-email" label="Correo de contacto">
          <Input
            id="contact-email"
            type="email"
            value={currentValue.contactEmail}
            onChange={(event) => updateField("contactEmail", event.target.value)}
            placeholder="ejemplo@dominio.com"
          />
        </FormField>

        <div className="flex justify-end pt-1">
          <Button type="button" onClick={() => onSave(currentValue)}>
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
