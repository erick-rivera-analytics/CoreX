"use client";

import type { ReactNode } from "react";

import type { TalentoPersonProfile } from "@/lib/talento-humano";
import { formatDate, formatInteger } from "@/shared/lib/format";

/**
 * Sección "Información" del `PersonProfileDialog` para contextos sin ciclo
 * (talento humano, campo, mortality). Usa el payload `TalentoPersonProfile`
 * y reproduce el layout previamente en `PersonDetailSheet`.
 */
export function PersonProfileTalentoInfoSection({ profile }: { profile: TalentoPersonProfile }) {
  return (
    <div className="space-y-6">
      <InfoSection title="Identificación">
        <InfoRow label="Nombre completo" value={profile.personName} />
        <InfoRow label="Cédula / ID" value={profile.nationalId} />
        <InfoRow label="Género" value={profile.gender} />
        <InfoRow label="Estado civil" value={profile.maritalStatus} />
        <InfoRow label="Fecha de nacimiento" value={profile.birthDate ? formatDate(profile.birthDate) : null} />
        <InfoRow label="Lugar de nacimiento" value={profile.birthPlace} />
        <InfoRow label="Nacionalidad" value={profile.nationality} />
        <InfoRow label="Nivel de educación" value={profile.educationTitle} />
        <InfoRow label="Hijos" value={profile.childrenCount !== null ? formatInteger(profile.childrenCount) : null} />
        <InfoRow label="Dependientes" value={profile.dependentsCount !== null ? formatInteger(profile.dependentsCount) : null} />
        <InfoRow label="Discapacidad" value={formatBoolean(profile.disabledFlag)} />
      </InfoSection>

      <InfoSection title="Empleo">
        <InfoRow label="Cargo" value={profile.jobTitle} />
        <InfoRow label="Empresa" value={profile.employerName} />
        <InfoRow label="Tipo de empleado" value={profile.employeeType} />
        <InfoRow label="Tipo de contrato" value={profile.contractType} />
        <InfoRow label="Clasificación" value={profile.jobClassificationCode} />
        <InfoRow label="Código de finca" value={profile.farmCode} />
        <InfoRow label="Trabajadora social" value={profile.associatedWorkerName} />
        <InfoRow label="Bono por rendimiento" value={formatBoolean(profile.performancePayApplicable)} />
        <InfoRow label="Último ingreso" value={profile.lastEntryDate ? formatDate(profile.lastEntryDate) : null} />
        <InfoRow label="Última salida" value={profile.lastExitDate ? formatDate(profile.lastExitDate) : null} />
      </InfoSection>

      <InfoSection title="Contacto">
        <InfoRow label="Email" value={profile.email} />
        <InfoRow label="Teléfono" value={profile.phoneNumber} />
        <InfoRow label="Dirección" value={profile.address} />
        <InfoRow label="Ciudad" value={profile.city} />
        <InfoRow label="Parroquia" value={profile.parish} />
      </InfoSection>
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-background/60">
        {children}
      </div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid gap-1 border-b border-border/50 px-4 py-3 last:border-b-0 sm:grid-cols-[170px_minmax(0,1fr)] sm:gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words text-sm font-medium">{value}</span>
    </div>
  );
}

function formatBoolean(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return null;
}
