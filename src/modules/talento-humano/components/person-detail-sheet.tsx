"use client";

import type { ReactNode } from "react";
import { LoaderCircle, UserRound } from "lucide-react";
import useSWRImmutable from "swr/immutable";

import { fetchJson } from "@/lib/fetch-json";
import type { TalentoPersonProfile } from "@/lib/talento-humano";
import { SheetShell } from "@/shared/overlays/sheet-shell";
import { formatDate, formatInteger } from "@/shared/lib/format";

const profileFetcher = (url: string) =>
  fetchJson<TalentoPersonProfile>(url, "No se pudo cargar el perfil.");

export function PersonDetailSheet({
  personId,
  personName,
  onClose,
}: {
  personId: string;
  personName: string;
  onClose: () => void;
}) {
  const { data: profile, error, isLoading } = useSWRImmutable(
    `/api/talento-humano/persona/${encodeURIComponent(personId)}`,
    profileFetcher,
  );

  const displayName = profile?.personName ?? personName;

  return (
    <SheetShell
      title={displayName}
      description={personId}
      onClose={onClose}
      widthClassName="max-w-2xl"
      footer={<p className="text-xs text-muted-foreground">Ficha reutilizable de colaborador. Base canónica para futuros perfiles personales.</p>}
    >
      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando perfil...
        </div>
      ) : error ? (
        <div className="min-h-[40vh] py-20 text-center text-sm text-destructive">{error.message}</div>
      ) : !profile ? (
        <div className="min-h-[40vh] py-20 text-center text-sm text-muted-foreground">
          No se encontró información de esta persona.
        </div>
      ) : (
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
      )}
    </SheetShell>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground">
          <UserRound className="size-3.5" />
        </div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      </div>
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
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

function formatBoolean(value: boolean | null) {
  if (value === true) return "Sí";
  if (value === false) return "No";
  return null;
}
